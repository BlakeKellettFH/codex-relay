import test from "node:test";
import assert from "node:assert/strict";
import {
  boardVisibleColumns,
  RELAY_ARCHIVE_STATUS,
  RELAY_COMPLETED_STATUS
} from "../src/shared/schemas/board";
import {
  archiveBundleForEpic,
  archiveBundleForFeature,
  epicCanArchive,
  featureCanArchive,
  showEpicArchive,
  showFeatureArchive
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
