import type { FinalTicketType, TicketType } from "./schemas/primitives";
import type { TicketFrontMatter } from "./schemas/ticket";

/** Relay drafts create epics or features with lean tasks — never a standalone root task ticket. */
export const effectiveDraftPreferredTicketType = (
  preferred?: FinalTicketType | null
): FinalTicketType | undefined => {
  if (preferred == null) return undefined;
  return preferred === "task" ? "feature" : preferred;
};

export const resolveDraftPreferredTicketType = (
  frontMatter: Pick<TicketFrontMatter, "ticketType" | "draftTargetType">
): FinalTicketType => {
  if (frontMatter.ticketType === "draft_ticket") {
    return effectiveDraftPreferredTicketType(frontMatter.draftTargetType) ?? "feature";
  }
  if (frontMatter.ticketType === "epic" || frontMatter.ticketType === "feature" || frontMatter.ticketType === "task") {
    return frontMatter.ticketType;
  }
  return "feature";
};

export const isDraftTicketType = (ticketType: TicketType): boolean => ticketType === "draft_ticket";
