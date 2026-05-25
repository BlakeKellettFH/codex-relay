import test from "node:test";
import assert from "node:assert/strict";
import {
  boardVisibleColumns,
  RELAY_ARCHIVE_STATUS,
  RELAY_COMPLETED_STATUS
} from "../src/shared/schemas/board";
import {
  archiveAllCompletedContainerBundleIds,
  archiveBundleForEpic,
  archiveBundleForFeature,
  archivableCompletedEpics,
  archivableCompletedFeatures,
  epicCanArchive,
  featureCanArchive,
  showEpicArchive,
  showFeatureArchive,
  sortArchiveBundleIds
} from "../src/renderer/src/lib/boardArchive";
import type { TicketSummary } from "../src/shared/schemas";

const ticket = (patch: Partial<TicketSummary> & Pick<TicketSummary, "id" | "title" | "ticketType" | "status">): TicketSummary => ({
  schemaVersion: 1,
  position: 1000,
  priority: "medium",
  effort: "medium",
  labels: [],
  parentEpicId: null,
  parentFeatureId: null,
  subticketIds: [],
  plannedFiles: [],
  blockedByIds: [],
  relatedTicketIds: [],
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
  authoringState: "ready",
  codexThreadId: null,
  runStatus: "idle",
  lastRunId: null,
  lastRunStartedAt: null,
  excerpt: "",
  summary: "",
  filePath: `/tmp/${patch.id}.md`,
  checklist: { total: 0, completed: 0, open: 0 },
  ...patch
});

test("boardVisibleColumns hides archive lane from the board", () => {
  const columns = [
    { id: "todo", name: "Todo", position: 1000, terminal: false },
    { id: RELAY_COMPLETED_STATUS, name: "Completed", position: 7000, terminal: true },
    { id: RELAY_ARCHIVE_STATUS, name: "Archive", position: 8000, terminal: true }
  ];
  assert.deepEqual(boardVisibleColumns(columns).map((column) => column.id), ["todo", RELAY_COMPLETED_STATUS]);
});

test("feature cannot archive while sibling feature still has pending tasks", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const featureA = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: "todo",
    parentEpicId: "epic_1"
  });
  const featureB = ticket({
    id: "feat_b",
    title: "Billing",
    ticketType: "feature",
    status: "todo",
    parentEpicId: "epic_1"
  });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const pendingTask = ticket({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: "todo",
    parentFeatureId: "feat_b",
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, featureA, featureB, doneTask, pendingTask];

  assert.equal(featureCanArchive(featureA, allTickets), false);
  assert.equal(showFeatureArchive(featureA, RELAY_COMPLETED_STATUS, allTickets), false);
});

test("feature can archive when its tasks and epic tree are complete", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: "todo",
    parentEpicId: "epic_1"
  });
  const task = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, feature, task];

  assert.equal(featureCanArchive(feature, allTickets), true);
  assert.equal(showFeatureArchive(feature, RELAY_COMPLETED_STATUS, allTickets), true);
  assert.deepEqual(archiveBundleForFeature("feat_a", allTickets), ["feat_a", "task_done"]);
});

test("epic can archive only when every descendant task is complete", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: "todo",
    parentEpicId: "epic_1"
  });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const pendingTask = ticket({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: "in_progress",
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });

  const incompleteTickets = [epic, feature, doneTask, pendingTask];
  assert.equal(epicCanArchive(epic, incompleteTickets), false);

  const completeTickets = [epic, feature, doneTask];
  assert.equal(epicCanArchive(epic, completeTickets), true);
  assert.equal(showEpicArchive(epic, RELAY_COMPLETED_STATUS, completeTickets), true);
  assert.deepEqual(archiveBundleForEpic("epic_1", completeTickets).sort(), ["epic_1", "feat_a", "task_done"].sort());
});

test("sortArchiveBundleIds archives tasks before features and epics", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: "todo",
    parentEpicId: "epic_1"
  });
  const task = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, feature, task];

  assert.deepEqual(sortArchiveBundleIds(["epic_1", "feat_a", "task_done"], allTickets), [
    "task_done",
    "feat_a",
    "epic_1"
  ]);
});

test("archiveAllCompletedContainerBundleIds archives completed epics and standalone features", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_COMPLETED_STATUS });
  const featureUnderEpic = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
    parentEpicId: "epic_1"
  });
  const standaloneFeature = ticket({
    id: "feat_solo",
    title: "Ops",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS
  });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const soloTask = ticket({
    id: "task_solo",
    title: "Solo done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_solo"
  });
  const pendingTask = ticket({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: "todo",
    parentFeatureId: "feat_blocked",
    parentEpicId: "epic_1"
  });
  const blockedFeature = ticket({
    id: "feat_blocked",
    title: "Blocked",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, featureUnderEpic, standaloneFeature, doneTask, soloTask, pendingTask, blockedFeature];

  assert.equal(archivableCompletedEpics(allTickets).length, 0);
  assert.deepEqual(
    archivableCompletedFeatures(allTickets, new Set()).map((ticket) => ticket.id),
    ["feat_solo"]
  );

  const completeEpicTree = [epic, featureUnderEpic, doneTask, standaloneFeature, soloTask];
  assert.equal(archivableCompletedEpics(completeEpicTree).length, 1);
  assert.equal(archivableCompletedFeatures(completeEpicTree, new Set(["epic_1"])).length, 1);
  assert.deepEqual(archiveAllCompletedContainerBundleIds(completeEpicTree), [
    "task_done",
    "task_solo",
    "feat_a",
    "feat_solo",
    "epic_1"
  ]);
});
