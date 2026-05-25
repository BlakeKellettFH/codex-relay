import { resolveTicketBlockers } from "@shared/blockers";
import {
  boardVisibleColumns,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_NEEDS_CLARIFICATION_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_TODO_STATUS
} from "@shared/schemas";
import type { RelayColumn, TicketSummary } from "@shared/schemas";
import {
  isReviewBoardColumn,
  isReviewStatusContainer,
  reviewStatusContainers,
  tasksForReviewContainerGroup
} from "./boardReview";

export type FeatureBoardGroupItem = {
  feature: TicketSummary;
  tasks: TicketSummary[];
  featureInColumn: boolean;
};

export type ColumnBoardItem =
  | { kind: "ticket"; ticket: TicketSummary }
  | { kind: "feature-group"; feature: TicketSummary; tasks: TicketSummary[]; featureInColumn: boolean }
  | { kind: "epic-group"; epic: TicketSummary; featureGroups: FeatureBoardGroupItem[] };

const ticketById = (allTickets: TicketSummary[]): Map<string, TicketSummary> =>
  new Map(allTickets.map((ticket) => [ticket.id, ticket]));

const featureParentInBoard = (featureId: string, byId: Map<string, TicketSummary>): TicketSummary | undefined => {
  const ticket = byId.get(featureId);
  return ticket?.ticketType === "feature" ? ticket : undefined;
};

const epicParentInBoard = (epicId: string, byId: Map<string, TicketSummary>): TicketSummary | undefined => {
  const ticket = byId.get(epicId);
  return ticket?.ticketType === "epic" ? ticket : undefined;
};

export const DRAFT_TICKET_BOARD_COLUMN_IDS = new Set([RELAY_TODO_STATUS, RELAY_NEEDS_CLARIFICATION_STATUS]);

export const tasksInColumn = (columnId: string, allTickets: TicketSummary[]): TicketSummary[] =>
  allTickets.filter((ticket) => ticket.ticketType === "task" && ticket.status === columnId);

export const draftTicketsInColumn = (columnId: string, allTickets: TicketSummary[]): TicketSummary[] =>
  DRAFT_TICKET_BOARD_COLUMN_IDS.has(columnId)
    ? allTickets.filter((ticket) => ticket.ticketType === "draft_ticket" && ticket.status === columnId)
    : [];

export const ticketsForBoardColumn = (columnId: string, allTickets: TicketSummary[]): TicketSummary[] => {
  const byId = ticketById(allTickets);
  const columnTasks = tasksInColumn(columnId, allTickets);
  const columnDraftTickets = draftTicketsInColumn(columnId, allTickets);
  const included = new Map<string, TicketSummary>();

  for (const task of columnTasks) {
    included.set(task.id, task);
    if (task.parentFeatureId) {
      const feature = featureParentInBoard(task.parentFeatureId, byId);
      if (feature) included.set(feature.id, feature);
    }
  }

  for (const task of columnTasks) {
    const featureId = task.parentFeatureId;
    if (!featureId) {
      if (task.parentEpicId) {
        const epic = epicParentInBoard(task.parentEpicId, byId);
        if (epic) included.set(epic.id, epic);
      }
      continue;
    }
    const feature = featureParentInBoard(featureId, byId);
    if (feature?.parentEpicId) {
      const epic = epicParentInBoard(feature.parentEpicId, byId);
      if (epic) included.set(epic.id, epic);
    }
  }

  for (const draftTicket of columnDraftTickets) {
    included.set(draftTicket.id, draftTicket);
  }

  if (isReviewBoardColumn(columnId)) {
    for (const container of reviewStatusContainers(allTickets)) {
      included.set(container.id, container);
    }
  }

  return [...included.values()];
};

const itemSortPosition = (item: ColumnBoardItem): number => {
  if (item.kind === "ticket") return item.ticket.position;
  if (item.kind === "feature-group") {
    return Math.min(item.feature.position, ...item.tasks.map((task) => task.position));
  }
  const featurePositions = item.featureGroups.flatMap((group) => [group.feature.position, ...group.tasks.map((task) => task.position)]);
  return Math.min(item.epic.position, ...featurePositions);
};

