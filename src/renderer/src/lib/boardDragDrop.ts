import {
  RELAY_ARCHIVE_STATUS,
  RELAY_COMPLETED_STATUS,
  RELAY_NOT_DOING_STATUS,
  RELAY_READY_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_TODO_STATUS
} from "@shared/schemas";
import type { BoardSnapshot, CancelRunInput, CodexCancelRunResult, RelayColumn, TicketMoveInput, TicketSummary } from "@shared/schemas";
import { acceptBundleForEpic, acceptBundleForFeature } from "./boardAccept";
import { isTaskReadyPlaceable } from "./boardColumnLayout";

export type BoardDragKind = "task" | "feature" | "epic";

export type BoardDragItem = {
  kind: BoardDragKind;
  ticketId?: string;
  featureId?: string;
  epicId?: string;
};

export type BoardDropTarget =
  | typeof RELAY_READY_STATUS
  | typeof RELAY_NOT_DOING_STATUS
  | typeof RELAY_TODO_STATUS
  | typeof RELAY_COMPLETED_STATUS;

export type BoardDragSourceColumn = typeof RELAY_TODO_STATUS | typeof RELAY_NOT_DOING_STATUS | typeof RELAY_REVIEW_STATUS;

const ACTIVE_AGENT_RUN_STATUSES = new Set<TicketSummary["runStatus"]>(["running", "queued", "paused", "drafting"]);

export const boardDragId = {
  task: (ticketId: string): string => `task:${ticketId}`,
  feature: (featureId: string): string => `feature:${featureId}`,
  epic: (epicId: string): string => `epic:${epicId}`,
  column: (status: BoardDropTarget): string => `column:${status}`
};

export const boardDragItemToId = (item: BoardDragItem): string => {
  if (item.kind === "task" && item.ticketId) return boardDragId.task(item.ticketId);
  if (item.kind === "feature" && item.featureId) return boardDragId.feature(item.featureId);
  if (item.kind === "epic" && item.epicId) return boardDragId.epic(item.epicId);
  return "";
};

export const parseBoardDragId = (id: string): BoardDragItem | null => {
  if (id.startsWith("task:")) {
    const ticketId = id.slice("task:".length);
    return ticketId ? { kind: "task", ticketId } : null;
  }
  if (id.startsWith("feature:")) {
    const featureId = id.slice("feature:".length);
    return featureId ? { kind: "feature", featureId } : null;
  }
  if (id.startsWith("epic:")) {
    const epicId = id.slice("epic:".length);
    return epicId ? { kind: "epic", epicId } : null;
  }
  return null;
};

export const parseBoardDropColumnId = (id: string): BoardDropTarget | null => {
  if (id === boardDragId.column(RELAY_READY_STATUS)) return RELAY_READY_STATUS;
  if (id === boardDragId.column(RELAY_NOT_DOING_STATUS)) return RELAY_NOT_DOING_STATUS;
  if (id === boardDragId.column(RELAY_TODO_STATUS)) return RELAY_TODO_STATUS;
  if (id === boardDragId.column(RELAY_COMPLETED_STATUS)) return RELAY_COMPLETED_STATUS;
  return null;
};

export const isBoardDropColumn = (columnId: string): columnId is BoardDropTarget =>
  columnId === RELAY_READY_STATUS ||
  columnId === RELAY_NOT_DOING_STATUS ||
  columnId === RELAY_TODO_STATUS ||
  columnId === RELAY_COMPLETED_STATUS;

export const boardDragSourceColumnFromColumn = (columnId: string | null): BoardDragSourceColumn | null => {
  if (columnId === RELAY_NOT_DOING_STATUS) return RELAY_NOT_DOING_STATUS;
  if (columnId === RELAY_TODO_STATUS) return RELAY_TODO_STATUS;
  if (columnId === RELAY_REVIEW_STATUS) return RELAY_REVIEW_STATUS;
  return null;
};

/** Tasks queue to Ready only; features and epics may drop descendant work onto Not Doing. */
export const boardDragAllowsNotDoingDrop = (item: BoardDragItem | null): boolean =>
  item !== null && (item.kind === "feature" || item.kind === "epic");

export const boardDragMoveAriaLabel = (title: string, item: BoardDragItem, sourceColumn: BoardDragSourceColumn | null): string => {
  if (sourceColumn === RELAY_NOT_DOING_STATUS) {
    return `Move ${title} to Todo`;
  }
  if (sourceColumn === RELAY_REVIEW_STATUS) {
    return `Move ${title} to Completed`;
  }
  if (boardDragAllowsNotDoingDrop(item)) {
    return `Move ${title} to Ready or Not Doing`;
  }
  return `Move ${title} to Ready`;
};

