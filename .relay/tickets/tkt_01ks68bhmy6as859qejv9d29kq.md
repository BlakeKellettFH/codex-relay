---
schemaVersion: 1
id: tkt_01ks68bhmy6as859qejv9d29kq
title: Accept and reject UI for container review
ticketType: task
draftTargetType: null
status: archive
position: 16000
priority: medium
effort: medium
labels:
  - ui
  - review
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.094Z'
updatedAt: '2026-05-25T14:36:44.377Z'
authoringState: ready
summary: >-
  Features and epics in Review now show Accept/Reject like tasks, with
  review-specific status copy; moves affect only the opened container via
  existing moveTicketTo.
codexThreadId: 'cursor::aad3e29f-eac0-40b1-8f04-3bfb2f9d5e02'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Accept and reject UI for container review

## Requirements

- `getTicketReviewActionState` enables Accept/Reject for `feature` and `epic` when `status === review` and a Completed column exists.
- Containers in `review` show review-specific status guidance instead of the generic follow-child-columns note; actions use existing `moveTicketTo`.
- Accept/reject must not trigger parent promotion loops.

## Acceptance Criteria

- Feature in `review` shows Accept and Reject.
- Accept on a feature in `review` moves only that feature to `completed`; child tasks stay `completed`.
- Epic in `review` behaves the same; accepting a parent feature does not auto-accept the epic.
