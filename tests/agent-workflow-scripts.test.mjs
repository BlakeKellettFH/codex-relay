import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import {
  addClarificationQuestion,
  buildWorktreePlan,
  DEFAULT_WORKFLOW_CONFIG,
  raiseNeedsClarification,
  readMergeQueue,
  renderReviewSummary,
  sanitizeTicketRef,
  slugify,
  upsertMergeQueueItem
} from "../scripts/relay-agent-workflow-lib.mjs";

const withTempProject = async (fn) => {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "relay-agent-workflow-"));
  await fs.mkdir(path.join(projectPath, ".relay", "tickets"), { recursive: true });
  await fs.mkdir(path.join(projectPath, ".relay", "clarifications"), { recursive: true });
  try {
    await fn(projectPath);
  } finally {
    await fs.rm(projectPath, { recursive: true, force: true });
  }
};

test("worktree plan uses ticket ref and slugged title", async () => {
  await withTempProject(async (projectPath) => {
    const ticketId = "tkt_example";
    const ticketPath = path.join(projectPath, ".relay", "tickets", `${ticketId}.md`);
    await fs.writeFile(
      ticketPath,
      matter.stringify("# Test ticket\n", {
        schemaVersion: 1,
        id: ticketId,
        title: "Archive completed tasks safely",
        ticketType: "task",
        status: "ready",
        position: 1000,
        priority: "medium",
        effort: "medium",
        labels: [],
        parentEpicId: null,
        parentFeatureId: null,
        subticketIds: [],
        plannedFiles: ["src/example.ts"],
        blockedByIds: [],
        relatedTicketIds: [],
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z",
        authoringState: "ready",
        summary: "",
        codexThreadId: null,
        runStatus: "idle",
        lastRunId: null,
        lastRunStartedAt: null
      }),
      "utf8"
    );

    const plan = await buildWorktreePlan({
      projectPath,
      ticketId,
      ticketRef: "MYT-123",
      config: DEFAULT_WORKFLOW_CONFIG
    });

    assert.equal(plan.branchName, "agent/MYT-123-archive-completed-tasks-safely");
    assert.equal(path.basename(plan.worktreePath), `${path.basename(projectPath)}-MYT-123`);
  });
});

test("merge queue upsert creates and updates queue entries", async () => {
  await withTempProject(async (projectPath) => {
    await upsertMergeQueueItem(projectPath, {
      ticketId: "tkt_queue",
      ticketRef: "MYT-222",
      ticketTitle: "Queue item",
      branchName: "agent/MYT-222-queue-item",
      featureWorktreePath: "/tmp/worktree",
      baseBranch: "main",
      testCommand: "npm test",
      mergeStrategy: "rebase",
      status: "queued"
    });
    await upsertMergeQueueItem(projectPath, {
      ticketId: "tkt_queue",
      status: "ready_to_merge",
      reportPath: "/tmp/report.md"
    });

    const queue = await readMergeQueue(projectPath);
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0].status, "ready_to_merge");
    assert.equal(queue.items[0].reportPath, "/tmp/report.md");
  });
});

test("raising clarification updates ticket status and writes a pending question", async () => {
  await withTempProject(async (projectPath) => {
    const ticketId = "tkt_clarify";
    const ticketPath = path.join(projectPath, ".relay", "tickets", `${ticketId}.md`);
    await fs.writeFile(
      ticketPath,
      matter.stringify("# Clarify me\n", {
        schemaVersion: 1,
        id: ticketId,
        title: "Clarify me",
        ticketType: "task",
        status: "review",
        position: 1000,
        priority: "medium",
        effort: "medium",
        labels: [],
        parentEpicId: null,
        parentFeatureId: null,
        subticketIds: [],
        plannedFiles: ["src/example.ts"],
        blockedByIds: [],
        relatedTicketIds: [],
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z",
        authoringState: "ready",
        summary: "",
        codexThreadId: null,
        runStatus: "completed",
        lastRunId: null,
        lastRunStartedAt: null
      }),
      "utf8"
    );

    await raiseNeedsClarification(projectPath, ticketId, "Please review the merge conflict report.");
    const updatedTicket = matter(await fs.readFile(ticketPath, "utf8"));
    const clarificationStore = JSON.parse(
      await fs.readFile(path.join(projectPath, ".relay", "clarifications", `${ticketId}.json`), "utf8")
    );

    assert.equal(updatedTicket.data.status, "needs_clarification");
    assert.equal(updatedTicket.data.runStatus, "blocked");
    assert.equal(clarificationStore.questions.length, 1);
    assert.equal(clarificationStore.questions[0].question, "Please review the merge conflict report.");
  });
});

test("workflow helpers sanitize refs, de-duplicate clarifications, and render summaries", async () => {
  await withTempProject(async (projectPath) => {
    assert.equal(slugify("Hello, World!"), "hello-world");
    assert.equal(sanitizeTicketRef("MYT  123"), "MYT-123");

    const question = await addClarificationQuestion(projectPath, "tkt_dup", "Question?");
    const duplicate = await addClarificationQuestion(projectPath, "tkt_dup", "Question?");
    assert.equal(question.id, duplicate.id);

    const summary = renderReviewSummary({
      ticketId: "tkt_dup",
      ticketTitle: "Dup",
      branchName: "agent/MYT-1-dup",
      worktreePath: "/tmp/dup",
      baseBranch: "main",
      changedFiles: ["src/example.ts"],
      reason: "Minimal change.",
      testsRun: ["npm test"],
      knownRisks: ["Need smoke test"],
      followUpWork: ["Add e2e coverage"]
    });

    assert.match(summary, /Files Changed/);
    assert.match(summary, /src\/example\.ts/);
    assert.match(summary, /Add e2e coverage/);
  });
});
