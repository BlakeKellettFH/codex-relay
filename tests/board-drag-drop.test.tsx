import test from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DndContext } from "@dnd-kit/core";
import { BoardHierarchyVisualProvider } from "../src/renderer/src/components/BoardHierarchyVisualContext";
import { HierarchyBoardGroupTrigger } from "../src/renderer/src/components/HierarchyBoardGroupTrigger";
import { FeatureBoardGroup } from "../src/renderer/src/components/FeatureBoardGroup";
import {
  boardDragAllowsNotDoingDrop,
  boardDragId,
  columnAcceptsBoardDrop,
  collectTasksUnderEpic,
  collectTasksUnderFeature,
  epicScopeFullyNotDoing,
  featureScopeFullyNotDoing,
  parseBoardDragId,
  parseBoardDropColumnId,
  prepareTaskForNotDoing,
  resolveDragTasks,
  taskHasActiveAgentWork,
  tasksEligibleForReadyQueue,
  tasksForNotDoingDrop,
  tasksForTodoRestore,
  validateRestoreDragToTodo,
  validateReviewDragToCompleted
} from "../src/renderer/src/lib/boardDragDrop";
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
  { id: "review", name: "Review", position: 4000, terminal: false },
  { id: "not_doing", name: "Not Doing", position: 1600, terminal: true },
  { id: "completed", name: "Completed", position: 5000, terminal: true }
];

const wrapDnd = (node: ReactElement, tickets: TicketSummary[] = []): ReactElement => (
  <BoardHierarchyVisualProvider tickets={tickets}>
    <DndContext>{node}</DndContext>
  </BoardHierarchyVisualProvider>
);

test("boardDragAllowsNotDoingDrop is limited to feature and epic drags", () => {
  assert.equal(boardDragAllowsNotDoingDrop({ kind: "task", ticketId: "task_1" }), false);
  assert.equal(boardDragAllowsNotDoingDrop({ kind: "feature", featureId: "feat_1" }), true);
  assert.equal(boardDragAllowsNotDoingDrop({ kind: "epic", epicId: "epic_1" }), true);
  assert.equal(boardDragAllowsNotDoingDrop(null), false);
});

test("board drag ids parse task, feature, epic, and drop columns", () => {
  assert.deepEqual(parseBoardDragId("task:task_1"), { kind: "task", ticketId: "task_1" });
  assert.deepEqual(parseBoardDragId("feature:feat_1"), { kind: "feature", featureId: "feat_1" });
  assert.deepEqual(parseBoardDragId("epic:epic_1"), { kind: "epic", epicId: "epic_1" });
  assert.equal(parseBoardDropColumnId(boardDragId.column("ready")), "ready");
  assert.equal(parseBoardDropColumnId(boardDragId.column("not_doing")), "not_doing");
  assert.equal(parseBoardDropColumnId(boardDragId.column("todo")), "todo");
  assert.equal(parseBoardDropColumnId(boardDragId.column("completed")), "completed");
});

test("columnAcceptsBoardDrop routes todo restore and ready/not-doing queue targets", () => {
  const task = { kind: "task" as const, ticketId: "task_1" };
  const feature = { kind: "feature" as const, featureId: "feat_1" };

  assert.equal(columnAcceptsBoardDrop("todo", task, "not_doing"), true);
  assert.equal(columnAcceptsBoardDrop("ready", task, "not_doing"), false);
  assert.equal(columnAcceptsBoardDrop("ready", task, "todo"), true);
  assert.equal(columnAcceptsBoardDrop("not_doing", task, "todo"), false);
  assert.equal(columnAcceptsBoardDrop("not_doing", feature, "todo"), true);
  assert.equal(columnAcceptsBoardDrop("todo", feature, "todo"), false);
});

