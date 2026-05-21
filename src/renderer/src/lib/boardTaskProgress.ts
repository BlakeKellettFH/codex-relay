import { RELAY_IN_PROGRESS_STATUS } from "@shared/schemas";
import type { TicketSummary } from "@shared/schemas";
import { taskHasActiveAgentWork } from "./boardDragDrop";

const DRAFT_TICKET_ACTIVE_RUN_STATUSES = new Set<TicketSummary["runStatus"]>(["drafting", "queued"]);

export const showBoardDraftTicketSpinner = (ticket: TicketSummary): boolean =>
  ticket.ticketType === "draft_ticket" && DRAFT_TICKET_ACTIVE_RUN_STATUSES.has(ticket.runStatus);

export const showBoardTaskActiveSpinner = (ticket: TicketSummary): boolean => {
  if (showBoardDraftTicketSpinner(ticket)) return true;
  return ticket.ticketType === "task" && ticket.status === RELAY_IN_PROGRESS_STATUS && taskHasActiveAgentWork(ticket);
};

export const groupHasActiveChildTask = (tasks: Iterable<TicketSummary>): boolean => {
  for (const task of tasks) {
    if (showBoardTaskActiveSpinner(task)) return true;
  }
  return false;
};

export const hierarchyGroupActiveChildLabel = (title: string): string => `${title}: child task running in In Progress`;

export const boardTaskActiveLabel = (ticket: Pick<TicketSummary, "runStatus" | "title">): string => {
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
