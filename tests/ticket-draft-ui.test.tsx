import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tooltip } from "../src/renderer/src/components/ui/Tooltip";
import { Button } from "../src/renderer/src/components/ui/Button";
import {
  activeRunElapsedLabel,
  BoardView,
  canRedraftTicket,
  CliProviderSelectorModal,
  CodexCollapsedStatusIndicator,
  CodexSidebarStatus,
  CreateTicketDraftMessage,
  DraftIntakeQuestionsPanel,
  DraftingTicketDetailLoading,
  emptyColumnMessage,
  FloatingTicketComposer,
  getTicketDetailExecutionActionState,
  getContainerTicketStatusNote,
  getReviewAcceptEnabled,
  getTicketReviewActionState,
  getFloatingComposerDraftInput,
  getScopeRecoveryClarificationActionQuestionIds,
  getCodexStatusDisplay,
  getProviderInventoryDisplay,
  RepositoryChatPanelContent,
  TicketCardContent,
  TicketFullBodyPanel,
  TicketMarkdownTabs,
  TicketSummaryPreview,
  TicketDetailPrimaryClarifications,
  TicketAuthoringStatePill,
  TicketChecklistPill,
  TicketRunElapsedPill,
  TicketRunStatusPill,
  VoiceInputSetupModal
} from "../src/renderer/src/App";
import { relayQueryKeys, syncProviderInventoryAfterSwitch } from "../src/renderer/src/lib/relayQueries";
import {
  type AgentProviderInventory,
  type CodexStatus,
  DEFAULT_COLUMNS,
  type ClarificationQuestion,
  type DraftIntakeResult,
  type BoardSnapshot,
  type LocalVoiceInputStatus,
  type TicketRecord,
  type TicketSummary
} from "../src/shared/schemas";

const renderWithQueryClient = (element: ReactElement, seed?: (queryClient: QueryClient) => void): string => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  seed?.(queryClient);
  return renderToStaticMarkup(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
};

const codexStatus = (patch: Partial<CodexStatus> = {}): CodexStatus => ({
  sdkAvailable: true,
  cliAvailable: false,
  cliVersion: null,
  authenticated: null,
  message: "Checking Codex...",
  ...patch
});

const providerInventory = (patch: Partial<AgentProviderInventory> = {}): AgentProviderInventory => ({
  providers: [
    {
      id: "codex",
      label: "Codex",
      installState: "installed",
      authState: "authenticated",
      status: "ready",
      message: "Codex is available.",
      version: "codex-cli 0.130.0",
      canSelect: true,
      blockedReasonCode: null,
      blockedReasonMessage: null
    },
    {
      id: "cursor",
      label: "Cursor",
      installState: "installed",
      authState: "unknown",
      status: "unknown",
      message: "Relay could not confirm Cursor CLI status.",
      version: "cursor-cli 1.4.0",
      canSelect: false,
      blockedReasonCode: "provider_status_unknown",
      blockedReasonMessage: "Refresh Cursor status before switching."
    },
    {
      id: "claude",
      label: "Claude",
      installState: "installed",
      authState: "unauthenticated",
      status: "unauthenticated",
      message: "Claude CLI is installed but not signed in.",
      version: null,
      canSelect: false,
      blockedReasonCode: "provider_unauthenticated",
      blockedReasonMessage: "Sign in to Claude before switching."
    }
  ],
  selectedProviderId: "codex",
  switchability: {
    canSwitch: true,
    reasonCode: null,
    message: null,
    blockingWorkCount: 0
  },
  ...patch
});

const voiceInputStatus = (patch: Partial<LocalVoiceInputStatus> = {}): LocalVoiceInputStatus => ({
  available: false,
  backend: null,
  command: null,
  configuredCommandPath: null,
  defaultCommandPath: "~/whisper.cpp/build/bin/whisper-cli",
  message: "Local Whisper is not configured yet. Set the whisper.cpp CLI path to enable voice input.",
  ...patch
});

const ticketSummary = (patch: Partial<TicketSummary> = {}): TicketSummary => ({
  schemaVersion: 1,
  id: "tkt_elapsed",
  title: "Elapsed runtime",
  ticketType: "task",
  status: "in_progress",
  position: 1000,
  priority: "medium",
  effort: "medium",
  labels: [],
  parentEpicId: null,
  parentFeatureId: null,
  subticketIds: [],
  plannedFiles: [],
  blockedByIds: [],
  relatedTicketIds: [],
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
  authoringState: "ready",
  codexThreadId: null,
  runStatus: "running",
  lastRunId: "run_elapsed",
  lastRunStartedAt: "2026-05-12T10:00:00.000Z",
  excerpt: "Runtime card",
  summary: "",
  filePath: "/tmp/tkt_elapsed.md",
  checklist: { total: 0, completed: 0, open: 0 },
  ...patch
});

const clarificationQuestion = (patch: Partial<ClarificationQuestion> = {}): ClarificationQuestion => ({
  id: "clar_primary",
  ticketId: "tkt_elapsed",
  question: "Which datastore should this use?",
  answerType: "text",
  answer: null,
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
  answeredAt: null,
  createdBy: "codex",
  source: "agent_execution",
  runId: "run_elapsed",
  codexThreadId: "thread_elapsed",
  ...patch
});

const ticketRecord = (patch: Partial<TicketRecord["frontMatter"]> = {}): TicketRecord => {
  const summary = ticketSummary({ runStatus: "idle", authoringState: "rough", ...patch });
  const { excerpt: _excerpt, filePath, checklist, ...frontMatter } = summary;
  return {
    frontMatter,
    markdown: "# Elapsed runtime\n",
    filePath,
    checklist
  };
};

const boardSnapshot = (): BoardSnapshot => ({
  project: {
    projectId: "prj_ticket_draft_ui",
    name: "Relay",
    path: "/tmp/project",
    exists: true,
    isGitRepository: true,
    relayInitialized: true,
    health: "ok",
    healthMessages: [],
    activeRunCount: 0,
    swimlanes: []
  },
  config: null,
  columns: DEFAULT_COLUMNS,
  tickets: [],
  invalidTickets: []
});

