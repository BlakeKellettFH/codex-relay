---
schemaVersion: 1
id: tkt_01ks68bhm73d3x1ax33ft3a1fh
title: Review gates and container status transitions
ticketType: task
draftTargetType: null
status: archive
position: 14000
priority: medium
effort: medium
labels:
  - backend
  - review
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - src/renderer/src/lib/boardReview.ts
  - src/storage/filesystem.ts
  - tests/backend.test.ts
  - tests/board-review.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.071Z'
updatedAt: '2026-05-25T14:36:44.374Z'
authoringState: ready
summary: >-
  Added board review gates and container promotion: features auto-enter review
  when all linked tasks are terminal and demote on reopen; epic/feature status
  transitions are limited to review, completed, or archive, with reconciliation
  after task moves.
codexThreadId: 'cursor::a68b4c88-85a0-4288-9215-e52a91a560e7'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Review gates and container status transitions

## Requirements

- `boardReview.ts`: terminal task detection, linked task/feature collectors, review gate predicates, and `maybePromoteOrDemoteContainers`.
- Epic and feature `transitionTicketStatus` limited to `review`, `completed`, or `archive`.
- After task changes via `moveTicket`, run promotion/demotion for parent feature and epic ancestors.

## Acceptance Criteria

- Last task under a feature moving to `completed` sets the feature `status` to `review` in storage.
- Moving a completed task back to `todo` demotes a feature in `review` to `todo`.
- `transitionTicketStatus` rejects feature→`todo`; allows feature→`review` and `completed`.
