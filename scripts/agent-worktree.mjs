#!/usr/bin/env node
import {
  cleanupWorktree,
  finalizeWorktree,
  parseCliArgs,
  prepareWorktree,
  readWorktreeRecord
} from "./relay-agent-workflow-lib.mjs";

const listFromOption = (value) => {
  if (value == null) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
};

const main = async () => {
  const { command, options } = parseCliArgs(process.argv.slice(2));
  const projectPath = String(options.project ?? process.cwd());
  const ticketId = options["ticket-id"] ? String(options["ticket-id"]) : "";

  if (!command || command === "help") {
    console.log("Usage: node scripts/agent-worktree.mjs <prepare|finalize|cleanup|status> [--project PATH] [--ticket-id ID]");
    return;
  }

  if ((command === "prepare" || command === "finalize" || command === "cleanup" || command === "status") && !ticketId) {
    throw new Error("--ticket-id is required.");
  }

  if (command === "prepare") {
    const result = await prepareWorktree({
      projectPath,
      ticketId,
      ticketRef: options["ticket-ref"] ? String(options["ticket-ref"]) : null,
      slug: options.slug ? String(options.slug) : null,
      baseBranch: options.base ? String(options.base) : null
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "finalize") {
    const result = await finalizeWorktree({
      projectPath,
      ticketId,
      runId: options["run-id"] ? String(options["run-id"]) : null,
      reason: options.reason ? String(options.reason) : "",
      testsRun: listFromOption(options.test),
      knownRisks: listFromOption(options.risk),
      followUpWork: listFromOption(options["follow-up"])
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "cleanup") {
    const result = await cleanupWorktree({
      projectPath,
      ticketId,
      deleteBranch: Boolean(options["delete-branch"])
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "status") {
    const result = await readWorktreeRecord(projectPath, ticketId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
