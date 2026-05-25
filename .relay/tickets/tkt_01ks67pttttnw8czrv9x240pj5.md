---
schemaVersion: 1
id: tkt_01ks67pttttnw8czrv9x240pj5
title: Inject project agent context from `.relay/context/` markdown
ticketType: feature
draftTargetType: null
status: archive
position: 22000
priority: medium
effort: medium
labels:
  - agents
  - context
  - storage
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ks6954hsm20dvs34avqbzgz8
  - tkt_01ks6954jf7s1aj6phafmw4x8m
  - tkt_01ks6954jrqay0ng3wwmd1hdf6
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:40:17.370Z'
updatedAt: '2026-05-25T12:53:24.411Z'
authoringState: ready
summary: >-
  Relay loads top-level `.relay/context/*.md` (excluding README), enforces 16
  KiB/file and 32 KiB total budgets, and injects a shared Project context
  section into all six agent prompt paths. Disk-only v1 with path bootstrap,
  loader service, codex wiring, and unit tests.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Inject project agent context from `.relay/context/` markdown

## Context

Teams need durable project-wide instructions that every Relay agent run sees automatically. This feature reserves `.relay/context/`, loads top-level `*.md` on disk (non-recursive), and prepends a bounded section to all agent prompts. Context stays disk-only—no sidebar browse/edit. Only `README.md` is excluded from injection.

## Outcome

Delivered via three archived tasks: `contextPath` and first-init bootstrap with README plus SPEC §5.2 docs; `src/services/project-context/` loader and formatter with per-file (16 KiB) and total (32 KiB) truncation; codex injection through `resolveProjectContextPromptSection` for implementation, draft intake, ticket draft, hierarchy draft, ticket update, and repository chat. `tests/project-context.test.ts` covers loader behavior and `buildExecutionInput` integration. Projects that already had `project.json` before this slice may still lack `.relay/context/` until a later init/backfill path runs.

## Requirements

- Reserve `.relay/context/` with path helper, first-init directory/README creation, and SPEC documentation.
- Load top-level `*.md` lexicographically, skip `README.md`, enforce 16 KiB per file and 32 KiB total with `...` truncation.
- Prepend a consistent Project context section in all codex prompt builders when injectable files exist; omit when empty or missing.
- Cover implementation, draft intake, ticket draft, hierarchy draft, ticket update, and repository chat for all providers.
- No HTTP APIs, renderer UI, or sidebar context management in this slice.

## Acceptance Criteria

- Fresh init creates `.relay/context/` and README; re-init does not overwrite README.
- Injectable files (e.g. `coding-rules.md`) appear in agent prompts; README body never does.
- Combined injected content respects budgets with visible truncation when exceeded.
- All six agent work kinds share the same project-context section when files exist.
- Empty or missing context leaves prompt behavior unchanged aside from shared refactors.
- No new UI or REST endpoints for context files.
