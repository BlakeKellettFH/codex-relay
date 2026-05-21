import clsx from "clsx";
import { useEffect, useState, type ReactElement } from "react";
import type { RelayColumn, TicketSummary } from "@shared/schemas";
import type { FeatureBoardGroupItem } from "../lib/boardColumnLayout";
import { showEpicArchive } from "../lib/boardArchive";
import { epicGroupShouldExpandByDefault } from "../lib/boardColumnLayout";
import { boardDragId, boardDragMoveAriaLabel } from "../lib/boardDragDrop";
import { groupHasActiveChildTask } from "../lib/boardTaskProgress";
import { FeatureBoardGroup } from "./FeatureBoardGroup";
import { hierarchyMarkerCssVars } from "../lib/boardHierarchyVisuals";
import { useBoardHierarchyVisual } from "./BoardHierarchyVisualContext";
import { HierarchyBoardGroupTrigger } from "./HierarchyBoardGroupTrigger";
import { boardColumnDraggable, useBoardDragContext, useBoardDraggable } from "./BoardDragDrop";

export function EpicBoardGroup({
  epic,
  featureGroups,
  allTickets,
  columns,
  columnId,
  selectedTicketId,
  onOpenEpic,
  onOpenFeature,
  onOpenTask,
  onTicketFocus,
  onTicketButtonRef,
  onArchiveEpic,
  onArchiveFeature,
  archivingContainerIds,
  now
}: {
  epic: TicketSummary;
  featureGroups: FeatureBoardGroupItem[];
  allTickets: TicketSummary[];
  columns: RelayColumn[];
  columnId: string;
  selectedTicketId: string | null;
  onOpenEpic: (ticketId: string) => void;
  onOpenFeature: (ticketId: string) => void;
  onOpenTask: (ticketId: string) => void;
  onTicketFocus: (ticketId: string) => void;
  onTicketButtonRef: (ticketId: string, node: HTMLButtonElement | null) => void;
  onArchiveEpic?: (epicId: string) => void;
  onArchiveFeature?: (featureId: string) => void;
  archivingContainerIds?: ReadonlySet<string>;
  now: number;
}): ReactElement {
  const [expanded, setExpanded] = useState(() => epicGroupShouldExpandByDefault(featureGroups, columns, allTickets));
  const draggable = boardColumnDraggable(columnId);
  const { dragSourceColumn } = useBoardDragContext();
  const epicDragItem = { kind: "epic" as const, epicId: epic.id };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useBoardDraggable(
    boardDragId.epic(epic.id),
    draggable,
    columnId
  );
  const marker = useBoardHierarchyVisual(epic.id);
  const childTasks = featureGroups.flatMap((group) => group.tasks);
  const showGroupArchive = showEpicArchive(epic, columnId, allTickets);
  const groupArchiveBusy = archivingContainerIds?.has(epic.id) ?? false;
  const taskCount = childTasks.length;
  const activeChildTask = groupHasActiveChildTask(childTasks);
  const epicMeta = [
    `${featureGroups.length} feature${featureGroups.length === 1 ? "" : "s"}`,
    `${taskCount} task${taskCount === 1 ? "" : "s"} in column`
  ].join(" · ");

  useEffect(() => {
    if (epicGroupShouldExpandByDefault(featureGroups, columns, allTickets)) {
      setExpanded(true);
    }
  }, [allTickets, columns, featureGroups]);

  return (
    <article className={clsx("epic-board-group", expanded && "expanded")}>
      <HierarchyBoardGroupTrigger
        triggerClassName="epic-board-group-trigger"
        marker={marker}
        activeChildTask={activeChildTask}
        title={epic.title}
        meta={epicMeta}
        labels={epic.labels}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        onOpen={() => onOpenEpic(epic.id)}
        openAriaLabel={`Open epic: ${epic.title}`}
        openTitle="Open epic"
        expandAriaLabel={`Expand ${epic.title}`}
        collapseAriaLabel={`Collapse ${epic.title}`}
        dragId={boardDragId.epic(epic.id)}
        draggable={draggable}
        moveAriaLabel={boardDragMoveAriaLabel(epic.title, epicDragItem, dragSourceColumn)}
        setDragNodeRef={setNodeRef}
        setDragActivatorNodeRef={setActivatorNodeRef}
        dragAttributes={attributes}
        dragListeners={listeners}
        isDragging={isDragging}
        showArchive={showGroupArchive}
        archiveBusy={groupArchiveBusy}
        onArchive={onArchiveEpic ? () => onArchiveEpic(epic.id) : undefined}
      />

      {expanded && (
        <div
          className={clsx("epic-board-group-features", marker && "has-hierarchy-marker")}
          style={hierarchyMarkerCssVars(marker)}
        >
          {featureGroups.map((group) => (
            <FeatureBoardGroup
              key={`feature-group-${group.feature.id}`}
              feature={group.feature}
              tasks={group.tasks}
              allTickets={allTickets}
              columns={columns}
              columnId={columnId}
              selectedTicketId={selectedTicketId}
              onOpenFeature={onOpenFeature}
              onOpenTask={onOpenTask}
              onTicketFocus={onTicketFocus}
              onTicketButtonRef={onTicketButtonRef}
              onArchiveFeature={onArchiveFeature}
              archivingContainerIds={archivingContainerIds}
              now={now}
            />
          ))}
        </div>
      )}
    </article>
  );
}
