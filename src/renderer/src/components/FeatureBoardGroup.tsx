import clsx from "clsx";
import { useEffect, useState, type ReactElement } from "react";
import type { RelayColumn, TicketSummary } from "@shared/schemas";
import { activeRunElapsedLabel } from "../lib/agentProgress";
import { showFeatureArchive } from "../lib/boardArchive";
import { featureGroupShouldExpandByDefault } from "../lib/boardColumnLayout";
import {
  boardArchivingActiveLabel,
  groupHasActiveChildTask,
  hierarchyGroupActiveChildLabel,
  showBoardContainerArchiveSpinner
} from "../lib/boardTaskProgress";
import { boardDragId, boardDragMoveAriaLabel } from "../lib/boardDragDrop";
import { BoardTaskCardLeading } from "./BoardTaskCardLeading";
import { Button } from "./ui";
import { hierarchyMarkerCssVars } from "../lib/boardHierarchyVisuals";
import { useBoardHierarchyVisual } from "./BoardHierarchyVisualContext";
import { HierarchyBoardGroupTrigger } from "./HierarchyBoardGroupTrigger";
import { isRunStatusFailure } from "./TicketCardPills";
import { TicketCardContent } from "./TicketCardContent";
import { boardColumnDraggable, useBoardDragContext, useBoardDraggable } from "./BoardDragDrop";

function NestedTaskCard({
  task,
  allTickets,
  columns,
  columnId,
  selected,
  onOpen,
  onFocus,
  onTicketButtonRef,
  now
}: {
  task: TicketSummary;
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  columnId: string;
  selected: boolean;
  onOpen: (ticketId: string) => void;
  onFocus: (ticketId: string) => void;
  onTicketButtonRef: (ticketId: string, node: HTMLButtonElement | null) => void;
  now: number;
}): ReactElement {
  const draggable = boardColumnDraggable(columnId);
  const { dragSourceColumn } = useBoardDragContext();
  const dragItem = { kind: "task" as const, ticketId: task.id };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useBoardDraggable(
    boardDragId.task(task.id),
    draggable,
    columnId
  );

  return (
    <article
      ref={setNodeRef}
      className={clsx(
        "ticket-card feature-task-card",
        draggable && "ticket-card-draggable",
        isRunStatusFailure(task.runStatus) && "ticket-card-run-failed",
        isDragging && "dragging",
        selected && "keyboard-selected"
      )}
      data-drag-id={boardDragId.task(task.id)}
    >
      <div className="ticket-card-layout">
        <BoardTaskCardLeading
          ticket={task}
          draggable={draggable}
          moveAriaLabel={boardDragMoveAriaLabel(task.title, dragItem, dragSourceColumn)}
          setActivatorNodeRef={setActivatorNodeRef}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
        <Button
          type="button"
          ref={(node) => onTicketButtonRef(task.id, node)}
          className="card-open"
          data-ticket-id={task.id}
          onClick={() => onOpen(task.id)}
          onFocus={() => onFocus(task.id)}
        >
          <TicketCardContent ticket={task} allTickets={allTickets} columns={columns} now={now} compact />
        </Button>
      </div>
    </article>
  );
}

export function FeatureBoardGroup({
  feature,
  tasks,
  allTickets,
  columns,
  columnId,
  selectedTicketId,
  onOpenFeature,
  onOpenTask,
  onTicketFocus,
  onTicketButtonRef,
  onArchiveFeature,
  now
}: {
  feature: TicketSummary;
  tasks: TicketSummary[];
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  columnId: string;
  selectedTicketId: string | null;
  onOpenFeature: (ticketId: string) => void;
  onOpenTask: (ticketId: string) => void;
  onTicketFocus: (ticketId: string) => void;
  onTicketButtonRef: (ticketId: string, node: HTMLButtonElement | null) => void;
  onArchiveFeature?: (featureId: string) => void;
  now: number;
}): ReactElement {
  const [expanded, setExpanded] = useState(() => featureGroupShouldExpandByDefault(tasks, columns, allTickets));
  const showGroupArchive = showFeatureArchive(feature, columnId, allTickets);
  const archivingContainer = showBoardContainerArchiveSpinner(feature);
  const draggable = boardColumnDraggable(columnId);
  const { dragSourceColumn } = useBoardDragContext();
  const featureDragItem = { kind: "feature" as const, featureId: feature.id };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useBoardDraggable(
    boardDragId.feature(feature.id),
    draggable,
    columnId
  );
  const marker = useBoardHierarchyVisual(feature.id);
  const activeChildTask = groupHasActiveChildTask(tasks) || archivingContainer;
  const activeTaskCount = tasks.filter((task) => task.runStatus === "running" || task.runStatus === "queued" || task.runStatus === "paused").length;
  const featureMeta = [
    `${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
    activeTaskCount > 0 ? `${activeTaskCount} active` : null
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    if (featureGroupShouldExpandByDefault(tasks, columns, allTickets)) {
      setExpanded(true);
    }
  }, [allTickets, columns, tasks]);

  return (
    <article className={clsx("feature-board-group", expanded && "expanded")}>
      <HierarchyBoardGroupTrigger
        triggerClassName="feature-board-group-trigger"
        marker={marker}
        activeChildTask={activeChildTask}
        title={feature.title}
        meta={featureMeta}
        labels={feature.labels}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        onOpen={() => onOpenFeature(feature.id)}
        openAriaLabel={`Open feature: ${feature.title}`}
        openTitle="Open feature"
        expandAriaLabel={`Expand ${feature.title}`}
        collapseAriaLabel={`Collapse ${feature.title}`}
        dragId={boardDragId.feature(feature.id)}
        draggable={draggable}
        moveAriaLabel={boardDragMoveAriaLabel(feature.title, featureDragItem, dragSourceColumn)}
        setDragNodeRef={setNodeRef}
        setDragActivatorNodeRef={setActivatorNodeRef}
        dragAttributes={attributes}
        dragListeners={listeners}
        isDragging={isDragging}
        showArchive={showGroupArchive}
        activeChildSpinnerLabel={
          archivingContainer ? boardArchivingActiveLabel(feature) : hierarchyGroupActiveChildLabel(feature.title)
        }
        onArchive={onArchiveFeature ? () => onArchiveFeature(feature.id) : undefined}
      />

      {expanded && (
        <div
          className={clsx("feature-board-group-tasks", marker && "has-hierarchy-marker")}
          style={hierarchyMarkerCssVars(marker)}
        >
          {tasks.map((task) => (
            <NestedTaskCard
              key={task.id}
              task={task}
              allTickets={allTickets}
              columns={columns}
              columnId={columnId}
              selected={task.id === selectedTicketId}
              onOpen={onOpenTask}
              onFocus={onTicketFocus}
              onTicketButtonRef={onTicketButtonRef}
              now={now}
            />
          ))}
        </div>
      )}

      {!expanded && activeRunElapsedLabel(feature, now) && (
        <p className="feature-board-group-collapsed-hint">Expand to see active tasks.</p>
      )}
    </article>
  );
}