export const columnAcceptsBoardDrop = (
  columnId: string,
  item: BoardDragItem | null,
  sourceColumn: BoardDragSourceColumn | null
): columnId is BoardDropTarget => {
  if (!item || !sourceColumn) return false;
  if (sourceColumn === RELAY_NOT_DOING_STATUS) {
    return columnId === RELAY_TODO_STATUS;
  }
  if (sourceColumn === RELAY_REVIEW_STATUS) {
    return columnId === RELAY_COMPLETED_STATUS;
  }
  if (columnId === RELAY_READY_STATUS) return true;
  if (columnId === RELAY_NOT_DOING_STATUS) return boardDragAllowsNotDoingDrop(item);
  return false;
};

export const collectTasksUnderFeature = (featureId: string, allTickets: TicketSummary[]): TicketSummary[] =>
  allTickets.filter((ticket) => ticket.ticketType === "task" && ticket.parentFeatureId === featureId);

export const collectTasksUnderEpic = (epicId: string, allTickets: TicketSummary[]): TicketSummary[] => {
  const featureIds = new Set(
    allTickets.filter((ticket) => ticket.ticketType === "feature" && ticket.parentEpicId === epicId).map((ticket) => ticket.id)
  );
  return allTickets.filter(
    (ticket) =>
      ticket.ticketType === "task" &&
      (ticket.parentEpicId === epicId ||
        (ticket.parentFeatureId !== null && featureIds.has(ticket.parentFeatureId)))
  );
};

export const resolveDragTasks = (item: BoardDragItem, allTickets: TicketSummary[]): TicketSummary[] => {
  if (item.kind === "task" && item.ticketId) {
    const ticket = allTickets.find((entry) => entry.id === item.ticketId);
    return ticket?.ticketType === "task" ? [ticket] : [];
  }
  if (item.kind === "feature" && item.featureId) {
    return collectTasksUnderFeature(item.featureId, allTickets);
  }
  if (item.kind === "epic" && item.epicId) {
    return collectTasksUnderEpic(item.epicId, allTickets);
  }
  return [];
};

export const tasksEligibleForReadyQueue = (
  tasks: TicketSummary[],
  columns: RelayColumn[],
  allTickets: TicketSummary[]
): TicketSummary[] => tasks.filter((task) => isTaskReadyPlaceable(task, columns, allTickets));

export const taskHasActiveAgentWork = (ticket: TicketSummary): boolean =>
  Boolean(ticket.lastRunId) && ACTIVE_AGENT_RUN_STATUSES.has(ticket.runStatus);

export const tasksForNotDoingDrop = (tasks: TicketSummary[]): TicketSummary[] =>
  tasks.filter(
    (ticket) =>
      ticket.status !== RELAY_NOT_DOING_STATUS &&
      ticket.status !== RELAY_COMPLETED_STATUS &&
      ticket.status !== RELAY_ARCHIVE_STATUS
  );

export const tasksForTodoRestore = (tasks: TicketSummary[]): TicketSummary[] =>
  tasks.filter((ticket) => ticket.status === RELAY_NOT_DOING_STATUS);

export const resolveTaskEpicId = (task: TicketSummary, allTickets: TicketSummary[]): string | null => {
  if (task.parentEpicId) return task.parentEpicId;
  if (!task.parentFeatureId) return null;
  const feature = allTickets.find((entry) => entry.id === task.parentFeatureId);
  return feature?.ticketType === "feature" ? feature.parentEpicId : null;
};

export const epicScopeFullyNotDoing = (epicId: string, allTickets: TicketSummary[]): boolean => {
  const tasks = collectTasksUnderEpic(epicId, allTickets);
  return tasks.length > 0 && tasks.every((task) => task.status === RELAY_NOT_DOING_STATUS);
};

export const featureScopeFullyNotDoing = (featureId: string, allTickets: TicketSummary[]): boolean => {
  const tasks = collectTasksUnderFeature(featureId, allTickets);
  return tasks.length > 0 && tasks.every((task) => task.status === RELAY_NOT_DOING_STATUS);
};

export type RestoreDragToTodoValidation =
  | { ok: true }
  | { ok: false; message: string };

