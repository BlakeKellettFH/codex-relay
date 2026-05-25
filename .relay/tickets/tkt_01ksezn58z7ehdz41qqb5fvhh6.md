---
schemaVersion: 1
id: tkt_01ksezn58z7ehdz41qqb5fvhh6
title: Add blockedByTitles to lean task draft schema and Codex prompts
ticketType: task
draftTargetType: null
status: archive
position: 31000
priority: medium
effort: medium
labels:
  - drafting
  - schema
parentEpicId: null
parentFeatureId: tkt_01ksez0nykeeqpkqty81dcnm03
subticketIds: []
plannedFiles:
  - src/services/codex/index.ts
  - src/shared/schemas/ticket.ts
  - tests/schemas.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:12:43.807Z'
updatedAt: '2026-05-25T14:50:02.519Z'
authoringState: ready
summary: >-
  Added optional blockedByTitles to the lean task draft schema and Codex prompts
  so feature drafts can declare sibling dependencies by title; mapping titles to
  blockedByIds on apply is a follow-up slice.
codexThreadId: 'cursor::0de8b83c-1fad-4111-92d3-52d26c8a161d'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add blockedByTitles to lean task draft schema and Codex prompts

## Requirements

- Optional `blockedByTitles` string array on `leanTaskDraftSchema` and Codex `leanTaskDraftSchemaJson`.
- `normalizeLeanTaskDraft` trims, dedupes, and drops empty title strings via `cleanStringList`.
- Feature-mode draft prompt tells agents to use `blockedByTitles` for sibling dependencies only.

## Acceptance Criteria

- Hierarchy draft plans parse with `leanTasks[].blockedByTitles`.
- Codex draft JSON schema accepts the field; drafts without it still validate.

## Delivered

- `ticket.ts`: `blockedByTitles` on `leanTaskDraftSchema`.
- `codex/index.ts`: JSON schema property, normalization, hierarchy and feature prompt bullets.
- `schemas.test.ts`: parse coverage for absent and present `blockedByTitles`.

## Follow-up

- Apply/materialize: resolve `blockedByTitles` → `blockedByIds` when persisting feature trees.