test("empty column copy is status-aware for standard workflow columns", () => {
  assert.deepEqual(emptyColumnMessage("Todo"), {
    title: "No tickets to triage",
    detail: "New work appears here before it is prioritized."
  });
  assert.deepEqual(emptyColumnMessage("Ready"), {
    title: "Ready queue is empty",
    detail: "Prioritized tickets will wait here before implementation starts."
  });
  assert.deepEqual(emptyColumnMessage("In Progress"), {
    title: "Nothing in progress",
    detail: "Active implementation tickets will show here while work is underway."
  });
  assert.deepEqual(emptyColumnMessage("Needs Clarification"), {
    title: "No questions pending",
    detail: "Tickets needing product or implementation answers will pause here."
  });
  assert.deepEqual(emptyColumnMessage("Review"), {
    title: "Nothing awaiting review",
    detail: "Completed agent work will land here for final checks."
  });
  assert.deepEqual(emptyColumnMessage("Completed"), {
    title: "No completed tickets yet",
    detail: "Accepted tickets will appear here after review is finished."
  });

  const standardTitles = ["Todo", "Ready", "In Progress", "Needs Clarification", "Review", "Completed"].map(
    (columnName) => emptyColumnMessage(columnName).title
  );
  assert.equal(new Set(standardTitles).size, standardTitles.length);
});

test("empty column copy keeps a generic fallback for custom columns", () => {
  assert.deepEqual(emptyColumnMessage("Blocked Review"), {
    title: "Blocked Review is clear",
    detail: "Tickets will settle here when work reaches this stage."
  });
  assert.deepEqual(emptyColumnMessage("  ready  "), emptyColumnMessage("Ready"));
});

test("codex sidebar status display uses simple connected labels", () => {
  assert.deepEqual(getCodexStatusDisplay(undefined, { isLoading: true }), {
    tone: "loading",
    label: "Codex: Checking..."
  });
  assert.deepEqual(getCodexStatusDisplay(undefined, { isError: true }), {
    tone: "error",
    label: "Codex: Unavailable"
  });
  assert.deepEqual(
    getCodexStatusDisplay(
      codexStatus({
        cliAvailable: true,
        cliVersion: "codex-cli 0.130.0",
        authenticated: true,
        message: "Codex is available."
      })
    ),
    {
      tone: "ok",
      label: "Codex: Connected"
    }
  );
  assert.deepEqual(
    getCodexStatusDisplay(
      codexStatus({
        cliAvailable: true,
        cliVersion: "codex-cli 0.130.0",
        authenticated: false,
        message: "Codex CLI is available, but no Codex auth file or API key was found."
      })
    ),
    {
      tone: "warning",
      label: "Codex: Not connected"
    }
  );
  assert.deepEqual(
    getCodexStatusDisplay(
      codexStatus({
        authenticated: false,
        message: "Codex CLI was not found in the SDK bundle or on PATH."
      })
    ),
    {
      tone: "error",
      label: "Codex: Not installed"
    }
  );
});

test("provider inventory display reflects the selected provider label and state", () => {
  assert.deepEqual(getProviderInventoryDisplay(undefined, { isLoading: true }), {
    tone: "loading",
    label: "CLI: Checking..."
  });
  assert.deepEqual(
    getProviderInventoryDisplay(
      providerInventory({
        selectedProviderId: "cursor"
      })
    ),
    {
      tone: "warning",
      label: "Cursor: Status unknown"
    }
  );
  assert.deepEqual(
    getProviderInventoryDisplay(
      providerInventory({
        selectedProviderId: "claude"
      })
    ),
    {
      tone: "warning",
      label: "Claude: Not connected"
    }
  );
});

test("sidebar provider status renders a modal trigger with the selected provider label", () => {
  const warningMarkup = renderToStaticMarkup(
    <CodexSidebarStatus
      providerInventory={providerInventory({
        selectedProviderId: "claude"
      })}
      isLoading={false}
      isError={false}
      onOpenSelector={() => undefined}
    />
  );
  assert.match(warningMarkup, /sidebar-codex-status warning/);
  assert.match(warningMarkup, /Open CLI selector\. Claude: Not connected/);

  const healthyMarkup = renderToStaticMarkup(
    <CodexSidebarStatus
      providerInventory={providerInventory()}
      isLoading={false}
      isError={false}
      onOpenSelector={() => undefined}
    />
  );
  assert.match(healthyMarkup, /sidebar-codex-status ok connected/);
  assert.match(healthyMarkup, /Codex: Connected/);
});

test("collapsed provider indicator opens the selector and uses selected-provider state", () => {
  const connectedMarkup = renderToStaticMarkup(
    <CodexCollapsedStatusIndicator
      providerInventory={providerInventory()}
      onOpenSelector={() => undefined}
    />
  );
  assert.match(connectedMarkup, /sidebar-codex-indicator-button connected/);
  assert.match(connectedMarkup, /aria-label="Codex: Connected"/);

  const disconnectedMarkup = renderToStaticMarkup(
    <CodexCollapsedStatusIndicator
      providerInventory={providerInventory({
        selectedProviderId: "cursor"
      })}
      onOpenSelector={() => undefined}
    />
  );
  assert.match(disconnectedMarkup, /sidebar-codex-indicator-button disconnected/);
  assert.match(disconnectedMarkup, /aria-label="Cursor: Status unknown"/);
});

test("provider selector modal renders version text, disabled actions, and current selection", () => {
  const markup = renderWithQueryClient(
    <CliProviderSelectorModal
      inventory={providerInventory({
        providers: [
          {
            id: "codex",
            label: "Codex",
            installState: "installed",
            authState: "authenticated",
            status: "ready",
            message: "Codex is available.",
            version: "codex-cli 0.130.0",
            canSelect: true,
            blockedReasonCode: null,
            blockedReasonMessage: null
          },
          {
            id: "cursor",
            label: "Cursor",
            installState: "installed",
            authState: "unknown",
            status: "unknown",
            message: "Relay could not confirm Cursor CLI status.",
            version: "cursor-cli 1.4.0",
            canSelect: false,
            blockedReasonCode: "provider_status_unknown",
            blockedReasonMessage: "Refresh Cursor status before switching."
          },
          {
            id: "claude",
            label: "Claude",
            installState: "not_installed",
            authState: "unknown",
            status: "unavailable",
            message: "Claude CLI was not found on PATH.",
            version: null,
            canSelect: false,
            blockedReasonCode: "provider_unavailable",
            blockedReasonMessage: "Install Claude CLI before switching."
          }
        ]
      })}
      onClose={() => undefined}
      onSelectProvider={() => undefined}
    />
  );

  assert.match(markup, /Choose agent CLI/);
  assert.match(markup, /Codex/);
  assert.match(markup, /codex-cli 0.130.0/);
  assert.match(markup, /In use/);
  assert.match(markup, /Cursor/);
  assert.match(markup, /Installed, status unknown/);
  assert.match(markup, /Cursor status could not be verified\./);
  assert.match(markup, /Claude/);
  assert.match(markup, /Not installed/);
  assert.match(markup, /Claude must be installed before Relay can use it\./);
});

