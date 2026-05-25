---
schemaVersion: 1
id: tkt_01ksez0nykeeqpkqty81dcnm03
title: Feature lean-task dependencies and Ready-wait behavior
ticketType: feature
draftTargetType: null
status: todo
position: 11000
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
updatedAt: '2026-05-25T07:12:43.873Z'
authoringState: reviewing
summary: >-
  Feature drafting can declare sibling task dependencies, materialize them as
  blockedByIds, and let dependents sit in Ready while upstream work is in Review
  without auto-starting.

  - Add blockedByTitles on leanTasks; resolve to blockedByIds when applying
  feature trees

  - Split Ready placement from agent start/scheduling (preflight still blocks)

  - Review/In Progress blockers stay active until terminal columns

  Validate with schema, hierarchy-apply, board-drag, and preflight tests.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ksez0ny1wyhmzt5kfgfbd764
lastRunStartedAt: null
---
# Feature lean-task dependencies and Ready-wait behavior

## Context

Users want feature drafts to encode which lean tasks depend on others. Dependents should queue in Ready but not run until blockers reach terminal columns (Completed, Not Doing, Archive). Review and In Progress already count as active blockers via resolveTicketBlockers. Supersedes draft ticket tkt_01ksez0nykeeqpkqty81dcnm03.

## Goal

Lean task drafts accept optional blockedByTitles: exact sibling lean task titles under the same feature; omit for isolated tasks.

## Decisions / Assumptions

- blockedByTitles references only sibling lean task titles from the same feature draft batch, matched case-insensitively after trim.
- A dependency is satisfied only when every blocker is in a terminal column (completed, not_doing, archive); Review and In Progress remain blocking.
- Manual ticket-detail blocker editing via blockedByIds remains unchanged; this feature only automates links at feature-tree apply time.

## Requirements

- Lean task drafts accept optional blockedByTitles: exact sibling lean task titles under the same feature; omit for isolated tasks.
- Applying feature_tree, epic_tree, extend_epic, and extend_feature plans resolves titles to ticket IDs, writes blockedByIds on created tasks, rejects dependency cycles with warnings, and warns on unknown or duplicate titles without failing the whole apply.
- Dependencies are limited to sibling tasks created in the same apply batch (same parentFeatureId); cross-feature or cross-epic links are out of scope.
- Blocked dependents may be placed in Ready (drag/bulk move) but must not auto-queue or start; preflight and scheduling continue to block until all blockers are terminal.
- Drafting prompts (Codex/Cursor JSON schema and guidance) instruct agents to set blockedByTitles when decomposition order matters.

## Acceptance Criteria

- Feature draft with lean task B blockedByTitles: ["Task A"] materializes B.blockedByIds pointing at A's ticket id.
- Dragging blocked dependent to Ready succeeds without queuing a run; moving blocker to Completed allows dependent to start from Ready.
- Dependent with blocker in Review remains in Ready (or can be moved there) and shows blocked state on the card; scheduler does not queue it.

## Test Plan

- tests/schemas.test.ts: lean task with blockedByTitles parses; invalid empty plannedFiles still fails.
- tests/backend.test.ts: applyHierarchyDraftPlan feature_tree with A→B dependency sets blockedByIds; cycle and missing title produce warnings and sane partial links.
- tests/board-column-layout.test.ts and tests/board-drag-drop.test.tsx: blocked todo task is Ready-placeable but not processable; blocker in review keeps dependent blocked.
- tests/backend.test.ts: preflight still fails for active blockers; passes after blocker moved to terminal column.

## Implementation Notes

- Codebase finding: blockedByIds is persisted on TicketFrontMatter (src/shared/schemas/ticket.ts); resolveTicketBlockers in src/shared/blockers.ts sets active when blocker column is non-terminal, so Review and In Progress block dependents without new semantics.
- Codebase finding: preflightCodexRunInternal and reconcileTicketQueueState call preflight before queueing (src/services/codex/index.ts ~4718–4726, 5807–5810); reconcileSchedulableReadyTickets only touches Ready tasks and will skip blocked tickets when preflight fails.
- Codebase finding: leanTaskDraftSchema has no dependency field; applyFeatureTreePlan/createTaskUnderFeatureRecord create siblings with default empty blockedByIds (src/storage/filesystem.ts ~1155–1176, 1393–1406).
- Codebase finding: isTaskProcessable combines agent-runnable checks with blocker resolution (src/renderer/src/lib/boardColumnLayout.ts); tasksEligibleForReadyQueue and tasksMovableToReady alias it (src/renderer/src/lib/boardDragDrop.ts, boardColumnLayout.ts).
- Codebase finding: App drag-to-Ready uses tasksEligibleForReadyQueue then queueTaskForReady, which requires isTaskProcessable and successful preflight before setTicketQueued (src/renderer/src/App.tsx ~2050–2124).
- Codebase finding: Backend tests cover blocker preflight and hierarchy apply without dependencies (tests/backend.test.ts ~2716–2787, 2521–2594); board-drag-drop.test.tsx excludes blocked tasks from tasksEligibleForReadyQueue.
- Implementation: Add optional blockedByTitles to leanTaskDraftSchema and leanTaskDraftSchemaJson; extend normalizeLeanTaskDraft to trim/dedupe title strings.
- Implementation: Add shared resolver (e.g. src/shared/leanTaskDependencies.ts): map titles to created task IDs, detect cycles, return blockedByIds plus warnings; reuse uniqueTicketIds patterns from blockers.ts.
- Implementation: Refactor applyFeatureTreePlan and all createTaskUnderFeatureRecord loops to two-pass sibling creation: create tasks, then patch blockedByIds from resolved lean-task dependencies; thread warnings into apply result or logs.
- Implementation: Introduce isTaskReadyPlaceable (agent-runnable + run-status guards, no blocker check) in boardColumnLayout.ts; keep isTaskProcessable for agent start; point tasksEligibleForReadyQueue and tasksMovableToReady at the new helper.
- Implementation: Update queueTaskForReady in App.tsx: if resolveTicketBlockers.isBlocked, moveTicket to Ready only with an informative toast; otherwise keep preflight + enqueueCodexRun flow.
- Implementation: Extend Codex draft prompts (ticketTypeGuidance / lean task bullets in src/services/codex/index.ts) to document blockedByTitles semantics and sibling-only scope.
- createTaskUnderFeatureRecord uses FeatureTaskCreateInput without blockedByIds today; extend input or patch tickets after the sibling map is built.
- reconcileSchedulableReadyTickets already no-ops blocked Ready tasks via failed preflight; no scheduler change required beyond tests.

## Codex Handoff

No Codex run has been started.
