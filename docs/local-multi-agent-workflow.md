# Local Multi-Agent Workflow

This repo includes local helper scripts for a safe Cursor/Codex worktree workflow:

- `npm run agent:worktree -- prepare ...`
- `npm run agent:worktree -- finalize ...`
- `npm run agent:worktree -- cleanup ...`
- `npm run agent:merge -- enqueue ...`
- `npm run agent:merge -- process-next ...`
- `npm run agent:merge -- finalize ...`

## Goals

- 3 worker slots for board and draft-ticket implementation work
- 1 separate interactive slot for repository chat and draft Q&A
- no worker edits in the user's active working tree
- one ticket or feature per worktree
- serial merge queue with explicit conflict handoff

## Config

Workflow defaults live in [.relay/agent-workflow.json](/Users/blakekellett/repos/codex-relay/.relay/agent-workflow.json).

Important fields:

- `workerSlots`: shared worker capacity for implementation work
- `interactiveSlots`: reserved read-only chat/draft capacity
- `worktreeNameTemplate`: sibling worktree name template
- `branchNameTemplate`: feature branch naming template
- `mergeQueue.strategy`: `rebase` or `merge`
- `mergeQueue.testCommand`: validation command for merge preparation

## Prepare A Worker Worktree

```bash
npm run agent:worktree -- prepare \
  --project "$PWD" \
  --ticket-id tkt_01example \
  --ticket-ref MYT-123
```

This will:

1. Read the ticket title from `.relay/tickets/<ticket>.md`
2. Create a sibling worktree like `../codex-relay-MYT-123`
3. Create a branch like `agent/MYT-123-short-description`
4. Persist metadata under `.relay/agent-worktrees/<ticket>.json`

Use the returned `worktreePath` as the agent `cwd`.

## Finalize A Ticket

```bash
npm run agent:worktree -- finalize \
  --project "$PWD" \
  --ticket-id tkt_01example \
  --test "npm test -- --runInBand tests/backend.test.ts" \
  --risk "Needs a wider smoke test in Electron" \
  --follow-up "Swap to dedicated archive API once it lands"
```

This writes a review summary to `.relay/reviews/<ticket>.md` and moves the ticket to `review`.

## Queue A Reviewed Branch

```bash
npm run agent:merge -- enqueue \
  --project "$PWD" \
  --ticket-id tkt_01example \
  --ticket-ref MYT-123
```

## Process The Next Merge Queue Item

```bash
npm run agent:merge -- process-next --project "$PWD"
```

This:

1. claims the next queued item
2. creates an isolated merge worktree
3. fetches the latest base branch
4. rebases or merges the feature branch
5. runs validation tests
6. writes a merge report

If conflicts happen, the script:

- writes a conflict report under `.relay/merge-queue/reports/`
- moves the ticket to `needs_clarification`
- adds a clarification question pointing at the report

## Finalize A Clean Merge

```bash
npm run agent:merge -- finalize \
  --project "$PWD" \
  --ticket-id tkt_01example \
  --approve
```

By default this safely fast-forwards the local base branch reference only when:

- the feature branch already contains the latest remote base
- the base branch is not checked out in any worktree

It does not touch the user's current working tree.
