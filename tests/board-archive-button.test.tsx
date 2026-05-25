import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { RELAY_COMPLETED_STATUS } from "../src/shared/schemas/board";
import { BoardArchiveButton } from "../src/renderer/src/components/BoardArchiveButton";
import { BoardTaskCardLeading } from "../src/renderer/src/components/BoardTaskCardLeading";
import { HierarchyBoardGroupTrigger } from "../src/renderer/src/components/HierarchyBoardGroupTrigger";
import {
  archiveBundleForEpic,
  archiveBundleForFeature,
  resolveDetailArchiveTarget,
  showTaskArchive,
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

test("hierarchy group trigger places archive control above expand for containers", () => {
  const markup = renderToStaticMarkup(
    <HierarchyBoardGroupTrigger
      triggerClassName="feature-board-group-trigger"
      marker={{ letter: "A", color: "#339af0", backgroundColor: "rgb(51 154 240 / 22%)" }}
      title="Auth"
      meta="1 task"
      labels={[]}
      expanded={false}
      onToggle={() => undefined}
      onOpen={() => undefined}
      openAriaLabel="Open feature"
      openTitle="Open feature"
      expandAriaLabel="Expand"
      collapseAriaLabel="Collapse"
      showArchive
      onArchive={() => undefined}
    />
  );

  const archiveIndex = markup.indexOf("board-archive-button");
  const expandIndex = markup.indexOf("hierarchy-board-group-expand");
  assert.ok(archiveIndex >= 0 && expandIndex >= 0);
  assert.ok(archiveIndex < expandIndex);
  assert.match(markup, /Archive Auth and child tickets/);
});

test("board archive button component exposes archive label", () => {
  const markup = renderToStaticMarkup(<BoardArchiveButton label="Archive Auth and child tickets" onArchive={() => undefined} />);
  assert.match(markup, /title="Archive"/);
  assert.match(markup, /Archive Auth and child tickets/);
});

test("completed task cards show archive control in the leading slot", () => {
  const task = ticket({
    id: "task_done",
    title: "Ship archive UI",
    ticketType: "task",
    status: RELAY_COMPLETED_STATUS
  });
  assert.equal(showTaskArchive(task, RELAY_COMPLETED_STATUS), true);

  const markup = renderToStaticMarkup(
    <BoardTaskCardLeading
      ticket={task}
      draggable={false}
      showArchive
      onArchive={() => undefined}
      moveAriaLabel="Move Ship archive UI"
    />
  );

  assert.match(markup, /board-archive-button/);
  assert.match(markup, /Archive Ship archive UI/);
});

const detailArchiveOptions = { archiveStatusAvailable: true, ticketStatus: RELAY_COMPLETED_STATUS };

test("detail archive target is absent when container status is not completed", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: "in_progress",
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
  const allTickets = [epic, feature, doneTask];
  const archiveOptions = { archiveStatusAvailable: true };

  assert.equal(
    resolveDetailArchiveTarget(epic, allTickets, { ...archiveOptions, ticketStatus: epic.status }),
    null
  );
  assert.equal(
    resolveDetailArchiveTarget(feature, allTickets, { ...archiveOptions, ticketStatus: feature.status }),
    null
  );
});

test("detail archive target for completed feature is blocked when epic has pending tasks", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_COMPLETED_STATUS });
  const featureA = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
    parentEpicId: "epic_1"
  });
  const featureB = ticket({
    id: "feat_b",
    title: "Billing",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
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

  const target = resolveDetailArchiveTarget(featureA, allTickets, detailArchiveOptions);
  assert.ok(target);
  assert.equal(target.canArchive, false);
  assert.deepEqual(target.bundleIds, archiveBundleForFeature("feat_a", allTickets));
  assert.match(target.blockedMessage, /feature and epic/);
});

test("detail archive target for completed feature can archive when its tree is complete", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_COMPLETED_STATUS });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
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

  const target = resolveDetailArchiveTarget(feature, allTickets, detailArchiveOptions);
  assert.ok(target);
  assert.equal(target.canArchive, true);
  assert.deepEqual(target.bundleIds, archiveBundleForFeature("feat_a", allTickets));
});

test("detail archive target for completed epic can archive when every task is complete", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_COMPLETED_STATUS });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
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
  const allTickets = [epic, feature, doneTask];

  const target = resolveDetailArchiveTarget(epic, allTickets, detailArchiveOptions);
  assert.ok(target);
  assert.equal(target.canArchive, true);
  assert.deepEqual(target.bundleIds.sort(), archiveBundleForEpic("epic_1", allTickets).sort());
});

test("detail archive target for completed epic is blocked when a descendant task is pending", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_COMPLETED_STATUS });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
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
  const allTickets = [epic, feature, doneTask, pendingTask];

  const target = resolveDetailArchiveTarget(epic, allTickets, detailArchiveOptions);
  assert.ok(target);
  assert.equal(target.canArchive, false);
  assert.match(target.blockedMessage, /epic/);
});

test("completed container detail renders archive control when target is present", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: RELAY_COMPLETED_STATUS });
  const feature = ticket({
    id: "feat_a",
    title: "Auth",
    ticketType: "feature",
    status: RELAY_COMPLETED_STATUS,
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
  const target = resolveDetailArchiveTarget(feature, allTickets, detailArchiveOptions);

  assert.ok(target?.canArchive);
  const markup = renderToStaticMarkup(
    target ? <BoardArchiveButton label="Archive Auth and child tickets" onArchive={() => undefined} /> : <span />
  );
  assert.match(markup, /board-archive-button/);
  assert.match(markup, /Archive Auth and child tickets/);
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
