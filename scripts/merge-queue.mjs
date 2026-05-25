#!/usr/bin/env node
import {
  enqueueMerge,
  finalizeMergeQueueItem,
  parseCliArgs,
  processNextMergeQueueItem,
  readMergeQueue
} from "./relay-agent-workflow-lib.mjs";

const main = async () => {
  const { command, options } = parseCliArgs(process.argv.slice(2));
  const projectPath = String(options.project ?? process.cwd());

  if (!command || command === "help") {
    console.log("Usage: node scripts/merge-queue.mjs <enqueue|process-next|finalize|status> [--project PATH]");
    return;
  }

  if (command === "enqueue") {
    if (!options["ticket-id"]) throw new Error("--ticket-id is required.");
    const result = await enqueueMerge({
      projectPath,
      ticketId: String(options["ticket-id"]),
      ticketRef: options["ticket-ref"] ? String(options["ticket-ref"]) : null,
      testCommand: options.test ? String(options.test) : null
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "process-next") {
    const result = await processNextMergeQueueItem({ projectPath });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "finalize") {
    if (!options["ticket-id"]) throw new Error("--ticket-id is required.");
    const result = await finalizeMergeQueueItem({
      projectPath,
      ticketId: String(options["ticket-id"]),
      approve: Boolean(options.approve),
      push: Boolean(options.push)
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "status") {
    const result = await readMergeQueue(projectPath);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
