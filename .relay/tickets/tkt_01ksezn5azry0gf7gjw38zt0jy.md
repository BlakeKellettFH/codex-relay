---
schemaVersion: 1
id: tkt_01ksezn5azry0gf7gjw38zt0jy
title: Allow Ready placement for blocked tasks without auto-start
ticketType: task
draftTargetType: null
status: archive
position: 33000
priority: medium
effort: medium
labels:
  - board
  - scheduling
parentEpicId: null
parentFeatureId: tkt_01ksez0nykeeqpkqty81dcnm03
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/lib/boardColumnLayout.ts
  - src/renderer/src/lib/boardDragDrop.ts
  - tests/board-column-layout.test.ts
  - tests/board-drag-drop.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:12:43.871Z'
updatedAt: '2026-05-25T14:50:59.171Z'
authoringState: ready
summary: >-
  Split Ready placement from agent start: blocked dependents can sit in Ready
  without runs until blockers finish; preflight and start still require terminal
  blockers.
codexThreadId: 'cursor::4270bb32-b1a6-4d74-aeac-99f6d74503c3'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Allow Ready placement for blocked tasks without auto-start

## Requirements

- `isTaskReadyPlaceable` allows blocked agent-runnable tasks not in active run states.
- `tasksEligibleForReadyQueue` and `tasksMovableToReady` use the placeable helper.
- `queueTaskForReady` moves blocked tasks to Ready via `moveTicket` only; unblocked path unchanged.
- `isTaskProcessable` and `preflightCodexRun` still reject active blockers.

## Acceptance Criteria

- Blocked todo appears in `tasksEligibleForReadyQueue` but not `isTaskProcessable`.
- Drag blocked task to Ready leaves `runStatus` idle without `lastRunId`.
- After blocker reaches Completed, dependent in Ready can preflight and queue successfully.
