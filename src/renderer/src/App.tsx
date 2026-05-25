import clsx from "clsx";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  Check,
  CircleDashed,
  Clock,
  Code2,
  Copy,
  ArrowLeft,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Maximize2,
  Ban,
  CircleHelp,
  MessageCircle,
  Mic,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  PlugZap,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Square,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CSSProperties, DragEvent, KeyboardEvent, ReactElement, Ref, RefObject } from "react";
import {
  extractScopeViolationRequestedPaths,
  isMissingPlannedScopeClarificationQuestion,
  isScopeViolationClarificationQuestion,
  MISSING_PLANNED_SCOPE_ANSWER_DRAFT
} from "@shared/plannedScope";
import {
  boardVisibleColumns,
  RELAY_ARCHIVE_STATUS,
  RELAY_COMPLETED_STATUS,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_NEEDS_CLARIFICATION_STATUS,
  RELAY_NOT_DOING_STATUS,
  RELAY_READY_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_TODO_STATUS
} from "@shared/schemas";
import type {
  AgentProviderInventory,
  AgentProviderRecord,
  BoardSnapshot,
  ClarificationQuestion,
  CodexStatus,
  AgentProviderId,
  CreateDraftInput,
  CursorAgentModel,
  CodexRunPreflightResult,
  DraftIntakeQuestion,
  DraftIntakeResult,
  DraftScope,
  GitMetadata,
  ProjectEditorId,
  ProjectOpenInEditorInput,
  ProjectOpenInEditorResult,
  ProjectSummary,
  RelayColumn,
  RendererRunEvent,
  RunStatus,
  TicketAuthoringState,
  TicketAttachmentSaveResult,
  TicketEffort,
  TicketPriority,
  TicketReferenceCandidate,
  RepositoryChatMessage,
  TicketRecord,
  TicketSummary,
  TicketType
} from "@shared/schemas";
import {
  resolveTicketBlockers,
  resolvedBlockerLabel,
  ticketBlockerOptionLabel,
  ticketContextLabel
} from "@shared/blockers";
import { AgentActivityPanel, AgentLogViewer, AgentProgressSummary } from "./components/AgentActivity";
import { ClarificationPanel } from "./components/ClarificationPanel";
import { GitMetadataPill, loadingGitMetadata } from "./components/GitMetadata";
import { MarkdownBlock } from "./components/MarkdownBlock";
import { Button, Dialog, DialogBackdrop, Dropdown, DropdownSelect, Field, IconButton, Input, Select, Textarea, Tooltip } from "./components/ui";
import type { LucideIcon } from "lucide-react";
import { activeRunElapsedLabel, formatElapsedDuration, isAgentSessionActive, mergeRunEvents } from "./lib/agentProgress";
import { stripPlannedFileScopeSection, ticketRecordPreviewSummary } from "./lib/markdown";
import {
  createRepositoryChatPersist,
  repositoryChatStoreSignature,
  type RepositoryChatPersistController
} from "./lib/repositoryChatPersist";

export { activeRunElapsedLabel } from "./lib/agentProgress";
import { BoardHierarchyVisualProvider } from "./components/BoardHierarchyVisualContext";
import { TicketDetailTypeIndicator } from "./components/TicketDetailTypeIndicator";
import {
  epicReadyForBulkAccept,
  featureReadyForBulkAccept
} from "./lib/boardAccept";
import { moveReviewAcceptBundle, reviewAcceptSuccessMessage } from "./lib/reviewAcceptBundle";
import {
  archiveAllCompletedContainerBundleIds,
  archiveBundleForEpic,
  archiveBundleForFeature,
  archivableCompletedEpics,
  archivableCompletedFeatures,
  epicCanArchive,
  featureCanArchive,
  resolveDetailArchiveTarget,
  showTaskArchive,
  sortArchiveBundleIds,
  taskCanArchive
} from "./lib/boardArchive";
import { relayApi } from "./lib/relayApi";
import { BoardTaskCardLeading } from "./components/BoardTaskCardLeading";
import {
  BoardDragProvider,
  boardColumnDraggable,
  useBoardColumnDropTarget,
  useBoardDragContext,
  useBoardDraggable
} from "./components/BoardDragDrop";
import { EpicBoardGroup } from "./components/EpicBoardGroup";
import { FeatureBoardGroup } from "./components/FeatureBoardGroup";
import { TicketCardContent } from "./components/TicketCardContent";
import { RepositoryChatComposer } from "./components/RepositoryChatComposer";
import { RepositoryChatTranscript } from "./components/RepositoryChatTranscript";

export { TicketCardContent } from "./components/TicketCardContent";
import { isImplementationContinuation } from "@shared/implementationRun";
import {
  countColumnTicketsForDisplay,
  flattenBoardColumnsTicketIds,
  isTaskProcessable,
  isTaskReadyPlaceable,
  organizeColumnBoardItems
} from "./lib/boardColumnLayout";
import {
  boardColumnAcceptsActiveDrag,
  boardColumnGridTemplateColumns,
  boardColumnGridTrack,
  shouldMinifyBoardColumn
} from "./lib/boardColumnDisplay";
import {
  boardDragAllowsNotDoingDrop,
  boardDragId,
  boardDragMoveAriaLabel,
  prepareTaskForNotDoing,
  restoreTasksToTodo,
  resolveDragTasks,
  tasksEligibleForReadyQueue,
  tasksForNotDoingDrop,
  tasksForTodoRestore,
  validateRestoreDragToTodo,
  validateReviewDragToCompleted,
  type BoardDragItem,
  type BoardDropTarget
} from "./lib/boardDragDrop";
import {
  attachmentMarkdownBlock,
  droppedImageFileToAttachmentInput,
  insertMarkdownAtSelection,
  isSupportedDroppedImageFile
} from "./lib/attachments";
import {
  isCreateTicketShortcut,
  isSidebarToggleShortcut,
  isTicketComposerSubmitShortcut,
  KeyboardShortcutProvider,
  sidebarToggleShortcutLabel,
  ticketNavigationDirection,
  ticketNavigationShortcutLabel,
  useKeyboardShortcut,
  useShortcutOverlay,
  type ShortcutDirection
} from "./lib/keyboardShortcuts";
import {
  debouncedInvalidateRelayTicketData,
  handleDraftPlaceholderResolved,
  invalidateRelayProjectData,
  relayErrorMessage,
  relayOpenProjectInEditor,
  useAddProjectMutation,
  useArchiveTicketMutation,
  useApproveScopeClarificationMutation,
  useAnswerClarificationMutation,
  useBoardQuery,
  useCancelRunMutation,
  useCancelTicketUpdateMutation,
  useConfigureVoiceInputMutation,
  useCreateDraftMutation,
  useCreateSubticketMutation,
  useDeleteTicketMutation,
  useDuplicateTicketMutation,
  useLinkSubticketMutation,
  useMoveTicketMutation,
  useOpenProjectInEditorMutation,
  usePreflightRunMutation,
  useProjectGitMetadataQuery,
  useProjectsQuery,
  useProviderInventoryQuery,
  useClearRepositoryChatMutation,
  useRepositoryChatEventSubscription,
  useRemoveProjectMutation,
  useRedraftTicketMutation,
  useRepositoryChatMutation,
  useRepositoryChatQuery,
  useSaveRepositoryChatMutation,
  useRevealProjectMutation,
  useRevealTicketFileMutation,
  useRunEventSubscription,
  useRunEventsQuery,
  useRunSummaryQuery,
  useSaveTicketAttachmentMutation,
  useSaveTicketMutation,
  useStartRunMutation,
  useStartTicketUpdateMutation,
  useSwitchAgentProviderMutation,
  useTicketClarificationsQuery,
  useTicketQuery,
  useTicketReferencesQuery,
  useTranscribeVoiceInputMutation,
  useUnlinkSubticketMutation,
  useCreateTaskUnderFeatureMutation,
  useLinkFeatureSubticketMutation,
  useVoiceInputStatusQuery
} from "./lib/relayQueries";
import {
  filterTicketReferenceCandidates,
  getActiveTicketMention,
  replaceTicketMention,
  type TicketMentionToken
} from "./lib/ticketReferences";

export type Toast = { kind: "info" | "error" | "success"; message: string } | null;
type TicketMarkdownMode = "preview" | "edit";
type CodexRailTone = "loading" | "ok" | "warning" | "error";
export type { RepositoryChatMessage };

export const REPOSITORY_CHAT_COMPOSER_PLACEHOLDER =
  "Press Enter to chat, when ready click Draft ticket";
export type RepositoryChatShellState = {
  repositoryChatActive: boolean;
  repositoryChatPanelVisible: boolean;
};

const repositoryChatMessageHasVisibleText = (message: RepositoryChatMessage | undefined): boolean =>
  Boolean(message && message.text.trim().length > 0);

const repositoryChatDraftIdeaFromConversation = (
  messages: readonly RepositoryChatMessage[],
  nextUserPrompt: string
): string => {
  const trimmedPrompt = nextUserPrompt.trim();
  const transcript = messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text.trim()}`)
    .filter((entry) => entry.length > 0)
    .join("\n\n");
  if (!transcript) return trimmedPrompt;
  if (!trimmedPrompt) {
    return `Repository chat context:\n${transcript}\n\nCreate a ticket from this repository chat conversation.`;
  }
  return `Repository chat context:\n${transcript}\n\nCreate a ticket from this latest user request:\nUser: ${trimmedPrompt}`;
};

export function getRepositoryChatShellState({
  board,
  selectedPath,
  repositoryChatOpen
}: {
  board: BoardSnapshot | null;
  selectedPath: string | null;
  repositoryChatOpen: boolean;
}): RepositoryChatShellState {
  const repositoryChatActive = Boolean(board && selectedPath && repositoryChatOpen);
  return {
    repositoryChatActive,
    repositoryChatPanelVisible: repositoryChatActive
  };
}
type DraftMessageKind = "info" | "error";
type ActiveTicketReferenceMention = {
  token: TicketMentionToken;
};

export const repositoryChatMessageSequence = (messages: readonly RepositoryChatMessage[]): number => {
  let max = 0;
  for (const message of messages) {
    const match = /^(?:user|assistant)-(\d+)$/.exec(message.id);
    if (match) max = Math.max(max, Number.parseInt(match[1]!, 10));
  }
  return max;
};

export type RepositoryChatHydrationAction = "already_hydrated" | "apply_store" | "skip_local";

export const shouldMarkRepositoryChatUserEditedBeforeHydration = (input: {
  persistReady: boolean;
  querySuccess: boolean;
}): boolean => !input.persistReady && input.querySuccess;

export const resolveRepositoryChatHydrationAction = (input: {
  hydratedProjectPath: string | null;
  projectPath: string;
  querySuccess: boolean;
  userEditedBeforeHydration: boolean;
  streaming: boolean;
  messageCount: number;
  threadId: string | null;
}): RepositoryChatHydrationAction => {
  if (!input.querySuccess) return "already_hydrated";
  if (input.hydratedProjectPath === input.projectPath) return "already_hydrated";
  if (
    input.streaming ||
    input.messageCount > 0 ||
    input.threadId ||
    input.userEditedBeforeHydration
  ) {
    return "skip_local";
  }
  return "apply_store";
};

const emptyRepositoryChatPanelState = (): {
  threadId: null;
  messages: RepositoryChatMessage[];
  draft: string;
  messageSequence: number;
} => ({
  threadId: null,
  messages: [],
  draft: "",
  messageSequence: 0
});

const nextRepositoryChatRequestId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `rch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

type TicketReferenceMenuRect = {
  left: number;
  top: number;
  bottom: number;
  width: number;
};

export type TicketReferenceMenuLayout = {
  placement: "above" | "below";
  style: CSSProperties;
};

export type TicketReferenceMenuLayoutInput = {
  anchorRect: TicketReferenceMenuRect;
  footerTop?: number | null;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
  desiredMaxHeight?: number;
  minimumUsableHeight?: number;
};

export const TOAST_AUTO_DISMISS_MS = 5000;

export const toastRole = (toast: Exclude<Toast, null>): "alert" | "status" => (toast.kind === "error" ? "alert" : "status");

export const scheduleToastDismissal = (
  toast: Toast,
  dismiss: () => void,
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = setTimeout
): ReturnType<typeof setTimeout> | null => {
  if (!toast) return null;
  return schedule(dismiss, TOAST_AUTO_DISMISS_MS);
};

export function ToastNotification({
  toast,
  onDismiss
}: {
  toast: Exclude<Toast, null>;
  onDismiss: () => void;
}): ReactElement {
  return (
    <div className={clsx("toast", toast.kind)} role={toastRole(toast)}>
      <div className="toast-message">{toast.message}</div>
      <IconButton className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={16} />
      </IconButton>
    </div>
  );
}

export const getTicketReferenceMenuLayout = ({
  anchorRect,
  footerTop,
  viewportWidth,
  viewportHeight,
  gap = 6,
  margin = 12,
  desiredMaxHeight = 260,
  minimumUsableHeight = 160
}: TicketReferenceMenuLayoutInput): TicketReferenceMenuLayout => {
  const maxHeight = Math.min(desiredMaxHeight, Math.floor(viewportHeight * 0.48));
  const footerBoundary = footerTop === null || footerTop === undefined ? viewportHeight - margin : footerTop - margin;
  const belowBoundary = Math.min(viewportHeight - margin, footerBoundary);
  const spaceBelow = Math.max(0, belowBoundary - anchorRect.bottom - gap);
  const spaceAbove = Math.max(0, anchorRect.top - margin - gap);
  const usableHeight = Math.min(minimumUsableHeight, maxHeight);
  const placement = spaceBelow >= usableHeight || spaceBelow >= spaceAbove ? "below" : "above";
  const availableHeight = placement === "below" ? spaceBelow : spaceAbove;
  const width = Math.min(anchorRect.width, Math.max(160, viewportWidth - margin * 2));
  const left = Math.max(margin, Math.min(anchorRect.left, viewportWidth - margin - width));
  const style: CSSProperties = {
    position: "fixed",
    zIndex: 80,
    left,
    right: "auto",
    width,
    maxHeight: Math.max(80, Math.min(maxHeight, availableHeight))
  };

  if (placement === "below") {
    style.top = anchorRect.bottom + gap;
    style.bottom = "auto";
  } else {
    style.top = "auto";
    style.bottom = viewportHeight - anchorRect.top + gap;
  }

  return { placement, style };
};

const priorityOptions: TicketPriority[] = ["low", "medium", "high", "urgent"];
const ticketEffortOptions: TicketEffort[] = ["low", "medium", "high", "xhigh"];
export type FloatingComposerDraftType = "epic" | "feature";
const floatingComposerDraftTypeOptions: FloatingComposerDraftType[] = ["epic", "feature"];
const draftScopeLabel = (scope: "auto" | DraftScope): string => {
  switch (scope) {
    case "auto":
      return "Auto";
    case "quick_bug":
      return "Quick Bug";
    case "task":
      return "Task";
    case "product_feature":
      return "Product Feature";
    case "rewrite":
      return "Rewrite";
    case "epic":
      return "Epic";
  }
};

const floatingComposerDraftTypeLabel = (value: FloatingComposerDraftType): string => {
  switch (value) {
    case "epic":
      return "Epic";
    case "feature":
      return "Feature";
  }
};

export const getFloatingComposerDraftInput = ({
  projectPath,
  idea,
  priority,
  effort,
  agentModel,
  selectedProviderId,
  draftType
}: {
  projectPath: string;
  idea: string;
  priority: TicketPriority;
  effort?: TicketEffort;
  agentModel?: CursorAgentModel;
  selectedProviderId: AgentProviderId;
  draftType: FloatingComposerDraftType;
}): CreateDraftInput => {
  const baseInput = {
    projectPath,
    idea,
    priority,
    runIntake: true,
    ...(selectedProviderId === "cursor"
      ? { agentModel: agentModel ?? "auto" }
      : { effort: effort ?? "medium" })
  } satisfies CreateDraftInput;

  switch (draftType) {
    case "epic":
      return {
        ...baseInput,
        preferredTicketType: "epic",
        draftScope: "epic"
      };
    case "feature":
      return {
        ...baseInput,
        preferredTicketType: "feature",
        draftScope: "product_feature"
      };
  }
};

const gitMetadataError = (message: string): GitMetadata => ({
  state: "error",
  isGitRepository: false,
  branchName: null,
  isDetachedHead: false,
  commitSha: null,
  isDirty: false,
  changedFileCount: null,
  message,
  error: message,
  updatedAt: new Date().toISOString()
});

