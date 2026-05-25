---
schemaVersion: 1
id: tkt_01kseykcwatewypzka1gjrcye5
title: Fix repository chat pre-hydration draft race
ticketType: task
draftTargetType: null
status: archive
position: 28000
priority: medium
effort: medium
labels:
  - repository-chat
  - bug
parentEpicId: null
parentFeatureId: tkt_01kseydxj7g1x80fxxz0v2cqgd
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - tests/repository-chat-hydration.test.ts
  - tests/run-tests.mjs
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:54:17.482Z'
updatedAt: '2026-05-25T14:38:27.217Z'
authoringState: ready
summary: >-
  Fixed repository chat hydration so typing while the query is pending no longer
  blocks server draft restore; edits after query success but before persist
  ready still skip server apply.
codexThreadId: 'cursor::b1a56072-6741-487d-9ba8-d4a1261b00c0'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Fix repository chat pre-hydration draft race

## Requirements

- Stop using non-empty `draft` as a hydration skip condition.
- Track intentional edits only after `repositoryChatQuery` succeeds and before persist is ready (`shouldMarkRepositoryChatUserEditedBeforeHydration`).
- Run hydration once per `projectPath` on query success via `resolveRepositoryChatHydrationAction`.
- Keep `projectPath` reset behavior (`applyEmptyRepositoryChatState`).

## Acceptance Criteria

- Early typing before query completes: server draft applies when the user had not intentionally edited.
- Edit after query success before hydration completes: server values do not overwrite local draft.
- Post-hydration draft typing and autosave behavior unchanged.

## Outcome

- `App.tsx`: `userEditedBeforeHydrationRef`, `handleDraftChange`, one-shot hydration effect without `draft` in deps.
- `tests/repository-chat-hydration.test.ts`: early-typing vs intentional-edit cases; registered in `tests/run-tests.mjs`.
