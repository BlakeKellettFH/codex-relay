import {
  RELAY_ARCHIVE_STATUS,
  RELAY_COMPLETED_STATUS,
  RELAY_NOT_DOING_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_TODO_STATUS,
  type BoardSnapshot,
  type RelayColumn,
  type TicketSummary
} from "@shared/schemas";

const CONTAINER_REVIEW_STATUSES = new Set<string>([RELAY_REVIEW_STATUS, RELAY_COMPLETED_STATUS]);

export const isTerminalTaskStatus = (status: string, columns: readonly RelayColumn[]): boolean => {
  if (status === RELAY_COMPLETED_STATUS || status === RELAY_NOT_DOING_STATUS || status === RELAY_ARCHIVE_STATUS) {
    return true;
  }
  return Boolean(columns.find((column) => column.id === status)?.terminal);
};

const sortLinkedChildren = (
  parent: Pick<TicketSummary, "subticketIds">,
  children: TicketSummary[]
): TicketSummary[] =>
  [...children].sort((a, b) => {
    const aIndex = parent.subticketIds.indexOf(a.id);
    const bIndex = parent.subticketIds.indexOf(b.id);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return a.position - b.position;
  });

export const linkedTasksForFeature = (feature: TicketSummary, allTickets: readonly TicketSummary[]): TicketSummary[] => {
  if (feature.ticketType !== "feature") return [];
  const byId = new Map(allTickets.map((item) => [item.id, item]));
  const ordered = feature.subticketIds
    .map((id) => byId.get(id))
    .filter((item): item is TicketSummary => Boolean(item) && item.ticketType === "task");
  const derived = allTickets.filter(
    (item) =>
      item.ticketType === "task" &&
      item.parentFeatureId === feature.id &&
      !feature.subticketIds.includes(item.id)
  );
  return sortLinkedChildren(feature, [...ordered, ...derived]);
};

export const linkedFeaturesForEpic = (epic: TicketSummary, allTickets: readonly TicketSummary[]): TicketSummary[] => {
  if (epic.ticketType !== "epic") return [];
  const byId = new Map(allTickets.map((item) => [item.id, item]));
  const ordered = epic.subticketIds
    .map((id) => byId.get(id))
    .filter((item): item is TicketSummary => Boolean(item) && item.ticketType === "feature");
  const derived = allTickets.filter(
    (item) =>
      item.ticketType === "feature" &&
      item.parentEpicId === epic.id &&
      !epic.subticketIds.includes(item.id)
  );
  return sortLinkedChildren(epic, [...ordered, ...derived]);
};

export const linkedTasksForEpic = (epic: TicketSummary, allTickets: readonly TicketSummary[]): TicketSummary[] => {
  const features = linkedFeaturesForEpic(epic, allTickets);
  const featureIds = new Set(features.map((feature) => feature.id));
  return allTickets.filter(
    (ticket) =>
      ticket.ticketType === "task" &&
      (ticket.parentEpicId === epic.id ||
        (ticket.parentFeatureId !== null && featureIds.has(ticket.parentFeatureId)))
  );
};

const isReviewOrTerminalTaskStatus = (status: string, columns: readonly RelayColumn[]): boolean =>
  status === RELAY_REVIEW_STATUS || isTerminalTaskStatus(status, columns);

const isReviewOrCompletedFeatureStatus = (status: string): boolean =>
  status === RELAY_REVIEW_STATUS || status === RELAY_COMPLETED_STATUS;

export const featureReadyForReview = (
  feature: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean => {
  const tasks = linkedTasksForFeature(feature, allTickets);
  return tasks.length > 0 && tasks.every((task) => isReviewOrTerminalTaskStatus(task.status, columns));
};

export const epicReadyForReview = (
  epic: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean => {
  const features = linkedFeaturesForEpic(epic, allTickets);
  if (features.length === 0) return false;
  if (!features.every((feature) => isReviewOrCompletedFeatureStatus(feature.status))) return false;
  const tasks = linkedTasksForEpic(epic, allTickets);
  return tasks.every((task) => isReviewOrTerminalTaskStatus(task.status, columns));
};

const ticketById = (board: BoardSnapshot, ticketId: string): TicketSummary | null =>
  board.tickets.find((ticket) => ticket.id === ticketId) ?? null;

export const containersToReconcile = (
  board: BoardSnapshot,
  changedTicketId?: string | null
): { featureIds: string[]; epicIds: string[] } => {
  const featureIds = new Set<string>();
  const epicIds = new Set<string>();

  const addFeature = (featureId: string | null | undefined): void => {
    if (!featureId) return;
    featureIds.add(featureId);
    const feature = ticketById(board, featureId);
    if (feature?.parentEpicId) epicIds.add(feature.parentEpicId);
  };

  const addEpic = (epicId: string | null | undefined): void => {
    if (epicId) epicIds.add(epicId);
  };

  if (!changedTicketId) {
    for (const ticket of board.tickets) {
      if (ticket.ticketType === "feature") featureIds.add(ticket.id);
      if (ticket.ticketType === "epic") epicIds.add(ticket.id);
    }
    return { featureIds: [...featureIds], epicIds: [...epicIds] };
  }

  const changed = ticketById(board, changedTicketId);
  if (!changed) return { featureIds: [], epicIds: [] };

  if (changed.ticketType === "task") {
    addFeature(changed.parentFeatureId);
    return { featureIds: [...featureIds], epicIds: [...epicIds] };
  }
  if (changed.ticketType === "feature") {
    addFeature(changed.id);
    addEpic(changed.parentEpicId);
    return { featureIds: [...featureIds], epicIds: [...epicIds] };
  }
  if (changed.ticketType === "epic") {
    addEpic(changed.id);
    return { featureIds: [...featureIds], epicIds: [...epicIds] };
  }

  return { featureIds: [], epicIds: [] };
};

export const resolveFeatureContainerStatus = (
  feature: TicketSummary,
  board: BoardSnapshot
): typeof RELAY_REVIEW_STATUS | typeof RELAY_TODO_STATUS | null => {
  const ready = featureReadyForReview(feature, board.tickets, board.columns);
  if (ready && !CONTAINER_REVIEW_STATUSES.has(feature.status)) return RELAY_REVIEW_STATUS;
  if (!ready && feature.status === RELAY_REVIEW_STATUS) return RELAY_TODO_STATUS;
  return null;
};

export const resolveEpicContainerStatus = (
  epic: TicketSummary,
  board: BoardSnapshot
): typeof RELAY_REVIEW_STATUS | typeof RELAY_TODO_STATUS | null => {
  const ready = epicReadyForReview(epic, board.tickets, board.columns);
  if (ready && !CONTAINER_REVIEW_STATUSES.has(epic.status)) return RELAY_REVIEW_STATUS;
  if (!ready && epic.status === RELAY_REVIEW_STATUS) return RELAY_TODO_STATUS;
  return null;
};
