import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { ConfigProvider, Effect, Layer, ManagedRuntime, Sink, Stream } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, appendFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CodexOptions, Input, ThreadOptions } from "@openai/codex-sdk";
import { captureRunGitBaseline, readRunGitBaseline, revertRunGitChanges } from "../src/services/git/GitRunBaseline";
import { writeRunLog } from "../src/services/run-events";
import {
  approveScopeClarificationRedraft,
  cancelCodexRun,
  createCodex,
  getCodexStatus,
  preflightCodexRun,
  readCodexRunEvents,
  reconcileTicketQueueState,
  maybeFinalizeImplementationScopeAfterClarification,
  drainProjectSchedulerForProject,
  reconcileSchedulableReadyTickets,
  resumeCodexRun,
  sendRepositoryChatMessage,
  startCodexRun,
  startTicketDraftRun,
  type CodexRunDependencies,
  type CreateCodexDependencies,
  type RepositoryChatCodexClient,
  type RepositoryChatThread,
  type TicketDraftStartDependencies,
  archiveTicket,
  archiveTicketBundle,
  type TicketUpdateCodexClient,
  type TicketUpdateDependencies,
  type TicketUpdateThread
} from "../src/services/codex";
import { resolveAvailableCodexCli, runCodexVersionEffect, type CodexCliCandidate } from "../src/services/codex/cli";
import { createClaudeAgentProvider } from "../src/services/agents/claudeProvider";
import { createCursorAgentProvider } from "../src/services/agents/cursorProvider";
import { configureLocalVoiceInput, readLocalVoiceInputStatus, transcribeLocalVoiceInput } from "../src/services/agents/localVoiceInput";
import { readAgentProviderInventory, switchAgentProviderSelection } from "../src/services/registry";
import {
  BackendWorkLive,
  markWorkRunStatus,
  TicketWorkService,
  WorkLedger,
  WorkLedgerLive,
  WorkNotFoundError,
  WorkEngine,
  WorkScheduler,
  WorkSchedulerLive
} from "../src/services/work";
import { BackendClock } from "../src/platform";
import { BackendConfig, BackendConfigDefaults, loadBackendConfig } from "../src/config/AppConfig";
import { HttpRestApi, type HttpRestApiHandle, type HttpRestApiOptions } from "../src/http";
import { route, type HttpResourceRoute } from "../src/http/resources";
import { ticketRoutes } from "../src/http/resources/tickets";
import { runBackendEffect, fromPromise } from "../src/runtime";
import { ticketEndpoints } from "../src/shared/http";
import type {
  AppRegistry,
  HierarchyDraftPlan,
  RepositoryChatStreamEvent,
  TicketCreateInput,
  TicketRecord
} from "../src/shared/schemas";
import {
  boardVisibleColumns,
  RELAY_ARCHIVE_STATUS,
  RELAY_COMPLETED_STATUS,
  RELAY_READY_STATUS
} from "../src/shared/schemas/board";
import { PENDING_ARCHIVE_LABEL, sortArchiveBundleIds } from "../src/renderer/src/lib/boardArchive";
import {
  answerClarificationQuestion,
  createClarificationQuestions,
  applyHierarchyDraftPlan,
  applyImplementationScopeRedraftToTicket,
  createPendingTicketDraft,
  createSubticket,
  createTaskUnderFeature,
  createTicket,
  deleteTicket,
  initializeProject,
  isTicketNotFoundError,
  listTicketReferenceCandidates,
  linkFeatureSubticket,
  linkSubticket,
  moveTicket,
  readBoard,
  readClarificationQuestions,
  readProjectConfig,
  readTicket,
  saveTicketAttachment,
  Storage,
  StorageLive,
  summarizeProject,
  transitionTicketStatus,
  writeTicket,
  unlinkFeatureSubticket,
  unlinkSubticket,
  writeProjectConfig
} from "../src/storage";
import type { CodexStatus, RendererRunEvent } from "../src/shared/schemas";

const readyCodexStatus: CodexStatus = {
  sdkAvailable: true,
  cliAvailable: true,
  cliVersion: "codex-test",
  authenticated: true,
  message: "Codex is available."
};

const createProject = async (): Promise<string> => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "relay-backend-"));
  await initializeProject(projectPath);
  return projectPath;
};

const createProjectWithAgentConcurrency = async (agentConcurrency: number): Promise<string> => {
  const projectPath = await createProject();
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    settings: {
      ...config.settings,
      agentConcurrency
    }
  });
  return projectPath;
};

const initializeGitProject = async (projectPath: string): Promise<void> => {
  const runGit = promisify(execFile);
  await runGit("git", ["init", "-b", "main"], { cwd: projectPath });
  await runGit("git", ["config", "user.name", "Relay Test"], { cwd: projectPath });
  await runGit("git", ["config", "user.email", "relay@example.com"], { cwd: projectPath });
  await writeFile(path.join(projectPath, "README.md"), "# Relay Test Repo\n");
  await runGit("git", ["add", "."], { cwd: projectPath });
  await runGit("git", ["commit", "-m", "init"], { cwd: projectPath });
};

const auditEvents = async (projectPath: string): Promise<Array<{ eventType: string; actor: string; source: string; payload: unknown }>> => {
  const raw = await readFile(path.join(projectPath, ".relay", "audit.jsonl"), "utf8");
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { eventType: string; actor: string; source: string; payload: unknown });
};

const allowNonGitRuns = async (projectPath: string): Promise<void> => {
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    settings: {
      ...config.settings,
      allowNonGitCodexRuns: true
    }
  });
};

const defaultPlannedFilesForTitle = (title: string): string[] => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return [`src/${slug || "task"}.ts`];
};

const createImplementationTicket = async (projectPath: string, input: TicketCreateInput): Promise<TicketRecord> => {
  if (input.ticketType && input.ticketType !== "task") return createTicket(projectPath, input);
  return createTicket(projectPath, {
    ...input,
    plannedFiles: input.plannedFiles ?? defaultPlannedFilesForTitle(input.title)
  });
};

const createFakeRunEventSink = (): { runEventSink: NonNullable<CodexRunDependencies["runEventSink"]>; events: RendererRunEvent[] } => {
  const events: RendererRunEvent[] = [];
  return {
    runEventSink: {
      emit: (event: RendererRunEvent) => {
        events.push(event);
      }
    },
    events
  };
};

const waitFor = async (predicate: () => boolean, label: string): Promise<void> => {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`Timed out waiting for ${label}`);
};

const waitForAsync = async (predicate: () => Promise<boolean>, label: string): Promise<void> => {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`Timed out waiting for ${label}`);
};

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
};

type TicketUpdateThreadOptions = Parameters<TicketUpdateCodexClient["startThread"]>[0];
type TicketUpdateRunOptions = NonNullable<Parameters<TicketUpdateThread["run"]>[1]> & { signal: AbortSignal };

const archiveUpdateJson = (title: string): string =>
  JSON.stringify({
    title,
    priority: "medium",
    labels: [],
    authoringState: "ready",
    plannedFiles: null,
    patch: {
      summary: `Archived ${title}`,
      fullMarkdown: `# ${title}\n\n## Requirements\n\n- Archived\n`,
      appendMarkdown: null
    },
    clarificationQuestions: []
  });

const createArchiveTicketUpdateCodexClient = (
  threadId: string,
  title: string
): TicketUpdateCodexClient => ({
  startThread: () => ({
    id: threadId,
    run: async (input, runOptions) => {
      if (typeof input !== "string") throw new TypeError("Archive tests expect string prompts.");
      if (!runOptions?.signal) throw new TypeError("Archive tests expect an AbortSignal.");
      return { items: [], usage: null, finalResponse: archiveUpdateJson(title) };
    }
  })
});

const createArchiveBundleDependencies = (
  expectedOrder: readonly string[]
): { dependencies: TicketUpdateDependencies; archivedOrder: string[]; events: RendererRunEvent[] } => {
  const archivedOrder: string[] = [];
  let nextRunIndex = 0;
  let nextClientIndex = 0;
  const { runEventSink, events } = createFakeRunEventSink();
  return {
    archivedOrder,
    events,
    dependencies: {
      runEventSink,
      createRunId: () => `run_archive_bundle_${nextRunIndex++}`,
      createCodexClient: () => {
        const ticketId = expectedOrder[nextClientIndex];
        if (!ticketId) throw new Error("Archive bundle mock received more runs than expected tickets.");
        nextClientIndex += 1;
        archivedOrder.push(ticketId);
        return createArchiveTicketUpdateCodexClient(`thread_archive_${ticketId}`, `Archived ${ticketId}`);
      }
    }
  };
};

const createArchiveTicketRoute = (dependencies: TicketUpdateDependencies): HttpResourceRoute =>
  route(ticketEndpoints.archive, (input) =>
    Effect.gen(function*() {
      const bundleIds = input.ticketIds?.filter((ticketId) => ticketId.trim().length > 0) ?? [];
      if (bundleIds.length > 0) {
        return yield* fromPromise(() => archiveTicketBundle(input.projectPath, bundleIds, dependencies));
      }
      const ticketId = input.ticketId?.trim();
      if (!ticketId) {
        return yield* Effect.fail(new Error("Provide ticketId or ticketIds to archive."));
      }
      return yield* fromPromise(() => archiveTicket(input.projectPath, ticketId, dependencies));
    })
  );

const startTestArchiveApi = async (
  t: TestContext,
  routes: ReadonlyArray<HttpResourceRoute>,
  runEffect: HttpRestApiOptions["runEffect"] = runBackendEffect
): Promise<HttpRestApiHandle | null> => {
  try {
    return await HttpRestApi.start({
      token: "test-token",
      runEffect,
      routes
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EPERM") {
      t.skip("Sandbox disallowed binding a localhost HTTP server.");
      return null;
    }
    throw error;
  }
};

const seedCompletedArchiveBundle = async (
  projectPath: string
): Promise<{ epicId: string; featureId: string; taskId: string }> => {
  const epic = await createTicket(projectPath, {
    title: "Archive bundle epic",
    ticketType: "epic",
    priority: "medium",
    labels: [],
    status: RELAY_COMPLETED_STATUS,
    markdown: "# Archive bundle epic\n"
  });
  const feature = await createSubticket({
    projectPath,
    epicId: epic.frontMatter.id,
    ticket: {
      title: "Archive bundle feature",
      priority: "medium",
      labels: [],
      markdown: "# Archive bundle feature\n"
    }
  });
  await moveTicket({ projectPath, ticketId: feature.frontMatter.id, targetStatus: RELAY_COMPLETED_STATUS });
  const task = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "Archive bundle task", priority: "medium" }
  });
  await moveTicket({ projectPath, ticketId: task.frontMatter.id, targetStatus: RELAY_COMPLETED_STATUS });
  return { epicId: epic.frontMatter.id, featureId: feature.frontMatter.id, taskId: task.frontMatter.id };
};

const validDraftJson = (title: string): string =>
  JSON.stringify({
    title,
    summary: `Lean summary for ${title}.`,
    priority: "medium",
    labels: ["codex"],
    context: "Context from Codex.",
    researchFindings: ["Draft research found no blocking ambiguity."],
    requirements: ["Build the requested behavior."],
    implementationPlan: ["Apply the requested behavior using the existing project patterns."],
    testPlan: ["Run npm test."],
    acceptanceCriteria: ["The requested behavior is covered."],
    clarificationQuestions: [],
    assumptions: [],
    implementationNotes: ["Keep the change focused."],
    draftState: "ready",
    blockingClarificationQuestions: [],
    ticketType: "task",
    subtickets: [],
    featureStubs: [],
    leanTasks: []
  });

test("work ledger persists snapshots, event logs, and ignores corrupt trailing event lines", async () => {
  const projectPath = await createProject();
  const workId = "work_ledger";
  const submitInput = {
    workId,
    subject: "worker" as const,
    action: "dispatch" as const,
    kind: "worker.dispatch" as const,
    projectPath,
    idempotencyKey: "worker:test",
    executor: "worker" as const,
    runId: "run_work_ledger",
    ticketId: "tkt_work",
    payload: { workerType: "local", runId: "run_work_ledger" },
    metadata: { test: true }
  };

  const submitted = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.submit(submitInput)), WorkLedgerLive)
  );
  assert.equal(submitted.status, "created");

  const duplicate = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.submit(submitInput)), WorkLedgerLive)
  );
  assert.equal(duplicate.createdAt, submitted.createdAt);

  await runBackendEffect(
    Effect.provide(
      WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "queued", message: "Queued." })),
      WorkLedgerLive
    )
  );
  const running = await runBackendEffect(
    Effect.provide(
      WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "running", message: "Started." })),
      WorkLedgerLive
    )
  );
  assert.equal(running.status, "running");

  const snapshotPath = path.join(projectPath, ".relay", "work", "runs", workId, "snapshot.json");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as { status: string; runId: string };
  assert.equal(snapshot.status, "running");
  assert.equal(snapshot.runId, "run_work_ledger");

  await appendFile(path.join(projectPath, ".relay", "work", "runs", workId, "events.jsonl"), "{not json}\n");
  const events = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readEvents(projectPath, workId)), WorkLedgerLive)
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["work.submitted", "work.queued", "work.running", "work.corrupt_event_ignored"]
  );
});

test("work ledger keeps terminal snapshots immutable and reports typed missing-work errors", async () => {
  const projectPath = await createProject();
  const workId = "work_terminal";
  const submitInput = {
    workId,
    subject: "worker" as const,
    action: "dispatch" as const,
    kind: "worker.dispatch" as const,
    projectPath,
    idempotencyKey: "worker:terminal",
    executor: "worker" as const,
    runId: "run_work_terminal",
    ticketId: "tkt_work_terminal",
    payload: { workerType: "local", runId: "run_work_terminal" }
  };

  await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.submit(submitInput)), WorkLedgerLive)
  );
  await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "queued" })), WorkLedgerLive)
  );
  await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "running" })), WorkLedgerLive)
  );
  const completed = await runBackendEffect(
    Effect.provide(
      WorkLedger.use((ledger) =>
        ledger.transition({ projectPath, workId, status: "completed", result: { ok: true }, message: "Done." })
      ),
      WorkLedgerLive
    )
  );
  assert.equal(completed.status, "completed");

  await assert.rejects(
    runBackendEffect(
      Effect.provide(
        WorkLedger.use((ledger) =>
          ledger.transition({ projectPath, workId, status: "failed", error: "late failure", message: "Too late." })
        ),
        WorkLedgerLive
      )
    )
  );
  const blocked = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readSnapshot(projectPath, workId)), WorkLedgerLive)
  );
  assert.equal(blocked?.status, "completed");
  assert.deepEqual(blocked?.result, { ok: true });
  assert.equal(blocked?.message, "Done.");

  const events = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readEvents(projectPath, workId)), WorkLedgerLive)
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["work.submitted", "work.queued", "work.running", "work.completed"]
  );

  await assert.rejects(
    runBackendEffect(
      Effect.provide(
        WorkLedger.use((ledger) => ledger.transition({ projectPath, workId: "work_missing", status: "running" })),
        WorkLedgerLive
      )
    ),
    (error) => error instanceof WorkNotFoundError && error.workId === "work_missing"
  );
});

test("ticket work service submits implementation work and exposes durable status transitions", async () => {
  const projectPath = await createProject();
  const handle = await runBackendEffect(
    Effect.provide(
      TicketWorkService.use((service) =>
        service.submitImplementation(
          { projectPath, ticketId: "tkt_work_supervisor" },
          { runId: "run_work_supervisor", resume: false }
        )
      ),
      BackendWorkLive
    )
  );

  assert.equal(handle.kind, "ticket.implementation");
  assert.equal(handle.providerId, "codex");
  assert.equal(handle.status, "queued");

  const running = await markWorkRunStatus(projectPath, "run_work_supervisor", "running", {
    message: "Started."
  });
  assert.ok(running?.currentAttempt?.attemptId);
  assert.ok(running.currentAttempt.leaseToken);
  await assert.rejects(
    markWorkRunStatus(projectPath, "run_work_supervisor", "completed", {
      result: { ok: true },
      message: "Done."
    })
  );
  const completed = await markWorkRunStatus(projectPath, "run_work_supervisor", "completed", {
    result: { ok: true },
    message: "Done.",
    attemptId: running.currentAttempt.attemptId,
    leaseToken: running.currentAttempt.leaseToken
  });
  assert.equal(completed?.status, "completed");

  const polled = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readSnapshot(projectPath, handle.workId)), BackendWorkLive)
  );
  assert.equal(polled?.status, "completed");
  assert.deepEqual(polled?.result, { ok: true });
});

test("work scheduler owns live Codex lifecycle state", async () => {
  const projectPath = path.resolve(await createProject());
  const implementationAbort = new AbortController();
  const draftAbort = new AbortController();
  const updateAbort = new AbortController();

  await runBackendEffect(
    Effect.provide(
      WorkScheduler.use((registry) =>
        Effect.gen(function*() {
          yield* registry.enqueueImplementation("run_registry_impl", {
            input: { projectPath, ticketId: "tkt_registry_impl" },
            resume: false,
            dependencies: { source: "test" }
          });
          const queued = yield* registry.getQueuedImplementation("run_registry_impl");
          assert.equal(queued?.input.ticketId, "tkt_registry_impl");
          assert.deepEqual(queued?.dependencies, { source: "test" });

          yield* registry.markImplementationStarting("run_registry_impl", { projectPath, ticketId: "tkt_registry_impl" });
          assert.equal(yield* registry.activeImplementationRunCount(projectPath), 1);
          assert.equal(yield* registry.isImplementationActiveOrStarting("run_registry_impl"), true);

          yield* registry.registerImplementationActive("run_registry_impl", {
            abortController: implementationAbort,
            projectPath,
            ticketId: "tkt_registry_impl"
          });
          assert.equal(yield* registry.activeRunIdForTicket(projectPath, "tkt_registry_impl"), "run_registry_impl");
          assert.equal(yield* registry.getQueuedImplementation("run_registry_impl"), null);
          assert.equal(yield* registry.activeImplementationRunCount(projectPath), 1);

          yield* registry.registerDraft("run_registry_draft", {
            abortController: draftAbort,
            projectPath,
            ticketId: "tkt_registry_draft"
          });
          assert.equal(yield* registry.activeRunIdForTicket(projectPath, "tkt_registry_draft"), "run_registry_draft");

          const firstUpdate = yield* registry.beginTicketUpdate("run_registry_update", `${projectPath}:tkt_registry_update`, {
            abortController: updateAbort,
            projectPath,
            ticketId: "tkt_registry_update"
          });
          assert.deepEqual(firstUpdate, { started: true });
          assert.equal((yield* registry.getTicketUpdate("run_registry_update"))?.ticketId, "tkt_registry_update");
          const duplicateUpdate = yield* registry.beginTicketUpdate("run_registry_update_duplicate", `${projectPath}:tkt_registry_update`, {
            abortController: new AbortController(),
            projectPath,
            ticketId: "tkt_registry_update"
          });
          assert.deepEqual(duplicateUpdate, { started: false, existingRunId: "run_registry_update" });

          assert.equal(yield* registry.claimProjectSchedulerLoop(projectPath), true);
          assert.equal(yield* registry.claimProjectSchedulerLoop(projectPath), false);
          yield* registry.wakeProjectScheduler(projectPath);
          yield* registry.takeProjectSchedulerWake(projectPath);
          yield* registry.releaseProjectSchedulerLoop(projectPath);
          assert.equal(yield* registry.claimProjectSchedulerLoop(projectPath), true);
          yield* registry.releaseProjectSchedulerLoop(projectPath);

          yield* registry.completeImplementation("run_registry_impl");
          yield* registry.completeDraft("run_registry_draft");
          yield* registry.completeTicketUpdate("run_registry_update");
          assert.equal(yield* registry.activeImplementationRunCount(projectPath), 0);
          assert.equal(yield* registry.activeRunIdForTicket(projectPath, "tkt_registry_impl"), null);
          assert.equal(yield* registry.getTicketUpdate("run_registry_update"), null);
        })
      ),
      WorkSchedulerLive
    )
  );
});

test("work scheduler state is shared across work runtimes", async () => {
  const projectPath = path.resolve(await createProject());
  const ticketId = "tkt_shared_scheduler";
  const handle = await runBackendEffect(
    Effect.provide(
      TicketWorkService.use((service) =>
        service.submitImplementation({ projectPath, ticketId }, { runId: "run_shared_scheduler", resume: false })
      ),
      BackendWorkLive
    )
  );

  await runBackendEffect(
    Effect.provide(
      WorkScheduler.use((scheduler) =>
        scheduler.enqueueImplementation(handle.workId, {
          input: { projectPath, ticketId },
          resume: false,
          dependencies: { source: "compatibility-helper" }
        })
      ),
      WorkSchedulerLive
    )
  );

  const claim = await runBackendEffect(
    Effect.provide(
      WorkEngine.use((engine) => engine.claimNext({ projectPath, executor: "agent", providerId: "codex" })),
      BackendWorkLive
    )
  );
  assert.equal(claim?.workId, handle.workId);
  assert.ok(claim?.attemptId);
  assert.ok(claim?.leaseToken);

  const starting = await runBackendEffect(
    Effect.provide(WorkScheduler.use((scheduler) => scheduler.getStartingImplementation(handle.workId)), WorkSchedulerLive)
  );
  assert.equal(starting?.attemptId, claim?.attemptId);
  assert.equal(starting?.leaseToken, claim?.leaseToken);
});

test("work ledger serializes idempotent submit and terminal races", async () => {
  const projectPath = await createProject();
  const workId = "work_concurrent";
  const submitInput = {
    workId,
    subject: "worker" as const,
    action: "dispatch" as const,
    kind: "worker.dispatch" as const,
    projectPath,
    idempotencyKey: "worker:concurrent",
    executor: "worker" as const,
    runId: "run_work_concurrent",
    payload: { workerType: "local", runId: "run_work_concurrent" }
  };

  const submitted = await Promise.all(
    Array.from({ length: 5 }, () =>
      runBackendEffect(Effect.provide(WorkLedger.use((ledger) => ledger.submit(submitInput)), WorkLedgerLive))
    )
  );
  assert.equal(new Set(submitted.map((snapshot) => snapshot.createdAt)).size, 1);
  let events = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readEvents(projectPath, workId)), WorkLedgerLive)
  );
  assert.deepEqual(events.map((event) => event.type), ["work.submitted"]);

  await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "queued" })), WorkLedgerLive)
  );
  await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "running" })), WorkLedgerLive)
  );

  const terminalResults = await Promise.allSettled([
    runBackendEffect(
      Effect.provide(
        WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "completed", result: { winner: "completed" } })),
        WorkLedgerLive
      )
    ),
    runBackendEffect(
      Effect.provide(
        WorkLedger.use((ledger) => ledger.transition({ projectPath, workId, status: "failed", error: { winner: "failed" } })),
        WorkLedgerLive
      )
    )
  ]);
  assert.equal(terminalResults.filter((result) => result.status === "fulfilled").length, 1);
  const snapshot = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readSnapshot(projectPath, workId)), WorkLedgerLive)
  );
  assert.ok(snapshot?.status === "completed" || snapshot?.status === "failed");
  events = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readEvents(projectPath, workId)), WorkLedgerLive)
  );
  assert.equal(new Set(events.map((event) => event.sequence)).size, events.length);
  assert.deepEqual(events.map((event) => event.sequence), events.map((_, index) => index + 1));
});

