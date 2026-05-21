import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type SyntheticListenerMap
} from "@dnd-kit/core";
import clsx from "clsx";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import type { RelayColumn, TicketSummary } from "@shared/schemas";
import { RELAY_NOT_DOING_STATUS, RELAY_READY_STATUS, RELAY_TODO_STATUS } from "@shared/schemas";
import type { BoardDragItem, BoardDragSourceColumn, BoardDropTarget } from "../lib/boardDragDrop";
import {
  boardDragId,
  boardDragItemToId,
  boardDragSourceColumnFromColumn,
  collectTasksUnderEpic,
  collectTasksUnderFeature,
  columnAcceptsBoardDrop,
  parseBoardDragId,
  parseBoardDropColumnId
} from "../lib/boardDragDrop";
import { BoardTaskCardLeading } from "./BoardTaskCardLeading";
import { BoardDragMarker } from "./BoardDragMarker";
import { hierarchyMarkerCssVars } from "../lib/boardHierarchyVisuals";
import { useBoardHierarchyVisual } from "./BoardHierarchyVisualContext";
import { TicketCardContent, TicketCardLabels } from "./TicketCardContent";

type BoardDragContextValue = {
  activeDrag: BoardDragItem | null;
  activeDragColumnId: string | null;
  dragSourceColumn: BoardDragSourceColumn | null;
  dragDropBusy: boolean;
  setActiveDragColumnId: (columnId: string | null) => void;
};

const BoardDragContext = createContext<BoardDragContextValue>({
  activeDrag: null,
  activeDragColumnId: null,
  dragSourceColumn: null,
  dragDropBusy: false,
  setActiveDragColumnId: () => undefined
});

export const useBoardDragContext = (): BoardDragContextValue => useContext(BoardDragContext);

export const boardDragSensors = (): ReturnType<typeof useSensors> =>
  useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

