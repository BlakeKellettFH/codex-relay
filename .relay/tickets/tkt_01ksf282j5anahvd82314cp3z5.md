---
schemaVersion: 1
id: tkt_01ksf282j5anahvd82314cp3z5
title: SPEC cascade accept documentation
ticketType: task
draftTargetType: null
status: archive
position: 10000
priority: low
effort: medium
labels:
  - docs
  - spec
parentEpicId: null
parentFeatureId: tkt_01ksf1h58s4jebdadpbe89mqg8
subticketIds: []
plannedFiles:
  - SPEC.md
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:58:00.773Z'
updatedAt: '2026-05-25T14:36:44.367Z'
authoringState: ready
summary: >-
  Updated SPEC.md §5.5.1 so cascade accept eligibility, scope, and non-cascade
  reject/task behavior match boardAccept.ts and container review gates.
codexThreadId: 'cursor::3c45768b-d894-4d47-9a7c-1a1edcd7efd6'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# SPEC cascade accept documentation

## Requirements

- Replace §5.5.1 non-cascade Accept with cascade accept rules aligned to domain helpers.
- Document eligibility (descendants in `review` or terminal) and scope (only `review` descendants move).
- State reject stays non-cascade; task accept stays single-ticket.

## Acceptance Criteria

- SPEC §5.5.1 matches implemented cascade accept and reject behavior.

## Outcome

- SPEC.md §5.5.1 documents cascade accept eligibility, scope, and non-cascade reject/task accept.
- Feature and epic review-gate bullets aligned with `featureReadyForReview` / `epicReadyForReview` (child `review` counts toward promotion).
- Cross-checked against `boardAccept.ts`, `boardReview.ts`, and `getContainerTicketStatusNote` in App.tsx.
