---
schemaVersion: 1
id: tkt_01ksf282hnkrzq2fhh4kv71t2a
title: Cascade accept in ticket detail UI
ticketType: task
draftTargetType: null
status: archive
position: 9000
priority: medium
effort: medium
labels:
  - ui
  - review
parentEpicId: null
parentFeatureId: tkt_01ksf1h58s4jebdadpbe89mqg8
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:58:00.757Z'
updatedAt: '2026-05-25T14:36:44.366Z'
authoringState: ready
summary: >-
  Ticket detail Accept cascades accept-bundle moves for features and epics in
  review, with eligibility-based disable; task accept and reject behavior
  unchanged.
codexThreadId: 'cursor::ee3f1001-268a-4795-84c8-031748c52660'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Cascade accept in ticket detail UI

## Requirements

- Feature or epic in `review`: Accept runs `acceptBundle` via `moveTicketMutation` with suppression on task moves.
- Disable Accept when `featureEligibleForBulkAccept` or `epicEligibleForBulkAccept` is false.
- Review status notes describe cascade accept vs non-cascade reject.
- Task Accept path unchanged.

## Acceptance Criteria

- Accept on a review feature with two review tasks completes all three tickets.
- Accept disabled when any linked task is `in_progress`.
- Reject on a review feature completes only the feature.
- `tests/ticket-draft-ui.test.tsx` reflects updated copy and eligibility helpers.
