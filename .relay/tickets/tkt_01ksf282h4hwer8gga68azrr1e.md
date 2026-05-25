---
schemaVersion: 1
id: tkt_01ksf282h4hwer8gga68azrr1e
title: Suppress reconciliation during bulk accept moves
ticketType: task
draftTargetType: null
status: archive
position: 8000
priority: medium
effort: medium
labels:
  - backend
  - storage
parentEpicId: null
parentFeatureId: tkt_01ksf1h58s4jebdadpbe89mqg8
subticketIds: []
plannedFiles:
  - src/shared/schemas/ticket.ts
  - src/storage/filesystem.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:58:00.740Z'
updatedAt: '2026-05-25T14:36:44.365Z'
authoringState: ready
summary: >-
  Added optional suppressContainerReconciliation on task moves so sequential
  bulk-accept completes skip parent container demotion until the batch finishes;
  covered by backend integration test.
codexThreadId: 'cursor::92cdf768-6192-4e0f-99d9-12fa17f6b9f4'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Suppress reconciliation during bulk accept moves

## Requirements

- Optional `suppressContainerReconciliation` on `ticketMoveInputSchema`.
- When true on a task move, skip `maybePromoteOrDemoteContainers` after `transitionTicketStatus`.
- Default behavior unchanged when the flag is omitted.

## Acceptance Criteria

- Sequential accept of two review tasks, then the review feature, leaves the feature in `completed` (not demoted to `todo` mid-batch).
- `tests/backend.test.ts` covers the bulk-accept path with suppression.

## Outcome

- `ticketMoveInputSchema` extended in `src/shared/schemas/ticket.ts`.
- `moveTicket` in `src/storage/filesystem.ts` guards reconciliation when the flag is set on task moves.
- Integration test: feature and two tasks in `review`, suppressed task completes, then feature complete.

## Follow-up

- UI accept-bundle loop should pass `suppressContainerReconciliation: true` on task moves (sibling ticket).
