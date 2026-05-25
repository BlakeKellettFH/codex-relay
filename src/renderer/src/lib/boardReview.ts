import {
  RELAY_COMPLETED_STATUS,
  RELAY_NOT_DOING_STATUS,
  RELAY_REVIEW_STATUS,
  type TicketSummary
} from "@shared/schemas";

export {
  containersToReconcile,
  epicReadyForReview,
  featureReadyForReview,
  isTerminalTaskStatus,
  linkedFeaturesForEpic,
  linkedTasksForEpic,
  linkedTasksForFeature,
  resolveEpicContainerStatus,
  resolveFeatureContainerStatus
} from "@domain/boardReview";

export const isReviewBoardColumn = (columnId: string): boolean => columnId === RELAY_REVIEW_STATUS;

export const isReviewStatusContainer = (ticket: TicketSummary): boolean =>
  (ticket.ticketType === "feature" || ticket.ticketType === "epic") && ticket.status === RELAY_REVIEW_STATUS;

export const reviewStatusContainers = (allTickets: readonly TicketSummary[]): TicketSummary[] =>
  allTickets.filter(isReviewStatusContainer);

/** Tasks shown under a container group in Review when the container itself is in review. */
export const tasksForReviewContainerGroup = (
  container: TicketSummary,
  columnTasks: readonly TicketSummary[]
): TicketSummary[] => {
  if (!isReviewStatusContainer(container)) return [...columnTasks];
  return columnTasks.filter(
    (task) => task.status !== RELAY_COMPLETED_STATUS && task.status !== RELAY_NOT_DOING_STATUS
  );
};
