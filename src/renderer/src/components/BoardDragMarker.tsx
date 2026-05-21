import clsx from "clsx";
import type { DraggableAttributes, SyntheticListenerMap } from "@dnd-kit/core";
import { Move } from "lucide-react";
import type { MouseEvent, ReactElement } from "react";
import type { HierarchyVisual } from "../lib/boardHierarchyVisuals";

const MARKER_ICON_SIZE = 12;

export function BoardDragMarker({
  marker,
  variant = "colored",
  draggable = false,
  moveAriaLabel,
  setActivatorNodeRef,
  dragAttributes,
  dragListeners
}: {
  marker?: HierarchyVisual;
  variant?: "colored" | "neutral";
  draggable?: boolean;
  moveAriaLabel: string;
  setActivatorNodeRef?: (node: HTMLButtonElement | null) => void;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
}): ReactElement {
  const isTaskMarker = variant === "neutral" || !marker;
  const className = clsx(
    "board-drag-marker",
    isTaskMarker && "board-drag-marker-task",
    draggable && "board-drag-marker-draggable"
  );

  const stopOpen = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
  };

  const content = isTaskMarker ? (
    <Move size={MARKER_ICON_SIZE} strokeWidth={2.25} aria-hidden="true" />
  ) : (
    marker!.letter
  );

  if (!draggable) {
    if (isTaskMarker) {
      return (
        <span className={className} aria-hidden="true">
          {content}
        </span>
      );
    }
    return (
      <span
        className={className}
        style={{ color: marker!.color, backgroundColor: marker!.backgroundColor }}
        aria-hidden="true"
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={className}
      style={
        isTaskMarker
          ? undefined
          : { color: marker!.color, backgroundColor: marker!.backgroundColor }
      }
      aria-label={moveAriaLabel}
      title={moveAriaLabel}
      onClick={stopOpen}
      onPointerDown={stopOpen}
      {...dragAttributes}
      {...dragListeners}
    >
      {content}
    </button>
  );
}
