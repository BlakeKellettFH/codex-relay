import { RELAY_IN_PROGRESS_STATUS, RELAY_READY_STATUS } from "@shared/schemas";
import type { TicketSummary } from "@shared/schemas";
import { ticketHasPendingArchiveLabel } from "./boardArchive";
import { taskHasActiveAgentWork } from "./boardDragDrop";

const DRAFT_TICKET_ACTIVE_RUN_STATUSES = new Set<TicketSummary["runStatus"]>(["drafting", "queued"]);

export const showBoardDraftTicketSpinner = (ticket: TicketSummary): boolean =>
  ticket.ticketType === "draft_ticket" && DRAFT_TICKET_ACTIVE_RUN_STATUSES.has(ticket.runStatus);

export const showBoardContainerArchiveSpinner = (ticket: TicketSummary): boolean =>
  (ticket.ticketType === "feature" || ticket.ticketType === "epic") &&
  ticketHasPendingArchiveLabel(ticket) &&
  ticket.status === RELAY_READY_STATUS &&
  ticket.runStatus === "running";

export const showBoardArchiveActiveSpinner = (ticket: TicketSummary): boolean => {
  if (!ticketHasPendingArchiveLabel(ticket) || ticket.runStatus !== "running") return false;
  if (ticket.ticketType === "task") return ticket.status === RELAY_IN_PROGRESS_STATUS;
  return showBoardContainerArchiveSpinner(ticket);
};

export const showBoardTaskActiveSpinner = (ticket: TicketSummary): boolean => {
  if (showBoardDraftTicketSpinner(ticket)) return true;
  if (showBoardArchiveActiveSpinner(ticket)) return true;
  if (ticket.status === RELAY_READY_STATUS && ticket.runStatus === "queued") {
    return !ticketHasPendingArchiveLabel(ticket);
  }
  return ticket.ticketType === "task" && ticket.status === RELAY_IN_PROGRESS_STATUS && taskHasActiveAgentWork(ticket);
};

export const groupHasActiveChildTask = (tasks: Iterable<TicketSummary>): boolean => {
  for (const task of tasks) {
    if (showBoardTaskActiveSpinner(task)) return true;
  }
  return false;
};

export const hierarchyGroupActiveChildLabel = (title: string): string => `${title}: child task running in In Progress`;

export const boardArchivingQueuedLabel = (ticket: Pick<TicketSummary, "title">): string =>
  `${ticket.title}: queued for archive`;

export const boardArchivingActiveLabel = (ticket: Pick<TicketSummary, "title">): string =>
  `${ticket.title}: archiving in progress`;

export const boardTaskActiveLabel = (ticket: Pick<TicketSummary, "runStatus" | "title" | "labels">): string => {
  if (ticketHasPendingArchiveLabel(ticket)) {
    if (ticket.runStatus === "queued") return boardArchivingQueuedLabel(ticket);
    if (ticket.runStatus === "running") return boardArchivingActiveLabel(ticket);
  }
  switch (ticket.runStatus) {
    case "queued":
      return `${ticket.title}: queued for agent processing`;
    case "drafting":
      return `${ticket.title}: drafting in progress`;
    case "paused":
      return `${ticket.title}: agent work paused`;
    case "running":
    default:
      return `${ticket.title}: agent work in progress`;
  }
};
