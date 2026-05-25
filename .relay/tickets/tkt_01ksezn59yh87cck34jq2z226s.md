---
schemaVersion: 1
id: tkt_01ksezn59yh87cck34jq2z226s
title: Materialize lean-task blockedByTitles when applying feature trees
ticketType: task
draftTargetType: null
status: archive
position: 32000
priority: medium
effort: medium
labels:
  - storage
  - drafting
parentEpicId: null
parentFeatureId: tkt_01ksez0nykeeqpkqty81dcnm03
subticketIds: []
plannedFiles:
  - src/shared/leanTaskDependencies.ts
  - src/storage/filesystem.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:12:43.838Z'
updatedAt: '2026-05-25T14:50:27.544Z'
authoringState: ready
summary: >-
  Lean-task blockedByTitles from hierarchy drafts are resolved to blockedByIds
  on feature_tree, epic_tree, extend_epic, and extend_feature applies via a
  shared resolver and two-pass sibling creation.
codexThreadId: 'cursor::a3508756-e82c-476d-99a2-e13a7340d0a4'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Materialize lean-task blockedByTitles when applying feature trees

## Requirements

- Shared resolver maps lean-task titles to created ticket IDs; warns on cycles, self-deps, and unknown titles.
- `feature_tree`, `epic_tree`, `extend_epic`, and `extend_feature` use two-pass sibling creation and patch `blockedByIds`.
- Task-under-feature creation uses resolved `blockedByIds` or a post-create patch helper.

## Acceptance Criteria

- `feature_tree` apply with B `blockedByTitles` ["A"] sets B `blockedByIds` to A's id.
- Circular A↔B titles log warnings and do not write invalid blocker links.

## Delivered

- `src/shared/leanTaskDependencies.ts` — case-insensitive title→id resolution, cycle/unknown/self-dep warnings; first-created wins on duplicate titles.
- `src/storage/filesystem.ts` — `createLeanTasksUnderFeatureWithDependencies` wired into hierarchy apply paths.
- `tests/backend.test.ts` — linear chain, cycle, and missing-title hierarchy apply cases.

## Out of scope

- `applyTicketDraftToTicket` lean-task paths still do not resolve `blockedByTitles`.
