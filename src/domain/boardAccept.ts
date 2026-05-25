import {
  RELAY_COMPLETED_STATUS,
  RELAY_REVIEW_STATUS,
  type RelayColumn,
  type TicketSummary
} from "@shared/schemas";
import {
  isTerminalTaskStatus,
  linkedFeaturesForEpic,
  linkedTasksForEpic,
  linkedTasksForFeature
} from "./boardReview";

export const isReviewOrTerminalTaskStatus = (status: string, columns: readonly RelayColumn[]): boolean =>
  status === RELAY_REVIEW_STATUS || isTerminalTaskStatus(status, columns);

const isReviewOrCompletedFeatureStatus = (status: string): boolean =>
  status === RELAY_REVIEW_STATUS || status === RELAY_COMPLETED_STATUS;

export const featureReadyForBulkAccept = (
  feature: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean => {
  if (feature.ticketType !== "feature") return false;
  const tasks = linkedTasksForFeature(feature, allTickets);
  if (tasks.length === 0) return false;
  return tasks.every((task) => isReviewOrTerminalTaskStatus(task.status, columns));
};

export const epicReadyForBulkAccept = (
  epic: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean => {
  if (epic.ticketType !== "epic") return false;
  const features = linkedFeaturesForEpic(epic, allTickets);
  if (features.length === 0) return false;
  if (!features.every((feature) => isReviewOrCompletedFeatureStatus(feature.status))) return false;
  const tasks = linkedTasksForEpic(epic, allTickets);
  return tasks.every((task) => isReviewOrTerminalTaskStatus(task.status, columns));
};

/** @deprecated Prefer featureReadyForBulkAccept — kept for callers that require the container to already be in Review. */
export const featureEligibleForBulkAccept = (
  feature: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean =>
  feature.ticketType === "feature" &&
  feature.status === RELAY_REVIEW_STATUS &&
  featureReadyForBulkAccept(feature, allTickets, columns);

/** @deprecated Prefer epicReadyForBulkAccept — kept for callers that require the container to already be in Review. */
export const epicEligibleForBulkAccept = (
  epic: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean =>
  epic.ticketType === "epic" && epic.status === RELAY_REVIEW_STATUS && epicReadyForBulkAccept(epic, allTickets, columns);

export const acceptBundleForFeature = (
  featureId: string,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): string[] => {
  const feature = allTickets.find((ticket) => ticket.id === featureId && ticket.ticketType === "feature");
  if (!feature) return [];
  const bundle = linkedTasksForFeature(feature, allTickets)
    .filter((task) => task.status === RELAY_REVIEW_STATUS)
    .map((task) => task.id);
  if (featureReadyForBulkAccept(feature, allTickets, columns) && !bundle.includes(feature.id)) {
    bundle.push(feature.id);
  }
  return bundle;
};

export const acceptBundleForEpic = (
  epicId: string,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): string[] => {
  const epic = allTickets.find((ticket) => ticket.id === epicId && ticket.ticketType === "epic");
  if (!epic) return [];
  const bundle: string[] = [];
  for (const feature of linkedFeaturesForEpic(epic, allTickets)) {
    bundle.push(
      ...linkedTasksForFeature(feature, allTickets)
        .filter((task) => task.status === RELAY_REVIEW_STATUS)
        .map((task) => task.id)
    );
    if (feature.status === RELAY_REVIEW_STATUS && !bundle.includes(feature.id)) {
      bundle.push(feature.id);
    }
  }
  for (const task of linkedTasksForEpic(epic, allTickets)) {
    if (task.parentFeatureId === null && task.status === RELAY_REVIEW_STATUS && !bundle.includes(task.id)) {
      bundle.push(task.id);
    }
  }
  if (epicReadyForBulkAccept(epic, allTickets, columns) && !bundle.includes(epic.id)) {
    bundle.push(epic.id);
  }
  return bundle;
};

export const showFeatureBulkAccept = (
  feature: TicketSummary,
  columnId: string,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean => {
  if (columnId !== RELAY_REVIEW_STATUS || feature.ticketType !== "feature") return false;
  return feature.status === RELAY_REVIEW_STATUS || featureReadyForBulkAccept(feature, allTickets, columns);
};

export const showEpicBulkAccept = (
  epic: TicketSummary,
  columnId: string,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean => {
  if (columnId !== RELAY_REVIEW_STATUS || epic.ticketType !== "epic") return false;
  return epic.status === RELAY_REVIEW_STATUS || epicReadyForBulkAccept(epic, allTickets, columns);
};

const acceptBundleTypeOrder: Record<TicketSummary["ticketType"], number> = {
  task: 0,
  feature: 1,
  epic: 2,
  draft_ticket: 3
};

export const sortAcceptBundleIds = (bundleIds: string[], allTickets: readonly TicketSummary[]): string[] => {
  const byId = new Map(allTickets.map((ticket) => [ticket.id, ticket]));
  return [...new Set(bundleIds)].sort((leftId, rightId) => {
    const leftOrder = acceptBundleTypeOrder[byId.get(leftId)?.ticketType ?? "task"];
    const rightOrder = acceptBundleTypeOrder[byId.get(rightId)?.ticketType ?? "task"];
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return leftId.localeCompare(rightId);
  });
};
