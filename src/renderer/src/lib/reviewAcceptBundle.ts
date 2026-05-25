import { RELAY_COMPLETED_STATUS } from "@shared/schemas";
import type { BoardSnapshot, RelayColumn, TicketMoveInput, TicketSummary } from "@shared/schemas";
import {
  acceptBundleForEpic,
  acceptBundleForFeature,
  epicReadyForBulkAccept,
  featureReadyForBulkAccept,
  sortAcceptBundleIds
} from "./boardAccept";

export const reviewAcceptSuccessMessage = (container: TicketSummary, bundleIds: readonly string[]): string => {
  const childCount = bundleIds.filter((id) => id !== container.id).length;
  const label = container.ticketType === "epic" ? "Epic" : "Feature";
  if (childCount === 0) return `${label} accepted.`;
  const childLabel = container.ticketType === "epic" ? "child ticket" : "task";
  return `${label} and ${childCount} ${childLabel}${childCount === 1 ? "" : "s"} accepted.`;
};

export const resolveReviewAcceptBundleIds = (
  container: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): string[] => {
  if (container.ticketType === "feature") {
    return sortAcceptBundleIds(acceptBundleForFeature(container.id, allTickets, columns), allTickets);
  }
  if (container.ticketType === "epic") {
    return sortAcceptBundleIds(acceptBundleForEpic(container.id, allTickets, columns), allTickets);
  }
  return [];
};

export const canBulkAcceptReviewContainer = (
  container: TicketSummary,
  allTickets: readonly TicketSummary[],
  columns: readonly RelayColumn[]
): boolean => {
  if (container.ticketType === "feature") return featureReadyForBulkAccept(container, allTickets, columns);
  if (container.ticketType === "epic") return epicReadyForBulkAccept(container, allTickets, columns);
  return false;
};

export const moveReviewAcceptBundle = async ({
  projectPath,
  container,
  allTickets,
  columns,
  moveTicket
}: {
  projectPath: string;
  container: TicketSummary;
  allTickets: readonly TicketSummary[];
  columns: readonly RelayColumn[];
  moveTicket: (input: TicketMoveInput) => Promise<BoardSnapshot>;
}): Promise<string[]> => {
  const sortedIds = resolveReviewAcceptBundleIds(container, allTickets, columns);
  if (sortedIds.length === 0) return [];

  for (const id of sortedIds) {
    const entry = allTickets.find((item) => item.id === id);
    await moveTicket({
      projectPath,
      ticketId: id,
      targetStatus: RELAY_COMPLETED_STATUS,
      ...(entry?.ticketType === "task" ? { suppressContainerReconciliation: true } : {})
    });
  }

  return sortedIds;
};
