---
schemaVersion: 1
id: tkt_01ksezn58z7ehdz41qqb5fvhh6
title: Add blockedByTitles to lean task draft schema and Codex prompts
ticketType: task
draftTargetType: null
status: review
position: 6000
priority: medium
effort: medium
labels:
  - drafting
  - schema
parentEpicId: null
parentFeatureId: tkt_01ksez0nykeeqpkqty81dcnm03
subticketIds: []
plannedFiles:
  - src/shared/schemas/ticket.ts
  - src/services/codex/index.ts
  - tests/schemas.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:12:43.807Z'
updatedAt: '2026-05-25T07:28:12.661Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::0de8b83c-1fad-4111-92d3-52d26c8a161d'
runStatus: completed
lastRunId: run_01ksf0b0ak7h04m80zwwtcsmec
lastRunStartedAt: '2026-05-25T07:26:19.273Z'
---
# Add blockedByTitles to lean task draft schema and Codex prompts

## Context

Parent feature: Feature lean-task dependencies and Ready-wait behavior

First slice: data model and agent contract only; no board or filesystem apply changes yet.

## Goal

Lean task drafts and Codex/Cursor draft responses can include blockedByTitles.

## Requirements

- leanTaskDraftSchema and leanTaskDraftSchemaJson accept optional blockedByTitles string array.
- normalizeLeanTaskDraft trims, dedupes, and drops empty title strings.
- Feature-mode draft prompt tells agents to use blockedByTitles for sibling dependencies only.

## Acceptance Criteria

- Parse valid hierarchy draft plan containing leanTasks[].blockedByTitles.
- Codex draft JSON schema validates the new field without breaking existing drafts.

## Implementation Plan

- Add blockedByTitles: withDefault(stringArrayWithDefault()) to leanTaskDraftSchema in ticket.ts.
- Mirror field in leanTaskDraftSchemaJson and normalizeLeanTaskDraft in codex/index.ts.
- Add prompt bullet near lean task guidance describing sibling-title dependencies.
- Add schemas.test.ts cases for present/absent blockedByTitles.

## Assumptions

- Field name blockedByTitles is preferred over dependsOn for symmetry with blockedByIds.

## Codex Handoff

### 5/25/2026, 8:28:12 AM

Implementing `blockedByTitles` on the lean task draft schema and Codex prompts. Reading the planned files to match existing patterns.
Implementing the three file changes.
Using `stringArrayWithDefault()` to match other lean task fields — it already includes a default.
## Summary of changes

Added optional `blockedByTitles` to the lean task draft data model and Codex agent contract so feature drafts can declare sibling-task dependencies by title (resolved to `blockedByIds` in a later slice).

## Files changed

- `src/shared/schemas/ticket.ts` — `blockedByTitles: stringArrayWithDefault()` on `leanTaskDraftSchema`
- `src/services/codex/index.ts` — JSON schema property, `normalizeLeanTaskDraft` via `cleanStringList`, prompt bullets for hierarchy and feature drafts
- `tests/schemas.test.ts` — parse tests for absent/present `blockedByTitles` and hierarchy plans with the field

## Commands run

None (shell execution was unavailable in this session).

## Tests run and results

Not run here. Recommended locally:

```bash
node tests/run-tests.mjs
# or targeted:
npx tsx --test tests/schemas.test.ts
```

## Subagent usage

None used.

## Remaining risks / follow-up

- **Apply/materialize** — `blockedByTitles` is schema + prompts only; a follow-up ticket should map titles → `blockedByIds` when applying feature trees.
- **Normalization tests** — trim/dedupe/empty-drop is in `normalizeLeanTaskDraft` via `cleanStringList`; only Effect-schema parsing is covered in `schemas.test.ts`.
- **Codex JSON schema** — field is optional in `leanTaskDraftSchemaJson` (not in `required`); existing drafts without it should still validate.


No Codex run has been started.
