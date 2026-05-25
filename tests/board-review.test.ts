import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLUMNS,
  RELAY_COMPLETED_STATUS,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_NOT_DOING_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_TODO_STATUS,
  type BoardSnapshot,
  type TicketSummary
} from "../src/shared/schemas";
import {
  epicReadyForReview,
  featureReadyForReview,
  isTerminalTaskStatus,
  linkedTasksForFeature,
  resolveEpicContainerStatus,
  resolveFeatureContainerStatus
} from "../src/domain/boardReview";
import { maybePromoteOrDemoteContainers } from "../src/storage/boardReconciliation";

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

const boardSnapshot = (tickets: TicketSummary[]): BoardSnapshot => ({
  project: {
    schemaVersion: 1,
    path: "/tmp/project",
    name: "Project",
    health: "ok",
    ticketCount: tickets.length,
    swimlanes: []
  },
  config: null,
  columns: DEFAULT_COLUMNS,
  tickets,
  invalidTickets: []
});

test("isTerminalTaskStatus treats completed, not_doing, archive, and terminal columns as terminal", () => {
  const columns = [
    ...DEFAULT_COLUMNS,
    { id: "blocked_done", name: "Blocked Done", position: 6500, terminal: true }
  ];
  assert.equal(isTerminalTaskStatus(RELAY_COMPLETED_STATUS, columns), true);
  assert.equal(isTerminalTaskStatus(RELAY_NOT_DOING_STATUS, columns), true);
  assert.equal(isTerminalTaskStatus("blocked_done", columns), true);
  assert.equal(isTerminalTaskStatus(RELAY_IN_PROGRESS_STATUS, columns), false);
});

test("linkedTasksForFeature merges subticketIds and parentFeatureId matches", () => {
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_TODO_STATUS,
    subticketIds: ["task_a"]
  });
  const listed = ticket({
    id: "task_a",
    title: "Listed",
    ticketType: "task",
    status: RELAY_TODO_STATUS,
    parentFeatureId: "feat_1"
  });
  const linked = ticket({
    id: "task_b",
    title: "Derived",
    ticketType: "task",
    status: RELAY_TODO_STATUS,
    parentFeatureId: "feat_1"
  });
  const tasks = linkedTasksForFeature(feature, [feature, listed, linked]);
  assert.deepEqual(tasks.map((task) => task.id), ["task_a", "task_b"]);
});

test("featureReadyForReview requires at least one linked task and all terminal", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: RELAY_TODO_STATUS });
  const openTask = ticket({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: RELAY_IN_PROGRESS_STATUS,
    parentFeatureId: "feat_1"
  });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_1"
  });
  assert.equal(featureReadyForReview(feature, [feature, openTask], DEFAULT_COLUMNS), false);
  assert.equal(featureReadyForReview(feature, [feature, doneTask], DEFAULT_COLUMNS), true);
  assert.equal(featureReadyForReview(feature, [feature], DEFAULT_COLUMNS), false);
});

test("epicReadyForReview requires every feature completed and every task terminal", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_TODO_STATUS });
  const featureDone = ticket({
    id: "feat_done",
    title: "Done feature",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
    parentEpicId: "epic_1"
  });
  const featureOpen = ticket({
    id: "feat_open",
    title: "Open feature",
    ticketType: "feature",
    status: RELAY_TODO_STATUS,
    parentEpicId: "epic_1"
  });
  const taskDone = ticket({
    id: "task_done",
    title: "Done task",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_done",
    parentEpicId: "epic_1"
  });
  const taskOpen = ticket({
    id: "task_open",
    title: "Open task",
    ticketType: "task",
    status: RELAY_IN_PROGRESS_STATUS,
    parentFeatureId: "feat_done",
    parentEpicId: "epic_1"
  });
  assert.equal(
    epicReadyForReview(epic, [epic, featureDone, taskDone], DEFAULT_COLUMNS),
    true
  );
  assert.equal(
    epicReadyForReview(epic, [epic, featureDone, featureOpen, taskDone, taskOpen], DEFAULT_COLUMNS),
    false
  );
  assert.equal(
    epicReadyForReview(epic, [epic, featureDone, taskOpen], DEFAULT_COLUMNS),
    false
  );
});

test("resolveFeatureContainerStatus promotes to review and demotes from review to todo", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: RELAY_TODO_STATUS });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_1"
  });
  const board = boardSnapshot([feature, doneTask]);
  assert.equal(resolveFeatureContainerStatus(feature, board), RELAY_REVIEW_STATUS);

  const reviewFeature = ticket({ ...feature, status: RELAY_REVIEW_STATUS });
  const openTask = ticket({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: RELAY_TODO_STATUS,
    parentFeatureId: "feat_1"
  });
  assert.equal(
    resolveFeatureContainerStatus(reviewFeature, boardSnapshot([reviewFeature, openTask])),
    RELAY_TODO_STATUS
  );
});

test("resolveEpicContainerStatus demotes epic in review when a feature leaves completed", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_REVIEW_STATUS });
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_TODO_STATUS,
    parentEpicId: "epic_1"
  });
  const task = ticket({
    id: "task_1",
    title: "Task",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_1",
    parentEpicId: "epic_1"
  });
  assert.equal(resolveEpicContainerStatus(epic, boardSnapshot([epic, feature, task])), RELAY_TODO_STATUS);
});

test("maybePromoteOrDemoteContainers is exported for storage integration", () => {
  assert.equal(typeof maybePromoteOrDemoteContainers, "function");
});