export const validateReviewDragToCompleted = (
  item: BoardDragItem,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): RestoreDragToTodoValidation => {
  if (item.kind === "task" && item.ticketId) {
    const task = allTickets.find((entry) => entry.id === item.ticketId);
    if (!task || task.ticketType !== "task") {
      return { ok: false, message: "Task not found." };
    }
    if (task.status !== RELAY_REVIEW_STATUS) {
      return { ok: false, message: "Only tickets in Review can be accepted." };
    }
    return { ok: true };
  }

  if (item.kind === "feature" && item.featureId) {
    if (acceptBundleForFeature(item.featureId, allTickets, columns).length === 0) {
      return { ok: false, message: "Accept every linked task before accepting this feature." };
    }
    return { ok: true };
  }

  if (item.kind === "epic" && item.epicId) {
    if (acceptBundleForEpic(item.epicId, allTickets, columns).length === 0) {
      return { ok: false, message: "Accept every linked feature and task before accepting this epic." };
    }
    return { ok: true };
  }

  return { ok: false, message: "Unable to accept this item." };
};

export const validateRestoreDragToTodo = (item: BoardDragItem, allTickets: TicketSummary[]): RestoreDragToTodoValidation => {
  const tasks = tasksForTodoRestore(resolveDragTasks(item, allTickets));
  if (tasks.length === 0) {
    return { ok: false, message: "No tasks to move to Todo." };
  }

  if (item.kind === "epic" && item.epicId) {
    return { ok: true };
  }

  if (item.kind === "feature" && item.featureId) {
    const feature = allTickets.find((entry) => entry.id === item.featureId);
    if (feature?.parentEpicId && epicScopeFullyNotDoing(feature.parentEpicId, allTickets)) {
      return { ok: false, message: "This feature is under a deferred epic. Move the epic to Todo first." };
    }
    return { ok: true };
  }

  if (item.kind === "task" && item.ticketId) {
    const task = allTickets.find((entry) => entry.id === item.ticketId);
    if (!task || task.ticketType !== "task") {
      return { ok: false, message: "Task not found." };
    }
    const epicId = resolveTaskEpicId(task, allTickets);
    if (epicId && epicScopeFullyNotDoing(epicId, allTickets)) {
      return { ok: false, message: "Move the epic to Todo to restore this work." };
    }
    if (task.parentFeatureId && featureScopeFullyNotDoing(task.parentFeatureId, allTickets)) {
      return { ok: false, message: "Move the feature to Todo to restore this task." };
    }
    return { ok: true };
  }

  return { ok: false, message: "Unable to restore this item." };
};

export type RestoreTasksToTodoDeps = {
  projectPath: string;
  tasks: TicketSummary[];
  moveTicket: (input: TicketMoveInput) => Promise<BoardSnapshot>;
};

export const restoreTasksToTodo = async ({ projectPath, tasks, moveTicket }: RestoreTasksToTodoDeps): Promise<void> => {
  for (const task of tasks) {
    if (task.status !== RELAY_NOT_DOING_STATUS) continue;
    await moveTicket({
      projectPath,
      ticketId: task.id,
      targetStatus: RELAY_TODO_STATUS
    });
  }
};

export type PrepareTaskForNotDoingDeps = {
  projectPath: string;
  ticket: TicketSummary;
  cancelRun: (input: CancelRunInput) => Promise<CodexCancelRunResult>;
  moveTicket: (input: TicketMoveInput) => Promise<BoardSnapshot>;
};

export const prepareTaskForNotDoing = async ({
  projectPath,
  ticket,
  cancelRun,
  moveTicket
}: PrepareTaskForNotDoingDeps): Promise<void> => {
  if (
    ticket.status === RELAY_NOT_DOING_STATUS ||
    ticket.status === RELAY_COMPLETED_STATUS ||
    ticket.status === RELAY_ARCHIVE_STATUS
  ) {
    return;
  }

  let current = ticket;
  if (taskHasActiveAgentWork(current) && current.lastRunId) {
    await cancelRun({
      projectPath,
      ticketId: current.id,
      runId: current.lastRunId,
      revertChanges: true
    });
    current = {
      ...current,
      runStatus: "idle",
      lastRunId: null,
      lastRunStartedAt: null,
      codexThreadId: null
    };
  }

  if (current.status !== RELAY_NOT_DOING_STATUS) {
    await moveTicket({
      projectPath,
      ticketId: current.id,
      targetStatus: RELAY_NOT_DOING_STATUS
    });
  }
};
