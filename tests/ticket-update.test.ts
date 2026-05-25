import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import {
  cancelTicketUpdateRun,
  startTicketUpdateRun,
  type TicketUpdateCodexClient,
  type TicketUpdateDependencies,
  type TicketUpdateThread
} from "../src/services/codex";
import {
  createClarificationQuestions,
  createTicket,
  initializeProject,
  readClarificationQuestions,
  readProjectConfig,
  readTicket,
  writeProjectConfig
} from "../src/storage";
import { BackendWorkLive, WorkEngine } from "../src/services/work";
import { runBackendEffect } from "../src/runtime";
import type { AgentTicketUpdate, RendererRunEvent } from "../src/shared/schemas";

const createProject = async (): Promise<string> => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "relay-ticket-update-"));
  await initializeProject(projectPath);
  return projectPath;
};

const createFakeRunEventSink = (): { runEventSink: NonNullable<TicketUpdateDependencies["runEventSink"]>; events: RendererRunEvent[] } => {
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

type TicketUpdateThreadOptions = Parameters<TicketUpdateCodexClient["startThread"]>[0];
type TicketUpdateRunOptions = NonNullable<Parameters<TicketUpdateThread["run"]>[1]> & { signal: AbortSignal };
type TicketUpdateRunMock = (
  prompt: string,
  options: TicketUpdateRunOptions
) => Promise<{ items: []; usage: null; finalResponse: string }>;

const createTicketUpdateCodexClient = (
  threadId: string,
  run: TicketUpdateRunMock,
  onStartThread?: (options: TicketUpdateThreadOptions) => void
): TicketUpdateCodexClient => ({
  startThread: (options) => {
    onStartThread?.(options);
    return {
      id: threadId,
      run: async (input, runOptions) => {
        if (typeof input !== "string") throw new TypeError("Ticket update tests expect string prompts.");
        if (!runOptions?.signal) throw new TypeError("Ticket update tests expect an AbortSignal.");
        return run(input, { ...runOptions, signal: runOptions.signal });
      }
    };
  }
});

const waitFor = async (predicate: () => boolean | Promise<boolean>, label: string): Promise<void> => {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`Timed out waiting for ${label}`);
};

const assertStrictSchemaRequiresAllProperties = (schema: unknown, label = "$"): void => {
  if (!schema || typeof schema !== "object") return;
  const objectSchema = schema as { properties?: Record<string, unknown>; required?: unknown; items?: unknown };
  if (objectSchema.properties) {
    assert.ok(Array.isArray(objectSchema.required), `${label}.required must be an array`);
    const required = new Set(objectSchema.required);
    for (const key of Object.keys(objectSchema.properties)) {
      assert.ok(required.has(key), `${label}.required is missing ${key}`);
      assertStrictSchemaRequiresAllProperties(objectSchema.properties[key], `${label}.${key}`);
    }
  }
  if (objectSchema.items) assertStrictSchemaRequiresAllProperties(objectSchema.items, `${label}[]`);
};

const updateJson = (patch: Partial<AgentTicketUpdate> = {}): string =>
  JSON.stringify({
    title: "Agent revised ticket",
    priority: "high",
    labels: ["agent", "updated"],
    authoringState: "reviewing",
    plannedFiles: null,
    patch: {
      summary: "Expanded the existing ticket with release targeting context.",
      appendMarkdown: "## Context\n\nExpanded context from the user request.\n\n## Follow-up Checklist\n\n- [ ] Confirm release target\n"
    },
    clarificationQuestions: ["Which release should this target?"],
    ...patch
  });

