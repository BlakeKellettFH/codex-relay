import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearRepositoryChat,
  readRepositoryChat,
  saveRepositoryChat
} from "../src/storage/filesystem";

test("repository chat store round-trips through .relay/repository-chat.json", async () => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "relay-repository-chat-store-"));
  const relayDirectory = path.join(projectPath, ".relay");
  await mkdir(relayDirectory, { recursive: true });
  await writeFile(
    path.join(relayDirectory, "project.json"),
    JSON.stringify({
      schemaVersion: 1,
      projectId: "prj_test",
      name: "Test",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      columns: [],
      settings: {}
    }),
    "utf8"
  );

  try {
    const empty = await readRepositoryChat(projectPath);
    assert.deepEqual(empty.messages, []);
    assert.equal(empty.draft, "");
    assert.equal(empty.threadId, null);

    const saved = await saveRepositoryChat(projectPath, {
      schemaVersion: 1,
      threadId: "cursor::thread-1",
      messages: [
        { id: "user-1", role: "user", text: "Where is the board?" },
        { id: "assistant-1", role: "assistant", text: "In BoardView." }
      ],
      draft: "Follow up question"
    });
    assert.equal(saved.threadId, "cursor::thread-1");
    assert.equal(saved.messages.length, 2);

    const loaded = await readRepositoryChat(projectPath);
    assert.equal(loaded.threadId, "cursor::thread-1");
    assert.equal(loaded.draft, "Follow up question");
    assert.deepEqual(loaded.messages, saved.messages);

    const cleared = await clearRepositoryChat(projectPath);
    assert.deepEqual(cleared.messages, []);
    assert.equal(cleared.draft, "");
    assert.equal(cleared.threadId, null);
    assert.deepEqual(await readRepositoryChat(projectPath), cleared);
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
});