test("columnAcceptsBoardDrop routes review accept drops to completed", () => {
  const task = { kind: "task" as const, ticketId: "task_1" };
  const feature = { kind: "feature" as const, featureId: "feat_1" };

  assert.equal(columnAcceptsBoardDrop("completed", task, "review"), true);
  assert.equal(columnAcceptsBoardDrop("completed", feature, "review"), true);
  assert.equal(columnAcceptsBoardDrop("ready", task, "review"), false);
  assert.equal(columnAcceptsBoardDrop("todo", task, "review"), false);
  assert.equal(columnAcceptsBoardDrop("completed", task, "todo"), false);
});

test("validateReviewDragToCompleted requires review tasks and ready containers", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "review" });
  const reviewTask = ticket({
    id: "task_review",
    title: "Login",
    ticketType: "task",
    status: "review",
    parentFeatureId: "feat_1"
  });
  const todoTask = ticket({
    id: "task_todo",
    title: "Signup",
    ticketType: "task",
    status: "todo",
    parentFeatureId: "feat_1"
  });
  const allTickets = [feature, reviewTask, todoTask];

  assert.deepEqual(validateReviewDragToCompleted({ kind: "task", ticketId: "task_review" }, allTickets, columns), {
    ok: true
  });
  assert.deepEqual(validateReviewDragToCompleted({ kind: "task", ticketId: "task_todo" }, allTickets, columns), {
    ok: false,
    message: "Only tickets in Review can be accepted."
  });
  assert.deepEqual(validateReviewDragToCompleted({ kind: "feature", featureId: "feat_1" }, allTickets, columns), {
    ok: true
  });
});