test("work engine claims require leases and record claim heartbeat progress events", async () => {
  const projectPath = await createProject();
  const handle = await runBackendEffect(
    Effect.provide(
      WorkEngine.use((engine) =>
        engine.submit({
          workId: "work_claim_events",
          subject: "worker",
          action: "dispatch",
          kind: "worker.dispatch",
          projectPath,
          idempotencyKey: "worker:claim-events",
          executor: "worker",
          runId: "run_claim_events",
          payload: { runId: "run_claim_events" }
        })
      ),
      BackendWorkLive
    )
  );

  const claim = await runBackendEffect(
    Effect.provide(
      WorkEngine.use((engine) => engine.claimWork({ projectPath, workId: handle.workId, executor: "worker", providerId: "test" })),
      BackendWorkLive
    )
  );
  assert.ok(claim?.attemptId);
  assert.ok(claim?.leaseToken);

  await assert.rejects(
    runBackendEffect(
      Effect.provide(
        WorkEngine.use((engine) =>
          engine.reportCompleted({
            projectPath,
            workId: handle.workId,
            attemptId: claim.attemptId,
            leaseToken: "wrong",
            result: { ok: false }
          })
        ),
        BackendWorkLive
      )
    )
  );

  await runBackendEffect(
    Effect.provide(
      WorkEngine.use((engine) => engine.heartbeat({ projectPath, workId: handle.workId, attemptId: claim.attemptId, leaseToken: claim.leaseToken })),
      BackendWorkLive
    )
  );
  await runBackendEffect(
    Effect.provide(
      WorkEngine.use((engine) =>
        engine.reportProgress({
          projectPath,
          workId: handle.workId,
          attemptId: claim.attemptId,
          leaseToken: claim.leaseToken,
          payload: { step: "halfway" }
        })
      ),
      BackendWorkLive
    )
  );
  const completed = await runBackendEffect(
    Effect.provide(
      WorkEngine.use((engine) =>
        engine.reportCompleted({
          projectPath,
          workId: handle.workId,
          attemptId: claim.attemptId,
          leaseToken: claim.leaseToken,
          result: { ok: true }
        })
      ),
      BackendWorkLive
    )
  );
  assert.equal(completed.status, "completed");
  const duplicate = await runBackendEffect(
    Effect.provide(
      WorkEngine.use((engine) =>
        engine.reportCompleted({
          projectPath,
          workId: handle.workId,
          attemptId: claim.attemptId,
          leaseToken: claim.leaseToken,
          result: { ok: true }
        })
      ),
      BackendWorkLive
    )
  );
  assert.equal(duplicate.status, "completed");

  const events = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readEvents(projectPath, handle.workId)), BackendWorkLive)
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["work.submitted", "work.queued", "work.claimed", "work.heartbeat", "work.progress", "work.completed"]
  );
});

test("work recovery restores queued implementation work into the scheduler", async () => {
  const projectPath = path.resolve(await createProject());
  const ticket = await createTicket(projectPath, {
    title: "Recover queued implementation",
    priority: "medium",
    labels: ["work"],
    markdown: "# Recover queued implementation\n\nRun the agent after restart.",
    status: "ready"
  });
  const handle = await runBackendEffect(
    Effect.provide(
      TicketWorkService.use((service) =>
        service.submitImplementation({ projectPath, ticketId: ticket.frontMatter.id }, { runId: "run_recover_queue", resume: false })
      ),
      BackendWorkLive
    )
  );

  assert.equal(
    await runBackendEffect(
      Effect.provide(WorkScheduler.use((scheduler) => scheduler.getQueuedImplementation(handle.workId)), WorkSchedulerLive)
    ),
    null
  );

  const report = await runBackendEffect(
    Effect.provide(WorkEngine.use((engine) => engine.recoverProject(projectPath)), BackendWorkLive)
  );
  assert.deepEqual(report.wakeProjectPaths, [projectPath]);
  const queued = await runBackendEffect(
    Effect.provide(WorkScheduler.use((scheduler) => scheduler.getQueuedImplementation(handle.workId)), WorkSchedulerLive)
  );
  assert.equal(queued?.input.ticketId, ticket.frontMatter.id);
  assert.deepEqual(queued?.dependencies, {});
  const events = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readEvents(projectPath, handle.workId)), BackendWorkLive)
  );
  assert.ok(events.some((event) => event.type === "work.recovered"));
});

test("work recovery cancels orphaned ticket work and restores blocked ticket markers", async () => {
  const projectPath = path.resolve(await createProject());
  const orphan = await runBackendEffect(
    Effect.provide(
      TicketWorkService.use((service) =>
        service.submitDraft({ projectPath, idea: "Draft against a missing ticket" }, { runId: "run_orphan_work", ticketId: "missing_ticket" })
      ),
      BackendWorkLive
    )
  );

  await runBackendEffect(Effect.provide(WorkEngine.use((engine) => engine.recoverProject(projectPath)), BackendWorkLive));
  const orphanSnapshot = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readSnapshot(projectPath, orphan.workId)), BackendWorkLive)
  );
  assert.equal(orphanSnapshot?.status, "cancelled");
  const orphanEvents = await runBackendEffect(
    Effect.provide(WorkLedger.use((ledger) => ledger.readEvents(projectPath, orphan.workId)), BackendWorkLive)
  );
  assert.ok(orphanEvents.some((event) => event.type === "work.recovery_conflict"));

  const ticket = await createTicket(projectPath, {
    title: "Restore blocked marker",
    priority: "medium",
    labels: ["work"],
    markdown: "# Restore blocked marker\n\nRecover needs-input state.",
    status: "todo"
  });
  const handle = await runBackendEffect(
    Effect.provide(
      TicketWorkService.use((service) =>
        service.submitUpdate({ projectPath, ticketId: ticket.frontMatter.id, request: "Ask for missing detail" }, { runId: "run_blocked_recover" })
      ),
      BackendWorkLive
    )
  );
  const running = await markWorkRunStatus(projectPath, handle.workId, "running", { message: "Started." });
  assert.ok(running?.currentAttempt?.attemptId);
  await markWorkRunStatus(projectPath, handle.workId, "blocked", {
    message: "Needs input.",
    attemptId: running.currentAttempt.attemptId,
    leaseToken: running.currentAttempt.leaseToken
  });
  await writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      runStatus: "idle",
      lastRunId: handle.runId ?? handle.workId
    }
  });

  await runBackendEffect(Effect.provide(WorkEngine.use((engine) => engine.recoverProject(projectPath)), BackendWorkLive));
  const recoveredTicket = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(recoveredTicket.frontMatter.runStatus, "blocked");
  assert.equal(recoveredTicket.frontMatter.authoringState, "needs_input");
  assert.equal(recoveredTicket.frontMatter.lastRunId, handle.runId ?? handle.workId);
});

type RepositoryChatRunResult = Awaited<ReturnType<RepositoryChatThread["run"]>>;

test("repository chat starts a read-only thread with project and board context", async () => {
  const projectPath = await createProject();
  await mkdir(path.join(projectPath, ".relay", "context"), { recursive: true });
  await writeFile(
    path.join(projectPath, ".relay", "context", "chat.md"),
    "Keep repository chat brief and focused on the exact question.",
    "utf8"
  );
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    name: "Repository Chat Fixture",
    settings: {
      ...config.settings,
      defaultModel: "gpt-chat-test",
      defaultModelReasoningEffort: "high",
      defaultApprovalPolicy: "on-request",
      defaultSandboxMode: "danger-full-access",
      codexNetworkAccessEnabled: true,
      codexWebSearchMode: "live",
      codexAdditionalDirectories: [path.join(projectPath, "packages")]
    }
  });
  await createTicket(projectPath, {
    title: "Document board shortcuts",
    priority: "high",
    labels: ["docs"],
    markdown: "# Document board shortcuts\n\nExplain the keyboard flow for board navigation.",
    status: "todo"
  });

  let capturedPrompt = "";
  const capturedOptions: ThreadOptions[] = [];
  let startCalls = 0;
  const dependencies = {
    getStatus: async () => readyCodexStatus,
    createRequestId: () => "rch_start",
    createCodexClient: (): RepositoryChatCodexClient => ({
      startThread: (options) => {
        startCalls += 1;
        capturedOptions.push(options);
        return {
          id: "thread_repository_chat",
          run: async (input, turnOptions): Promise<RepositoryChatRunResult> => {
            if (typeof input !== "string") throw new TypeError("Repository chat tests expect string prompts.");
            capturedPrompt = input;
            assert.ok(turnOptions?.signal);
            return { items: [], usage: null, finalResponse: "  The shortcut docs should cover arrow and J/K navigation.  " };
          }
        };
      },
      resumeThread: () => {
        throw new Error("resumeThread should not be used for the first repository chat message.");
      }
    })
  };

  const response = await sendRepositoryChatMessage({ projectPath, message: "Where should shortcut docs go?" }, dependencies);

  assert.equal(startCalls, 1);
  assert.deepEqual(response, {
    threadId: "codex::thread_repository_chat",
    message: "The shortcut docs should cover arrow and J/K navigation."
  });
  const options = capturedOptions[0];
  assert.equal(options.workingDirectory, projectPath);
  assert.equal(options.model, "gpt-chat-test");
  assert.equal(options.modelReasoningEffort, "low");
  assert.equal(options.approvalPolicy, "never");
  assert.equal(options.sandboxMode, "read-only");
  assert.equal(options.networkAccessEnabled, false);
  assert.equal(options.webSearchMode, "disabled");
  assert.equal(options.skipGitRepoCheck, true);
  assert.deepEqual(options.additionalDirectories, [path.join(projectPath, "packages")]);
  assert.match(capturedPrompt, /Repository chat rules \(from \.relay\/context\/chat\.md\):/);
  assert.match(capturedPrompt, /Keep repository chat brief and focused on the exact question/);
  assert.match(capturedPrompt, /Treat this like a fast back-and-forth chat, not a report/);
  assert.match(capturedPrompt, /Start with the answer, not with process narration/);
  assert.match(capturedPrompt, /Project path:/);
  assert.match(capturedPrompt, /Repository Chat Fixture/);
  assert.match(capturedPrompt, /Workflow columns: Todo, Ready, In Progress/);
  assert.match(capturedPrompt, /Board summary: 1 total ticket\(s\)\./);
  assert.match(capturedPrompt, /Active tickets:/);
  assert.match(capturedPrompt, /Document board shortcuts/);
  assert.match(capturedPrompt, /Do not create, edit, move, rename, or delete files/);
  assert.match(capturedPrompt, /Do not create, edit, move, rename, or delete Relay tickets or board cards/);
  assert.match(capturedPrompt, /Keep the response short and useful/);
  assert.match(capturedPrompt, /Where should shortcut docs go/);
});

test("repository chat resumes an existing thread without mutating board state", async () => {
  const projectPath = await createProject();
  await createTicket(projectPath, {
    title: "Keep chat read only",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Keep chat read only\n\nRepository chat must not move or edit tickets.",
    status: "ready"
  });
  const boardBefore = await readBoard(projectPath);
  let resumedThreadId = "";
  let resumeCalls = 0;
  const dependencies = {
    getStatus: async () => readyCodexStatus,
    createRequestId: () => "rch_resume",
    createCodexClient: (): RepositoryChatCodexClient => ({
      startThread: () => {
        throw new Error("startThread should not be used when repository chat has a thread id.");
      },
      resumeThread: (threadId, options) => {
        resumeCalls += 1;
        resumedThreadId = threadId;
        assert.equal(options.approvalPolicy, "never");
        assert.equal(options.sandboxMode, "read-only");
        return {
          id: threadId,
          run: async (input, turnOptions): Promise<RepositoryChatRunResult> => {
            assert.equal(typeof input, "string");
            assert.ok(turnOptions?.signal);
            return { items: [], usage: null, finalResponse: "No board state changes are needed." };
          }
        };
      }
    })
  };

  const response = await sendRepositoryChatMessage(
    { projectPath, message: "What changed since my last question?", threadId: "codex::thread_existing_chat" },
    dependencies
  );
  const boardAfter = await readBoard(projectPath);

  assert.equal(resumeCalls, 1);
  assert.equal(resumedThreadId, "thread_existing_chat");
  assert.deepEqual(response, { threadId: "codex::thread_existing_chat", message: "No board state changes are needed." });
  assert.deepEqual(boardAfter, boardBefore);
});

test("repository chat rejects and aborts when the Codex turn never settles", async () => {
  const projectPath = await createProject();
  let runSignal: AbortSignal | undefined;
  const dependencies = {
    getStatus: async () => readyCodexStatus,
    createRequestId: () => "rch_timeout",
    chatTimeoutMs: 5,
    createCodexClient: (): RepositoryChatCodexClient => ({
      startThread: () => ({
        id: "thread_repository_chat_timeout",
        run: async (_input, turnOptions): Promise<RepositoryChatRunResult> => {
          runSignal = turnOptions?.signal;
          return new Promise<RepositoryChatRunResult>(() => undefined);
        }
      }),
      resumeThread: () => {
        throw new Error("resumeThread should not be used for a timeout regression.");
      }
    })
  };

  await assert.rejects(
    sendRepositoryChatMessage({ projectPath, message: "Will this hang?" }, dependencies),
    /Repository chat timed out after 5ms\./
  );
  assert.equal(runSignal?.aborted, true);
});

test("repository chat resumes the provider encoded in the session id instead of the current selection", async () => {
  const projectPath = await createProject();
  const calls: string[] = [];
  const dependencies = {
    selectedProviderId: "cursor" as const,
    createAgentProvider: async (providerId: "codex" | "cursor" | "claude") => ({
      providerId,
      runStructured: async () => {
        throw new Error("structured work should not be used for repository chat");
      },
      runText: async (request: { providerSessionRef?: { externalId?: string | null } | null }) => {
        calls.push(`${providerId}:${request.providerSessionRef?.externalId ?? "new"}`);
        return {
          providerId,
          text: request.providerSessionRef?.externalId ? "Resumed in Cursor." : "Started in Cursor.",
          rawResponse: providerId,
          providerSessionRef: {
            providerId,
            externalId: request.providerSessionRef?.externalId ?? "cursor-session-1"
          }
        };
      }
    })
  };

  const started = await sendRepositoryChatMessage({ projectPath, message: "Start a chat." }, dependencies);
  const resumed = await sendRepositoryChatMessage(
    { projectPath, message: "Resume the same chat.", threadId: started.threadId },
    { ...dependencies, selectedProviderId: "claude" }
  );

  assert.deepEqual(calls, ["cursor:new", "cursor:cursor-session-1"]);
  assert.equal(started.threadId, "cursor::cursor-session-1");
  assert.equal(resumed.threadId, "cursor::cursor-session-1");
  assert.equal(resumed.message, "Resumed in Cursor.");
});

test("repository chat streams delta events before the final response completes for codex-style chat streaming", async () => {
  const projectPath = await createProject();
  const streamedEvents: RepositoryChatStreamEvent[] = [];
  let releaseCompleted!: () => void;
  const completedGate = new Promise<void>((resolve) => {
    releaseCompleted = resolve;
  });

  const responsePromise = sendRepositoryChatMessage(
    { projectPath, message: "Where is the repository chat prompt built?", requestId: "rch_stream" },
    {
      selectedProviderId: "codex",
      getStatus: async () => readyCodexStatus,
      createAgentProvider: async (providerId) => ({
        providerId,
        runStructured: async () => {
          throw new Error("structured work should not be used for repository chat");
        },
        runText: async () => {
          throw new Error("buffered text execution should not be used for streaming repository chat");
        },
        runTextStream: async () => ({
          providerId,
          events: (async function*() {
            yield {
              rawEvent: { type: "message.delta", text: "The prompt is built in " },
              providerSessionRef: { providerId, externalId: "cursor-chat-session" }
            };
            yield {
              rawEvent: { type: "message.delta", text: "`src/services/codex/index.ts`." },
              providerSessionRef: { providerId, externalId: "cursor-chat-session" }
            };
            await completedGate;
          })(),
          completed: (async () => {
            await completedGate;
            return {
              providerId,
              text: "The prompt is built in `src/services/codex/index.ts`.",
              rawResponse: "",
              providerSessionRef: { providerId, externalId: "cursor-chat-session" }
            };
          })()
        })
      }),
      onStreamEvent: (event) => {
        streamedEvents.push(event);
      }
    }
  );

  await waitForAsync(
    async () => streamedEvents.some((event) => event.type === "delta" && event.text.includes("built in")),
    "repository chat delta"
  );
  assert.equal(streamedEvents.some((event) => event.type === "completed"), false);

  releaseCompleted();

  const response = await responsePromise;
  assert.deepEqual(response, {
    threadId: "codex::cursor-chat-session",
    message: "The prompt is built in `src/services/codex/index.ts`."
  });
  assert.deepEqual(
    streamedEvents.map((event) => event.type),
    ["started", "delta", "delta", "completed"]
  );
});

test("repository chat streams cursor-like answer text from message.completed when no deltas arrive", async () => {
  const projectPath = await createProject();
  const streamedEvents: RepositoryChatStreamEvent[] = [];
  let releaseCompleted!: () => void;
  const completedGate = new Promise<void>((resolve) => {
    releaseCompleted = resolve;
  });
  const answer = "The repository chat prompt is assembled in `src/services/codex/index.ts`.";

  const responsePromise = sendRepositoryChatMessage(
    { projectPath, message: "Where is the repository chat prompt built?", requestId: "rch_stream_completed" },
    {
      selectedProviderId: "cursor",
      createAgentProvider: async (providerId) => ({
        providerId,
        runStructured: async () => {
          throw new Error("structured work should not be used for repository chat");
        },
        runText: async () => {
          throw new Error("buffered text execution should not be used for streaming repository chat");
        },
        runTextStream: async () => ({
          providerId,
          events: (async function*() {
            yield {
              rawEvent: { type: "command.started", command: "rg repository chat" },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-2" }
            };
            yield {
              rawEvent: { type: "message.completed", message: answer },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-2" }
            };
            await completedGate;
          })(),
          completed: (async () => {
            await completedGate;
            return {
              providerId,
              text: answer,
              rawResponse: "",
              providerSessionRef: { providerId, externalId: "cursor-chat-session-2" }
            };
          })()
        })
      }),
      onStreamEvent: (event) => {
        streamedEvents.push(event);
      }
    }
  );

  await waitForAsync(
    async () => streamedEvents.some((event) => event.type === "delta" && event.text.includes("assembled in")),
    "repository chat completed delta"
  );
  assert.equal(streamedEvents.some((event) => event.type === "completed"), false);

  releaseCompleted();

  const response = await responsePromise;
  assert.deepEqual(response, {
    threadId: "cursor::cursor-chat-session-2",
    message: answer
  });
  assert.deepEqual(
    streamedEvents.map((event) => event.type),
    ["started", "delta", "completed"]
  );
});

test("repository chat streams cursor-like answer text from a terminal result event", async () => {
  const projectPath = await createProject();
  const streamedEvents: RepositoryChatStreamEvent[] = [];
  const answer = "Relay stores project context under `.relay/context/`.";

  const response = await sendRepositoryChatMessage(
    { projectPath, message: "Where does Relay store project context?", requestId: "rch_stream_result" },
    {
      selectedProviderId: "cursor",
      createAgentProvider: async (providerId) => ({
        providerId,
        runStructured: async () => {
          throw new Error("structured work should not be used for repository chat");
        },
        runText: async () => {
          throw new Error("buffered text execution should not be used for streaming repository chat");
        },
        runTextStream: async () => ({
          providerId,
          events: (async function*() {
            yield {
              rawEvent: { type: "command.output", stdout: "scanning files\n" },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-3" }
            };
            yield {
              rawEvent: { type: "result", subtype: "success", result: answer, session_id: "cursor-chat-session-3" },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-3" }
            };
          })(),
          completed: Promise.resolve({
            providerId,
            text: answer,
            rawResponse: "",
            providerSessionRef: { providerId, externalId: "cursor-chat-session-3" }
          })
        })
      }),
      onStreamEvent: (event) => {
        streamedEvents.push(event);
      }
    }
  );

  assert.deepEqual(response, {
    threadId: "cursor::cursor-chat-session-3",
    message: answer
  });
  assert.deepEqual(
    streamedEvents.map((event) => event.type),
    ["started", "delta", "completed"]
  );
  assert.equal(streamedEvents.find((event) => event.type === "delta")?.text, answer);
});

test("repository chat ignores cursor-like fragment progress and keeps only the lean final answer", async () => {
  const projectPath = await createProject();
  const streamedEvents: RepositoryChatStreamEvent[] = [];
  const answer = "Hey. What do you want to look at?";

  const response = await sendRepositoryChatMessage(
    { projectPath, message: "hey relay", requestId: "rch_stream_greeting" },
    {
      selectedProviderId: "cursor",
      createAgentProvider: async (providerId) => ({
        providerId,
        runStructured: async () => {
          throw new Error("structured work should not be used for repository chat");
        },
        runText: async () => {
          throw new Error("buffered text execution should not be used for streaming repository chat");
        },
        runTextStream: async () => ({
          providerId,
          events: (async function*() {
            yield {
              rawEvent: { type: "message.delta", text: 'The user greeted "hey relay" in the repository chat.' },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-4" }
            };
            yield {
              rawEvent: { type: "message.completed", message: answer },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-4" }
            };
          })(),
          completed: Promise.resolve({
            providerId,
            text: answer,
            rawResponse: "",
            providerSessionRef: { providerId, externalId: "cursor-chat-session-4" }
          })
        })
      }),
      onStreamEvent: (event) => {
        streamedEvents.push(event);
      }
    }
  );

  assert.deepEqual(response, {
    threadId: "cursor::cursor-chat-session-4",
    message: answer
  });
  assert.deepEqual(
    streamedEvents.map((event) => event.type),
    ["started", "delta", "completed"]
  );
  assert.equal(streamedEvents.find((event) => event.type === "delta")?.text, answer);
});

test("repository chat allows cursor answer deltas while suppressing process narration", async () => {
  const projectPath = await createProject();
  const streamedEvents: RepositoryChatStreamEvent[] = [];

  const response = await sendRepositoryChatMessage(
    { projectPath, message: "Why is typing noisy?", requestId: "rch_stream_cursor_delta" },
    {
      selectedProviderId: "cursor",
      createAgentProvider: async (providerId) => ({
        providerId,
        runStructured: async () => {
          throw new Error("structured work should not be used for repository chat");
        },
        runText: async () => {
          throw new Error("buffered text execution should not be used for streaming repository chat");
        },
        runTextStream: async () => ({
          providerId,
          events: (async function*() {
            yield {
              rawEvent: { type: "message.delta", text: "The user reports noisy typing logs." },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-5" }
            };
            yield {
              rawEvent: { type: "message.delta", text: "It autosaves the draft while you type." },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-5" }
            };
            yield {
              rawEvent: { type: "message.completed", message: "It autosaves the draft while you type." },
              providerSessionRef: { providerId, externalId: "cursor-chat-session-5" }
            };
          })(),
          completed: Promise.resolve({
            providerId,
            text: "It autosaves the draft while you type.",
            rawResponse: "",
            providerSessionRef: { providerId, externalId: "cursor-chat-session-5" }
          })
        })
      }),
      onStreamEvent: (event) => {
        streamedEvents.push(event);
      }
    }
  );

  assert.deepEqual(response, {
    threadId: "cursor::cursor-chat-session-5",
    message: "It autosaves the draft while you type."
  });
  assert.deepEqual(
    streamedEvents.map((event) => event.type),
    ["started", "delta", "completed"]
  );
  assert.equal(streamedEvents.find((event) => event.type === "delta")?.text, "It autosaves the draft while you type.");
});

test("cursor structured provider parses plain stdout JSON and captures a session id", async () => {
  const provider = createCursorAgentProvider({
    command: "cursor-agent",
    runCommand: async () => ({
      stdout: JSON.stringify({
        sessionId: "cursor-session-7",
        output: { draftState: "ready", summary: "ok" }
      }),
      stderr: ""
    })
  });

  const result = await provider.runStructured<{ draftState: string; summary: string }>({
    kind: "ticket.draft",
    projectPath: "/tmp/project",
    prompt: "Draft this.",
    outputSchema: {},
    mode: "read_only"
  });

  assert.equal(result.providerId, "cursor");
  assert.equal(result.output.draftState, "ready");
  assert.equal(result.providerSessionRef?.externalId, "cursor-session-7");
});

