import test from "node:test";
import assert from "node:assert/strict";
import {
  countColumnTicketsForDisplay,
  draftTicketsInColumn,
  epicTasksMovableToReady,
  organizeColumnBoardItems,
  tasksInColumn,
  tasksMovableToReady,
  ticketsForBoardColumn,
  isTaskProcessable,
  isTaskRetryable
} from "../src/renderer/src/lib/boardColumnLayout";
import type { RelayColumn, TicketSummary } from "../src/shared/schemas";

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

const columns: RelayColumn[] = [
  { id: "todo", name: "Todo", position: 1000, terminal: false },
  { id: "ready", name: "Ready", position: 1500, terminal: false },
  { id: "completed", name: "Completed", position: 5000, terminal: true }
];

test("organizeColumnBoardItems nests feature tasks from tasks in column only", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo", position: 1000 });
  const task = ticket({
    id: "task_1",
    title: "Login form",
    ticketType: "task",
    status: "todo",
    position: 1100,
    parentFeatureId: "feat_1"
  });
  const allTickets = [feature, task];

  const items = organizeColumnBoardItems("todo", allTickets);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "feature-group");
  if (items[0]?.kind === "feature-group") {
    assert.equal(items[0].feature.id, "feat_1");
    assert.equal(items[0].tasks.length, 1);
    assert.equal(items[0].tasks[0]?.id, "task_1");
  }
});

test("feature with todo status does not appear when its only task is in ready", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo", position: 1000 });
  const task = ticket({
    id: "task_1",
    title: "Login form",
    ticketType: "task",
    status: "ready",
    position: 1100,
    parentFeatureId: "feat_1"
  });
  const allTickets = [feature, task];

  assert.equal(organizeColumnBoardItems("todo", allTickets).length, 0);
  const readyItems = organizeColumnBoardItems("ready", allTickets);
  assert.equal(readyItems.length, 1);
  assert.equal(readyItems[0]?.kind, "feature-group");
});

test("epic alone in todo does not appear without descendant tasks in column", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo", position: 2000 });
  const items = organizeColumnBoardItems("todo", [epic]);
  assert.equal(items.length, 0);
});

test("organizeColumnBoardItems groups epic header with nested features when tasks are in column", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo", position: 2000, subticketIds: ["feat_1"] });
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: "todo",
    position: 1000,
    parentEpicId: "epic_1",
    subticketIds: ["task_1"]
  });
  const task = ticket({
    id: "task_1",
    title: "Login form",
    ticketType: "task",
    status: "todo",
    position: 1100,
    parentFeatureId: "feat_1"
  });
  const allTickets = [epic, feature, task];

  const items = organizeColumnBoardItems("todo", allTickets);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "epic-group");
  if (items[0]?.kind === "epic-group") {
    assert.equal(items[0].epic.id, "epic_1");
    assert.equal(items[0].featureGroups.length, 1);
    assert.equal(items[0].featureGroups[0]?.feature.id, "feat_1");
    assert.equal(items[0].featureGroups[0]?.tasks[0]?.id, "task_1");
  }
});

test("countColumnTicketsForDisplay counts visible board groups not nested task rows", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo", position: 1000 });
  const task = ticket({
    id: "task_1",
    title: "Login form",
    ticketType: "task",
    status: "todo",
    position: 1100,
    parentFeatureId: "feat_1"
  });
  const allTickets = [feature, task];
  assert.equal(countColumnTicketsForDisplay("todo", allTickets), 1);
});

test("tasksInColumn and ticketsForBoardColumn include parent containers for grouping", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo", position: 1000 });
  const task = ticket({
    id: "task_1",
    title: "Login form",
    ticketType: "task",
    status: "ready",
    position: 1100,
    parentFeatureId: "feat_1"
  });
  const allTickets = [feature, task];

  assert.deepEqual(tasksInColumn("ready", allTickets).map((entry) => entry.id), ["task_1"]);
  const columnTickets = ticketsForBoardColumn("ready", allTickets);
  assert.equal(columnTickets.length, 2);
  assert.ok(columnTickets.some((entry) => entry.id === "feat_1"));
  assert.ok(columnTickets.some((entry) => entry.id === "task_1"));
});

test("organizeColumnBoardItems shows orphan tasks when their feature was deleted", () => {
  const task = ticket({
    id: "task_orphan",
    title: "Orphan task",
    ticketType: "task",
    status: "todo",
    position: 1000,
    parentFeatureId: "feat_missing"
  });
  const items = organizeColumnBoardItems("todo", [task]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "ticket");
  if (items[0]?.kind === "ticket") assert.equal(items[0].ticket.id, "task_orphan");
});

