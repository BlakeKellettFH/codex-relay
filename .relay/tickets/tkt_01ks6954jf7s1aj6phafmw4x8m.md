---
schemaVersion: 1
id: tkt_01ks6954jf7s1aj6phafmw4x8m
title: Implement project context loader and prompt formatter
ticketType: task
draftTargetType: null
status: archive
position: 20000
priority: medium
effort: medium
labels:
  - agents
parentEpicId: null
parentFeatureId: tkt_01ks67pttttnw8czrv9x240pj5
subticketIds: []
plannedFiles:
  - src/services/project-context/index.ts
  - tests/project-context.test.ts
  - tests/run-tests.mjs
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T22:05:34.671Z'
updatedAt: '2026-05-25T12:52:18.548Z'
authoringState: ready
summary: >-
  Added a project context loader and prompt formatter that reads top-level
  `.relay/context/*.md` files with 16 KiB per-file and 32 KiB total content
  budgets, plus unit tests.
codexThreadId: 'cursor::434bfb29-07a5-4522-8f3c-4060145562d7'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Implement project context loader and prompt formatter

## Requirements

- Export `loadProjectContextDocuments` and `formatProjectContextPromptSection` from `src/services/project-context/index.ts` using Effect `FileSystem` / `readDirectory` (same pattern as ticket reads).
- Return empty array or empty string when `.relay/context/` is missing or has no injectable `.md` files.
- Format output as `Project context (from .relay/context/):` followed by `## filename` sections.
- Enforce 16 KiB per-file and 32 KiB total content budgets with `...` truncation.
- Add `tests/project-context.test.ts` and register it in `tests/run-tests.mjs`.

## Acceptance Criteria

- Loader returns lexicographically sorted `.md` documents; `README.md` and non-`.md` entries are ignored.
- Oversized content is truncated per file and across the total budget; files beyond the budget are omitted.
- Missing or non-injectable context yields empty results.
- Tests pass via `node tests/run-tests.mjs`.