test("provider switch cache sync updates the selected provider inventory", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(relayQueryKeys.providerInventory, providerInventory());

  syncProviderInventoryAfterSwitch(queryClient, {
    ok: true,
    selectedProviderId: "cursor",
    inventory: providerInventory({ selectedProviderId: "cursor" })
  });

  assert.deepEqual(queryClient.getQueryData(relayQueryKeys.providerInventory), providerInventory({ selectedProviderId: "cursor" }));
});

test("scope clarification approve CTA only appears for fully answered blocked task tickets", () => {
  const blockedTask = ticketRecord({ status: "needs_clarification", runStatus: "blocked", authoringState: "needs_input" });
  const eligible = getScopeRecoveryClarificationActionQuestionIds(blockedTask, [
    clarificationQuestion({
      id: "clar_scope",
      question: `Codex attempted to modify file paths outside this ticket's planned scope, so Relay reverted the run.

Please confirm whether implementation should expand the planned file scope to include:
- /tmp/project/src/shared/plannedScope.ts

Current planned scope:
- src/http/resources/tickets.ts`,
      answer: "confirmed",
      answeredAt: "2026-05-12T10:05:00.000Z"
    })
  ]);
  assert.deepEqual(eligible, ["clar_scope"]);

  const hiddenWhilePending = getScopeRecoveryClarificationActionQuestionIds(blockedTask, [
    clarificationQuestion({
      id: "clar_scope",
      question: `Codex attempted to modify file paths outside this ticket's planned scope, so Relay reverted the run.

Please confirm whether implementation should expand the planned file scope to include:
- /tmp/project/src/shared/plannedScope.ts

Current planned scope:
- src/http/resources/tickets.ts`,
      answer: "confirmed",
      answeredAt: "2026-05-12T10:05:00.000Z"
    }),
    clarificationQuestion({ id: "clar_other" })
  ]);
  assert.deepEqual(hiddenWhilePending, []);
});

test("drafting ticket status pill renders an active spinner indicator", () => {
  const markup = renderToStaticMarkup(<TicketRunStatusPill status="drafting" />);

  assert.match(markup, /run-pill drafting/);
  assert.match(markup, /spin run-pill-icon/);
  assert.match(markup, /Drafting/);
});

test("paused ticket status pill renders without an active spinner", () => {
  const markup = renderToStaticMarkup(<TicketRunStatusPill status="paused" />);

  assert.match(markup, /run-pill paused/);
  assert.match(markup, /Paused/);
  assert.doesNotMatch(markup, /spin run-pill-icon/);
});

test("ticket authoring and checklist metadata render as compact pills", () => {
  const authoringMarkup = renderToStaticMarkup(<TicketAuthoringStatePill state="reviewing" />);
  assert.match(authoringMarkup, /authoring-pill reviewing/);
  assert.match(authoringMarkup, /Reviewing/);

  const checklistMarkup = renderToStaticMarkup(<TicketChecklistPill completed={2} total={5} />);
  assert.match(checklistMarkup, /checklist-pill/);
  assert.match(checklistMarkup, /2\/5/);

  const cardMarkup = renderToStaticMarkup(
    <TicketCardContent
      ticket={ticketSummary({
        status: "todo",
        runStatus: "idle",
        authoringState: "reviewing",
        checklist: { total: 5, completed: 2, open: 3 }
      })}
      allTickets={[]}
      columns={DEFAULT_COLUMNS}
      now={Date.parse("2026-05-12T10:01:05.000Z")}
    />
  );
  assert.match(cardMarkup, /authoring-pill reviewing/);
  assert.match(cardMarkup, /checklist-pill/);
});

test("in-progress running ticket elapsed pill renders compact runtime", () => {
  const ticket = ticketSummary();
  const now = Date.parse("2026-05-12T10:01:05.000Z");
  const label = activeRunElapsedLabel(ticket, now);

  assert.equal(label, "01:05");
  if (!label) assert.fail("Expected an elapsed label.");
  const markup = renderToStaticMarkup(<TicketRunElapsedPill label={label} />);
  assert.match(markup, /run-elapsed-pill/);
  assert.match(markup, /Agent running for 01:05/);
  assert.match(markup, />01:05</);

  const cardMarkup = renderToStaticMarkup(<TicketCardContent ticket={ticket} allTickets={[ticket]} columns={DEFAULT_COLUMNS} now={now} />);
  assert.match(cardMarkup, /card-meta/);
  assert.match(cardMarkup, /run-pill running/);
  assert.match(cardMarkup, /Running/);
  assert.match(cardMarkup, /run-elapsed-pill/);
  assert.match(cardMarkup, /Agent running for 01:05/);
  assert.match(cardMarkup, />01:05</);
});

test("elapsed runtime label is hidden outside active in-progress implementation runs", () => {
  const now = Date.parse("2026-05-12T10:01:05.000Z");

  for (const ticket of [
    ticketSummary({ status: "ready" }),
    ticketSummary({ runStatus: "queued" }),
    ticketSummary({ runStatus: "blocked" }),
    ticketSummary({ runStatus: "completed" }),
    ticketSummary({ lastRunStartedAt: null }),
    ticketSummary({ lastRunStartedAt: "not-a-date" })
  ]) {
    assert.equal(activeRunElapsedLabel(ticket, now), null);
    const cardMarkup = renderToStaticMarkup(<TicketCardContent ticket={ticket} allTickets={[ticket]} columns={DEFAULT_COLUMNS} now={now} />);
    assert.doesNotMatch(cardMarkup, /run-elapsed-pill/);
  }
});

test("compact board ticket card shows title and labels only", () => {
  const ticket = ticketSummary({
    status: "todo",
    runStatus: "idle",
    excerpt: "Long summary that should not appear on the board",
    labels: ["backend", "api"],
    authoringState: "ready"
  });
  const markup = renderToStaticMarkup(
    <TicketCardContent ticket={ticket} allTickets={[ticket]} columns={DEFAULT_COLUMNS} now={Date.now()} compact />
  );

  assert.match(markup, /card-title/);
  assert.match(markup, />Elapsed runtime</);
  assert.match(markup, />backend</);
  assert.match(markup, />api</);
  assert.doesNotMatch(markup, /card-excerpt/);
  assert.doesNotMatch(markup, /card-meta/);
  assert.doesNotMatch(markup, /ticket-board-failed-icon/);
  assert.doesNotMatch(markup, /Long summary/);
});

test("compact board ticket card shows failed icon when run status is failed", () => {
  const ticket = ticketSummary({
    title: "Broken deploy",
    status: "in_progress",
    runStatus: "failed",
    excerpt: "Should stay hidden on board"
  });
  const markup = renderToStaticMarkup(
    <TicketCardContent ticket={ticket} allTickets={[ticket]} columns={DEFAULT_COLUMNS} now={Date.now()} compact />
  );

  assert.match(markup, /ticket-board-failed-icon/);
  assert.match(markup, /aria-label="Agent status: Failed"/);
  assert.match(markup, />Broken deploy</);
  assert.doesNotMatch(markup, /card-meta/);
});

