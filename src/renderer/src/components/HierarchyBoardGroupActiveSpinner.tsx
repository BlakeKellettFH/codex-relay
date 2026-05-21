import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";

export function HierarchyBoardGroupActiveSpinner({ label }: { label: string }): ReactElement {
  return (
    <span
      className="board-drag-marker board-drag-marker-task hierarchy-board-group-active-spinner"
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
    >
      <Loader2 className="spin" size={12} aria-hidden="true" />
    </span>
  );
}
