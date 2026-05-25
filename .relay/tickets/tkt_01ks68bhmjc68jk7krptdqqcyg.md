---
schemaVersion: 1
id: tkt_01ks68bhmjc68jk7krptdqqcyg
title: Review column board layout for containers
ticketType: task
draftTargetType: null
status: archive
position: 15000
priority: medium
effort: medium
labels:
  - board
  - ui
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - src/renderer/src/lib/boardColumnLayout.ts
  - src/renderer/src/lib/boardReview.ts
  - tests/board-column-layout.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.082Z'
updatedAt: '2026-05-25T14:36:44.376Z'
authoringState: ready
summary: >-
  Review column now shows features and epics in review as container-only groups
  when child work is completed, without pulling completed or not_doing tasks
  into those groups. Todo and Ready columns stay task-driven.
codexThreadId: 'cursor::1f8d16a0-6132-4286-8edf-896519ca022b'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Review column board layout for containers

## Requirements

- When `columnId === review`, include features and epics with `status === review`.
- Emit container-only groups: `feature-group` with empty `tasks` and `featureInColumn: true`; `epic-group` with empty `featureGroups` when the epic is in review alone.
- When a container is in review, omit `completed` and `not_doing` tasks from its Review group.
- Extend `boardColumnLayout.ts` using helpers from `boardReview.ts`; cover Review cases in `board-column-layout.test.ts`.

## Acceptance Criteria

- Feature in review with all tasks completed → one Review group, no nested task cards.
- Epic in review with all features completed → epic header in Review, no child task rows.
- Todo and Ready columns unchanged (task-driven only, no container-only regression).

## Outcome

- `boardReview.ts`: `isReviewBoardColumn`, `isReviewStatusContainer`, `reviewStatusContainers`, `tasksForReviewContainerGroup`.
- `boardColumnLayout.ts`: Review column merges review-status containers; standalone container groups when not already represented; suppress duplicate feature cards when parent epic is also in review.
- Tests added in `tests/board-column-layout.test.ts` for the three cases above.
