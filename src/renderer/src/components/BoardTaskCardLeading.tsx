import type { DraggableAttributes, SyntheticListenerMap } from "@dnd-kit/core";
import type { ReactElement } from "react";
import type { TicketSummary } from "@shared/schemas";
import { showBoardTaskActiveSpinner } from "../lib/boardTaskProgress";
import { BoardArchiveButton } from "./BoardArchiveButton";
import { BoardDragMarker } from "./BoardDragMarker";
import { BoardTaskActiveSpinner } from "./BoardTaskActiveSpinner";

export function BoardTaskCardLeading({
  ticket,
  draggable,
  showArchive = false,
  archiveBusy = false,
  onArchive,
  moveAriaLabel,
  setActivatorNodeRef,
  dragAttributes,
  dragListeners
}: {
  ticket: TicketSummary;
  draggable: boolean;
  showArchive?: boolean;
  archiveBusy?: boolean;
  onArchive?: () => void;
  moveAriaLabel: string;
  setActivatorNodeRef?: (node: HTMLButtonElement | null) => void;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
}): ReactElement | null {
  if (showBoardTaskActiveSpinner(ticket)) {
    return <BoardTaskActiveSpinner ticket={ticket} />;
  }

  if (showArchive && onArchive) {
    return <BoardArchiveButton label={`Archive ${ticket.title}`} onArchive={onArchive} busy={archiveBusy} />;
  }

  if (!draggable) return null;

  return (
    <BoardDragMarker
      variant="neutral"
      draggable
      moveAriaLabel={moveAriaLabel}
      setActivatorNodeRef={setActivatorNodeRef}
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
    />
  );
}
