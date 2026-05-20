import { Effect, FileSystem, Path } from "effect";
import type { CodexStatus } from "@shared/schemas";
import { ElectronApp } from "../../platform";
import { runBackendEffect } from "../../runtime";
import { resolveAvailableCodexCli, type CodexCliResolution } from "./cli";

export type CodexStatusDependencies = {
  resolveCodexCli?: () => Promise<CodexCliResolution | null>;
  hasApiKey?: () => Promise<boolean>;
  hasAuthFile?: () => Promise<boolean>;
};

const resolveHasApiKey = (): Promise<boolean> =>
  runBackendEffect(
    ElectronApp.use((electronApp) => electronApp.env.pipe(Effect.map((env) => Boolean(env.OPENAI_API_KEY || env.CODEX_API_KEY))))
  );

const resolveHasAuthFile = async (): Promise<boolean> => {
  try {
    await runBackendEffect(
      Effect.gen(function*() {
        const electronApp = yield* ElectronApp;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* electronApp.homeDirectory;
        yield* fs.readFileString(path.join(home, ".codex", "auth.json"), "utf8");
      })
    );
    return true;
  } catch {
    return false;
  }
};

const CODEX_STATUS_RESOLVE_TIMEOUT_MS = 12_000;

const unavailableCodexStatus = (message: string): CodexStatus => ({
  sdkAvailable: true,
  cliAvailable: false,
  cliVersion: null,
  authenticated: false,
  message
});

const getCodexStatusPromise = async (dependencies: CodexStatusDependencies = {}): Promise<CodexStatus> => {
  const resolveCodexCli = dependencies.resolveCodexCli ?? resolveAvailableCodexCli;
  const hasApiKey = dependencies.hasApiKey ?? resolveHasApiKey;
  const hasAuthFile = dependencies.hasAuthFile ?? resolveHasAuthFile;
  const [cliResolution, apiKeyPresent, authFilePresent] = await Promise.all([
    resolveCodexCli(),
    hasApiKey(),
    hasAuthFile()
  ]);
  const cliAvailable = Boolean(cliResolution);
  const cliVersion = cliResolution?.version ?? null;
  const authenticated = authFilePresent || apiKeyPresent;

  return {
    sdkAvailable: true,
    cliAvailable,
    cliVersion,
    authenticated,
    message: cliAvailable
      ? authenticated
        ? "Codex is available."
        : "Codex CLI is available, but no Codex auth file or API key was found."
      : "Codex CLI was not found in the SDK bundle or on PATH."
  };
};

export const getCodexStatus = async (dependencies: CodexStatusDependencies = {}): Promise<CodexStatus> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      getCodexStatusPromise(dependencies),
      new Promise<CodexStatus>((resolve) => {
        timeoutHandle = setTimeout(
          () => resolve(unavailableCodexStatus("Codex status check timed out.")),
          CODEX_STATUS_RESOLVE_TIMEOUT_MS
        );
      })
    ]);
  } catch {
    return unavailableCodexStatus("Codex status check failed.");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};