test("ticket detail execution action matrix hides and shows mutually exclusive controls by run state", () => {
  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "task",
      status: "in_progress",
      runStatus: "running",
      codexThreadId: "thread_active",
      canDiscardPaused: true,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: true,
      showPause: true,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    }
  );

  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "task",
      status: "in_progress",
      runStatus: "failed",
      codexThreadId: "thread_failed",
      canDiscardPaused: false,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: true,
      showPause: false,
      showContinue: false,
      showRetry: true,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    }
  );

  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "task",
      status: "in_progress",
      runStatus: "paused",
      codexThreadId: "thread_paused",
      canDiscardPaused: true,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: true,
      showPause: false,
      showContinue: true,
      showRetry: false,
      showRevert: true,
      showStartOrResume: false,
      showStartNewThread: false
    }
  );

  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "task",
      status: "todo",
      runStatus: "idle",
      codexThreadId: "thread_idle",
      canDiscardPaused: false,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: true,
      showPause: false,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: true,
      showStartNewThread: true
    }
  );

  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "task",
      status: "ready",
      runStatus: "idle",
      codexThreadId: null,
      canDiscardPaused: false,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: false,
      showPause: false,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    }
  );

  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "task",
      status: "ready",
      runStatus: "queued",
      codexThreadId: null,
      canDiscardPaused: false,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: true,
      showPause: true,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    }
  );

  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "task",
      status: "completed",
      runStatus: "completed",
      codexThreadId: "thread_done",
      canDiscardPaused: false,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: false,
      showPause: false,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    }
  );

  assert.deepEqual(
    getTicketDetailExecutionActionState({
      ticketType: "feature",
      status: "todo",
      runStatus: "idle",
      codexThreadId: "thread_feature",
      canDiscardPaused: false,
      columns: DEFAULT_COLUMNS
    }),
    {
      showExecutionControls: false,
      showPause: false,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    }
  );
});

test("tooltip wrapper exposes hover label via data-tooltip", () => {
  const markup = renderToStaticMarkup(
    <Tooltip label="Accept">
      <Button type="button" className="icon-button" aria-label="Accept">
        OK
      </Button>
    </Tooltip>
  );

  assert.match(markup, /class="relay-tooltip"/);
  assert.match(markup, /data-tooltip="Accept"/);
});

test("ticket review action state shows accept and reject for tasks, features, and epics in review", () => {
  const reviewTask = ticketSummary({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: "review"
  });
  const feature = ticketSummary({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: "review"
  });
  const featureTask = ticketSummary({
    id: "task_under_feat",
    title: "Under feature",
    ticketType: "task",
    status: "review",
    parentFeatureId: "feat_1"
  });
  const epic = ticketSummary({
    id: "epic_1",
    title: "Platform",
    ticketType: "epic",
    status: "review"
  });
  const epicFeature = ticketSummary({
    id: "feat_under_epic",
    title: "Auth",
    ticketType: "feature",
    status: "review",
    parentEpicId: "epic_1"
  });
  const epicTask = ticketSummary({
    id: "task_under_epic",
    title: "Task",
    ticketType: "task",
    status: "completed",
    parentFeatureId: "feat_under_epic",
    parentEpicId: "epic_1"
  });
  const boardTickets = [reviewTask, feature, featureTask, epic, epicFeature, epicTask];

  assert.deepEqual(
    getTicketReviewActionState({
      ticketType: "task",
      status: "review",
      columns: DEFAULT_COLUMNS,
      allTickets: boardTickets,
      ticketId: "task_review"
    }),
    { showAcceptReject: true, acceptEnabled: true }
  );

  assert.deepEqual(
    getTicketReviewActionState({
      ticketType: "feature",
      status: "review",
      columns: DEFAULT_COLUMNS,
      allTickets: boardTickets,
      ticketId: "feat_1"
    }),
    { showAcceptReject: true, acceptEnabled: true }
  );

  assert.deepEqual(
    getTicketReviewActionState({
      ticketType: "epic",
      status: "review",
      columns: DEFAULT_COLUMNS,
      allTickets: boardTickets,
      ticketId: "epic_1"
    }),
    { showAcceptReject: true, acceptEnabled: true }
  );

  assert.deepEqual(
    getTicketReviewActionState({
      ticketType: "task",
      status: "in_progress",
      columns: DEFAULT_COLUMNS
    }),
    { showAcceptReject: false, acceptEnabled: false }
  );

  assert.deepEqual(
    getTicketReviewActionState({
      ticketType: "feature",
      status: "todo",
      columns: DEFAULT_COLUMNS
    }),
    { showAcceptReject: false, acceptEnabled: false }
  );
});

test("ticket review action state hides accept and reject for completed containers", () => {
  const feature = ticketSummary({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: "completed"
  });
  const reviewTask = ticketSummary({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: "completed",
    parentFeatureId: "feat_1"
  });

  assert.deepEqual(
    getTicketReviewActionState({
      ticketType: "feature",
      status: "completed",
      columns: DEFAULT_COLUMNS,
      allTickets: [feature, reviewTask],
      ticketId: "feat_1"
    }),
    { showAcceptReject: false, acceptEnabled: false }
  );
});

test("ticket review action state shows accept for a todo feature when linked tasks are ready", () => {
  const feature = ticketSummary({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: "todo"
  });
  const reviewTask = ticketSummary({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: "review",
    parentFeatureId: "feat_1"
  });

  assert.deepEqual(
    getTicketReviewActionState({
      ticketType: "feature",
      status: "todo",
      columns: DEFAULT_COLUMNS,
      allTickets: [feature, reviewTask],
      ticketId: "feat_1"
    }),
    { showAcceptReject: true, acceptEnabled: true }
  );
});

test("getReviewAcceptEnabled blocks feature accept when a linked task is in progress", () => {
  const feature = ticketSummary({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: "review"
  });
  const reviewTask = ticketSummary({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: "review",
    parentFeatureId: "feat_1"
  });
  const openTask = ticketSummary({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: "in_progress",
    parentFeatureId: "feat_1"
  });

  assert.equal(getReviewAcceptEnabled(feature, [feature, reviewTask], DEFAULT_COLUMNS), true);
  assert.equal(getReviewAcceptEnabled(feature, [feature, reviewTask, openTask], DEFAULT_COLUMNS), false);
});

