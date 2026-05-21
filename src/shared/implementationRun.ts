import { RELAY_IN_PROGRESS_STATUS } from "./schemas/board";
import type { TicketSummary } from "./schemas";

export const isImplementationContinuation = (
  ticket: Pick<TicketSummary, "status" | "runStatus" | "codexThreadId">
): boolean =>
  Boolean(ticket.codexThreadId) &&
  ticket.status === RELAY_IN_PROGRESS_STATUS &&
  (ticket.runStatus === "paused" || ticket.runStatus === "failed");