test("ticket update run uses a strict structured-output schema for patch fields", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Schema guard",
    priority: "medium",
    labels: [],
    markdown: "# Schema guard\n"
  });

  let outputSchema: unknown;
  const dependencies: TicketUpdateDependencies = {
    createRunId: () => "run_ticket_update_schema",
    createCodexClient: () =>
      createTicketUpdateCodexClient("thread_ticket_update_schema", async (_prompt, options) => {
        outputSchema = options.outputSchema;
        return { items: [], usage: null, finalResponse: updateJson() };
      })
  };

  await startTicketUpdateRun({ projectPath, ticketId: ticket.frontMatter.id, request: "Refine the ticket." }, dependencies);
  await waitFor(() => Boolean(outputSchema), "ticket update schema capture");

  assertStrictSchemaRequiresAllProperties(outputSchema);
  assert.ok(((outputSchema as { required?: string[] }).required ?? []).includes("plannedFiles"));
  const patchSchema = (outputSchema as { properties?: { patch?: { required?: unknown } } }).properties?.patch;
  assert.deepEqual(patchSchema?.required, ["summary", "fullMarkdown", "appendMarkdown"]);
});

test("ticket update agent applies validated structured output and preserves unrelated metadata", async () => {
  const projectPath = await createProject();
  const config = await readProjectConfig(projectPath);
  await writeProjectConfig(projectPath, {
    ...config,
    settings: {
      ...config.settings,
      codexNetworkAccessEnabled: true,
      codexWebSearchMode: "live"
    }
  });
  const ticket = await createTicket(projectPath, {
    title: "Original ticket",
    priority: "medium",
    labels: ["original"],
    markdown: "# Original ticket\n\n## Context\n\nOriginal body.\n"
  });
  const original = await readTicket(projectPath, ticket.frontMatter.id);
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedPrompt = "";
  let capturedOptions: Partial<TicketUpdateThreadOptions> = {};

  const dependencies: TicketUpdateDependencies = {
    runEventSink,
    createRunId: () => "run_ticket_update_success",
    createCodexClient: () =>
      createTicketUpdateCodexClient(
        "thread_ticket_update_success",
        async (prompt, options) => {
          capturedPrompt = prompt;
          assert.equal(options.signal?.aborted, false);
          return { items: [], usage: null, finalResponse: updateJson() };
        },
        (options) => {
          capturedOptions = options;
        }
      )
  };

  await startTicketUpdateRun({ projectPath, ticketId: ticket.frontMatter.id, request: "Add release targeting detail." }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.completed"), "ticket update completion");

  const updated = await readTicket(projectPath, ticket.frontMatter.id);
  assert.match(capturedPrompt, /Add release targeting detail/);
  assert.match(capturedPrompt, /Original body/);
  assert.equal(capturedOptions.sandboxMode, "read-only");
  assert.equal(capturedOptions.approvalPolicy, "never");
  assert.equal(capturedOptions.networkAccessEnabled, false);
  assert.equal(capturedOptions.webSearchMode, "disabled");
  assert.equal(updated.frontMatter.id, original.frontMatter.id);
  assert.equal(updated.frontMatter.status, original.frontMatter.status);
  assert.equal(updated.frontMatter.position, original.frontMatter.position);
  assert.equal(updated.frontMatter.createdAt, original.frontMatter.createdAt);
  assert.equal(updated.frontMatter.codexThreadId, original.frontMatter.codexThreadId);
  assert.equal(updated.frontMatter.runStatus, original.frontMatter.runStatus);
  assert.equal(updated.frontMatter.lastRunId, original.frontMatter.lastRunId);
  assert.equal(updated.frontMatter.title, "Agent revised ticket");
  assert.equal(updated.frontMatter.priority, "high");
  assert.equal(updated.frontMatter.authoringState, "needs_input");
  assert.deepEqual(updated.frontMatter.labels, ["agent", "updated"]);
  assert.match(updated.markdown, /Original body/);
  assert.match(updated.markdown, /Agent Refinement/);
  assert.match(updated.markdown, /Expanded context/);
  assert.deepEqual(updated.checklist, { total: 1, completed: 0, open: 1 });

  const clarifications = await readClarificationQuestions(projectPath, ticket.frontMatter.id);
  assert.equal(clarifications.length, 1);
  assert.equal(clarifications[0].question, "Which release should this target?");
  assert.equal(clarifications[0].createdBy, "codex");
  assert.equal(clarifications[0].source, "manual_ticket_edit");
});

test("ticket update agent leaves the ticket unchanged when output validation fails", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Invalid output guard",
    priority: "low",
    labels: ["keep"],
    markdown: "# Invalid output guard\n\nDo not mutate this body.\n"
  });
  const original = await readTicket(projectPath, ticket.frontMatter.id);
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: TicketUpdateDependencies = {
    runEventSink,
    createRunId: () => "run_ticket_update_invalid",
    createCodexClient: () =>
      createTicketUpdateCodexClient("thread_ticket_update_invalid", async () => ({
        items: [],
        usage: null,
        finalResponse: updateJson({ title: "" })
      }))
  };

  await startTicketUpdateRun({ projectPath, ticketId: ticket.frontMatter.id, request: "Break the schema." }, dependencies);
  await waitFor(() => events.some((event) => event.type === "run.failed"), "ticket update failure");

  const unchanged = await readTicket(projectPath, ticket.frontMatter.id);
  assert.deepEqual(unchanged.frontMatter, original.frontMatter);
  assert.equal(unchanged.markdown, original.markdown);
  assert.deepEqual(await readClarificationQuestions(projectPath, ticket.frontMatter.id), []);
  assert.match(events.find((event) => event.type === "run.failed")?.message ?? "", /invalid/i);
});