test("claude structured provider surfaces an actionable stream-json parsing error", async () => {
  const provider = createClaudeAgentProvider({
    runCommand: async () => ({
      stdout: "not-json\n",
      stderr: ""
    })
  });

  await assert.rejects(
    provider.runStructured({
      kind: "ticket.update",
      projectPath: "/tmp/project",
      prompt: "Update this.",
      outputSchema: {},
      mode: "read_only"
    }),
    /stream-json/
  );
});

test("queued implementation work resumes on its stored provider after selection changes", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const firstTicket = await createImplementationTicket(projectPath, {
    title: "Provider continuity first",
    priority: "medium",
    labels: ["provider"],
    markdown: "# Provider continuity first\n"
  });
  const secondTicket = await createImplementationTicket(projectPath, {
    title: "Provider continuity second",
    priority: "medium",
    labels: ["provider"],
    markdown: "# Provider continuity second\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const gate = deferred();
  let selectedProviderId: "cursor" | "claude" = "cursor";
  const providerCalls: string[] = [];

  await startCodexRun(
    { projectPath, ticketId: firstTicket.frontMatter.id },
    {
      runEventSink,
      createRunId: () => "run_provider_continuity_first",
      createCodexClient: () =>
        ({
          startThread: () => ({
            id: "thread_provider_continuity_first",
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_provider_continuity_first" };
                await gate.promise;
                yield { type: "turn.completed" };
              })()
            })
          }),
          resumeThread: () => {
            throw new Error("resumeThread should not be used for a fresh run.");
          }
        }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
    }
  );
  await waitFor(
    () => events.some((event) => event.runId === "run_provider_continuity_first" && event.type === "run.started"),
    "first run start"
  );

  const queued = await startCodexRun(
    { projectPath, ticketId: secondTicket.frontMatter.id },
    {
      runEventSink,
      createRunId: () => "run_provider_continuity_second",
      readSelectedProviderId: async () => selectedProviderId,
      createAgentProvider: async (providerId: "codex" | "cursor" | "claude") => ({
        providerId,
        runStructured: async () => {
          throw new Error("structured output should not be used for implementation runs");
        },
        runText: async () => {
          providerCalls.push(providerId);
          return {
            providerId,
            text: `Implemented in ${providerId}.`,
            rawResponse: JSON.stringify({
              type: "message.completed",
              message: `Implemented in ${providerId}.`,
              session_id: `${providerId}-session-queued`
            }),
            providerSessionRef: {
              providerId,
              externalId: `${providerId}-session-queued`
            }
          };
        }
      })
    }
  );
  assert.equal(queued.state, "queued");
  selectedProviderId = "claude";

  gate.resolve();
  await waitFor(
    () => events.some((event) => event.runId === "run_provider_continuity_second" && event.type === "run.completed"),
    "queued run completion"
  );

  assert.deepEqual(providerCalls, ["cursor"]);
  const completedTicket = await readTicket(projectPath, secondTicket.frontMatter.id);
  assert.equal(completedTicket.frontMatter.codexThreadId, "cursor::cursor-session-queued");
});

test("non-codex implementation runs normalize provider event streams and terminal failures", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const completedTicket = await createImplementationTicket(projectPath, {
    title: "Normalized provider completion",
    priority: "high",
    labels: ["provider"],
    markdown: "# Normalized provider completion\n"
  });
  const failedTicket = await createImplementationTicket(projectPath, {
    title: "Normalized provider failure",
    priority: "high",
    labels: ["provider"],
    markdown: "# Normalized provider failure\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();

  const providerFactory = async (providerId: "codex" | "cursor" | "claude") => ({
    providerId,
    runStructured: async () => {
      throw new Error("structured output should not be used for implementation runs");
    },
    runText: async (request: { prompt: string }) => {
      if (/failure/i.test(request.prompt)) {
        return {
          providerId,
          text: "This should fail.",
          rawResponse: `${JSON.stringify({ type: "run.failed", message: "Provider stream failed." })}\n`,
          providerSessionRef: {
            providerId,
            externalId: "claude-session-failed"
          }
        };
      }
      return {
        providerId,
        text: "Implementation finished.",
        rawResponse: [
          JSON.stringify({ type: "command.started", command: "npm test" }),
          JSON.stringify({ type: "command.output", stdout: "tests passed\n" }),
          JSON.stringify({ type: "command.completed", status: "completed" }),
          JSON.stringify({ type: "file.change", path: "src/main.app.ts", kind: "updated" }),
          JSON.stringify({ type: "approval.requested", approval_id: "approval_1", kind: "command", payload: { command: "npm test" } }),
          JSON.stringify({ type: "approval.resolved", approval_id: "approval_1", decision: "approved" }),
          JSON.stringify({ type: "message.completed", message: "Implementation finished." })
        ].join("\n"),
        providerSessionRef: {
          providerId,
          externalId: "claude-session-completed"
        }
      };
    }
  });

  await startCodexRun(
    { projectPath, ticketId: completedTicket.frontMatter.id },
    {
      runEventSink,
      createRunId: () => "run_provider_normalized_complete",
      selectedProviderId: "claude",
      createAgentProvider: providerFactory
    }
  );
  await waitFor(
    () => events.some((event) => event.runId === "run_provider_normalized_complete" && event.type === "run.completed"),
    "provider completion"
  );

  const completedEvents = await readCodexRunEvents(projectPath, completedTicket.frontMatter.id, "run_provider_normalized_complete");
  assert.equal(completedEvents.some((event) => event.type === "command.started" && event.command === "npm test"), true);
  assert.equal(completedEvents.some((event) => event.type === "command.output" && /tests passed/.test(event.text)), true);
  assert.equal(completedEvents.some((event) => event.type === "command.completed" && event.status === "completed"), true);
  assert.equal(completedEvents.some((event) => event.type === "file.change" && event.path === "src/main.app.ts"), true);
  assert.equal(completedEvents.some((event) => event.type === "approval.requested" && event.approvalId === "approval_1"), true);
  assert.equal(completedEvents.some((event) => event.type === "approval.resolved" && event.approvalId === "approval_1"), true);
  assert.equal(completedEvents.some((event) => event.type === "run.completed" && event.finalStatus === "completed"), true);

  await startCodexRun(
    { projectPath, ticketId: failedTicket.frontMatter.id },
    {
      runEventSink,
      createRunId: () => "run_provider_normalized_failed",
      selectedProviderId: "claude",
      createAgentProvider: providerFactory
    }
  );
  await waitFor(
    () => events.some((event) => event.runId === "run_provider_normalized_failed" && event.type === "run.failed"),
    "provider failure"
  );

  const failedEvents = await readCodexRunEvents(projectPath, failedTicket.frontMatter.id, "run_provider_normalized_failed");
  assert.equal(failedEvents.some((event) => event.type === "run.failed" && event.message === "Provider stream failed."), true);
  assert.equal((await readTicket(projectPath, failedTicket.frontMatter.id)).frontMatter.runStatus, "failed");
});

test("cursor-style streaming providers emit implementation events before the run completes", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Streaming provider progress",
    priority: "high",
    labels: ["provider", "streaming"],
    markdown: "# Streaming provider progress\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const release = deferred<void>();

  const providerFactory = async (providerId: "codex" | "cursor" | "claude") => ({
    providerId,
    runStructured: async () => {
      throw new Error("structured output should not be used for implementation runs");
    },
    runText: async () => {
      throw new Error("buffered text execution should not be used for streaming providers");
    },
    runTextStream: async () => {
      const providerSessionRef = { providerId, externalId: "cursor-session-live" } as const;
      return {
        providerId,
        events: (async function*() {
          yield {
            providerSessionRef,
            rawEvent: { type: "command.started", command: "npm test" }
          };
          await release.promise;
          yield {
            rawEvent: { type: "command.output", stdout: "tests passed\n" }
          };
          yield {
            rawEvent: { type: "message.completed", message: "Implementation finished." }
          };
        })(),
        completed: (async () => {
          await release.promise;
          return {
            providerId,
            text: "Implementation finished.",
            rawResponse: [
              JSON.stringify({ type: "command.started", command: "npm test" }),
              JSON.stringify({ type: "command.output", stdout: "tests passed\n" }),
              JSON.stringify({ type: "message.completed", message: "Implementation finished." })
            ].join("\n"),
            providerSessionRef
          };
        })()
      };
    }
  });

  await startCodexRun(
    { projectPath, ticketId: ticket.frontMatter.id },
    {
      runEventSink,
      createRunId: () => "run_provider_streaming_live",
      selectedProviderId: "cursor",
      createAgentProvider: providerFactory
    }
  );

  await waitFor(
    () => events.some((event) => event.runId === "run_provider_streaming_live" && event.type === "run.started"),
    "streaming provider run start"
  );
  await waitFor(
    () => events.some((event) => event.runId === "run_provider_streaming_live" && event.type === "command.started" && event.command === "npm test"),
    "streaming provider command start"
  );
  assert.equal(events.some((event) => event.runId === "run_provider_streaming_live" && event.type === "run.completed"), false);

  release.resolve();

  await waitFor(
    () => events.some((event) => event.runId === "run_provider_streaming_live" && event.type === "run.completed"),
    "streaming provider completion"
  );

  const persistedEvents = await readCodexRunEvents(projectPath, ticket.frontMatter.id, "run_provider_streaming_live");
  assert.equal(persistedEvents.some((event) => event.type === "command.started" && event.command === "npm test"), true);
  assert.equal(persistedEvents.some((event) => event.type === "command.output" && /tests passed/.test(event.text)), true);
  assert.equal(persistedEvents.some((event) => event.type === "run.completed" && event.finalStatus === "completed"), true);
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.codexThreadId, "cursor::cursor-session-live");
});

test("local voice input status reports ready when whisper.cpp and a model are installed", async () => {
  const status = await readLocalVoiceInputStatus({
    runCommand: async () => ({ stdout: "help", stderr: "" }),
    readEnv: async () => ({ RELAY_WHISPER_MODEL_PATH: "/models/ggml-base.en.bin" }),
    readHomeDirectory: async () => "/Users/test",
    readRegistry: async () => ({
      schemaVersion: 1,
      projects: [],
      selectedProviderId: "codex",
      voiceInput: {
        whisperCommandPath: null
      },
      ui: {
        lastProjectPath: null,
        theme: "system"
      }
    }),
    fileExists: async (target) => target === "/models/ggml-base.en.bin"
  });

  assert.deepEqual(status, {
    available: true,
    backend: "whisper.cpp",
    command: "whisper-cli",
    configuredCommandPath: null,
    defaultCommandPath: "~/whisper.cpp/build/bin/whisper-cli",
    message: "Local whisper.cpp transcription is ready."
  });
});

test("local voice input status reports unavailable when whisper is not installed", async () => {
  const status = await readLocalVoiceInputStatus({
    runCommand: async () => {
      const error = new Error("missing");
      Object.assign(error, { code: "ENOENT" });
      throw error;
    },
    readEnv: async () => ({}),
    readHomeDirectory: async () => "/Users/test",
    readRegistry: async () => ({
      schemaVersion: 1,
      projects: [],
      selectedProviderId: "codex",
      voiceInput: {
        whisperCommandPath: null
      },
      ui: {
        lastProjectPath: null,
        theme: "system"
      }
    }),
    fileExists: async () => false
  });

  assert.deepEqual(status, {
    available: false,
    backend: null,
    command: null,
    configuredCommandPath: null,
    defaultCommandPath: "~/whisper.cpp/build/bin/whisper-cli",
    message: "Local Whisper is not configured yet. Set the whisper.cpp CLI path to enable voice input."
  });
});

test("configuring a whisper.cpp command path persists it and resolves the colocated model", async () => {
  let registry: AppRegistry = {
    schemaVersion: 1 as const,
    projects: [],
    selectedProviderId: "codex" as const,
    voiceInput: {
      whisperCommandPath: null
    },
    ui: {
      lastProjectPath: null,
      theme: "system" as const
    }
  };

  const status = await configureLocalVoiceInput(
    { commandPath: "~/whisper.cpp/build/bin/whisper-cli" },
    {
      readRegistry: async () => registry,
      writeRegistry: async (next) => {
        registry = next;
      },
      runCommand: async () => ({ stdout: "help", stderr: "" }),
      readEnv: async () => ({}),
      readHomeDirectory: async () => "/Users/test",
      fileExists: async (target) =>
        target === "/Users/test/whisper.cpp/build/bin/whisper-cli" || target === "/Users/test/whisper.cpp/models/ggml-base.en.bin"
    }
  );

  assert.equal(registry.voiceInput.whisperCommandPath, "~/whisper.cpp/build/bin/whisper-cli");
  assert.deepEqual(status, {
    available: true,
    backend: "whisper.cpp",
    command: "/Users/test/whisper.cpp/build/bin/whisper-cli",
    configuredCommandPath: "~/whisper.cpp/build/bin/whisper-cli",
    defaultCommandPath: "~/whisper.cpp/build/bin/whisper-cli",
    message: "Local whisper.cpp transcription is ready."
  });
});

test("local voice transcription writes wav audio, invokes whisper.cpp, and returns the transcript", async () => {
  const writes = new Map<string, Uint8Array>();
  const removed: string[] = [];
  const result = await transcribeLocalVoiceInput(
    {
      audioBase64: Buffer.from("wav-audio").toString("base64")
    },
    {
      runCommand: async (_command, args) => {
        const outputIndex = args.indexOf("-of");
        const outputBase = outputIndex >= 0 ? String(args[outputIndex + 1]) : "/tmp/transcript";
        writes.set(`${outputBase}.txt`, new TextEncoder().encode("Transcribed ticket idea."));
        return { stdout: "", stderr: "" };
      },
      readEnv: async () => ({ RELAY_WHISPER_MODEL_PATH: "/models/ggml-base.en.bin" }),
      readHomeDirectory: async () => "/Users/test",
      readRegistry: async () => ({
        schemaVersion: 1,
        projects: [],
        selectedProviderId: "codex",
        voiceInput: {
          whisperCommandPath: null
        },
        ui: {
          lastProjectPath: null,
          theme: "system"
        }
      }),
      fileExists: async (target) => target === "/models/ggml-base.en.bin" || writes.has(target),
      createTempDir: async () => "/tmp/relay-whisper-test",
      writeBinaryFile: async (target, bytes) => {
        writes.set(target, bytes);
      },
      readTextFile: async (target) => new TextDecoder().decode(writes.get(target)),
      removeDirectory: async (target) => {
        removed.push(target);
      }
    }
  );

  assert.equal(new TextDecoder().decode(writes.get("/tmp/relay-whisper-test/ticket-idea.wav")), "wav-audio");
  assert.deepEqual(result, { transcript: "Transcribed ticket idea." });
  assert.deepEqual(removed, ["/tmp/relay-whisper-test"]);
});

test("backend Effect runtime provides shared services", async () => {
  const timestamp = await runBackendEffect(
    Effect.gen(function*() {
      const clock = yield* BackendClock;
      return clock.nowIso();
    })
  );

  assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("backend config uses documented defaults when no overrides are provided", async () => {
  const config = await Effect.runPromise(loadBackendConfig(ConfigProvider.fromUnknown({})));

  assert.deepEqual(config, BackendConfigDefaults);
});

test("backend config reads explicit RELAY millisecond overrides", async () => {
  const config = await Effect.runPromise(
    loadBackendConfig(
      ConfigProvider.fromUnknown({
        RELAY_GIT_METADATA_CACHE_TTL_MS: 1_111,
        RELAY_GIT_COMMAND_TIMEOUT_MS: 2_222,
        RELAY_CODEX_STATUS_TIMEOUT_MS: 3_333
      })
    )
  );

  assert.deepEqual(config, {
    gitMetadataCacheTtlMs: 1_111,
    gitCommandTimeoutMs: 2_222,
    codexStatusTimeoutMs: 3_333,
    storageAdapter: "filesystem"
  });
});

test("storage service uses the configured filesystem adapter", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Exercise storage service",
    priority: "medium",
    labels: ["storage"],
    markdown: "# Exercise storage service\n\nRead through the configured storage adapter.",
    status: "todo"
  });

  const board = await runBackendEffect(
    Effect.provide(
      Effect.gen(function*() {
        const storage = yield* Storage;
        assert.equal(storage.adapter, "filesystem");
        return yield* storage.getBoard(projectPath);
      }),
      StorageLive.pipe(Layer.provide(Layer.succeed(BackendConfig)({ ...BackendConfigDefaults, storageAdapter: "filesystem" })))
    )
  );

  assert.equal(board.tickets.length, 1);
  assert.equal(board.tickets[0]?.id, ticket.frontMatter.id);
});

test("Codex CLI status command runs through ChildProcessSpawner", async () => {
  const captured: Array<{ command: string; args: readonly string[] }> = [];
  const output = new TextEncoder().encode("codex-cli 0.130.0\n");
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      Layer.succeed(BackendConfig)({
        ...BackendConfigDefaults,
        codexStatusTimeoutMs: 12_345
      }),
      Layer.succeed(
        ChildProcessSpawner.ChildProcessSpawner,
        ChildProcessSpawner.make(Effect.fnUntraced(function*(command) {
          if (command._tag !== "StandardCommand") throw new Error("Only standard commands are expected in this test.");
          captured.push({ command: command.command, args: command.args });
          return ChildProcessSpawner.makeHandle({
            pid: ChildProcessSpawner.ProcessId(12_345),
            stdin: Sink.drain,
            stdout: Stream.fromIterable([output]),
            stderr: Stream.empty,
            all: Stream.fromIterable([output]),
            exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
            isRunning: Effect.succeed(false),
            kill: () => Effect.void,
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
            unref: Effect.succeed(Effect.void)
          });
        }))
      )
    )
  );

  try {
    const version = (await runtime.runPromise(runCodexVersionEffect({ source: "path", command: "codex-test" }))).trim();
    assert.equal(version, "codex-cli 0.130.0");
  } finally {
    await runtime.dispose();
  }

  assert.deepEqual(captured, [{ command: "codex-test", args: ["--version"] }]);
});

test("codex status uses the bundled CLI candidate without requiring PATH codex", async () => {
  const attempted: string[] = [];
  const status = await getCodexStatus({
    resolveCodexCli: () =>
      resolveAvailableCodexCli({
        resolveCandidates: () => [
          { source: "bundled", command: "/sdk/codex" },
          { source: "path", command: "codex" }
        ],
        runVersion: async (candidate) => {
          attempted.push(candidate.command);
          if (candidate.source === "path") throw new Error("PATH codex should not be required.");
          return "codex-cli 0.130.0\n";
        }
      })
  });

  assert.equal(status.cliAvailable, true);
  assert.equal(status.cliVersion, "codex-cli 0.130.0");
  assert.deepEqual(attempted, ["/sdk/codex"]);
});

test("codex status falls back to PATH when the bundled candidate fails", async () => {
  const attempted: string[] = [];
  const status = await getCodexStatus({
    resolveCodexCli: () =>
      resolveAvailableCodexCli({
        resolveCandidates: () => [
          { source: "bundled", command: "/sdk/codex" },
          { source: "path", command: "codex" }
        ],
        runVersion: async (candidate) => {
          attempted.push(candidate.command);
          if (candidate.source === "bundled") throw new Error("Bundled Codex failed.");
          return "codex-cli 0.130.0\n";
        }
      })
  });

  assert.equal(status.cliAvailable, true);
  assert.equal(status.cliVersion, "codex-cli 0.130.0");
  assert.deepEqual(attempted, ["/sdk/codex", "codex"]);
});

test("codex status reports unavailable when no CLI candidate works", async () => {
  const attempted: string[] = [];
  const status = await getCodexStatus({
    resolveCodexCli: () =>
      resolveAvailableCodexCli({
        resolveCandidates: () => [
          { source: "bundled", command: "/sdk/codex" },
          { source: "path", command: "codex" }
        ],
        runVersion: async (candidate) => {
          attempted.push(candidate.command);
          throw new Error(`${candidate.command} unavailable`);
        }
      })
  });

  assert.equal(status.cliAvailable, false);
  assert.equal(status.cliVersion, null);
  assert.match(status.message, /SDK bundle or on PATH/);
  assert.deepEqual(attempted, ["/sdk/codex", "codex"]);
});

test("codex status reports unauthenticated when the CLI is installed without auth file or API key", async () => {
  const status = await getCodexStatus({
    resolveCodexCli: async () => ({ candidate: { source: "path", command: "codex" }, version: "codex-cli 0.130.0" }),
    hasApiKey: async () => false,
    hasAuthFile: async () => false
  });

  assert.equal(status.cliAvailable, true);
  assert.equal(status.cliVersion, "codex-cli 0.130.0");
  assert.equal(status.authenticated, false);
  assert.equal(status.message, "Codex CLI is available, but no Codex auth file or API key was found.");
});

test("codex status reports authenticated when an API key is available", async () => {
  const status = await getCodexStatus({
    resolveCodexCli: async () => ({ candidate: { source: "path", command: "codex" }, version: "codex-cli 0.130.0" }),
    hasApiKey: async () => true,
    hasAuthFile: async () => false
  });

  assert.equal(status.cliAvailable, true);
  assert.equal(status.cliVersion, "codex-cli 0.130.0");
  assert.equal(status.authenticated, true);
  assert.equal(status.message, "Codex is available.");
});

test("codex status resolves auth checks in parallel with cli discovery", async () => {
  const order: string[] = [];
  const status = await getCodexStatus({
    resolveCodexCli: async () => {
      order.push("cli");
      return { candidate: { source: "path", command: "codex" }, version: "codex-cli 0.130.0" };
    },
    hasApiKey: async () => {
      order.push("api-key");
      return false;
    },
    hasAuthFile: async () => {
      order.push("auth-file");
      return true;
    }
  });

  assert.equal(status.authenticated, true);
  assert.ok(order.includes("cli"));
  assert.ok(order.includes("api-key"));
  assert.ok(order.includes("auth-file"));
});

test("codex status returns a terminal unavailable payload when cli discovery hangs", async () => {
  const status = await getCodexStatus({
    resolveCodexCli: () => new Promise(() => undefined),
    hasApiKey: async () => false,
    hasAuthFile: async () => false
  });

  assert.equal(status.cliAvailable, false);
  assert.equal(status.authenticated, false);
  assert.match(status.message, /timed out/i);
});

test("provider inventory returns three providers, the selected id, and switchability metadata", async () => {
  const inventory = await readAgentProviderInventory({
    readRegistry: async () => ({
      schemaVersion: 1,
      projects: [],
      selectedProviderId: "codex",
      voiceInput: {
        whisperCommandPath: null
      },
      ui: {
        lastProjectPath: null,
        theme: "system"
      }
    }),
    getCodexStatus: async () => readyCodexStatus,
    probeCommand: async (command) => ({
      installed: command === "cursor-agent" || command === "agent",
      version: command === "cursor-agent" || command === "agent" ? "2026.05.20-2b5dd59" : null,
      failed: false
    }),
    probeCursorStatus: async () => ({
      authenticated: true,
      failed: false
    }),
    readEnv: async () => ({}),
    readHomeDirectory: async () => "/tmp/provider-home",
    fileExists: async () => false,
    listIncompleteWork: async () => []
  });

  assert.equal(inventory.providers.length, 3);
  assert.equal(inventory.selectedProviderId, "codex");
  assert.deepEqual(
    inventory.providers.map((provider) => [provider.id, provider.status, provider.canSelect]),
    [
      ["codex", "ready", true],
      ["cursor", "ready", true],
      ["claude", "unavailable", false]
    ]
  );
  assert.deepEqual(inventory.switchability, {
    canSwitch: true,
    reasonCode: null,
    message: null,
    blockingWorkCount: 0
  });
});

