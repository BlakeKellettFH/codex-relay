import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveRepositoryChatHydrationAction,
  shouldMarkRepositoryChatUserEditedBeforeHydration
} from "../src/renderer/src/App";

const projectPath = "/tmp/relay-repository-chat-hydration";

test("repository chat hydration applies server store when local draft exists but user has not edited", () => {
  assert.equal(
    resolveRepositoryChatHydrationAction({
      hydratedProjectPath: null,
      projectPath,
      querySuccess: true,
      userEditedBeforeHydration: false,
      streaming: false,
      messageCount: 0,
      threadId: null
    }),
    "apply_store"
  );
});

test("repository chat hydration skips server apply after intentional edit before hydration completes", () => {
  assert.equal(
    resolveRepositoryChatHydrationAction({
      hydratedProjectPath: null,
      projectPath,
      querySuccess: true,
      userEditedBeforeHydration: true,
      streaming: false,
      messageCount: 0,
      threadId: null
    }),
    "skip_local"
  );
});

test("repository chat user-edited flag is set only after query success and before persist is ready", () => {
  assert.equal(
    shouldMarkRepositoryChatUserEditedBeforeHydration({
      persistReady: false,
      querySuccess: false
    }),
    false
  );
  assert.equal(
    shouldMarkRepositoryChatUserEditedBeforeHydration({
      persistReady: false,
      querySuccess: true
    }),
    true
  );
  assert.equal(
    shouldMarkRepositoryChatUserEditedBeforeHydration({
      persistReady: true,
      querySuccess: true
    }),
    false
  );
});

test("repository chat hydration does not re-run for the same project path", () => {
  assert.equal(
    resolveRepositoryChatHydrationAction({
      hydratedProjectPath: projectPath,
      projectPath,
      querySuccess: true,
      userEditedBeforeHydration: false,
      streaming: false,
      messageCount: 0,
      threadId: null
    }),
    "already_hydrated"
  );
});
