import test from "node:test";
import assert from "node:assert/strict";
import { getRepositoryChatShellState } from "../src/renderer/src/App";
import { DEFAULT_COLUMNS, type BoardSnapshot } from "../src/shared/schemas";

const projectPath = "/tmp/relay-repository-chat-project";

const board: BoardSnapshot = {
  project: {
    projectId: "prj_repository_chat",
    name: "Repository Chat Project",
    path: projectPath,
    exists: true,
    isGitRepository: true,
    relayInitialized: true,
    health: "ok",
    healthMessages: [],
    activeRunCount: 0,
    swimlanes: []
  },
  config: null,
  columns: DEFAULT_COLUMNS,
  tickets: [],
  invalidTickets: []
};

test("repository chat shell state restores the board baseline after open then close", () => {
  const baseline = getRepositoryChatShellState({
    board,
    selectedPath: projectPath,
    repositoryChatOpen: false
  });
  const opened = getRepositoryChatShellState({
    board,
    selectedPath: projectPath,
    repositoryChatOpen: true
  });
  const restored = getRepositoryChatShellState({
    board,
    selectedPath: projectPath,
    repositoryChatOpen: false
  });

  assert.deepEqual(baseline, {
    repositoryChatActive: false,
    repositoryChatPanelVisible: false
  });
  assert.deepEqual(opened, {
    repositoryChatActive: true,
    repositoryChatPanelVisible: true
  });
  assert.deepEqual(restored, baseline);
});

test("repository chat shell state never keeps chat layout active without board context", () => {
  assert.deepEqual(
    getRepositoryChatShellState({
      board: null,
      selectedPath: projectPath,
      repositoryChatOpen: true
    }),
    {
      repositoryChatActive: false,
      repositoryChatPanelVisible: false
    }
  );

  assert.deepEqual(
    getRepositoryChatShellState({
      board,
      selectedPath: null,
      repositoryChatOpen: true
    }),
    {
      repositoryChatActive: false,
      repositoryChatPanelVisible: false
    }
  );
});
