import test from "node:test";
import assert from "node:assert/strict";
import type { Path } from "effect";
import * as nodePath from "node:path";
import { resolveAgentRunArtifactPaths } from "../src/services/agents/agentRunDebug";

const testPath: Path.Path = {
  join: nodePath.join,
  resolve: nodePath.resolve,
  relative: nodePath.relative,
  dirname: nodePath.dirname,
  basename: nodePath.basename,
  split: (value: string) => value.split(nodePath.sep),
  sep: nodePath.sep
} as Path.Path;

test("places ticket draft artifacts under runs/{ticketId}/", () => {
  const resolved = resolveAgentRunArtifactPaths(testPath, "/repo", {
    projectPath: "/repo",
    kind: "ticket.draft",
    providerId: "cursor",
    ticketId: "tkt_abc",
    runId: "run_xyz",
    requestId: "tdr_1"
  });

  assert.equal(resolved.runFolderKey, "tkt_abc");
  assert.equal(resolved.fileStem, "run_xyz");
  assert.match(resolved.rawPath, /\.relay\/runs\/tkt_abc\/run_xyz-agent-raw\.txt$/);
  assert.equal(resolved.relativePaths.raw, ".relay/runs/tkt_abc/run_xyz-agent-raw.txt");
});

test("places intake artifacts under runs/_intake/ when no ticket", () => {
  const resolved = resolveAgentRunArtifactPaths(testPath, "/repo", {
    projectPath: "/repo",
    kind: "ticket.draft_intake",
    providerId: "codex",
    requestId: "din_1"
  });

  assert.equal(resolved.runFolderKey, "_intake");
  assert.equal(resolved.fileStem, "din_1");
  assert.equal(resolved.relativePaths.output, ".relay/runs/_intake/din_1-agent-output.json");
});