test("provider switching persists the new selection when the target is ready", async () => {
  let registry: AppRegistry = {
    schemaVersion: 1 as const,
    projects: [],
    selectedProviderId: "codex" as const,
    voiceInput: {
      whisperCommandPath: null
    },
    ui: {
      lastProjectPath: null,
      theme: "system" as const
    }
  };

  const result = await switchAgentProviderSelection(
    { providerId: "cursor" },
    {
      readRegistry: async () => registry,
      writeRegistry: async (next) => {
        registry = next;
      },
      getCodexStatus: async () => readyCodexStatus,
      probeCommand: async () => ({
        installed: true,
        version: "provider 1.0.0",
        failed: false
      }),
      probeCursorStatus: async () => ({
        authenticated: true,
        failed: false
      }),
      readEnv: async () => ({
        ANTHROPIC_API_KEY: "claude-token"
      }),
      readHomeDirectory: async () => "/tmp/provider-home",
      fileExists: async () => false,
      listIncompleteWork: async () => []
    }
  );

  assert.equal(result.ok, true);
  assert.equal(registry.selectedProviderId, "cursor");
  assert.equal(result.selectedProviderId, "cursor");
});

test("provider switching is blocked deterministically when busy work exists and does not mutate registry state", async () => {
  let registry: AppRegistry = {
    schemaVersion: 1 as const,
    projects: [{ path: "/tmp/project-a", pinned: true, lastOpenedAt: "2026-05-21T10:00:00.000Z", sidebarPosition: 1000 }],
    selectedProviderId: "codex" as const,
    voiceInput: {
      whisperCommandPath: null
    },
    ui: {
      lastProjectPath: "/tmp/project-a",
      theme: "system" as const
    }
  };

  const result = await switchAgentProviderSelection(
    { providerId: "cursor" },
    {
      readRegistry: async () => registry,
      writeRegistry: async (next) => {
        registry = next;
      },
      getCodexStatus: async () => readyCodexStatus,
      probeCommand: async () => ({
        installed: true,
        version: "provider 1.0.0",
        failed: false
      }),
      probeCursorStatus: async () => ({
        authenticated: true,
        failed: false
      }),
      readEnv: async () => ({}),
      readHomeDirectory: async () => "/tmp/provider-home",
      fileExists: async () => false,
      listIncompleteWork: async (projectPath) => [
        {
          schemaVersion: 1,
          workId: "work_busy",
          projectPath,
          ticketId: "tkt_busy",
          runId: "run_busy",
          subject: "ticket",
          action: "implement",
          kind: "ticket.implementation",
          idempotencyKey: "busy:key",
          status: "running",
          attempts: 1,
          createdAt: "2026-05-21T10:00:00.000Z",
          updatedAt: "2026-05-21T10:00:01.000Z",
          lastAppliedEventSequence: 1,
          executor: "agent",
          providerId: "codex",
          currentAttempt: null,
          payload: {}
        }
      ]
    }
  );

  assert.deepEqual(result, {
    ok: false,
    code: "busy",
    message: "Relay cannot switch providers while 1 active work item(s) exist across 1 registered project(s).",
    selectedProviderId: "codex"
  });
  assert.equal(registry.selectedProviderId, "codex");
});

test("createCodex passes the resolved CLI candidate as codexPathOverride", async () => {
  const candidates: CodexCliCandidate[] = [
    { source: "bundled", command: "/sdk/codex" },
    { source: "path", command: "codex" }
  ];
  const capturedOptions: CodexOptions[] = [];
  const client = {} as ReturnType<NonNullable<CreateCodexDependencies["createClient"]>>;

  await createCodex({
    resolveCodexCli: () =>
      resolveAvailableCodexCli({
        resolveCandidates: () => candidates,
        runVersion: async (candidate) => {
          if (candidate.source === "bundled") throw new Error("Bundled Codex failed.");
          return "codex-cli 0.130.0\n";
        }
      }),
    createEnv: () => ({ PATH: "/test/bin" }),
    createClient: (options) => {
      capturedOptions.push(options);
      return client;
    }
  });

  const options = capturedOptions[0];
  assert.ok(options);
  assert.equal(options.codexPathOverride, "codex");
  assert.deepEqual(options.env, { PATH: "/test/bin" });
});

test("automated ticket status transitions reuse ticket storage and append audit events", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Automated transition",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Automated transition\n"
  });

  await transitionTicketStatus(projectPath, ticket.frontMatter.id, "in_progress", {
    actor: "codex",
    source: "agent_execution",
    runId: "run_status"
  });
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.status, "in_progress");

  await transitionTicketStatus(projectPath, ticket.frontMatter.id, "completed", {
    actor: "codex",
    source: "agent_execution",
    runId: "run_status"
  });
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.status, "completed");

  const events = await auditEvents(projectPath);
  assert.deepEqual(
    events.map((event) => [event.eventType, event.actor, event.source]),
    [
      ["ticket.status_changed", "codex", "agent_execution"],
      ["ticket.status_changed", "codex", "agent_execution"]
    ]
  );
});

test("manual ticket moves still work for existing columns", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Manual move",
    priority: "low",
    labels: [],
    markdown: "# Manual move\n"
  });

  const board = await moveTicket({
    projectPath,
    ticketId: ticket.frontMatter.id,
    targetStatus: "not_doing"
  });

  assert.equal(board.tickets.find((item) => item.id === ticket.frontMatter.id)?.status, "not_doing");
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.status, "not_doing");
});

test("epic tickets persist ordered subticket relationships across board reloads", async () => {
  const projectPath = await createProject();
  const epic = await createTicket(projectPath, {
    title: "Epic parent",
    ticketType: "epic",
    priority: "high",
    labels: ["epic"],
    markdown: "# Epic parent\n",
    subtickets: [
      {
        title: "First child",
        priority: "medium",
        labels: ["child"],
        markdown: "# First child\n"
      },
      {
        title: "Second child",
        priority: "low",
        labels: [],
        markdown: "# Second child\n"
      }
    ]
  });

  const reloadedEpic = await readTicket(projectPath, epic.frontMatter.id);
  assert.equal(reloadedEpic.frontMatter.ticketType, "epic");
  assert.equal(reloadedEpic.frontMatter.subticketIds.length, 2);

  const [firstChildId, secondChildId] = reloadedEpic.frontMatter.subticketIds;
  const firstChild = await readTicket(projectPath, firstChildId);
  const secondChild = await readTicket(projectPath, secondChildId);
  assert.equal(firstChild.frontMatter.ticketType, "feature");
  assert.equal(firstChild.frontMatter.parentEpicId, epic.frontMatter.id);
  assert.equal(secondChild.frontMatter.parentEpicId, epic.frontMatter.id);

  const task = await createTaskUnderFeature({
    projectPath,
    featureId: firstChildId,
    input: { title: "Implement first child", priority: "medium" }
  });

  await transitionTicketStatus(projectPath, task.frontMatter.id, "in_progress", {
    actor: "user",
    source: "manual_board"
  });

  await assert.rejects(
    () =>
      transitionTicketStatus(projectPath, firstChildId, "in_progress", {
        actor: "user",
        source: "manual_board"
      }),
    /can only move to Review, Completed, or Archive/
  );

  const board = await readBoard(projectPath);
  assert.equal(board.tickets.find((item) => item.id === epic.frontMatter.id)?.status, "todo");
  assert.equal(board.tickets.find((item) => item.id === firstChildId)?.status, "todo");
  assert.equal(board.tickets.find((item) => item.id === task.frontMatter.id)?.status, "in_progress");
  assert.equal(board.tickets.find((item) => item.id === firstChildId)?.parentEpicId, epic.frontMatter.id);
  assert.deepEqual((await readTicket(projectPath, epic.frontMatter.id)).frontMatter.subticketIds, [firstChildId, secondChildId]);

  const rawEpic = await readFile(reloadedEpic.filePath, "utf8");
  const rawChild = await readFile(firstChild.filePath, "utf8");
  assert.match(rawEpic, /ticketType: epic/);
  assert.match(rawEpic, /subticketIds:/);
  assert.match(rawChild, new RegExp(`parentEpicId: ${epic.frontMatter.id}`));
});

test("epic subtickets can be created, linked, unlinked, and deleted without deleting the parent", async () => {
  const projectPath = await createProject();
  const epic = await createTicket(projectPath, {
    title: "Manual epic",
    ticketType: "epic",
    priority: "medium",
    labels: [],
    markdown: "# Manual epic\n"
  });
  const createdChild = await createSubticket({
    projectPath,
    epicId: epic.frontMatter.id,
    ticket: {
      title: "Created feature",
      priority: "medium",
      labels: [],
      markdown: "# Created feature\n"
    }
  });
  assert.equal(createdChild.frontMatter.ticketType, "feature");
  const looseFeature = await createTicket(projectPath, {
    title: "Loose feature",
    ticketType: "feature",
    priority: "low",
    labels: [],
    markdown: "# Loose feature\n"
  });

  await linkSubticket(projectPath, epic.frontMatter.id, looseFeature.frontMatter.id);
  assert.deepEqual((await readTicket(projectPath, epic.frontMatter.id)).frontMatter.subticketIds, [
    createdChild.frontMatter.id,
    looseFeature.frontMatter.id
  ]);
  assert.equal((await readTicket(projectPath, looseFeature.frontMatter.id)).frontMatter.parentEpicId, epic.frontMatter.id);

  await unlinkSubticket(projectPath, epic.frontMatter.id, looseFeature.frontMatter.id);
  assert.equal((await readTicket(projectPath, looseFeature.frontMatter.id)).frontMatter.parentEpicId, null);
  assert.deepEqual((await readTicket(projectPath, epic.frontMatter.id)).frontMatter.subticketIds, [createdChild.frontMatter.id]);

  await deleteTicket(projectPath, createdChild.frontMatter.id);
  const board = await readBoard(projectPath);
  assert.ok(board.tickets.some((item) => item.id === epic.frontMatter.id));
  assert.ok(!board.tickets.some((item) => item.id === createdChild.frontMatter.id));
  assert.deepEqual((await readTicket(projectPath, epic.frontMatter.id)).frontMatter.subticketIds, []);

  const nestedEpic = await createTicket(projectPath, {
    title: "Nested candidate",
    ticketType: "epic",
    priority: "medium",
    labels: [],
    markdown: "# Nested candidate\n"
  });
  const looseTask = await createTicket(projectPath, {
    title: "Loose task",
    priority: "low",
    labels: [],
    markdown: "# Loose task\n",
    allowOrphanTask: true
  });
  await assert.rejects(
    linkSubticket(projectPath, epic.frontMatter.id, looseTask.frontMatter.id),
    /Epics can only link feature tickets/
  );
  await assert.rejects(linkSubticket(projectPath, epic.frontMatter.id, nestedEpic.frontMatter.id), /Nested epics are not supported/);
  await assert.rejects(linkSubticket(projectPath, epic.frontMatter.id, epic.frontMatter.id), /itself/);
});

test("deleting a feature cascades to tasks linked only by parentFeatureId", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Loose subticket list feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Feature\n",
    subticketIds: []
  });
  const task = await createTicket(projectPath, {
    title: "Linked only by parentFeatureId",
    ticketType: "task",
    priority: "medium",
    labels: [],
    markdown: "# Task\n",
    parentFeatureId: feature.frontMatter.id,
    allowOrphanTask: false
  });

  await deleteTicket(projectPath, feature.frontMatter.id);

  await assert.rejects(readTicket(projectPath, task.frontMatter.id), isTicketNotFoundError);
});

test("deleting a feature cascades to its tasks", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Settings feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Settings feature\n"
  });
  const task = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "Dark mode toggle", priority: "medium" }
  });

  await deleteTicket(projectPath, feature.frontMatter.id);

  const board = await readBoard(projectPath);
  assert.ok(!board.tickets.some((item) => item.id === feature.frontMatter.id));
  assert.ok(!board.tickets.some((item) => item.id === task.frontMatter.id));
  await assert.rejects(readTicket(projectPath, task.frontMatter.id), isTicketNotFoundError);
});

test("deleting an epic cascades to linked features and their tasks", async () => {
  const projectPath = await createProject();
  const epic = await createTicket(projectPath, {
    title: "Accounts epic",
    ticketType: "epic",
    priority: "medium",
    labels: [],
    markdown: "# Accounts epic\n"
  });
  const feature = await createSubticket({
    projectPath,
    epicId: epic.frontMatter.id,
    ticket: {
      title: "OAuth feature",
      priority: "medium",
      labels: [],
      markdown: "# OAuth feature\n"
    }
  });
  const task = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "Google sign-in", priority: "high" }
  });

  await deleteTicket(projectPath, epic.frontMatter.id);

  const board = await readBoard(projectPath);
  assert.equal(board.tickets.length, 0);
  await assert.rejects(readTicket(projectPath, epic.frontMatter.id), isTicketNotFoundError);
  await assert.rejects(readTicket(projectPath, feature.frontMatter.id), isTicketNotFoundError);
  await assert.rejects(readTicket(projectPath, task.frontMatter.id), isTicketNotFoundError);
});

test("feature tasks require a parent feature and can be added without codex", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Auth feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Auth feature\n"
  });
  const task = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "Add login form", description: "Minimal email/password form", priority: "high" }
  });
  assert.equal(task.frontMatter.ticketType, "task");
  assert.equal(task.frontMatter.parentFeatureId, feature.frontMatter.id);
  assert.match(task.markdown, /Parent feature: Auth feature/);
  assert.deepEqual((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.subticketIds, [task.frontMatter.id]);
  await assert.rejects(
    createTicket(projectPath, {
      title: "Orphan",
      priority: "low",
      labels: [],
      markdown: "# Orphan\n",
      allowOrphanTask: false
    }),
    /must belong to a feature/
  );
});

const emptyHierarchyResearch = () => ({
  generatedAt: "",
  checkedUrls: [],
  inspectedFiles: [],
  limitations: [],
  limits: {
    maxResearchMs: 0,
    maxUrls: 0,
    maxUrlFetchMs: 0,
    maxUrlContentChars: 0,
    maxFilesToScan: 0,
    maxFilesToRead: 0,
    maxFileReadChars: 0,
    maxMatchesPerFile: 0
  }
});

const sampleLeanTask = (
  title: string,
  overrides: Partial<{
    blockedByTitles: string[];
  }> = {}
) => ({
  title,
  summary: `Summary for ${title}.`,
  priority: "medium" as const,
  labels: ["draft"],
  context: "Context.",
  goal: "Goal.",
  requirements: ["Requirement."],
  acceptanceCriteria: ["Done."],
  implementationPlan: ["Step."],
  assumptions: [],
  plannedFiles: [`src/${title.toLowerCase().replace(/\s+/g, "-")}.ts`],
  blockedByTitles: overrides.blockedByTitles ?? []
});

const sampleRoot = (title: string) => ({
  title,
  summary: `Summary for ${title}.`,
  priority: "medium" as const,
  labels: ["draft"],
  context: "Context.",
  researchFindings: [],
  requirements: ["Requirement."],
  implementationPlan: ["Step."],
  testPlan: ["npm test"],
  acceptanceCriteria: ["Done."],
  clarificationQuestions: [],
  assumptions: [],
  implementationNotes: []
});

test("createPendingTicketDraft creates draft_ticket with draftTargetType from preferredTicketType", async () => {
  const projectPath = await createProject();
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Build billing dashboard", preferredTicketType: "feature" },
    "run_pending_feature"
  );
  assert.equal(placeholder.frontMatter.ticketType, "draft_ticket");
  assert.equal(placeholder.frontMatter.draftTargetType, "feature");
  assert.equal(placeholder.frontMatter.status, "todo");
  assert.equal(placeholder.frontMatter.runStatus, "drafting");
});

test("createPendingTicketDraft always sets draftTargetType even for autoHierarchy drafts", async () => {
  const projectPath = await createProject();
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Change primary button color", autoHierarchy: true },
    "run_pending_auto"
  );
  assert.equal(placeholder.frontMatter.ticketType, "draft_ticket");
  assert.equal(placeholder.frontMatter.draftTargetType, "feature");
});

test("applyHierarchyDraftPlan normalizes legacy standalone_task plans into feature trees", async () => {
  const projectPath = await createProject();
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Change primary button color", autoHierarchy: true },
    "run_hierarchy_standalone"
  );
  const rootId = await applyHierarchyDraftPlan(
    projectPath,
    placeholder.frontMatter.id,
    {
      planKind: "standalone_task",
      draftState: "ready",
      blockingClarificationQuestions: [],
      matchedEpicId: null,
      matchedFeatureId: null,
      features: [],
      leanTasks: [],
      standaloneTask: sampleLeanTask("Blue primary button"),
      research: emptyHierarchyResearch()
    } as unknown as HierarchyDraftPlan,
    "run_hierarchy_standalone"
  );
  const feature = await readTicket(projectPath, rootId);
  assert.equal(feature.frontMatter.ticketType, "feature");
  assert.equal(feature.frontMatter.title, "Blue primary button");
  const board = await readBoard(projectPath);
  const tasks = board.tickets.filter((ticket) => ticket.parentFeatureId === feature.frontMatter.id);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Blue primary button");
  assert.deepEqual(tasks[0].plannedFiles, ["src/blue-primary-button.ts"]);
  assert.doesNotMatch((await readTicket(projectPath, tasks[0].id)).markdown, /## Planned File Scope/);
});

test("applyHierarchyDraftPlan extend_epic links feature and creates lean tasks", async () => {
  const projectPath = await createProject();
  const epic = await createTicket(projectPath, {
    title: "Accounts epic",
    ticketType: "epic",
    priority: "medium",
    labels: [],
    markdown: "# Accounts epic\n"
  });
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Add OAuth provider", autoHierarchy: true },
    "run_hierarchy_extend_epic"
  );
  const featureId = await applyHierarchyDraftPlan(
    projectPath,
    placeholder.frontMatter.id,
    {
      planKind: "extend_epic",
      draftState: "ready",
      blockingClarificationQuestions: [],
      matchedEpicId: epic.frontMatter.id,
      matchedFeatureId: null,
      root: sampleRoot("OAuth provider"),
      features: [],
      leanTasks: [sampleLeanTask("Wire Google OAuth")],
      research: emptyHierarchyResearch()
    },
    "run_hierarchy_extend_epic"
  );
  const feature = await readTicket(projectPath, featureId);
  assert.equal(feature.frontMatter.ticketType, "feature");
  assert.equal(feature.frontMatter.parentEpicId, epic.frontMatter.id);
  assert.deepEqual((await readTicket(projectPath, epic.frontMatter.id)).frontMatter.subticketIds, [featureId]);
  const board = await readBoard(projectPath);
  const tasks = board.tickets.filter((ticket) => ticket.parentFeatureId === featureId);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Wire Google OAuth");
  assert.deepEqual(tasks[0].plannedFiles, ["src/wire-google-oauth.ts"]);
});

test("applyHierarchyDraftPlan feature_tree materializes lean-task blockedByTitles as blockedByIds", async () => {
  const projectPath = await createProject();
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Build auth flow", autoHierarchy: true },
    "run_hierarchy_feature_tree_deps"
  );
  const featureId = await applyHierarchyDraftPlan(
    projectPath,
    placeholder.frontMatter.id,
    {
      planKind: "feature_tree",
      draftState: "ready",
      blockingClarificationQuestions: [],
      matchedEpicId: null,
      matchedFeatureId: null,
      root: sampleRoot("Auth feature"),
      features: [],
      leanTasks: [
        sampleLeanTask("Task A"),
        sampleLeanTask("Task B", { blockedByTitles: ["Task A"] })
      ],
      research: emptyHierarchyResearch()
    },
    "run_hierarchy_feature_tree_deps"
  );
  const board = await readBoard(projectPath);
  const tasks = board.tickets.filter((ticket) => ticket.parentFeatureId === featureId);
  assert.equal(tasks.length, 2);
  const taskA = tasks.find((ticket) => ticket.title === "Task A");
  const taskB = tasks.find((ticket) => ticket.title === "Task B");
  assert.ok(taskA);
  assert.ok(taskB);
  assert.deepEqual((await readTicket(projectPath, taskA.id)).frontMatter.blockedByIds, []);
  assert.deepEqual((await readTicket(projectPath, taskB.id)).frontMatter.blockedByIds, [taskA.id]);
});

test("applyHierarchyDraftPlan feature_tree omits cyclic lean-task blocker links", async () => {
  const projectPath = await createProject();
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Conflicting auth tasks", autoHierarchy: true },
    "run_hierarchy_feature_tree_cycle"
  );
  const featureId = await applyHierarchyDraftPlan(
    projectPath,
    placeholder.frontMatter.id,
    {
      planKind: "feature_tree",
      draftState: "ready",
      blockingClarificationQuestions: [],
      matchedEpicId: null,
      matchedFeatureId: null,
      root: sampleRoot("Auth feature"),
      features: [],
      leanTasks: [
        sampleLeanTask("Task A", { blockedByTitles: ["Task B"] }),
        sampleLeanTask("Task B", { blockedByTitles: ["Task A"] })
      ],
      research: emptyHierarchyResearch()
    },
    "run_hierarchy_feature_tree_cycle"
  );
  const board = await readBoard(projectPath);
  const tasks = board.tickets.filter((ticket) => ticket.parentFeatureId === featureId);
  assert.equal(tasks.length, 2);
  for (const task of tasks) {
    assert.deepEqual((await readTicket(projectPath, task.id)).frontMatter.blockedByIds, []);
  }
});

test("applyHierarchyDraftPlan feature_tree ignores unknown lean-task blocker titles", async () => {
  const projectPath = await createProject();
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Auth with missing blocker", autoHierarchy: true },
    "run_hierarchy_feature_tree_missing"
  );
  const featureId = await applyHierarchyDraftPlan(
    projectPath,
    placeholder.frontMatter.id,
    {
      planKind: "feature_tree",
      draftState: "ready",
      blockingClarificationQuestions: [],
      matchedEpicId: null,
      matchedFeatureId: null,
      root: sampleRoot("Auth feature"),
      features: [],
      leanTasks: [sampleLeanTask("Task B", { blockedByTitles: ["Missing task"] })],
      research: emptyHierarchyResearch()
    },
    "run_hierarchy_feature_tree_missing"
  );
  const board = await readBoard(projectPath);
  const tasks = board.tickets.filter((ticket) => ticket.parentFeatureId === featureId);
  assert.equal(tasks.length, 1);
  assert.deepEqual((await readTicket(projectPath, tasks[0].id)).frontMatter.blockedByIds, []);
});

test("applyHierarchyDraftPlan extend_feature deletes placeholder and appends tasks only", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Settings feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Settings feature\n"
  });
  const placeholder = await createPendingTicketDraft(
    projectPath,
    { projectPath, idea: "Add dark mode toggle", autoHierarchy: true },
    "run_hierarchy_extend_feature"
  );
  const returnedId = await applyHierarchyDraftPlan(
    projectPath,
    placeholder.frontMatter.id,
    {
      planKind: "extend_feature",
      draftState: "ready",
      blockingClarificationQuestions: [],
      matchedEpicId: null,
      matchedFeatureId: feature.frontMatter.id,
      features: [],
      leanTasks: [],
      extendFeature: { leanTasks: [sampleLeanTask("Theme toggle UI")] },
      research: emptyHierarchyResearch()
    },
    "run_hierarchy_extend_feature"
  );
  assert.equal(returnedId, feature.frontMatter.id);
  await assert.rejects(readTicket(projectPath, placeholder.frontMatter.id), isTicketNotFoundError);
  const tasks = (await readBoard(projectPath)).tickets.filter((ticket) => ticket.parentFeatureId === feature.frontMatter.id);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Theme toggle UI");
  assert.deepEqual(tasks[0].plannedFiles, ["src/theme-toggle-ui.ts"]);
});

