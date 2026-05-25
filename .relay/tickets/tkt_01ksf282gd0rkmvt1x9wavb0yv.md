---
schemaVersion: 1
id: tkt_01ksf282gd0rkmvt1x9wavb0yv
title: Accept bundle and promotion-gate domain helpers
ticketType: task
draftTargetType: null
status: archive
position: 7000
priority: medium
effort: medium
labels:
  - backend
  - review
parentEpicId: null
parentFeatureId: tkt_01ksf1h58s4jebdadpbe89mqg8
subticketIds: []
plannedFiles:
  - src/domain/boardAccept.ts
  - src/domain/boardReview.ts
  - src/renderer/src/lib/boardAccept.ts
  - src/renderer/src/lib/boardReview.ts
  - tests/board-accept.test.ts
  - tests/board-review.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:58:00.717Z'
updatedAt: '2026-05-25T14:36:44.363Z'
authoringState: ready
summary: >-
  Added pure domain helpers for cascade accept bundles, eligibility, and sort
  order; updated feature/epic promotion gates so child tickets in `review`
  satisfy readiness checks.
codexThreadId: 'cursor::836961af-2edd-4c67-8d2a-b91da648ed51'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Accept bundle and promotion-gate domain helpers

## Requirements

- Accept bundle builders and `sortAcceptBundleIds` (tasks → features → epics).
- Eligibility: linked tasks `review` or terminal; epics also require features `review` or `completed`.
- Bundles: only `status === review` children plus container id last.
- `featureReadyForReview` / `epicReadyForReview` treat child `review` as satisfying gates.

## Acceptance Criteria

- `tests/board-accept.test.ts`: feature/epic bundles, eligibility, sort order.
- `tests/board-review.test.ts`: promotion cases with all-`review` children.

## Delivered

- `src/domain/boardAccept.ts` — eligibility, bundles, `sortAcceptBundleIds`.
- `src/domain/boardReview.ts` — promotion gates aligned with review-or-terminal / review-or-completed children.
- `src/renderer/src/lib/boardAccept.ts` — re-exports.
- `tests/board-accept.test.ts` added; `tests/board-review.test.ts` updated.
- `src/renderer/src/lib/boardReview.ts` unchanged (re-exports already cover domain updates).