test("ticket update runs use the provider selected when work starts", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Provider-selected update",
    priority: "medium",
    labels: ["original"],
    markdown: "# Provider-selected update\n"
  });
  let selectedProviderId: "cursor" | "claude" = "cursor";
  let capturedProviderId = "";
  const dependencies: TicketUpdateDependencies = {
    createRunId: () => "run_ticket_update_provider_selected",
    readSelectedProviderId: async () => selectedProviderId,
    createAgentProvider: async (providerId) => {
      capturedProviderId = providerId;
      return {
        providerId,
        runStructured: async <T = unknown>() =>
          ({
            providerId,
            rawResponse: updateJson(),
            output: JSON.parse(updateJson()) as T,
            providerSessionRef: { providerId, externalId: `${providerId}-session-1` }
          }),
        runText: async () => {
          throw new Error("repository chat is not part of this test");
        }
      };
    }
  };

  const started = await startTicketUpdateRun(
    { projectPath, ticketId: ticket.frontMatter.id, request: "Refine this ticket." },
    dependencies
  );
  selectedProviderId = "claude";
  await waitFor(
    async () =>
      (
        await runBackendEffect(
          Effect.provide(WorkEngine.use((engine) => engine.findByRunId(projectPath, started.runId)), BackendWorkLive)
        )
      )?.currentAttempt?.providerId === "cursor",
    "provider-selected update work provider"
  );
  const snapshot = await runBackendEffect(
    Effect.provide(WorkEngine.use((engine) => engine.findByRunId(projectPath, started.runId)), BackendWorkLive)
  );

  assert.equal(capturedProviderId, "cursor");
  assert.equal(snapshot?.currentAttempt?.providerId, "cursor");
});

