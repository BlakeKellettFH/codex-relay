---
schemaVersion: 1
id: tkt_01ksez0nykeeqpkqty81dcnm03
title: Feature lean-task dependencies and Ready-wait behavior
ticketType: feature
draftTargetType: null
status: archive
position: 41000
priority: medium
effort: medium
labels:
  - board
  - drafting
  - dependencies
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ksezn58z7ehdz41qqb5fvhh6
  - tkt_01ksezn59yh87cck34jq2z226s
  - tkt_01ksezn5azry0gf7gjw38zt0jy
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:01:32.755Z'
updatedAt: '2026-05-25T14:54:32.548Z'
authoringState: ready
summary: >-
  Feature drafts declare sibling lean-task dependencies via blockedByTitles,
  materialize them as blockedByIds on hierarchy apply, and let blocked
  dependents sit in Ready without auto-start until blockers reach terminal
  columns.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Feature lean-task dependencies and Ready-wait behavior

## Context

Feature drafts can encode sibling lean-task execution order. Dependents may move to Ready while upstream work is still in Review or In Progress, but must not auto-queue or start until every blocker is in a terminal column (Completed, Not Doing, Archive).

## Requirements

- Lean task drafts accept optional `blockedByTitles`: exact sibling lean task titles under the same feature; omit for isolated tasks.
- `feature_tree`, `epic_tree`, `extend_epic`, and `extend_feature` resolve titles to ticket IDs, write `blockedByIds` on created tasks, reject cycles with warnings, and warn on unknown or duplicate titles without failing the whole apply.
- Dependencies are limited to sibling tasks in the same apply batch; cross-feature or cross-epic links are out of scope.
- Blocked dependents may be placed in Ready (drag/bulk move) but must not auto-queue or start; preflight and scheduling continue to block until all blockers are terminal.
- Drafting prompts instruct agents to set `blockedByTitles` when decomposition order matters.

## Acceptance Criteria

- Feature draft with lean task B `blockedByTitles: ["Task A"]` materializes `B.blockedByIds` pointing at A's ticket id.
- Dragging a blocked dependent to Ready succeeds without queuing a run; moving the blocker to Completed allows the dependent to start from Ready.
- A dependent with a blocker in Review remains in Ready (or can be moved there), shows blocked state on the card, and is not queued by the scheduler.

## Outcome

Delivered in three slices: schema and Codex prompt support for `blockedByTitles`, shared resolver and two-pass apply for `blockedByIds`, and board/scheduling split between Ready placement and agent start.
