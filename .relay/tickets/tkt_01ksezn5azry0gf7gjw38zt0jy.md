---
schemaVersion: 1
id: tkt_01ksezn5azry0gf7gjw38zt0jy
title: Allow Ready placement for blocked tasks without auto-start
ticketType: task
draftTargetType: null
status: review
position: 9000
priority: medium
effort: medium
labels:
  - board
  - scheduling
parentEpicId: null
parentFeatureId: tkt_01ksez0nykeeqpkqty81dcnm03
subticketIds: []
plannedFiles:
  - src/renderer/src/lib/boardColumnLayout.ts
  - src/renderer/src/lib/boardDragDrop.ts
  - src/renderer/src/App.tsx
  - tests/board-column-layout.test.ts
  - tests/board-drag-drop.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:12:43.871Z'
updatedAt: '2026-05-25T07:33:55.313Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::4270bb32-b1a6-4d74-aeac-99f6d74503c3'
runStatus: completed
lastRunId: run_01ksf0b0mnrttdx734mtsgent9
lastRunStartedAt: '2026-05-25T07:30:31.866Z'
---
# Allow Ready placement for blocked tasks without auto-start

## Context

Parent feature: Feature lean-task dependencies and Ready-wait behavior

Uses existing resolveTicketBlockers active semantics; no change to terminal column rules.

## Goal

Board Ready column can hold blocked dependents without starting runs until blockers finish.

## Requirements

- isTaskReadyPlaceable allows blocked tasks that are otherwise agent-runnable and not in active run states.
- tasksEligibleForReadyQueue and tasksMovableToReady use isTaskReadyPlaceable.
- queueTaskForReady moves blocked tasks to Ready via moveTicket only; unblocked path unchanged.
- isTaskProcessable and preflightCodexRun still reject active blockers.

## Acceptance Criteria

- Blocked todo task appears in tasksEligibleForReadyQueue but not isTaskProcessable.
- Drag blocked task to Ready leaves runStatus idle and does not set lastRunId.
- After blocker reaches Completed, dependent in Ready can preflight and queue successfully.

## Implementation Plan

- Add isTaskReadyPlaceable and isTaskAgentStartable (or retain isTaskProcessable name for start) in boardColumnLayout.ts.
- Switch tasksEligibleForReadyQueue in boardDragDrop.ts to the placeable helper.
- Branch queueTaskForReady in App.tsx for blocked vs unblocked flows.
- Update board-column-layout.test.ts and board-drag-drop.test.tsx expectations; add review-blocker case.

## Assumptions

- Users may manually move blocked tasks to Ready via ticket detail status control; same preflight rules apply on explicit Run.

## Codex Handoff

### 5/25/2026, 8:33:55 AM

Implementing Ready placement for blocked tasks without auto-start. Reading the planned files and related helpers.
Implementing the changes across the planned files.
Updating tests:
## Summary

Blocked dependents can move to **Ready** without starting an agent run. Ready placement and agent start are split: placement ignores active blockers; start/preflight still require blockers to be terminal.

## Changes

**`boardColumnLayout.ts`**
- Added `isTaskReadyPlaceable` (agent-runnable, no active run status, no blocker check).
- Refactored `isTaskProcessable` to require `isTaskReadyPlaceable` plus no active blockers.
- `tasksMovableToReady` now uses `isTaskReadyPlaceable`.

**`boardDragDrop.ts`**
- `tasksEligibleForReadyQueue` uses `isTaskReadyPlaceable`.

**`App.tsx`**
- `queueTaskForReady` gates on `isTaskReadyPlaceable`.
- **Blocked:** `moveTicket` to Ready only (no preflight, no `startRun`).
- **Unblocked:** unchanged preflight + start flow.

**Tests**
- Blocked todo: placeable but not processable.
- Blocker in review: dependent stays unprocessable but placeable.
- `tasksMovableToReady` / `tasksEligibleForReadyQueue` include blocked tasks.

## Files changed

- `src/renderer/src/lib/boardColumnLayout.ts`
- `src/renderer/src/lib/boardDragDrop.ts`
- `src/renderer/src/App.tsx`
- `tests/board-column-layout.test.ts`
- `tests/board-drag-drop.test.tsx`

## Commands run

None — shell execution was unavailable in this session.

## Tests

Please run locally:

```bash
npm test
# or targeted:
node tests/run-tests.mjs
```

Expected: `board-column-layout.test.ts` and `board-drag-drop.test.tsx` pass with the new blocked/review cases.

## Subagent usage

**None used.**

## Remaining risks / follow-up

- **`featureGroupShouldExpandByDefault`** still keys off `isTaskProcessable`, so feature groups with only blocked Ready-waiting tasks may stay collapsed.
- **Backend preflight/scheduling** behavior is unchanged (by design); confirm with `tests/backend.test.ts` if you want end-to-end coverage for “blocker completes → dependent starts from Ready.”
- Manual QA: drag blocked task to Ready → `runStatus` stays `idle`, no `lastRunId`; after blocker hits Completed, explicit Run/preflight should succeed.


No Codex run has been started.
