import {
  RELAY_ARCHIVE_STATUS,
  RELAY_COMPLETED_STATUS,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_READY_STATUS
} from "@shared/schemas";
import type { TicketSummary } from "@shared/schemas";

const collectTasksUnderFeature = (featureId: string, allTickets: readonly TicketSummary[]): TicketSummary[] =>
  allTickets.filter((ticket) => ticket.ticketType === "task" && ticket.parentFeatureId === featureId);

const collectTasksUnderEpic = (epicId: string, allTickets: readonly TicketSummary[]): TicketSummary[] => {
  const featureIds = new Set(
    allTickets.filter((ticket) => ticket.ticketType === "feature" && ticket.parentEpicId === epicId).map((ticket) => ticket.id)
  );
  return allTickets.filter(
    (ticket) =>
      ticket.ticketType === "task" &&
      (ticket.parentEpicId === epicId ||
        (ticket.parentFeatureId !== null && featureIds.has(ticket.parentFeatureId)))
  );
};

export const completedColumnArchivable = (columnId: string): boolean => columnId === RELAY_COMPLETED_STATUS;

export const isTaskCompleted = (ticket: TicketSummary): boolean =>
  ticket.ticketType === "task" && ticket.status === RELAY_COMPLETED_STATUS;

export const tasksUnderFeature = (featureId: string, allTickets: readonly TicketSummary[]): TicketSummary[] =>
  collectTasksUnderFeature(featureId, allTickets);

export const featuresUnderEpic = (epicId: string, allTickets: readonly TicketSummary[]): TicketSummary[] =>
  allTickets.filter((ticket) => ticket.ticketType === "feature" && ticket.parentEpicId === epicId);

export const tasksUnderEpic = (epicId: string, allTickets: readonly TicketSummary[]): TicketSummary[] =>
  collectTasksUnderEpic(epicId, allTickets);

export const featureTasksAreComplete = (featureId: string, allTickets: readonly TicketSummary[]): boolean => {
  const tasks = tasksUnderFeature(featureId, allTickets);
  return tasks.every(isTaskCompleted);
};

export const epicTreeHasNoPendingTasks = (epicId: string, allTickets: readonly TicketSummary[]): boolean => {
  const tasks = tasksUnderEpic(epicId, allTickets);
  return tasks.every(isTaskCompleted);
};

export const featureCanArchive = (feature: TicketSummary, allTickets: readonly TicketSummary[]): boolean => {
  if (feature.ticketType !== "feature") return false;
  if (!featureTasksAreComplete(feature.id, allTickets)) return false;
  if (feature.parentEpicId) {
    return epicTreeHasNoPendingTasks(feature.parentEpicId, allTickets);
  }
  return true;
};

export const epicCanArchive = (epic: TicketSummary, allTickets: readonly TicketSummary[]): boolean => {
  if (epic.ticketType !== "epic") return false;
  return epicTreeHasNoPendingTasks(epic.id, allTickets);
};

export const showFeatureArchive = (feature: TicketSummary, columnId: string, allTickets: readonly TicketSummary[]): boolean =>
  completedColumnArchivable(columnId) && featureCanArchive(feature, allTickets);

export const showEpicArchive = (epic: TicketSummary, columnId: string, allTickets: readonly TicketSummary[]): boolean =>
  completedColumnArchivable(columnId) && epicCanArchive(epic, allTickets);

export const taskCanArchive = (task: TicketSummary): boolean =>
  task.ticketType === "task" && task.status === RELAY_COMPLETED_STATUS;

export const showTaskArchive = (task: TicketSummary, columnId: string): boolean =>
  completedColumnArchivable(columnId) && taskCanArchive(task);

const isCompletedContainer = (ticket: TicketSummary): boolean =>
  (ticket.ticketType === "feature" || ticket.ticketType === "epic") && ticket.status === RELAY_COMPLETED_STATUS;

export const archivableCompletedEpics = (allTickets: readonly TicketSummary[]): TicketSummary[] =>
  allTickets.filter(
    (ticket) => ticket.ticketType === "epic" && isCompletedContainer(ticket) && epicCanArchive(ticket, allTickets)
  );

export const archivableCompletedFeatures = (
  allTickets: readonly TicketSummary[],
  archivableEpicIds: ReadonlySet<string>
): TicketSummary[] =>
  allTickets.filter((ticket) => {
    if (!isCompletedContainer(ticket) || ticket.ticketType !== "feature") return false;
    if (!featureCanArchive(ticket, allTickets)) return false;
    if (ticket.parentEpicId && archivableEpicIds.has(ticket.parentEpicId)) return false;
    return true;
  });

/** Bundle ids for every completed epic/feature that is ready to archive, deduped and bottom-up sorted. */
export const archiveAllCompletedContainerBundleIds = (allTickets: readonly TicketSummary[]): string[] => {
  const epics = archivableCompletedEpics(allTickets);
  const epicIds = new Set(epics.map((epic) => epic.id));
  const features = archivableCompletedFeatures(allTickets, epicIds);
  const bundleIds = new Set<string>();
  for (const epic of epics) {
    for (const ticketId of archiveBundleForEpic(epic.id, allTickets)) {
      bundleIds.add(ticketId);
    }
  }
  for (const feature of features) {
    for (const ticketId of archiveBundleForFeature(feature.id, allTickets)) {
      bundleIds.add(ticketId);
    }
  }
  return sortArchiveBundleIds([...bundleIds], allTickets);
};