test("scope recovery ticket updates include approved paths and persist merged plannedFiles on the same task", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Scope recovery",
    priority: "medium",
    labels: ["scoped"],
    markdown: "# Scope recovery\n\nOriginal body.\n",
    plannedFiles: ["src/http/resources/tickets.ts"],
    status: "needs_clarification",
    runStatus: "blocked",
    authoringState: "needs_input"
  });
  await createClarificationQuestions(
    projectPath,
    ticket.frontMatter.id,
    [
      {
        question: `Codex attempted to modify file paths outside this ticket's planned scope, so Relay reverted the run.

Please confirm whether implementation should expand the planned file scope to include:
- ${path.join(projectPath, "src/shared/plannedScope.ts")}

Current planned scope:
- src/http/resources/tickets.ts`
      }
    ],
    {
      actor: "codex",
      source: "agent_execution",
      runId: "run_scope_blocked",
      codexThreadId: "thread_scope_blocked"
    }
  );
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedPrompt = "";

  const dependencies: TicketUpdateDependencies = {
    runEventSink,
    createRunId: () => "run_ticket_update_scope_recovery",
    reconcileTicketQueueState: async () => readTicket(projectPath, ticket.frontMatter.id),
    createCodexClient: () =>
      createTicketUpdateCodexClient("thread_ticket_update_scope_recovery", async (prompt) => {
        capturedPrompt = prompt;
        return {
          items: [],
          usage: null,
          finalResponse: updateJson({
            authoringState: "ready",
            plannedFiles: ["src/http/resources/tickets.ts", "src/shared/plannedScope.ts"],
            clarificationQuestions: [],
            patch: {
              summary: "Merged approved scope.",
              appendMarkdown: "## Implementation Plan\n\n- [ ] Expand planned scope safely.\n",
              fullMarkdown: null
            }
          })
        };
      })
  };

  await startTicketUpdateRun(
    {
      projectPath,
      ticketId: ticket.frontMatter.id,
      request: "Recover blocked task scope.",
      purpose: "scope_recovery",
      clarificationQuestionId: (await readClarificationQuestions(projectPath, ticket.frontMatter.id))[0]?.id ?? ""
    },
    dependencies
  );
  await waitFor(() => events.some((event) => event.type === "run.completed"), "scope recovery completion");

  const updated = await readTicket(projectPath, ticket.frontMatter.id);
  assert.match(capturedPrompt, /plannedFiles: REQUIRED/);
  assert.match(capturedPrompt, /recovering blocked implementation scope/i);
  assert.equal(updated.frontMatter.status, "ready");
  assert.equal(updated.frontMatter.runStatus, "idle");
  assert.deepEqual(updated.frontMatter.plannedFiles, ["src/http/resources/tickets.ts", "src/shared/plannedScope.ts"]);
});

test("scope recovery ticket updates reject empty plannedFiles persistence", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Scope recovery invalid",
    priority: "medium",
    labels: [],
    markdown: "# Scope recovery invalid\n",
    plannedFiles: [],
    status: "needs_clarification",
    runStatus: "blocked",
    authoringState: "needs_input"
  });
  await createClarificationQuestions(
    projectPath,
    ticket.frontMatter.id,
    [
      {
        question: `Codex attempted to modify file paths outside this ticket's planned scope, so Relay reverted the run.

Please confirm whether implementation should expand the planned file scope to include:
- ${path.join(projectPath, "src/shared/plannedScope.ts")}

Current planned scope:
- None recorded.`
      }
    ],
    {
      actor: "codex",
      source: "agent_execution",
      runId: "run_scope_invalid",
      codexThreadId: "thread_scope_invalid"
    }
  );
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: TicketUpdateDependencies = {
    runEventSink,
    createRunId: () => "run_ticket_update_scope_invalid",
    createCodexClient: () =>
      createTicketUpdateCodexClient("thread_ticket_update_scope_invalid", async () => ({
        items: [],
        usage: null,
        finalResponse: updateJson({
          authoringState: "ready",
          plannedFiles: [],
          clarificationQuestions: [],
          patch: {
            summary: "Tried to clear scope.",
            appendMarkdown: "## Notes\n\nInvalid scope.\n",
            fullMarkdown: null
          }
        })
      }))
  };

  await startTicketUpdateRun(
    {
      projectPath,
      ticketId: ticket.frontMatter.id,
      request: "Recover blocked task scope.",
      purpose: "scope_recovery",
      clarificationQuestionId: (await readClarificationQuestions(projectPath, ticket.frontMatter.id))[0]?.id ?? ""
    },
    dependencies
  );
  await waitFor(() => events.some((event) => event.type === "run.failed"), "scope recovery failure");
  assert.match(events.find((event) => event.type === "run.failed")?.message ?? "", /non-empty planned file scope/i);
});

