import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLUMNS,
  RELAY_COMPLETED_STATUS,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_TODO_STATUS,
  type TicketSummary
} from "../src/shared/schemas";
import {
  acceptBundleForEpic,
  acceptBundleForFeature,
  epicEligibleForBulkAccept,
  featureEligibleForBulkAccept,
  showEpicBulkAccept,
  showFeatureBulkAccept,
  sortAcceptBundleIds
} from "../src/domain/boardAccept";

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

test("featureEligibleForBulkAccept requires review container and review-or-terminal tasks", () => {
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_REVIEW_STATUS
  });
  const reviewTask = ticket({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: RELAY_REVIEW_STATUS,
    parentFeatureId: "feat_1"
  });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_1"
  });
  const openTask = ticket({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: RELAY_IN_PROGRESS_STATUS,
    parentFeatureId: "feat_1"
  });

  const readyTickets = [feature, reviewTask, doneTask];
  assert.equal(featureEligibleForBulkAccept(feature, readyTickets, DEFAULT_COLUMNS), true);

  const blockedTickets = [feature, reviewTask, openTask];
  assert.equal(featureEligibleForBulkAccept(feature, blockedTickets, DEFAULT_COLUMNS), false);

  const todoFeature = ticket({ ...feature, status: RELAY_TODO_STATUS });
  assert.equal(featureEligibleForBulkAccept(todoFeature, readyTickets, DEFAULT_COLUMNS), false);
});

test("acceptBundleForFeature includes only review tasks and container last", () => {
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_REVIEW_STATUS
  });
  const reviewTask = ticket({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: RELAY_REVIEW_STATUS,
    parentFeatureId: "feat_1"
  });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_1"
  });
  const allTickets = [feature, reviewTask, doneTask];

  assert.deepEqual(acceptBundleForFeature("feat_1", allTickets, DEFAULT_COLUMNS), ["task_review", "feat_1"]);
});

test("epicEligibleForBulkAccept blocks open tasks and requires review-or-completed features", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_REVIEW_STATUS });
  const featureReview = ticket({
    id: "feat_review",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_REVIEW_STATUS,
    parentEpicId: "epic_1"
  });
  const featureDone = ticket({
    id: "feat_done",
    title: "Billing",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
    parentEpicId: "epic_1"
  });
  const reviewTask = ticket({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: RELAY_REVIEW_STATUS,
    parentFeatureId: "feat_review",
    parentEpicId: "epic_1"
  });
  const openTask = ticket({
    id: "task_open",
    title: "Open",
    ticketType: "task",
    status: RELAY_TODO_STATUS,
    parentFeatureId: "feat_done",
    parentEpicId: "epic_1"
  });

  const readyTickets = [epic, featureReview, featureDone, reviewTask];
  assert.equal(epicEligibleForBulkAccept(epic, readyTickets, DEFAULT_COLUMNS), true);

  const blockedTickets = [epic, featureReview, featureDone, reviewTask, openTask];
  assert.equal(epicEligibleForBulkAccept(epic, blockedTickets, DEFAULT_COLUMNS), false);

  const openFeature = ticket({
    id: "feat_open",
    title: "Search",
    ticketType: "feature",
    status: RELAY_TODO_STATUS,
    parentEpicId: "epic_1"
  });
  assert.equal(
    epicEligibleForBulkAccept(epic, [...readyTickets, openFeature], DEFAULT_COLUMNS),
    false
  );
});

test("acceptBundleForEpic includes nested review tickets, review features, and epic last", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_REVIEW_STATUS });
  const featureReview = ticket({
    id: "feat_review",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_REVIEW_STATUS,
    parentEpicId: "epic_1"
  });
  const featureDone = ticket({
    id: "feat_done",
    title: "Billing",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
    parentEpicId: "epic_1"
  });
  const reviewTask = ticket({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: RELAY_REVIEW_STATUS,
    parentFeatureId: "feat_review",
    parentEpicId: "epic_1"
  });
  const doneTask = ticket({
    id: "task_done",
    title: "Done",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS,
    parentFeatureId: "feat_done",
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, featureReview, featureDone, reviewTask, doneTask];

  assert.deepEqual(acceptBundleForEpic("epic_1", allTickets, DEFAULT_COLUMNS), ["task_review", "feat_review", "epic_1"]);
});

test("sortAcceptBundleIds accepts tasks before features before epics", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_REVIEW_STATUS });
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_REVIEW_STATUS,
    parentEpicId: "epic_1"
  });
  const task = ticket({
    id: "task_1",
    title: "Task",
    ticketType: "task",
    status: RELAY_REVIEW_STATUS,
    parentFeatureId: "feat_1",
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, feature, task];

  assert.deepEqual(sortAcceptBundleIds(["epic_1", "feat_1", "task_1"], allTickets), [
    "task_1",
    "feat_1",
    "epic_1"
  ]);
});

test("show bulk accept only for review containers in the review column", () => {
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_REVIEW_STATUS
  });
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_REVIEW_STATUS });
  assert.equal(showFeatureBulkAccept(feature, RELAY_REVIEW_STATUS, [feature], DEFAULT_COLUMNS), true);
  assert.equal(showEpicBulkAccept(epic, RELAY_REVIEW_STATUS, [epic], DEFAULT_COLUMNS), true);
  assert.equal(showFeatureBulkAccept(feature, RELAY_COMPLETED_STATUS, [feature], DEFAULT_COLUMNS), false);
});

test("show feature bulk accept in review column when children are ready but feature is still in todo", () => {
  const feature = ticket({
    id: "feat_1",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_TODO_STATUS
  });
  const reviewTask = ticket({
    id: "task_review",
    title: "Review",
    ticketType: "task",
    status: RELAY_REVIEW_STATUS,
    parentFeatureId: "feat_1"
  });
  const allTickets = [feature, reviewTask];
  assert.equal(showFeatureBulkAccept(feature, RELAY_REVIEW_STATUS, allTickets, DEFAULT_COLUMNS), true);
  assert.deepEqual(acceptBundleForFeature("feat_1", allTickets, DEFAULT_COLUMNS), ["task_review", "feat_1"]);
});
