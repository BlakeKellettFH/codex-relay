import { collectTasksUnderEpic, collectTasksUnderFeature } from "./boardDragDrop";
import { RELAY_ARCHIVE_STATUS, RELAY_COMPLETED_STATUS } from "@shared/schemas";
import type { TicketSummary } from "@shared/schemas";

export const completedColumnArchivable = (columnId: string): boolean => columnId === RELAY_COMPLETED_STATUS;

export const isTaskCompleted = (ticket: TicketSummary): boolean =>
  ticket.ticketType === "task" && ticket.status === RELAY_COMPLETED_STATUS;

export const tasksUnderFeature = (featureId: string, allTickets: TicketSummary[]): TicketSummary[] =>
  collectTasksUnderFeature(featureId, allTickets);

export const featuresUnderEpic = (epicId: string, allTickets: TicketSummary[]): TicketSummary[] =>
  allTickets.filter((ticket) => ticket.ticketType === "feature" && ticket.parentEpicId === epicId);

export const tasksUnderEpic = (epicId: string, allTickets: TicketSummary[]): TicketSummary[] =>
  collectTasksUnderEpic(epicId, allTickets);

export const featureTasksAreComplete = (featureId: string, allTickets: TicketSummary[]): boolean => {
  const tasks = tasksUnderFeature(featureId, allTickets);
  return tasks.every(isTaskCompleted);
};

export const epicTreeHasNoPendingTasks = (epicId: string, allTickets: TicketSummary[]): boolean => {
  const tasks = tasksUnderEpic(epicId, allTickets);
  return tasks.every(isTaskCompleted);
};

export const featureCanArchive = (feature: TicketSummary, allTickets: TicketSummary[]): boolean => {
  if (feature.ticketType !== "feature") return false;
  if (!featureTasksAreComplete(feature.id, allTickets)) return false;
  if (feature.parentEpicId) {
    return epicTreeHasNoPendingTasks(feature.parentEpicId, allTickets);
  }
  return true;
};

export const epicCanArchive = (epic: TicketSummary, allTickets: TicketSummary[]): boolean => {
  if (epic.ticketType !== "epic") return false;
  return epicTreeHasNoPendingTasks(epic.id, allTickets);
};

export const showFeatureArchive = (feature: TicketSummary, columnId: string, allTickets: TicketSummary[]): boolean =>
  completedColumnArchivable(columnId) && featureCanArchive(feature, allTickets);

export const showEpicArchive = (epic: TicketSummary, columnId: string, allTickets: TicketSummary[]): boolean =>
  completedColumnArchivable(columnId) && epicCanArchive(epic, allTickets);

export const archiveBundleForFeature = (featureId: string, allTickets: TicketSummary[]): string[] => {
  const feature = allTickets.find((ticket) => ticket.id === featureId && ticket.ticketType === "feature");
  if (!feature) return [];
  return [featureId, ...tasksUnderFeature(featureId, allTickets).map((task) => task.id)];
};

export const archiveBundleForEpic = (epicId: string, allTickets: TicketSummary[]): string[] => {
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