function BoardDragOverlayPreview({
  activeDrag,
  allTickets,
  columns,
  now
}: {
  activeDrag: BoardDragItem;
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  now: number;
}): ReactElement | null {
  const featureMarker = useBoardHierarchyVisual(activeDrag.kind === "feature" ? activeDrag.featureId ?? "" : "");
  const epicMarker = useBoardHierarchyVisual(activeDrag.kind === "epic" ? activeDrag.epicId ?? "" : "");
  const activeTask =
    activeDrag.kind === "task" && activeDrag.ticketId
      ? allTickets.find((entry) => entry.id === activeDrag.ticketId)
      : undefined;

  if (activeDrag.kind === "task" && activeDrag.ticketId) {
    const ticket = activeTask;
    if (!ticket) return null;
    return (
      <article className="board-drag-overlay-preview ticket-card">
        <div className="board-drag-overlay-preview-body ticket-card-layout">
          <BoardTaskCardLeading ticket={ticket} draggable={false} moveAriaLabel={`Move ${ticket.title}`} />
          <div className="card-open">
            <TicketCardContent ticket={ticket} allTickets={allTickets} columns={columns} now={now} compact />
          </div>
        </div>
      </article>
    );
  }

  if (activeDrag.kind === "feature" && activeDrag.featureId) {
    const feature = allTickets.find((entry) => entry.id === activeDrag.featureId);
    if (!feature) return null;
    const marker = featureMarker;
    const tasks = collectTasksUnderFeature(feature.id, allTickets);
    const meta = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
    return (
      <div
        className={clsx(
          "board-drag-overlay-preview hierarchy-board-group-trigger feature-board-group-trigger",
          marker && "has-hierarchy-marker"
        )}
        style={hierarchyMarkerCssVars(marker)}
      >
        <div className="ticket-card-layout hierarchy-board-group-layout">
          <div className="hierarchy-board-group-rail">
            {marker && <BoardDragMarker marker={marker} draggable={false} moveAriaLabel={`Move ${feature.title}`} />}
          </div>
          <div className="hierarchy-board-group-open">
            <div className="hierarchy-board-group-trigger-body">
              <div className="card-title-row">
                <div className="card-title">{feature.title}</div>
              </div>
              <div className="hierarchy-board-group-meta">{meta}</div>
              <TicketCardLabels labels={feature.labels} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeDrag.kind === "epic" && activeDrag.epicId) {
    const epic = allTickets.find((entry) => entry.id === activeDrag.epicId);
    if (!epic) return null;
    const marker = epicMarker;
    const featureCount = allTickets.filter(
      (entry) => entry.ticketType === "feature" && entry.parentEpicId === epic.id
    ).length;
    const taskCount = collectTasksUnderEpic(epic.id, allTickets).length;
    const meta = [
      `${featureCount} feature${featureCount === 1 ? "" : "s"}`,
      `${taskCount} task${taskCount === 1 ? "" : "s"}`
    ].join(" · ");
    return (
      <div
        className={clsx(
          "board-drag-overlay-preview hierarchy-board-group-trigger epic-board-group-trigger",
          marker && "has-hierarchy-marker"
        )}
        style={hierarchyMarkerCssVars(marker)}
      >
        <div className="ticket-card-layout hierarchy-board-group-layout">
          <div className="hierarchy-board-group-rail">
            {marker && <BoardDragMarker marker={marker} draggable={false} moveAriaLabel={`Move ${epic.title}`} />}
          </div>
          <div className="hierarchy-board-group-open">
            <div className="hierarchy-board-group-trigger-body">
              <div className="card-title-row">
                <div className="card-title">{epic.title}</div>
              </div>
              <div className="hierarchy-board-group-meta">{meta}</div>
              <TicketCardLabels labels={epic.labels} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function BoardDragProvider({
  children,
  onDragEndDrop,
  dragDropBusy,
  allTickets,
  columns,
  now
}: {
  children: ReactNode;
  onDragEndDrop: (item: BoardDragItem, dropStatus: BoardDropTarget) => Promise<void>;
  dragDropBusy: boolean;
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  now: number;
}): ReactElement {
  const sensors = boardDragSensors();
  const [activeDrag, setActiveDrag] = useState<BoardDragItem | null>(null);
  const [activeDragColumnId, setActiveDragColumnId] = useState<string | null>(null);
  const dragSourceColumn = boardDragSourceColumnFromColumn(activeDragColumnId);

  const handleDragStart = useCallback((event: DragStartEvent): void => {
    const item = parseBoardDragId(String(event.active.id));
    if (item) setActiveDrag(item);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent): Promise<void> => {
      const item = parseBoardDragId(String(event.active.id)) ?? activeDrag;
      setActiveDrag(null);
      setActiveDragColumnId(null);
      if (!item || !event.over) return;
      const dropStatus = parseBoardDropColumnId(String(event.over.id));
      if (!dropStatus) return;
      await onDragEndDrop(item, dropStatus);
    },
    [activeDrag, onDragEndDrop]
  );

  const handleDragCancel = useCallback((): void => {
    setActiveDrag(null);
    setActiveDragColumnId(null);
  }, []);

  const contextValue = useMemo<BoardDragContextValue>(
    () => ({
      activeDrag,
      activeDragColumnId,
      dragSourceColumn,
      dragDropBusy,
      setActiveDragColumnId
    }),
    [activeDrag, activeDragColumnId, dragDropBusy, dragSourceColumn]
  );

  return (
    <BoardDragContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null} className="board-drag-overlay-root">
          {activeDrag ? (
            <BoardDragOverlayPreview activeDrag={activeDrag} allTickets={allTickets} columns={columns} now={now} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </BoardDragContext.Provider>
  );
}

export function useBoardDraggable(
  dragId: string,
  enabled: boolean,
  columnId: string
): {
  setNodeRef: (node: HTMLElement | null) => void;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
} {
  const { activeDrag, dragDropBusy, setActiveDragColumnId } = useBoardDragContext();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: dragId,
    disabled: !enabled || dragDropBusy
  });

  useEffect(() => {
    if (isDragging) {
      setActiveDragColumnId(columnId);
      return;
    }
    setActiveDragColumnId((current) => (current === columnId ? null : current));
  }, [columnId, isDragging, setActiveDragColumnId]);

  return {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners: enabled && !dragDropBusy ? listeners : undefined,
    isDragging: isDragging || (activeDrag !== null && boardDragItemToId(activeDrag) === dragId)
  };
}

export function useBoardColumnDropTarget(columnId: string): {
  setNodeRef: (node: HTMLElement | null) => void;
  isDropTarget: boolean;
  isOver: boolean;
  dropTargetClassName: string | undefined;
} {
  const { active } = useDndContext();
  const { dragSourceColumn } = useBoardDragContext();
  const activeDragItem = active ? parseBoardDragId(String(active.id)) : null;
  const isDropTarget = columnAcceptsBoardDrop(columnId, activeDragItem, dragSourceColumn);
  const { setNodeRef, isOver } = useDroppable({
    id: isDropTarget ? boardDragId.column(columnId as BoardDropTarget) : `column-inert:${columnId}`,
    disabled: !isDropTarget
  });

  const dropTargetClassName =
    active && isDropTarget
      ? clsx(
          "board-column-drop-target",
          columnId === RELAY_READY_STATUS && "board-column-drop-target-ready",
          columnId === RELAY_TODO_STATUS && "board-column-drop-target-todo",
          columnId === RELAY_NOT_DOING_STATUS && "board-column-drop-target-not-doing",
          isOver && "board-column-drop-target-over"
        )
      : undefined;

  return { setNodeRef, isDropTarget, isOver, dropTargetClassName };
}

export const boardColumnDraggable = (columnId: string): boolean =>
  columnId === RELAY_TODO_STATUS || columnId === RELAY_NOT_DOING_STATUS;

/** @deprecated Use boardColumnDraggable */
export const todoColumnDraggable = boardColumnDraggable;
