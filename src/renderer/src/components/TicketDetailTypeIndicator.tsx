import clsx from "clsx";
import { useMemo, type ReactElement, type ReactNode } from "react";
import type { FinalTicketType, TicketSummary, TicketType } from "@shared/schemas";
import {
  buildHierarchyVisualRegistry,
  getHierarchyVisual,
  hierarchyMarkerCssVars
} from "../lib/boardHierarchyVisuals";

const finalTypeLabel = (ticketType: FinalTicketType): string => {
  switch (ticketType) {
    case "epic":
      return "Epic";
    case "feature":
      return "Feature";
    default:
      return "Task";
  }
};

const typeLabel = (ticketType: TicketType, draftTargetType?: FinalTicketType | null): string => {
  if (ticketType === "draft_ticket") {
    const target = draftTargetType ?? "task";
    return `Draft ${finalTypeLabel(target)}`;
  }
  return finalTypeLabel(ticketType);
};

export function TicketDetailTypeIndicator({
  ticketType,
  draftTargetType,
  ticketId,
  boardTickets,
  children
}: {
  ticketType: TicketType;
  draftTargetType?: FinalTicketType | null;
  ticketId: string;
  boardTickets: TicketSummary[];
  children?: ReactNode;
}): ReactElement {
  const marker = useMemo(() => {
    if (ticketType !== "epic" && ticketType !== "feature") return undefined;
    const registry = buildHierarchyVisualRegistry(boardTickets);
    return getHierarchyVisual(registry, ticketId);
  }, [boardTickets, ticketId, ticketType]);

  const label = typeLabel(ticketType, draftTargetType);

  return (
    <div className="ticket-detail-type-status-row">
      <div
        className={clsx("ticket-detail-type-indicator", ticketType, marker && "has-hierarchy-marker")}
        style={hierarchyMarkerCssVars(marker)}
        aria-label={`${label} ticket${marker ? `, board marker ${marker.letter}` : ""}`}
      >
        {marker && (
          <span
            className="ticket-detail-type-marker"
            style={{ color: marker.color, backgroundColor: marker.backgroundColor }}
            aria-hidden="true"
          >
            {marker.letter}
          </span>
        )}
        <span className="ticket-detail-type-label">{label}</span>
      </div>
      {children ? (
        <>
          <span className="ticket-detail-type-status-divider" aria-hidden="true">
            |
          </span>
          <div className="detail-status-row">{children}</div>
        </>
      ) : null}
    </div>
  );
}
