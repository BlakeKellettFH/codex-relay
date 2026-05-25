import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PROJECT_CONTEXT_PER_FILE_MAX_CHARS,
  PROJECT_CONTEXT_TOTAL_MAX_CHARS,
  formatProjectContextPromptSection,
  loadProjectContextDocuments
} from "../src/services/project-context";
import { buildExecutionInput } from "../src/services/codex";

const writeContextFile = async (contextDirectory: string, filename: string, content: string): Promise<void> => {
  await writeFile(path.join(contextDirectory, filename), content, "utf8");
};

const createContextFixture = async (files: Record<string, string>): Promise<string> => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "relay-project-context-"));
  const contextDirectory = path.join(projectPath, ".relay", "context");
  await mkdir(contextDirectory, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    await writeContextFile(contextDirectory, filename, content);
  }
  return projectPath;
};

test("loadProjectContextDocuments returns sorted injectable markdown files", async () => {
  const projectPath = await createContextFixture({
    "zebra.md": "Zebra rules.",
    "alpha.md": "Alpha rules.",
    "README.md": "Do not inject README.",
    "notes.txt": "Ignore non-markdown files."
  });

  try {
    const documents = await loadProjectContextDocuments(projectPath);
    assert.deepEqual(
      documents.map((document) => document.filename),
      ["alpha.md", "zebra.md"]
    );
    assert.equal(documents[0]?.content, "Alpha rules.");
    assert.equal(documents[1]?.content, "Zebra rules.");
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});

test("formatProjectContextPromptSection returns empty when context is missing or not injectable", async () => {
  const missingDirectoryProject = await mkdtemp(path.join(os.tmpdir(), "relay-project-context-missing-"));
  const readmeOnlyProject = await createContextFixture({
    "README.md": "Bootstrap instructions only."
  });

  try {
    assert.equal(await formatProjectContextPromptSection(missingDirectoryProject), "");
    assert.equal(await formatProjectContextPromptSection(readmeOnlyProject), "");
    assert.deepEqual(await loadProjectContextDocuments(readmeOnlyProject), []);
  } finally {
    await rm(missingDirectoryProject, { force: true, recursive: true });
    await rm(readmeOnlyProject, { force: true, recursive: true });
  }
});

test("project context helpers can target a specific markdown rule file", async () => {
  const projectPath = await createContextFixture({
    "chat.md": "Keep repository chat brief.",
    "drafting.md": "Drafting rules live here."
  });

  try {
    const documents = await loadProjectContextDocuments(projectPath, { filenames: ["chat.md"] });
    assert.deepEqual(
      documents.map((document) => document.filename),
      ["chat.md"]
    );

    const section = await formatProjectContextPromptSection(projectPath, {
      filenames: ["chat.md"],
      header: "Repository chat rules:"
    });
    assert.match(section, /^Repository chat rules:/);
    assert.match(section, /## chat\.md/);
    assert.doesNotMatch(section, /## drafting\.md/);
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});

test("formatProjectContextPromptSection truncates oversized files and enforces total budget", async () => {
  const oversizedContent = "x".repeat(PROJECT_CONTEXT_PER_FILE_MAX_CHARS + 500);
  const fillsBudget = "y".repeat(PROJECT_CONTEXT_TOTAL_MAX_CHARS);
  const projectPath = await createContextFixture({
    "first.md": oversizedContent,
    "second.md": fillsBudget,
    "third.md": "This file should not fit in the total budget."
  });

  try {
    const documents = await loadProjectContextDocuments(projectPath);
    assert.equal(documents[0]?.content.length, PROJECT_CONTEXT_PER_FILE_MAX_CHARS);
    assert.match(documents[0]?.content ?? "", /\.\.\.$/);

    const section = await formatProjectContextPromptSection(projectPath);
    assert.match(section, /^Project context \(from \.relay\/context\/\):/);
    assert.match(section, /## first\.md/);
    assert.match(section, /## second\.md/);
    assert.doesNotMatch(section, /## third\.md/);
    assert.doesNotMatch(section, /README/);
    assert.match(section, /\.\.\.$/);

    const firstBody = section.split("## first.md\n\n")[1]?.split("\n\n## ")[0] ?? "";
    const secondBody = section.split("## second.md\n\n")[1] ?? "";
    assert.equal(firstBody.length, PROJECT_CONTEXT_PER_FILE_MAX_CHARS);
    assert.ok(firstBody.length + secondBody.length <= PROJECT_CONTEXT_TOTAL_MAX_CHARS);
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});

const executionPromptText = (input: Awaited<ReturnType<typeof buildExecutionInput>>): string =>
  typeof input === "string" ? input : input.find((part) => part.type === "text")?.text ?? "";

test("buildExecutionInput includes project context and excludes README", async () => {
  const projectPath = await createContextFixture({
    "README.md": "Do not inject README.",
    "conventions.md": "Prefer explicit return types in TypeScript."
  });

  try {
    const input = await buildExecutionInput(projectPath, "# Example ticket\n\nImplement the feature.", [], []);
    const prompt = executionPromptText(input);

    assert.match(prompt, /Project context \(from \.relay\/context\/\):/);
    assert.match(prompt, /## conventions\.md/);
    assert.match(prompt, /Prefer explicit return types/);
    assert.match(prompt, /Follow project context unless this ticket explicitly overrides it\./);
    assert.doesNotMatch(prompt, /Do not inject README/);
    assert.doesNotMatch(prompt, /## README\.md/);
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});
