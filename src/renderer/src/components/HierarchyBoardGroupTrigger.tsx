import clsx from "clsx";
import type { DraggableAttributes, SyntheticListenerMap } from "@dnd-kit/core";
import { Minus, Plus } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactElement } from "react";
import { BoardArchiveButton } from "./BoardArchiveButton";
import { BoardDragMarker } from "./BoardDragMarker";
import { HierarchyBoardGroupActiveSpinner } from "./HierarchyBoardGroupActiveSpinner";
import { Button } from "./ui";
import { hierarchyGroupActiveChildLabel } from "../lib/boardTaskProgress";
import { hierarchyMarkerCssVars, type HierarchyVisual } from "../lib/boardHierarchyVisuals";
import { TicketCardLabels } from "./TicketCardContent";

const EXPAND_ICON_SIZE = 12;

export function HierarchyBoardGroupTrigger({
  triggerClassName,
  marker,
  title,
  meta,
  labels,
  expanded,
  onToggle,
  onOpen,
  openAriaLabel,
  openTitle,
  expandAriaLabel,
  collapseAriaLabel,
  dragId,
  moveAriaLabel,
  draggable = false,
  setDragNodeRef,
  setDragActivatorNodeRef,
  dragAttributes,
  dragListeners,
  isDragging = false,
  activeChildTask = false,
  activeChildSpinnerLabel,
  showArchive = false,
  archiveBusy = false,
  onArchive
}: {
  triggerClassName: string;
  marker?: HierarchyVisual;
  activeChildTask?: boolean;
  activeChildSpinnerLabel?: string;
  title: string;
  meta: string;
  labels: string[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  openAriaLabel: string;
  openTitle: string;
  expandAriaLabel: string;
  collapseAriaLabel: string;
  dragId?: string;
  moveAriaLabel?: string;
  draggable?: boolean;
  setDragNodeRef?: (node: HTMLDivElement | null) => void;
  setDragActivatorNodeRef?: (node: HTMLButtonElement | null) => void;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  isDragging?: boolean;
  showArchive?: boolean;
  archiveBusy?: boolean;
  onArchive?: () => void;
}): ReactElement {
  const resolvedMoveAriaLabel = moveAriaLabel ?? `Move ${title} to Ready or Not Doing`;

  const handleExpandClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onToggle();
  };

  const handleOpenKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    onOpen();
  };

  return (
    <div
      ref={setDragNodeRef}
      className={clsx(
        "hierarchy-board-group-trigger",
        triggerClassName,
        marker && "has-hierarchy-marker",
        draggable && "hierarchy-board-group-draggable",
        isDragging && "dragging"
      )}
      style={hierarchyMarkerCssVars(marker)}
      data-drag-id={dragId}
    >
      <div className="ticket-card-layout hierarchy-board-group-layout">
        <div className="hierarchy-board-group-rail">
          {(marker || draggable) && (
            <BoardDragMarker
              marker={marker}
              variant={marker ? "colored" : "neutral"}
              draggable={draggable}
              moveAriaLabel={resolvedMoveAriaLabel}
              setActivatorNodeRef={setDragActivatorNodeRef}
              dragAttributes={dragAttributes}
              dragListeners={dragListeners}
            />
          )}
          {activeChildTask && (
            <HierarchyBoardGroupActiveSpinner
              label={activeChildSpinnerLabel ?? hierarchyGroupActiveChildLabel(title)}
            />
          )}
          {showArchive && onArchive && (
            <BoardArchiveButton label={`Archive ${title} and child tickets`} onArchive={onArchive} busy={archiveBusy} />
          )}
          <Button
            type="button"
            className="hierarchy-board-group-expand"
            onClick={handleExpandClick}
            onPointerDown={(event) => event.stopPropagation()}
            aria-expanded={expanded}
            aria-label={expanded ? collapseAriaLabel : expandAriaLabel}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minus size={EXPAND_ICON_SIZE} aria-hidden="true" /> : <Plus size={EXPAND_ICON_SIZE} aria-hidden="true" />}
          </Button>
        </div>

        <div
          className="hierarchy-board-group-open"
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={handleOpenKeyDown}
          aria-label={openAriaLabel}
          title={openTitle}
        >
          <div className="hierarchy-board-group-trigger-body">
            <div className="card-title-row">
              <div className="card-title">{title}</div>
            </div>
            {meta.length > 0 && <div className="hierarchy-board-group-meta">{meta}</div>}
            <TicketCardLabels labels={labels} />
          </div>
        </div>
      </div>
    </div>
  );
}
