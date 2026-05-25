---
schemaVersion: 1
id: tkt_01ksf1h58s4jebdadpbe89mqg8
title: Cascade accept for feature and epic review
ticketType: feature
draftTargetType: null
status: archive
position: 11000
priority: medium
effort: medium
labels:
  - board
  - review
  - hierarchy
  - ux
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ksf282gd0rkmvt1x9wavb0yv
  - tkt_01ksf282h4hwer8gga68azrr1e
  - tkt_01ksf282hnkrzq2fhh4kv71t2a
  - tkt_01ksf282j5anahvd82314cp3z5
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:45:29.881Z'
updatedAt: '2026-05-25T14:36:44.368Z'
authoringState: ready
summary: >-
  Cascade Accept on features and epics in Review completes every linked
  descendant still in review (tasks before features before epics), with
  eligibility gates and suppressed container reconciliation during bundle moves.
  Reject and task-only accept stay unchanged; SPEC §5.5.1 updated.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Cascade accept for feature and epic review

## Context

Extends layered review (tkt_01ks6810): Accept on a feature or epic in Review completes every linked descendant still in `review`, then the container. Reject stays single-ticket. Accept is disabled while any descendant remains in active workflow columns.

## Requirements

- Feature accept: move linked tasks in `review` to `completed`, then the feature; leave terminal children unchanged.
- Epic accept: move linked features and tasks in `review` to `completed`, then the epic.
- Enable Accept only when the container is in `review` and every descendant is `review` or terminal; active descendants disable Accept with explanatory copy.
- Reject on feature/epic moves only the opened container.
- Task accept remains single-ticket (no parent cascade).
- Promotion gates align with bulk-accept eligibility (child `review` counts as ready).

## Acceptance Criteria

- Feature in Review with all tasks review-or-terminal: Accept completes review tasks, then the feature.
- Epic in Review with features review-or-completed and tasks review-or-terminal: Accept completes nested review items, then the epic.
- Descendants in `todo`, `ready`, or `in_progress` disable Accept with clear copy.
- Reject moves only the container; children unchanged.
- Task accept moves only the opened task.
- SPEC §5.5.1 documents cascade accept; supersedes non-cascade criteria on tkt_01ks6810.