test("container ticket status note uses review guidance when in review", () => {
  assert.match(
    getContainerTicketStatusNote("feature", "review"),
    /This feature is in Review/
  );
  assert.match(getContainerTicketStatusNote("feature", "review"), /Accept moves this feature and every linked task in Review/);
  assert.match(getContainerTicketStatusNote("feature", "review"), /Reject moves only this feature to Completed/);
  assert.match(
    getContainerTicketStatusNote("epic", "review"),
    /This epic is in Review/
  );
  assert.match(getContainerTicketStatusNote("epic", "review"), /Accept moves this epic and every linked feature or task still in Review/);
  assert.match(getContainerTicketStatusNote("epic", "review"), /Reject moves only this epic to Completed/);
  assert.match(getContainerTicketStatusNote("feature", "todo"), /Features follow child task columns/);
  assert.match(getContainerTicketStatusNote("epic", "todo"), /Epics follow child task columns/);
});

test("ticket card label overflow exposes hidden label names without rendering extra label chips", () => {
  const ticket = ticketSummary({
    labels: ["frontend", "accessibility", "regression", "polish"],
    runStatus: "idle",
    lastRunId: null,
    lastRunStartedAt: null
  });
  const markup = renderToStaticMarkup(<TicketCardContent ticket={ticket} allTickets={[ticket]} columns={DEFAULT_COLUMNS} now={Date.now()} />);

  assert.match(markup, /<div class="labels">/);
  assert.match(markup, />frontend</);
  assert.match(markup, />accessibility</);
  assert.match(markup, /class="label-overflow"/);
  assert.match(markup, /title="Hidden labels: regression, polish"/);
  assert.match(markup, /aria-label="2 hidden labels: regression, polish"/);
  assert.match(markup, />\+2</);
  assert.doesNotMatch(markup, />regression</);
  assert.doesNotMatch(markup, />polish</);
});

test("drafting ticket detail loading state hides placeholder draft content", () => {
  const markup = renderToStaticMarkup(<DraftingTicketDetailLoading title="Draft: Async flow" />);

  assert.match(markup, /Ticket draft loading state/);
  assert.match(markup, /Drafting ticket/);
  assert.match(markup, /The agent is preparing the generated ticket content/);
  assert.doesNotMatch(markup, /Original Idea/);
  assert.doesNotMatch(markup, /Markdown/);
  assert.doesNotMatch(markup, /Preview/);
});

test("redraft eligibility is limited to failed placeholders and generated drafts", () => {
  assert.equal(canRedraftTicket(ticketRecord({ runStatus: "draft_failed" })), true);
  assert.equal(canRedraftTicket(ticketRecord({ runStatus: "draft_complete" })), true);
  assert.equal(canRedraftTicket(ticketRecord({ authoringState: "reviewing" })), true);
  assert.equal(canRedraftTicket(ticketRecord({ runStatus: "drafting", authoringState: "drafting" })), false);
  assert.equal(canRedraftTicket(ticketRecord({ runStatus: "idle", authoringState: "rough" })), false);
  assert.equal(canRedraftTicket(ticketRecord({ runStatus: "completed", authoringState: "ready" })), false);
});

test("ticket summary preview renders lean summary without copy control", () => {
  const markup = renderToStaticMarkup(<TicketSummaryPreview summary="Lean summary for the ticket preview." />);

  assert.match(markup, /ticket-summary-panel/);
  assert.match(markup, />Summary</);
  assert.match(markup, /ticket-summary-preview/);
  assert.match(markup, /Lean summary for the ticket preview/);
  assert.doesNotMatch(markup, /markdown-copy-button/);
  assert.doesNotMatch(markup, /View full ticket/);
});

test("ticket markdown tabs render full body preview by default without textarea", () => {
  const markup = renderToStaticMarkup(
    <TicketMarkdownTabs markdown={"# Ticket body\n\n## Context\n\nRun **focused** validation."} onModeChange={() => undefined} />
  );

  assert.match(markup, />Preview</);
  assert.match(markup, />Edit</);
  assert.match(markup, /id="ticket-markdown-preview-tab"[^>]*aria-selected="true"/);
  assert.match(markup, /ticket-markdown-preview-panel/);
  assert.match(markup, /ticket-markdown-preview/);
  assert.match(markup, /Ticket body/);
  assert.match(markup, /<strong>focused<\/strong>/);
  assert.doesNotMatch(markup, /markdown-copy-button/);
  assert.doesNotMatch(markup, /detail-markdown/);
  assert.doesNotMatch(markup, /<textarea/);
});

test("ticket full body panel renders preview and edit tabs with back control", () => {
  const markup = renderToStaticMarkup(
    <TicketFullBodyPanel markdown={"# Ticket body\n\n## Context\n\nDetailed plan."} onBack={() => undefined} onModeChange={() => undefined} />
  );

  assert.match(markup, /ticket-detail-full-body/);
  assert.match(markup, /Back to ticket/);
  assert.match(markup, />Preview</);
  assert.match(markup, />Edit</);
  assert.match(markup, /Ticket body/);
  assert.match(markup, /Detailed plan/);
  assert.doesNotMatch(markup, /detail-markdown/);
});

