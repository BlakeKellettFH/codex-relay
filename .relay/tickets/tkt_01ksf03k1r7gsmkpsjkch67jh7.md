---
schemaVersion: 1
id: tkt_01ksf03k1r7gsmkpsjkch67jh7
title: Wire archive UI for completed tasks and bundles
ticketType: task
draftTargetType: null
status: archive
position: 36000
priority: medium
effort: medium
labels:
  - ui
  - board
parentEpicId: null
parentFeatureId: tkt_01kseyph9agqpws8zz0w4q2h2m
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/components/BoardTaskCardLeading.tsx
  - src/renderer/src/lib/boardArchive.ts
  - tests/board-archive-button.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:20:36.664Z'
updatedAt: '2026-05-25T14:52:07.171Z'
authoringState: ready
summary: >-
  Completed tasks and bundles archive via agent update (`purpose: "archive"`)
  with board/detail buttons, busy state, and polling; container gating
  unchanged.
codexThreadId: 'cursor::e8d58a1b-f16b-4db3-bfbc-da809f5f3973'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Wire archive UI for completed tasks and bundles

## Requirements

- Completed-column task cards show `BoardArchiveButton` when status is completed.
- Completed task detail exposes Archive (same pattern as containers).
- Archive flows use agent archive update, not `moveTicket` alone.

## Acceptance Criteria

- Completed task card archive removes the ticket from visible columns after a successful run.
- Container archive still gates on `featureCanArchive` / `epicCanArchive` with existing toast messages.