test("feature task links can be created but not unlinked into standalone tasks", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Billing feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Billing feature\n"
  });
  const created = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "Stripe webhook", priority: "medium" }
  });
  const loose = await createTicket(projectPath, {
    title: "Loose task",
    priority: "low",
    labels: [],
    markdown: "# Loose task\n",
    allowOrphanTask: true
  });
  await linkFeatureSubticket({ projectPath, featureId: feature.frontMatter.id, ticketId: loose.frontMatter.id });
  assert.equal((await readTicket(projectPath, loose.frontMatter.id)).frontMatter.parentFeatureId, feature.frontMatter.id);
  await assert.rejects(
    unlinkFeatureSubticket({ projectPath, featureId: feature.frontMatter.id, ticketId: loose.frontMatter.id }),
    /must stay linked to a feature/
  );
  assert.equal((await readTicket(projectPath, loose.frontMatter.id)).frontMatter.parentFeatureId, feature.frontMatter.id);
  assert.deepEqual((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.subticketIds, [
    created.frontMatter.id,
    loose.frontMatter.id
  ]);
});

test("codex preflight blocks feature planning tickets", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Planning feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Planning feature\n"
  });
  const preflight = await preflightCodexRun({ projectPath, ticketId: feature.frontMatter.id });
  assert.equal(preflight.ok, false);
  assert.ok(preflight.errors.some((error) => /Features are planning containers/.test(error)));
});

test("legacy tickets without epic metadata load as task tickets", async () => {
  const projectPath = await createProject();
  const now = new Date().toISOString();
  await writeFile(
    path.join(projectPath, ".relay", "tickets", "tkt_legacy.md"),
    `---
schemaVersion: 1
id: tkt_legacy
title: Legacy task
status: todo
position: 1000
priority: medium
labels: []
createdAt: ${now}
updatedAt: ${now}
codexThreadId:
runStatus: idle
lastRunId:
---
# Legacy task
`,
    "utf8"
  );

  const board = await readBoard(projectPath);
  const legacy = board.tickets.find((ticket) => ticket.id === "tkt_legacy");

  assert.ok(legacy);
  assert.equal(legacy.ticketType, "task");
  assert.equal(legacy.parentEpicId, null);
  assert.deepEqual(legacy.subticketIds, []);
  assert.deepEqual(legacy.blockedByIds, []);
});

test("ticket blocker metadata persists and rejects direct self blockers", async () => {
  const projectPath = await createProject();
  const blocker = await createTicket(projectPath, {
    title: "Blocker ticket",
    priority: "medium",
    labels: [],
    markdown: "# Blocker ticket\n"
  });
  const blocked = await createImplementationTicket(projectPath, {
    title: "Blocked ticket",
    priority: "medium",
    labels: [],
    markdown: "# Blocked ticket\n",
    blockedByIds: [blocker.frontMatter.id]
  });

  const reloaded = await readTicket(projectPath, blocked.frontMatter.id);
  assert.deepEqual(reloaded.frontMatter.blockedByIds, [blocker.frontMatter.id]);
  assert.equal((await readBoard(projectPath)).tickets.find((ticket) => ticket.id === blocked.frontMatter.id)?.blockedByIds[0], blocker.frontMatter.id);

  await assert.rejects(
    writeTicket(projectPath, {
      ...reloaded,
      frontMatter: {
        ...reloaded.frontMatter,
        blockedByIds: [reloaded.frontMatter.id]
      }
    }),
    /cannot block itself/
  );
});

test("codex preflight blocks active blockers and allows terminal blockers", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    columns: [
      ...config.columns,
      {
        id: "blocked_done",
        name: "Blocked Done",
        position: 7000,
        terminal: true
      }
    ]
  });
  const blocker = await createTicket(projectPath, {
    title: "Finish first",
    priority: "high",
    labels: [],
    markdown: "# Finish first\n"
  });
  const blocked = await createImplementationTicket(projectPath, {
    title: "Wait for blocker",
    priority: "medium",
    labels: [],
    markdown: "# Wait for blocker\n",
    blockedByIds: [blocker.frontMatter.id]
  });

  const blockedPreflight = await preflightCodexRun({ projectPath, ticketId: blocked.frontMatter.id });
  assert.equal(blockedPreflight.ok, false);
  assert.match(blockedPreflight.errors.join(" "), /Blocked by active blocker/);
  assert.match(blockedPreflight.errors.join(" "), /Finish first/);
  assert.match(blockedPreflight.errors.join(" "), /Todo/);

  await moveTicket({ projectPath, ticketId: blocker.frontMatter.id, targetStatus: "blocked_done" });
  const unblockedPreflight = await preflightCodexRun({ projectPath, ticketId: blocked.frontMatter.id });
  assert.equal(unblockedPreflight.ok, true);
});

test("missing blocker references warn without crashing board or preflight", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Stale blocker",
    priority: "medium",
    labels: [],
    markdown: "# Stale blocker\n",
    blockedByIds: ["tkt_missing_blocker"]
  });

  const board = await readBoard(projectPath);
  assert.equal(board.tickets.find((item) => item.id === ticket.frontMatter.id)?.blockedByIds[0], "tkt_missing_blocker");

  const preflight = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id });
  assert.equal(preflight.ok, true);
  assert.match(preflight.warnings.join(" "), /Missing blocker reference/);
});

test("project summaries include ordered swimlane counts and active runs including empty lanes", async () => {
  const projectPath = await createProject();
  const firstTicket = await createImplementationTicket(projectPath, {
    title: "Todo ticket",
    priority: "medium",
    labels: [],
    markdown: "# Todo ticket\n"
  });
  await createTicket(projectPath, {
    title: "Second todo ticket",
    priority: "low",
    labels: [],
    markdown: "# Second todo ticket\n"
  });

  await moveTicket({
    projectPath,
    ticketId: firstTicket.frontMatter.id,
    targetStatus: "in_progress"
  });
  const runningTicket = await readTicket(projectPath, firstTicket.frontMatter.id);
  await writeTicket(projectPath, {
    ...runningTicket,
    frontMatter: {
      ...runningTicket.frontMatter,
      runStatus: "running"
    }
  });

  const summary = await summarizeProject(projectPath);

  assert.deepEqual(
    summary.swimlanes.map((swimlane) => [swimlane.id, swimlane.ticketCount, swimlane.activeRunCount]),
    [
      ["todo", 1, 0],
      ["ready", 0, 0],
      ["in_progress", 1, 1],
      ["needs_clarification", 0, 0],
      ["review", 0, 0],
      ["not_doing", 0, 0],
      ["completed", 0, 0]
    ]
  );
});

test("project summaries only count running agent work as active sidebar runs", async () => {
  const projectPath = await createProject();
  const ticket = await createImplementationTicket(projectPath, {
    title: "Queued ticket",
    priority: "medium",
    labels: [],
    markdown: "# Queued ticket\n"
  });

  await moveTicket({ projectPath, ticketId: ticket.frontMatter.id, targetStatus: "ready" });
  const queuedTicket = await readTicket(projectPath, ticket.frontMatter.id);
  await writeTicket(projectPath, {
    ...queuedTicket,
    frontMatter: {
      ...queuedTicket.frontMatter,
      runStatus: "queued",
      lastRunId: "run_queued_sidebar"
    }
  });

  let summary = await summarizeProject(projectPath);
  assert.equal(summary.activeRunCount, 0);
  assert.deepEqual(
    summary.swimlanes.map((swimlane) => [swimlane.id, swimlane.activeRunCount]),
    [
      ["todo", 0],
      ["ready", 0],
      ["in_progress", 0],
      ["needs_clarification", 0],
      ["review", 0],
      ["not_doing", 0],
      ["completed", 0]
    ]
  );

  const failedTicket = await createImplementationTicket(projectPath, {
    title: "Failed ticket",
    priority: "medium",
    labels: [],
    markdown: "# Failed ticket\n"
  });
  await moveTicket({ projectPath, ticketId: failedTicket.frontMatter.id, targetStatus: "in_progress" });
  const failedRecord = await readTicket(projectPath, failedTicket.frontMatter.id);
  await writeTicket(projectPath, {
    ...failedRecord,
    frontMatter: {
      ...failedRecord.frontMatter,
      runStatus: "failed"
    }
  });

  summary = await summarizeProject(projectPath);
  assert.equal(summary.activeRunCount, 0);
  assert.equal(summary.swimlanes.find((swimlane) => swimlane.id === "in_progress")?.activeRunCount, 0);
});

test("new projects include Ready between Todo and In Progress", async () => {
  const projectPath = await createProject();
  const config = await readProjectConfig(projectPath);

  assert.deepEqual(
    config.columns.map((column) => column.id),
    ["todo", "ready", "in_progress", "needs_clarification", "review", "not_doing", "completed", "archive"]
  );
  assert.equal(config.settings.defaultModelReasoningEffort, null);
  assert.equal(config.settings.defaultTicketEffort, "medium");
  assert.equal(config.settings.codexNetworkAccessEnabled, false);
  assert.equal(config.settings.codexWebSearchMode, "disabled");
  assert.deepEqual(config.settings.codexAdditionalDirectories, []);
  assert.equal(config.settings.agentConcurrency, 3);
});

test("ticket effort defaults from project settings and can be overridden per ticket", async () => {
  const projectPath = await createProject();
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    settings: {
      ...config.settings,
      defaultTicketEffort: "high"
    }
  });

  const defaulted = await createTicket(projectPath, {
    title: "Default effort ticket",
    priority: "medium",
    labels: [],
    markdown: "# Default effort ticket\n"
  });
  const overridden = await createTicket(projectPath, {
    title: "Override effort ticket",
    priority: "medium",
    effort: "xhigh",
    labels: [],
    markdown: "# Override effort ticket\n"
  });

  assert.equal(defaulted.frontMatter.effort, "high");
  assert.equal(overridden.frontMatter.effort, "xhigh");
});

test("ticket image attachments save under project attachments with unique sanitized Markdown paths", async () => {
  const projectPath = await createProject();
  const first = await saveTicketAttachment({
    projectPath,
    fileName: "../../Screenshot 1.PNG",
    mimeType: "image/png",
    contentBase64: Buffer.from("first image").toString("base64")
  });
  const second = await saveTicketAttachment({
    projectPath,
    fileName: "../../Screenshot 1.PNG",
    mimeType: "image/png",
    contentBase64: Buffer.from("second image").toString("base64")
  });

  assert.notEqual(first.markdownPath, second.markdownPath);
  assert.match(first.markdownPath, /^\.relay\/attachments\/Screenshot-1-att_[a-z0-9]+\.png$/);
  assert.equal(path.isAbsolute(first.markdownPath), false);
  assert.equal(first.markdownPath.includes(".."), false);
  assert.equal(first.absolutePath, path.join(projectPath, first.markdownPath));
  assert.equal(await readFile(first.absolutePath, "utf8"), "first image");
  assert.equal(await readFile(second.absolutePath, "utf8"), "second image");
});

test("ticket image attachments reject unsupported dropped files", async () => {
  const projectPath = await createProject();

  await assert.rejects(
    saveTicketAttachment({
      projectPath,
      fileName: "notes.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from("not an image").toString("base64")
    }),
    /Only image attachments/
  );
});

test("legacy project configs are normalized with ready and review lanes without rewriting the file", async () => {
  const projectPath = await createProject();
  const config = await readProjectConfig(projectPath);
  const legacyConfig = {
    ...config,
    columns: config.columns.filter((column) => column.id !== "ready" && column.id !== "review")
  };
  await writeFile(path.join(projectPath, ".relay", "project.json"), JSON.stringify(legacyConfig, null, 2));

  const normalized = await readProjectConfig(projectPath);
  assert.deepEqual(
    normalized.columns.map((column) => column.id),
    ["todo", "ready", "in_progress", "needs_clarification", "review", "not_doing", "completed", "archive"]
  );
  assert.equal(normalized.settings.defaultModelReasoningEffort, null);
  assert.equal(normalized.settings.defaultTicketEffort, "medium");
  assert.equal(normalized.settings.codexNetworkAccessEnabled, false);
  assert.equal(normalized.settings.codexWebSearchMode, "disabled");
  assert.deepEqual(normalized.settings.codexAdditionalDirectories, []);
  assert.equal(normalized.settings.agentConcurrency, 3);

  const raw = await readFile(path.join(projectPath, ".relay", "project.json"), "utf8");
  assert.doesNotMatch(raw, /"id": "ready"/);
  assert.doesNotMatch(raw, /"id": "review"/);
});

test("ticket reads stay scoped to the requested project after switching projects", async () => {
  const firstProject = await createProject();
  const secondProject = await createProject();
  const firstTicket = await createImplementationTicket(firstProject, {
    title: "First project ticket",
    priority: "medium",
    labels: [],
    markdown: "# First project ticket\n"
  });
  const secondTicket = await createImplementationTicket(secondProject, {
    title: "Second project ticket",
    priority: "medium",
    labels: [],
    markdown: "# Second project ticket\n"
  });

  assert.equal((await readTicket(firstProject, firstTicket.frontMatter.id)).filePath, path.join(firstProject, ".relay", "tickets", `${firstTicket.frontMatter.id}.md`));

  await assert.rejects(
    readTicket(secondProject, firstTicket.frontMatter.id),
    (error) => {
      assert.equal(isTicketNotFoundError(error), true);
      if (isTicketNotFoundError(error)) {
        assert.equal(error.projectPath, secondProject);
        assert.equal(error.ticketId, firstTicket.frontMatter.id);
        assert.match(error.message, new RegExp(secondProject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
      return true;
    }
  );

  const scopedRecord = await readTicket(secondProject, secondTicket.frontMatter.id);
  assert.equal(scopedRecord.frontMatter.title, "Second project ticket");
  assert.equal(scopedRecord.filePath, path.join(secondProject, ".relay", "tickets", `${secondTicket.frontMatter.id}.md`));
});

test("ticket reference candidates expose local display paths and sibling-relative links", async () => {
  const projectPath = await createProject();
  const todoTicket = await createTicket(projectPath, {
    title: "Referenceable todo",
    priority: "medium",
    labels: [],
    markdown: "# Referenceable todo\n"
  });
  const completedTicket = await createTicket(projectPath, {
    title: "Completed reference",
    priority: "low",
    labels: [],
    markdown: "# Completed reference\n"
  });
  await moveTicket({
    projectPath,
    ticketId: completedTicket.frontMatter.id,
    targetStatus: "completed"
  });

  const references = await listTicketReferenceCandidates(projectPath);

  assert.deepEqual(
    references.map((reference) => ({
      id: reference.id,
      title: reference.title,
      columnName: reference.columnName,
      relativePath: reference.relativePath,
      linkPath: reference.linkPath
    })),
    [
      {
        id: todoTicket.frontMatter.id,
        title: "Referenceable todo",
        columnName: "Todo",
        relativePath: `.relay/tickets/${todoTicket.frontMatter.id}.md`,
        linkPath: `./${todoTicket.frontMatter.id}.md`
      },
      {
        id: completedTicket.frontMatter.id,
        title: "Completed reference",
        columnName: "Completed",
        relativePath: `.relay/tickets/${completedTicket.frontMatter.id}.md`,
        linkPath: `./${completedTicket.frontMatter.id}.md`
      }
    ]
  );
});

test("codex runs preserve the selected project context after a cross-project switch", async () => {
  const firstProject = await createProject();
  const secondProject = await createProject();
  await allowNonGitRuns(secondProject);
  const firstTicket = await createImplementationTicket(firstProject, {
    title: "Stale first project ticket",
    priority: "medium",
    labels: [],
    markdown: "# Stale first project ticket\n\nThis content must not be used.\n"
  });
  const secondTicket = await createImplementationTicket(secondProject, {
    title: "Active second project ticket",
    priority: "medium",
    labels: [],
    markdown: "# Active second project ticket\n\nRun this ticket only.\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedPrompt = "";
  let capturedWorkingDirectory = "";
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_project_scope",
    createCodexClient: () =>
      ({
        startThread: (options: { workingDirectory?: string }) => {
          capturedWorkingDirectory = options.workingDirectory ?? "";
          return {
            id: "thread_project_scope",
            runStreamed: async (prompt: string) => {
              capturedPrompt = prompt;
              return {
                events: (async function* () {
                  yield { type: "thread.started", thread_id: "thread_project_scope" };
                  yield { type: "turn.completed", usage: { total_tokens: 1 } };
                })()
              };
            }
          };
        },
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath: secondProject, ticketId: secondTicket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "run completion");

  assert.equal(capturedWorkingDirectory, secondProject);
  assert.match(capturedPrompt, /Active second project ticket/);
  assert.doesNotMatch(capturedPrompt, /Stale first project ticket/);
  assert.match(capturedPrompt, /Subagent guidance:/);
  assert.match(capturedPrompt, /Use subagents only when available and useful/);
  assert.match(capturedPrompt, /independent sidecar tasks/);
  assert.match(capturedPrompt, /blocking critical-path work local/);
  assert.match(capturedPrompt, /disjoint file or module ownership/);
  assert.match(capturedPrompt, /Subagent usage: which subagents were launched/);
  assert.match(capturedPrompt, /none used/);
  assert.equal(events.every((event) => event.projectPath === secondProject && event.ticketId === secondTicket.frontMatter.id), true);
  const completedRunTicket = await readTicket(secondProject, secondTicket.frontMatter.id);
  assert.equal(completedRunTicket.frontMatter.runStatus, "completed");
  assert.equal(completedRunTicket.frontMatter.status, "review");
  await access(path.join(secondProject, ".relay", "runs", secondTicket.frontMatter.id, "run_project_scope.jsonl"));
  await assert.rejects(access(path.join(firstProject, ".relay", "runs", firstTicket.frontMatter.id, "run_project_scope.jsonl")));
});

test("git-backed implementation runs create and use isolated ticket worktrees", async (t: TestContext) => {
  const projectPath = await createProject();
  await initializeGitProject(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Isolated worktree task",
    priority: "medium",
    labels: [],
    markdown: "# Isolated worktree task\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedWorkingDirectory = "";
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_isolated_worktree",
    createCodexClient: () =>
      ({
        startThread: (options: { workingDirectory?: string }) => {
          capturedWorkingDirectory = options.workingDirectory ?? "";
          return {
            id: "thread_isolated_worktree",
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_isolated_worktree" };
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            })
          };
        },
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "isolated worktree run completion");

  assert.notEqual(capturedWorkingDirectory, projectPath);
  assert.match(path.basename(capturedWorkingDirectory), new RegExp(`^${path.basename(projectPath)}-${ticket.frontMatter.id}$`));
  const worktreeList = (await promisify(execFile)("git", ["worktree", "list"], { cwd: projectPath })).stdout;
  assert.match(worktreeList, new RegExp(capturedWorkingDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  t.after(async () => {
    try {
      await promisify(execFile)("git", ["worktree", "remove", capturedWorkingDirectory], { cwd: projectPath });
    } catch {
      // Best effort cleanup for the sibling worktree created by this test.
    }
  });
});

test("codex implementation runs pass local Markdown images as structured SDK input", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  await writeFile(path.join(projectPath, ".relay", "attachments", "ui.png"), "png");
  await writeFile(path.join(projectPath, "diagram.jpg"), "jpg");
  const ticket = await createImplementationTicket(projectPath, {
    title: "Local image ticket",
    priority: "medium",
    labels: [],
    markdown:
      "# Local image ticket\n\n![screenshot](.relay/attachments/ui.png)\n![duplicate](.relay/attachments/ui.png)\n![diagram](diagram.jpg)\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedInput: Input | null = null;
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_local_images",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_local_images",
          runStreamed: async (input: Input) => {
            capturedInput = input;
            return {
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_local_images" };
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            };
          }
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "local image run completion");

  assert.ok(Array.isArray(capturedInput));
  const inputItems = capturedInput as Exclude<Input, string>;
  assert.equal(inputItems[0]?.type, "text");
  assert.match(inputItems[0]?.type === "text" ? inputItems[0].text : "", /Local image ticket/);
  assert.deepEqual(inputItems.slice(1), [
    { type: "local_image", path: path.join(projectPath, ".relay", "attachments", "ui.png") },
    { type: "local_image", path: path.join(projectPath, "diagram.jpg") }
  ]);
});

test("codex implementation runs ignore unsafe or remote Markdown image references", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Ignored image ticket",
    priority: "medium",
    labels: [],
    markdown:
      "# Ignored image ticket\n\n![remote](https://example.com/ui.png)\n![data](data:image/png;base64,abc)\n![fragment](#preview)\n![outside](../outside.png)\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedInput: Input | null = null;
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_ignored_images",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_ignored_images",
          runStreamed: async (input: Input) => {
            capturedInput = input;
            return {
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_ignored_images" };
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            };
          }
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "ignored image run completion");

  if (typeof capturedInput !== "string") assert.fail("Expected invalid image references to preserve string input.");
  assert.match(capturedInput, /Ignored image ticket/);
});

test("codex implementation runs keep string input when no local images are found", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Plain text ticket",
    priority: "medium",
    labels: [],
    markdown: "# Plain text ticket\n\nNo screenshots here.\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedInput: Input | null = null;
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_plain_string_input",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_plain_string_input",
          runStreamed: async (input: Input) => {
            capturedInput = input;
            return {
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_plain_string_input" };
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            };
          }
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "plain string input run completion");

  if (typeof capturedInput !== "string") assert.fail("Expected tickets without local images to preserve string input.");
  assert.match(capturedInput, /Plain text ticket/);
});

test("codex implementation runs pass configured SDK thread options", async () => {
  const projectPath = await createProject();
  const additionalDirectory = path.join(projectPath, "external-worktree");
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    settings: {
      ...config.settings,
      defaultModel: "gpt-5.4",
      defaultModelReasoningEffort: "high",
      defaultTicketEffort: "xhigh",
      defaultApprovalPolicy: "on-failure",
      allowNonGitCodexRuns: true,
      codexNetworkAccessEnabled: true,
      codexWebSearchMode: "live",
      codexAdditionalDirectories: [additionalDirectory]
    }
  });
  const ticket = await createImplementationTicket(projectPath, {
    title: "Configured SDK options",
    priority: "medium",
    effort: "low",
    labels: ["codex"],
    markdown: "# Configured SDK options\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const capturedOptions: ThreadOptions[] = [];
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_configured_sdk_options",
    createCodexClient: () =>
      ({
        startThread: (options: ThreadOptions) => {
          capturedOptions.push(options);
          return {
            id: "thread_configured_sdk_options",
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_configured_sdk_options" };
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            })
          };
        },
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "configured SDK options run completion");

  const options = capturedOptions[0];
  assert.ok(options);
  assert.equal(options.workingDirectory, projectPath);
  assert.equal(options.model, "gpt-5.4");
  assert.equal(ticket.frontMatter.effort, "low");
  assert.equal(options.modelReasoningEffort, "low");
  assert.equal(options.approvalPolicy, "on-failure");
  assert.equal(options.sandboxMode, "workspace-write");
  assert.equal(options.skipGitRepoCheck, true);
  assert.equal(options.networkAccessEnabled, true);
  assert.equal(options.webSearchMode, "live");
  assert.deepEqual(options.additionalDirectories, [additionalDirectory]);
});

test("successful codex runs move to review before human acceptance", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Review gate",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Review gate\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_review_gate",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_review_gate",
          runStreamed: async () => ({
            events: (async function*() {
              yield { type: "thread.started", thread_id: "thread_review_gate" };
              yield { type: "item.completed", item: { type: "agent_message", text: "Ready for review." } };
              yield { type: "turn.completed", usage: { total_tokens: 1 } };
            })()
          })
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "review-gated completion");

  const readyForReview = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(readyForReview.frontMatter.runStatus, "completed");
  assert.equal(readyForReview.frontMatter.status, "review");

  await moveTicket({ projectPath, ticketId: ticket.frontMatter.id, targetStatus: "completed" });
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.status, "completed");
});

