import clsx from "clsx";
import { useMemo, type ReactElement } from "react";
import type { FinalTicketType, RelayColumn, TicketSummary } from "@shared/schemas";
import { resolveTicketBlockers, resolvedBlockerLabel } from "@shared/blockers";
import { activeRunElapsedLabel } from "../lib/agentProgress";
import {
  isRunStatusFailure,
  TicketAuthoringStatePill,
  TicketBoardFailedIcon,
  TicketChecklistPill,
  TicketRunElapsedPill,
  TicketRunStatusPill
} from "./TicketCardPills";

export function TicketCardLabels({ labels }: { labels: string[] }): ReactElement | null {
  const visibleLabels = labels.slice(0, 2);
  const hiddenLabels = labels.slice(visibleLabels.length);
  const hiddenLabelCount = hiddenLabels.length;
  const hiddenLabelText = hiddenLabels.join(", ");

  if (visibleLabels.length === 0) return null;

  return (
    <div className="labels">
      {visibleLabels.map((label) => (
        <span key={label}>{label}</span>
      ))}
      {hiddenLabelCount > 0 && (
        <span className="label-overflow" title={`Hidden labels: ${hiddenLabelText}`} aria-label={`${hiddenLabelCount} hidden labels: ${hiddenLabelText}`}>
          +{hiddenLabelCount}
        </span>
      )}
    </div>
  );
}

export function TicketCardContent({
  ticket,
  allTickets,
  columns,
  now,
  compact = false
}: {
  ticket: TicketSummary;
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  now: number;
  compact?: boolean;
}): ReactElement {
  if (compact) {
    const showFailedIcon = isRunStatusFailure(ticket.runStatus);

    return (
      <>
        <div className="card-title-row">
          <div className="card-title">{ticket.title}</div>
          {showFailedIcon && <TicketBoardFailedIcon status={ticket.runStatus} />}
        </div>
        <TicketCardLabels labels={ticket.labels} />
      </>
    );
  }

  const showPriority = ticket.priority === "high" || ticket.priority === "urgent";
  const showRunStatus = ticket.runStatus !== "idle";
  const showAuthoringState = ticket.authoringState !== "rough" && ticket.runStatus === "idle";
  const showChecklist = ticket.checklist.total > 0;
  const elapsedLabel = activeRunElapsedLabel(ticket, now);
  const draftTargetLabel = (target: FinalTicketType): string =>
    target === "epic" ? "Epic" : target === "feature" ? "Feature" : "Task";
  const showRelationship =
    ticket.ticketType === "draft_ticket" ||
    ticket.ticketType === "epic" ||
    ticket.ticketType === "feature" ||
    Boolean(ticket.parentEpicId) ||
    Boolean(ticket.parentFeatureId);
  const blockerState = useMemo(() => resolveTicketBlockers(ticket, allTickets, columns), [allTickets, columns, ticket]);
  const showBlockerState = blockerState.isBlocked || blockerState.warnings.length > 0;

  return (
    <>
      <div className="card-title">{ticket.title}</div>
      <p className="card-excerpt">{ticket.excerpt || "No details yet."}</p>
      {(showRelationship || showPriority || showRunStatus || showAuthoringState || showChecklist || showBlockerState || elapsedLabel) && (
        <div className="card-meta">
          {ticket.ticketType === "draft_ticket" && (
            <span className="ticket-type-pill draft" title="Draft ticket" aria-label="Draft ticket">
              Draft{ticket.draftTargetType ? ` · ${draftTargetLabel(ticket.draftTargetType)}` : ""}
            </span>
          )}
          {ticket.ticketType === "epic" && (
            <span className="ticket-type-pill epic" title="Epic ticket" aria-label="Epic ticket">
              Epic
            </span>
          )}
          {ticket.ticketType === "feature" && (
            <span className="ticket-type-pill feature" title="Feature ticket" aria-label="Feature ticket">
              Feature
            </span>
          )}
          {ticket.parentFeatureId && (
            <span className="ticket-type-pill subticket" title="Task under a feature" aria-label="Task under a feature">
              Task
            </span>
          )}
          {ticket.parentEpicId && !ticket.parentFeatureId && (
            <span className="ticket-type-pill subticket" title="Linked to an epic" aria-label="Linked to an epic">
              {ticket.ticketType === "feature" ? "Epic child" : "Legacy epic link"}
            </span>
          )}
          {blockerState.isBlocked && (
            <span className="ticket-blocker-pill active" title={blockerState.activeBlockers.map(resolvedBlockerLabel).join("; ")}>
              Blocked
            </span>
          )}
          {blockerState.warnings.length > 0 && (
            <span className="ticket-blocker-pill warning" title={blockerState.warnings.join(" ")}>
              Blocker Warning
            </span>
          )}
          {showPriority && (
            <span className={clsx("priority", ticket.priority)} title={`${ticket.priority} priority`} aria-label={`${ticket.priority} priority`}>
              {ticket.priority}
            </span>
          )}
          {showRunStatus && <TicketRunStatusPill status={ticket.runStatus} />}
          {showAuthoringState && <TicketAuthoringStatePill state={ticket.authoringState} />}
          {showChecklist && <TicketChecklistPill completed={ticket.checklist.completed} total={ticket.checklist.total} />}
          {elapsedLabel && <TicketRunElapsedPill label={elapsedLabel} />}
        </div>
      )}
      <TicketCardLabels labels={ticket.labels} />
    </>
  );
}