test("archive ticket update persists lean fullMarkdown, summary, and archive status", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Completed archive target",
    priority: "medium",
    labels: ["done"],
    status: "completed",
    markdown: `# Completed archive target

## Context

Verbose context that should be trimmed during archive.

## Goal

Ship the archive flow.

## Requirements

- Preserve lean requirements bullets

## Acceptance Criteria

- Archive lands in the archive column
`
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let capturedPrompt = "";

  const dependencies: TicketUpdateDependencies = {
    runEventSink,
    createRunId: () => "run_ticket_update_archive_success",
    createCodexClient: () =>
      createTicketUpdateCodexClient("thread_ticket_update_archive_success", async (prompt) => {
        capturedPrompt = prompt;
        return {
          items: [],
          usage: null,
          finalResponse: updateJson({
            authoringState: "ready",
            clarificationQuestions: [],
            patch: {
              summary: "Lean archived summary for the completed task.",
              fullMarkdown: "# Completed archive target\n\n## Requirements\n\n- Preserve lean requirements bullets\n\n## Acceptance Criteria\n\n- Archive lands in the archive column\n",
              appendMarkdown: null
            }
          })
        };
      })
  };

  await startTicketUpdateRun(
    {
      projectPath,
      ticketId: ticket.frontMatter.id,
      request: "Archive this completed ticket with a lean summary.",
      purpose: "archive"
    },
    dependencies
  );
  await waitFor(() => events.some((event) => event.type === "run.completed"), "archive ticket update completion");

  const updated = await readTicket(projectPath, ticket.frontMatter.id);
  assert.match(capturedPrompt, /archiving one completed Relay ticket/i);
  assert.match(capturedPrompt, /patch\.fullMarkdown: REQUIRED/i);
  assert.match(capturedPrompt, /Remove Context and Goal sections entirely/i);
  assert.equal(updated.frontMatter.status, "archive");
  assert.equal(updated.frontMatter.summary, "Lean archived summary for the completed task.");
  assert.doesNotMatch(updated.markdown, /## Context/);
  assert.match(updated.markdown, /## Requirements/);
  assert.match(updated.markdown, /## Acceptance Criteria/);
  assert.deepEqual(await readClarificationQuestions(projectPath, ticket.frontMatter.id), []);
});

test("archive ticket updates reject non-completed tickets before the agent runs", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Todo archive guard",
    priority: "low",
    labels: [],
    markdown: "# Todo archive guard\n",
    status: "todo"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  let agentStarted = false;
  const dependencies: TicketUpdateDependencies = {
    runEventSink,
    createRunId: () => "run_ticket_update_archive_reject",
    createCodexClient: () =>
      createTicketUpdateCodexClient("thread_ticket_update_archive_reject", async () => {
        agentStarted = true;
        return { items: [], usage: null, finalResponse: updateJson() };
      })
  };

  await assert.rejects(
    startTicketUpdateRun(
      {
        projectPath,
        ticketId: ticket.frontMatter.id,
        request: "Archive this ticket.",
        purpose: "archive"
      },
      dependencies
    ),
    /Only completed tickets can be archived/
  );

  assert.equal(agentStarted, false);
  assert.equal(events.some((event) => event.type === "run.completed"), false);
  assert.equal((await readTicket(projectPath, ticket.frontMatter.id)).frontMatter.status, "todo");
});

test("ticket update agent prevents duplicate active runs for the same ticket", async () => {
  const projectPath = await createProject();
  const ticket = await createTicket(projectPath, {
    title: "Duplicate guard",
    priority: "medium",
    labels: [],
    markdown: "# Duplicate guard\n"
  });
  const { runEventSink, events } = createFakeRunEventSink();
  const dependencies: TicketUpdateDependencies = {
    runEventSink,
    createRunId: () => "run_ticket_update_duplicate",
    createCodexClient: () => createTicketUpdateCodexClient("thread_ticket_update_duplicate", async (_prompt, options) => {
      await new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
      return { items: [], usage: null, finalResponse: updateJson() };
    })
  };

  await startTicketUpdateRun({ projectPath, ticketId: ticket.frontMatter.id, request: "Keep running." }, dependencies);
  await assert.rejects(
    startTicketUpdateRun({ projectPath, ticketId: ticket.frontMatter.id, request: "Duplicate." }, dependencies),
    /already running/
  );

  await cancelTicketUpdateRun("run_ticket_update_duplicate");
  await waitFor(
    async () =>
      (
        await runBackendEffect(
          Effect.provide(WorkEngine.use((engine) => engine.findByRunId(projectPath, "run_ticket_update_duplicate")), BackendWorkLive)
        )
      )?.status === "cancelled",
    "ticket update cancellation"
  );
});