test("file changes under .relay are not scope-checked or path-locked", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Relay metadata edits",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Relay metadata edits\n",
    plannedFiles: ["allowed.txt"]
  });
  const relayTicketPath = `.relay/tickets/${ticket.frontMatter.id}.md`;
  const { runEventSink } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_relay_scope_exempt",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_relay_scope_exempt",
          runStreamed: async () => ({
            events: (async function*() {
              yield { type: "thread.started", thread_id: "thread_relay_scope_exempt" };
              yield {
                type: "item.completed",
                item: {
                  type: "file_change",
                  changes: [
                    { path: "allowed.txt", kind: "update" },
                    { path: relayTicketPath, kind: "update" }
                  ]
                }
              };
              yield { type: "item.completed", item: { type: "agent_message", text: "Done." } };
              yield { type: "turn.completed", usage: { total_tokens: 1 } };
            })()
          })
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitForAsync(
    async () => (await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus === "completed",
    "relay scope exempt run completion"
  );
  const completed = await readTicket(projectPath, ticket.frontMatter.id);
  assert.deepEqual(completed.frontMatter.plannedFiles, ["allowed.txt"]);
  assert.equal((await readClarificationQuestions(projectPath, ticket.frontMatter.id)).length, 0);
});

test("out-of-scope file changes expand planned scope dynamically when paths are unlocked", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Dynamic scope expansion",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Dynamic scope expansion\n",
    plannedFiles: ["allowed.txt"]
  });
  const { runEventSink } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_dynamic_scope",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_dynamic_scope",
          runStreamed: async () => ({
            events: (async function*() {
              yield { type: "thread.started", thread_id: "thread_dynamic_scope" };
              yield {
                type: "item.completed",
                item: {
                  type: "file_change",
                  changes: [
                    { path: "allowed.txt", kind: "update" },
                    { path: "extra.txt", kind: "create" }
                  ]
                }
              };
              yield { type: "item.completed", item: { type: "agent_message", text: "Scoped work complete." } };
              yield { type: "turn.completed", usage: { total_tokens: 1 } };
            })()
          })
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitForAsync(
    async () => (await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus === "completed",
    "dynamic scope run completion"
  );
  const completed = await readTicket(projectPath, ticket.frontMatter.id);
  assert.deepEqual(completed.frontMatter.plannedFiles.sort(), ["allowed.txt", "extra.txt"].sort());
  assert.equal((await readClarificationQuestions(projectPath, ticket.frontMatter.id)).length, 0);
});

test("answered scope-violation clarifications require manual approve-and-redraft before a blocked task becomes ready", async () => {
  const projectPath = await createProject();
  const ticket = await createImplementationTicket(projectPath, {
    title: "Scope recovery",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Scope recovery\n\nOriginal plan.\n",
    plannedFiles: ["src/http/resources/tickets.ts"]
  });
  await writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      status: "needs_clarification",
      runStatus: "blocked",
      authoringState: "needs_input",
      lastRunId: "run_scope_recovery_blocked"
    }
  });

  const approvedPath = path.join(projectPath, "src/shared/plannedScope.ts");
  const [scopeClarification] = await createClarificationQuestions(
    projectPath,
    ticket.frontMatter.id,
    [
      {
        question: `Codex attempted to modify file paths outside this ticket's planned scope, so Relay reverted the run.

Please confirm whether implementation should expand the planned file scope to include:
- ${approvedPath}

Current planned scope:
- src/http/resources/tickets.ts`
      }
    ],
    {
      actor: "codex",
      source: "agent_execution",
      runId: "run_scope_recovery_blocked",
      codexThreadId: "thread_scope_recovery_blocked"
    }
  );
  await answerClarificationQuestion(projectPath, ticket.frontMatter.id, scopeClarification.id, "confirmed");

  assert.equal(await maybeFinalizeImplementationScopeAfterClarification(projectPath, ticket.frontMatter.id), null);
  const stillBlocked = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(stillBlocked.frontMatter.status, "needs_clarification");
  assert.equal(stillBlocked.frontMatter.runStatus, "blocked");

  let reconcileCalls = 0;
  let capturedPrompt = "";
  const { runEventSink, events } = createFakeRunEventSink();
  await approveScopeClarificationRedraft(
    {
      projectPath,
      ticketId: ticket.frontMatter.id,
      clarificationQuestionId: scopeClarification.id
    },
    {
      runEventSink,
      createRunId: () => "run_scope_recovery_redraft",
      reconcileTicketQueueState: async () => {
        reconcileCalls += 1;
        return readTicket(projectPath, ticket.frontMatter.id);
      },
      createCodexClient: () =>
        ({
          startThread: () => ({
            id: "thread_scope_recovery_redraft",
            runStreamed: async (prompt: string) => {
              capturedPrompt = prompt;
              return {
                events: (async function*() {
                  yield { type: "thread.started", thread_id: "thread_scope_recovery_redraft" };
                  yield {
                    type: "item.completed",
                    item: {
                      type: "agent_message",
                      text: JSON.stringify({
                        title: "Scope recovery",
                        priority: "high",
                        labels: ["codex", "scope"],
                        authoringState: "ready",
                        plannedFiles: ["src/http/resources/tickets.ts", "src/shared/plannedScope.ts"],
                        patch: {
                          summary: "Expanded the task scope.",
                          appendMarkdown: "## Implementation Plan\n\n- [ ] Update scope-aware redraft flow.\n",
                          fullMarkdown: null
                        },
                        clarificationQuestions: []
                      })
                    }
                  };
                  yield { type: "turn.completed", usage: { total_tokens: 1 } };
                })()
              };
            }
          })
        }) as never
    }
  );
  await waitForAsync(
    async () => events.some((event) => event.runId === "run_scope_recovery_redraft" && event.type === "run.completed"),
    "scope recovery redraft completion"
  );

  const updated = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(updated.frontMatter.id, ticket.frontMatter.id);
  assert.equal(updated.frontMatter.status, "ready");
  assert.equal(updated.frontMatter.runStatus, "idle");
  assert.equal(updated.frontMatter.authoringState, "ready");
  assert.deepEqual(updated.frontMatter.plannedFiles, ["src/http/resources/tickets.ts", "src/shared/plannedScope.ts"]);
  assert.equal(reconcileCalls, 1);
  assert.match(capturedPrompt, /Approved extra paths:/);
  assert.match(capturedPrompt, /src\/shared\/plannedScope\.ts/);
  assert.match(capturedPrompt, /Current planned scope:/);
});

test("absolute repo paths already in planned scope do not trigger scope violations", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Absolute scoped path",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Absolute scoped path\n",
    plannedFiles: ["src/shared/plannedScope.ts"]
  });
  const absolutePath = path.join(projectPath, "src/shared/plannedScope.ts");
  const { runEventSink } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_absolute_scope",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_absolute_scope",
          runStreamed: async () => ({
            events: (async function*() {
              yield { type: "thread.started", thread_id: "thread_absolute_scope" };
              yield {
                type: "item.completed",
                item: {
                  type: "file_change",
                  changes: [{ path: absolutePath, kind: "update" }]
                }
              };
              yield { type: "item.completed", item: { type: "agent_message", text: "Done." } };
              yield { type: "turn.completed", usage: { total_tokens: 1 } };
            })()
          })
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitForAsync(async () => (await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus === "completed", "absolute scoped run completion");
  const clarifications = await readClarificationQuestions(projectPath, ticket.frontMatter.id);
  assert.equal(clarifications.length, 0);
});

test("path locks block another ticket until the holder releases them", async () => {
  const projectPath = await createProject();
  const ticketA = await createImplementationTicket(projectPath, {
    title: "Path lock holder",
    priority: "medium",
    labels: [],
    markdown: "# Path lock holder\n",
    plannedFiles: ["src/shared.ts"]
  });
  const ticketB = await createImplementationTicket(projectPath, {
    title: "Path lock waiter",
    priority: "medium",
    labels: [],
    markdown: "# Path lock waiter\n",
    plannedFiles: ["src/shared.ts"]
  });
  const { pathLockConflictsFor, releasePathLocksForRun, tryAcquirePathLocks } = await import("../src/services/path-lock");
  const acquired = await tryAcquirePathLocks(projectPath, ticketA.frontMatter.id, "run_lock_a", ["src/shared.ts"]);
  assert.equal(acquired.ok, true);
  const conflicts = await pathLockConflictsFor(projectPath, ticketB.frontMatter.id, ["src/shared.ts"]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.holderTicketId, ticketA.frontMatter.id);
  await releasePathLocksForRun(projectPath, ticketA.frontMatter.id, "run_lock_a");
  assert.equal((await pathLockConflictsFor(projectPath, ticketB.frontMatter.id, ["src/shared.ts"])).length, 0);
});

test("codex preflight warns but allows queueing when planned files are locked by another task", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticketA = await createImplementationTicket(projectPath, {
    title: "Preflight lock holder",
    priority: "medium",
    labels: [],
    markdown: "# Preflight lock holder\n",
    plannedFiles: ["src/preflight-lock.ts"]
  });
  const ticketB = await createImplementationTicket(projectPath, {
    title: "Preflight lock blocked",
    priority: "medium",
    labels: [],
    markdown: "# Preflight lock blocked\n",
    plannedFiles: ["src/preflight-lock.ts"]
  });
  const { tryAcquirePathLocks, releasePathLocksForRun } = await import("../src/services/path-lock");
  await tryAcquirePathLocks(projectPath, ticketA.frontMatter.id, "run_preflight_lock", ["src/preflight-lock.ts"]);
  const preflight = await preflightCodexRun({ projectPath, ticketId: ticketB.frontMatter.id });
  assert.equal(preflight.ok, true);
  assert.equal(preflight.errors.length, 0);
  assert.match(preflight.warnings.join(" "), /locked by task/i);
  assert.match(preflight.warnings.join(" "), new RegExp(ticketA.frontMatter.id));
  await releasePathLocksForRun(projectPath, ticketA.frontMatter.id, "run_preflight_lock");
});

test("in-scope file changes complete without creating scope clarifications", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Scoped success",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Scoped success\n",
    plannedFiles: ["src/scoped-success.ts"]
  });
  let capturedPrompt = "";
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_scope_success",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_scope_success",
          runStreamed: async (prompt: string) => {
            capturedPrompt = prompt;
            return {
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_scope_success" };
                yield {
                  type: "item.completed",
                  item: {
                    type: "file_change",
                    changes: [{ path: "src/scoped-success.ts", kind: "update" }]
                  }
                };
                yield { type: "item.completed", item: { type: "agent_message", text: "Scoped work complete." } };
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            };
          }
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.runId === "run_scope_success" && event.type === "run.completed"), "in-scope completion");

  const completed = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(completed.frontMatter.runStatus, "completed");
  assert.equal(completed.frontMatter.status, "review");
  assert.match(capturedPrompt, /Planned file scope for this run:/);
  assert.match(capturedPrompt, /src\/scoped-success\.ts/);
  assert.equal((await readClarificationQuestions(projectPath, ticket.frontMatter.id)).length, 0);
});

test("codex runs persist structured todo and MCP tool-call SDK events", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Structured SDK events",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Structured SDK events\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_structured_sdk_events",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_structured_sdk_events",
          runStreamed: async () => ({
            events: (async function*() {
              yield { type: "thread.started", thread_id: "thread_structured_sdk_events" };
              yield {
                type: "item.started",
                item: {
                  id: "todo_structured",
                  type: "todo_list",
                  items: [
                    { text: "Inspect SDK stream", completed: false },
                    { text: "Persist structured events", completed: false }
                  ]
                }
              };
              yield {
                type: "item.updated",
                item: {
                  id: "todo_structured",
                  type: "todo_list",
                  items: [
                    { text: "Inspect SDK stream", completed: true },
                    { text: "Persist structured events", completed: false }
                  ]
                }
              };
              yield {
                type: "item.started",
                item: {
                  id: "mcp_structured",
                  type: "mcp_tool_call",
                  server: "github",
                  tool: "search",
                  arguments: { query: "Relay SDK events" },
                  status: "in_progress"
                }
              };
              yield {
                type: "item.completed",
                item: {
                  id: "mcp_structured",
                  type: "mcp_tool_call",
                  server: "github",
                  tool: "search",
                  arguments: { query: "Relay SDK events" },
                  result: { content: [{ type: "text", text: "large result" }], structured_content: { matches: [1, 2, 3] } },
                  status: "completed"
                }
              };
              yield {
                type: "item.completed",
                item: {
                  id: "mcp_failed",
                  type: "mcp_tool_call",
                  server: "filesystem",
                  tool: "read_file",
                  arguments: { path: "/tmp/missing" },
                  error: { message: "File not found." },
                  status: "failed"
                }
              };
              yield { type: "turn.completed", usage: { total_tokens: 1 } };
            })()
          })
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "structured SDK event run completion");

  const emittedTodoEvents = events.filter(
    (event): event is Extract<RendererRunEvent, { type: "todo.updated" }> => event.type === "todo.updated"
  );
  assert.equal(emittedTodoEvents.length, 2);
  assert.deepEqual(emittedTodoEvents.at(-1)?.items, [
    { text: "Inspect SDK stream", completed: true },
    { text: "Persist structured events", completed: false }
  ]);

  const emittedMcpEvents = events.filter(
    (event): event is Extract<RendererRunEvent, { type: "mcp.tool_call" }> => event.type === "mcp.tool_call"
  );
  assert.deepEqual(
    emittedMcpEvents.map((event) => [event.server, event.tool, event.status, event.error ?? null]),
    [
      ["github", "search", "in_progress", null],
      ["github", "search", "completed", null],
      ["filesystem", "read_file", "failed", "File not found."]
    ]
  );
  assert.equal(events.some((event) => event.type === "agent.message.delta" && /github\.search/.test(event.text)), false);

  const persistedEvents = await readCodexRunEvents(projectPath, ticket.frontMatter.id, "run_structured_sdk_events");
  const persistedTodo = persistedEvents.filter(
    (event): event is Extract<RendererRunEvent, { type: "todo.updated" }> => event.type === "todo.updated"
  );
  assert.deepEqual(persistedTodo.at(-1)?.items, emittedTodoEvents.at(-1)?.items);

  const persistedMcp = persistedEvents.filter(
    (event): event is Extract<RendererRunEvent, { type: "mcp.tool_call" }> => event.type === "mcp.tool_call"
  );
  const completedMcp = persistedMcp.find((event) => event.status === "completed");
  const failedMcp = persistedMcp.find((event) => event.status === "failed");
  assert.ok(completedMcp);
  assert.ok(failedMcp);
  assert.equal(completedMcp.server, "github");
  assert.equal(completedMcp.tool, "search");
  assert.equal("arguments" in completedMcp, false);
  assert.equal("result" in completedMcp, false);
  assert.equal(failedMcp.error, "File not found.");
});

test("codex scheduler honors project agentConcurrency for Ready implementation runs", async () => {
  const projectPath = await createProject();
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    settings: {
      ...config.settings,
      allowNonGitCodexRuns: true,
      agentConcurrency: 3
    }
  });
  const firstTicket = await createImplementationTicket(projectPath, {
    title: "First queued run",
    priority: "medium",
    labels: ["codex"],
    markdown: "# First queued run\n"
  });
  const secondTicket = await createImplementationTicket(projectPath, {
    title: "Second queued run",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Second queued run\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const gates = [deferred(), deferred()];
  const startedThreads: string[] = [];
  const runIds = ["run_scheduler_first", "run_scheduler_second"];
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => runIds.shift() ?? "run_scheduler_extra",
    createCodexClient: () =>
      ({
        startThread: () => {
          const index = startedThreads.length;
          const threadId = index === 0 ? "thread_scheduler_first" : "thread_scheduler_second";
          startedThreads.push(threadId);
          return {
            id: threadId,
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: threadId };
                await gates[index].promise;
                yield { type: "item.completed", item: { type: "agent_message", text: `Done ${index + 1}.` } };
                yield { type: "turn.completed", usage: { total_tokens: index + 1 } };
              })()
            })
          };
        },
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  const firstResult = await startCodexRun({ projectPath, ticketId: firstTicket.frontMatter.id }, dependencies);
  const secondResult = await startCodexRun({ projectPath, ticketId: secondTicket.frontMatter.id }, dependencies);

  assert.equal(firstResult.state, "queued");
  assert.equal(secondResult.state, "queued");
  await waitFor(() => startedThreads.length === 2, "queued runs to start up to concurrency limit");
  assert.deepEqual(startedThreads, ["thread_scheduler_first", "thread_scheduler_second"]);
  await waitForAsync(async () => {
    const current = await readTicket(projectPath, firstTicket.frontMatter.id);
    return current.frontMatter.runStatus === "running" && current.frontMatter.status === "in_progress";
  }, "first run marked running in progress");
  await waitForAsync(async () => {
    const current = await readTicket(projectPath, secondTicket.frontMatter.id);
    return current.frontMatter.runStatus === "running" && current.frontMatter.status === "in_progress";
  }, "second run marked running in progress");
  const runningFirst = await readTicket(projectPath, firstTicket.frontMatter.id);
  assert.equal(runningFirst.frontMatter.runStatus, "running");
  assert.equal(runningFirst.frontMatter.status, "in_progress");
  assert.equal(typeof runningFirst.frontMatter.lastRunStartedAt, "string");
  assert.equal(Number.isNaN(Date.parse(runningFirst.frontMatter.lastRunStartedAt ?? "")), false);
  const runningSecond = await readTicket(projectPath, secondTicket.frontMatter.id);
  assert.equal(runningSecond.frontMatter.status, "in_progress");
  assert.equal(runningSecond.frontMatter.runStatus, "running");
  assert.equal(Number.isNaN(Date.parse(runningSecond.frontMatter.lastRunStartedAt ?? "")), false);

  const duplicatePreflight = await preflightCodexRun({ projectPath, ticketId: secondTicket.frontMatter.id });
  assert.equal(duplicatePreflight.ok, false);
  assert.match(duplicatePreflight.errors.join(" "), /already queued/);

  gates[0].resolve();
  await waitForAsync(async () => (await readTicket(projectPath, firstTicket.frontMatter.id)).frontMatter.runStatus === "completed", "first run completed");
  const completedFirstAfter = await readTicket(projectPath, firstTicket.frontMatter.id);
  assert.equal(completedFirstAfter.frontMatter.status, "review");
  assert.equal(completedFirstAfter.frontMatter.runStatus, "completed");

  gates[1].resolve();
  await waitFor(() => events.some((event) => event.runId === "run_scheduler_second" && event.type === "run.completed"), "second run completion");
});

test("active ticket drafts do not occupy the Ready implementation worker lane", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const firstTicket = await createImplementationTicket(projectPath, {
    title: "First implementation while drafting",
    priority: "medium",
    labels: ["codex"],
    markdown: "# First implementation while drafting\n"
  });
  const secondTicket = await createImplementationTicket(projectPath, {
    title: "Second implementation while drafting",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Second implementation while drafting\n"
  });
  const draftGate = deferred();
  let draftStarted = false;
  const { runEventSink: draftRunEventSink } = createFakeRunEventSink();
  const draftDependencies: TicketDraftStartDependencies = {
    getStatus: async () => ({
      sdkAvailable: true,
      cliAvailable: true,
      cliVersion: "codex-test",
      authenticated: true,
      message: "Codex is available."
    }),
    createRunId: () => "run_scheduler_draft",
    createRequestId: () => "tdr_scheduler_draft",
    runEventSink: draftRunEventSink,
    createCodexClient: () => ({
      startThread: () => ({
        run: async () => {
          draftStarted = true;
          await draftGate.promise;
          return { items: [], usage: null, finalResponse: validDraftJson("Completed scheduler draft") };
        }
      })
    })
  };
  const draft = await startTicketDraftRun({ projectPath, idea: "Draft a ticket while implementations run" }, draftDependencies);
  await waitFor(() => draftStarted, "draft request to start");

  const { runEventSink, events } = createFakeRunEventSink();
  const gates = [deferred(), deferred()];
  const startedThreads: string[] = [];
  const runIds = ["run_scheduler_draft_lane_first", "run_scheduler_draft_lane_second"];
  const implementationDependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => runIds.shift() ?? "run_scheduler_draft_lane_extra",
    createCodexClient: () =>
      ({
        startThread: () => {
          const index = startedThreads.length;
          const threadId = index === 0 ? "thread_scheduler_draft_lane_first" : "thread_scheduler_draft_lane_second";
          startedThreads.push(threadId);
          return {
            id: threadId,
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: threadId };
                await gates[index].promise;
                yield { type: "item.completed", item: { type: "agent_message", text: `Draft lane done ${index + 1}.` } };
                yield { type: "turn.completed", usage: { total_tokens: index + 1 } };
              })()
            })
          };
        },
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  const firstResult = await startCodexRun({ projectPath, ticketId: firstTicket.frontMatter.id }, implementationDependencies);
  const secondResult = await startCodexRun({ projectPath, ticketId: secondTicket.frontMatter.id }, implementationDependencies);

  assert.equal(firstResult.state, "queued");
  assert.equal(secondResult.state, "queued");
  await waitFor(() => startedThreads.length === 1, "first implementation to start while draft is active");
  assert.deepEqual(startedThreads, ["thread_scheduler_draft_lane_first"]);
  const runningDraft = await readTicket(projectPath, draft.ticket.frontMatter.id);
  assert.equal(runningDraft.frontMatter.runStatus, "drafting");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(startedThreads, ["thread_scheduler_draft_lane_first"]);
  const queuedSecond = await readTicket(projectPath, secondTicket.frontMatter.id);
  assert.equal(queuedSecond.frontMatter.status, "ready");
  assert.equal(queuedSecond.frontMatter.runStatus, "queued");
  assert.equal(queuedSecond.frontMatter.lastRunStartedAt, null);

  gates[0].resolve();
  await waitFor(() => startedThreads.length === 2, "second implementation to start after first completion");
  gates[1].resolve();
  await waitFor(
    () => events.some((event) => event.runId === "run_scheduler_draft_lane_second" && event.type === "run.completed"),
    "second implementation completion"
  );

  draftGate.resolve();
  await waitForAsync(
    async () => (await readTicket(projectPath, draft.ticket.frontMatter.id)).frontMatter.runStatus === "draft_complete",
    "draft completion"
  );
});

test("queued codex cancellation returns the ticket to Todo without SDK startup", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const firstTicket = await createImplementationTicket(projectPath, {
    title: "Occupy scheduler",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Occupy scheduler\n"
  });
  const secondTicket = await createImplementationTicket(projectPath, {
    title: "Cancel while queued",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Cancel while queued\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const gate = deferred();
  let startedCount = 0;
  const runIds = ["run_cancel_queue_active", "run_cancel_queue_waiting"];
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => runIds.shift() ?? "run_cancel_queue_extra",
    createCodexClient: () =>
      ({
        startThread: () => {
          startedCount += 1;
          return {
            id: `thread_cancel_queue_${startedCount}`,
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: `thread_cancel_queue_${startedCount}` };
                await gate.promise;
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            })
          };
        },
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: firstTicket.frontMatter.id }, dependencies);
  const queued = await startCodexRun({ projectPath, ticketId: secondTicket.frontMatter.id }, dependencies);
  await waitFor(() => startedCount === 1, "active run to occupy scheduler");

  await cancelCodexRun(queued.runId);
  const cancelledQueued = await readTicket(projectPath, secondTicket.frontMatter.id);
  assert.equal(cancelledQueued.frontMatter.status, "todo");
  assert.equal(cancelledQueued.frontMatter.runStatus, "idle");
  assert.equal(cancelledQueued.frontMatter.lastRunId, null);

  gate.resolve();
  await waitFor(() => events.some((event) => event.runId === "run_cancel_queue_active" && event.type === "run.completed"), "active run completion");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(startedCount, 1);
  assert.deepEqual(await readCodexRunEvents(projectPath, secondTicket.frontMatter.id, queued.runId), []);
});

