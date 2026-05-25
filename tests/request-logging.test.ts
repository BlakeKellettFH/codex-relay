import test from "node:test";
import assert from "node:assert/strict";
import {
  REPOSITORY_CHAT_AUTOSAVE_PATH,
  shouldLogApiRequestAtInfo
} from "../src/http/middleware/requestLogging";

test("repository-chat autosave PUT is not logged at INFO", () => {
  assert.equal(REPOSITORY_CHAT_AUTOSAVE_PATH, "/api/projects/repository-chat");
  assert.equal(shouldLogApiRequestAtInfo("PUT", REPOSITORY_CHAT_AUTOSAVE_PATH), false);
});

test("other repository-chat methods still log at INFO", () => {
  assert.equal(shouldLogApiRequestAtInfo("GET", REPOSITORY_CHAT_AUTOSAVE_PATH), true);
  assert.equal(shouldLogApiRequestAtInfo("POST", REPOSITORY_CHAT_AUTOSAVE_PATH), true);
});

test("other API paths still log at INFO", () => {
  assert.equal(shouldLogApiRequestAtInfo("PUT", "/api/projects/summary"), true);
  assert.equal(shouldLogApiRequestAtInfo("GET", "/api/projects/summary"), true);
});