export const countColumnTicketsForDisplay = (columnId: string, allTickets: TicketSummary[]): number =>
  organizeColumnBoardItems(columnId, allTickets).length;

export const organizeColumnBoardItems = (columnId: string, allTickets: TicketSummary[]): ColumnBoardItem[] => {
  const byId = ticketById(allTickets);
  const columnTasks = tasksInColumn(columnId, allTickets);
  const reviewContainersById = isReviewBoardColumn(columnId)
    ? new Map(reviewStatusContainers(allTickets).map((container) => [container.id, container]))
    : null;
  const tasksByFeature = new Map<string, TicketSummary[]>();
  const standaloneTasks: TicketSummary[] = [];

  for (const task of columnTasks) {
    if (task.parentFeatureId && featureParentInBoard(task.parentFeatureId, byId)) {
      const feature = featureParentInBoard(task.parentFeatureId, byId);
      const tasks = feature
        ? tasksForReviewContainerGroup(feature, [task])
        : [task];
      if (tasks.length === 0) continue;
      const existing = tasksByFeature.get(task.parentFeatureId) ?? [];
      existing.push(...tasks);
      tasksByFeature.set(task.parentFeatureId, existing);
      continue;
    }
    standaloneTasks.push(task);
  }

  for (const tasks of tasksByFeature.values()) {
    tasks.sort((left, right) => left.position - right.position);
  }
  standaloneTasks.sort((left, right) => left.position - right.position);

  const featureGroupsByEpic = new Map<string, FeatureBoardGroupItem[]>();
  const topLevelFeatureGroups: FeatureBoardGroupItem[] = [];

  for (const [featureId, tasks] of tasksByFeature) {
    const feature = featureParentInBoard(featureId, byId);
    if (!feature) {
      standaloneTasks.push(...tasks);
      continue;
    }
    const group: FeatureBoardGroupItem = {
      feature,
      tasks: tasksForReviewContainerGroup(feature, tasks),
      featureInColumn: isReviewBoardColumn(columnId)
        ? isReviewStatusContainer(feature)
        : feature.status === columnId
    };
    const epicId = feature.parentEpicId;
    const epic = epicId ? epicParentInBoard(epicId, byId) : undefined;
    if (epic) {
      const existing = featureGroupsByEpic.get(epic.id) ?? [];
      existing.push(group);
      featureGroupsByEpic.set(epic.id, existing);
      continue;
    }
    topLevelFeatureGroups.push(group);
  }

  for (const groups of featureGroupsByEpic.values()) {
    groups.sort((left, right) => left.feature.position - right.feature.position);
  }
  topLevelFeatureGroups.sort((left, right) => left.feature.position - right.feature.position);

  const items: ColumnBoardItem[] = [];
  const representedFeatureIds = new Set<string>();
  const representedEpicIds = new Set<string>();

  for (const [epicId, featureGroups] of featureGroupsByEpic) {
    const epic = epicParentInBoard(epicId, byId);
    if (!epic) {
      topLevelFeatureGroups.push(...featureGroups);
      continue;
    }
    representedEpicIds.add(epic.id);
    for (const group of featureGroups) representedFeatureIds.add(group.feature.id);
    items.push({ kind: "epic-group", epic, featureGroups });
  }

  for (const group of topLevelFeatureGroups) {
    representedFeatureIds.add(group.feature.id);
    items.push({
      kind: "feature-group",
      feature: group.feature,
      tasks: group.tasks,
      featureInColumn: group.featureInColumn
    });
  }

  for (const task of standaloneTasks) {
    items.push({ kind: "ticket", ticket: task });
  }

  const draftTickets = draftTicketsInColumn(columnId, allTickets).sort((left, right) => left.position - right.position);
  for (const draftTicket of draftTickets) {
    items.push({ kind: "ticket", ticket: draftTicket });
  }

  if (reviewContainersById) {
    for (const container of reviewContainersById.values()) {
      if (container.ticketType === "epic") {
        if (representedEpicIds.has(container.id)) continue;
        items.push({ kind: "epic-group", epic: container, featureGroups: [] });
        continue;
      }
      if (representedFeatureIds.has(container.id)) continue;
      const parentEpicId = container.parentEpicId;
      if (parentEpicId && reviewContainersById.get(parentEpicId)?.ticketType === "epic") continue;
      items.push({
        kind: "feature-group",
        feature: container,
        tasks: [],
        featureInColumn: true
      });
    }
  }

  return items.sort((left, right) => itemSortPosition(left) - itemSortPosition(right));
};