test("validateRestoreDragToTodo enforces epic and feature hierarchy", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const featureA = ticket({ id: "feat_a", title: "Auth", ticketType: "feature", status: "todo", parentEpicId: "epic_1" });
  const featureB = ticket({ id: "feat_b", title: "Billing", ticketType: "feature", status: "todo", parentEpicId: "epic_1" });
  const taskA = ticket({
    id: "task_a",
    title: "Login",
    ticketType: "task",
    status: "not_doing",
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const taskB = ticket({
    id: "task_b",
    title: "Pay",
    ticketType: "task",
    status: "not_doing",
    parentFeatureId: "feat_b",
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, featureA, featureB, taskA, taskB];

  assert.equal(epicScopeFullyNotDoing("epic_1", allTickets), true);
  assert.equal(featureScopeFullyNotDoing("feat_a", allTickets), true);

  assert.deepEqual(validateRestoreDragToTodo({ kind: "task", ticketId: "task_a" }, allTickets), {
    ok: false,
    message: "Move the epic to Todo to restore this work."
  });
  assert.deepEqual(validateRestoreDragToTodo({ kind: "feature", featureId: "feat_a" }, allTickets), {
    ok: false,
    message: "This feature is under a deferred epic. Move the epic to Todo first."
  });
  assert.deepEqual(validateRestoreDragToTodo({ kind: "epic", epicId: "epic_1" }, allTickets), { ok: true });
  assert.deepEqual(tasksForTodoRestore(resolveDragTasks({ kind: "epic", epicId: "epic_1" }, allTickets)).map((entry) => entry.id).sort(), [
    "task_a",
    "task_b"
  ]);
});

test("validateRestoreDragToTodo allows feature restore when epic is not fully deferred", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const feature = ticket({ id: "feat_a", title: "Auth", ticketType: "feature", status: "todo", parentEpicId: "epic_1" });
  const deferredTask = ticket({
    id: "task_a",
    title: "Login",
    ticketType: "task",
    status: "not_doing",
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const activeTask = ticket({
    id: "task_b",
    title: "Signup",
    ticketType: "task",
    status: "todo",
    parentFeatureId: "feat_a",
    parentEpicId: "epic_1"
  });
  const allTickets = [epic, feature, deferredTask, activeTask];

  assert.equal(epicScopeFullyNotDoing("epic_1", allTickets), false);
  assert.equal(featureScopeFullyNotDoing("feat_a", allTickets), false);

  assert.deepEqual(validateRestoreDragToTodo({ kind: "task", ticketId: "task_a" }, allTickets), { ok: true });
  assert.deepEqual(validateRestoreDragToTodo({ kind: "feature", featureId: "feat_a" }, allTickets), { ok: true });
});

test("collectTasksUnderFeature and collectTasksUnderEpic include tasks in any column", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo" });
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic", status: "todo" });
  const todoTask = ticket({
    id: "task_todo",
    title: "Todo child",
    ticketType: "task",
    status: "todo",
    parentFeatureId: "feat_1"
  });
  const readyTask = ticket({
    id: "task_ready",
    title: "Ready child",
    ticketType: "task",
    status: "ready",
    parentFeatureId: "feat_1"
  });
  const epicTask = ticket({
    id: "task_epic",
    title: "Epic child",
    ticketType: "task",
    status: "in_progress",
    parentEpicId: "epic_1"
  });
  const allTickets = [feature, epic, todoTask, readyTask, epicTask];

  assert.deepEqual(collectTasksUnderFeature("feat_1", allTickets).map((entry) => entry.id).sort(), ["task_ready", "task_todo"]);
  assert.deepEqual(collectTasksUnderEpic("epic_1", allTickets).map((entry) => entry.id), ["task_epic"]);
  assert.deepEqual(resolveDragTasks({ kind: "feature", featureId: "feat_1" }, allTickets).map((entry) => entry.id).sort(), [
    "task_ready",
    "task_todo"
  ]);
});

test("tasksEligibleForReadyQueue and tasksForNotDoingDrop filter correctly", () => {
  const movable = ticket({ id: "task_move", title: "Move", ticketType: "task", status: "todo" });
  const blocked = ticket({
    id: "task_block",
    title: "Blocked",
    ticketType: "task",
    status: "todo",
    blockedByIds: ["blocker"]
  });
  const blocker = ticket({ id: "blocker", title: "Blocker", ticketType: "task", status: "todo" });
  const running = ticket({
    id: "task_run",
    title: "Running",
    ticketType: "task",
    status: "in_progress",
    runStatus: "running",
    lastRunId: "run_1"
  });
  const terminal = ticket({ id: "task_done", title: "Done", ticketType: "task", status: "completed" });
  const notDoing = ticket({ id: "task_skip", title: "Skipped", ticketType: "task", status: "not_doing" });
  const allTickets = [movable, blocked, blocker, running, terminal, notDoing];

  assert.deepEqual(
    tasksEligibleForReadyQueue([movable, blocked, running], columns, allTickets).map((entry) => entry.id).sort(),
    ["task_block", "task_move"]
  );
  assert.deepEqual(tasksForNotDoingDrop([movable, terminal, notDoing, running]).map((entry) => entry.id).sort(), [
    "task_move",
    "task_run"
  ]);
});

test("taskHasActiveAgentWork detects active run statuses with lastRunId", () => {
  assert.equal(
    taskHasActiveAgentWork(
      ticket({ id: "t1", title: "Run", ticketType: "task", status: "in_progress", runStatus: "running", lastRunId: "run_1" })
    ),
    true
  );
  assert.equal(
    taskHasActiveAgentWork(ticket({ id: "t2", title: "Idle", ticketType: "task", status: "todo", runStatus: "idle" })),
    false
  );
});

test("prepareTaskForNotDoing cancels active runs with revert then moves ticket", async () => {
  const calls: string[] = [];
  const active = ticket({
    id: "task_active",
    title: "Active",
    ticketType: "task",
    status: "in_progress",
    runStatus: "running",
    lastRunId: "run_1"
  });

  await prepareTaskForNotDoing({
    projectPath: "/tmp/project",
    ticket: active,
    cancelRun: async () => {
      calls.push("cancel");
      return { outcome: "discarded" as const, revertMessage: null };
    },
    moveTicket: async () => {
      calls.push("move");
      return {
        project: {
          path: "/tmp/project",
          name: "p",
          projectId: null,
          activeRunCount: 0,
          healthMessages: [],
          swimlanes: [],
          health: "ok",
          codexStatus: null,
          lastOpenedAt: null
        },
        columns: [],
        tickets: [],
        invalidTickets: [],
        config: null
      };
    }
  });

  assert.deepEqual(calls, ["cancel", "move"]);
});

test("hierarchy board trigger uses colored marker button as drag handle when draggable", () => {
  const markup = renderToStaticMarkup(
    wrapDnd(
      <HierarchyBoardGroupTrigger
        triggerClassName="feature-board-group-trigger"
        marker={{ letter: "B", color: "#8fb8ff", backgroundColor: "rgb(143 184 255 / 18%)" }}
        title="Auth"
        meta="2 tasks"
        labels={[]}
        expanded={false}
        onToggle={() => undefined}
        onOpen={() => undefined}
        openAriaLabel="Open feature"
        openTitle="Open feature"
        expandAriaLabel="Expand"
        collapseAriaLabel="Collapse"
        dragId={boardDragId.feature("feat_1")}
        draggable
        setDragActivatorNodeRef={() => undefined}
      />
    )
  );

  assert.doesNotMatch(markup, /hierarchy-board-group-action/);
  assert.doesNotMatch(markup, /GripVertical/);
  assert.match(markup, /data-drag-id="feature:feat_1"/);
  assert.match(markup, /board-drag-marker-draggable/);
  assert.match(markup, /Move Auth to Ready or Not Doing/);
  assert.match(markup, /<button[^>]*class="[^"]*board-drag-marker[^"]*"/);
  assert.doesNotMatch(markup, /hierarchy-board-group-open[^>]*aria-describedby/);
});

test("hierarchy board trigger renders colored marker as decorative span when not draggable", () => {
  const markup = renderToStaticMarkup(
    wrapDnd(
      <HierarchyBoardGroupTrigger
        triggerClassName="feature-board-group-trigger"
        marker={{ letter: "B", color: "#8fb8ff", backgroundColor: "rgb(143 184 255 / 18%)" }}
        title="Auth"
        meta="2 tasks"
        labels={[]}
        expanded={false}
        onToggle={() => undefined}
        onOpen={() => undefined}
        openAriaLabel="Open feature"
        openTitle="Open feature"
        expandAriaLabel="Expand"
        collapseAriaLabel="Collapse"
      />
    )
  );

  assert.match(markup, /board-drag-marker/);
  assert.match(markup, /card-title/);
  assert.match(markup, />B</);
  assert.doesNotMatch(markup, /board-drag-marker-draggable/);
  assert.doesNotMatch(markup, /board-drag-marker-task/);
});

test("feature board group in todo column shows colored feature marker and neutral task drag handle", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo" });
  const task = ticket({
    id: "task_1",
    title: "Login",
    ticketType: "task",
    status: "todo",
    parentFeatureId: "feat_1"
  });

  const markup = renderToStaticMarkup(
    wrapDnd(
      <FeatureBoardGroup
        feature={feature}
        tasks={[task]}
        allTickets={[feature, task]}
        columns={columns}
        columnId="todo"
        selectedTicketId={null}
        onOpenFeature={() => undefined}
        onOpenTask={() => undefined}
        onTicketFocus={() => undefined}
        onTicketButtonRef={() => undefined}
        now={Date.now()}
      />,
      [feature, task]
    )
  );

  assert.doesNotMatch(markup, /board-ticket-quick-action/);
  assert.doesNotMatch(markup, /hierarchy-board-group-action/);
  assert.doesNotMatch(markup, /GripVertical/);
  assert.match(markup, /data-drag-id="feature:feat_1"/);
  assert.match(markup, /board-drag-marker-draggable/);
  assert.match(markup, /data-drag-id="task:task_1"/);
  assert.match(markup, /Move (Auth to Ready or Not Doing|Login to Ready)/);
  assert.match(markup, /board-drag-marker-task/);
  assert.match(markup, /<svg[^>]*aria-hidden="true"/);
});