test("manual Ready moves enqueue idle tickets and moving out clears queued state", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const activeTicket = await createImplementationTicket(projectPath, {
    title: "Active manual queue blocker",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Active manual queue blocker\n"
  });
  const queuedTicket = await createImplementationTicket(projectPath, {
    title: "Manual queued ticket",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Manual queued ticket\n"
  });
  const { runEventSink } = createFakeRunEventSink();
  const gate = deferred();
  let startedCount = 0;
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => (startedCount === 0 ? "run_manual_active" : "run_manual_ready"),
    createCodexClient: () =>
      ({
        startThread: () => {
          startedCount += 1;
          return {
            id: `thread_manual_${startedCount}`,
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: `thread_manual_${startedCount}` };
                await gate.promise;
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            })
          };
        },
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: activeTicket.frontMatter.id }, dependencies);
  await waitFor(() => startedCount === 1, "manual queue active run to start");

  await moveTicket({ projectPath, ticketId: queuedTicket.frontMatter.id, targetStatus: "ready" });
  const queued = await reconcileTicketQueueState(projectPath, queuedTicket.frontMatter.id, dependencies);
  assert.equal(queued.frontMatter.status, "ready");
  assert.equal(queued.frontMatter.runStatus, "queued");
  assert.equal(queued.frontMatter.lastRunId, "run_manual_ready");

  await moveTicket({ projectPath, ticketId: queuedTicket.frontMatter.id, targetStatus: "todo" });
  const cleared = await reconcileTicketQueueState(projectPath, queuedTicket.frontMatter.id, dependencies);
  assert.equal(cleared.frontMatter.status, "todo");
  assert.equal(cleared.frontMatter.runStatus, "idle");
  assert.equal(cleared.frontMatter.lastRunId, null);

  gate.resolve();
  await waitForAsync(async () => (await readTicket(projectPath, activeTicket.frontMatter.id)).frontMatter.runStatus === "completed", "manual active run completion");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(startedCount, 1);
});

test("codex runs reject non-git projects until explicitly allowed", async () => {
  const projectPath = await createProject();
  const ticket = await createImplementationTicket(projectPath, {
    title: "Non git run",
    priority: "medium",
    labels: [],
    markdown: "# Non git run\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createCodexClient: () => {
      throw new Error("Codex client should not be created for disallowed non-git runs.");
    }
  };

  const preflight = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id });
  assert.equal(preflight.ok, false);
  assert.match(preflight.errors.join(" "), /not a Git repository/);

  await assert.rejects(
    startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies),
    /not a Git repository/
  );

  assert.equal(events.length, 0);
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus, "idle");
});

test("codex run preflight blocks invalid workflow states", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);

  const completedTicket = await createImplementationTicket(projectPath, {
    title: "Accepted work",
    priority: "medium",
    labels: [],
    markdown: "# Accepted work\n"
  });
  await moveTicket({ projectPath, ticketId: completedTicket.frontMatter.id, targetStatus: "completed" });
  const completedPreflight = await preflightCodexRun({ projectPath, ticketId: completedTicket.frontMatter.id });
  assert.equal(completedPreflight.ok, false);
  assert.match(completedPreflight.errors.join(" "), /Completed tickets are human accepted/);

  const notDoingTicket = await createImplementationTicket(projectPath, {
    title: "Rejected work",
    priority: "medium",
    labels: [],
    markdown: "# Rejected work\n"
  });
  await moveTicket({ projectPath, ticketId: notDoingTicket.frontMatter.id, targetStatus: "not_doing" });
  const notDoingPreflight = await preflightCodexRun({ projectPath, ticketId: notDoingTicket.frontMatter.id });
  assert.equal(notDoingPreflight.ok, false);
  assert.match(notDoingPreflight.errors.join(" "), /Not Doing/);

  const epic = await createTicket(projectPath, {
    title: "Planning container",
    priority: "medium",
    labels: [],
    markdown: "# Planning container\n",
    ticketType: "epic"
  });
  const epicPreflight = await preflightCodexRun({ projectPath, ticketId: epic.frontMatter.id });
  assert.equal(epicPreflight.ok, false);
  assert.match(epicPreflight.errors.join(" "), /Epics are planning containers/);

  const feature = await createTicket(projectPath, {
    title: "Planning feature",
    priority: "medium",
    labels: [],
    markdown: "# Planning feature\n",
    ticketType: "feature"
  });
  const featurePreflight = await preflightCodexRun({ projectPath, ticketId: feature.frontMatter.id });
  assert.equal(featurePreflight.ok, false);
  assert.match(featurePreflight.errors.join(" "), /Features are planning containers/);

  const missingScopeTask = await createTicket(projectPath, {
    title: "Missing scope task",
    priority: "low",
    labels: [],
    markdown: "# Missing scope task\n",
    parentFeatureId: null
  });
  const missingScopePreflight = await preflightCodexRun({ projectPath, ticketId: missingScopeTask.frontMatter.id });
  assert.equal(missingScopePreflight.ok, false);
  assert.match(missingScopePreflight.errors.join(" "), /planned file scope/);

  const standaloneTask = await createImplementationTicket(projectPath, {
    title: "Micro change",
    priority: "low",
    labels: [],
    markdown: "# Micro change\n",
    parentFeatureId: null
  });
  const standalonePreflight = await preflightCodexRun({ projectPath, ticketId: standaloneTask.frontMatter.id });
  assert.equal(standalonePreflight.ok, true);
  assert.equal(standalonePreflight.warnings.join(" "), "");

  const clarificationTicket = await createImplementationTicket(projectPath, {
    title: "Open question",
    priority: "medium",
    labels: [],
    markdown: "# Open question\n"
  });
  await createClarificationQuestions(projectPath, clarificationTicket.frontMatter.id, [{ question: "Which API should this target?" }], {
    actor: "codex",
    source: "agent_execution",
    runId: "run_open_question",
    codexThreadId: "thread_open_question"
  });
  const clarificationPreflight = await preflightCodexRun({ projectPath, ticketId: clarificationTicket.frontMatter.id });
  assert.equal(clarificationPreflight.ok, false);
  assert.equal(clarificationPreflight.unansweredClarificationCount, 1);
  assert.match(clarificationPreflight.errors.join(" "), /clarification question/);

  const staleRunningTicket = await createImplementationTicket(projectPath, {
    title: "Stale running state",
    priority: "medium",
    labels: [],
    markdown: "# Stale running state\n"
  });
  await writeTicket(projectPath, {
    ...staleRunningTicket,
    frontMatter: {
      ...staleRunningTicket.frontMatter,
      runStatus: "running"
    }
  });
  const staleRunningPreflight = await preflightCodexRun({ projectPath, ticketId: staleRunningTicket.frontMatter.id });
  assert.equal(staleRunningPreflight.ok, false);
  assert.match(staleRunningPreflight.errors.join(" "), /already marked as running/);

  const queuedTicket = await createImplementationTicket(projectPath, {
    title: "Already queued",
    priority: "medium",
    labels: [],
    markdown: "# Already queued\n"
  });
  await writeTicket(projectPath, {
    ...queuedTicket,
    frontMatter: {
      ...queuedTicket.frontMatter,
      runStatus: "queued",
      lastRunId: "run_already_queued"
    }
  });
  const queuedPreflight = await preflightCodexRun({ projectPath, ticketId: queuedTicket.frontMatter.id });
  assert.equal(queuedPreflight.ok, false);
  assert.match(queuedPreflight.errors.join(" "), /already queued/);
});

test("codex run failures preserve failed run status and renderer-facing events", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Failing run",
    priority: "high",
    labels: ["codex"],
    markdown: "# Failing run\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_backend_failure",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_backend_failure",
          runStreamed: async () => ({
            events: (async function*() {
              yield { type: "thread.started", thread_id: "thread_backend_failure" };
              yield { type: "turn.failed", error: { message: "SDK stream failed." } };
            })()
          })
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.failed"), "run failure");

  const updated = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(updated.frontMatter.runStatus, "failed");
  assert.equal(events.some((event) => event.type === "run.failed" && event.message === "SDK stream failed."), true);

  const persistedEvents = await readCodexRunEvents(projectPath, ticket.frontMatter.id, "run_backend_failure");
  assert.equal(persistedEvents.some((event) => event.type === "run.failed" && event.message === "SDK stream failed."), true);
});

test("codex run startup failures finalize active run state", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Startup failure",
    priority: "high",
    labels: ["codex"],
    markdown: "# Startup failure\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_stream_start_failure",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_stream_start_failure",
          runStreamed: async () => {
            throw new Error("Stream could not start.");
          }
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  const queued = await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  assert.equal(queued.state, "queued");
  await waitFor(() => events.some((event) => event.type === "run.failed"), "startup failure event");

  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus, "failed");

  await cancelCodexRun("run_stream_start_failure");
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus, "failed");

  const persistedEvents = await readCodexRunEvents(projectPath, ticket.frontMatter.id, "run_stream_start_failure");
  assert.equal(persistedEvents.some((event) => event.type === "run.failed" && event.message === "Stream could not start."), true);
});

test("codex run cancellation aborts the stream and cleans up the active run", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Cancellation cleanup",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Cancellation cleanup\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedSignal: AbortSignal | undefined;
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => "run_cancel_cleanup",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_cancel_cleanup",
          runStreamed: async (_prompt: string, options?: { signal?: AbortSignal }) => {
            capturedSignal = options?.signal;
            return {
              events: (async function*() {
                yield { type: "thread.started", thread_id: "thread_cancel_cleanup" };
                await new Promise<void>((_resolve, reject) => {
                  if (capturedSignal?.aborted) {
                    const error = new Error("The operation was aborted.");
                    error.name = "AbortError";
                    reject(error);
                    return;
                  }
                  capturedSignal?.addEventListener(
                    "abort",
                    () => {
                      const error = new Error("The operation was aborted.");
                      error.name = "AbortError";
                      reject(error);
                    },
                    { once: true }
                  );
                });
              })()
            };
          }
        }),
        resumeThread: () => {
          throw new Error("resumeThread should not be used for a fresh run.");
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.started"), "run start before cancellation");
  const duplicatePreflight = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id });
  assert.equal(duplicatePreflight.ok, false);
  assert.match(duplicatePreflight.errors.join(" "), /active agent run/);
  await cancelCodexRun("run_cancel_cleanup");

  assert.equal(capturedSignal?.aborted, true);
  await waitFor(() => events.some((event) => event.type === "run.failed"), "run cancellation finalizer");
  const afterCancel = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(afterCancel.frontMatter.runStatus, "paused");
  assert.equal(afterCancel.frontMatter.status, "in_progress");
  assert.equal(afterCancel.frontMatter.codexThreadId, "thread_cancel_cleanup");
  assert.equal(afterCancel.frontMatter.lastRunId, "run_cancel_cleanup");

  const persistedEvents = await readCodexRunEvents(projectPath, ticket.frontMatter.id, "run_cancel_cleanup");
  assert.equal(persistedEvents.some((event) => event.type === "run.failed" && event.finalStatus === "paused" && /aborted/i.test(event.message)), true);
});

test("paused implementation runs can be continued on the same Codex thread", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Paused implementation resume",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Paused implementation resume\n"
  });
  const firstGate = deferred();
  const resumeGate = deferred();
  let resumeThreadId: string | null = null;
  const runIds = ["run_pause_initial", "run_pause_resume"];
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: CodexRunDependencies = {
    runEventSink,
    createRunId: () => runIds.shift() ?? "run_pause_extra",
    createCodexClient: () =>
      ({
        startThread: () => ({
          id: "thread_pause_resume",
          runStreamed: async (_prompt: string, options?: { signal?: AbortSignal }) => ({
            events: (async function*() {
              yield { type: "thread.started", thread_id: "thread_pause_resume" };
              await new Promise<void>((_resolve, reject) => {
                if (options?.signal?.aborted) {
                  reject(new Error("The operation was aborted."));
                  return;
                }
                options?.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted.")), { once: true });
              });
              await firstGate.promise;
            })()
          })
        }),
        resumeThread: (threadId: string) => {
          resumeThreadId = threadId;
          return {
            id: threadId,
            runStreamed: async () => ({
              events: (async function*() {
                yield { type: "thread.started", thread_id: threadId };
                await resumeGate.promise;
                yield { type: "item.completed", item: { type: "agent_message", text: "Resumed work done." } };
                yield { type: "turn.completed", usage: { total_tokens: 1 } };
              })()
            })
          };
        }
      }) as CodexRunDependencies["createCodexClient"] extends () => infer Client ? Client : never
  };

  await startCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  await waitFor(() => events.some((event) => event.runId === "run_pause_initial" && event.type === "run.started"), "initial run started");
  const pausedResult = await cancelCodexRun({ projectPath, ticketId: ticket.frontMatter.id, runId: "run_pause_initial" });
  assert.equal(pausedResult.outcome, "paused");
  await waitForAsync(async () => (await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus === "paused", "ticket paused");

  const genericPreflight = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id });
  assert.equal(genericPreflight.ok, false);
  assert.match(genericPreflight.errors.join(" "), /paused or failed implementation work/);

  const resumePreflight = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id, resume: true });
  assert.equal(resumePreflight.ok, true);

  const resumed = await resumeCodexRun({ projectPath, ticketId: ticket.frontMatter.id }, dependencies);
  assert.equal(resumed.state, "queued");
  const queuedTicket = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(queuedTicket.frontMatter.status, "in_progress");
  assert.equal(queuedTicket.frontMatter.runStatus, "queued");
  assert.equal(queuedTicket.frontMatter.lastRunId, "run_pause_resume");

  await waitForAsync(async () => (await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.runStatus === "running", "resumed run running");
  assert.equal(resumeThreadId, "thread_pause_resume");
  resumeGate.resolve();
  await waitFor(() => events.some((event) => event.runId === "run_pause_resume" && event.type === "run.completed"), "resumed run completion");
});

test("codex preflight allows resume for failed in-progress implementation tickets", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Failed retry",
    priority: "medium",
    labels: [],
    markdown: "# Failed retry\n"
  });
  await moveTicket({ projectPath, ticketId: ticket.frontMatter.id, targetStatus: "in_progress" });
  const loaded = await readTicket(projectPath, ticket.frontMatter.id);
  await writeTicket(projectPath, {
    ...loaded,
    frontMatter: {
      ...loaded.frontMatter,
      runStatus: "failed",
      codexThreadId: "thread_failed_resume",
      lastRunId: "run_failed_resume"
    }
  });

  const blocked = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id, resume: false });
  assert.equal(blocked.ok, false);
  assert.match(blocked.errors.join(" "), /paused or failed implementation work/);

  const resume = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id, resume: true });
  assert.equal(resume.ok, true);
});

test("failed implementation retry restores plannedFiles from the previous run log", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Failed retry scope",
    priority: "medium",
    labels: [],
    markdown: "# Failed retry scope\n",
    plannedFiles: []
  });
  await moveTicket({ projectPath, ticketId: ticket.frontMatter.id, targetStatus: "in_progress" });
  const runId = "run_failed_scope_restore";
  const loaded = await readTicket(projectPath, ticket.frontMatter.id);
  await writeTicket(projectPath, {
    ...loaded,
    frontMatter: {
      ...loaded.frontMatter,
      runStatus: "failed",
      codexThreadId: "thread_failed_scope_restore",
      lastRunId: runId,
      plannedFiles: []
    }
  });
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_failed_scope_restore", {
    type: "file.change",
    path: "src/renderer/src/App.tsx",
    kind: "update",
    timestamp: "2026-05-12T10:00:00.000Z"
  });

  const resume = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id, resume: true });
  assert.equal(resume.ok, true);
  assert.match(resume.warnings.join(" "), /Restored planned file scope/);

  const updated = await readTicket(projectPath, ticket.frontMatter.id);
  assert.deepEqual(updated.frontMatter.plannedFiles, ["src/renderer/src/App.tsx"]);
});

test("failed implementation retry without planned scope routes to Needs Clarification", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Failed retry missing scope",
    priority: "medium",
    labels: [],
    markdown: "# Failed retry missing scope\n",
    plannedFiles: []
  });
  await moveTicket({ projectPath, ticketId: ticket.frontMatter.id, targetStatus: "in_progress" });
  const loaded = await readTicket(projectPath, ticket.frontMatter.id);
  await writeTicket(projectPath, {
    ...loaded,
    frontMatter: {
      ...loaded.frontMatter,
      runStatus: "failed",
      codexThreadId: "thread_failed_missing_scope",
      lastRunId: "run_failed_missing_scope",
      plannedFiles: []
    }
  });

  const resume = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id, resume: true });
  assert.equal(resume.ok, false);
  assert.match(resume.errors.join(" "), /Needs Clarification/);
  assert.match(resume.errors.join(" "), /clarification question/);
  assert.equal(resume.unansweredClarificationCount, 1);

  const blocked = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(blocked.frontMatter.status, "needs_clarification");
  assert.equal(blocked.frontMatter.runStatus, "blocked");
  assert.equal(blocked.frontMatter.authoringState, "needs_input");

  const clarifications = await readClarificationQuestions(projectPath, ticket.frontMatter.id);
  assert.equal(clarifications.length, 1);
  assert.match(clarifications[0].question, /missing planned file scope/);

  const scopeDraft = {
    title: "Failed retry missing scope",
    summary: "Redrafted scope",
    priority: "medium" as const,
    labels: [] as string[],
    context: "Context",
    researchFindings: [] as string[],
    requirements: ["Requirement"],
    implementationPlan: ["Step"],
    testPlan: ["Test"],
    acceptanceCriteria: ["Done"],
    clarificationQuestions: [] as string[],
    assumptions: [] as string[],
    implementationNotes: [] as string[],
    plannedFiles: ["src/services/codex/index.ts", "src/renderer/src/App.tsx"],
    draftState: "ready" as const,
    blockingClarificationQuestions: [] as string[],
    ticketType: "task" as const,
    subtickets: [],
    featureStubs: [],
    leanTasks: [],
    research: {
      generatedAt: "",
      checkedUrls: [],
      inspectedFiles: [],
      limitations: [],
      limits: { maxResearchMs: 0, maxUrls: 0, maxFiles: 0 }
    }
  };

  const redrafted = await applyImplementationScopeRedraftToTicket(
    projectPath,
    ticket.frontMatter.id,
    scopeDraft,
    "run_failed_missing_scope"
  );
  assert.equal(redrafted.frontMatter.status, "needs_clarification");
  assert.equal(redrafted.frontMatter.runStatus, "idle");
  assert.equal(redrafted.frontMatter.authoringState, "needs_input");
  assert.deepEqual(
    [...redrafted.frontMatter.plannedFiles].sort(),
    ["src/renderer/src/App.tsx", "src/services/codex/index.ts"].sort()
  );

  await answerClarificationQuestion(
    projectPath,
    ticket.frontMatter.id,
    clarifications[0].id,
    "Redraft and rescope files"
  );
  const finalized = await maybeFinalizeImplementationScopeAfterClarification(projectPath, ticket.frontMatter.id);
  assert.ok(finalized);
  assert.equal(finalized.frontMatter.status, "ready");
  assert.equal(finalized.frontMatter.authoringState, "ready");
  assert.equal(finalized.frontMatter.runStatus, "queued");
  assert.ok(finalized.frontMatter.lastRunId);
  assert.equal(finalized.frontMatter.codexThreadId, null);

  const retryReady = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id, resume: true });
  assert.equal(retryReady.ok, false);
  assert.match(retryReady.errors.join(" "), /Only paused or failed in-progress implementation tickets/);
});

test("reconcileSchedulableReadyTickets queues idle ready tasks for the worker", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Idle ready poll pickup",
    priority: "medium",
    labels: [],
    markdown: "# Idle ready poll pickup\n",
    plannedFiles: ["src/renderer/src/App.tsx"]
  });
  await moveTicket({ projectPath, ticketId: ticket.frontMatter.id, targetStatus: "ready" });
  const idleReady = await readTicket(projectPath, ticket.frontMatter.id);
  await writeTicket(projectPath, {
    ...idleReady,
    frontMatter: {
      ...idleReady.frontMatter,
      runStatus: "idle",
      lastRunId: null,
      codexThreadId: null,
      authoringState: "ready"
    }
  });

  await reconcileSchedulableReadyTickets(projectPath);
  const queued = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(queued.frontMatter.status, "ready");
  assert.equal(queued.frontMatter.runStatus, "queued");
  assert.ok(queued.frontMatter.lastRunId);
});

test("failed implementation retry without planned scope moves ticket even when clarification already exists", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Failed retry stale clarification",
    priority: "medium",
    labels: [],
    markdown: "# Failed retry stale clarification\n",
    plannedFiles: []
  });
  await moveTicket({ projectPath, ticketId: ticket.frontMatter.id, targetStatus: "in_progress" });
  const loaded = await readTicket(projectPath, ticket.frontMatter.id);
  await writeTicket(projectPath, {
    ...loaded,
    frontMatter: {
      ...loaded.frontMatter,
      runStatus: "failed",
      codexThreadId: "thread_failed_stale_clarification",
      lastRunId: "run_failed_stale_clarification",
      plannedFiles: []
    }
  });
  await createClarificationQuestions(
    projectPath,
    ticket.frontMatter.id,
    [{ question: "Relay: missing planned file scope\n\nList file paths." }],
    {
      actor: "codex",
      source: "agent_execution",
      runId: "run_failed_stale_clarification",
      codexThreadId: "thread_failed_stale_clarification"
    }
  );

  const resume = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id, resume: true });
  assert.equal(resume.ok, false);
  const blocked = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(blocked.frontMatter.status, "needs_clarification");
  assert.equal(blocked.frontMatter.runStatus, "blocked");
});

test("discarding paused implementation work clears continuation state and returns to Todo", async () => {
  const projectPath = await createProject();
  await runGit(projectPath, "-c", "core.hooksPath=/dev/null", "init");
  await runGit(projectPath, "config", "user.email", "relay@test.local");
  await runGit(projectPath, "config", "user.name", "Relay Test");
  await writeFile(path.join(projectPath, "tracked.txt"), "tracked baseline\n", "utf8");
  await runGit(projectPath, "add", "tracked.txt");
  await runGit(projectPath, "commit", "-m", "baseline");
  const ticket = await createImplementationTicket(projectPath, {
    title: "Paused discard",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Paused discard\n"
  });
  const runId = "run_paused_discard";
  await captureRunGitBaseline(projectPath, ticket.frontMatter.id, runId);
  await writeFile(path.join(projectPath, "tracked.txt"), "tracked agent edit\n", "utf8");
  await writeFile(path.join(projectPath, "created.txt"), "created by agent\n", "utf8");
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_paused_discard", {
    type: "file.change",
    path: "tracked.txt",
    kind: "update",
    summary: "update tracked.txt",
    timestamp: new Date().toISOString()
  });
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_paused_discard", {
    type: "file.change",
    path: "created.txt",
    kind: "create",
    summary: "create created.txt",
    timestamp: new Date().toISOString()
  });

  await writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      status: "in_progress",
      authoringState: "ready",
      codexThreadId: "thread_paused_discard",
      runStatus: "paused",
      lastRunId: runId,
      lastRunStartedAt: new Date().toISOString()
    }
  });

  const discarded = await cancelCodexRun({ projectPath, ticketId: ticket.frontMatter.id, runId, revertChanges: true });
  assert.equal(discarded.outcome, "discarded");
  assert.match(discarded.revertMessage ?? "", /^Reverted run file changes/);

  const cancelled = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(cancelled.frontMatter.runStatus, "idle");
  assert.equal(cancelled.frontMatter.status, "todo");
  assert.equal(cancelled.frontMatter.codexThreadId, null);
  assert.equal(cancelled.frontMatter.lastRunId, null);
  assert.equal(await readFile(path.join(projectPath, "tracked.txt"), "utf8"), "tracked baseline\n");
  await assert.rejects(access(path.join(projectPath, "created.txt")));
});

