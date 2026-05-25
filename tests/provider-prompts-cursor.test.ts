import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadProjectContextRelativeMarkdown } from "../src/services/project-context";
import {
  CURSOR_TICKET_DRAFT_CONTEXT_RELATIVE_PATH,
  appendCursorTicketDraftPromptGuidance,
  resolveCursorTicketDraftResponsePromptSection
} from "../src/services/provider-prompts/cursor";

const writeRelativeContextFile = async (
  projectPath: string,
  relativePath: string,
  content: string
): Promise<void> => {
  const filePath = path.join(projectPath, ".relay", "context", relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
};

test("loadProjectContextRelativeMarkdown reads nested cursor context files", async () => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "relay-provider-prompts-"));

  try {
    assert.equal(await loadProjectContextRelativeMarkdown(projectPath, "cursor/draft-ticket.md"), null);
    await writeRelativeContextFile(projectPath, "cursor/draft-ticket.md", "# Custom Cursor draft guide\n\nUse feature ticketType.");
    const loaded = await loadProjectContextRelativeMarkdown(projectPath, "cursor/draft-ticket.md");
    assert.match(loaded ?? "", /Custom Cursor draft guide/);
    assert.equal(await loadProjectContextRelativeMarkdown(projectPath, "../secrets.md"), null);
    assert.equal(await loadProjectContextRelativeMarkdown(projectPath, "notes.txt"), null);
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});

test("resolveCursorTicketDraftResponsePromptSection prefers project file over bundled default", async () => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "relay-cursor-draft-prompt-"));

  try {
    const bundled = await resolveCursorTicketDraftResponsePromptSection(projectPath);
    assert.match(bundled, /Required JSON response for Cursor CLI/);
    assert.match(bundled, /ticketType/);

    await writeRelativeContextFile(
      projectPath,
      CURSOR_TICKET_DRAFT_CONTEXT_RELATIVE_PATH,
      "# Project override\n\nReturn leanTasks with plannedFiles."
    );
    const overridden = await resolveCursorTicketDraftResponsePromptSection(projectPath);
    assert.match(overridden, /Project override/);
    assert.doesNotMatch(overridden, /Add health check endpoint/);
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});

test("appendCursorTicketDraftPromptGuidance appends response guide and JSON schema", async () => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "relay-cursor-append-"));

  try {
    const output = await appendCursorTicketDraftPromptGuidance("Base drafting prompt.", projectPath, {
      type: "object",
      required: ["draftState"]
    });
    assert.match(output, /^Base drafting prompt\./);
    assert.match(output, /Required JSON response for Cursor CLI/);
    assert.match(output, /JSON Schema \(all required keys/);
    assert.match(output, /"draftState"/);
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});
