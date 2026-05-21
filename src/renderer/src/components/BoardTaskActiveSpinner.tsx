import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { TicketSummary } from "@shared/schemas";
import { boardTaskActiveLabel } from "../lib/boardTaskProgress";

export function BoardTaskActiveSpinner({ ticket }: { ticket: TicketSummary }): ReactElement {
  const label = boardTaskActiveLabel(ticket);

  return (
    <span
      className="board-drag-marker board-drag-marker-task board-task-active-spinner"
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
    >
      <Loader2 className="spin" size={12} aria-hidden="true" />
    </span>
  );
}
