import test from "node:test";
import assert from "node:assert/strict";
import {
  REPOSITORY_CHAT_PERSIST_DEBOUNCE_MS,
  createRepositoryChatPersist,
  repositoryChatStoreSignature
} from "../src/renderer/src/lib/repositoryChatPersist";
import type { RepositoryChatMessage } from "../src/shared/schemas";

const projectPath = "/tmp/relay-repository-chat-persist";
const baseMessages: RepositoryChatMessage[] = [
  { id: "user-1", role: "user", text: "Hello" },
  { id: "assistant-1", role: "assistant", text: "Hi there" }
];

const snapshot = (draft: string) => ({
  projectPath,
  threadId: "cursor::thread-1" as string | null,
  messages: baseMessages,
  draft
});

test("repository chat store signature ignores message ordering differences only by serialized content", () => {
  const first = repositoryChatStoreSignature(snapshot("draft-a"));
  const second = repositoryChatStoreSignature(snapshot("draft-a"));
  const third = repositoryChatStoreSignature(snapshot("draft-b"));

  assert.equal(first, second);
  assert.notEqual(first, third);
});

test("repository chat persist debounce constant is 1800ms", () => {
  assert.equal(REPOSITORY_CHAT_PERSIST_DEBOUNCE_MS, 1800);
});

test("scheduleRepositoryChatPersist saves at most once per debounce window", () => {
  const saved: string[] = [];
  let now = 0;
  const timers = new Map<number, () => void>();
  const persist = createRepositoryChatPersist({
    debounceMs: 1800,
    mutate: (input) => {
      saved.push(input.draft);
    },
    schedule: (callback, delayMs) => {
      now += delayMs;
      const timeoutId = now;
      timers.set(timeoutId, callback);
      return timeoutId as ReturnType<typeof setTimeout>;
    },
    clearSchedule: (timeoutId) => {
      timers.delete(timeoutId as number);
    }
  });

  persist.setRuntime({ ready: true, hydratedProjectPath: projectPath, lastPersistedSignature: null });
  persist.syncSnapshot(snapshot("one"));

  persist.scheduleRepositoryChatPersist();
  persist.syncSnapshot(snapshot("two"));
  persist.scheduleRepositoryChatPersist();
  persist.syncSnapshot(snapshot("three"));
  persist.scheduleRepositoryChatPersist();

  assert.equal(saved.length, 0);
  timers.get(now)?.();
  assert.deepEqual(saved, ["three"]);
});

test("flushRepositoryChatPersist cancels pending debounce and saves immediately", () => {
  const saved: string[] = [];
  let scheduled: (() => void) | null = null;
  const persist = createRepositoryChatPersist({
    debounceMs: 1800,
    mutate: (input) => {
      saved.push(input.draft);
    },
    schedule: (callback) => {
      scheduled = callback;
      return 1 as ReturnType<typeof setTimeout>;
    },
    clearSchedule: () => {
      scheduled = null;
    }
  });

  persist.setRuntime({ ready: true, hydratedProjectPath: projectPath, lastPersistedSignature: null });
  persist.syncSnapshot(snapshot("pending"));
  persist.scheduleRepositoryChatPersist();
  persist.flushRepositoryChatPersist();

  assert.deepEqual(saved, ["pending"]);
  assert.equal(scheduled, null);
});

test("flushRepositoryChatPersist uses latest snapshot refs and skips duplicate signatures", () => {
  const saved: string[] = [];
  const persist = createRepositoryChatPersist({
    mutate: (input) => {
      saved.push(input.draft);
    }
  });

  persist.setRuntime({ ready: true, hydratedProjectPath: projectPath, lastPersistedSignature: null });
  persist.syncSnapshot(snapshot("draft"));
  persist.flushRepositoryChatPersist();
  persist.flushRepositoryChatPersist();

  assert.deepEqual(saved, ["draft"]);
});

test("repository chat persist does not save before ready or hydration", () => {
  const saved: string[] = [];
  const persist = createRepositoryChatPersist({
    mutate: (input) => {
      saved.push(input.draft);
    }
  });

  persist.syncSnapshot(snapshot("draft"));
  persist.flushRepositoryChatPersist();
  assert.deepEqual(saved, []);

  persist.setRuntime({ ready: true, hydratedProjectPath: "/other-project", lastPersistedSignature: null });
  persist.flushRepositoryChatPersist();
  assert.deepEqual(saved, []);
});
