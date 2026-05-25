import {
  containersToReconcile,
  resolveEpicContainerStatus,
  resolveFeatureContainerStatus
} from "@domain/boardReview";
import { readBoard, transitionTicketStatus } from "./filesystem";

const ticketById = (board: Awaited<ReturnType<typeof readBoard>>, ticketId: string) =>
  board.tickets.find((ticket) => ticket.id === ticketId) ?? null;

export const maybePromoteOrDemoteContainers = async (
  projectPath: string,
  changedTicketId?: string | null
): Promise<void> => {
  let board = await readBoard(projectPath);
  const { featureIds, epicIds } = containersToReconcile(board, changedTicketId);

  for (const featureId of featureIds) {
    const feature = ticketById(board, featureId);
    if (!feature || feature.ticketType !== "feature") continue;
    const targetStatus = resolveFeatureContainerStatus(feature, board);
    if (!targetStatus || targetStatus === feature.status) continue;
    await transitionTicketStatus(projectPath, featureId, targetStatus, {
      actor: "system",
      source: "system_reconciliation"
    });
    board = await readBoard(projectPath);
  }

  for (const epicId of epicIds) {
    const epic = ticketById(board, epicId);
    if (!epic || epic.ticketType !== "epic") continue;
    const targetStatus = resolveEpicContainerStatus(epic, board);
    if (!targetStatus || targetStatus === epic.status) continue;
    await transitionTicketStatus(projectPath, epicId, targetStatus, {
      actor: "system",
      source: "system_reconciliation"
    });
    board = await readBoard(projectPath);
  }
};
