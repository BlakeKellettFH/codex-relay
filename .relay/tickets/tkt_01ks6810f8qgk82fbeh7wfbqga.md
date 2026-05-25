---
schemaVersion: 1
id: tkt_01ks6810f8qgk82fbeh7wfbqga
title: Layered container review for epics and features
ticketType: feature
draftTargetType: null
status: todo
position: 4000
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
updatedAt: '2026-05-21T21:51:36.103Z'
authoringState: reviewing
summary: >-
  Relay currently shows features and epics in Review only while descendant tasks
  are still in that column, and Accept/Reject applies to tasks alone. This
  feature adds a second review layer: when all tasks under a feature are
  terminal, the feature appears in Review for its own accept/reject; when all
  features under an epic are completed, the epic does the same.


  - Auto-promote containers to `review` when child gates pass; relax storage
  transitions for container `review`/`completed` only.

  - Extend Review board layout and detail Accept/Reject for feature/epic without
  cascading parent acceptance.

  - Task review behavior stays unchanged; accepting a task never accepts its
  parent.


  Main risk is keeping task-driven board grouping compatible with container-only
  Review cards—validate with board-column and UI tests.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ks6810f0cer657ap9n8esqkz
lastRunStartedAt: null
---
# Layered container review for epics and features

## Context

User confirmed task accept/reject is correct today but wants epics and features to surface in Review independently after their children finish. Intake documents promotion gates, non-cascade acceptance, and SPEC §5.5.1 container semantics.

## Goal

When every task linked to a feature (`subticketIds` + `parentFeatureId`, same resolution as `linkedChildTickets`) reaches a terminal column (`completed`, `not_doing`, or `archive`, or any column with `terminal: true`), auto-transition that feature to `review` if not already `review`/`completed`.

## Decisions / Assumptions

- Terminal child status means `completed`, `not_doing`, `archive`, or any project column marked `terminal: true`.
- Features with zero linked tasks never auto-promote to Review.
- Container demotion when gates fail resets `status` to `todo` (initial container default).
- Reject on containers continues to mean move to `completed` without git revert, matching current task reject semantics.

## Requirements

- When every task linked to a feature (`subticketIds` + `parentFeatureId`, same resolution as `linkedChildTickets`) reaches a terminal column (`completed`, `not_doing`, or `archive`, or any column with `terminal: true`), auto-transition that feature to `review` if not already `review`/`completed`.
- When every feature linked to an epic is `completed` and every descendant task is terminal, auto-transition that epic to `review` if not already `review`/`completed`.
- Relax `transitionTicketStatus` so epic/feature tickets may move only among `review`, `completed`, and `archive`; other workflow columns remain rejected.
- Review column shows container tickets with `status === review` even when no descendant tasks are in Review (standalone feature group or epic header).
- Extend `getTicketReviewActionState` and detail Accept/Reject so features and epics in `review` get the same controls as tasks; Accept and Reject both move only the opened container to `completed` (no workspace revert, no child/parent cascade).
- If a task leaves terminal status while its parent feature is in `review`, demote the feature out of `review` (default `todo`). If a feature leaves `completed` while its parent epic is in `review`, demote the epic similarly.

## Acceptance Criteria

- Completing the last task under a feature moves that feature to Review on the board; no tasks remain in Review unless still awaiting review.
- Accepting a feature in Review moves only that feature to Completed; sibling tasks and parent epic stay unchanged.
- After all features under an epic are Completed, the epic appears in Review alone; Accept/Reject affects only the epic.
- Accepting a task does not auto-accept its parent feature or epic.
- Existing task Review accept/reject behavior is unchanged.

## Test Plan

- Add `tests/board-review.test.ts` for gate helpers: feature promotes when all linked tasks terminal, epic promotes only when all features completed + tasks terminal, demotion when a task reopens.
- Extend `tests/board-column-layout.test.ts`: feature/epic with `status: review` and all tasks in `completed` appear in Review as container-only groups; accepting last task does not remove a feature already in `review`.
- Update `tests/ticket-draft-ui.test.tsx` for `getTicketReviewActionState` on feature/epic in `review`.
- Update `tests/backend.test.ts`: allow `transitionTicketStatus` feature/epic → `review`/`completed`; reject `todo`/`ready`; verify `moveTicket` on final task promotes parent feature.
- Run `node tests/run-tests.mjs` (or targeted files above).

## Implementation Notes

- Codebase finding: `getTicketReviewActionState` in `src/renderer/src/App.tsx` returns `showAcceptReject` only when `ticketType === "task"` and `status === "review"`; `acceptReviewTicket`/`rejectReviewTicket` call `moveTicketTo(RELAY_COMPLETED_STATUS)` for the opened ticket only.
- Codebase finding: `transitionTicketStatus` in `src/storage/filesystem.ts` throws for epic/feature targets except `archive`; `moveTicket` always routes through it, so containers cannot enter Review or Completed via API today.
- Codebase finding: `ticketsForBoardColumn` and `organizeColumnBoardItems` in `src/renderer/src/lib/boardColumnLayout.ts` are task-driven: parents appear only when a descendant task matches the column (`tasksInColumn`, `featureInColumn: feature.status === columnId`). When all tasks leave Review, parent groups vanish.
- Codebase finding: Child resolution for containers already exists: `linkedChildTickets` in `App.tsx` merges `subticketIds` with `parentFeatureId`/`parentEpicId` matches; `collectTasksUnderFeature`/`collectTasksUnderEpic` in `boardDragDrop.ts` mirror task scope; `featureTasksAreComplete`/`epicTreeHasNoPendingTasks` in `boardArchive.ts` use `status === completed` only (stricter than terminal).
- Codebase finding: SPEC.md §5.5.1 states epics/features are non-workflow containers that follow child task columns; ticket detail hides workflow Status for containers (`isContainerTicket` ~L3056) with a note to move child tasks instead.
- Codebase finding: Codex moves completed tasks to `review` via `transitionTicketStatus` in `src/services/codex/index.ts` (~L4954); promotion hook belongs after task status changes in `moveTicket`/`transitionTicketStatus`.
- Implementation: Add `src/renderer/src/lib/boardReview.ts` with terminal-status helpers, linked-child collectors (mirror `linkedChildTickets`), `featureReadyForReview`, `epicReadyForReview`, and `maybePromoteOrDemoteContainers` using board snapshot + column config.
- Implementation: Update `transitionTicketStatus` in `src/storage/filesystem.ts` to allowlist container targets `review`/`completed`/`archive`; call `maybePromoteOrDemoteContainers` after task status changes from `moveTicket` (and any other task transition entry points if needed).
- Implementation: Extend `ticketsForBoardColumn` and `organizeColumnBoardItems` in `boardColumnLayout.ts` to include review-status containers as standalone `feature-group`/`epic-group` items with `featureInColumn: true` and empty in-column task lists.
- Implementation: Update `getTicketReviewActionState` and container detail copy in `App.tsx` so features/epics in `review` show Accept/Reject and a review-specific status note instead of the generic child-column message.
- Implementation: Document layered review gates and non-cascade acceptance in SPEC.md §5.5.1 (and brief §6 board note if appropriate).
- Reuse `collectTasksUnderFeature`/`collectTasksUnderEpic` or extract shared linked-child helpers to avoid drift from `linkedChildTickets`.
- Promotion must not run on container accept/reject itself—only on task (and possibly feature→completed for epic gate) status changes.
- Sidebar swimlane counts remain task-only per SPEC; container Review cards may not increment counts unless product asks later.

## Codex Handoff

No Codex run has been started.
