import type { FinalTicketType, TicketType } from "./schemas/primitives";
import type { TicketFrontMatter } from "./schemas/ticket";

export const resolveDraftPreferredTicketType = (
  frontMatter: Pick<TicketFrontMatter, "ticketType" | "draftTargetType">
): FinalTicketType => {
  if (frontMatter.ticketType === "draft_ticket") {
    return frontMatter.draftTargetType ?? "task";
  }
  if (frontMatter.ticketType === "epic" || frontMatter.ticketType === "feature" || frontMatter.ticketType === "task") {
    return frontMatter.ticketType;
  }
  return "task";
};

export const isDraftTicketType = (ticketType: TicketType): boolean => ticketType === "draft_ticket";
