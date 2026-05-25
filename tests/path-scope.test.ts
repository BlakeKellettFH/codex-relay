import test from "node:test";
import assert from "node:assert/strict";
import { filterPathsForPathScope, isRelayManagedPath } from "../src/shared/pathScope";

test("isRelayManagedPath matches .relay roots and descendants", () => {
  assert.equal(isRelayManagedPath(".relay"), true);
  assert.equal(isRelayManagedPath(".relay/tickets/tkt_1.md"), true);
  assert.equal(isRelayManagedPath(".relay/path-locks.json"), true);
  assert.equal(isRelayManagedPath("src/shared.ts"), false);
  assert.equal(isRelayManagedPath("not.relay/foo"), false);
});

test("filterPathsForPathScope removes relay metadata paths", () => {
  assert.deepEqual(
    filterPathsForPathScope(["src/a.ts", ".relay/tickets/t.md", ".relay/audit.jsonl"]),
    ["src/a.ts"]
  );
});

test("path lock normalization skips relay paths", async () => {
  const { tryAcquirePathLocks, pathLockConflictsFor, releasePathLocksForRun } = await import("../src/services/path-lock");
  const projectPath = await (async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    return mkdtemp(path.join(tmpdir(), "relay-path-scope-"));
  })();

  const acquired = await tryAcquirePathLocks(projectPath, "tkt_a", "run_a", [
    ".relay/tickets/tkt_a.md",
    "src/shared.ts"
  ]);
  assert.equal(acquired.ok, true);

  const conflicts = await pathLockConflictsFor(projectPath, "tkt_b", [".relay/tickets/tkt_a.md"]);
  assert.equal(conflicts.length, 0);

  const srcConflicts = await pathLockConflictsFor(projectPath, "tkt_b", ["src/shared.ts"]);
  assert.equal(srcConflicts.length, 1);

  await releasePathLocksForRun(projectPath, "tkt_a", "run_a");
});