const projectDisclosureTargetId = (project: ProjectSummary, index: number): string => {
  const stableKey = project.projectId ?? `${project.name}-${index}-${project.path}`;
  return `project-swimlanes-${stableKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
};

const taskCountLabel = (count: number): string => `${count} ${count === 1 ? "task" : "tasks"}`;
const activeTaskCountLabel = (count: number): string => `${count} active ${count === 1 ? "task" : "tasks"}`;

const runLabel = (status: RunStatus): string => {
  switch (status) {
    case "idle":
      return "Idle";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    case "completed":
      return "Agent Done";
    case "cancelled":
      return "Cancelled";
    case "drafting":
      return "Drafting";
    case "draft_failed":
      return "Draft Failed";
    case "draft_complete":
      return "Draft Ready";
    default:
      return "Idle";
  }
};

import {
  isRunStatusFailure,
  TicketAuthoringStatePill,
  TicketBoardFailedIcon,
  TicketChecklistPill,
  TicketRunElapsedPill,
  TicketRunStatusPill
} from "./components/TicketCardPills";

export {
  isRunStatusFailure,
  TicketAuthoringStatePill,
  TicketBoardFailedIcon,
  TicketChecklistPill,
  TicketRunElapsedPill,
  TicketRunStatusPill
} from "./components/TicketCardPills";

export const canRedraftTicket = (ticket: TicketRecord): boolean =>
  ticket.frontMatter.runStatus === "draft_failed" ||
  ticket.frontMatter.runStatus === "draft_complete" ||
  ticket.frontMatter.authoringState === "reviewing";

export function DraftingTicketDetailLoading({ title }: { title: string }): ReactElement {
  return (
    <section className="draft-loading-panel" aria-label="Ticket draft loading state">
      <Loader2 className="spin" size={22} aria-hidden="true" />
      <div>
        <h3>Drafting ticket</h3>
        <p>The agent is preparing the generated ticket content for {title}.</p>
      </div>
    </section>
  );
}

export function CreateTicketDraftMessage({
  kind,
  message,
  busy
}: {
  kind: DraftMessageKind;
  message: string;
  busy?: boolean;
}): ReactElement {
  return (
    <div className={clsx("draft-message", kind)} role={kind === "error" ? "alert" : "status"}>
      {busy && <Loader2 className="spin" size={15} />}
      <span>{message}</span>
    </div>
  );
}

export function DraftIntakeQuestionsPanel({
  intake,
  answerDrafts,
  onAnswerChange,
  onContinue,
  busy
}: {
  intake: DraftIntakeResult;
  answerDrafts: Record<number, string>;
  onAnswerChange: (index: number, value: string) => void;
  onContinue: () => void;
  busy?: boolean;
}): ReactElement {
  const unanswered = intake.questions.some((question, index) => !(answerDrafts[index] ?? question.recommendedAnswer).trim());
  return (
    <section className="draft-intake-panel" aria-label="Draft intake questions">
      <header>
        <div>
          <h3>{draftScopeLabel(intake.scope)} intake</h3>
          <p>Answer the blockers before Relay writes the ticket draft.</p>
        </div>
        <span>{Math.round(intake.confidence * 100)}% confidence</span>
      </header>
      {intake.knownFacts.length > 0 && (
        <div className="draft-intake-facts">
          {intake.knownFacts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
      )}
      <div className="draft-intake-questions">
        {intake.questions.map((question: DraftIntakeQuestion, index) => (
          <article className="draft-intake-question" key={`${question.question}-${index}`}>
            <h4>{question.question}</h4>
            <p>{question.whyItMatters}</p>
            <Field>
              <span>Recommended answer</span>
              <Textarea value={answerDrafts[index] ?? question.recommendedAnswer} onChange={(event) => onAnswerChange(index, event.target.value)} />
            </Field>
          </article>
        ))}
      </div>
      <Button className="primary-button" onClick={onContinue} disabled={busy || unanswered}>
        {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
        Continue Draft
      </Button>
    </section>
  );
}

export function TicketSummaryPreview({ summary }: { summary: string }): ReactElement {
  const summarySource = summary.trim() || "_No summary yet._";

  return (
    <section className="ticket-summary-panel" aria-label="Ticket summary">
      <Field className="ticket-summary-field">
        <span>Summary</span>
        <MarkdownBlock className="ticket-summary-preview" source={summarySource} showCopy={false} compact />
      </Field>
    </section>
  );
}

export function TicketFullBodyPanel({
  mode = "preview",
  markdown,
  disabled = false,
  attachmentDropActive = false,
  editorRef,
  onBack,
  onModeChange,
  onMarkdownChange,
  onDragOver,
  onDragLeave,
  onDrop
}: {
  mode?: TicketMarkdownMode;
  markdown: string;
  disabled?: boolean;
  attachmentDropActive?: boolean;
  editorRef?: Ref<HTMLTextAreaElement>;
  onBack: () => void;
  onModeChange?: (mode: TicketMarkdownMode) => void;
  onMarkdownChange?: (markdown: string) => void;
  onDragOver?: (event: DragEvent<HTMLTextAreaElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLTextAreaElement>) => void;
  onDrop?: (event: DragEvent<HTMLTextAreaElement>) => void;
}): ReactElement {
  return (
    <section className="ticket-detail-full-body" aria-label="Full ticket">
      <div className="ticket-detail-full-body-toolbar">
        <Button type="button" className="ticket-detail-full-body-back" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to ticket
        </Button>
      </div>
      <TicketMarkdownTabs
        mode={mode}
        markdown={markdown}
        disabled={disabled}
        attachmentDropActive={attachmentDropActive}
        editorRef={editorRef}
        onModeChange={onModeChange}
        onMarkdownChange={onMarkdownChange}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />
    </section>
  );
}

export function TicketMarkdownTabs({
  mode = "preview",
  markdown,
  disabled = false,
  attachmentDropActive = false,
  editorRef,
  onModeChange,
  onMarkdownChange,
  onDragOver,
  onDragLeave,
  onDrop
}: {
  mode?: TicketMarkdownMode;
  markdown: string;
  disabled?: boolean;
  attachmentDropActive?: boolean;
  editorRef?: Ref<HTMLTextAreaElement>;
  onModeChange?: (mode: TicketMarkdownMode) => void;
  onMarkdownChange?: (markdown: string) => void;
  onDragOver?: (event: DragEvent<HTMLTextAreaElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLTextAreaElement>) => void;
  onDrop?: (event: DragEvent<HTMLTextAreaElement>) => void;
}): ReactElement {
  const bodySource = stripPlannedFileScopeSection(markdown).trim() || "_No ticket body yet._";

  return (
    <section className={clsx("ticket-markdown-tabs", mode === "edit" && "edit-mode")} aria-label="Full ticket body">
      <div className="ticket-markdown-tablist" role="tablist" aria-label="Full ticket body view">
        <Button
          type="button"
          className={clsx("ticket-markdown-tab", mode === "preview" && "active")}
          role="tab"
          id="ticket-markdown-preview-tab"
          aria-selected={mode === "preview"}
          aria-controls="ticket-markdown-preview-panel"
          onClick={() => onModeChange?.("preview")}
        >
          Preview
        </Button>
        <Button
          type="button"
          className={clsx("ticket-markdown-tab", mode === "edit" && "active")}
          role="tab"
          id="ticket-markdown-edit-tab"
          aria-selected={mode === "edit"}
          aria-controls="ticket-markdown-edit-panel"
          onClick={() => onModeChange?.("edit")}
        >
          Edit
        </Button>
      </div>

      {mode === "preview" ? (
        <div
          className="ticket-markdown-tab-panel ticket-markdown-preview-panel"
          id="ticket-markdown-preview-panel"
          role="tabpanel"
          aria-labelledby="ticket-markdown-preview-tab"
        >
          <MarkdownBlock className="ticket-markdown-preview" source={bodySource} showCopy={false} />
        </div>
      ) : (
        <div className="ticket-markdown-tab-panel ticket-markdown-edit-panel" id="ticket-markdown-edit-panel" role="tabpanel" aria-labelledby="ticket-markdown-edit-tab">
          <Textarea
            ref={editorRef}
            className={clsx("markdown-editor detail-markdown", attachmentDropActive && "drop-active")}
            value={markdown}
            onChange={(event) => onMarkdownChange?.(event.target.value)}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            disabled={disabled}
            readOnly={!onMarkdownChange}
            aria-label="Ticket body markdown"
          />
        </div>
      )}
    </section>
  );
}

type TicketDetailPrimaryClarificationsProps = {
  questions: ClarificationQuestion[];
  answerDrafts: Record<string, string>;
  submittingId: string | null;
  actionQuestionIds?: ReadonlySet<string>;
  actionSubmittingId?: string | null;
  onDraftChange: (questionId: string, answer: string) => void;
  onSubmit: (questionId: string) => void;
  onAction?: (questionId: string) => void;
};

export function TicketDetailPrimaryClarifications({
  questions,
  answerDrafts,
  submittingId,
  actionQuestionIds,
  actionSubmittingId,
  onDraftChange,
  onSubmit,
  onAction
}: TicketDetailPrimaryClarificationsProps): ReactElement | null {
  if (questions.length === 0) return null;

  return (
    <ClarificationPanel
      className="ticket-detail-primary-clarifications"
      variant="primary"
      ariaLabel="Pending clarification questions"
      title="Pending Clarifications"
      summary={`${questions.length} pending`}
      questions={questions}
      answerDrafts={answerDrafts}
      submittingId={submittingId}
      actionQuestionIds={actionQuestionIds}
      actionSubmittingId={actionSubmittingId}
      onDraftChange={onDraftChange}
      onSubmit={onSubmit}
      onAction={onAction}
    />
  );
}

const ticketTypeLabel = (ticketType: TicketType): string => {
  switch (ticketType) {
    case "epic":
      return "Epic";
    case "feature":
      return "Feature";
    default:
      return "Task";
  }
};

const ticketEffortLabel = (effort: TicketEffort): string => {
  switch (effort) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "xhigh":
      return "Extra High";
  }
};

const labelsFromInput = (value: string): string[] =>
  value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

const sameStringArray = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((item, index) => item === right[index]);

const manualFeatureMarkdown = (childTitle: string, parentTitle: string): string => `# ${childTitle}

## Context

Parent epic: ${parentTitle}

Feature under ${parentTitle}.

## Codebase Findings

- None.

## Requirements

- Define the unique scope for this child task before starting implementation.

## Implementation Plan

- Review the parent epic context and narrow this ticket to one implementation path.

## Test Plan

- Run the relevant focused validation for the child task once implemented.

## Acceptance Criteria

- The child task has specific acceptance criteria before work starts.

## Assumptions / Open Questions

- None.

## Implementation Notes

- None.

## Codex Handoff

No Codex run has been started.
`;

const statusName = (columns: RelayColumn[], status: string): string =>
  columns.find((column) => column.id === status)?.name ?? status;

const STANDARD_EMPTY_COLUMN_MESSAGES: Record<string, { title: string; detail: string }> = {
  todo: {
    title: "No tickets to triage",
    detail: "New work appears here before it is prioritized."
  },
  ready: {
    title: "Ready queue is empty",
    detail: "Prioritized tickets will wait here before implementation starts."
  },
  "in progress": {
    title: "Nothing in progress",
    detail: "Active implementation tickets will show here while work is underway."
  },
  "needs clarification": {
    title: "No questions pending",
    detail: "Tickets needing product or implementation answers will pause here."
  },
  review: {
    title: "Nothing awaiting review",
    detail: "Completed agent work will land here for final checks."
  },
  completed: {
    title: "No completed tickets yet",
    detail: "Accepted tickets will appear here after review is finished."
  }
};

export const emptyColumnMessage = (columnName: string): { title: string; detail: string } => {
  const normalizedName = columnName.trim().toLowerCase().replace(/\s+/g, " ");
  const standardMessage = STANDARD_EMPTY_COLUMN_MESSAGES[normalizedName];
  if (standardMessage) return standardMessage;

  const displayName = columnName.trim() || "This column";
  return {
    title: `${displayName} is clear`,
    detail: "Tickets will settle here when work reaches this stage."
  };
};

export type CodexStatusDisplayOptions = {
  readonly isLoading?: boolean;
  readonly isError?: boolean;
};

export const getCodexStatusDisplay = (
  codexStatus: CodexStatus | undefined,
  options: CodexStatusDisplayOptions = {}
): { tone: CodexRailTone; label: string } => {
  const isLoading = options.isLoading ?? false;
  const isError = options.isError ?? false;

  if (!codexStatus) {
    if (isLoading) {
      return { tone: "loading", label: "Codex: Checking..." };
    }
    if (isError) {
      return { tone: "error", label: "Codex: Unavailable" };
    }
    return { tone: "loading", label: "Codex: Checking..." };
  }
  if (codexStatus.authenticated === null) {
    if (!codexStatus.cliAvailable) {
      return { tone: "error", label: "Codex: Not installed" };
    }
    return { tone: "warning", label: "Codex: Not connected" };
  }
  if (!codexStatus.cliAvailable) {
    return { tone: "error", label: "Codex: Not installed" };
  }
  if (codexStatus.authenticated === true) {
    return { tone: "ok", label: "Codex: Connected" };
  }
  return { tone: "warning", label: "Codex: Not connected" };
};

export const codexStatusConnected = (tone: CodexRailTone): boolean => tone === "ok";

/** @deprecated Use {@link getCodexStatusDisplay}. */
export const getCodexStatusRailDisplay = getCodexStatusDisplay;

type ProviderInventoryDisplayOptions = {
  readonly isLoading?: boolean;
  readonly isError?: boolean;
};

const providerOrder = ["codex", "cursor", "claude"] as const;

const orderedProviderRecords = (inventory: AgentProviderInventory | undefined): AgentProviderRecord[] => {
  if (!inventory) return [];
  const byId = new Map(inventory.providers.map((provider) => [provider.id, provider] as const));
  return providerOrder.map((providerId) => byId.get(providerId)).filter((provider): provider is AgentProviderRecord => Boolean(provider));
};

const selectedProviderRecord = (inventory: AgentProviderInventory | undefined): AgentProviderRecord | undefined =>
  inventory?.providers.find((provider) => provider.id === inventory.selectedProviderId);

const providerDisplayTone = (provider: AgentProviderRecord): CodexRailTone => {
  if (provider.status === "ready") return "ok";
  if (provider.installState === "not_installed" || provider.status === "unavailable") return "error";
  if (provider.authState === "unauthenticated" || provider.status === "unauthenticated") return "warning";
  return "warning";
};

const providerConnectedLabel = (provider: AgentProviderRecord): string => {
  if (provider.status === "ready") return "Connected";
  if (provider.installState === "not_installed" || provider.status === "unavailable") return "Not installed";
  if (provider.authState === "unauthenticated" || provider.status === "unauthenticated") return "Not connected";
  return "Status unknown";
};

const providerSelectorStatusCopy = (provider: AgentProviderRecord): string => {
  if (provider.status === "ready") return "Installed and connected";
  if (provider.installState === "not_installed") return "Not installed";
  if (provider.authState === "unauthenticated" || provider.status === "unauthenticated") return "Installed, sign in required";
  if (provider.installState === "installed" && provider.status === "unknown") return "Installed, status unknown";
  if (provider.installState === "unknown") return "Install status unknown";
  return "Status unavailable";
};

const isBoilerplateProviderMessage = (provider: AgentProviderRecord): boolean => {
  const { message, label, status } = provider;
  if (status === "ready" && message === `${label} is available.`) return true;
  if (status === "unavailable" && (message === `${label} is not installed.` || message.includes("not found on PATH"))) return true;
  if (status === "unauthenticated" && message.includes("could not find authentication")) return true;
  if (status === "unknown" && message === `${label} status could not be determined.`) return true;
  return false;
};

const providerSelectorDetailMessage = (provider: AgentProviderRecord): string | null => {
  const message = provider.message.trim();
  if (!message || isBoilerplateProviderMessage(provider)) return null;
  if (message === providerSelectorStatusCopy(provider)) return null;
  return message;
};

const providerDisabledReason = (
  inventory: AgentProviderInventory,
  provider: AgentProviderRecord,
  isSelected: boolean
): string | null => {
  if (isSelected) return null;
  if (!inventory.switchability.canSwitch) {
    return inventory.switchability.message ?? "Finish active provider work before switching CLIs.";
  }
  if (provider.canSelect) return null;
  switch (provider.blockedReasonCode) {
    case "provider_unauthenticated":
      return "Sign in before Relay can use this CLI.";
    case "provider_unavailable":
      return `${provider.label} must be installed before Relay can use it.`;
    case "provider_status_unknown":
      return `${provider.label} status could not be verified.`;
    case "busy":
      return provider.blockedReasonMessage ?? "Finish active provider work before switching CLIs.";
    default:
      return provider.blockedReasonMessage ?? null;
  }
};

export const getProviderInventoryDisplay = (
  inventory: AgentProviderInventory | undefined,
  options: ProviderInventoryDisplayOptions = {}
): { tone: CodexRailTone; label: string } => {
  const isLoading = options.isLoading ?? false;
  const isError = options.isError ?? false;
  const selectedProvider = selectedProviderRecord(inventory);

  if (!selectedProvider) {
    if (isLoading) return { tone: "loading", label: "CLI: Checking..." };
    if (isError) return { tone: "error", label: "CLI: Unavailable" };
    return { tone: "loading", label: "CLI: Checking..." };
  }

  return {
    tone: providerDisplayTone(selectedProvider),
    label: `${selectedProvider.label}: ${providerConnectedLabel(selectedProvider)}`
  };
};

export function CodexCollapsedStatusIndicator({
  providerInventory,
  isLoading = false,
  isError = false,
  isRefreshing = false,
  onOpenSelector
}: {
  providerInventory: AgentProviderInventory | undefined;
  isLoading?: boolean;
  isError?: boolean;
  isRefreshing?: boolean;
  onOpenSelector: () => void;
}): ReactElement {
  const display = getProviderInventoryDisplay(providerInventory, { isLoading, isError });
  const connected = codexStatusConnected(display.tone);
  const busy = isLoading || isRefreshing;

  return (
    <Button
      type="button"
      className={clsx(
        "sidebar-floating-button",
        "sidebar-codex-indicator-button",
        connected ? "connected" : "disconnected"
      )}
      onClick={onOpenSelector}
      aria-label={display.label}
      title={display.label}
      aria-busy={busy || undefined}
    >
      {busy ? <Loader2 className="spin" size={16} /> : connected ? <PlugZap size={16} /> : <Plug size={16} />}
    </Button>
  );
}

export function CodexSidebarStatus({
  providerInventory,
  isLoading = false,
  isError = false,
  isRefreshing = false,
  onOpenSelector
}: {
  providerInventory: AgentProviderInventory | undefined;
  isLoading?: boolean;
  isError?: boolean;
  isRefreshing?: boolean;
  onOpenSelector: () => void;
}): ReactElement {
  const display = getProviderInventoryDisplay(providerInventory, { isLoading, isError });
  const connected = codexStatusConnected(display.tone);

  return (
    <Button
      type="button"
      className={clsx("sidebar-codex-status", display.tone, connected && "connected")}
      onClick={onOpenSelector}
      aria-label={`Open CLI selector. ${display.label}`}
      title={display.label}
      aria-busy={isRefreshing || undefined}
    >
      <span className="sidebar-codex-status-label">{display.label}</span>
      {isRefreshing ? <Loader2 className="spin" size={12} /> : <Plug size={12} />}
    </Button>
  );
}

/** @deprecated Use {@link CodexSidebarStatus}. */
export const CodexStatusRail = CodexSidebarStatus;

export function CliProviderSelectorModal({
  inventory,
  isLoading = false,
  isError = false,
  isSwitching = false,
  onClose,
  onSelectProvider
}: {
  inventory: AgentProviderInventory | undefined;
  isLoading?: boolean;
  isError?: boolean;
  isSwitching?: boolean;
  onClose: () => void;
  onSelectProvider: (providerId: AgentProviderRecord["id"]) => void;
}): ReactElement {
  useShortcutOverlay({
    id: "provider-selector",
    priority: 25,
    onEscape: () => {
      onClose();
      return true;
    }
  });

  const providers = orderedProviderRecords(inventory);

  return (
    <DialogBackdrop
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Dialog className="modal provider-selector-modal" aria-labelledby="provider-selector-title">
        <header>
          <div>
            <h2 id="provider-selector-title">Choose agent CLI</h2>
            <p>Select which installed CLI Relay should use for agent runs.</p>
          </div>
          <div className="provider-selector-header-actions">
            <IconButton type="button" className="icon-button" onClick={onClose} aria-label="Close CLI selector" title="Close CLI selector">
              <X size={16} />
            </IconButton>
          </div>
        </header>
        {!inventory?.switchability.canSwitch && inventory?.switchability.message ? (
          <div className="provider-selector-banner" role="status">
            {inventory.switchability.message}
          </div>
        ) : null}
        {inventory ? (
          <div className="provider-selector-list" role="list" aria-label="CLI providers">
            {providers.map((provider) => {
              const isSelected = inventory.selectedProviderId === provider.id;
              const disabledReason = providerDisabledReason(inventory, provider, isSelected);
              const detailMessage = providerSelectorDetailMessage(provider);
              const actionDisabled = isSelected || Boolean(disabledReason) || isSwitching;

              return (
                <section className={clsx("provider-selector-row", isSelected && "selected")} key={provider.id} role="listitem">
                  <div className="provider-selector-copy">
                    <div className="provider-selector-heading">
                      <h3>{provider.label}</h3>
                      {provider.version ? <span className="provider-selector-version">{provider.version}</span> : null}
                    </div>
                    <p className="provider-selector-status">{providerSelectorStatusCopy(provider)}</p>
                    {detailMessage ? <p className="provider-selector-message">{detailMessage}</p> : null}
                    {disabledReason ? <p className="provider-selector-disabled-reason">{disabledReason}</p> : null}
                  </div>
                  <div className="provider-selector-action">
                    <Button
                      type="button"
                      className={clsx(isSelected && "primary-button")}
                      disabled={actionDisabled}
                      aria-current={isSelected ? "true" : undefined}
                      onClick={() => onSelectProvider(provider.id)}
                    >
                      {isSelected ? "In use" : "Use CLI"}
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="provider-selector-empty" role="status">
            {isError ? "Unable to load CLI status. Refresh and try again." : isLoading ? "Checking available CLIs..." : "No CLI status available."}
          </div>
        )}
      </Dialog>
    </DialogBackdrop>
  );
}

// Markdown audit: create-ticket drafts, ticket detail bodies, clarification text,
// and generated Codex completion/final-response console events use MarkdownBlock.
// Board excerpts and command output stay plain text because they are summaries/logs.
const copyToast = (kind: "markdown" | "code"): Toast => ({
  kind: "success",
  message: kind === "code" ? "Code copied." : "Markdown source copied."
});

export const openProjectInEditorFromHeader = async (
  projectPath: string,
  editorId: ProjectEditorId,
  setToast: (toast: Toast) => void,
  openInEditor: (input: ProjectOpenInEditorInput) => Promise<ProjectOpenInEditorResult> = relayOpenProjectInEditor
): Promise<void> => {
  try {
    const result = await openInEditor({ projectPath, editorId });
    if (!result.ok) {
      setToast({ kind: "error", message: result.message });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relay could not open this project in the selected editor.";
    setToast({ kind: "error", message });
  }
};

export function ProjectEditorDropdown({
  projectPath,
  onOpen
}: {
  projectPath: string;
  onOpen: (projectPath: string, editorId: ProjectEditorId) => void;
}): ReactElement {
  return (
    <Dropdown className="project-editor-dropdown">
      <Code2 size={14} aria-hidden="true" />
      <span className="sr-only">Open project in editor</span>
      <DropdownSelect
        aria-label="Open project in editor"
        value=""
        onChange={(event) => {
          const editorId = event.currentTarget.value as ProjectEditorId;
          if (editorId) onOpen(projectPath, editorId);
          event.currentTarget.value = "";
        }}
      >
        <option value="" disabled>
          Open in editor
        </option>
        <option value="vscode">VS Code</option>
        <option value="cursor">Cursor</option>
      </DropdownSelect>
    </Dropdown>
  );
}

export function ProjectSidebar({
  projects,
  selectedPath,
  loading,
  onAdd,
  onSelect,
  onRemove,
  onReveal,
  onToggleVisibility,
  toggleShortcutLabel,
  providerInventory,
  providerInventoryLoading,
  providerInventoryError,
  providerInventoryRefreshing,
  onOpenProviderSelector,
  defaultExpandedProjectPaths = []
}: {
  projects: ProjectSummary[];
  selectedPath: string | null;
  loading: boolean;
  onAdd: () => void;
  onSelect: (projectPath: string) => void;
  onRemove: (projectPath: string) => void;
  onReveal: (projectPath: string) => void;
  onToggleVisibility: () => void;
  toggleShortcutLabel: string;
  providerInventory: AgentProviderInventory | undefined;
  providerInventoryLoading: boolean;
  providerInventoryError: boolean;
  providerInventoryRefreshing: boolean;
  onOpenProviderSelector: () => void;
  defaultExpandedProjectPaths?: string[];
}): ReactElement {
  const [expandedProjectPaths, setExpandedProjectPaths] = useState<Set<string>>(
    () => new Set([...defaultExpandedProjectPaths, ...(selectedPath ? [selectedPath] : [])])
  );

  useEffect(() => {
    if (!selectedPath) return;
    setExpandedProjectPaths((current) => {
      if (current.has(selectedPath)) return current;
      const next = new Set(current);
      next.add(selectedPath);
      return next;
    });
  }, [selectedPath]);

  const handleProjectClick = useCallback(
    (projectPath: string): void => {
      onSelect(projectPath);
      setExpandedProjectPaths((current) => {
        const next = new Set(current);
        if (selectedPath === projectPath && next.has(projectPath)) {
          next.delete(projectPath);
        } else {
          next.add(projectPath);
        }
        return next;
      });
    },
    [onSelect, selectedPath]
  );

  const hideSidebarTitle = `Hide sidebar (${toggleShortcutLabel})`;

  return (
    <aside id="project-sidebar" className="sidebar" aria-label="Projects">
      <div className="sidebar-heading">
        <span>Projects</span>
        <div className="sidebar-heading-actions">
          <Button
            type="button"
            className="sidebar-icon-button"
            onClick={onToggleVisibility}
            aria-label={hideSidebarTitle}
            title={hideSidebarTitle}
            aria-controls="project-sidebar"
            aria-expanded={true}
            aria-keyshortcuts="Meta+B Control+B"
          >
            <PanelLeftClose size={16} />
          </Button>
          <Button type="button" className="sidebar-icon-button" onClick={onAdd} disabled={loading} aria-label="Add project">
            {loading ? <Loader2 className="spin" size={16} /> : <FolderPlus size={16} />}
          </Button>
        </div>
      </div>

      <div className="sidebar-list" role="list">
        {projects.map((project, index) => {
          const expanded = expandedProjectPaths.has(project.path);
          const swimlaneListId = projectDisclosureTargetId(project, index);
          const ProjectFolderIcon = expanded ? FolderOpen : Folder;
          const projectActiveLabel = project.activeRunCount > 0 ? `, ${activeTaskCountLabel(project.activeRunCount)}` : "";
          return (
            <div className="project-group" key={project.path} role="listitem">
              <div
                className={clsx("project-folder-row", selectedPath === project.path && "selected", expanded && "expanded")}
              >
                <button
                  type="button"
                  className="project-folder-main"
                  onClick={() => handleProjectClick(project.path)}
                  aria-current={selectedPath === project.path ? "page" : undefined}
                  aria-expanded={expanded}
                  aria-controls={swimlaneListId}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${project.name} swimlanes${projectActiveLabel}`}
                >
                  <ProjectFolderIcon className="project-folder-icon" size={18} aria-hidden="true" />
                  <span className="project-folder-name" title={project.name}>
                    {project.name}
                  </span>
                  <span className="project-folder-status" aria-hidden="true">
                    {project.health !== "ok" && <AlertTriangle size={13} />}
                    {project.activeRunCount > 0 && (
                      <span className="project-folder-active" title={activeTaskCountLabel(project.activeRunCount)}>
                        <CircleDashed size={13} />
                      </span>
                    )}
                  </span>
                </button>
                <div className="project-folder-actions">
                  <Button
                    type="button"
                    className="project-folder-action-button"
                    onClick={() => onReveal(project.path)}
                    aria-label={`Reveal ${project.name} in Finder`}
                    title="Reveal in Finder"
                  >
                    <Eye size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    className="project-folder-action-button"
                    onClick={() => onRemove(project.path)}
                    aria-label={`Remove ${project.name} from Relay`}
                    title="Remove from Relay"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {expanded && (
                <div id={swimlaneListId} className="project-swimlane-list" role="list" aria-label={`${project.name} swimlanes`}>
                  {project.swimlanes.length > 0 ? (
                    project.swimlanes.map((swimlane) => {
                      const hasActiveRun =
                        swimlane.id === RELAY_IN_PROGRESS_STATUS && swimlane.activeRunCount > 0;
                      const activeLabel = hasActiveRun ? `, ${activeTaskCountLabel(swimlane.activeRunCount)}` : "";
                      return (
                        <div
                          className={clsx("project-swimlane-row", hasActiveRun && "active")}
                          key={swimlane.id}
                          role="listitem"
                          aria-label={`${swimlane.name}: ${taskCountLabel(swimlane.ticketCount)}${activeLabel}`}
                        >
                          <span className="project-swimlane-name" title={swimlane.name}>
                            {swimlane.name}
                          </span>
                          <span className="project-swimlane-meta">
                            {hasActiveRun && (
                              <span className="project-swimlane-active" title={activeTaskCountLabel(swimlane.activeRunCount)} aria-hidden="true">
                                <Loader2 className="spin" size={12} />
                              </span>
                            )}
                            <span className="project-swimlane-count" aria-hidden="true">
                              {swimlane.ticketCount}
                            </span>
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="project-swimlane-empty" role="listitem">
                      No swimlanes
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <CodexSidebarStatus
          providerInventory={providerInventory}
          isLoading={providerInventoryLoading}
          isError={providerInventoryError}
          isRefreshing={providerInventoryRefreshing}
          onOpenSelector={onOpenProviderSelector}
        />
      </div>
    </aside>
  );
}

const boardColumnStageIcons: Partial<Record<string, LucideIcon>> = {
  [RELAY_READY_STATUS]: Play,
  [RELAY_IN_PROGRESS_STATUS]: Loader2,
  [RELAY_NEEDS_CLARIFICATION_STATUS]: CircleHelp,
  [RELAY_REVIEW_STATUS]: Eye,
  [RELAY_NOT_DOING_STATUS]: Ban
};

function BoardColumnsGrid({
  boardRef,
  className,
  tabIndex,
  ariaDescribedBy,
  ariaKeyshortcuts,
  visibleColumns,
  allTickets,
  columns,
  selectedTicketId,
  onOpen,
  onTicketFocus,
  onTicketButtonRef,
  onArchiveEpic,
  onArchiveFeature,
  onArchiveTask,
  onArchiveAllCompleted,
  archiveAllCompletedDisabled = false,
  archiveAllCompletedBusy = false,
  now
}: {
  boardRef: RefObject<HTMLDivElement | null>;
  className?: string;
  tabIndex?: number;
  ariaDescribedBy?: string;
  ariaKeyshortcuts?: string;
  visibleColumns: readonly RelayColumn[];
  allTickets: readonly TicketSummary[];
  columns: readonly RelayColumn[];
  selectedTicketId: string | null;
  onOpen: (ticketId: string) => void;
  onTicketFocus: (ticketId: string) => void;
  onTicketButtonRef: (ticketId: string, node: HTMLButtonElement | null) => void;
  onArchiveEpic?: (epicId: string) => void;
  onArchiveFeature?: (featureId: string) => void;
  onArchiveTask?: (taskId: string) => void;
  onArchiveAllCompleted?: () => void;
  archiveAllCompletedDisabled?: boolean;
  archiveAllCompletedBusy?: boolean;
  now: number;
}): ReactElement {
  const { activeDrag, dragSourceColumn } = useBoardDragContext();
  const dragging = activeDrag !== null;

  const columnLayouts = useMemo(
    () =>
      visibleColumns.map((column) => {
        const ticketCount = countColumnTicketsForDisplay(column.id, allTickets);
        const isDropTarget = boardColumnAcceptsActiveDrag(column.id, activeDrag, dragSourceColumn);
        const minified = shouldMinifyBoardColumn(column.id, ticketCount, { dragging, isDropTarget });
        return {
          column,
          ticketCount,
          minified,
          gridTrack: boardColumnGridTrack(minified)
        };
      }),
    [activeDrag, allTickets, dragSourceColumn, dragging, visibleColumns]
  );

  const gridTemplateColumns = useMemo(
    () => boardColumnGridTemplateColumns(columnLayouts.map((layout) => layout.gridTrack)),
    [columnLayouts]
  );

  return (
    <div
      ref={boardRef}
      className={clsx("board", dragging && "board-drag-active", className)}
      style={{ gridTemplateColumns }}
      tabIndex={tabIndex}
      aria-describedby={ariaDescribedBy}
      aria-keyshortcuts={ariaKeyshortcuts}
    >
      {columnLayouts.map(({ column, ticketCount, minified }) => (
        <BoardColumn
          key={column.id}
          column={column}
          allTickets={allTickets}
          columns={columns}
          selectedTicketId={selectedTicketId}
          onOpen={onOpen}
          onOpenFeature={onOpen}
          onOpenEpic={onOpen}
          onTicketFocus={onTicketFocus}
          onTicketButtonRef={onTicketButtonRef}
          onArchiveEpic={onArchiveEpic}
          onArchiveFeature={onArchiveFeature}
          onArchiveTask={onArchiveTask}
          onArchiveAllCompleted={onArchiveAllCompleted}
          archiveAllCompletedDisabled={archiveAllCompletedDisabled}
          archiveAllCompletedBusy={archiveAllCompletedBusy}
          now={now}
          minified={minified}
          ticketCount={ticketCount}
        />
      ))}
    </div>
  );
}

function BoardColumn({
  column,
  allTickets,
  columns,
  selectedTicketId,
  onOpen,
  onOpenFeature,
  onOpenEpic,
  onTicketFocus,
  onTicketButtonRef,
  onArchiveEpic,
  onArchiveFeature,
  onArchiveTask,
  onArchiveAllCompleted,
  archiveAllCompletedDisabled = false,
  archiveAllCompletedBusy = false,
  now,
  minified = false,
  ticketCount
}: {
  column: RelayColumn;
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  selectedTicketId: string | null;
  onOpen: (ticketId: string) => void;
  onOpenFeature: (ticketId: string) => void;
  onOpenEpic: (epicId: string) => void;
  onTicketFocus: (ticketId: string) => void;
  onTicketButtonRef: (ticketId: string, node: HTMLButtonElement | null) => void;
  onArchiveEpic?: (epicId: string) => void;
  onArchiveFeature?: (featureId: string) => void;
  onArchiveTask?: (taskId: string) => void;
  onArchiveAllCompleted?: () => void;
  archiveAllCompletedDisabled?: boolean;
  archiveAllCompletedBusy?: boolean;
  now: number;
  minified?: boolean;
  ticketCount: number;
}): ReactElement {
  const emptyMessage = emptyColumnMessage(column.name);
  const boardItems = useMemo(() => organizeColumnBoardItems(column.id, allTickets), [allTickets, column.id]);
  const visibleTicketCount = ticketCount;
  const { setNodeRef, dropTargetClassName, isDropTarget } = useBoardColumnDropTarget(column.id);
  const StageIcon = boardColumnStageIcons[column.id] ?? null;

  return (
    <section
      ref={setNodeRef}
      className={clsx("board-column", minified && "board-column-minified", dropTargetClassName)}
      aria-dropeffect={isDropTarget ? "move" : undefined}
      aria-label={minified ? `${column.name}, ${visibleTicketCount} tickets` : undefined}
    >
      {minified ? (
        <div className="board-column-minified-body">
          <Tooltip label={column.name} placement="below">
            <div className="board-column-minified-icon" aria-hidden="true">
              {StageIcon ? <StageIcon size={20} strokeWidth={1.75} /> : <span className="board-column-minified-fallback">{column.name.slice(0, 1)}</span>}
              <span className="board-column-minified-count">{visibleTicketCount}</span>
            </div>
          </Tooltip>
        </div>
      ) : (
        <>
      <header className="column-header">
        <h2>{column.name}</h2>
        <div className="column-header-actions">
          {column.id === RELAY_COMPLETED_STATUS && onArchiveAllCompleted ? (
            <Button
              type="button"
              className="column-header-archive-all"
              onClick={onArchiveAllCompleted}
              disabled={archiveAllCompletedDisabled || archiveAllCompletedBusy}
              aria-label="Archive all completed features and epics"
              title="Archive all completed features and epics"
            >
              {archiveAllCompletedBusy ? (
                <Loader2 className="spin" size={12} aria-hidden="true" />
              ) : (
                <Archive size={12} aria-hidden="true" />
              )}
              Archive all
            </Button>
          ) : null}
          <span>{visibleTicketCount}</span>
        </div>
      </header>
      <div className="column-body">
        {boardItems.map((item) => {
          if (item.kind === "epic-group") {
            return (
              <EpicBoardGroup
                key={`epic-group-${item.epic.id}`}
                epic={item.epic}
                featureGroups={item.featureGroups}
                allTickets={allTickets}
                columns={columns}
                columnId={column.id}
                selectedTicketId={selectedTicketId}
                onOpenEpic={onOpenEpic}
                onOpenFeature={onOpenFeature}
                onOpenTask={onOpen}
                onTicketFocus={onTicketFocus}
                onTicketButtonRef={onTicketButtonRef}
                onArchiveEpic={onArchiveEpic}
                onArchiveFeature={onArchiveFeature}
                now={now}
              />
            );
          }
          if (item.kind === "feature-group") {
            return (
              <FeatureBoardGroup
                key={`feature-group-${item.feature.id}`}
                feature={item.feature}
                tasks={item.tasks}
                allTickets={allTickets}
                columns={columns}
                columnId={column.id}
                selectedTicketId={selectedTicketId}
                onOpenFeature={onOpenFeature}
                onOpenTask={onOpen}
                onTicketFocus={onTicketFocus}
                onTicketButtonRef={onTicketButtonRef}
                onArchiveFeature={onArchiveFeature}
                now={now}
              />
            );
          }
          return (
            <BoardTicketCard
              key={item.ticket.id}
              ticket={item.ticket}
              allTickets={allTickets}
              columns={columns}
              columnId={column.id}
              selected={item.ticket.id === selectedTicketId}
              onOpen={onOpen}
              onFocus={onTicketFocus}
              onTicketButtonRef={onTicketButtonRef}
              onArchiveTask={onArchiveTask}
              now={now}
            />
          );
        })}
        {visibleTicketCount === 0 && (
          <div className="empty-column">
            <span>{emptyMessage.title}</span>
            <p>{emptyMessage.detail}</p>
          </div>
        )}
      </div>
        </>
      )}
    </section>
  );
}

function BoardTicketCard({
  ticket,
  allTickets,
  columns,
  columnId,
  selected,
  onOpen,
  onFocus,
  onTicketButtonRef,
  onArchiveTask,
  now
}: {
  ticket: TicketSummary;
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  columnId: string;
  selected: boolean;
  onOpen: (ticketId: string) => void;
  onFocus: (ticketId: string) => void;
  onTicketButtonRef: (ticketId: string, node: HTMLButtonElement | null) => void;
  onArchiveTask?: (taskId: string) => void;
  now: number;
}): ReactElement {
  const draggable = ticket.ticketType === "task" && boardColumnDraggable(columnId);
  const showArchive = showTaskArchive(ticket, columnId);
  const { dragSourceColumn } = useBoardDragContext();
  const taskDragItem = { kind: "task" as const, ticketId: ticket.id };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useBoardDraggable(
    boardDragId.task(ticket.id),
    draggable,
    columnId
  );

  return (
    <article
      ref={setNodeRef}
      className={clsx(
        "ticket-card",
        draggable && "ticket-card-draggable",
        isRunStatusFailure(ticket.runStatus) && "ticket-card-run-failed",
        isDragging && "dragging",
        selected && "keyboard-selected"
      )}
      data-drag-id={boardDragId.task(ticket.id)}
    >
      <div className="ticket-card-layout">
        <BoardTaskCardLeading
          ticket={ticket}
          draggable={draggable}
          showArchive={showArchive}
          onArchive={onArchiveTask ? () => onArchiveTask(ticket.id) : undefined}
          moveAriaLabel={boardDragMoveAriaLabel(ticket.title, taskDragItem, dragSourceColumn)}
          setActivatorNodeRef={setActivatorNodeRef}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
        <Button
          type="button"
          ref={(node) => onTicketButtonRef(ticket.id, node)}
          className="card-open"
          data-ticket-id={ticket.id}
          onClick={() => onOpen(ticket.id)}
          onFocus={() => onFocus(ticket.id)}
        >
          <TicketCardContent ticket={ticket} allTickets={allTickets} columns={columns} now={now} compact />
        </Button>
      </div>
    </article>
  );
}

type TicketDetailExecutionActionState = {
  showExecutionControls: boolean;
  showPause: boolean;
  showContinue: boolean;
  showRetry: boolean;
  showRevert: boolean;
  showStartOrResume: boolean;
  showStartNewThread: boolean;
};

export const getScopeRecoveryClarificationActionQuestionIds = (
  ticket: TicketRecord | null,
  clarifications: readonly ClarificationQuestion[]
): string[] => {
  if (!ticket || ticket.frontMatter.ticketType !== "task" || ticket.frontMatter.runStatus !== "blocked") return [];
  if (clarifications.some((question) => !question.answer?.trim())) return [];
  return clarifications
    .filter((question) => isScopeViolationClarificationQuestion(question) && Boolean(question.answer?.trim()))
    .filter((question) => extractScopeViolationRequestedPaths(question).length > 0)
    .map((question) => question.id);
};

export function getTicketDetailExecutionActionState({
  ticketType,
  status,
  runStatus,
  codexThreadId,
  canDiscardPaused,
  columns
}: {
  ticketType: TicketType;
  status: string;
  runStatus: RunStatus;
  codexThreadId: string | null;
  canDiscardPaused: boolean;
  columns: RelayColumn[];
}): TicketDetailExecutionActionState {
  const statusIsTerminal = columns.find((column) => column.id === status)?.terminal ?? status === RELAY_COMPLETED_STATUS;
  const executionEligibleTask = ticketType === "task" && !statusIsTerminal && status !== RELAY_REVIEW_STATUS;

  if (!executionEligibleTask) {
    return {
      showExecutionControls: false,
      showPause: false,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    };
  }

  if (runStatus === "queued" || runStatus === "running" || runStatus === "drafting") {
    return {
      showExecutionControls: true,
      showPause: true,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    };
  }

  if (runStatus === "paused") {
    const canContinuePausedRun = status === RELAY_IN_PROGRESS_STATUS;
    return {
      showExecutionControls: canContinuePausedRun,
      showPause: false,
      showContinue: canContinuePausedRun,
      showRetry: false,
      showRevert: canContinuePausedRun && canDiscardPaused,
      showStartOrResume: false,
      showStartNewThread: false
    };
  }

  if (isImplementationContinuation({ status, runStatus, codexThreadId })) {
    return {
      showExecutionControls: true,
      showPause: false,
      showContinue: false,
      showRetry: true,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    };
  }

  if (status === RELAY_READY_STATUS) {
    const relayManagingRun = runStatus === "queued" || runStatus === "running";
    return {
      showExecutionControls: relayManagingRun,
      showPause: relayManagingRun,
      showContinue: false,
      showRetry: false,
      showRevert: false,
      showStartOrResume: false,
      showStartNewThread: false
    };
  }

  return {
    showExecutionControls: true,
    showPause: false,
    showContinue: false,
    showRetry: false,
    showRevert: false,
    showStartOrResume: true,
    showStartNewThread: Boolean(codexThreadId)
  };
}

export type TicketReviewActionState = {
  showAcceptReject: boolean;
  acceptEnabled: boolean;
};

const REVIEW_ACCEPT_REJECT_TICKET_TYPES = new Set<TicketType>(["task", "feature", "epic"]);

export function getTicketReviewActionState({
  ticketType,
  status,
  columns,
  allTickets = [],
  ticketId
}: {
  ticketType: TicketType;
  status: string;
  columns: RelayColumn[];
  allTickets?: readonly TicketSummary[];
  ticketId?: string;
}): TicketReviewActionState {
  if (status === RELAY_COMPLETED_STATUS || status === RELAY_ARCHIVE_STATUS) {
    return { showAcceptReject: false, acceptEnabled: false };
  }

  const completedStatusAvailable = columns.some((column) => column.id === RELAY_COMPLETED_STATUS);
  const summary = ticketId ? allTickets.find((entry) => entry.id === ticketId) : undefined;
  const readyForBulkAccept =
    summary?.ticketType === "feature"
      ? featureReadyForBulkAccept(summary, allTickets, columns)
      : summary?.ticketType === "epic"
        ? epicReadyForBulkAccept(summary, allTickets, columns)
        : false;
  const showAcceptReject =
    completedStatusAvailable &&
    ((ticketType === "task" && status === RELAY_REVIEW_STATUS) ||
      ((ticketType === "feature" || ticketType === "epic") && (status === RELAY_REVIEW_STATUS || readyForBulkAccept)));
  return {
    showAcceptReject,
    acceptEnabled: showAcceptReject && getReviewAcceptEnabled(summary, allTickets, columns)
  };
}

export function getReviewAcceptEnabled(
  summary: TicketSummary | undefined,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean {
  if (!summary) return false;
  if (summary.ticketType === "task") return summary.status === RELAY_REVIEW_STATUS;
  if (summary.ticketType === "feature") return featureReadyForBulkAccept(summary, allTickets, columns);
  if (summary.ticketType === "epic") return epicReadyForBulkAccept(summary, allTickets, columns);
  return false;
}

export function getContainerTicketStatusNote(ticketType: "epic" | "feature", status: string): string {
  if (status === RELAY_REVIEW_STATUS) {
    if (ticketType === "epic") {
      return "This epic is in Review. Accept moves this epic and every linked feature or task still in Review to Completed once every descendant is in Review or Completed. Reject moves only this epic to Completed.";
    }
    return "This feature is in Review. Accept moves this feature and every linked task in Review to Completed once every linked task is in Review or Completed. Reject moves only this feature to Completed.";
  }
  return ticketType === "epic"
    ? "Epics follow child task columns. Open tasks below to move work across the board."
    : "Features follow child task columns. Open tasks below to move work across the board.";
}

export function BoardView({
  board,
  projectPath,
  onCreated,
  query,
  ticketNavigationEnabled,
  onQuery,
  onToggleRepositoryChat,
  onOpenTicket,
  gitMetadata,
  repositoryChatOpen,
  onOpenProjectInEditor,
  setToast
}: {
  board: BoardSnapshot;
  projectPath: string;
  onCreated: () => void | Promise<void>;
  query: string;
  ticketNavigationEnabled: boolean;
  onQuery: (query: string) => void;
  onToggleRepositoryChat: () => void;
  onOpenTicket: (ticketId: string) => void;
  gitMetadata: GitMetadata | undefined;
  repositoryChatOpen: boolean;
  onOpenProjectInEditor: (input: ProjectOpenInEditorInput) => Promise<ProjectOpenInEditorResult>;
  setToast: (toast: Toast) => void;
}): ReactElement {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const ticketButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [dragDropBusy, setDragDropBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const preflightRunMutation = usePreflightRunMutation();
  const startRunMutation = useStartRunMutation();
  const cancelRunMutation = useCancelRunMutation();
  const moveTicketMutation = useMoveTicketMutation();
  const archiveTicketMutation = useArchiveTicketMutation();
  const archiveStatusAvailable = useMemo(
    () => board.columns.some((column) => column.id === RELAY_ARCHIVE_STATUS),
    [board.columns]
  );
  const visibleColumns = useMemo(() => boardVisibleColumns(board.columns), [board.columns]);
  const archiveBundle = useCallback(
    async (containerId: string, bundleIds: string[], successMessage: string): Promise<void> => {
      const ticketIds = sortArchiveBundleIds(bundleIds, board.tickets);
      if (ticketIds.length === 0) return;
      if (!archiveStatusAvailable) {
        setToast({ kind: "error", message: "Archive status is not configured for this project." });
        return;
      }

      try {
        await archiveTicketMutation.mutateAsync({ projectPath, ticketIds });
        setToast({ kind: "success", message: successMessage });
        await Promise.resolve(onCreated());
      } catch (error) {
        setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to archive tickets." });
      }
    },
    [archiveStatusAvailable, archiveTicketMutation, board.tickets, onCreated, projectPath, setToast]
  );
  const archiveTask = useCallback(
    async (taskId: string): Promise<void> => {
      const task = board.tickets.find((entry) => entry.id === taskId);
      if (!task || task.ticketType !== "task") return;
      if (!taskCanArchive(task)) {
        setToast({ kind: "info", message: "Only completed tasks can be archived." });
        return;
      }
      await archiveBundle(taskId, [taskId], `Queued ${task.title} for archive.`);
    },
    [archiveBundle, board.tickets, setToast]
  );
  const archiveFeature = useCallback(
    async (featureId: string): Promise<void> => {
      const feature = board.tickets.find((entry) => entry.id === featureId);
      if (!feature || feature.ticketType !== "feature") return;
      if (!featureCanArchive(feature, board.tickets)) {
        setToast({
          kind: "info",
          message: feature.parentEpicId
            ? "Archive every task under this feature and epic before archiving the feature."
            : "Complete every task under this feature before archiving it."
        });
        return;
      }
      const bundleIds = archiveBundleForFeature(featureId, board.tickets);
      await archiveBundle(featureId, bundleIds, `Queued ${feature.title} and ${bundleIds.length - 1} child ticket(s) for archive.`);
    },
    [archiveBundle, board.tickets, setToast]
  );
  const archiveEpic = useCallback(
    async (epicId: string): Promise<void> => {
      const epic = board.tickets.find((entry) => entry.id === epicId);
      if (!epic || epic.ticketType !== "epic") return;
      if (!epicCanArchive(epic, board.tickets)) {
        setToast({ kind: "info", message: "Complete every task under this epic before archiving it." });
        return;
      }
      const bundleIds = archiveBundleForEpic(epicId, board.tickets);
      await archiveBundle(epicId, bundleIds, `Queued ${epic.title} and ${bundleIds.length - 1} child ticket(s) for archive.`);
    },
    [archiveBundle, board.tickets, setToast]
  );
  const archiveAllCompletedBundleIds = useMemo(
    () => (archiveStatusAvailable ? archiveAllCompletedContainerBundleIds(board.tickets) : []),
    [archiveStatusAvailable, board.tickets]
  );
  const archiveAllCompleted = useCallback(async (): Promise<void> => {
    if (archiveAllCompletedBundleIds.length === 0) {
      setToast({ kind: "info", message: "No completed features or epics are ready to archive." });
      return;
    }
    const epicIds = new Set(archivableCompletedEpics(board.tickets).map((entry) => entry.id));
    const featureCount = archivableCompletedFeatures(board.tickets, epicIds).length;
    const epicCount = epicIds.size;
    const containerLabel =
      epicCount > 0 && featureCount > 0
        ? `${epicCount} epic(s) and ${featureCount} feature(s)`
        : epicCount > 0
          ? `${epicCount} epic${epicCount === 1 ? "" : "s"}`
          : `${featureCount} feature${featureCount === 1 ? "" : "s"}`;
    await archiveBundle(
      archiveAllCompletedBundleIds[0] ?? "",
      archiveAllCompletedBundleIds,
      `Queued ${containerLabel} for archive (${archiveAllCompletedBundleIds.length} ticket(s)).`
    );
  }, [archiveAllCompletedBundleIds, archiveBundle, board.tickets, setToast]);
  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return board.tickets;
    return board.tickets.filter((ticket) => {
      const haystack = `${ticket.title} ${ticket.excerpt} ${ticket.labels.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [board.tickets, query]);
  const orderedTicketIds = useMemo(
    () => flattenBoardColumnsTicketIds(visibleColumns, filteredTickets),
    [filteredTickets, visibleColumns]
  );
  const hasActiveElapsedLabel = useMemo(
    () => filteredTickets.some((ticket) => ticket.ticketType === "task" && activeRunElapsedLabel(ticket, now) !== null),
    [filteredTickets, now]
  );
  const queueTaskForReady = useCallback(
    async (ticketId: string, options?: { quiet?: boolean }): Promise<boolean> => {
      const task = board.tickets.find((entry) => entry.id === ticketId);
      if (!task || !isTaskReadyPlaceable(task, board.columns, board.tickets)) return false;

      const blockers = resolveTicketBlockers(task, board.tickets, board.columns);
      if (blockers.isBlocked) {
        await moveTicketMutation.mutateAsync({
          projectPath,
          ticketId,
          targetStatus: RELAY_READY_STATUS
        });
        if (!options?.quiet) {
          setToast({
            kind: "info",
            message: `${task.title} moved to ready (waiting on blockers).`
          });
        }
        return true;
      }

      const preflight = await preflightRunMutation.mutateAsync({ projectPath, ticketId, freshThread: false });
      if (!preflight.ok) {
        setToast({ kind: "error", message: preflight.errors[0] ?? `Agent run is blocked for ${task.title}.` });
        return false;
      }

      const result = await startRunMutation.mutateAsync({
        resume: Boolean(task.codexThreadId),
        input: { projectPath, ticketId, freshThread: false }
      });
      if (!options?.quiet) {
        setToast({
          kind: "info",
          message:
            result.state === "queued"
              ? `${task.title} queued and moved to ready.`
              : `${task.title} moved to ready and agent run started.`
        });
      }
      return true;
    },
    [board.columns, board.tickets, moveTicketMutation, preflightRunMutation, projectPath, setToast, startRunMutation]
  );

  const handleDragEndDrop = useCallback(
    async (item: BoardDragItem, dropStatus: BoardDropTarget): Promise<void> => {
      const collected = resolveDragTasks(item, board.tickets);
      if (collected.length === 0) return;

      setDragDropBusy(true);
      try {
        if (dropStatus === RELAY_TODO_STATUS) {
          const validation = validateRestoreDragToTodo(item, board.tickets);
          if (!validation.ok) {
            setToast({ kind: "info", message: validation.message });
            return;
          }

          const tasks = tasksForTodoRestore(collected);
          if (tasks.length === 0) {
            setToast({ kind: "info", message: "No tasks to move to Todo." });
            return;
          }

          await restoreTasksToTodo({
            projectPath,
            tasks,
            moveTicket: (input) => moveTicketMutation.mutateAsync(input)
          });
          await Promise.resolve(onCreated());
          setToast({
            kind: "info",
            message: tasks.length === 1 ? "Moved 1 task to Todo." : `Moved ${tasks.length} tasks to Todo.`
          });
          return;
        }

        if (dropStatus === RELAY_READY_STATUS) {
          const eligible = tasksEligibleForReadyQueue(collected, board.columns, board.tickets);
          if (eligible.length === 0) {
            setToast({ kind: "info", message: "No tasks can move to ready." });
            return;
          }

          let movedCount = 0;
          for (const task of eligible) {
            if (await queueTaskForReady(task.id, { quiet: true })) {
              movedCount += 1;
            } else {
              break;
            }
          }
          if (movedCount > 0) {
            await Promise.resolve(onCreated());
            setToast({
              kind: "info",
              message: movedCount === 1 ? "Moved 1 task to ready." : `Moved ${movedCount} tasks to ready.`
            });
          }
          return;
        }

        if (dropStatus === RELAY_COMPLETED_STATUS) {
          const validation = validateReviewDragToCompleted(item, board.tickets, board.columns);
          if (!validation.ok) {
            setToast({ kind: "info", message: validation.message });
            return;
          }

          if (item.kind === "task" && item.ticketId) {
            const task = board.tickets.find((entry) => entry.id === item.ticketId);
            if (!task) return;
            await moveTicketMutation.mutateAsync({
              projectPath,
              ticketId: task.id,
              targetStatus: RELAY_COMPLETED_STATUS
            });
            await Promise.resolve(onCreated());
            setToast({ kind: "success", message: `${task.title} accepted.` });
            return;
          }

          const container =
            item.kind === "feature" && item.featureId
              ? board.tickets.find((entry) => entry.id === item.featureId)
              : item.kind === "epic" && item.epicId
                ? board.tickets.find((entry) => entry.id === item.epicId)
                : undefined;
          if (!container || (container.ticketType !== "feature" && container.ticketType !== "epic")) return;

          const sortedIds = await moveReviewAcceptBundle({
            projectPath,
            container,
            allTickets: board.tickets,
            columns: board.columns,
            moveTicket: (input) => moveTicketMutation.mutateAsync(input)
          });
          if (sortedIds.length === 0) return;

          await Promise.resolve(onCreated());
          setToast({ kind: "success", message: reviewAcceptSuccessMessage(container, sortedIds) });
          return;
        }

        if (!boardDragAllowsNotDoingDrop(item)) {
          setToast({ kind: "info", message: "Tasks can only be moved to Ready. Drag a feature or epic to Not Doing." });
          return;
        }

        const tasks = tasksForNotDoingDrop(collected);
        if (tasks.length === 0) return;

        let movedCount = 0;
        for (const task of tasks) {
          const latest = board.tickets.find((entry) => entry.id === task.id) ?? task;
          try {
            await prepareTaskForNotDoing({
              projectPath,
              ticket: latest,
              cancelRun: (input) => cancelRunMutation.mutateAsync(input),
              moveTicket: (input) => moveTicketMutation.mutateAsync(input)
            });
            movedCount += 1;
          } catch (error) {
            setToast({
              kind: "error",
              message: error instanceof Error ? error.message : `Unable to move ${latest.title} to Not Doing.`
            });
            return;
          }
        }

        await Promise.resolve(onCreated());
        setToast({
          kind: "info",
          message: movedCount === 1 ? "Moved 1 task to Not Doing." : `Moved ${movedCount} tasks to Not Doing.`
        });
      } catch (error) {
        setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to complete board drop." });
      } finally {
        setDragDropBusy(false);
      }
    },
    [board.columns, board.tickets, cancelRunMutation, moveTicketMutation, onCreated, projectPath, queueTaskForReady, setToast]
  );

  const setTicketButtonRef = useCallback((ticketId: string, node: HTMLButtonElement | null): void => {
    if (node) {
      ticketButtonRefs.current.set(ticketId, node);
    } else {
      ticketButtonRefs.current.delete(ticketId);
    }
  }, []);

  const isBoardBrowsingTarget = useCallback((event: Parameters<typeof ticketNavigationDirection>[0]): boolean => {
    const boardNode = boardRef.current;
    if (!boardNode) return false;
    if (event.target === document.body || event.target === document.documentElement) return true;
    return event.target instanceof Node && boardNode.contains(event.target);
  }, []);

  const focusTicket = useCallback(
    (direction: ShortcutDirection): boolean => {
      if (orderedTicketIds.length === 0) return false;

      const activeTicket = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>("[data-ticket-id]") : null;
      const currentTicketId = activeTicket?.dataset.ticketId ?? selectedTicketId;
      const currentIndex = currentTicketId ? orderedTicketIds.indexOf(currentTicketId) : -1;
      const nextIndex =
        direction === "next"
          ? currentIndex < 0
            ? 0
            : (currentIndex + 1) % orderedTicketIds.length
          : currentIndex < 0
            ? orderedTicketIds.length - 1
            : (currentIndex - 1 + orderedTicketIds.length) % orderedTicketIds.length;
      const nextTicketId = orderedTicketIds[nextIndex];
      const nextButton = ticketButtonRefs.current.get(nextTicketId);

      if (!nextButton) return false;
      nextButton.focus();
      setSelectedTicketId(nextTicketId);
      return true;
    },
    [orderedTicketIds, selectedTicketId]
  );

  useEffect(() => {
    if (selectedTicketId && !orderedTicketIds.includes(selectedTicketId)) {
      setSelectedTicketId(null);
    }
  }, [orderedTicketIds, selectedTicketId]);

  useEffect(() => {
    if (!hasActiveElapsedLabel) return;
    const updateNow = (): void => setNow(Date.now());
    updateNow();
    const interval = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(interval);
  }, [hasActiveElapsedLabel]);

  useKeyboardShortcut({
    id: "ticket-navigation",
    enabled: ticketNavigationEnabled && orderedTicketIds.length > 0,
    matcher: (event) => ticketNavigationDirection(event) !== null && isBoardBrowsingTarget(event),
    handler: (event) => {
      const direction = ticketNavigationDirection(event);
      return direction ? focusTicket(direction) : false;
    }
  });

  return (
    <main className="workspace">
      <div className="topbar">
        <div className="topbar-project">
          <h1 className="topbar-title" title={board.project.name}>
            {board.project.name}
          </h1>
          <div className="project-header-meta">
            <ProjectEditorDropdown
              projectPath={board.project.path}
              onOpen={(projectPath, editorId) => void openProjectInEditorFromHeader(projectPath, editorId, setToast, onOpenProjectInEditor)}
            />
            <GitMetadataPill metadata={gitMetadata ?? loadingGitMetadata()} />
          </div>
        </div>
        <div className="topbar-actions">
          <label className="search topbar-search">
            <Search size={16} />
            <Input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search tickets"
              aria-label="Search tickets"
            />
          </label>
          <Button
            type="button"
            className={clsx("topbar-button topbar-chat-button", repositoryChatOpen && "active")}
            onClick={onToggleRepositoryChat}
            aria-label={repositoryChatOpen ? "Close repository chat" : "Open repository chat"}
            aria-pressed={repositoryChatOpen}
            aria-controls="repository-chat-panel"
            title={repositoryChatOpen ? "Close repository chat" : "Open repository chat"}
          >
            <MessageCircle size={16} />
          </Button>
        </div>
      </div>

      {board.project.healthMessages.length > 0 && (
        <div className={clsx("health", board.project.health)} role="status">
          <AlertTriangle size={17} />
          <span>{board.project.healthMessages.join(" ")}</span>
        </div>
      )}

      {board.invalidTickets.length > 0 && (
        <div className="health error" role="alert">
          <AlertTriangle size={17} />
          <span>{board.invalidTickets.length} ticket file(s) could not be loaded.</span>
        </div>
      )}

      <div className="workspace-board-region">
        <p className="sr-only" id="ticket-navigation-shortcuts">
          Use {ticketNavigationShortcutLabel} to move between tickets. Tab moves through controls normally.
        </p>
        <BoardHierarchyVisualProvider tickets={board.tickets}>
          <BoardDragProvider
            dragDropBusy={dragDropBusy}
            onDragEndDrop={handleDragEndDrop}
            allTickets={board.tickets}
            columns={board.columns}
            now={now}
          >
            <BoardColumnsGrid
              boardRef={boardRef}
              className={selectedTicketId ? "board-has-focus" : undefined}
              tabIndex={orderedTicketIds.length > 0 ? 0 : undefined}
              ariaDescribedBy="ticket-navigation-shortcuts"
              ariaKeyshortcuts="ArrowDown ArrowUp ArrowRight ArrowLeft J K"
              visibleColumns={visibleColumns}
              allTickets={board.tickets}
              columns={board.columns}
              selectedTicketId={selectedTicketId}
              onOpen={onOpenTicket}
              onTicketFocus={setSelectedTicketId}
              onTicketButtonRef={setTicketButtonRef}
              onArchiveEpic={(epicId) => void archiveEpic(epicId)}
              onArchiveFeature={(featureId) => void archiveFeature(featureId)}
              onArchiveTask={(taskId) => void archiveTask(taskId)}
              onArchiveAllCompleted={archiveStatusAvailable ? () => void archiveAllCompleted() : undefined}
              archiveAllCompletedDisabled={archiveAllCompletedBundleIds.length === 0}
              archiveAllCompletedBusy={archiveTicketMutation.isPending}
              now={now}
            />
          </BoardDragProvider>
        </BoardHierarchyVisualProvider>
      </div>
    </main>
  );
}

export function RepositoryChatPanelContent({
  projectName,
  messages,
  draft,
  pendingChat,
  pendingThinking,
  pendingDraft,
  errorMessage,
  usesCursorAgent,
  draftType,
  priority,
  effort,
  cursorAgentModel,
  recording,
  transcribing,
  voiceSetupRequired,
  voiceButtonLabel,
  voiceButtonTooltip,
  voiceButtonDisabled,
  onDraftChange,
  onDraftBlur,
  onSubmitChat,
  onSubmitDraft,
  onDraftTypeChange,
  onPriorityChange,
  onEffortChange,
  onCursorAgentModelChange,
  onVoiceInput,
  onClose,
  onClearChat,
  clearChatDisabled,
  onAnswerCopied,
  onAnswerCopyError,
  composerRef
}: {
  projectName: string;
  messages: RepositoryChatMessage[];
  draft: string;
  pendingChat: boolean;
  pendingThinking: boolean;
  pendingDraft: boolean;
  errorMessage: string | null;
  usesCursorAgent: boolean;
  draftType: FloatingComposerDraftType;
  priority: TicketPriority;
  effort: TicketEffort;
  cursorAgentModel: CursorAgentModel;
  recording: boolean;
  transcribing: boolean;
  voiceSetupRequired: boolean;
  voiceButtonLabel: string;
  voiceButtonTooltip: string;
  voiceButtonDisabled: boolean;
  onDraftChange: (value: string) => void;
  onDraftBlur: () => void;
  onSubmitChat: () => void;
  onSubmitDraft: () => void;
  onDraftTypeChange: (value: FloatingComposerDraftType) => void;
  onPriorityChange: (value: TicketPriority) => void;
  onEffortChange: (value: TicketEffort) => void;
  onCursorAgentModelChange: (value: CursorAgentModel) => void;
  onVoiceInput: () => void;
  onClose: () => void;
  onClearChat: () => void;
  clearChatDisabled: boolean;
  onAnswerCopied?: (kind: "markdown" | "code") => void;
  onAnswerCopyError?: (error: unknown) => void;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
}): ReactElement {
  return (
    <aside className="repository-chat-panel" id="repository-chat-panel" aria-label={`Repository chat for ${projectName}`}>
      <header className="repository-chat-header">
        <div>
          <span>Repository Chat</span>
          <h2 title={projectName}>{projectName}</h2>
        </div>
        <div className="repository-chat-header-actions">
          <Button
            type="button"
            className="icon-button"
            onClick={onClearChat}
            disabled={clearChatDisabled}
            aria-label="Clear repository chat"
            title="Clear chat"
          >
            <Trash2 size={18} />
          </Button>
          <Button type="button" className="icon-button" onClick={onClose} aria-label="Close repository chat" title="Close repository chat">
            <X size={18} />
          </Button>
        </div>
      </header>

      <RepositoryChatTranscript
        messages={messages}
        pendingChat={pendingChat}
        pendingThinking={pendingThinking}
        pendingDraft={pendingDraft}
        errorMessage={errorMessage}
        onAnswerCopied={onAnswerCopied}
        onAnswerCopyError={onAnswerCopyError}
      />

      <RepositoryChatComposer
        messages={messages}
        draft={draft}
        pendingChat={pendingChat}
        pendingDraft={pendingDraft}
        usesCursorAgent={usesCursorAgent}
        draftType={draftType}
        priority={priority}
        effort={effort}
        cursorAgentModel={cursorAgentModel}
        recording={recording}
        transcribing={transcribing}
        voiceSetupRequired={voiceSetupRequired}
        voiceButtonLabel={voiceButtonLabel}
        voiceButtonTooltip={voiceButtonTooltip}
        voiceButtonDisabled={voiceButtonDisabled}
        composerPlaceholder={REPOSITORY_CHAT_COMPOSER_PLACEHOLDER}
        onDraftChange={onDraftChange}
        onDraftBlur={onDraftBlur}
        onSubmitChat={onSubmitChat}
        onSubmitDraft={onSubmitDraft}
        onDraftTypeChange={onDraftTypeChange}
        onPriorityChange={onPriorityChange}
        onEffortChange={onEffortChange}
        onCursorAgentModelChange={onCursorAgentModelChange}
        onVoiceInput={onVoiceInput}
        composerRef={composerRef}
      />
    </aside>
  );
}

function RepositoryChatPanel({
  projectPath,
  projectName,
  defaultEffort,
  selectedProviderId,
  composerRef,
  onClose,
  onCreated,
  setToast
}: {
  projectPath: string;
  projectName: string;
  defaultEffort: TicketEffort;
  selectedProviderId: AgentProviderId;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  setToast: (toast: Toast) => void;
}): ReactElement {
  const usesCursorAgent = selectedProviderId === "cursor";
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RepositoryChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasStreamedAssistant, setHasStreamedAssistant] = useState(false);
  const [draftType, setDraftType] = useState<FloatingComposerDraftType>("feature");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [effort, setEffort] = useState<TicketEffort>(defaultEffort);
  const [cursorAgentModel, setCursorAgentModel] = useState<CursorAgentModel>("auto");
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceSetupOpen, setVoiceSetupOpen] = useState(false);
  const [voiceCommandPath, setVoiceCommandPath] = useState("");
  const [voiceSetupMessage, setVoiceSetupMessage] = useState<string | null>(null);
  const messageSequenceRef = useRef(0);
  const streamingRequestIdRef = useRef<string | null>(null);
  const streamingAssistantMessageIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shouldTranscribeOnStopRef = useRef(false);
  const userEditedBeforeHydrationRef = useRef(false);
  const repositoryChatPersistReadyRef = useRef(false);
  const repositoryChatMutation = useRepositoryChatMutation();
  const repositoryChatQuery = useRepositoryChatQuery(projectPath);
  const saveRepositoryChatMutation = useSaveRepositoryChatMutation();
  const clearRepositoryChatMutation = useClearRepositoryChatMutation();
  const createDraftMutation = useCreateDraftMutation();
  const voiceInputStatusQuery = useVoiceInputStatusQuery();
  const configureVoiceInputMutation = useConfigureVoiceInputMutation();
  const transcribeVoiceInputMutation = useTranscribeVoiceInputMutation();
  const saveRepositoryChatMutateRef = useRef(saveRepositoryChatMutation.mutate);
  saveRepositoryChatMutateRef.current = saveRepositoryChatMutation.mutate;
  const repositoryChatPersistRef = useRef<RepositoryChatPersistController | null>(null);
  if (!repositoryChatPersistRef.current) {
    repositoryChatPersistRef.current = createRepositoryChatPersist({
      mutate: (payload, options) => saveRepositoryChatMutateRef.current(payload, options)
    });
  }
  const repositoryChatPersist = repositoryChatPersistRef.current;

  const applyEmptyRepositoryChatState = useCallback((): void => {
    const empty = emptyRepositoryChatPanelState();
    setThreadId(empty.threadId);
    setMessages(empty.messages);
    setDraft(empty.draft);
    messageSequenceRef.current = empty.messageSequence;
    streamingRequestIdRef.current = null;
    streamingAssistantMessageIdRef.current = null;
    setHasStreamedAssistant(false);
    setErrorMessage(null);
  }, []);

  const clearChat = useCallback((): void => {
    if (repositoryChatMutation.isPending || createDraftMutation.isPending) return;
    applyEmptyRepositoryChatState();
    repositoryChatPersist.setRuntime({ lastPersistedSignature: null });
    repositoryChatPersist.syncSnapshot({
      projectPath,
      threadId: null,
      messages: [],
      draft: ""
    });
    repositoryChatPersist.flushRepositoryChatPersist();
    void clearRepositoryChatMutation.mutateAsync(projectPath).catch((error) => {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to clear repository chat."
      });
    });
  }, [
    applyEmptyRepositoryChatState,
    clearRepositoryChatMutation,
    createDraftMutation.isPending,
    projectPath,
    repositoryChatMutation.isPending,
    repositoryChatPersist,
    setToast
  ]);

  useEffect(() => {
    userEditedBeforeHydrationRef.current = false;
    repositoryChatPersistReadyRef.current = false;
    repositoryChatPersist.setRuntime({
      hydratedProjectPath: null,
      ready: false,
      lastPersistedSignature: null
    });
    repositoryChatPersist.cancelScheduledRepositoryChatPersist();
    applyEmptyRepositoryChatState();
  }, [applyEmptyRepositoryChatState, projectPath, repositoryChatPersist]);

  useEffect(() => {
    if (!repositoryChatQuery.isSuccess) return;
    const hydrationAction = resolveRepositoryChatHydrationAction({
      hydratedProjectPath: repositoryChatPersist.getRuntime().hydratedProjectPath,
      projectPath,
      querySuccess: repositoryChatQuery.isSuccess,
      userEditedBeforeHydration: userEditedBeforeHydrationRef.current,
      streaming: Boolean(streamingRequestIdRef.current),
      messageCount: messages.length,
      threadId
    });
    if (hydrationAction === "already_hydrated") return;
    if (hydrationAction === "skip_local") {
      repositoryChatPersistReadyRef.current = true;
      repositoryChatPersist.setRuntime({
        hydratedProjectPath: projectPath,
        ready: true,
        lastPersistedSignature: repositoryChatStoreSignature({
          projectPath,
          threadId,
          messages,
          draft
        })
      });
      return;
    }
    const store = repositoryChatQuery.data;
    setThreadId(store.threadId ?? null);
    setMessages(store.messages);
    setDraft(store.draft ?? "");
    messageSequenceRef.current = repositoryChatMessageSequence(store.messages);
    repositoryChatPersistReadyRef.current = true;
    repositoryChatPersist.setRuntime({
      hydratedProjectPath: projectPath,
      ready: true,
      lastPersistedSignature: repositoryChatStoreSignature({
        projectPath,
        threadId: store.threadId ?? null,
        messages: store.messages,
        draft: store.draft ?? ""
      })
    });
  }, [projectPath, repositoryChatPersist, repositoryChatQuery.data, repositoryChatQuery.isSuccess]);

  const handleDraftChange = useCallback(
    (value: string) => {
      if (
        shouldMarkRepositoryChatUserEditedBeforeHydration({
          persistReady: repositoryChatPersistReadyRef.current,
          querySuccess: repositoryChatQuery.isSuccess
        })
      ) {
        userEditedBeforeHydrationRef.current = true;
      }
      setDraft(value);
    },
    [repositoryChatQuery.isSuccess]
  );

  useEffect(() => {
    repositoryChatPersist.syncSnapshot({ projectPath, threadId, messages, draft });
  }, [draft, messages, projectPath, repositoryChatPersist, threadId]);

  useEffect(() => {
    repositoryChatPersist.scheduleRepositoryChatPersist();
    return () => {
      repositoryChatPersist.cancelScheduledRepositoryChatPersist();
    };
  }, [draft, messages, projectPath, repositoryChatPersist, threadId]);

  useEffect(
    () => () => {
      repositoryChatPersist.flushRepositoryChatPersist();
      repositoryChatPersist.dispose();
    },
    [repositoryChatPersist]
  );

  useShortcutOverlay({
    id: `repository-chat:${projectPath}`,
    priority: 15,
    onEscape: () => {
      onClose();
      return true;
    }
  });

  const nextMessageId = useCallback((role: RepositoryChatMessage["role"]): string => {
    messageSequenceRef.current += 1;
    return `${role}-${messageSequenceRef.current}`;
  }, []);

  useEffect(() => {
    setEffort(defaultEffort);
  }, [defaultEffort]);

  useEffect(
    () =>
      useRepositoryChatEventSubscription((event) => {
        if (event.projectPath !== projectPath) return;
        if (event.requestId !== streamingRequestIdRef.current) return;

        if (event.type === "started") {
          if (event.threadId) setThreadId(event.threadId);
          return;
        }

        if (event.type === "delta") {
          setHasStreamedAssistant(true);
          setMessages((current) => {
            const messageId = streamingAssistantMessageIdRef.current;
            if (!messageId) {
              const nextId = nextMessageId("assistant");
              streamingAssistantMessageIdRef.current = nextId;
              return [...current, { id: nextId, role: "assistant", text: event.text }];
            }
            return current.map((message) =>
              message.id === messageId ? { ...message, text: `${message.text}${event.text}` } : message
            );
          });
          return;
        }

        if (event.type === "completed") {
          streamingRequestIdRef.current = null;
          const messageId = streamingAssistantMessageIdRef.current;
          setHasStreamedAssistant(Boolean(messageId) || event.message.trim().length > 0);
          setThreadId(event.threadId);
          setMessages((current) => {
            if (!messageId) {
              if (!event.message.trim()) return current;
              const nextId = nextMessageId("assistant");
              streamingAssistantMessageIdRef.current = nextId;
              return [...current, { id: nextId, role: "assistant", text: event.message }];
            }
            if (!event.message.trim()) return current;
            return current.map((message) => (message.id === messageId ? { ...message, text: event.message } : message));
          });
          window.setTimeout(() => {
            repositoryChatPersist.flushRepositoryChatPersist();
          }, 0);
          return;
        }

        if (event.type === "failed") {
          streamingRequestIdRef.current = null;
          streamingAssistantMessageIdRef.current = null;
          setHasStreamedAssistant(false);
          setErrorMessage(event.message);
          setToast({ kind: "error", message: event.message });
          window.setTimeout(() => {
            repositoryChatPersist.flushRepositoryChatPersist();
          }, 0);
        }
      }),
    [nextMessageId, projectPath, repositoryChatPersist, setToast]
  );

  useEffect(
    () => () => {
      shouldTranscribeOnStopRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
    },
    []
  );

  const voiceInputStatus = voiceInputStatusQuery.data;
  const voiceInputEnabled = voiceInputStatus?.available === true;
  const defaultVoiceCommandPath = voiceInputStatus?.configuredCommandPath ?? voiceInputStatus?.defaultCommandPath ?? "~/whisper.cpp/build/bin/whisper-cli";
  const voiceStatusMessage = voiceInputStatusQuery.error
    ? relayErrorMessage(voiceInputStatusQuery.error, "Unable to check local Whisper availability.")
    : voiceInputStatus?.message ?? "Checking local Whisper availability.";
  const recording = voiceState === "recording";
  const transcribing = voiceState === "transcribing";

  useEffect(() => {
    if (!voiceSetupOpen) {
      setVoiceCommandPath(defaultVoiceCommandPath);
      setVoiceSetupMessage(null);
    }
  }, [defaultVoiceCommandPath, voiceSetupOpen]);

  const submit = useCallback((): void => {
    const question = draft.trim();
    if (!question || repositoryChatMutation.isPending || createDraftMutation.isPending) return;
    const requestId = nextRepositoryChatRequestId();
    const assistantPlaceholderId = nextMessageId("assistant");
    const userMessageId = nextMessageId("user");
    const nextMessages = [
      ...messages,
      { id: userMessageId, role: "user" as const, text: question },
      { id: assistantPlaceholderId, role: "assistant" as const, text: "" }
    ];

    streamingRequestIdRef.current = requestId;
    streamingAssistantMessageIdRef.current = assistantPlaceholderId;
    setHasStreamedAssistant(false);
    setMessages(nextMessages);
    setDraft("");
    setErrorMessage(null);
    repositoryChatPersist.syncSnapshot({
      projectPath,
      threadId,
      messages: nextMessages,
      draft: ""
    });
    repositoryChatPersist.flushRepositoryChatPersist();

    void repositoryChatMutation
      .mutateAsync({ projectPath, message: question, threadId, requestId })
      .then((response) => {
        const finalMessage = response.message.trim();
        setThreadId(response.threadId);
        setMessages((current) => {
          const messageId = streamingAssistantMessageIdRef.current;
          if (!messageId) {
            if (!finalMessage) return current;
            const nextId = nextMessageId("assistant");
            streamingAssistantMessageIdRef.current = nextId;
            return [...current, { id: nextId, role: "assistant", text: response.message }];
          }
          if (!current.some((message) => message.id === messageId)) {
            if (!finalMessage) return current;
            return [...current, { id: messageId, role: "assistant", text: response.message }];
          }
          if (!finalMessage) return current;
          return current.map((message) => (message.id === messageId ? { ...message, text: response.message } : message));
        });
        streamingRequestIdRef.current = null;
        streamingAssistantMessageIdRef.current = null;
        setHasStreamedAssistant((current) => current || finalMessage.length > 0);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to send repository chat message.";
        streamingRequestIdRef.current = null;
        streamingAssistantMessageIdRef.current = null;
        setHasStreamedAssistant(false);
        setDraft(question);
        setErrorMessage(message);
        setToast({ kind: "error", message });
      });
  }, [
    createDraftMutation.isPending,
    draft,
    messages,
    nextMessageId,
    projectPath,
    repositoryChatMutation,
    repositoryChatPersist,
    setToast,
    threadId
  ]);

  const handleDraftBlur = useCallback((): void => {
    repositoryChatPersist.flushRepositoryChatPersist();
  }, [repositoryChatPersist]);

  const handleClose = useCallback((): void => {
    repositoryChatPersist.flushRepositoryChatPersist();
    onClose();
  }, [onClose, repositoryChatPersist]);

  const releaseVoiceStream = (): void => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const finalizeRecordedAudio = useCallback(
    async (mimeType: string): Promise<void> => {
      releaseVoiceStream();
      mediaRecorderRef.current = null;
      const audioBlob = new Blob(recordedChunksRef.current, { type: mimeType || "audio/webm" });
      recordedChunksRef.current = [];
      if (!shouldTranscribeOnStopRef.current) {
        setVoiceState("idle");
        return;
      }
      shouldTranscribeOnStopRef.current = false;
      setVoiceState("transcribing");
      try {
        const audioBase64 = await recordedBlobToWavBase64(audioBlob);
        const result = await transcribeVoiceInputMutation.mutateAsync({ audioBase64 });
        setDraft((current) => appendTranscriptToIdea(current, result.transcript));
        window.requestAnimationFrame(() => composerRef?.current?.focus());
      } catch (error) {
        setToast({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to transcribe voice input locally."
        });
      } finally {
        setVoiceState("idle");
      }
    },
    [composerRef, setToast, transcribeVoiceInputMutation]
  );

  const startVoiceRecording = useCallback(async (): Promise<void> => {
    if (repositoryChatMutation.isPending || createDraftMutation.isPending || transcribing || recording) return;
    if (!voiceInputEnabled) {
      setVoiceSetupOpen(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setToast({ kind: "error", message: "This environment does not support microphone recording." });
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setToast({ kind: "error", message: "This environment does not support MediaRecorder." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      shouldTranscribeOnStopRef.current = true;
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        shouldTranscribeOnStopRef.current = false;
        releaseVoiceStream();
        mediaRecorderRef.current = null;
        setVoiceState("idle");
        setToast({ kind: "error", message: "Microphone recording failed." });
      };
      recorder.onstop = () => {
        void finalizeRecordedAudio(recorder.mimeType);
      };
      recorder.start();
      setVoiceState("recording");
    } catch (error) {
      setVoiceState("idle");
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to access the microphone."
      });
    }
  }, [
    createDraftMutation.isPending,
    finalizeRecordedAudio,
    recording,
    repositoryChatMutation.isPending,
    setToast,
    transcribing,
    voiceInputEnabled
  ]);

  const stopVoiceRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    setVoiceState("transcribing");
    recorder.requestData();
    recorder.stop();
  }, []);

  const handleVoiceInput = useCallback((): void => {
    if (recording) {
      stopVoiceRecording();
      return;
    }
    void startVoiceRecording();
  }, [recording, startVoiceRecording, stopVoiceRecording]);

  const saveVoiceCommandPath = useCallback((): void => {
    const commandPath = voiceCommandPath.trim();
    if (!commandPath) {
      setVoiceSetupMessage("Enter a Whisper CLI path before saving.");
      return;
    }
    setVoiceSetupMessage(null);
    void configureVoiceInputMutation
      .mutateAsync({ commandPath })
      .then((status) => {
        setVoiceSetupMessage(status.message);
        if (!status.available) return;
        setVoiceSetupOpen(false);
        setToast({ kind: "info", message: "Local Whisper voice input is ready." });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to save the Whisper CLI path.";
        setVoiceSetupMessage(message);
        setToast({ kind: "error", message });
      });
  }, [configureVoiceInputMutation, setToast, voiceCommandPath]);

  const submitDraft = useCallback((): void => {
    const idea = draft.trim();
    if ((!idea && messages.length === 0) || repositoryChatMutation.isPending || createDraftMutation.isPending) return;

    const conversationForDraft =
      idea.length > 0
        ? [...messages, { id: nextMessageId("user"), role: "user" as const, text: idea }]
        : messages;
    const draftInput = getFloatingComposerDraftInput({
      projectPath,
      idea: repositoryChatDraftIdeaFromConversation(conversationForDraft, idea),
      priority,
      effort,
      agentModel: cursorAgentModel,
      selectedProviderId,
      draftType
    });

    applyEmptyRepositoryChatState();
    void clearRepositoryChatMutation.mutateAsync(projectPath).catch(() => undefined);

    void createDraftMutation
      .mutateAsync(draftInput)
      .then((result) => {
        if (!result.ok) {
          setToast({ kind: "error", message: result.error.message });
          return;
        }
        setToast({ kind: "info", message: `Agent draft started for ${result.ticket.frontMatter.title}.` });
        void Promise.resolve(onCreated()).catch((error) => {
          setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to refresh board." });
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Ticket drafting failed.";
        setToast({ kind: "error", message });
      });
  }, [
    applyEmptyRepositoryChatState,
    clearRepositoryChatMutation,
    createDraftMutation,
    cursorAgentModel,
    draft,
    draftType,
    effort,
    messages,
    nextMessageId,
    onCreated,
    priority,
    projectPath,
    repositoryChatMutation.isPending,
    selectedProviderId,
    setToast
  ]);

  const voiceButtonLabel = recording
    ? "Stop recording and transcribe"
    : transcribing
      ? "Transcribing voice input locally"
      : "Record idea with voice";
  const voiceButtonTooltip = recording
    ? "Stop recording and transcribe"
    : transcribing
      ? "Transcribing audio locally..."
      : voiceInputEnabled
        ? "Record voice idea"
        : "Set up local Whisper path";
  const voiceSetupRequired = !voiceInputEnabled;
  const voiceButtonDisabled =
    recording ? false : repositoryChatMutation.isPending || createDraftMutation.isPending || transcribing || configureVoiceInputMutation.isPending;
  const clearChatDisabled =
    repositoryChatMutation.isPending ||
    createDraftMutation.isPending ||
    (messages.length === 0 && draft.trim().length === 0);
  const handleAnswerCopied = useCallback(
    (kind: "markdown" | "code") => {
      setToast(copyToast(kind));
    },
    [setToast]
  );
  const handleAnswerCopyError = useCallback(
    (error: unknown) => {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to copy." });
    },
    [setToast]
  );

  return (
    <>
      <RepositoryChatPanelContent
        projectName={projectName}
        messages={messages}
        draft={draft}
        pendingChat={repositoryChatMutation.isPending}
        pendingThinking={repositoryChatMutation.isPending && !hasStreamedAssistant}
        pendingDraft={createDraftMutation.isPending}
        errorMessage={errorMessage}
        usesCursorAgent={usesCursorAgent}
        draftType={draftType}
        priority={priority}
        effort={effort}
        cursorAgentModel={cursorAgentModel}
        recording={recording}
        transcribing={transcribing}
        voiceSetupRequired={voiceSetupRequired}
        voiceButtonLabel={voiceButtonLabel}
        voiceButtonTooltip={voiceButtonTooltip}
        voiceButtonDisabled={voiceButtonDisabled}
        onDraftChange={handleDraftChange}
        onDraftBlur={handleDraftBlur}
        onSubmitChat={submit}
        onSubmitDraft={submitDraft}
        onDraftTypeChange={setDraftType}
        onPriorityChange={setPriority}
        onEffortChange={setEffort}
        onCursorAgentModelChange={setCursorAgentModel}
        onVoiceInput={handleVoiceInput}
        onClose={handleClose}
        onClearChat={clearChat}
        clearChatDisabled={clearChatDisabled}
        onAnswerCopied={handleAnswerCopied}
        onAnswerCopyError={handleAnswerCopyError}
        composerRef={composerRef}
      />
      {voiceSetupOpen ? (
        <VoiceInputSetupModal
          commandPath={voiceCommandPath}
          statusMessage={voiceSetupMessage ?? voiceStatusMessage}
          onCommandPathChange={setVoiceCommandPath}
          onClose={() => {
            if (configureVoiceInputMutation.isPending) return;
            setVoiceSetupOpen(false);
          }}
          onSave={saveVoiceCommandPath}
          savePending={configureVoiceInputMutation.isPending}
        />
      ) : null}
    </>
  );
}

const cursorAgentModelOptions: CursorAgentModel[] = ["auto"];

const cursorAgentModelLabel = (model: CursorAgentModel): string => {
  switch (model) {
    case "auto":
      return "Auto";
    default:
      return model;
  }
};

const appendTranscriptToIdea = (current: string, transcript: string): string => {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return current;
  const normalizedCurrent = current.trimEnd();
  if (!normalizedCurrent) return normalizedTranscript;
  return /\s$/.test(current) ? `${current}${normalizedTranscript}` : `${current} ${normalizedTranscript}`;
};

const base64FromBytes = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
};

const audioBufferToWavBytes = (audioBuffer: AudioBuffer): Uint8Array => {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = audioBuffer.sampleRate * blockAlign;
  const pcmByteLength = sampleCount * blockAlign;
  const buffer = new ArrayBuffer(44 + pcmByteLength);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcmByteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcmByteLength, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = audioBuffer.getChannelData(channelIndex)[sampleIndex] ?? 0;
      const normalized = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
};

const recordedBlobToWavBase64 = async (blob: Blob): Promise<string> => {
  if (typeof window.AudioContext === "undefined") {
    throw new Error("This browser cannot decode recorded audio for local transcription.");
  }
  const sourceBuffer = await blob.arrayBuffer();
  const audioContext = new window.AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    return base64FromBytes(audioBufferToWavBytes(decoded));
  } finally {
    await audioContext.close();
  }
};

const voiceInputInstallCommandBlock = `# Install whisper.cpp under your home directory
cd ~
if [ ! -d "whisper.cpp" ]; then
  git clone https://github.com/ggml-org/whisper.cpp.git
fi

cd ~/whisper.cpp

# macOS
brew install cmake ffmpeg

# Ubuntu
sudo apt update
sudo apt install -y build-essential cmake ffmpeg

cmake -B build
cmake --build build -j
./models/download-ggml-model.sh base.en

ls -lh build/bin/whisper-cli
ls -lh models/ggml-base.en.bin

./build/bin/whisper-cli \\
  -m models/ggml-base.en.bin \\
  -f samples/jfk.wav`;

export function VoiceInputSetupModal({
  commandPath,
  statusMessage,
  onCommandPathChange,
  onClose,
  onSave,
  savePending
}: {
  commandPath: string;
  statusMessage: string | null;
  onCommandPathChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  savePending: boolean;
}): ReactElement {
  return (
    <DialogBackdrop
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Dialog className="modal voice-input-setup-modal" aria-labelledby="voice-input-setup-title">
        <header>
          <div>
            <h2 id="voice-input-setup-title">Set up local Whisper</h2>
            <p>Point Relay at your local `whisper-cli` binary to enable voice input for ticket drafting.</p>
          </div>
          <div className="provider-selector-header-actions">
            <IconButton type="button" className="icon-button" onClick={onClose} aria-label="Close voice input setup" title="Close voice input setup">
              <X size={16} />
            </IconButton>
          </div>
        </header>
        <div className="voice-input-setup-body">
          <Field className="voice-input-path-field">
            <span>Whisper CLI path</span>
            <Input
              value={commandPath}
              onChange={(event) => onCommandPathChange(event.target.value)}
              placeholder="~/whisper.cpp/build/bin/whisper-cli"
              aria-label="Whisper CLI path"
              autoFocus
            />
          </Field>
          {statusMessage ? (
            <div className="voice-input-setup-status" role="status">
              {statusMessage}
            </div>
          ) : null}
          <div className="voice-input-setup-copy">
            <p>Relay checks `~/whisper.cpp/build/bin/whisper-cli` by default. If you installed whisper.cpp elsewhere, paste that path above and save.</p>
            <p>Reference install steps for macOS and Ubuntu:</p>
          </div>
          <pre className="voice-input-setup-code">
            <code>{voiceInputInstallCommandBlock}</code>
          </pre>
        </div>
        <footer className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="primary-button" onClick={onSave} disabled={savePending || commandPath.trim().length === 0}>
            {savePending ? "Checking..." : "Save path"}
          </Button>
        </footer>
      </Dialog>
    </DialogBackdrop>
  );
}

export function FloatingTicketComposer({
  projectPath,
  defaultEffort,
  selectedProviderId,
  composerRef,
  onCreated,
  setToast
}: {
  projectPath: string;
  defaultEffort: TicketEffort;
  selectedProviderId: AgentProviderId;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
  onCreated: () => void | Promise<void>;
  setToast: (toast: Toast) => void;
}): ReactElement {
  const usesCursorAgent = selectedProviderId === "cursor";
  const [idea, setIdea] = useState("");
  const [draftType, setDraftType] = useState<FloatingComposerDraftType>("feature");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [effort, setEffort] = useState<TicketEffort>(defaultEffort);
  const [cursorAgentModel, setCursorAgentModel] = useState<CursorAgentModel>("auto");
  const [ticketReferenceMention, setTicketReferenceMention] = useState<ActiveTicketReferenceMention | null>(null);
  const [ticketReferenceMenuStyle, setTicketReferenceMenuStyle] = useState<CSSProperties | null>(null);
  const [activeTicketReferenceIndex, setActiveTicketReferenceIndex] = useState(0);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceSetupOpen, setVoiceSetupOpen] = useState(false);
  const [voiceCommandPath, setVoiceCommandPath] = useState("");
  const [voiceSetupMessage, setVoiceSetupMessage] = useState<string | null>(null);
  const draftRequestRef = useRef(0);
  const localComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shouldTranscribeOnStopRef = useRef(false);
  const ideaEditorRef = composerRef ?? localComposerRef;
  const ticketReferencesQuery = useTicketReferencesQuery(projectPath);
  const voiceInputStatusQuery = useVoiceInputStatusQuery();
  const configureVoiceInputMutation = useConfigureVoiceInputMutation();
  const transcribeVoiceInputMutation = useTranscribeVoiceInputMutation();
  const createDraftMutation = useCreateDraftMutation();
  const ticketReferences = ticketReferencesQuery.data ?? [];
  const ticketReferencesLoading = ticketReferencesQuery.isLoading;
  const ticketReferencesError = ticketReferencesQuery.error ? relayErrorMessage(ticketReferencesQuery.error, "Unable to load ticket references.") : null;
  const filteredTicketReferences = useMemo(
    () => filterTicketReferenceCandidates(ticketReferences, ticketReferenceMention?.token.query ?? ""),
    [ticketReferenceMention?.token.query, ticketReferences]
  );
  const ideaTicketReferenceMenuOpen = ticketReferenceMention !== null;
  const busy = createDraftMutation.isPending;
  const canSubmit = !busy && idea.trim().length > 0;
  const voiceInputStatus = voiceInputStatusQuery.data;
  const voiceInputEnabled = voiceInputStatus?.available === true;
  const defaultVoiceCommandPath = voiceInputStatus?.configuredCommandPath ?? voiceInputStatus?.defaultCommandPath ?? "~/whisper.cpp/build/bin/whisper-cli";
  const voiceStatusMessage = voiceInputStatusQuery.error
    ? relayErrorMessage(voiceInputStatusQuery.error, "Unable to check local Whisper availability.")
    : voiceInputStatus?.message ?? "Checking local Whisper availability.";
  const recording = voiceState === "recording";
  const transcribing = voiceState === "transcribing";

  useEffect(() => {
    setEffort(defaultEffort);
  }, [defaultEffort]);

  useEffect(
    () => () => {
      shouldTranscribeOnStopRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
    },
    []
  );

  useEffect(() => {
    setActiveTicketReferenceIndex((current) => {
      if (filteredTicketReferences.length === 0) return 0;
      return Math.min(current, filteredTicketReferences.length - 1);
    });
  }, [filteredTicketReferences.length]);

  useEffect(() => {
    if (!voiceSetupOpen) {
      setVoiceCommandPath(defaultVoiceCommandPath);
      setVoiceSetupMessage(null);
    }
  }, [defaultVoiceCommandPath, voiceSetupOpen]);

  useEffect(() => {
    const editor = ideaEditorRef.current;
    if (!editor) return;
    const computed = window.getComputedStyle(editor);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const padding =
      Number.parseFloat(computed.paddingTop || "0") + Number.parseFloat(computed.paddingBottom || "0");
    const maxHeight = Math.round(lineHeight * 100 + padding);
    editor.style.height = "auto";
    editor.style.maxHeight = `${maxHeight}px`;
    editor.style.height = `${Math.min(editor.scrollHeight, maxHeight)}px`;
    editor.style.overflowY = editor.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [idea, ideaEditorRef]);

  const updateTicketReferenceMention = (value: string, selectionStart: number, selectionEnd = selectionStart): void => {
    const token = getActiveTicketMention(value, selectionStart, selectionEnd);
    setTicketReferenceMention(token ? { token } : null);
    setActiveTicketReferenceIndex(0);
  };

  const updateTicketReferenceMenuPosition = useCallback((): void => {
    if (!ticketReferenceMention || !ideaEditorRef.current) {
      setTicketReferenceMenuStyle(null);
      return;
    }

    setTicketReferenceMenuStyle(
      getTicketReferenceMenuLayout({
        anchorRect: ideaEditorRef.current.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      }).style
    );
  }, [ideaEditorRef, ticketReferenceMention]);

  useEffect(() => {
    if (!ticketReferenceMention) {
      setTicketReferenceMenuStyle(null);
      return;
    }

    updateTicketReferenceMenuPosition();
    const handleReposition = (): void => updateTicketReferenceMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [
    filteredTicketReferences.length,
    ticketReferenceMention,
    ticketReferencesError,
    ticketReferencesLoading,
    updateTicketReferenceMenuPosition
  ]);

  const closeTicketReferenceMenu = (): void => {
    setTicketReferenceMention(null);
    setTicketReferenceMenuStyle(null);
  };

  const releaseVoiceStream = (): void => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const finalizeRecordedAudio = useCallback(
    async (mimeType: string): Promise<void> => {
      releaseVoiceStream();
      mediaRecorderRef.current = null;
      const audioBlob = new Blob(recordedChunksRef.current, { type: mimeType || "audio/webm" });
      recordedChunksRef.current = [];
      if (!shouldTranscribeOnStopRef.current) {
        setVoiceState("idle");
        return;
      }
      shouldTranscribeOnStopRef.current = false;
      setVoiceState("transcribing");
      try {
        const audioBase64 = await recordedBlobToWavBase64(audioBlob);
        const result = await transcribeVoiceInputMutation.mutateAsync({ audioBase64 });
        setIdea((current) => appendTranscriptToIdea(current, result.transcript));
        window.requestAnimationFrame(() => ideaEditorRef.current?.focus());
      } catch (error) {
        setToast({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to transcribe voice input locally."
        });
      } finally {
        setVoiceState("idle");
      }
    },
    [ideaEditorRef, setToast, transcribeVoiceInputMutation]
  );

  const startVoiceRecording = useCallback(async (): Promise<void> => {
    if (busy || transcribing || recording) return;
    if (!voiceInputEnabled) {
      setToast({ kind: "error", message: voiceStatusMessage });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setToast({ kind: "error", message: "This environment does not support microphone recording." });
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setToast({ kind: "error", message: "This environment does not support MediaRecorder." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      shouldTranscribeOnStopRef.current = true;
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        shouldTranscribeOnStopRef.current = false;
        releaseVoiceStream();
        mediaRecorderRef.current = null;
        setVoiceState("idle");
        setToast({ kind: "error", message: "Microphone recording failed." });
      };
      recorder.onstop = () => {
        void finalizeRecordedAudio(recorder.mimeType);
      };
      recorder.start();
      setVoiceState("recording");
    } catch (error) {
      setVoiceState("idle");
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to access the microphone."
      });
    }
  }, [busy, finalizeRecordedAudio, recording, setToast, transcribing, voiceInputEnabled, voiceStatusMessage]);

  const stopVoiceRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    setVoiceState("transcribing");
    recorder.requestData();
    recorder.stop();
  }, []);

  const openVoiceSetup = useCallback((): void => {
    setVoiceCommandPath(defaultVoiceCommandPath);
    setVoiceSetupMessage(null);
    setVoiceSetupOpen(true);
  }, [defaultVoiceCommandPath]);

  const handleVoiceInput = useCallback((): void => {
    if (recording) {
      stopVoiceRecording();
      return;
    }
    if (!voiceInputEnabled) {
      openVoiceSetup();
      return;
    }
    void startVoiceRecording();
  }, [openVoiceSetup, recording, startVoiceRecording, stopVoiceRecording, voiceInputEnabled]);

  const saveVoiceCommandPath = useCallback((): void => {
    const commandPath = voiceCommandPath.trim();
    if (!commandPath) {
      setVoiceSetupMessage("Enter a Whisper CLI path before saving.");
      return;
    }
    setVoiceSetupMessage(null);
    void configureVoiceInputMutation
      .mutateAsync({ commandPath })
      .then((status) => {
        setVoiceSetupMessage(status.message);
        if (!status.available) return;
        setVoiceSetupOpen(false);
        setToast({ kind: "info", message: "Local Whisper voice input is ready." });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to save the Whisper CLI path.";
        setVoiceSetupMessage(message);
        setToast({ kind: "error", message });
      });
  }, [configureVoiceInputMutation, setToast, voiceCommandPath]);

  const insertTicketReference = (candidate: TicketReferenceCandidate): void => {
    const editor = ideaEditorRef.current;
    const currentMention =
      ticketReferenceMention?.token ?? (editor ? getActiveTicketMention(idea, editor.selectionStart, editor.selectionEnd) : null);
    if (!currentMention) return;

    const next = replaceTicketMention(idea, currentMention, candidate);
    setIdea(next.value);
    setTicketReferenceMention(null);
    setTicketReferenceMenuStyle(null);
    window.requestAnimationFrame(() => {
      editor?.focus();
      editor?.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const submitDraft = async (): Promise<void> => {
    const ideaSnapshot = idea.trim();
    if (!ideaSnapshot || busy) return;
    const requestSequence = draftRequestRef.current + 1;
    draftRequestRef.current = requestSequence;
    try {
      const result = await createDraftMutation.mutateAsync(
        getFloatingComposerDraftInput({
          projectPath,
          idea: ideaSnapshot,
          priority,
          effort,
          agentModel: cursorAgentModel,
          selectedProviderId,
          draftType
        })
      );
      if (draftRequestRef.current !== requestSequence) return;
      if (!result.ok) {
        setToast({ kind: "error", message: result.error.message });
        return;
      }
      setIdea("");
      setTicketReferenceMention(null);
      setToast({ kind: "info", message: `Agent draft started for ${result.ticket.frontMatter.title}.` });
      void Promise.resolve(onCreated()).catch((error) => {
        setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to refresh board." });
      });
    } catch (error) {
      if (draftRequestRef.current !== requestSequence) return;
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Ticket drafting failed." });
    } finally {
      if (draftRequestRef.current !== requestSequence) return;
    }
  };

  const handleTicketReferenceKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (ticketReferenceMention) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setTicketReferenceMention(null);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveTicketReferenceIndex((current) =>
          filteredTicketReferences.length === 0 ? 0 : (current + 1) % filteredTicketReferences.length
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveTicketReferenceIndex((current) =>
          filteredTicketReferences.length === 0 ? 0 : (current - 1 + filteredTicketReferences.length) % filteredTicketReferences.length
        );
        return;
      }

      if ((event.key === "Enter" || event.key === "Tab") && filteredTicketReferences.length > 0) {
        event.preventDefault();
        insertTicketReference(filteredTicketReferences[activeTicketReferenceIndex] ?? filteredTicketReferences[0]);
        return;
      }
    }

    if (isTicketComposerSubmitShortcut(event)) {
      event.preventDefault();
      void submitDraft();
    }
  };

  const renderTicketReferenceMenu = (menuId: string): ReactElement | null => {
    if (!ticketReferenceMention || !ticketReferenceMenuStyle || typeof document === "undefined") return null;

    return createPortal(
      <div
        className="ticket-reference-menu floating"
        id={menuId}
        role="listbox"
        aria-label="Ticket references"
        style={ticketReferenceMenuStyle}
      >
        {ticketReferencesLoading && <div className="ticket-reference-empty">Loading local tickets...</div>}
        {!ticketReferencesLoading && ticketReferencesError && <div className="ticket-reference-empty">{ticketReferencesError}</div>}
        {!ticketReferencesLoading && !ticketReferencesError && filteredTicketReferences.length === 0 && (
          <div className="ticket-reference-empty">
            {ticketReferences.length === 0 ? "No tickets in this project." : "No matching tickets."}
          </div>
        )}
        {!ticketReferencesLoading &&
          !ticketReferencesError &&
          filteredTicketReferences.map((candidate, index) => (
            <Button
              key={candidate.id}
              type="button"
              className={clsx("ticket-reference-option", index === activeTicketReferenceIndex && "active")}
              role="option"
              aria-selected={index === activeTicketReferenceIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveTicketReferenceIndex(index)}
              onClick={() => insertTicketReference(candidate)}
            >
              <strong>{candidate.title}</strong>
              <span>{candidate.relativePath}</span>
              <em>{candidate.columnName}</em>
            </Button>
          ))}
      </div>,
      document.body
    );
  };

  const voiceButtonLabel = recording
    ? "Stop recording and transcribe"
    : transcribing
      ? "Transcribing voice input locally"
      : "Record ticket idea with voice";
  const voiceButtonTooltip = recording
    ? "Stop recording and transcribe"
    : transcribing
      ? "Transcribing audio locally..."
      : voiceInputEnabled
        ? "Record voice idea"
        : "Set up local Whisper path";
  const voiceButtonDisabled = recording ? false : busy || transcribing || configureVoiceInputMutation.isPending;

  return (
    <>
      <section className="floating-ticket-composer" aria-label="Draft ticket idea">
        <div className="floating-ticket-input-row">
          <div className="ticket-reference-editor floating-ticket-reference-editor">
            <Textarea
              ref={ideaEditorRef}
              value={idea}
              rows={1}
              placeholder="Draft a ticket idea..."
              aria-label="Ticket idea"
              aria-autocomplete="list"
              aria-controls="floating-ticket-reference-menu"
              aria-expanded={ideaTicketReferenceMenuOpen}
              onChange={(event) => {
                setIdea(event.target.value);
                updateTicketReferenceMention(event.target.value, event.target.selectionStart, event.target.selectionEnd);
              }}
              onFocus={(event) =>
                updateTicketReferenceMention(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
              }
              onSelect={(event) =>
                updateTicketReferenceMention(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
              }
              onKeyDown={handleTicketReferenceKeyDown}
              onBlur={() => {
                window.setTimeout(closeTicketReferenceMenu, 120);
              }}
            />
            {renderTicketReferenceMenu("floating-ticket-reference-menu")}
          </div>
          <Tooltip label={voiceButtonTooltip}>
            <Button
              type="button"
              className={clsx("floating-ticket-voice", recording && "recording", !voiceInputEnabled && "setup-required")}
              onClick={handleVoiceInput}
              disabled={voiceButtonDisabled}
              aria-label={voiceButtonLabel}
              title={voiceButtonLabel}
              aria-pressed={recording || undefined}
            >
              {transcribing ? <Loader2 className="spin" size={16} /> : recording ? <Square size={16} /> : <Mic size={16} />}
            </Button>
          </Tooltip>
          <Button
            type="button"
            className="floating-ticket-submit"
            onClick={() => void submitDraft()}
            disabled={!canSubmit}
            aria-label="Draft ticket with agent"
            title="Draft ticket with agent"
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          </Button>
        </div>
        <div className="floating-ticket-controls" aria-label="Ticket draft options">
          <label>
            <span>Type</span>
            <Select value={draftType} onChange={(event) => setDraftType(event.target.value as FloatingComposerDraftType)}>
              {floatingComposerDraftTypeOptions.map((option) => (
                <option value={option} key={option}>
                  {floatingComposerDraftTypeLabel(option)}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>Priority</span>
            <Select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}>
              {priorityOptions.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
          {usesCursorAgent ? (
            <label>
              <span>Model</span>
              <Select value={cursorAgentModel} onChange={(event) => setCursorAgentModel(event.target.value as CursorAgentModel)}>
                {cursorAgentModelOptions.map((option) => (
                  <option value={option} key={option}>
                    {cursorAgentModelLabel(option)}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <label>
              <span>Effort</span>
              <Select value={effort} onChange={(event) => setEffort(event.target.value as TicketEffort)}>
                {ticketEffortOptions.map((option) => (
                  <option value={option} key={option}>
                    {ticketEffortLabel(option)}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>
      </section>
      {voiceSetupOpen ? (
        <VoiceInputSetupModal
          commandPath={voiceCommandPath}
          statusMessage={voiceSetupMessage ?? voiceStatusMessage}
          onCommandPathChange={setVoiceCommandPath}
          onClose={() => {
            if (configureVoiceInputMutation.isPending) return;
            setVoiceSetupOpen(false);
          }}
          onSave={saveVoiceCommandPath}
          savePending={configureVoiceInputMutation.isPending}
        />
      ) : null}
    </>
  );
}

function TicketDetail({
  projectPath,
  ticketId,
  board,
  events,
  gitMetadata,
  onClose,
  onOpenTicket,
  onChanged,
  setToast
}: {
  projectPath: string;
  ticketId: string;
  board: BoardSnapshot;
  events: RendererRunEvent[];
  gitMetadata: GitMetadata | undefined;
  onClose: () => void;
  onOpenTicket: (ticketId: string) => void;
  onChanged: () => void | Promise<void>;
  setToast: (toast: Toast) => void;
}): ReactElement {
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [effort, setEffort] = useState<TicketEffort>("medium");
  const [status, setStatus] = useState("todo");
  const [labels, setLabels] = useState("");
  const [blockedByIds, setBlockedByIds] = useState<string[]>([]);
  const [markdown, setMarkdown] = useState("");
  const [summary, setSummary] = useState("");
  const [markdownMode, setMarkdownMode] = useState<TicketMarkdownMode>("preview");
  const [fullTicketBodyOpen, setFullTicketBodyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [runPreflight, setRunPreflight] = useState<CodexRunPreflightResult | null>(null);
  const [redraftRunId, setRedraftRunId] = useState<string | null>(null);
  const [ticketUpdateRequest, setTicketUpdateRequest] = useState("");
  const [ticketUpdateRunId, setTicketUpdateRunId] = useState<string | null>(null);
  const [ticketUpdateStatus, setTicketUpdateStatus] = useState<RunStatus>("idle");
  const [ticketUpdateStartedAt, setTicketUpdateStartedAt] = useState<string | null>(null);
  const [ticketUpdateEndedAt, setTicketUpdateEndedAt] = useState<string | null>(null);
  const [ticketUpdateError, setTicketUpdateError] = useState<string | null>(null);
  const [ticketUpdateCancelling, setTicketUpdateCancelling] = useState(false);
  const [ticketUpdateLogViewerOpen, setTicketUpdateLogViewerOpen] = useState(false);
  const [attachmentDropActive, setAttachmentDropActive] = useState(false);
  const [attachmentDropBusy, setAttachmentDropBusy] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [addTicketsOpen, setAddTicketsOpen] = useState(false);
  const [blockerPanelOpen, setBlockerPanelOpen] = useState(false);
  const [newSubticketTitle, setNewSubticketTitle] = useState("");
  const [newSubticketPriority, setNewSubticketPriority] = useState<TicketPriority>("medium");
  const [newSubticketLabels, setNewSubticketLabels] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [linkSubticketId, setLinkSubticketId] = useState("");
  const [subticketBusy, setSubticketBusy] = useState(false);
  const [approvingScopeClarificationId, setApprovingScopeClarificationId] = useState<string | null>(null);
  const ticketUpdateInputRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const labelsInputRef = useRef<HTMLInputElement | null>(null);
  const subticketsPanelRef = useRef<HTMLElement | null>(null);
  const ticketQuery = useTicketQuery(projectPath, ticketId);
  const clarificationsQuery = useTicketClarificationsQuery(projectPath, ticketId);
  const runEventsQuery = useRunEventsQuery(projectPath, ticketId, runId);
  const runSummaryQuery = useRunSummaryQuery(projectPath, ticketId);
  const saveAttachmentMutation = useSaveTicketAttachmentMutation();
  const saveTicketMutation = useSaveTicketMutation();
  const archiveTicketMutation = useArchiveTicketMutation();
  const startTicketUpdateMutation = useStartTicketUpdateMutation();
  const cancelTicketUpdateMutation = useCancelTicketUpdateMutation();
  const preflightRunMutation = usePreflightRunMutation();
  const startRunMutation = useStartRunMutation();
  const moveTicketMutation = useMoveTicketMutation();
  const createDraftMutation = useCreateDraftMutation();
  const redraftTicketMutation = useRedraftTicketMutation();
  const cancelRunMutation = useCancelRunMutation();
  const answerClarificationMutation = useAnswerClarificationMutation();
  const approveScopeClarificationMutation = useApproveScopeClarificationMutation();
  const deleteTicketMutation = useDeleteTicketMutation();
  const duplicateTicketMutation = useDuplicateTicketMutation();
  const createSubticketMutation = useCreateSubticketMutation();
  const linkSubticketMutation = useLinkSubticketMutation();
  const unlinkSubticketMutation = useUnlinkSubticketMutation();
  const createTaskUnderFeatureMutation = useCreateTaskUnderFeatureMutation();
  const linkFeatureSubticketMutation = useLinkFeatureSubticketMutation();
  const revealTicketFileMutation = useRevealTicketFileMutation();
  const clarifications = clarificationsQuery.data ?? [];
  const persistedEvents = runEventsQuery.data ?? [];
  const runSummary = runSummaryQuery.data ?? null;
  const logLoading = Boolean(runId) && (runEventsQuery.isLoading || runSummaryQuery.isLoading || runEventsQuery.isFetching || runSummaryQuery.isFetching);
  const logError =
    runEventsQuery.error || runSummaryQuery.error
      ? relayErrorMessage(runEventsQuery.error ?? runSummaryQuery.error, "Unknown error")
      : null;
  const detailError =
    ticketQuery.error || clarificationsQuery.error
      ? relayErrorMessage(ticketQuery.error ?? clarificationsQuery.error, `Ticket ${ticketId} could not be loaded for ${projectPath}.`)
      : null;

  const refreshDetail = useCallback(async (): Promise<void> => {
    const requests: Promise<unknown>[] = [ticketQuery.refetch(), clarificationsQuery.refetch(), runSummaryQuery.refetch()];
    if (runId) requests.push(runEventsQuery.refetch());
    await Promise.all(requests);
  }, [clarificationsQuery, runEventsQuery, runId, runSummaryQuery, ticketQuery]);

  useEffect(() => {
    const record = ticketQuery.data;
    if (!record) return;
    setTicket(record);
    setTitle(record.frontMatter.title);
    setPriority(record.frontMatter.priority);
    setEffort(record.frontMatter.effort);
    setStatus(record.frontMatter.status);
    setLabels(record.frontMatter.labels.join(", "));
    setBlockedByIds(record.frontMatter.blockedByIds ?? []);
    setMarkdown(record.markdown);
    setSummary(ticketRecordPreviewSummary(record));
    setRunId(record.frontMatter.lastRunId);
  }, [ticketQuery.data]);

  useEffect(() => {
    setAnswerDrafts((current) =>
      Object.fromEntries(
        clarifications
          .filter((question) => !question.answer)
          .map((question) => [
            question.id,
            current[question.id] ??
              (isMissingPlannedScopeClarificationQuestion(question) ? MISSING_PLANNED_SCOPE_ANSWER_DRAFT : "")
          ])
      )
    );
  }, [clarifications]);

  useEffect(() => {
    if (detailError) setToast({ kind: "error", message: detailError });
  }, [detailError, setToast]);

  useEffect(() => {
    setTicketUpdateRequest("");
    setTicketUpdateRunId(null);
    setTicketUpdateStatus("idle");
    setTicketUpdateStartedAt(null);
    setTicketUpdateEndedAt(null);
    setTicketUpdateError(null);
    setTicketUpdateCancelling(false);
    setTicketUpdateLogViewerOpen(false);
    setAttachmentDropActive(false);
    setAttachmentDropBusy(false);
    setTitleEditing(false);
    setRunPreflight(null);
    setRedraftRunId(null);
    setAddTicketsOpen(false);
    setBlockerPanelOpen(false);
    setNewSubticketTitle("");
    setNewSubticketPriority("medium");
    setNewSubticketLabels("");
    setNewTaskDescription("");
    setLinkSubticketId("");
    setSubticketBusy(false);
    setApprovingScopeClarificationId(null);
    setBlockedByIds([]);
    setMarkdownMode("preview");
    setFullTicketBodyOpen(false);
  }, [projectPath, ticketId]);

  useEffect(() => {
    const terminalDraftEvent = [...events]
      .reverse()
      .find(
        (event): event is Extract<RendererRunEvent, { type: "run.completed" }> =>
          event.ticketId === ticketId && event.type === "run.completed"
      );
    if (terminalDraftEvent?.resolvedTicketId && terminalDraftEvent.resolvedTicketId !== ticketId) {
      onOpenTicket(terminalDraftEvent.resolvedTicketId);
      return;
    }
    if (
      events.some(
        (event) =>
          event.ticketId === ticketId &&
          (event.type === "clarification.requested" ||
            event.type === "run.completed" ||
            event.type === "run.failed" ||
            event.type === "ticket.status_changed")
      )
    ) {
      void refreshDetail();
    }
  }, [events, onOpenTicket, refreshDetail, ticketId]);

  const currentRunEvents = useMemo(() => {
    const liveRunEvents = runId ? events.filter((event) => event.runId === runId) : [];
    return mergeRunEvents(persistedEvents, liveRunEvents);
  }, [events, persistedEvents, runId]);
  const draftInProgress = ticket?.frontMatter.runStatus === "drafting";
  const draftFailed = ticket?.frontMatter.runStatus === "draft_failed";
  const redraftEligible = ticket ? canRedraftTicket(ticket) : false;
  const redraftActive = Boolean(ticket && draftInProgress && redraftRunId && ticket.frontMatter.lastRunId === redraftRunId);
  const draftFailureMessage = useMemo(
    () => [...currentRunEvents].reverse().find((event) => event.type === "run.failed")?.message ?? "Agent ticket drafting failed.",
    [currentRunEvents]
  );
  const ticketUpdateEvents = useMemo(
    () => (ticketUpdateRunId ? events.filter((event) => event.runId === ticketUpdateRunId) : []),
    [events, ticketUpdateRunId]
  );
  const ticketUpdateActive = isAgentSessionActive(ticketUpdateStatus) || ticketUpdateCancelling;
  const runQueued = ticket?.frontMatter.runStatus === "queued";
  const detailAuthoringState: TicketAuthoringState | null = ticket
    ? ticketUpdateActive
      ? "refining"
      : ticket.frontMatter.authoringState
    : null;
  const showDetailAuthoringState =
    Boolean(detailAuthoringState) &&
    detailAuthoringState !== "rough" &&
    (ticket?.frontMatter.runStatus === "idle" || ticketUpdateActive);
  const linkedChildTickets = useMemo(() => {
    if (!ticket || (ticket.frontMatter.ticketType !== "epic" && ticket.frontMatter.ticketType !== "feature")) return [];
    const byId = new Map(board.tickets.map((item) => [item.id, item]));
    const ordered = ticket.frontMatter.subticketIds.map((id) => byId.get(id)).filter((item): item is TicketSummary => Boolean(item));
    const derived = board.tickets.filter((item) => {
      if (ticket.frontMatter.ticketType === "epic") {
        return item.parentEpicId === ticket.frontMatter.id && !ticket.frontMatter.subticketIds.includes(item.id);
      }
      return item.parentFeatureId === ticket.frontMatter.id && !ticket.frontMatter.subticketIds.includes(item.id);
    });
    return [...ordered, ...derived].sort((a, b) => {
      const aIndex = ticket.frontMatter.subticketIds.indexOf(a.id);
      const bIndex = ticket.frontMatter.subticketIds.indexOf(b.id);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.position - b.position;
    });
  }, [board.tickets, ticket]);
  const linkedSubtickets = linkedChildTickets;
  const linkedTasks = linkedChildTickets;
  const parentEpic = useMemo(
    () => (ticket?.frontMatter.parentEpicId ? board.tickets.find((item) => item.id === ticket.frontMatter.parentEpicId) ?? null : null),
    [board.tickets, ticket?.frontMatter.parentEpicId]
  );
  const parentFeature = useMemo(
    () =>
      ticket?.frontMatter.parentFeatureId
        ? board.tickets.find((item) => item.id === ticket.frontMatter.parentFeatureId) ?? null
        : null,
    [board.tickets, ticket?.frontMatter.parentFeatureId]
  );
  const standaloneTaskNote =
    ticket?.frontMatter.ticketType === "task" && !ticket.frontMatter.parentFeatureId
      ? "Standalone task — not grouped under a feature. The agent can run on this ticket directly."
      : null;
  const parentEpicBlockers = useMemo(
    () => (parentEpic ? resolveTicketBlockers(parentEpic, board.tickets, board.columns) : null),
    [board.columns, board.tickets, parentEpic]
  );
  const blockerResolution = useMemo(
    () => (ticket ? resolveTicketBlockers({ id: ticket.frontMatter.id, blockedByIds }, board.tickets, board.columns) : null),
    [blockedByIds, board.columns, board.tickets, ticket]
  );
  const relatedTickets = useMemo(() => {
    if (!ticket || ticket.frontMatter.relatedTicketIds.length === 0) return [];
    const byId = new Map(board.tickets.map((item) => [item.id, item]));
    return ticket.frontMatter.relatedTicketIds.map((id) => ({ id, ticket: byId.get(id) ?? null }));
  }, [board.tickets, ticket]);
  const blockerCandidates = useMemo(() => {
    if (!ticket) return [];
    return board.tickets
      .filter((item) => item.id !== ticket.frontMatter.id)
      .sort((a, b) => ticketBlockerOptionLabel(a, board.tickets, board.columns).localeCompare(ticketBlockerOptionLabel(b, board.tickets, board.columns)));
  }, [board.columns, board.tickets, ticket]);
  const blockerCount = blockedByIds.length;
  const labelCount = useMemo(() => labelsFromInput(labels).length, [labels]);
  const linkableEpicChildren = useMemo(() => {
    if (!ticket || ticket.frontMatter.ticketType !== "epic") return [];
    const linkedIds = new Set(linkedSubtickets.map((item) => item.id));
    return board.tickets
      .filter((item) => item.id !== ticket.frontMatter.id && item.ticketType === "feature" && !linkedIds.has(item.id))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [board.tickets, linkedSubtickets, ticket]);
  const linkableFeatureTasks = useMemo(() => {
    if (!ticket || ticket.frontMatter.ticketType !== "feature") return [];
    const linkedIds = new Set(linkedTasks.map((item) => item.id));
    return board.tickets
      .filter((item) => item.id !== ticket.frontMatter.id && item.ticketType === "task" && !linkedIds.has(item.id))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [board.tickets, linkedTasks, ticket]);
  const pendingClarifications = useMemo(() => clarifications.filter((question) => !question.answer?.trim()), [clarifications]);
  const answeredClarifications = useMemo(() => clarifications.filter((question) => Boolean(question.answer?.trim())), [clarifications]);
  const unansweredClarificationCount = pendingClarifications.length;
  const sidebarClarifications = pendingClarifications.length > 0 ? answeredClarifications : clarifications;
  const scopeRecoveryActionQuestionIds = useMemo(
    () => new Set(getScopeRecoveryClarificationActionQuestionIds(ticket, clarifications)),
    [clarifications, ticket]
  );
  const reviewActionState = useMemo(() => {
    if (!ticket) return { showAcceptReject: false, acceptEnabled: false };
    return getTicketReviewActionState({
      ticketType: ticket.frontMatter.ticketType,
      status: ticket.frontMatter.status,
      columns: board.columns,
      allTickets: board.tickets,
      ticketId: ticket.frontMatter.id
    });
  }, [board.columns, board.tickets, ticket]);
  const ticketIsCompleted = ticket?.frontMatter.status === "completed";
  const archiveStatusAvailable = board.columns.some((column) => column.id === RELAY_ARCHIVE_STATUS);
  const detailArchiveTarget = useMemo(() => {
    if (!ticket || !archiveStatusAvailable || !ticketIsCompleted) return null;
    const summary = board.tickets.find((entry) => entry.id === ticket.frontMatter.id);
    return resolveDetailArchiveTarget(summary, board.tickets, {
      archiveStatusAvailable,
      ticketStatus: ticket.frontMatter.status
    });
  }, [archiveStatusAvailable, board.tickets, ticket, ticketIsCompleted]);

  useEffect(() => {
    if (!ticketUpdateRunId || ticketUpdateEndedAt) return;
    const terminalEvent = [...ticketUpdateEvents]
      .reverse()
      .find((event) => event.type === "run.completed" || event.type === "run.failed");
    if (!terminalEvent) return;

    setTicketUpdateEndedAt(terminalEvent.timestamp);
    setTicketUpdateCancelling(false);
    if (terminalEvent.type === "run.completed") {
      setTicketUpdateStatus("completed");
      setTicketUpdateError(null);
      setTicketUpdateRequest("");
      setToast({ kind: "success", message: "Ticket refined by agent." });
      void Promise.resolve(onChanged()).then(() => refreshDetail());
      return;
    }

    if (ticketUpdateStatus === "cancelled" || /cancelled/i.test(terminalEvent.message)) {
      setTicketUpdateStatus("cancelled");
      setTicketUpdateError(null);
      setToast({ kind: "info", message: "Ticket update cancelled." });
      return;
    }

    setTicketUpdateStatus("failed");
    setTicketUpdateError(terminalEvent.message || "Ticket update failed.");
    setToast({ kind: "error", message: terminalEvent.message || "Ticket update failed." });
  }, [onChanged, refreshDetail, setToast, ticketUpdateEndedAt, ticketUpdateEvents, ticketUpdateRunId, ticketUpdateStatus]);

  const isContainerTicket =
    ticket?.frontMatter.ticketType === "epic" || ticket?.frontMatter.ticketType === "feature";

  const ticketFieldChanges = useMemo(() => {
    if (!ticket) return false;
    return (
      title !== ticket.frontMatter.title ||
      priority !== ticket.frontMatter.priority ||
      effort !== ticket.frontMatter.effort ||
      (!isContainerTicket && status !== ticket.frontMatter.status) ||
      labels !== ticket.frontMatter.labels.join(", ") ||
      !sameStringArray(blockedByIds, ticket.frontMatter.blockedByIds ?? []) ||
      markdown !== ticket.markdown
    );
  }, [blockedByIds, effort, isContainerTicket, labels, markdown, priority, status, ticket, title]);

  const hasUnsavedChanges = useMemo(() => {
    if (!ticket) return Boolean(busy || submittingAnswerId || ticketUpdateActive || ticketUpdateRequest.trim());
    return (
      busy ||
      attachmentDropBusy ||
      subticketBusy ||
      Boolean(submittingAnswerId) ||
      ticketUpdateActive ||
      ticketUpdateRequest.trim().length > 0 ||
      newSubticketTitle.trim().length > 0 ||
      newSubticketLabels.trim().length > 0 ||
      linkSubticketId.length > 0 ||
      ticketFieldChanges ||
      Object.values(answerDrafts).some((answer) => answer.trim().length > 0)
    );
  }, [
    answerDrafts,
    attachmentDropBusy,
    busy,
    linkSubticketId,
    newSubticketLabels,
    newSubticketTitle,
    submittingAnswerId,
    subticketBusy,
    ticket,
    ticketFieldChanges,
    ticketUpdateActive,
    ticketUpdateRequest
  ]);

  useShortcutOverlay({
    id: `ticket-detail:${ticketId}`,
    priority: 20,
    onEscape: () => {
      if (fullTicketBodyOpen) {
        setFullTicketBodyOpen(false);
        return true;
      }
      if (hasUnsavedChanges) {
        setToast({ kind: "info", message: "Ticket detail has pending input. Finish or discard it before closing." });
        return true;
      }
      onClose();
      return true;
    }
  });

  const droppedFiles = (event: DragEvent<HTMLTextAreaElement>): File[] => Array.from(event.dataTransfer.files);

  const handleMarkdownDragOver = (event: DragEvent<HTMLTextAreaElement>): void => {
    if (draftInProgress || attachmentDropBusy) return;
    const items = Array.from(event.dataTransfer.items).filter((item) => item.kind === "file");
    if (items.length === 0) return;

    const allImages = items.every((item) => item.type === "" || item.type.startsWith("image/"));
    if (!allImages) {
      event.dataTransfer.dropEffect = "none";
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setAttachmentDropActive(true);
  };

  const handleMarkdownDragLeave = (event: DragEvent<HTMLTextAreaElement>): void => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setAttachmentDropActive(false);
  };

  const handleMarkdownDrop = async (event: DragEvent<HTMLTextAreaElement>): Promise<void> => {
    if (draftInProgress || attachmentDropBusy) return;
    const files = droppedFiles(event);
    if (files.length === 0) return;

    event.preventDefault();
    setAttachmentDropActive(false);
    if (files.some((file) => !isSupportedDroppedImageFile(file))) {
      setToast({ kind: "error", message: "Only image files can be dropped into ticket markdown." });
      return;
    }

    const editor = event.currentTarget;
    const selectionStart = editor.selectionStart;
    const selectionEnd = editor.selectionEnd;
    setAttachmentDropBusy(true);
    try {
      const attachments: TicketAttachmentSaveResult[] = [];
      for (const file of files) {
        attachments.push(await saveAttachmentMutation.mutateAsync(await droppedImageFileToAttachmentInput(projectPath, file)));
      }
      const inserted = insertMarkdownAtSelection(markdown, attachmentMarkdownBlock(attachments), selectionStart, selectionEnd);
      setMarkdown(inserted.value);
      window.requestAnimationFrame(() => {
        markdownEditorRef.current?.focus();
        markdownEditorRef.current?.setSelectionRange(inserted.cursor, inserted.cursor);
      });
      setToast({
        kind: "success",
        message: attachments.length === 1 ? "Image attached to ticket markdown." : `${attachments.length} images attached to ticket markdown.`
      });
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to save dropped image." });
    } finally {
      setAttachmentDropBusy(false);
    }
  };

  const persistTicketChanges = useCallback(async (): Promise<void> => {
    if (!ticket || draftInProgress || !ticketFieldChanges) return;
    if (blockerResolution && blockerResolution.selfBlockerIds.length > 0) {
      setToast({ kind: "error", message: "Remove the self blocker before saving this ticket." });
      return;
    }

    try {
      await saveTicketMutation.mutateAsync({
        projectPath,
        ticket: {
          ...ticket,
          markdown,
          frontMatter: {
            ...ticket.frontMatter,
            title,
            priority,
            effort,
            status: isContainerTicket ? ticket.frontMatter.status : status,
            labels: labelsFromInput(labels),
            blockedByIds,
            summary: ticket.frontMatter.summary?.trim() || ticketRecordPreviewSummary(ticket)
          }
        }
      });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to save ticket changes." });
    }
  }, [
    blockedByIds,
    blockerResolution,
    draftInProgress,
    effort,
    labels,
    markdown,
    onChanged,
    priority,
    projectPath,
    refreshDetail,
    saveTicketMutation,
    setToast,
    isContainerTicket,
    status,
    ticket,
    ticketFieldChanges,
    title
  ]);

  useEffect(() => {
    if (!ticketFieldChanges || draftInProgress) return;
    const timer = window.setTimeout(() => {
      void persistTicketChanges();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    blockedByIds,
    draftInProgress,
    effort,
    labels,
    markdown,
    persistTicketChanges,
    priority,
    status,
    ticketFieldChanges,
    title
  ]);

  const startTicketUpdate = async (): Promise<void> => {
    if (!ticket || ticketUpdateActive || draftInProgress) return;
    const request = ticketUpdateRequest.trim();
    if (!request) {
      setTicketUpdateError("Enter a change request before starting the ticket update agent.");
      return;
    }

    const startedAt = new Date().toISOString();
    setTicketUpdateStatus("running");
    setTicketUpdateStartedAt(startedAt);
    setTicketUpdateEndedAt(null);
    setTicketUpdateError(null);
    setTicketUpdateCancelling(false);
    try {
      const result = await startTicketUpdateMutation.mutateAsync({ projectPath, ticketId, request });
      setTicketUpdateRunId(result.runId);
      setToast({ kind: "info", message: `Ticket update agent started: ${result.runId}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ticket update agent failed to start.";
      setTicketUpdateStatus("failed");
      setTicketUpdateEndedAt(new Date().toISOString());
      setTicketUpdateError(message);
      setToast({ kind: "error", message });
    }
  };

  const cancelTicketUpdate = async (): Promise<void> => {
    if (!ticketUpdateRunId || !ticketUpdateActive) return;
    setTicketUpdateStatus("cancelled");
    setTicketUpdateCancelling(true);
    try {
      await cancelTicketUpdateMutation.mutateAsync(ticketUpdateRunId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel ticket update.";
      setTicketUpdateStatus("running");
      setTicketUpdateCancelling(false);
      setTicketUpdateError(message);
      setToast({ kind: "error", message });
    }
  };

  const startRun = async (resume: boolean, freshThread = false): Promise<void> => {
    if (draftInProgress) {
      setToast({ kind: "info", message: "Wait for the agent to finish drafting before starting a run." });
      return;
    }
    setBusy(true);
    try {
      setRunPreflight(null);
      const runInput = { projectPath, ticketId, freshThread: freshThread ?? false, resume: resume ? true : undefined };
      const preflight = await preflightRunMutation.mutateAsync(runInput);
      setRunPreflight(preflight);
      if (!preflight.ok) {
        setToast({ kind: "error", message: preflight.errors.join(" ") || "Agent run is blocked." });
        await Promise.resolve(onChanged());
        await refreshDetail();
        return;
      }
      const result = await startRunMutation.mutateAsync({
        resume,
        input: { projectPath, ticketId, freshThread: freshThread ?? false, resume: resume ? true : undefined }
      });
      setRunId(result.runId);
      setToast({
        kind: "info",
        message: result.state === "queued" ? `Agent run queued: ${result.runId}` : `Agent run started: ${result.runId}`
      });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Agent run failed to start." });
    } finally {
      setBusy(false);
    }
  };

  const moveTicketTo = async (targetStatus: string, successMessage: string): Promise<void> => {
    if (!ticket) return;
    setBusy(true);
    try {
      await moveTicketMutation.mutateAsync({ projectPath, ticketId, targetStatus });
      setToast({ kind: "success", message: successMessage });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to update ticket status." });
    } finally {
      setBusy(false);
    }
  };

  const acceptReviewTicket = async (): Promise<void> => {
    if (!ticket) return;
    const ticketType = ticket.frontMatter.ticketType;
    if (ticketType === "task") {
      await moveTicketTo(RELAY_COMPLETED_STATUS, "Ticket accepted.");
      return;
    }

    const summary = board.tickets.find((entry) => entry.id === ticket.frontMatter.id);
    if (!summary || !getReviewAcceptEnabled(summary, board.tickets, board.columns)) return;

    setBusy(true);
    try {
      const sortedIds = await moveReviewAcceptBundle({
        projectPath,
        container: summary,
        allTickets: board.tickets,
        columns: board.columns,
        moveTicket: (input) => moveTicketMutation.mutateAsync(input)
      });
      if (sortedIds.length === 0) return;
      setToast({ kind: "success", message: reviewAcceptSuccessMessage(summary, sortedIds) });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to accept tickets." });
    } finally {
      setBusy(false);
    }
  };

  const rejectReviewTicket = (): void => {
    // Workspace revert on reject is wired in a later stage; both paths complete the ticket.
    void moveTicketTo(RELAY_COMPLETED_STATUS, "Ticket rejected and moved to Completed.");
  };

  const createFollowUpDraft = async (): Promise<void> => {
    if (!ticket) return;
    const request = ticketUpdateRequest.trim();
    if (!request) {
      setTicketUpdateError("Describe the follow-up issue or improvement before drafting a related ticket.");
      ticketUpdateInputRef.current?.focus();
      return;
    }

    setBusy(true);
    setTicketUpdateError(null);
    try {
      const result = await createDraftMutation.mutateAsync({
        projectPath,
        idea: `Create a follow-up ticket related to ${ticket.frontMatter.id} (${ticket.frontMatter.title}).\n\nFollow-up request:\n${request}`,
        preferredTicketType: "feature",
        relatedTicketIds: [ticket.frontMatter.id],
        runIntake: true
      });
      if (!result.ok) {
        setTicketUpdateError(result.error.message);
        setToast({ kind: "error", message: result.error.message });
        return;
      }

      setTicketUpdateRequest("");
      setToast({ kind: "info", message: `Agent draft started for ${result.ticket.frontMatter.title}.` });
      await Promise.resolve(onChanged());
      onOpenTicket(result.ticket.frontMatter.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to draft a follow-up ticket.";
      setTicketUpdateError(message);
      setToast({ kind: "error", message });
    } finally {
      setBusy(false);
    }
  };

  const redraftTicket = async (
    purpose: "default" | "implementation_scope" = "default",
    clarificationQuestionId?: string
  ): Promise<void> => {
    if (!ticket || draftInProgress) return;
    if (purpose === "default" && !redraftEligible) return;
    setBusy(true);
    try {
      const result = await redraftTicketMutation.mutateAsync({
        projectPath,
        ticketId,
        purpose,
        clarificationQuestionId
      });
      if (!result.ok) {
        setToast({ kind: "error", message: result.error.message });
        return;
      }

      setRunId(result.runId);
      setRedraftRunId(result.runId);
      setToast({
        kind: "info",
        message:
          purpose === "implementation_scope"
            ? `Task scope redraft started: ${result.runId}`
            : `Ticket redraft started: ${result.runId}`
      });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to start ticket redraft." });
    } finally {
      setBusy(false);
    }
  };

  const focusLabelsInput = (): void => {
    labelsInputRef.current?.scrollIntoView({ block: "center" });
    window.requestAnimationFrame(() => labelsInputRef.current?.focus());
  };

  const startTitleEditing = (): void => {
    if (draftInProgress) return;
    setTitleEditing(true);
  };

  const handleTitleDisplayKeyDown = (event: KeyboardEvent<HTMLHeadingElement>): void => {
    if (event.key !== "Enter" && event.key !== "F2") return;
    event.preventDefault();
    startTitleEditing();
  };

  const handleTitleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      setTitleEditing(false);
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setTitleEditing(false);
      event.currentTarget.blur();
    }
  };

  useEffect(() => {
    if (!titleEditing) return;
    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }, [titleEditing]);

  const toggleSubticketPanel = (): void => {
    const nextOpen = !addTicketsOpen;
    setAddTicketsOpen(nextOpen);
    if (nextOpen) {
      window.requestAnimationFrame(() => subticketsPanelRef.current?.scrollIntoView({ block: "nearest" }));
    }
  };

  const toggleBlocker = (blockerId: string): void => {
    setBlockedByIds((current) =>
      current.includes(blockerId) ? current.filter((candidate) => candidate !== blockerId) : [...current, blockerId]
    );
  };

  const removeBlocker = (blockerId: string): void => {
    setBlockedByIds((current) => current.filter((candidate) => candidate !== blockerId));
  };

  const activeRunId = runId ?? ticket?.frontMatter.lastRunId ?? null;
  const implementationPaused = ticket?.frontMatter.runStatus === "paused";
  const canDiscardPaused = implementationPaused && Boolean(activeRunId);

  const cancelRun = async (revertChanges = false): Promise<void> => {
    if (!activeRunId) return;
    try {
      const result = await cancelRunMutation.mutateAsync({ projectPath, ticketId, runId: activeRunId, revertChanges });
      const reverted = Boolean(result.revertMessage?.startsWith("Reverted"));
      setToast({
        kind:
          revertChanges && result.revertMessage
            ? reverted
              ? "success"
              : "error"
            : result.outcome === "discarded"
              ? "info"
              : "info",
        message:
          revertChanges && result.revertMessage
            ? result.revertMessage
            : result.outcome === "paused"
              ? "Implementation paused."
              : result.outcome === "discarded"
                ? "Implementation work discarded."
                : "Agent run stopped."
      });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to update agent run." });
    }
  };

  const submitClarificationAnswer = async (questionId: string): Promise<void> => {
    const answer = answerDrafts[questionId]?.trim();
    if (!answer) return;
    const question = clarifications.find((entry) => entry.id === questionId);
    const triggersScopeRedraft = question ? isMissingPlannedScopeClarificationQuestion(question) : false;

    setSubmittingAnswerId(questionId);
    try {
      if (triggersScopeRedraft) {
        const result = await redraftTicketMutation.mutateAsync({
          projectPath,
          ticketId,
          purpose: "implementation_scope",
          clarificationQuestionId: questionId
        });
        setRedraftRunId(result.runId);
        setToast({ kind: "info", message: `Task scope redraft started: ${result.runId}` });
      } else {
        await answerClarificationMutation.mutateAsync({ projectPath, ticketId, questionId, answer });
        setToast({ kind: "success", message: "Clarification answer saved." });
      }
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : triggersScopeRedraft ? "Unable to start task scope redraft." : "Unable to save clarification answer."
      });
    } finally {
      setSubmittingAnswerId(null);
    }
  };

  const approveScopeClarification = async (questionId: string): Promise<void> => {
    if (!ticket || draftInProgress) return;
    setApprovingScopeClarificationId(questionId);
    try {
      const result = await approveScopeClarificationMutation.mutateAsync({
        projectPath,
        ticketId,
        clarificationQuestionId: questionId
      });
      setRunId(result.runId);
      setTicketUpdateRunId(result.runId);
      setTicketUpdateStatus("running");
      setTicketUpdateStartedAt(new Date().toISOString());
      setTicketUpdateEndedAt(null);
      setTicketUpdateError(null);
      setToast({ kind: "info", message: `Task scope redraft started: ${result.runId}` });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to start task scope redraft." });
    } finally {
      setApprovingScopeClarificationId(null);
    }
  };

  const remove = async (): Promise<void> => {
    await deleteTicketMutation.mutateAsync({ projectPath, ticketId });
    setToast({ kind: "success", message: "Ticket moved to trash." });
    await Promise.resolve(onChanged());
    onClose();
  };

  const duplicate = async (): Promise<void> => {
    await duplicateTicketMutation.mutateAsync({ projectPath, ticketId });
    setToast({ kind: "success", message: "Ticket duplicated." });
    await Promise.resolve(onChanged());
  };

  const createChildTicket = async (): Promise<void> => {
    if (!ticket) return;
    const childTitle = newSubticketTitle.trim();
    if (!childTitle) {
      setToast({ kind: "error", message: ticket.frontMatter.ticketType === "feature" ? "Enter a task title." : "Enter a feature title." });
      return;
    }
    setSubticketBusy(true);
    try {
      if (ticket.frontMatter.ticketType === "feature") {
        await createTaskUnderFeatureMutation.mutateAsync({
          projectPath,
          featureId: ticket.frontMatter.id,
          input: {
            title: childTitle,
            description: newTaskDescription.trim() || undefined,
            priority: newSubticketPriority
          }
        });
      } else if (ticket.frontMatter.ticketType === "epic") {
        await createSubticketMutation.mutateAsync({
          projectPath,
          epicId: ticket.frontMatter.id,
          ticket: {
            title: childTitle,
            priority: newSubticketPriority,
            effort,
            labels: labelsFromInput(newSubticketLabels),
            markdown: manualFeatureMarkdown(childTitle, ticket.frontMatter.title)
          }
        });
      } else {
        return;
      }
      setNewSubticketTitle("");
      setNewSubticketPriority("medium");
      setNewSubticketLabels("");
      setNewTaskDescription("");
      setToast({
        kind: "success",
        message: ticket.frontMatter.ticketType === "feature" ? "Task added." : "Feature added."
      });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to add child ticket." });
    } finally {
      setSubticketBusy(false);
    }
  };

  const linkExistingTicket = async (): Promise<void> => {
    if (!ticket || !linkSubticketId) return;
    setSubticketBusy(true);
    try {
      if (ticket.frontMatter.ticketType === "epic") {
        await linkSubticketMutation.mutateAsync({ projectPath, epicId: ticket.frontMatter.id, ticketId: linkSubticketId });
      } else if (ticket.frontMatter.ticketType === "feature") {
        await linkFeatureSubticketMutation.mutateAsync({
          projectPath,
          featureId: ticket.frontMatter.id,
          ticketId: linkSubticketId
        });
      } else {
        return;
      }
      setLinkSubticketId("");
      setToast({ kind: "success", message: "Ticket linked." });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to link ticket." });
    } finally {
      setSubticketBusy(false);
    }
  };

  const unlinkChildTicket = async (childId: string): Promise<void> => {
    if (!ticket || ticket.frontMatter.ticketType !== "epic") return;
    setSubticketBusy(true);
    try {
      await unlinkSubticketMutation.mutateAsync({ projectPath, epicId: ticket.frontMatter.id, ticketId: childId });
      setToast({ kind: "success", message: "Child ticket unlinked." });
      await Promise.resolve(onChanged());
      await refreshDetail();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to unlink child ticket." });
    } finally {
      setSubticketBusy(false);
    }
  };

  if (detailError) {
    return (
      <DialogBackdrop className="ticket-detail-backdrop">
      <Dialog as="aside" className="detail-panel detail-panel-state" aria-labelledby="ticket-detail-error-title">
        <header className="detail-header">
          <div>
            <span className="run-pill failed">Missing</span>
            <h2 id="ticket-detail-error-title">Ticket unavailable</h2>
          </div>
          <Button className="icon-button" onClick={onClose} aria-label="Close ticket detail">
            <X size={18} />
          </Button>
        </header>
        <div className="health error" role="alert">
          <AlertTriangle size={17} />
          <span>{detailError}</span>
        </div>
        <div className="detail-actions">
          <Button onClick={() => void refreshDetail()}>
            <RefreshCw size={16} />
            Retry
          </Button>
          <Button onClick={onClose}>
            <X size={16} />
            Close
          </Button>
        </div>
      </Dialog>
      </DialogBackdrop>
    );
  }

  if (!ticket) {
    return (
      <DialogBackdrop className="ticket-detail-backdrop">
      <Dialog as="aside" className="detail-panel detail-panel-state loading" aria-label="Loading ticket detail">
        <Loader2 className="spin" />
      </Dialog>
      </DialogBackdrop>
    );
  }

  const detailDialogTitleId = `ticket-detail-title-${ticket.frontMatter.id}`;
  const detailMetadataTitleId = `ticket-detail-metadata-title-${ticket.frontMatter.id}`;
  const executionActionState = getTicketDetailExecutionActionState({
    ticketType: ticket.frontMatter.ticketType,
    status: ticket.frontMatter.status,
    runStatus: ticket.frontMatter.runStatus,
    codexThreadId: ticket.frontMatter.codexThreadId,
    canDiscardPaused,
    columns: board.columns
  });

  return (
    <>
      <DialogBackdrop className="ticket-detail-backdrop">
      <Dialog as="aside" className="detail-panel" aria-labelledby={detailDialogTitleId}>
        <header className="detail-header ticket-detail-modal-header">
          <div className="ticket-detail-modal-title">
            <TicketDetailTypeIndicator
              ticketType={ticket.frontMatter.ticketType}
              draftTargetType={ticket.frontMatter.draftTargetType}
              ticketId={ticket.frontMatter.id}
              boardTickets={board.tickets}
            >
              <TicketRunStatusPill status={ticket.frontMatter.runStatus} />
              {showDetailAuthoringState && detailAuthoringState ? (
                <TicketAuthoringStatePill state={detailAuthoringState} />
              ) : null}
              {ticket.checklist.total > 0 && <TicketChecklistPill completed={ticket.checklist.completed} total={ticket.checklist.total} />}
              {blockerResolution?.isBlocked && (
                <span className="ticket-blocker-pill active" title={blockerResolution.activeBlockers.map(resolvedBlockerLabel).join("; ")}>
                  Blocked
                </span>
              )}
            </TicketDetailTypeIndicator>
            <h2
              id={detailDialogTitleId}
              className={clsx("ticket-detail-title", titleEditing && "editing")}
              tabIndex={draftInProgress || titleEditing ? undefined : 0}
              onDoubleClick={startTitleEditing}
              onKeyDown={handleTitleDisplayKeyDown}
              title={draftInProgress ? undefined : "Double-click, press Enter, or press F2 to edit title"}
            >
              {titleEditing ? (
                <Input
                  ref={titleInputRef}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => setTitleEditing(false)}
                  onKeyDown={handleTitleInputKeyDown}
                  disabled={draftInProgress}
                  aria-label="Ticket title"
                />
              ) : (
                title || ticket.frontMatter.title
              )}
            </h2>
          </div>
          <Tooltip label="Close" placement="below">
            <Button className="icon-button" onClick={onClose} aria-label="Close ticket detail">
              <X size={18} />
            </Button>
          </Tooltip>
        </header>
        <div className={clsx("ticket-detail-layout", fullTicketBodyOpen && "full-body-open")}>
          {fullTicketBodyOpen ? (
            <TicketFullBodyPanel
              mode={markdownMode}
              markdown={markdown}
              disabled={draftInProgress || attachmentDropBusy}
              attachmentDropActive={attachmentDropActive}
              editorRef={markdownEditorRef}
              onBack={() => {
                setFullTicketBodyOpen(false);
                setMarkdownMode("preview");
              }}
              onModeChange={setMarkdownMode}
              onMarkdownChange={setMarkdown}
              onDragOver={handleMarkdownDragOver}
              onDragLeave={handleMarkdownDragLeave}
              onDrop={(event) => void handleMarkdownDrop(event)}
            />
          ) : (
            <>
          <main className="ticket-detail-primary">
            <div className="detail-actions">
              {executionActionState.showExecutionControls && (
                <>
                  {executionActionState.showPause ? (
                    <Tooltip
                      label={draftInProgress ? "Stop drafting" : runQueued ? "Cancel" : "Pause"}
                    >
                      <Button
                        type="button"
                        className="icon-button pause-agent-button"
                        onClick={() => void cancelRun(false)}
                        disabled={busy || ticketUpdateActive}
                        aria-label="Pause AI agent"
                      >
                        {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                      </Button>
                    </Tooltip>
                  ) : executionActionState.showContinue ? (
                    <>
                      <Tooltip label="Continue">
                        <Button
                          type="button"
                          className="icon-button start-agent-button"
                          onClick={() => void startRun(true)}
                          disabled={busy || ticketUpdateActive}
                          aria-label="Continue AI agent"
                        >
                          {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                        </Button>
                      </Tooltip>
                      {executionActionState.showRevert && (
                        <Tooltip label="Revert">
                          <Button
                            className="danger-button"
                            onClick={() => void cancelRun(true)}
                            disabled={busy || ticketUpdateActive}
                            aria-label="Revert paused implementation"
                          >
                            <Undo2 size={16} aria-hidden="true" />
                            Revert
                          </Button>
                        </Tooltip>
                      )}
                    </>
                  ) : executionActionState.showRetry ? (
                    <Tooltip label="Retry">
                      <Button
                        type="button"
                        className="start-agent-button"
                        onClick={() => void startRun(true)}
                        disabled={busy || ticketUpdateActive}
                        aria-label="Retry AI agent"
                      >
                        {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
                        Retry
                      </Button>
                    </Tooltip>
                  ) : executionActionState.showStartOrResume ? (
                    <Tooltip label={ticket.frontMatter.codexThreadId ? "Resume" : "Start"}>
                      <Button
                        type="button"
                        className="icon-button start-agent-button"
                        onClick={() => startRun(Boolean(ticket.frontMatter.codexThreadId))}
                        disabled={busy || ticketUpdateActive}
                        aria-label={ticket.frontMatter.codexThreadId ? "Resume AI agent" : "Start AI agent"}
                      >
                        {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                      </Button>
                    </Tooltip>
                  ) : null}
                  {executionActionState.showStartNewThread && (
                    <Tooltip label="New thread">
                      <Button onClick={() => startRun(false, true)} disabled={busy || ticketUpdateActive} aria-label="Start new agent thread">
                        {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
                        Start New Agent Thread
                      </Button>
                    </Tooltip>
                  )}
                </>
              )}
              {(redraftEligible || redraftActive) && (
                <Tooltip label="Redraft">
                  <Button
                    type="button"
                    className="icon-button"
                    onClick={() => void redraftTicket()}
                    disabled={busy || ticketUpdateActive || draftInProgress || runQueued}
                    aria-label="Redraft ticket"
                  >
                    {busy || redraftActive ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
                  </Button>
                </Tooltip>
              )}
              {detailArchiveTarget && (
                <Tooltip label="Archive">
                  <Button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      if (!detailArchiveTarget.canArchive) {
                        setToast({ kind: "info", message: detailArchiveTarget.blockedMessage });
                        return;
                      }
                      void (async () => {
                        try {
                          const ticketIds = sortArchiveBundleIds(detailArchiveTarget.bundleIds, board.tickets);
                          await archiveTicketMutation.mutateAsync({ projectPath, ticketIds });
                          setToast({ kind: "success", message: detailArchiveTarget.successMessage });
                          await Promise.resolve(onChanged());
                          await refreshDetail();
                        } catch (error) {
                          setToast({
                            kind: "error",
                            message: error instanceof Error ? error.message : "Unable to archive tickets."
                          });
                        }
                      })();
                    }}
                    disabled={busy || archiveTicketMutation.isPending || ticketUpdateActive || draftInProgress}
                    aria-label="Archive"
                  >
                    {archiveTicketMutation.isPending ? (
                      <Loader2 className="spin" size={16} aria-hidden="true" />
                    ) : (
                      <Archive size={16} aria-hidden="true" />
                    )}
                  </Button>
                </Tooltip>
              )}
              {reviewActionState.showAcceptReject && (
                <div className="ticket-review-actions">
                  <Tooltip label="Accept">
                    <Button
                      type="button"
                      className="icon-button review-accept-button"
                      onClick={() => {
                        void acceptReviewTicket();
                      }}
                      disabled={busy || ticketUpdateActive || draftInProgress || !reviewActionState.acceptEnabled}
                      aria-label="Accept implementation"
                    >
                      <Check size={16} aria-hidden="true" />
                    </Button>
                  </Tooltip>
                  <Tooltip label="Reject">
                    <Button
                      type="button"
                      className="icon-button danger-button review-reject-button"
                      onClick={rejectReviewTicket}
                      disabled={busy || ticketUpdateActive || draftInProgress}
                      aria-label="Reject implementation"
                    >
                      <X size={16} aria-hidden="true" />
                    </Button>
                  </Tooltip>
                </div>
              )}
              <Tooltip label="Full ticket">
                <Button
                  type="button"
                  className="icon-button"
                  onClick={() => setFullTicketBodyOpen(true)}
                  disabled={draftInProgress}
                  aria-label="View full ticket"
                >
                  <Eye size={16} aria-hidden="true" />
                </Button>
              </Tooltip>
              {!draftInProgress && (
                <>
                  <Tooltip label="Duplicate">
                    <Button
                      type="button"
                      className="icon-button"
                      onClick={() => void duplicate()}
                      disabled={busy || ticketUpdateActive}
                      aria-label="Duplicate ticket"
                    >
                      <Copy size={16} aria-hidden="true" />
                    </Button>
                  </Tooltip>
                  <Tooltip label="Delete">
                    <Button
                      type="button"
                      className="icon-button danger-button"
                      onClick={() => void remove()}
                      disabled={busy || ticketUpdateActive}
                      aria-label="Delete ticket"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>

            {draftInProgress && (
              <div className="ticket-update-error warning" role="status">
                <Loader2 className="spin" size={16} />
                <span>The agent is drafting this ticket. The generated plan will appear here when the background draft run completes.</span>
              </div>
            )}

            {draftFailed && (
              <div className="ticket-update-error" role="alert">
                <AlertTriangle size={16} />
                <span>{draftFailureMessage}</span>
              </div>
            )}

            {draftInProgress ? (
              <DraftingTicketDetailLoading title={ticket.frontMatter.title} />
            ) : (
              <>
                <TicketDetailPrimaryClarifications
                  questions={pendingClarifications}
                  answerDrafts={answerDrafts}
                  submittingId={submittingAnswerId}
                  actionQuestionIds={scopeRecoveryActionQuestionIds}
                  actionSubmittingId={approvingScopeClarificationId}
                  onDraftChange={(questionId, answer) => setAnswerDrafts((current) => ({ ...current, [questionId]: answer }))}
                  onSubmit={(questionId) => void submitClarificationAnswer(questionId)}
                  onAction={(questionId) => void approveScopeClarification(questionId)}
                />

                {unansweredClarificationCount > 0 && (
                  <div className="ticket-update-error" role="alert">
                    <AlertTriangle size={16} />
                    <span>
                      Answer {unansweredClarificationCount} clarification question(s) before starting or resuming the agent.
                    </span>
                  </div>
                )}

                {runPreflight && (!runPreflight.ok || runPreflight.warnings.length > 0) && (
                  <div className={clsx("ticket-update-error", runPreflight.ok ? "warning" : "error")} role={runPreflight.ok ? "status" : "alert"}>
                    <AlertTriangle size={16} />
                    <span>{[...runPreflight.errors, ...runPreflight.warnings].join(" ")}</span>
                  </div>
                )}

                {blockerResolution?.isBlocked && (
                  <div className="ticket-update-error warning" role="alert">
                    <AlertTriangle size={16} />
                    <span>
                      Blocked by {blockerResolution.activeBlockers.map(resolvedBlockerLabel).join("; ")}. Move blockers to terminal columns before
                      starting the agent.
                    </span>
                  </div>
                )}

                {blockerResolution && blockerResolution.warnings.length > 0 && (
                  <div className="ticket-update-error warning" role="status">
                    <AlertTriangle size={16} />
                    <span>{blockerResolution.warnings.join(" ")}</span>
                  </div>
                )}

                <TicketSummaryPreview summary={summary} />

                <section className="ticket-update-panel">
                  <header>
                    <h3>{ticketIsCompleted ? "Follow-up Ticket" : "Refine Ticket"}</h3>
                    {!ticketIsCompleted && <span className={clsx("run-pill", ticketUpdateStatus)}>{runLabel(ticketUpdateStatus)}</span>}
                  </header>
                  <Field>
                    <span>{ticketIsCompleted ? "Follow-up Request" : "Change Request"}</span>
                    <Textarea
                      ref={ticketUpdateInputRef}
                      className="ticket-update-input"
                      value={ticketUpdateRequest}
                      placeholder={
                        ticketIsCompleted
                          ? "Describe the bug, regression, follow-up improvement, or new requirement..."
                          : "Ask the agent to add requirements, do more research, append checklist items, remove stale sections..."
                      }
                      disabled={ticketUpdateActive || draftInProgress}
                      onChange={(event) => {
                        setTicketUpdateRequest(event.target.value);
                        if (ticketUpdateError) setTicketUpdateError(null);
                      }}
                    />
                  </Field>
                  <div className="ticket-update-actions">
                    {ticketIsCompleted ? (
                      <Button
                        className="primary-button"
                        onClick={() => void createFollowUpDraft()}
                        disabled={busy || draftInProgress || ticketUpdateRequest.trim().length === 0}
                      >
                        {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                        Draft Follow-up
                      </Button>
                    ) : (
                      <Button
                        className="primary-button"
                        onClick={() => void startTicketUpdate()}
                        disabled={ticketUpdateActive || draftInProgress || ticketUpdateRequest.trim().length === 0}
                      >
                        {ticketUpdateActive ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                        Refine Ticket
                      </Button>
                    )}
                    {ticketUpdateActive && ticketUpdateRunId && (
                      <Button onClick={() => void cancelTicketUpdate()} disabled={ticketUpdateCancelling}>
                        {ticketUpdateCancelling ? <Loader2 className="spin" size={16} /> : <X size={16} />}
                        Stop
                      </Button>
                    )}
                    <Button onClick={() => setTicketUpdateLogViewerOpen(true)} disabled={!ticketUpdateRunId && ticketUpdateEvents.length === 0}>
                      <CircleDashed size={16} />
                      Logs
                    </Button>
                  </div>
                  {ticketUpdateError && (
                    <div className="ticket-update-error" role="alert">
                      <AlertTriangle size={16} />
                      <span>{ticketUpdateError}</span>
                    </div>
                  )}
                  {(ticketUpdateRunId || ticketUpdateStatus !== "idle") && (
                    <AgentProgressSummary
                      events={ticketUpdateEvents}
                      status={ticketUpdateStatus}
                      startedAt={ticketUpdateStartedAt}
                      endedAt={ticketUpdateEndedAt}
                      metricsAvailable={ticketUpdateEvents.length > 0}
                    />
                  )}
                </section>
              </>
            )}
          </main>

          <aside className="ticket-detail-sidebar" aria-label="Ticket metadata and activity">
            <section className="ticket-detail-section ticket-detail-metadata" aria-labelledby={detailMetadataTitleId}>
              <header>
                <h3 id={detailMetadataTitleId}>Ticket Details</h3>
              </header>
              <div className="ticket-detail-fields">
                {isContainerTicket ? (
                  <Field className="sidebar-metadata-field">
                    <span>Status</span>
                    <p className="ticket-detail-container-status-note">
                      {getContainerTicketStatusNote(ticket.frontMatter.ticketType, ticket.frontMatter.status)}
                    </p>
                  </Field>
                ) : (
                  <Field className="sidebar-metadata-field">
                    <span>Status</span>
                    <Select value={status} onChange={(event) => setStatus(event.target.value)} disabled={draftInProgress}>
                      {board.columns.map((column) => (
                        <option value={column.id} key={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field className="sidebar-metadata-field">
                  <span>Priority</span>
                  <Select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)} disabled={draftInProgress}>
                    {priorityOptions.map((option) => (
                      <option value={option} key={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field className="sidebar-metadata-field">
                  <span>Effort</span>
                  <Select value={effort} onChange={(event) => setEffort(event.target.value as TicketEffort)} disabled={draftInProgress}>
                    {ticketEffortOptions.map((option) => (
                      <option value={option} key={option}>
                        {ticketEffortLabel(option)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field className="sidebar-metadata-field">
                  <span>Labels</span>
                  <Input ref={labelsInputRef} value={labels} onChange={(event) => setLabels(event.target.value)} disabled={draftInProgress} />
                </Field>
                {ticket.frontMatter.ticketType === "task" && (
                  <Field className="sidebar-metadata-field ticket-planned-files-field">
                    <span>Planned files</span>
                    {ticket.frontMatter.plannedFiles.length > 0 ? (
                      <ul className="ticket-planned-files-list">
                        {ticket.frontMatter.plannedFiles.map((filePath) => (
                          <li key={filePath}>{filePath}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ticket-detail-meta-empty">None defined</p>
                    )}
                  </Field>
                )}
              </div>
            </section>

            <details className="ticket-detail-section ticket-detail-support" aria-label="Ticket support actions">
              <summary>
                <span>Support</span>
                <small>
                  {blockerResolution?.isBlocked
                    ? "Blocked"
                    : blockerCount === 0
                      ? "No blockers"
                      : `${blockerCount} blocker${blockerCount === 1 ? "" : "s"}`}
                </small>
              </summary>
              <div className="ticket-detail-actions-row" role="group" aria-label="Ticket detail actions">
                <Button
                  className={clsx("compact-action-button", blockerPanelOpen && "active")}
                  onClick={() => setBlockerPanelOpen((open) => !open)}
                  disabled={draftInProgress}
                  aria-expanded={blockerPanelOpen}
                  aria-controls="ticket-blocker-manager"
                  aria-label={blockerCount === 0 ? "Add blocker" : `Manage ${blockerCount} blocker${blockerCount === 1 ? "" : "s"}`}
                  title={blockerCount === 0 ? "Add blocker" : "Manage blockers"}
                >
                  <Plus size={14} />
                  <span>Blocker</span>
                  {blockerCount > 0 && <span className="compact-action-count">{blockerCount}</span>}
                </Button>
                {(ticket.frontMatter.ticketType === "epic" || ticket.frontMatter.ticketType === "feature") && (
                  <Button
                    className={clsx("compact-action-button", addTicketsOpen && "active")}
                    onClick={toggleSubticketPanel}
                    disabled={subticketBusy || draftInProgress}
                    aria-expanded={addTicketsOpen}
                    aria-controls="ticket-subtask-manager"
                    aria-label={
                      ticket.frontMatter.ticketType === "feature"
                        ? linkedTasks.length === 0
                          ? "Add task"
                          : `Manage ${linkedTasks.length} task${linkedTasks.length === 1 ? "" : "s"}`
                        : linkedSubtickets.length === 0
                          ? "Add feature"
                          : `Manage ${linkedSubtickets.length} feature${linkedSubtickets.length === 1 ? "" : "s"}`
                    }
                    title={ticket.frontMatter.ticketType === "feature" ? "Add or link tasks" : "Add or link features"}
                  >
                    {subticketBusy ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
                    <span>{ticket.frontMatter.ticketType === "feature" ? "Task" : "Feature"}</span>
                    {(ticket.frontMatter.ticketType === "feature" ? linkedTasks : linkedSubtickets).length > 0 && (
                      <span className="compact-action-count">
                        {ticket.frontMatter.ticketType === "feature" ? linkedTasks.length : linkedSubtickets.length}
                      </span>
                    )}
                  </Button>
                )}
                <Button
                  className="compact-action-button"
                  onClick={focusLabelsInput}
                  disabled={draftInProgress}
                  aria-label={labelCount === 0 ? "Add tags" : `Edit ${labelCount} tag${labelCount === 1 ? "" : "s"}`}
                  title="Edit tags"
                >
                  <Plus size={14} />
                  <span>Tags</span>
                  {labelCount > 0 && <span className="compact-action-count">{labelCount}</span>}
                </Button>
              </div>
              <div className="ticket-detail-blocker-summary" aria-label="Blocker state">
                <span
                  className={clsx(
                    "ticket-blocker-pill",
                    blockerResolution?.isBlocked && "active",
                    blockerResolution && blockerResolution.warnings.length > 0 && "warning"
                  )}
                >
                  {blockerResolution?.isBlocked ? "Blocked" : blockerCount === 0 ? "No blockers" : `${blockerCount} blocker${blockerCount === 1 ? "" : "s"}`}
                </span>
                <p>
                  {blockerResolution?.isBlocked
                    ? blockerResolution.activeBlockers.map(resolvedBlockerLabel).join("; ")
                    : blockerResolution && blockerResolution.warnings.length > 0
                      ? blockerResolution.warnings.join(" ")
                      : blockerCount === 0
                        ? "This ticket can run when other preflight checks pass."
                        : "Selected blockers are not currently active."}
                </p>
              </div>
            </details>

            {blockerPanelOpen && (
              <section className="epic-link-panel blocker-panel" id="ticket-blocker-manager">
                <header>
                  <div className="blocker-panel-title">
                    <h3>Blockers</h3>
                    {blockerResolution?.isBlocked && <span className="ticket-blocker-pill active">Blocked</span>}
                  </div>
                  <Button className="icon-button" onClick={() => setBlockerPanelOpen(false)} aria-label="Close blocker manager">
                    <X size={15} />
                  </Button>
                </header>
                <div className="blocker-summary-list">
                  {blockedByIds.length === 0 ? (
                    <p>No blockers selected.</p>
                  ) : (
                    <>
                      {blockerResolution?.resolvedBlockers.map((blocker) => (
                        <div className={clsx("blocker-row", blocker.active && "active")} key={blocker.id}>
                          <Button className="blocker-main" onClick={() => onOpenTicket(blocker.id)}>
                            <strong>{blocker.title}</strong>
                            <span>{blocker.contextLabel}</span>
                            <em>{blocker.columnName}</em>
                          </Button>
                          <Button className="icon-button" onClick={() => removeBlocker(blocker.id)} aria-label={`Remove ${blocker.title} blocker`}>
                            <X size={15} />
                          </Button>
                        </div>
                      ))}
                      {blockerResolution?.missingBlockerIds.map((blockerId) => (
                        <div className="blocker-row warning" key={blockerId}>
                          <div className="blocker-main static">
                            <strong>{blockerId}</strong>
                            <span>Missing blocker reference</span>
                            <em>Warning</em>
                          </div>
                          <Button className="icon-button" onClick={() => removeBlocker(blockerId)} aria-label={`Remove missing blocker ${blockerId}`}>
                            <X size={15} />
                          </Button>
                        </div>
                      ))}
                      {blockerResolution?.selfBlockerIds.map((blockerId) => (
                        <div className="blocker-row warning" key={blockerId}>
                          <div className="blocker-main static">
                            <strong>{blockerId}</strong>
                            <span>Self blocker reference</span>
                            <em>Invalid</em>
                          </div>
                          <Button className="icon-button" onClick={() => removeBlocker(blockerId)} aria-label="Remove self blocker">
                            <X size={15} />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div className="blocker-picker" role="group" aria-label="Ticket blockers">
                  {blockerCandidates.length === 0 ? (
                    <p>No other tickets available.</p>
                  ) : (
                    blockerCandidates.map((candidate) => (
                      <label className={clsx("blocker-option", blockedByIds.includes(candidate.id) && "selected")} key={candidate.id}>
                        <Input type="checkbox" checked={blockedByIds.includes(candidate.id)} onChange={() => toggleBlocker(candidate.id)} />
                        <span>
                          <strong>{candidate.title}</strong>
                          <small>{ticketContextLabel(candidate, board.tickets)}</small>
                        </span>
                        <em>{statusName(board.columns, candidate.status)}</em>
                      </label>
                    ))
                  )}
                </div>
              </section>
            )}

            {standaloneTaskNote && (
              <section className="epic-link-panel">
                <p>{standaloneTaskNote}</p>
              </section>
            )}

            {parentFeature && (
              <section className="epic-link-panel">
                <header>
                  <h3>Parent Feature</h3>
                </header>
                <Button className="subticket-row parent" onClick={() => onOpenTicket(parentFeature.id)}>
                  <strong>{parentFeature.title}</strong>
                  <span>{statusName(board.columns, parentFeature.status)}</span>
                  <em className={clsx("priority", parentFeature.priority)}>{parentFeature.priority}</em>
                </Button>
              </section>
            )}

            {parentEpic && (
              <section className="epic-link-panel">
                <header>
                  <h3>Parent Epic</h3>
                </header>
                <Button className="subticket-row parent" onClick={() => onOpenTicket(parentEpic.id)}>
                  <strong>{parentEpic.title}</strong>
                  <span>{statusName(board.columns, parentEpic.status)}</span>
                  {parentEpicBlockers?.isBlocked && <span className="ticket-blocker-pill active">Blocked</span>}
                  {parentEpicBlockers && parentEpicBlockers.warnings.length > 0 && <span className="ticket-blocker-pill warning">Blocker Warning</span>}
                  <em className={clsx("priority", parentEpic.priority)}>{parentEpic.priority}</em>
                </Button>
              </section>
            )}

            {relatedTickets.length > 0 && (
              <section className="epic-link-panel">
                <header>
                  <h3>Related Tickets</h3>
                </header>
                <div className="subticket-list">
                  {relatedTickets.map(({ id, ticket: related }) =>
                    related ? (
                      <Button className="subticket-row related-ticket-row" onClick={() => onOpenTicket(related.id)} key={id}>
                        <strong>{related.title}</strong>
                        <span>{statusName(board.columns, related.status)}</span>
                        {related.checklist.total > 0 && <TicketChecklistPill completed={related.checklist.completed} total={related.checklist.total} />}
                        <em className={clsx("priority", related.priority)}>{related.priority}</em>
                      </Button>
                    ) : (
                      <div className="subticket-row related-ticket-row missing" key={id}>
                        <strong>{id}</strong>
                        <span>Missing related ticket</span>
                        <em className="ticket-blocker-pill warning">Missing</em>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            {(ticket.frontMatter.ticketType === "epic" || ticket.frontMatter.ticketType === "feature") && (
              <section className="epic-link-panel" id="ticket-subtask-manager" ref={subticketsPanelRef}>
                <header>
                  <h3>{ticket.frontMatter.ticketType === "feature" ? "Tasks" : "Features"}</h3>
                  <Button onClick={toggleSubticketPanel} disabled={subticketBusy}>
                    {subticketBusy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                    {ticket.frontMatter.ticketType === "feature" ? "Add Task" : "Add Feature"}
                  </Button>
                </header>
                <div className="subticket-list">
                  {(ticket.frontMatter.ticketType === "feature" ? linkedTasks : linkedSubtickets).length === 0 ? (
                    <p>{ticket.frontMatter.ticketType === "feature" ? "No tasks linked." : "No features linked."}</p>
                  ) : (
                    (ticket.frontMatter.ticketType === "feature" ? linkedTasks : linkedSubtickets).map((child) => {
                      const childBlockers = resolveTicketBlockers(child, board.tickets, board.columns);
                      return (
                        <div className="subticket-item" key={child.id}>
                          <Button className="subticket-row" onClick={() => onOpenTicket(child.id)}>
                            <strong>{child.title}</strong>
                            <span>
                              {statusName(board.columns, child.status)}
                              {child.ticketType === "task" && !child.parentFeatureId ? " · legacy" : ""}
                            </span>
                            {childBlockers.isBlocked && <span className="ticket-blocker-pill active">Blocked</span>}
                            {childBlockers.warnings.length > 0 && <span className="ticket-blocker-pill warning">Blocker Warning</span>}
                            <em className={clsx("priority", child.priority)}>{child.priority}</em>
                          </Button>
                          {ticket.frontMatter.ticketType === "epic" && (
                            <Button
                              className="icon-button"
                              onClick={() => void unlinkChildTicket(child.id)}
                              disabled={subticketBusy}
                              aria-label={`Unlink ${child.title}`}
                            >
                              <X size={15} />
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {addTicketsOpen && (
                  <div className="add-subticket-panel">
                    <Field>
                      <span>{ticket.frontMatter.ticketType === "feature" ? "New Task" : "New Feature"}</span>
                      <Input
                        value={newSubticketTitle}
                        onChange={(event) => setNewSubticketTitle(event.target.value)}
                        placeholder={ticket.frontMatter.ticketType === "feature" ? "Task title" : "Feature title"}
                      />
                    </Field>
                    {ticket.frontMatter.ticketType === "feature" && (
                      <Field>
                        <span>Description</span>
                        <Textarea
                          value={newTaskDescription}
                          onChange={(event) => setNewTaskDescription(event.target.value)}
                          rows={3}
                          placeholder="Optional short description"
                        />
                      </Field>
                    )}
                    <div className="two-fields">
                      <Field>
                        <span>Priority</span>
                        <Select value={newSubticketPriority} onChange={(event) => setNewSubticketPriority(event.target.value as TicketPriority)}>
                          {priorityOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </Select>
                      </Field>
                      {ticket.frontMatter.ticketType === "epic" && (
                        <Field>
                          <span>Labels</span>
                          <Input value={newSubticketLabels} onChange={(event) => setNewSubticketLabels(event.target.value)} />
                        </Field>
                      )}
                    </div>
                    <Button className="primary-button" onClick={() => void createChildTicket()} disabled={subticketBusy || newSubticketTitle.trim().length === 0}>
                      {subticketBusy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                      {ticket.frontMatter.ticketType === "feature" ? "Add Task" : "Add Feature"}
                    </Button>
                    <div className="link-existing-row">
                      <Field>
                        <span>Link Existing</span>
                        <Select
                          value={linkSubticketId}
                          onChange={(event) => setLinkSubticketId(event.target.value)}
                          disabled={(ticket.frontMatter.ticketType === "feature" ? linkableFeatureTasks : linkableEpicChildren).length === 0}
                        >
                          <option value="">
                            {(ticket.frontMatter.ticketType === "feature" ? linkableFeatureTasks : linkableEpicChildren).length === 0
                              ? ticket.frontMatter.ticketType === "feature"
                                ? "No available task tickets"
                                : "No available feature tickets"
                              : "Select a ticket"}
                          </option>
                          {(ticket.frontMatter.ticketType === "feature" ? linkableFeatureTasks : linkableEpicChildren).map((candidate) => (
                            <option value={candidate.id} key={candidate.id}>
                              {ticketBlockerOptionLabel(candidate, board.tickets, board.columns)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button onClick={() => void linkExistingTicket()} disabled={subticketBusy || !linkSubticketId}>
                        <Plus size={16} />
                        Link
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}

            <ClarificationPanel
              className="ticket-detail-sidebar-clarifications"
              variant="sidebar"
              ariaLabel="Clarification history"
              questions={sidebarClarifications}
              answerDrafts={answerDrafts}
              submittingId={submittingAnswerId}
              actionQuestionIds={scopeRecoveryActionQuestionIds}
              actionSubmittingId={approvingScopeClarificationId}
              onDraftChange={(questionId, answer) => setAnswerDrafts((current) => ({ ...current, [questionId]: answer }))}
              onSubmit={(questionId) => void submitClarificationAnswer(questionId)}
              onAction={(questionId) => void approveScopeClarification(questionId)}
            />

            <AgentActivityPanel
              events={currentRunEvents}
              status={ticket.frontMatter.runStatus}
              runId={runId}
              runSummary={runSummary}
              logLoading={logLoading}
              logError={logError}
              onOpenLogs={() => setLogViewerOpen(true)}
              onRevealFile={() => void revealTicketFileMutation.mutate({ projectPath, ticketId })}
            />

          </aside>
            </>
          )}
        </div>
      </Dialog>
      </DialogBackdrop>
      {logViewerOpen && (
        <AgentLogViewer
          title={`${ticket.frontMatter.title} Logs`}
          events={currentRunEvents}
          loading={logLoading}
          error={logError}
          onClose={() => setLogViewerOpen(false)}
          onCopied={(kind) => setToast(copyToast(kind))}
          onCopyError={(error) => setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to copy." })}
        />
      )}
      {ticketUpdateLogViewerOpen && (
        <AgentLogViewer
          title={`${ticket.frontMatter.title} Ticket Update Logs`}
          events={ticketUpdateEvents}
          loading={false}
          error={null}
          onClose={() => setTicketUpdateLogViewerOpen(false)}
          onCopied={(kind) => setToast(copyToast(kind))}
          onCopyError={(error) => setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to copy." })}
        />
      )}
    </>
  );
}

export function App(): ReactElement {
  return (
    <KeyboardShortcutProvider>
      <RelayApp />
    </KeyboardShortcutProvider>
  );
}

function RelayApp(): ReactElement {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [repositoryChatOpen, setRepositoryChatOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [providerSelectorOpen, setProviderSelectorOpen] = useState(false);
  const [events, setEvents] = useState<RendererRunEvent[]>([]);
  const repositoryChatComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const sidebarShortcutLabel = useMemo(() => sidebarToggleShortcutLabel(), []);
  const queryClient = useQueryClient();
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];
  const boardQuery = useBoardQuery(selectedPath);
  const board = boardQuery.data ?? null;
  const providerInventoryQuery = useProviderInventoryQuery();
  const providerInventory = providerInventoryQuery.data;
  const providerInventoryLoading = !providerInventory && (providerInventoryQuery.isPending || providerInventoryQuery.isFetching);
  const providerInventoryError = providerInventoryQuery.isError && !providerInventory;
  const providerInventoryRefreshing = providerInventoryQuery.isFetching && Boolean(providerInventory);
  const switchAgentProviderMutation = useSwitchAgentProviderMutation();
  const gitMetadataQuery = useProjectGitMetadataQuery(board?.project.path ?? selectedPath, { force: true });
  const selectedGitMetadata = gitMetadataQuery.data ?? (gitMetadataQuery.error ? gitMetadataError(relayErrorMessage(gitMetadataQuery.error, "Unable to load Git metadata.")) : undefined);
  const addProjectMutation = useAddProjectMutation();
  const removeProjectMutation = useRemoveProjectMutation();
  const revealProjectMutation = useRevealProjectMutation();
  const openProjectInEditorMutation = useOpenProjectInEditorMutation();
  const loading = projectsQuery.isLoading || addProjectMutation.isPending;

  useEffect(() => {
    const timeoutId = scheduleToastDismissal(toast, () => setToast(null));
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [toast]);

  const selectProject = useCallback(
    (projectPath: string | null) => {
      if (projectPath === selectedPath) return;
      setOpenTicketId(null);
      setRepositoryChatOpen(false);
      setQuery("");
      setSelectedPath(projectPath);
    },
    [selectedPath]
  );

  const toggleSidebar = useCallback((): void => {
    setSidebarCollapsed((collapsed) => !collapsed);
  }, []);

  const openProviderSelector = useCallback((): void => {
    setProviderSelectorOpen(true);
  }, []);

  const closeProviderSelector = useCallback((): void => {
    setProviderSelectorOpen(false);
  }, []);

  useEffect(() => {
    setSelectedPath((current) => current ?? projects[0]?.path ?? null);
  }, [projects]);

  useEffect(() => {
    const refreshSelectedGitMetadata = (): void => {
      if (selectedPath) void gitMetadataQuery.refetch();
    };
    window.addEventListener("focus", refreshSelectedGitMetadata);
    return () => window.removeEventListener("focus", refreshSelectedGitMetadata);
  }, [gitMetadataQuery, selectedPath]);

  useEffect(() => {
    setOpenTicketId(null);
    setRepositoryChatOpen(false);
  }, [selectedPath]);

  useEffect(() => {
    if (!openTicketId || !board) return;
    if (!board.tickets.some((ticket) => ticket.id === openTicketId)) {
      setOpenTicketId(null);
    }
  }, [board, openTicketId]);

  useEffect(() => {
    return useRunEventSubscription((event) => {
      setEvents((current) => [...current.slice(-400), event]);
      if (event.type === "run.completed" && event.resolvedTicketId) {
        setOpenTicketId((current) => (current === event.ticketId ? event.resolvedTicketId! : current));
        void handleDraftPlaceholderResolved(
          queryClient,
          event.projectPath,
          event.ticketId,
          event.resolvedTicketId
        );
        return;
      }
      if (
        event.type === "run.started" ||
        event.type === "run.completed" ||
        event.type === "run.failed" ||
        event.type === "clarification.requested" ||
        event.type === "ticket.status_changed"
      ) {
        debouncedInvalidateRelayTicketData(queryClient, event.projectPath, event.ticketId);
      }
    });
  }, [queryClient]);

  const addProject = async (): Promise<void> => {
    try {
      const result = await addProjectMutation.mutateAsync();
      if (result) {
        selectProject(result.project.path);
        setToast({ kind: "success", message: result.initialized ? "Project initialized." : "Project added." });
      }
    } catch (error) {
      setToast({ kind: "error", message: relayErrorMessage(error, "Unable to add project.") });
    }
  };

  const refreshAll = useCallback(async (): Promise<void> => {
    await invalidateRelayProjectData(queryClient, selectedPath);
  }, [queryClient, selectedPath]);

  const selectedEvents = useMemo(
    () => events.filter((event) => event.projectPath === selectedPath && event.ticketId === openTicketId),
    [events, openTicketId, selectedPath]
  );
  const repositoryChatShellState = useMemo(
    () => getRepositoryChatShellState({ board, selectedPath, repositoryChatOpen }),
    [board, repositoryChatOpen, selectedPath]
  );
  const createShortcutEnabled = Boolean(board && selectedPath && !openTicketId);
  const openRepositoryChat = useCallback((): void => {
    if (!board || !selectedPath) return;
    setRepositoryChatOpen(true);
  }, [board, selectedPath]);
  const closeRepositoryChat = useCallback((): void => {
    setRepositoryChatOpen(false);
  }, []);
  const toggleRepositoryChat = useCallback((): void => {
    if (repositoryChatShellState.repositoryChatActive) {
      closeRepositoryChat();
      return;
    }
    openRepositoryChat();
  }, [closeRepositoryChat, openRepositoryChat, repositoryChatShellState.repositoryChatActive]);

  useKeyboardShortcut({
    id: "toggle-sidebar",
    matcher: isSidebarToggleShortcut,
    handler: () => {
      toggleSidebar();
      return true;
    }
  });

  useKeyboardShortcut({
    id: "create-ticket",
    enabled: createShortcutEnabled,
    priority: 10,
    allowInTextEntry: true,
    matcher: isCreateTicketShortcut,
    handler: () => {
      openRepositoryChat();
      window.setTimeout(() => repositoryChatComposerRef.current?.focus(), 0);
      return true;
    }
  });

  return (
    <div
      className={clsx(
        "app-shell",
        sidebarCollapsed && "sidebar-collapsed",
        openTicketId && "detail-open",
        providerSelectorOpen && "modal-open",
        repositoryChatShellState.repositoryChatActive && "chat-open"
      )}
    >
      <ProjectSidebar
        projects={projects}
        selectedPath={selectedPath}
        loading={loading}
        onAdd={addProject}
        onSelect={selectProject}
        onRemove={async (projectPath) => {
          const nextProjects = await removeProjectMutation.mutateAsync(projectPath);
          if (selectedPath === projectPath) selectProject(nextProjects[0]?.path ?? null);
        }}
        onReveal={(projectPath) => void revealProjectMutation.mutate(projectPath)}
        onToggleVisibility={toggleSidebar}
        toggleShortcutLabel={sidebarShortcutLabel}
        providerInventory={providerInventory}
        providerInventoryLoading={providerInventoryLoading}
        providerInventoryError={providerInventoryError}
        providerInventoryRefreshing={providerInventoryRefreshing}
        onOpenProviderSelector={openProviderSelector}
      />

      {sidebarCollapsed && (
        <>
          <Button
            className="sidebar-floating-button sidebar-restore-button"
            onClick={toggleSidebar}
            aria-label={`Show sidebar (${sidebarShortcutLabel})`}
            title={`Show sidebar (${sidebarShortcutLabel})`}
            aria-controls="project-sidebar"
            aria-expanded={false}
            aria-keyshortcuts="Meta+B Control+B"
          >
            <PanelLeftOpen size={17} />
          </Button>
          <CodexCollapsedStatusIndicator
            providerInventory={providerInventory}
            isLoading={providerInventoryLoading}
            isError={providerInventoryError}
            isRefreshing={providerInventoryRefreshing}
            onOpenSelector={openProviderSelector}
          />
        </>
      )}

      {board && selectedPath ? (
        <BoardView
          board={board}
          projectPath={selectedPath}
          onCreated={refreshAll}
          query={query}
          ticketNavigationEnabled={!openTicketId}
          onQuery={setQuery}
          onToggleRepositoryChat={toggleRepositoryChat}
          onOpenTicket={setOpenTicketId}
          gitMetadata={selectedGitMetadata}
          repositoryChatOpen={repositoryChatShellState.repositoryChatActive}
          onOpenProjectInEditor={(input) => openProjectInEditorMutation.mutateAsync(input)}
          setToast={setToast}
        />
      ) : (
        <main className="workspace empty-state">
          <h1>No project selected</h1>
          <p>Add a local folder to create a Relay board.</p>
          <Button className="primary-button" onClick={addProject}>
            <FolderPlus size={16} />
            Add Project
          </Button>
        </main>
      )}

      {repositoryChatShellState.repositoryChatPanelVisible && board && selectedPath && (
        <RepositoryChatPanel
          key={selectedPath}
          projectPath={selectedPath}
          projectName={board.project.name}
          defaultEffort={board.config?.settings.defaultTicketEffort ?? "medium"}
          selectedProviderId={providerInventory?.selectedProviderId ?? "codex"}
          composerRef={repositoryChatComposerRef}
          onClose={closeRepositoryChat}
          onCreated={refreshAll}
          setToast={setToast}
        />
      )}

      {providerSelectorOpen && (
        <CliProviderSelectorModal
          inventory={providerInventory}
          isLoading={providerInventoryLoading}
          isError={providerInventoryError}
          isSwitching={switchAgentProviderMutation.isPending}
          onClose={closeProviderSelector}
          onSelectProvider={(providerId) => {
            if (!providerInventory) return;
            if (providerId === providerInventory.selectedProviderId || switchAgentProviderMutation.isPending) return;
            void switchAgentProviderMutation
              .mutateAsync(providerId)
              .then((result) => {
                if (result.ok) {
                  const providerLabel = result.inventory.providers.find((provider) => provider.id === result.selectedProviderId)?.label ?? "selected";
                  setToast({ kind: "success", message: `Relay is now using ${providerLabel}.` });
                  closeProviderSelector();
                  return;
                }
                setToast({ kind: "error", message: result.message });
              })
              .catch((error) => {
                setToast({ kind: "error", message: relayErrorMessage(error, "Unable to switch CLI provider.") });
              });
          }}
        />
      )}

      {board && selectedPath && openTicketId && (
        <TicketDetail
          projectPath={selectedPath}
          ticketId={openTicketId}
          board={board}
          events={selectedEvents}
          gitMetadata={selectedGitMetadata}
          onClose={() => setOpenTicketId(null)}
          onOpenTicket={setOpenTicketId}
          onChanged={refreshAll}
          setToast={setToast}
        />
      )}

      {toast && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