export const flattenBoardItemTicketIds = (items: ColumnBoardItem[]): string[] => {
  const ids: string[] = [];
  for (const item of items) {
    if (item.kind === "ticket") {
      ids.push(item.ticket.id);
      continue;
    }
    if (item.kind === "feature-group") {
      for (const task of item.tasks) ids.push(task.id);
      continue;
    }
    for (const group of item.featureGroups) {
      for (const task of group.tasks) ids.push(task.id);
    }
  }
  return ids;
};

export const flattenBoardColumnsTicketIds = (columns: RelayColumn[], allTickets: TicketSummary[]): string[] =>
  boardVisibleColumns(columns).flatMap((column) => flattenBoardItemTicketIds(organizeColumnBoardItems(column.id, allTickets)));

export const isTaskUndone = (task: TicketSummary, columns: RelayColumn[]): boolean => {
  const column = columns.find((entry) => entry.id === task.status);
  return !(column?.terminal ?? false);
};

export const isTaskInReview = (task: TicketSummary): boolean => task.status === RELAY_REVIEW_STATUS;

export const isTaskAgentRunnable = (task: TicketSummary, columns: RelayColumn[]): boolean =>
  isTaskUndone(task, columns) && !isTaskInReview(task);

export const isTaskRetryable = (
  task: TicketSummary,
  columns: RelayColumn[],
  allTickets: TicketSummary[]
): boolean => {
  if (task.ticketType !== "task" || task.status !== RELAY_IN_PROGRESS_STATUS || task.runStatus !== "failed") return false;
  if (!task.codexThreadId) return false;
  const blockers = resolveTicketBlockers(task, allTickets, columns);
  return !blockers.isBlocked;
};

const taskHasActiveAgentRunStatus = (task: TicketSummary): boolean =>
  task.runStatus === "running" ||
  task.runStatus === "queued" ||
  task.runStatus === "drafting" ||
  task.runStatus === "paused";

export const isTaskReadyPlaceable = (
  task: TicketSummary,
  columns: RelayColumn[],
  _allTickets: TicketSummary[]
): boolean => {
  if (task.ticketType !== "task" || !isTaskAgentRunnable(task, columns)) return false;
  if (taskHasActiveAgentRunStatus(task)) return false;
  return true;
};

export const isTaskProcessable = (
  task: TicketSummary,
  columns: RelayColumn[],
  allTickets: TicketSummary[]
): boolean => {
  if (!isTaskReadyPlaceable(task, columns, allTickets)) return false;
  const blockers = resolveTicketBlockers(task, allTickets, columns);
  return !blockers.isBlocked;
};

export const tasksMovableToReady = (
  tasks: TicketSummary[],
  columns: RelayColumn[],
  allTickets: TicketSummary[]
): TicketSummary[] => tasks.filter((task) => isTaskReadyPlaceable(task, columns, allTickets));

export const epicTasksMovableToReady = (
  featureGroups: FeatureBoardGroupItem[],
  columns: RelayColumn[],
  allTickets: TicketSummary[]
): TicketSummary[] =>
  featureGroups.flatMap((group) => tasksMovableToReady(group.tasks, columns, allTickets));

export const featureGroupShouldExpandByDefault = (
  tasks: TicketSummary[],
  columns: RelayColumn[],
  allTickets: TicketSummary[]
): boolean =>
  tasks.some(
    (task) =>
      isTaskProcessable(task, columns, allTickets) ||
      task.runStatus === "running" ||
      task.runStatus === "queued" ||
      task.runStatus === "paused" ||
      task.runStatus === "failed" ||
      task.runStatus === "draft_failed"
  );

export const epicGroupShouldExpandByDefault = (
  featureGroups: FeatureBoardGroupItem[],
  columns: RelayColumn[],
  allTickets: TicketSummary[]
): boolean => featureGroups.some((group) => featureGroupShouldExpandByDefault(group.tasks, columns, allTickets));
