import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { RELAY_COMPLETED_STATUS } from "../src/shared/schemas/board";
import { BoardArchiveButton } from "../src/renderer/src/components/BoardArchiveButton";
import { BoardTaskCardLeading } from "../src/renderer/src/components/BoardTaskCardLeading";
import { HierarchyBoardGroupTrigger } from "../src/renderer/src/components/HierarchyBoardGroupTrigger";
import { showTaskArchive, sortArchiveBundleIds } from "../src/renderer/src/lib/boardArchive";
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