test("codex run cancellation reconciles stale implementation state after restart", async () => {
  const projectPath = await createProject();
  await allowNonGitRuns(projectPath);
  const ticket = await createImplementationTicket(projectPath, {
    title: "Stale implementation run",
    priority: "medium",
    labels: ["codex"],
    markdown: "# Stale implementation run\n"
  });

  await writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      status: "in_progress",
      authoringState: "ready",
      codexThreadId: "thread_stale_impl",
      runStatus: "running",
      lastRunId: "run_stale_impl",
      lastRunStartedAt: new Date().toISOString()
    }
  });

  await cancelCodexRun({ projectPath, ticketId: ticket.frontMatter.id, runId: "run_stale_impl" });

  const cancelled = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(cancelled.frontMatter.runStatus, "paused");
  assert.equal(cancelled.frontMatter.status, "in_progress");

  const preflight = await preflightCodexRun({ projectPath, ticketId: ticket.frontMatter.id });
  assert.equal(preflight.ok, false);
  assert.match(preflight.errors.join(" "), /paused or failed implementation work/);

  const events = await readCodexRunEvents(projectPath, ticket.frontMatter.id, "run_stale_impl");
  const terminal = events.find((event) => event.type === "run.failed");
  assert.equal(terminal?.type, "run.failed");
  if (terminal?.type === "run.failed") {
    assert.equal(terminal.finalStatus, "paused");
    assert.match(terminal.message, /Stale Codex implementation run paused/);
  }
});

test("codex run cancellation reconciles stale draft state after restart", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Pending stale draft",
    priority: "medium",
    labels: [],
    markdown: "# Pending stale draft\n"
  });

  await writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      authoringState: "drafting",
      runStatus: "drafting",
      lastRunId: "run_stale_draft",
      lastRunStartedAt: new Date().toISOString()
    }
  });

  await cancelCodexRun({ projectPath, ticketId: ticket.frontMatter.id, runId: "run_stale_draft" });

  const cancelled = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(cancelled.frontMatter.runStatus, "cancelled");
  assert.equal(cancelled.frontMatter.authoringState, "rough");

  const events = await readCodexRunEvents(projectPath, ticket.frontMatter.id, "run_stale_draft");
  const terminal = events.find((event) => event.type === "run.failed");
  assert.equal(terminal?.type, "run.failed");
  if (terminal?.type === "run.failed") {
    assert.equal(terminal.finalStatus, "cancelled");
    assert.match(terminal.message, /Stale ticket draft run cancelled/);
  }
});

const runGit = async (projectPath: string, ...args: string[]): Promise<void> => {
  await promisify(execFile)("git", args, { cwd: projectPath });
};

test("run git revert restores only run-touched tracked files and deletes run-created files", async () => {
  const projectPath = await createProject();
  await runGit(projectPath, "-c", "core.hooksPath=/dev/null", "init");
  await runGit(projectPath, "config", "user.email", "relay@test.local");
  await runGit(projectPath, "config", "user.name", "Relay Test");
  await writeFile(path.join(projectPath, "README.md"), "# baseline\n", "utf8");
  await writeFile(path.join(projectPath, "tracked.txt"), "tracked baseline\n", "utf8");
  await runGit(projectPath, "add", "README.md", "tracked.txt");
  await runGit(projectPath, "commit", "-m", "baseline");

  const ticket = await createTicket(projectPath, {
    title: "Git revert",
    priority: "medium",
    labels: ["git"],
    markdown: "# Git revert\n"
  });
  const runId = "run_git_revert_test";
  const baseline = await captureRunGitBaseline(projectPath, ticket.frontMatter.id, runId);
  assert.ok(baseline);
  assert.equal(baseline.changedPathsAtStart.includes("tracked.txt"), false);
  assert.equal(baseline.changedPathsAtStart.includes("agent-change.txt"), false);

  await writeFile(path.join(projectPath, "tracked.txt"), "tracked agent edit\n", "utf8");
  await writeFile(path.join(projectPath, "agent-change.txt"), "from agent\n", "utf8");
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_git_revert_test", {
    type: "file.change",
    path: "tracked.txt",
    kind: "update",
    summary: "update tracked.txt",
    timestamp: new Date().toISOString()
  });
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_git_revert_test", {
    type: "file.change",
    path: "agent-change.txt",
    kind: "create",
    summary: "create agent-change.txt",
    timestamp: new Date().toISOString()
  });

  const revert = await revertRunGitChanges(projectPath, ticket.frontMatter.id, runId);
  assert.equal(revert.reverted, true);
  assert.match(revert.message, /Reverted run file changes/);
  assert.match(revert.message, /1 tracked file\(s\) restored/);
  assert.match(revert.message, /1 new file\(s\) deleted/);
  assert.match(revert.message, /0 path\(s\) skipped/);

  await assert.rejects(access(path.join(projectPath, "agent-change.txt")));
  assert.equal(await readFile(path.join(projectPath, "tracked.txt"), "utf8"), "tracked baseline\n");
  assert.equal(await readFile(path.join(projectPath, "README.md"), "utf8"), "# baseline\n");

  const persisted = await readRunGitBaseline(projectPath, ticket.frontMatter.id, runId);
  assert.deepEqual(persisted?.touchedPaths, ["agent-change.txt", "tracked.txt"]);
  assert.deepEqual(persisted?.createdPaths, ["agent-change.txt"]);
  assert.deepEqual(persisted?.skippedPaths, []);
  await access(path.join(projectPath, ".relay", "runs", ticket.frontMatter.id, `${runId}-change-log.json`));
});

test("run git revert skips dirty-at-start overlaps and reports warnings", async () => {
  const projectPath = await createProject();
  await runGit(projectPath, "-c", "core.hooksPath=/dev/null", "init");
  await runGit(projectPath, "config", "user.email", "relay@test.local");
  await runGit(projectPath, "config", "user.name", "Relay Test");
  await writeFile(path.join(projectPath, "dirty.txt"), "baseline dirty\n", "utf8");
  await writeFile(path.join(projectPath, "clean.txt"), "baseline clean\n", "utf8");
  await runGit(projectPath, "add", "dirty.txt", "clean.txt");
  await runGit(projectPath, "commit", "-m", "baseline");

  await writeFile(path.join(projectPath, "dirty.txt"), "user local edits\n", "utf8");

  const ticket = await createTicket(projectPath, {
    title: "Git revert dirty overlap",
    priority: "medium",
    labels: ["git"],
    markdown: "# Git revert dirty overlap\n"
  });
  const runId = "run_git_revert_dirty_overlap";
  const baseline = await captureRunGitBaseline(projectPath, ticket.frontMatter.id, runId);
  assert.ok(baseline);
  assert.equal(baseline.changedPathsAtStart.includes("dirty.txt"), true);

  await writeFile(path.join(projectPath, "dirty.txt"), "agent overwrote dirty file\n", "utf8");
  await writeFile(path.join(projectPath, "clean.txt"), "agent changed clean file\n", "utf8");
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_git_revert_dirty_overlap", {
    type: "file.change",
    path: "dirty.txt",
    kind: "update",
    summary: "update dirty.txt",
    timestamp: new Date().toISOString()
  });
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_git_revert_dirty_overlap", {
    type: "file.change",
    path: "clean.txt",
    kind: "update",
    summary: "update clean.txt",
    timestamp: new Date().toISOString()
  });

  const revert = await revertRunGitChanges(projectPath, ticket.frontMatter.id, runId);
  assert.equal(revert.reverted, true);
  assert.match(revert.message, /with warnings/);
  assert.match(revert.message, /1 tracked file\(s\) restored/);
  assert.match(revert.message, /0 new file\(s\) deleted/);
  assert.match(revert.message, /1 path\(s\) skipped/);

  assert.equal(await readFile(path.join(projectPath, "clean.txt"), "utf8"), "baseline clean\n");
  assert.equal(await readFile(path.join(projectPath, "dirty.txt"), "utf8"), "agent overwrote dirty file\n");

  const persisted = await readRunGitBaseline(projectPath, ticket.frontMatter.id, runId);
  assert.deepEqual(persisted?.createdPaths, []);
  assert.deepEqual(persisted?.skippedPaths, [{ path: "dirty.txt", reason: "Path was already dirty when the run started." }]);
});

test("cancelCodexRun with revertChanges returns the selective rollback summary", async () => {
  const projectPath = await createProject();
  await runGit(projectPath, "-c", "core.hooksPath=/dev/null", "init");
  await runGit(projectPath, "config", "user.email", "relay@test.local");
  await runGit(projectPath, "config", "user.name", "Relay Test");
  await writeFile(path.join(projectPath, "tracked.txt"), "tracked baseline\n", "utf8");
  await runGit(projectPath, "add", "tracked.txt");
  await runGit(projectPath, "commit", "-m", "baseline");

  const ticket = await createTicket(projectPath, {
    title: "Cancel revert summary",
    priority: "medium",
    labels: ["git"],
    markdown: "# Cancel revert summary\n"
  });
  const runId = "run_cancel_revert_summary";
  await captureRunGitBaseline(projectPath, ticket.frontMatter.id, runId);
  await writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      status: "in_progress",
      authoringState: "ready",
      codexThreadId: "thread_cancel_revert_summary",
      runStatus: "running",
      lastRunId: runId,
      lastRunStartedAt: new Date().toISOString()
    }
  });

  await writeFile(path.join(projectPath, "tracked.txt"), "tracked agent edit\n", "utf8");
  await writeFile(path.join(projectPath, "created.txt"), "created by agent\n", "utf8");
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_cancel_revert_summary", {
    type: "file.change",
    path: "tracked.txt",
    kind: "update",
    summary: "update tracked.txt",
    timestamp: new Date().toISOString()
  });
  await writeRunLog(projectPath, ticket.frontMatter.id, runId, "thread_cancel_revert_summary", {
    type: "file.change",
    path: "created.txt",
    kind: "create",
    summary: "create created.txt",
    timestamp: new Date().toISOString()
  });

  const result = await cancelCodexRun({
    projectPath,
    ticketId: ticket.frontMatter.id,
    runId,
    revertChanges: true
  });

  assert.match(result.revertMessage ?? "", /^Reverted run file changes/);
  assert.match(result.revertMessage ?? "", /1 tracked file\(s\) restored/);
  assert.match(result.revertMessage ?? "", /1 new file\(s\) deleted/);
  assert.match(result.revertMessage ?? "", /0 path\(s\) skipped/);
  assert.equal(await readFile(path.join(projectPath, "tracked.txt"), "utf8"), "tracked baseline\n");
  await assert.rejects(access(path.join(projectPath, "created.txt")));
});

test("clarification questions and answers persist with auditable events", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Clarification flow",
    priority: "high",
    labels: ["clarification"],
    markdown: "# Clarification flow\n"
  });

  await transitionTicketStatus(projectPath, ticket.frontMatter.id, "needs_clarification", {
    actor: "codex",
    source: "agent_execution",
    runId: "run_clarification"
  });
  const questions = await createClarificationQuestions(
    projectPath,
    ticket.frontMatter.id,
    [{ question: "Which datastore should this use?" }],
    {
      actor: "codex",
      source: "agent_execution",
      runId: "run_clarification",
      codexThreadId: "thread_clarification"
    }
  );

  assert.equal((await readBoard(projectPath)).tickets.find((item) => item.id === ticket.frontMatter.id)?.status, "needs_clarification");
  assert.equal(questions.length, 1);
  assert.equal(questions[0].answer, null);

  const answered = await answerClarificationQuestion(projectPath, ticket.frontMatter.id, questions[0].id, "Use SQLite.");
  assert.equal(answered.answer, "Use SQLite.");
  assert.ok(answered.answeredAt);
  assert.equal((await readClarificationQuestions(projectPath, ticket.frontMatter.id))[0].answer, "Use SQLite.");

  const events = await auditEvents(projectPath);
  assert.deepEqual(
    events.map((event) => event.eventType),
    ["ticket.status_changed", "clarification.question_created", "clarification.answer_submitted"]
  );
});

test("transitionTicketStatus allows feature and epic review and completed moves but rejects todo", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Container feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Container feature\n"
  });

  await transitionTicketStatus(projectPath, feature.frontMatter.id, "review", {
    actor: "user",
    source: "manual_board"
  });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "review");

  await transitionTicketStatus(projectPath, feature.frontMatter.id, "completed", {
    actor: "user",
    source: "manual_board"
  });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "completed");

  await assert.rejects(
    () =>
      transitionTicketStatus(projectPath, feature.frontMatter.id, "todo", {
        actor: "user",
        source: "manual_board"
      }),
    /can only move to Review, Completed, or Archive/
  );

  await assert.rejects(
    () =>
      transitionTicketStatus(projectPath, feature.frontMatter.id, "ready", {
        actor: "user",
        source: "manual_board"
      }),
    /can only move to Review, Completed, or Archive/
  );
});

test("moveTicket suppresses container reconciliation during bulk accept of review tasks", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Bulk accept feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Bulk accept feature\n"
  });
  const firstTask = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "First review task", priority: "medium" }
  });
  const secondTask = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "Second review task", priority: "medium" }
  });

  for (const task of [firstTask, secondTask]) {
    await transitionTicketStatus(projectPath, task.frontMatter.id, "review", {
      actor: "user",
      source: "manual_board"
    });
  }
  await transitionTicketStatus(projectPath, feature.frontMatter.id, "review", {
    actor: "user",
    source: "manual_board"
  });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "review");

  await moveTicket({
    projectPath,
    ticketId: firstTask.frontMatter.id,
    targetStatus: RELAY_COMPLETED_STATUS,
    suppressContainerReconciliation: true
  });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "review");

  await moveTicket({
    projectPath,
    ticketId: secondTask.frontMatter.id,
    targetStatus: RELAY_COMPLETED_STATUS,
    suppressContainerReconciliation: true
  });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "review");

  await moveTicket({
    projectPath,
    ticketId: feature.frontMatter.id,
    targetStatus: RELAY_COMPLETED_STATUS
  });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, RELAY_COMPLETED_STATUS);
  assert.equal((await readTicket(projectPath, firstTask.frontMatter.id)).frontMatter.status, RELAY_COMPLETED_STATUS);
  assert.equal((await readTicket(projectPath, secondTask.frontMatter.id)).frontMatter.status, RELAY_COMPLETED_STATUS);
});

test("moveTicket promotes feature to review when last linked task completes and demotes on reopen", async () => {
  const projectPath = await createProject();
  const feature = await createTicket(projectPath, {
    title: "Review gate feature",
    ticketType: "feature",
    priority: "medium",
    labels: [],
    markdown: "# Review gate feature\n"
  });
  const firstTask = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "First task", priority: "medium" }
  });
  const secondTask = await createTaskUnderFeature({
    projectPath,
    featureId: feature.frontMatter.id,
    input: { title: "Second task", priority: "medium" }
  });

  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "todo");

  await moveTicket({ projectPath, ticketId: firstTask.frontMatter.id, targetStatus: "completed" });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "todo");

  await moveTicket({ projectPath, ticketId: secondTask.frontMatter.id, targetStatus: "completed" });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "review");

  await moveTicket({ projectPath, ticketId: secondTask.frontMatter.id, targetStatus: "todo" });
  assert.equal((await readTicket(projectPath, feature.frontMatter.id)).frontMatter.status, "todo");
});

const flushArchiveQueue = async (
  projectPath: string,
  ticketIds: readonly string[],
  dependencies: TicketUpdateDependencies,
  timeoutMs = 15_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await reconcileSchedulableReadyTickets(projectPath, dependencies);
    await drainProjectSchedulerForProject(projectPath);
    const board = await readBoard(projectPath);
    const pending = ticketIds.filter((ticketId) => {
      const summary = board.tickets.find((ticket) => ticket.id === ticketId);
      return summary?.status !== RELAY_ARCHIVE_STATUS;
    });
    if (pending.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Archive queue did not finish before timeout.");
};

const waitForArchivedStatuses = async (
  projectPath: string,
  ticketIds: readonly string[],
  timeoutMs = 5_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const board = await readBoard(projectPath);
    const pending = ticketIds.filter((ticketId) => {
      const summary = board.tickets.find((ticket) => ticket.id === ticketId);
      return summary?.status !== RELAY_ARCHIVE_STATUS;
    });
    if (pending.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Archive queue did not settle before timeout.");
};

test("archiveTicketBundle queues completed tickets on Ready with the archive-queue label", async () => {
  const projectPath = await createProjectWithAgentConcurrency(1);
  const { taskId } = await seedCompletedArchiveBundle(projectPath);
  const { dependencies, archivedOrder, events } = createArchiveBundleDependencies([taskId]);
  await archiveTicketBundle(projectPath, [taskId], dependencies);
  const record = await readTicket(projectPath, taskId);
  assert.equal(record.frontMatter.status, RELAY_READY_STATUS);
  assert.equal(record.frontMatter.labels.includes(PENDING_ARCHIVE_LABEL), true);
  await flushArchiveQueue(projectPath, [taskId], dependencies);
  assert.deepEqual(archivedOrder, [taskId]);
  assert.equal((await readTicket(projectPath, taskId)).frontMatter.status, RELAY_ARCHIVE_STATUS);
  assert.ok(
    events.some(
      (event) =>
        event.type === "ticket.status_changed" &&
        event.ticketId === taskId &&
        event.toStatus === RELAY_ARCHIVE_STATUS
    )
  );
  assert.ok(events.some((event) => event.type === "run.completed" && event.ticketId === taskId));
});

test("archiveTicketBundle drains a completed hierarchy through the ready queue", async () => {
  const projectPath = await createProjectWithAgentConcurrency(1);
  const { epicId, featureId, taskId } = await seedCompletedArchiveBundle(projectPath);
  const boardBeforeArchive = await readBoard(projectPath);
  const sortedBundleIds = sortArchiveBundleIds([epicId, featureId, taskId], boardBeforeArchive.tickets);
  const { dependencies, archivedOrder } = createArchiveBundleDependencies(sortedBundleIds);
  await archiveTicketBundle(projectPath, sortedBundleIds, dependencies);
  await flushArchiveQueue(projectPath, sortedBundleIds, dependencies);
  assert.deepEqual(archivedOrder, sortedBundleIds);
  for (const archivedId of sortedBundleIds) {
    assert.equal((await readTicket(projectPath, archivedId)).frontMatter.status, RELAY_ARCHIVE_STATUS);
  }
});

test("archiveTicketBundle wakes the scheduler to continue draining queued archive work", async () => {
  const projectPath = await createProjectWithAgentConcurrency(1);
  const { epicId, featureId, taskId } = await seedCompletedArchiveBundle(projectPath);
  const boardBeforeArchive = await readBoard(projectPath);
  const sortedBundleIds = sortArchiveBundleIds([epicId, featureId, taskId], boardBeforeArchive.tickets);
  const { dependencies, archivedOrder } = createArchiveBundleDependencies(sortedBundleIds);
  await archiveTicketBundle(projectPath, sortedBundleIds, dependencies);

  await reconcileSchedulableReadyTickets(projectPath, dependencies);
  await drainProjectSchedulerForProject(projectPath);
  await waitForArchivedStatuses(projectPath, sortedBundleIds);

  assert.deepEqual(archivedOrder, sortedBundleIds);
  for (const archivedId of sortedBundleIds) {
    const archived = await readTicket(projectPath, archivedId);
    assert.equal(archived.frontMatter.status, RELAY_ARCHIVE_STATUS);
    assert.equal(archived.frontMatter.runStatus, "idle");
    assert.equal(archived.frontMatter.lastRunId, null);
  }
});

test("reconcileSchedulableReadyTickets clears stale queued state from archived tickets", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Stale archived ticket",
    priority: "low",
    labels: [PENDING_ARCHIVE_LABEL],
    status: RELAY_ARCHIVE_STATUS,
    markdown: "# Stale archived ticket\n"
  });
  await writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      status: RELAY_ARCHIVE_STATUS,
      labels: [PENDING_ARCHIVE_LABEL],
      runStatus: "queued",
      lastRunId: "run_stale_archive",
      lastRunStartedAt: "2026-05-25T00:00:00.000Z"
    }
  });

  await reconcileSchedulableReadyTickets(projectPath);

  const normalized = await readTicket(projectPath, ticket.frontMatter.id);
  assert.equal(normalized.frontMatter.status, RELAY_ARCHIVE_STATUS);
  assert.equal(normalized.frontMatter.runStatus, "idle");
  assert.equal(normalized.frontMatter.lastRunId, null);
  assert.equal(normalized.frontMatter.lastRunStartedAt, null);
  assert.equal(normalized.frontMatter.labels.includes(PENDING_ARCHIVE_LABEL), false);
});

test("POST /api/tickets/archive archives a completed bundle bottom-up and returns TicketArchiveResult", async (t) => {
  const projectPath = await createProject();
  const { epicId, featureId, taskId } = await seedCompletedArchiveBundle(projectPath);
  const boardBeforeArchive = await readBoard(projectPath);
  const sortedBundleIds = sortArchiveBundleIds([epicId, featureId, taskId], boardBeforeArchive.tickets);
  const { dependencies, archivedOrder } = createArchiveBundleDependencies(sortedBundleIds);
  const api = await startTestArchiveApi(t, [createArchiveTicketRoute(dependencies)]);
  if (!api) return;

  try {
    const response = await fetch(`${api.baseUrl}/api/tickets/archive`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        projectPath,
        ticketIds: [epicId, taskId, featureId]
      })
    });

    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      ticket: { frontMatter: { id: string; status: string; runStatus: string; labels: string[] } };
      board: {
        columns: Array<{ id: string }>;
        tickets: Array<{ id: string; status: string; runStatus: string; labels: string[] }>;
      };
    };

    assert.equal(result.ticket.frontMatter.id, epicId);
    assert.equal(result.ticket.frontMatter.status, RELAY_READY_STATUS);
    assert.equal(result.ticket.frontMatter.runStatus, "queued");

    for (const queuedId of sortedBundleIds) {
      const summary = result.board.tickets.find((ticket) => ticket.id === queuedId);
      assert.equal(summary?.status, RELAY_READY_STATUS, `${queuedId} should move to Ready when queued for archive`);
      assert.equal(summary?.runStatus, "queued");
      const record = await readTicket(projectPath, queuedId);
      assert.equal(record.frontMatter.labels.includes(PENDING_ARCHIVE_LABEL), true);
    }

    await flushArchiveQueue(projectPath, sortedBundleIds, dependencies);

    assert.deepEqual(archivedOrder, sortedBundleIds);
    assert.deepEqual(sortedBundleIds, [taskId, featureId, epicId]);

    const boardAfterArchive = await readBoard(projectPath);
    const visibleColumnIds = new Set(boardVisibleColumns(boardAfterArchive.columns).map((column) => column.id));
    for (const archivedId of sortedBundleIds) {
      const summary = boardAfterArchive.tickets.find((ticket) => ticket.id === archivedId);
      assert.equal(summary?.status, RELAY_ARCHIVE_STATUS);
      assert.equal(visibleColumnIds.has(RELAY_ARCHIVE_STATUS), false);
      assert.equal((await readTicket(projectPath, archivedId)).frontMatter.status, RELAY_ARCHIVE_STATUS);
    }
  } finally {
    await api.close();
  }
});

test("POST /api/tickets/archive rejects non-completed tickets before archiving", async (t) => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Todo archive guard",
    priority: "low",
    labels: [],
    markdown: "# Todo archive guard\n",
    status: "todo"
  });
  const archiveRoute = ticketRoutes.find(
    (entry) => entry.endpoint.path === ticketEndpoints.archive.path && entry.endpoint.method === "POST"
  );
  assert.ok(archiveRoute);

  const api = await startTestArchiveApi(t, [archiveRoute]);
  if (!api) return;

  try {
    const response = await fetch(`${api.baseUrl}/api/tickets/archive`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        projectPath,
        ticketIds: [ticket.frontMatter.id]
      })
    });

    assert.equal(response.status, 500);
    const body = (await response.json()) as { error: { message: string } };
    assert.match(body.error.message, /Only completed tickets can be archived/);
    assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.status, "todo");
  } finally {
    await api.close();
  }
});
