import clsx from "clsx";
import { Check, CircleAlert, Clock, Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { RunStatus, TicketAuthoringState } from "@shared/schemas";

export const isRunStatusFailure = (status: RunStatus): boolean => status === "failed" || status === "draft_failed";

const runLabel = (status: RunStatus): string => {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "drafting":
      return "Drafting";
    case "draft_failed":
      return "Draft Failed";
    case "draft_complete":
      return "Draft Ready";
    default:
      return "Idle";
  }
};

const authoringLabel = (state: TicketAuthoringState): string => {
  switch (state) {
    case "drafting":
      return "Drafting";
    case "reviewing":
      return "Reviewing";
    case "refining":
      return "Refining";
    case "needs_input":
      return "Needs Input";
    case "ready":
      return "Ready";
    case "rough":
    default:
      return "Rough";
  }
};

export function TicketBoardFailedIcon({ status }: { status: RunStatus }): ReactElement | null {
  if (!isRunStatusFailure(status)) return null;
  const label = runLabel(status);

  return (
    <span className="ticket-board-failed-icon" title={`Agent status: ${label}`} aria-label={`Agent status: ${label}`}>
      <CircleAlert size={16} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}

export function TicketRunStatusPill({ status }: { status: RunStatus }): ReactElement {
  const label = runLabel(status);

  return (
    <span className={clsx("run-pill", status)} title={`Agent status: ${label}`} aria-label={`Agent status: ${label}`}>
      {(status === "drafting" || status === "running") && <Loader2 className="spin run-pill-icon" size={12} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

export function TicketAuthoringStatePill({ state }: { state: TicketAuthoringState }): ReactElement {
  const label = authoringLabel(state);
  return (
    <span className={clsx("authoring-pill", state)} title={`Authoring state: ${label}`} aria-label={`Authoring state: ${label}`}>
      {state === "drafting" || state === "refining" ? <Loader2 className="spin run-pill-icon" size={12} aria-hidden="true" /> : null}
      <span>{label}</span>
    </span>
  );
}

export function TicketChecklistPill({ completed, total }: { completed: number; total: number }): ReactElement {
  const label = `${completed}/${total}`;
  return (
    <span className="checklist-pill" title={`Checklist progress: ${label}`} aria-label={`Checklist progress: ${label}`}>
      <Check size={12} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function TicketRunElapsedPill({ label }: { label: string }): ReactElement {
  const title = `Agent running for ${label}`;
  return (
    <span className="run-elapsed-pill" title={title} aria-label={title}>
      <Clock className="run-pill-icon" size={12} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