test("ticket detail primary column keeps refine controls from shrinking", () => {
  const styles = readFileSync("src/renderer/src/styles.css", "utf8");

  assert.match(styles, /\.ticket-detail-primary > \.ticket-update-panel\s*{[^}]*flex:\s*0 0 auto;/s);
  assert.match(styles, /\.ticket-detail-layout\.full-body-open\s*{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(styles, /\.ticket-detail-full-body\s*{[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /\.ticket-detail-full-body \.ticket-markdown-preview-panel \.ticket-markdown-preview\s*{[^}]*overflow-y:\s*auto;/s);
  assert.match(styles, /\.detail-panel\s*{[^}]*max-height:\s*calc\(100dvh - 20dvh\);/s);
});

test("ticket markdown tabs render body editor in edit mode", () => {
  const markup = renderToStaticMarkup(
    <TicketMarkdownTabs mode="edit" markdown={"# Ticket body\n\nRun **focused** validation."} onModeChange={() => undefined} />
  );

  assert.match(markup, /id="ticket-markdown-edit-tab"[^>]*aria-selected="true"/);
  assert.match(markup, /detail-markdown/);
  assert.match(markup, /# Ticket body/);
  assert.doesNotMatch(markup, /class="markdown-block ticket-markdown-preview/);
  assert.doesNotMatch(markup, /<strong>focused<\/strong>/);
});

test("ticket detail primary clarifications render pending answer composer", () => {
  const markup = renderToStaticMarkup(
    <TicketDetailPrimaryClarifications
      questions={[clarificationQuestion()]}
      answerDrafts={{ clar_primary: "" }}
      submittingId={null}
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
    />
  );

  assert.match(markup, /ticket-detail-primary-clarifications/);
  assert.match(markup, /Pending Clarifications/);
  assert.match(markup, /1 pending/);
  assert.match(markup, /Which datastore should this use\?/);
  assert.match(markup, /placeholder="Answer"/);
  assert.match(markup, /Submit Answer/);
});

test("create ticket draft messages expose status and alert roles", () => {
  const infoMarkup = renderToStaticMarkup(<CreateTicketDraftMessage kind="info" message="Creating a pending ticket." busy />);

  assert.match(infoMarkup, /class="draft-message info"/);
  assert.match(infoMarkup, /role="status"/);
  assert.match(infoMarkup, /spin/);
  assert.match(infoMarkup, /Creating a pending ticket/);

  const errorMarkup = renderToStaticMarkup(<CreateTicketDraftMessage kind="error" message="Codex draft failed." />);

  assert.match(errorMarkup, /class="draft-message error"/);
  assert.match(errorMarkup, /role="alert"/);
  assert.doesNotMatch(errorMarkup, /spin/);
  assert.match(errorMarkup, /Codex draft failed/);
});

test("floating ticket composer renders compact drafting controls without create modal chrome", () => {
  const markup = renderWithQueryClient(
    <FloatingTicketComposer
      projectPath="/tmp/project"
      defaultEffort="medium"
      selectedProviderId="codex"
      onCreated={() => undefined}
      setToast={() => undefined}
    />
  );

  assert.match(markup, /floating-ticket-composer/);
  assert.match(markup, /aria-label="Draft ticket idea"/);
  assert.match(markup, /aria-label="Ticket idea"/);
  assert.match(markup, /aria-label="Record ticket idea with voice"/);
  assert.doesNotMatch(markup, /Relay chooses epic, feature, or task/);
  assert.doesNotMatch(markup, />Planning</);
  assert.doesNotMatch(markup, /Planning mode/);
  assert.match(markup, />Type</);
  assert.match(markup, /value="epic">Epic/);
  assert.match(markup, /value="feature" selected="">Feature/);
  assert.doesNotMatch(markup, /value="auto"/);
  assert.doesNotMatch(markup, /value="ticket"/);
  assert.match(markup, />Priority</);
  assert.match(markup, />Effort</);
  assert.match(markup, /aria-label="Draft ticket with agent"/);
  assert.doesNotMatch(markup, /modal-backdrop/);
  assert.doesNotMatch(markup, /Create Ticket/);
});

test("floating ticket composer keeps voice input clickable for local whisper setup", () => {
  const markup = renderWithQueryClient(
    <FloatingTicketComposer
      projectPath="/tmp/project"
      defaultEffort="medium"
      selectedProviderId="codex"
      onCreated={() => undefined}
      setToast={() => undefined}
    />,
    (queryClient) => {
      queryClient.setQueryData(relayQueryKeys.voiceInputStatus, voiceInputStatus());
    }
  );

  assert.match(markup, /data-tooltip="Set up local Whisper path"/);
  assert.match(markup, /aria-label="Record ticket idea with voice"/);
  assert.doesNotMatch(markup, /floating-ticket-voice" disabled=""/);
});

test("floating ticket composer enables voice input when local whisper is ready", () => {
  const markup = renderWithQueryClient(
    <FloatingTicketComposer
      projectPath="/tmp/project"
      defaultEffort="medium"
      selectedProviderId="codex"
      onCreated={() => undefined}
      setToast={() => undefined}
    />,
    (queryClient) => {
      queryClient.setQueryData(
        relayQueryKeys.voiceInputStatus,
        voiceInputStatus({
          available: true,
          backend: "whisper.cpp",
          command: "whisper-cli",
          message: "Local whisper.cpp transcription is ready."
        })
      );
    }
  );

  assert.match(markup, /data-tooltip="Record voice idea"/);
  assert.doesNotMatch(markup, /floating-ticket-voice" disabled=""/);
});

test("voice input setup modal renders the default whisper path and install guide", () => {
  const markup = renderToStaticMarkup(
    <VoiceInputSetupModal
      commandPath="~/whisper.cpp/build/bin/whisper-cli"
      statusMessage="Local Whisper is not configured yet."
      onCommandPathChange={() => undefined}
      onClose={() => undefined}
      onSave={() => undefined}
      savePending={false}
    />
  );

  assert.match(markup, /Set up local Whisper/);
  assert.match(markup, /value="~\/whisper\.cpp\/build\/bin\/whisper-cli"/);
  assert.match(markup, /download-ggml-model\.sh base\.en/);
  assert.match(markup, /brew install cmake ffmpeg/);
  assert.match(markup, /apt install -y build-essential cmake ffmpeg/);
});

test("floating composer draft input maps each type selector to the expected request shape", () => {
  const shared = {
    projectPath: "/tmp/project",
    idea: "Draft a settings change",
    priority: "high" as const,
    effort: "medium" as const,
    selectedProviderId: "codex" as const
  };

  assert.deepEqual(getFloatingComposerDraftInput({ ...shared, draftType: "epic" }), {
    projectPath: shared.projectPath,
    idea: shared.idea,
    priority: shared.priority,
    effort: shared.effort,
    runIntake: true,
    preferredTicketType: "epic",
    draftScope: "epic"
  });
  assert.deepEqual(getFloatingComposerDraftInput({ ...shared, draftType: "feature" }), {
    projectPath: shared.projectPath,
    idea: shared.idea,
    priority: shared.priority,
    effort: shared.effort,
    runIntake: true,
    preferredTicketType: "feature",
    draftScope: "product_feature"
  });
});

test("floating composer draft input sends cursor agent model instead of effort", () => {
  assert.deepEqual(
    getFloatingComposerDraftInput({
      projectPath: "/tmp/project",
      idea: "Draft with cursor",
      priority: "medium",
      agentModel: "auto",
      selectedProviderId: "cursor",
      draftType: "feature"
    }),
    {
      projectPath: "/tmp/project",
      idea: "Draft with cursor",
      priority: "medium",
      agentModel: "auto",
      runIntake: true,
      preferredTicketType: "feature",
      draftScope: "product_feature"
    }
  );
});

test("floating ticket composer shows model selector when cursor CLI is selected", () => {
  const markup = renderWithQueryClient(
    <FloatingTicketComposer
      projectPath="/tmp/project"
      defaultEffort="medium"
      selectedProviderId="cursor"
      onCreated={() => undefined}
      setToast={() => undefined}
    />
  );

  assert.match(markup, />Model</);
  assert.match(markup, /value="auto" selected="">Auto/);
  assert.doesNotMatch(markup, />Effort</);
});

test("floating ticket composer submit button is disabled for blank ideas", () => {
  const markup = renderWithQueryClient(
    <FloatingTicketComposer
      projectPath="/tmp/project"
      defaultEffort="medium"
      selectedProviderId="codex"
      onCreated={() => undefined}
      setToast={() => undefined}
    />
  );

  assert.match(markup, /floating-ticket-submit" disabled=""/);
});

test("board view renders the ticket composer inside the workspace region", () => {
  const markup = renderWithQueryClient(
    <BoardView
      board={boardSnapshot()}
      projectPath="/tmp/project"
      defaultEffort="medium"
      selectedProviderId="codex"
      composerRef={undefined}
      onCreated={() => undefined}
      query=""
      ticketNavigationEnabled
      onQuery={() => undefined}
      onToggleRepositoryChat={() => undefined}
      onOpenTicket={() => undefined}
      gitMetadata={undefined}
      repositoryChatOpen={false}
      onOpenProjectInEditor={async () => ({ ok: false, message: "not implemented" })}
      setToast={() => undefined}
    />
  );

  assert.match(markup, /class="workspace"/);
  assert.match(markup, /class="workspace-composer-region"/);
  assert.match(markup, /class="floating-ticket-composer"/);
  assert.match(markup, /class="board"/);
  assert.doesNotMatch(markup, /id="repository-chat-panel"/);
});

test("draft intake question panel renders editable recommended answers", () => {
  const intake: DraftIntakeResult = {
    scope: "product_feature",
    planKind: "feature_tree",
    confidence: 0.74,
    estimatedTouchPoints: 5,
    rationale: "Medium settings work.",
    matchedEpicId: null,
    matchedFeatureId: null,
    knownFacts: ["Existing tickets mention the settings dialog."],
    relatedTicketIds: ["tkt_settings"],
    questions: [
      {
        question: "Should this preserve the current settings layout?",
        whyItMatters: "It keeps the scope to a feature change instead of a redesign.",
        recommendedAnswer: "Preserve the layout and add only the new control."
      }
    ]
  };

  const markup = renderToStaticMarkup(
    <DraftIntakeQuestionsPanel
      intake={intake}
      answerDrafts={{ 0: intake.questions[0].recommendedAnswer }}
      onAnswerChange={() => undefined}
      onContinue={() => undefined}
    />
  );

  assert.match(markup, /Draft intake questions/);
  assert.match(markup, /Product Feature intake/);
  assert.match(markup, /Existing tickets mention the settings dialog/);
  assert.match(markup, /Should this preserve the current settings layout/);
  assert.match(markup, /Preserve the layout and add only the new control/);
  assert.match(markup, /Continue Draft/);
});

test("repository chat panel content renders transcript, pending state, and controls", () => {
  const noop = (): void => undefined;
  const markup = renderToStaticMarkup(
    <RepositoryChatPanelContent
      projectName="Relay"
      messages={[
        { id: "user-1", role: "user", text: "Where is the board rendered?" },
        { id: "assistant-1", role: "assistant", text: "The board is rendered in `BoardView`." }
      ]}
      draft="What owns selected project state?"
      pendingChat
      pendingThinking
      pendingDraft={false}
      errorMessage="Codex is not authenticated."
      usesCursorAgent
      draftType="feature"
      priority="medium"
      effort="medium"
      cursorAgentModel="auto"
      recording={false}
      transcribing={false}
      voiceSetupRequired={false}
      voiceButtonLabel="Record idea with voice"
      voiceButtonTooltip="Record voice idea"
      voiceButtonDisabled={false}
      onDraftChange={noop}
      onDraftBlur={noop}
      onSubmitChat={noop}
      onSubmitDraft={noop}
      onDraftTypeChange={noop}
      onPriorityChange={noop}
      onEffortChange={noop}
      onCursorAgentModelChange={noop}
      onVoiceInput={noop}
      onClose={noop}
      onClearChat={noop}
      clearChatDisabled={false}
    />
  );

  assert.match(markup, /id="repository-chat-panel"/);
  assert.match(markup, /aria-label="Repository chat for Relay"/);
  assert.match(markup, /aria-label="Clear repository chat"/);
  assert.match(markup, /title="Clear chat"/);
  assert.match(markup, /aria-label="Close repository chat"/);
  assert.match(markup, />You</);
  assert.match(markup, /Where is the board rendered/);
  assert.match(markup, />Agent</);
  assert.match(markup, /BoardView/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /Thinking\.\.\./);
  assert.doesNotMatch(markup, /Reading repository context/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /Codex is not authenticated/);
  assert.match(markup, /aria-label="Repository chat question"/);
  assert.match(markup, /placeholder="Press Enter to chat, when ready click Draft ticket"/);
  assert.doesNotMatch(markup, /repository-chat-enter-hint/);
  assert.match(markup, /aria-label="Create ticket draft"/);
  assert.match(markup, /repository-chat-option-trigger-label">Feature</);
  assert.match(markup, /aria-label="Type: Feature"/);
  assert.match(markup, /aria-label="Priority: Medium"/);
  assert.doesNotMatch(markup, /<span>Type<\/span>/);
  assert.match(markup, /repository-chat-action-row/);
});

test("repository chat shows Thinking... until streamed assistant content is visible", () => {
  const noop = (): void => undefined;
  const thinkingMarkup = renderToStaticMarkup(
    <RepositoryChatPanelContent
      projectName="Relay"
      messages={[{ id: "user-1", role: "user", text: "How does streaming work?" }]}
      draft=""
      pendingChat
      pendingThinking
      pendingDraft={false}
      errorMessage={null}
      usesCursorAgent={false}
      draftType="feature"
      priority="medium"
      effort="medium"
      cursorAgentModel="auto"
      recording={false}
      transcribing={false}
      voiceSetupRequired={false}
      voiceButtonLabel="Record idea with voice"
      voiceButtonTooltip="Record voice idea"
      voiceButtonDisabled={false}
      onDraftChange={noop}
      onDraftBlur={noop}
      onSubmitChat={noop}
      onSubmitDraft={noop}
      onDraftTypeChange={noop}
      onPriorityChange={noop}
      onEffortChange={noop}
      onCursorAgentModelChange={noop}
      onVoiceInput={noop}
      onClose={noop}
      onClearChat={noop}
      clearChatDisabled={false}
    />
  );

  const streamedMarkup = renderToStaticMarkup(
    <RepositoryChatPanelContent
      projectName="Relay"
      messages={[
        { id: "user-1", role: "user", text: "How does streaming work?" },
        { id: "assistant-1", role: "assistant", text: "Streaming updates the transcript as deltas arrive." }
      ]}
      draft=""
      pendingChat
      pendingThinking={false}
      pendingDraft={false}
      errorMessage={null}
      usesCursorAgent={false}
      draftType="feature"
      priority="medium"
      effort="medium"
      cursorAgentModel="auto"
      recording={false}
      transcribing={false}
      voiceSetupRequired={false}
      voiceButtonLabel="Record idea with voice"
      voiceButtonTooltip="Record voice idea"
      voiceButtonDisabled={false}
      onDraftChange={noop}
      onDraftBlur={noop}
      onSubmitChat={noop}
      onSubmitDraft={noop}
      onDraftTypeChange={noop}
      onPriorityChange={noop}
      onEffortChange={noop}
      onCursorAgentModelChange={noop}
      onVoiceInput={noop}
      onClose={noop}
      onClearChat={noop}
      clearChatDisabled={false}
    />
  );

  assert.match(thinkingMarkup, /Thinking\.\.\./);
  assert.match(thinkingMarkup, /repository-chat-message assistant thinking/);
  assert.match(streamedMarkup, /Streaming updates the transcript as deltas arrive/);
  assert.doesNotMatch(streamedMarkup, /Thinking\.\.\./);
  assert.doesNotMatch(streamedMarkup, /repository-chat-message assistant thinking/);
  assert.doesNotMatch(streamedMarkup, /repository-chat-message assistant pending/);
});

test("repository chat ticket action is enabled when the conversation has messages", () => {
  const noop = (): void => undefined;
  const markup = renderToStaticMarkup(
    <RepositoryChatPanelContent
      projectName="Relay"
      messages={[{ id: "user-1", role: "user", text: "Where is auth handled?" }]}
      draft="   "
      pendingChat={false}
      pendingThinking={false}
      pendingDraft={false}
      errorMessage={null}
      usesCursorAgent={false}
      draftType="feature"
      priority="medium"
      effort="medium"
      cursorAgentModel="auto"
      recording={false}
      transcribing={false}
      voiceSetupRequired={true}
      voiceButtonLabel="Record idea with voice"
      voiceButtonTooltip="Set up local Whisper path"
      voiceButtonDisabled={false}
      onDraftChange={noop}
      onDraftBlur={noop}
      onSubmitChat={noop}
      onSubmitDraft={noop}
      onDraftTypeChange={noop}
      onPriorityChange={noop}
      onEffortChange={noop}
      onCursorAgentModelChange={noop}
      onVoiceInput={noop}
      onClose={noop}
      onClearChat={noop}
      clearChatDisabled={false}
    />
  );

  assert.doesNotMatch(markup, /repository-chat-ticket-send" disabled=""/);
});

test("repository chat ticket action is disabled for blank drafts and empty chat", () => {
  const noop = (): void => undefined;
  const markup = renderToStaticMarkup(
    <RepositoryChatPanelContent
      projectName="Relay"
      messages={[]}
      draft="   "
      pendingChat={false}
      pendingThinking={false}
      pendingDraft={false}
      errorMessage={null}
      usesCursorAgent={false}
      draftType="feature"
      priority="medium"
      effort="medium"
      cursorAgentModel="auto"
      recording={false}
      transcribing={false}
      voiceSetupRequired={true}
      voiceButtonLabel="Record idea with voice"
      voiceButtonTooltip="Set up local Whisper path"
      voiceButtonDisabled={false}
      onDraftChange={noop}
      onDraftBlur={noop}
      onSubmitChat={noop}
      onSubmitDraft={noop}
      onDraftTypeChange={noop}
      onPriorityChange={noop}
      onEffortChange={noop}
      onCursorAgentModelChange={noop}
      onVoiceInput={noop}
      onClose={noop}
      onClearChat={noop}
      clearChatDisabled={false}
    />
  );

  assert.match(markup, /turn the same idea into a ticket draft/);
  assert.match(markup, /repository-chat-ticket-send" disabled=""/);
  assert.match(markup, /aria-label="Create ticket draft"/);
  assert.match(markup, /setup-required/);
  assert.doesNotMatch(markup, /disabled=""[^>]*aria-label="Record idea with voice"/);
});

test("repository chat voice button reflects recording and transcription states", () => {
  const noop = (): void => undefined;
  const recordingMarkup = renderToStaticMarkup(
    <RepositoryChatPanelContent
      projectName="Relay"
      messages={[]}
      draft="record something"
      pendingChat={false}
      pendingThinking={false}
      pendingDraft={false}
      errorMessage={null}
      usesCursorAgent={false}
      draftType="feature"
      priority="medium"
      effort="medium"
      cursorAgentModel="auto"
      recording
      transcribing={false}
      voiceSetupRequired={false}
      voiceButtonLabel="Stop recording and transcribe"
      voiceButtonTooltip="Stop recording and transcribe"
      voiceButtonDisabled={false}
      onDraftChange={noop}
      onDraftBlur={noop}
      onSubmitChat={noop}
      onSubmitDraft={noop}
      onDraftTypeChange={noop}
      onPriorityChange={noop}
      onEffortChange={noop}
      onCursorAgentModelChange={noop}
      onVoiceInput={noop}
      onClose={noop}
      onClearChat={noop}
      clearChatDisabled={false}
    />
  );

  const transcribingMarkup = renderToStaticMarkup(
    <RepositoryChatPanelContent
      projectName="Relay"
      messages={[]}
      draft="record something"
      pendingChat={false}
      pendingThinking={false}
      pendingDraft={false}
      errorMessage={null}
      usesCursorAgent={false}
      draftType="feature"
      priority="medium"
      effort="medium"
      cursorAgentModel="auto"
      recording={false}
      transcribing
      voiceSetupRequired={false}
      voiceButtonLabel="Transcribing voice input locally"
      voiceButtonTooltip="Transcribing audio locally..."
      voiceButtonDisabled
      onDraftChange={noop}
      onDraftBlur={noop}
      onSubmitChat={noop}
      onSubmitDraft={noop}
      onDraftTypeChange={noop}
      onPriorityChange={noop}
      onEffortChange={noop}
      onCursorAgentModelChange={noop}
      onVoiceInput={noop}
      onClose={noop}
      onClearChat={noop}
      clearChatDisabled={false}
    />
  );

  assert.match(recordingMarkup, /aria-pressed="true"/);
  assert.match(recordingMarkup, /recording/);
  assert.match(transcribingMarkup, /spin/);
});

test("repository chat transcript component is memoized without draft props", () => {
  const transcriptSource = readFileSync("src/renderer/src/components/RepositoryChatTranscript.tsx", "utf8");
  const composerSource = readFileSync("src/renderer/src/components/RepositoryChatComposer.tsx", "utf8");

  assert.match(transcriptSource, /memo\(/);
  assert.doesNotMatch(transcriptSource, /RepositoryChatTranscriptProps[\s\S]*\bdraft\b/);
  assert.match(composerSource, /\bdraft:\s*string/);
});
