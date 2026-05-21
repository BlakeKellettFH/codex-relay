import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardTaskCardLeading } from "../src/renderer/src/components/BoardTaskCardLeading";
import { BoardTaskActiveSpinner } from "../src/renderer/src/components/BoardTaskActiveSpinner";
import { FeatureBoardGroup } from "../src/renderer/src/components/FeatureBoardGroup";
import { HierarchyBoardGroupTrigger } from "../src/renderer/src/components/HierarchyBoardGroupTrigger";
import {
  boardTaskActiveLabel,
  groupHasActiveChildTask,
  showBoardDraftTicketSpinner,
  showBoardTaskActiveSpinner
} from "../src/renderer/src/lib/boardTaskProgress";
import type { RelayColumn } from "../src/shared/schemas";
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

test("showBoardDraftTicketSpinner is false when draft_ticket waits for user answers", () => {
  const awaitingAnswers = ticket({
    id: "draft_1",
    title: "Draft: Auth",
    ticketType: "draft_ticket",
    status: "needs_clarification",
    runStatus: "blocked",
    authoringState: "needs_input"
  });

  assert.equal(showBoardDraftTicketSpinner(awaitingAnswers), false);
  assert.equal(showBoardTaskActiveSpinner(awaitingAnswers), false);

  const markup = renderToStaticMarkup(
    <BoardTaskCardLeading ticket={awaitingAnswers} draggable={false} moveAriaLabel="Move Draft: Auth" />
  );
  assert.doesNotMatch(markup, /board-task-active-spinner/);
});

test("showBoardDraftTicketSpinner is true while draft_ticket is drafting or queued", () => {
  const drafting = ticket({
    id: "draft_2",
    title: "Draft: Auth",
    ticketType: "draft_ticket",
    status: "todo",
    runStatus: "drafting",
    authoringState: "drafting"
  });
  const queued = ticket({
    id: "draft_3",
    title: "Draft: Billing",
    ticketType: "draft_ticket",
    status: "needs_clarification",
    runStatus: "queued",
    authoringState: "drafting"
  });

  assert.equal(showBoardDraftTicketSpinner(drafting), true);
  assert.equal(showBoardDraftTicketSpinner(queued), true);
  assert.equal(showBoardTaskActiveSpinner(drafting), true);
  assert.match(boardTaskActiveLabel(drafting), /drafting in progress/);

  const markup = renderToStaticMarkup(
    <BoardTaskCardLeading ticket={drafting} draggable={false} moveAriaLabel="Move Draft: Auth" />
  );
  assert.match(markup, /board-task-active-spinner/);
});

test("showBoardTaskActiveSpinner is true only for active tasks in In Progress", () => {
  const running = ticket({
    id: "task_1",
    title: "Run",
    ticketType: "task",
    status: "in_progress",
    runStatus: "running",
    lastRunId: "run_1"
  });
  const todo = ticket({ id: "task_2", title: "Todo", ticketType: "task", status: "todo", runStatus: "running", lastRunId: "run_2" });

  assert.equal(showBoardTaskActiveSpinner(running), true);
  assert.equal(showBoardTaskActiveSpinner(todo), false);
});

test("board task active spinner renders loader in marker slot", () => {
  const markup = renderToStaticMarkup(
    <BoardTaskActiveSpinner
      ticket={ticket({
        id: "task_1",
        title: "Auth",
        ticketType: "task",
        status: "in_progress",
        runStatus: "running",
        lastRunId: "run_1"
      })}
    />
  );

  assert.match(markup, /board-task-active-spinner/);
  assert.match(markup, /\bspin\b/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /agent work in progress/);
  assert.equal(boardTaskActiveLabel({ title: "Auth", runStatus: "running" }), "Auth: agent work in progress");
});

test("board task card leading shows spinner instead of move control in In Progress", () => {
  const running = ticket({
    id: "task_1",
    title: "Run",
    ticketType: "task",
    status: "in_progress",
    runStatus: "running",
    lastRunId: "run_1"
  });

  const spinnerMarkup = renderToStaticMarkup(
    <BoardTaskCardLeading ticket={running} draggable={false} moveAriaLabel="Move Run" />
  );
  assert.match(spinnerMarkup, /board-task-active-spinner/);
  assert.doesNotMatch(spinnerMarkup, /board-drag-marker-draggable/);

  const moveMarkup = renderToStaticMarkup(
    <BoardTaskCardLeading
      ticket={ticket({ id: "task_2", title: "Todo", ticketType: "task", status: "todo" })}
      draggable
      moveAriaLabel="Move Todo"
      setActivatorNodeRef={() => undefined}
    />
  );
  assert.match(moveMarkup, /board-drag-marker-draggable/);
  assert.doesNotMatch(moveMarkup, /board-task-active-spinner/);
});

const columns: RelayColumn[] = [
  { id: "todo", name: "Todo", position: 1000, terminal: false },
  { id: "in_progress", name: "In Progress", position: 2000, terminal: false }
];

test("groupHasActiveChildTask detects running tasks in In Progress", () => {
  const running = ticket({
    id: "task_1",
    title: "Run",
    ticketType: "task",
    status: "in_progress",
    runStatus: "running",
    lastRunId: "run_1"
  });
  const todo = ticket({ id: "task_2", title: "Todo", ticketType: "task", status: "todo", runStatus: "running", lastRunId: "run_2" });

  assert.equal(groupHasActiveChildTask([running]), true);
  assert.equal(groupHasActiveChildTask([todo]), false);
});

test("hierarchy board trigger shows active-child spinner between marker and expand", () => {
  const markup = renderToStaticMarkup(
    <HierarchyBoardGroupTrigger
      triggerClassName="feature-board-group-trigger"
      marker={{ letter: "A", color: "#339af0", backgroundColor: "rgb(51 154 240 / 22%)" }}
      activeChildTask
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
    />
  );

  const markerIndex = markup.indexOf("board-drag-marker");
  const spinnerIndex = markup.indexOf("hierarchy-board-group-active-spinner");
  const expandIndex = markup.indexOf("hierarchy-board-group-expand");
  assert.match(markup, /card-title/);
  assert.ok(markerIndex >= 0 && spinnerIndex > markerIndex && expandIndex > spinnerIndex);
});

test("feature board group shows hierarchy spinner when a nested task is running", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature", status: "todo" });
  const runningTask = ticket({
    id: "task_1",
    title: "Login",
    ticketType: "task",
    status: "in_progress",
    runStatus: "running",
    lastRunId: "run_1",
    parentFeatureId: "feat_1"
  });

  const markup = renderToStaticMarkup(
    <FeatureBoardGroup
      feature={feature}
      tasks={[runningTask]}
      allTickets={[feature, runningTask]}
      columns={columns}
      columnId="in_progress"
      selectedTicketId={null}
      onOpenFeature={() => undefined}
      onOpenTask={() => undefined}
      onTicketFocus={() => undefined}
      onTicketButtonRef={() => undefined}
      now={Date.now()}
    />
  );

  assert.match(markup, /hierarchy-board-group-active-spinner/);
});
