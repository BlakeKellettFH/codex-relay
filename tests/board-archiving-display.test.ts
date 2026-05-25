import test from "node:test";
import assert from "node:assert/strict";
import { RELAY_IN_PROGRESS_STATUS, RELAY_READY_STATUS } from "../src/shared/schemas/board";
import { PENDING_ARCHIVE_LABEL } from "../src/renderer/src/lib/boardArchive";
import { boardTaskActiveLabel, showBoardTaskActiveSpinner } from "../src/renderer/src/lib/boardTaskProgress";
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

test("ready queued archive tickets do not show a spinner until processing starts", () => {
  const archiveReady = ticket({
    id: "task_1",
    title: "Done",
    ticketType: "task",
    status: RELAY_READY_STATUS,
    runStatus: "queued",
    labels: [PENDING_ARCHIVE_LABEL],
    lastRunId: "run_archive_1"
  });

  assert.equal(showBoardTaskActiveSpinner(archiveReady), false);
  assert.equal(boardTaskActiveLabel(archiveReady), "Done: queued for archive");
});

test("archive tickets show a spinner in In Progress while the agent runs", () => {
  const archiveProcessing = ticket({
    id: "task_2",
    title: "Done",
    ticketType: "task",
    status: RELAY_IN_PROGRESS_STATUS,
    runStatus: "running",
    labels: [PENDING_ARCHIVE_LABEL],
    lastRunId: "run_archive_2"
  });

  assert.equal(showBoardTaskActiveSpinner(archiveProcessing), true);
  assert.equal(boardTaskActiveLabel(archiveProcessing), "Done: archiving in progress");
});
