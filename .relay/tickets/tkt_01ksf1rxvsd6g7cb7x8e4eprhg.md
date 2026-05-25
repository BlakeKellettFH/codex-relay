---
schemaVersion: 1
id: tkt_01ksf1rxvsd6g7cb7x8e4eprhg
title: Test detail archive affordance for completed containers
ticketType: task
draftTargetType: null
status: archive
position: 39000
priority: low
effort: medium
labels:
  - ui
  - test
parentEpicId: null
parentFeatureId: tkt_01ksf1exckn6dxhhy05deq7qrr
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/lib/boardArchive.ts
  - tests/board-archive-button.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:49:44.441Z'
updatedAt: '2026-05-25T14:53:01.794Z'
authoringState: ready
summary: >-
  Added `resolveDetailArchiveTarget` in boardArchive and six regression tests so
  ticket detail archive gating for completed epic/feature containers cannot
  regress silently.
codexThreadId: 'cursor::cd0e4d3b-a9d5-477d-a33e-359eb76d485c'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Test detail archive affordance for completed containers

## Requirements

- Cover `resolveDetailArchiveTarget` `canArchive` true/false for completed vs incomplete epic and feature fixtures.
- Assert archive control is absent when container status is not `completed`.

## Acceptance Criteria

- Detail archive tests fail if epic/feature types are omitted or eligible completed containers lose the archive button.
- `tests/board-archive-button.test.tsx` runs green via `node tests/run-tests.mjs`.