test("isTaskProcessable rejects completed tasks", () => {
  const done = ticket({ id: "task_done", title: "Done", ticketType: "task", status: "completed", position: 1000 });
  assert.equal(isTaskProcessable(done, columns, [done]), false);
  const todo = ticket({ id: "task_todo", title: "Todo task", ticketType: "task", status: "todo", position: 1000 });
  assert.equal(isTaskProcessable(todo, columns, [todo]), true);
});

test("isTaskProcessable rejects tasks awaiting review", () => {
  const review = ticket({ id: "task_review", title: "Awaiting review", ticketType: "task", status: "review", position: 1000 });
  assert.equal(isTaskProcessable(review, columns, [review]), false);
});

test("isTaskProcessable rejects paused implementation tasks", () => {
  const paused = ticket({
    id: "task_paused",
    title: "Paused implementation",
    ticketType: "task",
    status: "in_progress",
    position: 1000,
    runStatus: "paused"
  });
  assert.equal(isTaskProcessable(paused, columns, [paused]), false);
});

test("tasksMovableToReady and epicTasksMovableToReady only include processable todo tasks", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo", position: 1000 });
  const readyTask = ticket({
    id: "task_ready",
    title: "Already ready",
    ticketType: "task",
    status: "todo",
    position: 1100,
    parentFeatureId: "feat_1",
    blockedByIds: ["blocker_1"]
  });
  const movableTask = ticket({
    id: "task_move",
    title: "Movable",
    ticketType: "task",
    status: "todo",
    position: 1200,
    parentFeatureId: "feat_1"
  });
  const blocker = ticket({ id: "blocker_1", title: "Blocker", ticketType: "task", status: "todo", position: 1300 });
  const allTickets = [feature, readyTask, movableTask, blocker];
  const featureGroup = { feature, tasks: [readyTask, movableTask], featureInColumn: true };

  assert.deepEqual(tasksMovableToReady([readyTask, movableTask], columns, allTickets).map((entry) => entry.id), ["task_move"]);
  assert.deepEqual(epicTasksMovableToReady([featureGroup], columns, allTickets).map((entry) => entry.id), ["task_move"]);
});

test("draft_ticket in todo appears as a standalone board card", () => {
  const draft = ticket({
    id: "draft_1",
    title: "Draft: Auth feature",
    ticketType: "draft_ticket",
    draftTargetType: "feature",
    status: "todo",
    position: 1000,
    runStatus: "drafting",
    authoringState: "drafting"
  });
  const items = organizeColumnBoardItems("todo", [draft]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "ticket");
  if (items[0]?.kind === "ticket") assert.equal(items[0].ticket.id, "draft_1");
  assert.equal(countColumnTicketsForDisplay("todo", [draft]), 1);
});

test("draft_ticket in needs_clarification appears on the board", () => {
  const draft = ticket({
    id: "draft_2",
    title: "Draft: Platform epic",
    ticketType: "draft_ticket",
    draftTargetType: "epic",
    status: "needs_clarification",
    position: 1000,
    runStatus: "blocked",
    authoringState: "needs_input"
  });
  const items = organizeColumnBoardItems("needs_clarification", [draft]);
  assert.equal(items.length, 1);
  assert.deepEqual(draftTicketsInColumn("needs_clarification", [draft]).map((entry) => entry.id), ["draft_2"]);
});

test("draft_ticket in ready does not appear on the board", () => {
  const draft = ticket({
    id: "draft_3",
    title: "Draft: Hidden",
    ticketType: "draft_ticket",
    draftTargetType: "task",
    status: "ready",
    position: 1000
  });
  assert.equal(organizeColumnBoardItems("ready", [draft]).length, 0);
});

test("isTaskRetryable allows failed in-progress tasks with a stored thread", () => {
  const retryable = ticket({
    id: "task_failed",
    title: "Failed run",
    ticketType: "task",
    status: "in_progress",
    position: 1000,
    runStatus: "failed",
    codexThreadId: "thread_failed"
  });
  assert.equal(isTaskRetryable(retryable, columns, [retryable]), true);

  const missingThread = ticket({
    id: "task_failed_no_thread",
    title: "Failed without thread",
    ticketType: "task",
    status: "in_progress",
    position: 1100,
    runStatus: "failed"
  });
  assert.equal(isTaskRetryable(missingThread, columns, [missingThread]), false);
});
