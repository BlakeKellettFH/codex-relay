---
schemaVersion: 1
id: tkt_01ks68bhn5tqhnts1jq9fqz4sq
title: SPEC layered review documentation
ticketType: task
draftTargetType: null
status: archive
position: 17000
priority: low
effort: medium
labels:
  - docs
  - spec
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - SPEC.md
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.101Z'
updatedAt: '2026-05-25T14:36:44.378Z'
authoringState: ready
summary: >-
  Updated SPEC.md §5.5.1 and §6.2 to document layered feature/epic Review gates,
  container-only Review cards, and non-cascading Accept/Reject.
codexThreadId: 'cursor::768ac682-41b7-4380-adfc-abb04d369716'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# SPEC layered review documentation

## Requirements

- Document feature Review gate (all linked tasks terminal) and epic gate (all linked features completed with descendant tasks terminal).
- Document that container Accept/Reject moves only that container and does not cascade.
- Clarify the board shows review-status containers in Review even without in-column tasks.

## Acceptance Criteria

- SPEC §5.5.1 describes layered Review and points to container-only Review board cards.
- SPEC no longer implies containers can never use `review` or `completed` statuses.
