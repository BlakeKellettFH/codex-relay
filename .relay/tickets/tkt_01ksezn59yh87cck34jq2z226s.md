---
schemaVersion: 1
id: tkt_01ksezn59yh87cck34jq2z226s
title: Materialize lean-task blockedByTitles when applying feature trees
ticketType: task
draftTargetType: null
status: review
position: 8000
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
updatedAt: '2026-05-25T07:31:49.458Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::a3508756-e82c-476d-99a2-e13a7340d0a4'
runStatus: completed
lastRunId: run_01ksf0b0fwdw4024n2k9485tar
lastRunStartedAt: '2026-05-25T07:27:26.666Z'
---
# Materialize lean-task blockedByTitles when applying feature trees

## Context

Parent feature: Feature lean-task dependencies and Ready-wait behavior

Depends on blockedByTitles schema from prior lean task.

## Goal

applyHierarchyDraftPlan writes correct blockedByIds for feature and extend plans.

## Requirements

- Shared resolver maps lean task titles to created ticket IDs and returns warnings for cycles, self-deps, and unknown titles.
- applyFeatureTreePlan, epic_tree, extend_epic, and extend_feature paths run two-pass sibling creation and patch blockedByIds.
- createTaskUnderFeatureRecord callers pass resolved blockedByIds or use a post-create patch helper.

## Acceptance Criteria

- feature_tree apply with B blockedByTitles ["A"] yields B.frontMatter.blockedByIds containing A's id.
- Circular A↔B titles log warnings and do not write invalid blocker links.

## Implementation Plan

- Create src/shared/leanTaskDependencies.ts with resolveLeanTaskBlockedByTitles(leanTasks, titleToIdMap).
- In filesystem.ts applyFeatureTreePlan, collect created records, build title→id map, patch each task's blockedByIds.
- Apply same pattern in epic_tree, extend_epic, and extend_feature loops.
- Add backend.test.ts hierarchy apply cases for linear chain, cycle, and missing title.

## Assumptions

- Title matching is case-insensitive; first created task wins on duplicate titles.

## Codex Handoff

### 5/25/2026, 8:31:49 AM

Implementing lean-task `blockedByTitles` resolution for feature-tree hierarchy applies. Exploring the codebase and planned files.
Implementing the shared resolver and updating hierarchy-apply paths to use two-pass creation with dependency patching.
## Summary of changes

Lean-task `blockedByTitles` from hierarchy drafts are now resolved to real `blockedByIds` when feature trees are applied.

1. **`src/shared/leanTaskDependencies.ts`** — Shared resolver with case-insensitive title matching, unknown-title/self-dependency warnings, cycle detection, and `buildLeanTaskTitleToIdMap` (first created task wins on duplicate titles).

2. **`src/storage/filesystem.ts`** — Two-pass flow via `createLeanTasksUnderFeatureWithDependencies`: create sibling tasks, build title→id map, resolve dependencies, log warnings with `logWarn`, patch `blockedByIds`. Used by `feature_tree`, `epic_tree`, `extend_epic`, and `extend_feature`.

3. **`tests/backend.test.ts`** — Three hierarchy apply tests: linear chain (B blocks A), cycle (A↔B → empty blockers), missing title (ignored).

## Files changed

- `src/shared/leanTaskDependencies.ts` (new)
- `src/storage/filesystem.ts`
- `tests/backend.test.ts`

## Commands run

None — shell execution was unavailable in this session.

## Tests run and results

Not run here. Please verify locally:

```bash
RELAY_TEST_RUN=1 npm test
```

Or filter to the new cases:

```bash
# after npm test build, or use your usual test runner with:
--test-name-pattern=feature_tree
```

## Subagent usage

None used.

## Remaining risks / follow-up

- **`applyTicketDraftToTicket`** (feature drafts with `leanTasks`) still creates tasks without resolving `blockedByTitles`; out of this ticket’s file scope.
- **Duplicate lean-task titles** in one batch: first created ID wins for resolution; duplicates share the same normalized-title resolution entry.
- Run `npm test` locally to confirm the three new backend tests pass with the rest of the suite.


No Codex run has been started.