export const ARCHIVE_TICKET_UPDATE_REQUEST =
  "Archive this completed ticket with a lean summary for long-term storage.";

/** Internal label applied while a completed ticket waits in Ready for archive processing. */
export const PENDING_ARCHIVE_LABEL = "relay:archive-queue";

export const ticketHasPendingArchiveLabel = (ticket: Pick<TicketSummary, "labels">): boolean =>
  ticket.labels.includes(PENDING_ARCHIVE_LABEL);

/** Completed tickets, or tickets queued or actively archiving. */
export const ticketEligibleForArchiveRun = (ticket: Pick<TicketSummary, "status" | "labels">): boolean =>
  ticket.status === RELAY_COMPLETED_STATUS ||
  (ticketHasPendingArchiveLabel(ticket) &&
    (ticket.status === RELAY_READY_STATUS || ticket.status === RELAY_IN_PROGRESS_STATUS));

export const withPendingArchiveLabel = (labels: readonly string[]): string[] => [
  ...labels.filter((label) => label !== PENDING_ARCHIVE_LABEL),
  PENDING_ARCHIVE_LABEL
];

export const withoutPendingArchiveLabel = (labels: readonly string[]): string[] =>
  labels.filter((label) => label !== PENDING_ARCHIVE_LABEL);

const archiveBundleTypeOrder: Record<TicketSummary["ticketType"], number> = {
  task: 0,
  feature: 1,
  epic: 2,
  draft_ticket: 3
};

export const sortArchiveBundleIds = (bundleIds: string[], allTickets: readonly TicketSummary[]): string[] => {
  const byId = new Map(allTickets.map((ticket) => [ticket.id, ticket]));
  return [...new Set(bundleIds)].sort((leftId, rightId) => {
    const leftOrder = archiveBundleTypeOrder[byId.get(leftId)?.ticketType ?? "task"];
    const rightOrder = archiveBundleTypeOrder[byId.get(rightId)?.ticketType ?? "task"];
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return leftId.localeCompare(rightId);
  });
};

export const archiveBundleForFeature = (featureId: string, allTickets: readonly TicketSummary[]): string[] => {
  const feature = allTickets.find((ticket) => ticket.id === featureId && ticket.ticketType === "feature");
  if (!feature) return [];
  return [featureId, ...tasksUnderFeature(featureId, allTickets).map((task) => task.id)];
};

export const archiveBundleForEpic = (epicId: string, allTickets: readonly TicketSummary[]): string[] => {
  const epic = allTickets.find((ticket) => ticket.id === epicId && ticket.ticketType === "epic");
  if (!epic) return [];
  const ids = new Set<string>([epicId]);
  for (const feature of featuresUnderEpic(epicId, allTickets)) {
    for (const ticketId of archiveBundleForFeature(feature.id, allTickets)) {
      ids.add(ticketId);
    }
  }
  for (const task of allTickets) {
    if (task.ticketType === "task" && task.parentEpicId === epicId && !task.parentFeatureId) {
      ids.add(task.id);
    }
  }
  return [...ids];
};

export const archiveTargetStatus = (): typeof RELAY_ARCHIVE_STATUS => RELAY_ARCHIVE_STATUS;

export type DetailArchiveTarget = {
  canArchive: boolean;
  bundleIds: string[];
  blockedMessage: string;
  successMessage: string;
};

export const resolveDetailArchiveTarget = (
  ticketSummary: TicketSummary | undefined,
  allTickets: readonly TicketSummary[],
  options: { archiveStatusAvailable: boolean; ticketStatus: string }
): DetailArchiveTarget | null => {
  const { archiveStatusAvailable, ticketStatus } = options;
  if (!ticketSummary || !archiveStatusAvailable || ticketStatus !== RELAY_COMPLETED_STATUS) {
    return null;
  }

  if (ticketSummary.ticketType === "feature") {
    return {
      canArchive: featureCanArchive(ticketSummary, allTickets),
      bundleIds: archiveBundleForFeature(ticketSummary.id, allTickets),
      blockedMessage: ticketSummary.parentEpicId
        ? "Complete every task under this feature and epic before archiving."
        : "Complete every task under this feature before archiving.",
      successMessage: "Container and child tickets archived."
    };
  }

  if (ticketSummary.ticketType === "epic") {
    return {
      canArchive: epicCanArchive(ticketSummary, allTickets),
      bundleIds: archiveBundleForEpic(ticketSummary.id, allTickets),
      blockedMessage: "Complete every task under this epic before archiving.",
      successMessage: "Container and child tickets archived."
    };
  }

  if (ticketSummary.ticketType === "task") {
    return {
      canArchive: taskCanArchive(ticketSummary),
      bundleIds: [ticketSummary.id],
      blockedMessage: "Only completed tasks can be archived.",
      successMessage: `Archived ${ticketSummary.title}.`
    };
  }

  return null;
};
