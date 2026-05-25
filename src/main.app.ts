import { Cause, Effect } from "effect";
import { relayRendererApiBaseUrl } from "./app/relayRendererApiBaseUrl";
import { RelayWindow } from "./app/RelayWindow";
import { appRuntime, runAppEffect } from "./app/AppRuntime";
import { HttpRestApi } from "./http";
import { ElectronApp } from "./platform";
import { getLogPath } from "./runtime/Logging";
import { wakeRecoveredWork } from "./services/codex";
import { ensureReadyTicketAutomationForAllProjects } from "./services/codex/readyTicketScheduler";
import { recoverStalePathLocksForAllProjects } from "./services/path-lock";
import { WorkEngine } from "./services/work";
import { RegistryStore } from "./services/registry/store";

const relayApp = Effect.scoped(Effect.gen(function* () {
  const electronApp = yield* ElectronApp;
  const relayWindow = yield* RelayWindow;
  const workEngine = yield* WorkEngine;
  yield* electronApp.startLifecycleSupervision({
    onActivate: () => relayWindow.activate()
  });

  // Wait for Electron to be ready
  yield* electronApp.whenReady();
  const logPath = yield* getLogPath;
  yield* Effect.logInfo("Relay starting").pipe(Effect.annotateLogs({ scope: "app", logPath }));

  const httpApi = yield* Effect.acquireRelease(
    Effect.promise(() =>
      HttpRestApi.start({
        runEffect: runAppEffect
      })
    ),
    (api) => Effect.promise(() => api.close())
  );

  // Create main window
  yield* relayWindow.createMain({
    apiBaseUrl: relayRendererApiBaseUrl(process.env.ELECTRON_RENDERER_URL, httpApi.baseUrl),
    apiToken: httpApi.token
  });

  // Recover from registry
  const recovered = yield* workEngine.recoverAll();
  const recoveredCount = recovered.reduce((count, report) => count + report.recovered.length, 0);
  if (recoveredCount > 0) {
    yield* Effect.logInfo("Recovered backend work").pipe(Effect.annotateLogs({ scope: "app", count: recoveredCount }));
  }
  yield* Effect.promise(() => wakeRecoveredWork(recovered));
  const registry = yield* RegistryStore.use((store) => store.read());
  yield* Effect.promise(() =>
    recoverStalePathLocksForAllProjects(registry.projects.map((project) => project.path))
  );
  ensureReadyTicketAutomationForAllProjects();

  yield* electronApp.awaitShutdown();
}));

const appFiber = appRuntime.runFork(
  relayApp.pipe(
    Effect.catchCause((cause) =>
      Effect.logError("Relay failed to start").pipe(Effect.annotateLogs({ scope: "app", cause: Cause.pretty(cause) }))
    )
  )
);

appFiber.addObserver(() => {
  Effect.runFork(appRuntime.disposeEffect);
});
