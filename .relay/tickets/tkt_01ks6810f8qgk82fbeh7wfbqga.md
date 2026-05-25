---
schemaVersion: 1
id: tkt_01ks6810f8qgk82fbeh7wfbqga
title: Layered container review for epics and features
ticketType: feature
draftTargetType: null
status: archive
position: 18000
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
  - tkt_01ks68bhm73d3x1ax33ft3a1fh
  - tkt_01ks68bhmjc68jk7krptdqqcyg
  - tkt_01ks68bhmy6as859qejv9d29kq
  - tkt_01ks68bhn5tqhnts1jq9fqz4sq
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:45:50.824Z'
updatedAt: '2026-05-25T14:36:44.379Z'
authoringState: ready
summary: >-
  Features and epics now auto-enter Review when linked child work satisfies
  promotion gates, appear as container-only Review cards, and support
  Accept/Reject in ticket detail. Container status moves are limited to
  review/completed/archive; task review behavior is unchanged.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Layered container review for epics and features

## Context

Epics and features previously appeared in Review only while descendant tasks were still there, and only tasks had Accept/Reject. Relay adds a second review layer: containers surface in Review on their own after child gates pass.

## Requirements

- Auto-promote a feature to `review` when it has linked tasks and every linked task is in `review` or a terminal column; demote to `todo` if gates fail while in `review`.
- Auto-promote an epic when every linked feature is `review` or `completed` and every descendant task is `review` or terminal; demote similarly on gate failure.
- Allow epic/feature status transitions only among `review`, `completed`, and `archive`; reconcile containers after task moves.
- Review column shows features/epics with `status: review` as container-only groups when no child tasks remain in Review.
- Extend ticket detail Accept/Reject and review copy for features and epics in `review`.
- Document layered gates and container-only Review cards in SPEC §5.5.1 / §6.2.

## Acceptance Criteria

- Last linked task reaching review-or-terminal promotes its feature to Review; reopening a task demotes a feature in Review to todo.
- When all features under an epic are review-or-completed and all tasks are review-or-terminal, the epic appears in Review alone.
- Feature/epic in Review renders as a container-only board card without nested completed tasks.
- Features and epics in Review show Accept and Reject; task accept still moves only the opened task.
- Reject on a container moves only that container to completed.

## Delivered

- `src/domain/boardReview.ts` and `src/storage/boardReconciliation.ts`: linked-child resolution, promotion gates, `maybePromoteOrDemoteContainers` after task moves.
- `src/storage/filesystem.ts`: container transition allowlist and reconciliation hook on `moveTicket`.
- `src/renderer/src/lib/boardColumnLayout.ts`: Review column container-only feature/epic groups.
- `src/renderer/src/App.tsx`: container Accept/Reject and review-specific status notes.
- `SPEC.md` §5.5.1 and §6.2: layered review gates and container-only Review visibility.
- Tests: `board-review.test.ts`, `board-column-layout.test.ts`, `ticket-draft-ui.test.tsx`, `backend.test.ts`.
