---
schemaVersion: 1
id: tkt_01ks67pttttnw8czrv9x240pj5
title: Inject project agent context from `.relay/context/` markdown
ticketType: feature
draftTargetType: null
status: completed
position: 14000
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
updatedAt: '2026-05-22T07:11:01.739Z'
authoringState: reviewing
summary: >-
  Relay will load optional markdown files from `.relay/context/` and prepend
  them to every agent prompt so coding rules and project background persist
  across drafting, updates, and implementation runs.


  - Disk-only workflow: users add or edit `.md` files in Finder or the terminal;
  no sidebar UI in this slice.

  - New storage path, loader with size limits, and wiring into all
  `src/services/codex/index.ts` prompt builders.

  - Provider-agnostic: Codex, Cursor, and Claude runs share the same injected
  section.


  Main risk is prompt bloat; enforce per-file and total truncation and verify
  with focused unit tests.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ks68ytgvbbfptjeqehabs5vc
lastRunStartedAt: null
---
# Inject project agent context from `.relay/context/` markdown

## Context

Teams need durable, project-wide instructions (coding standards, architecture notes, product goals) that every Relay agent run sees automatically. Today prompts only include ticket markdown, clarifications, board excerpts, and planned scope—nothing reads `.relay/context/`. This feature adds that directory, loads top-level markdown on disk, and injects a bounded section into all agent work kinds. Per clarification, context stays disk-only indefinitely (no sidebar browse/edit).

## Goal

Reserve `.relay/context/` in project storage: path helper, directory creation on `initializeProject`, and SPEC §5.2 documentation.

## Decisions / Assumptions

- Disk-only indefinitely: no sidebar browse/edit slice (user answered "no can stay on disk no side br").
- v1 reads only top-level `.relay/context/*.md` (no subdirectories); nested folders are a follow-up.
- Only `README.md` is excluded from injection; all other `*.md` files are included.
- Per-file max 16 KiB and total max 32 KiB injected characters; truncate with `...` suffix consistent with `truncatePromptText` behavior.

## Requirements

- Reserve `.relay/context/` in project storage: path helper, directory creation on `initializeProject`, and SPEC §5.2 documentation.
- Ship a disk-only `README.md` in `.relay/context/` explaining how to add markdown context files; do not inject README into agent prompts.
- Implement a loader that reads top-level `*.md` files from `.relay/context/` (non-recursive), sorted lexicographically, skipping `README.md`, with per-file (16 KiB) and total (32 KiB) budgets and truncation markers.
- Prepend a consistent "Project context" markdown section to every agent prompt builder in `src/services/codex/index.ts` when at least one injectable file exists; omit the section when the directory is empty or missing.
- Apply injection to implementation, draft intake, ticket draft, hierarchy draft, ticket update, and repository chat prompts for all providers.
- Do not add HTTP APIs, renderer UI, or sidebar browse/edit for context files in this feature.

## Acceptance Criteria

- New Relay projects get `.relay/context/` with README; existing projects gain the directory on next `initializeProject` without breaking board state.
- With `coding-rules.md` present, implementation and draft prompts include a "Project context" section citing that file; with no injectable markdown, prompts match current behavior.
- README.md in `.relay/context/` is never injected; combined injected content respects 32 KiB total with visible truncation when exceeded.
- All six agent work kinds receive the same project-context section when files exist.
- No new UI or REST endpoints for context management.

## Test Plan

- `node tests/run-tests.mjs` — new `tests/project-context.test.ts`: loader reads/sorts files, skips README, truncates oversized content, returns empty when no injectable files.
- `node tests/run-tests.mjs` — extend or add test asserting `buildExecutionPrompt` (or `buildExecutionInput` text) contains a marker from a fixture `.relay/context/rules.md` while README body does not appear.
- Manual: initialize a project, add `coding-rules.md`, run ticket draft and implementation; confirm agent prompt includes the section in run logs.

## Implementation Notes

- Codebase finding: `src/storage/paths.ts` defines relay paths (`projectRelayPath`, `ticketsPath`, `clarificationsPath`, etc.) but no `context/` helper yet.
- Codebase finding: `initializeProject` in `src/storage/filesystem.ts` (lines 175–205) creates `tickets/`, `runs/`, `clarifications/`, `attachments/`, `backups/`—not `context/`.
- Codebase finding: SPEC.md §5.2 documents required `.relay/` layout without `context/`; §7.3 says project context MAY be added later and v1 SHOULD avoid scanning large project contents during drafting.
- Codebase finding: `src/shared/pathScope.ts` `isRelayManagedPath` treats all `.relay/**` as managed (excluded from path-lock/planned-scope enforcement)—context files are safe metadata.
- Codebase finding: All agent prompts are built in `src/services/codex/index.ts`: `buildExecutionPrompt` / `buildExecutionInput` (implementation), `buildDraftIntakePrompt`, inline templates in `createTicketDraftPromise` and hierarchy draft (~1870), `buildTicketUpdatePrompt`, `buildRepositoryChatPrompt`. `truncatePromptText` (line 1235) is the existing truncation pattern.
- Codebase finding: Agent kinds in `src/services/agents/index.ts`: `ticket.draft`, `ticket.draft_intake`, `ticket.hierarchy_draft`, `ticket.update`, `ticket.implementation`, `repository.chat`—all receive a single `prompt` string from codex service.
- Implementation: Add `contextPath` to `src/storage/paths.ts` and create `.relay/context/` in `initializeProject`; update SPEC.md §5.2 layout and rules.
- Implementation: Add `src/services/project-context/index.ts` with `loadProjectContextDocuments` and `formatProjectContextPromptSection(projectPath)` returning `''` or a bounded markdown block with `## <filename>` headings.
- Implementation: Write bootstrap `.relay/context/README.md` on init (document filename conventions and size limits; state that agents read other `.md` files automatically).
- Implementation: In `src/services/codex/index.ts`, add `resolveProjectContextPromptSection(projectPath)` and pass its result into `buildExecutionPrompt`, `buildExecutionInput`, `buildDraftIntakePrompt`, draft/hierarchy draft prompt assembly, `buildTicketUpdatePrompt`, `buildRepositoryChatPrompt`, and the provider implementation path at ~5210.
- Implementation: Place the project-context block immediately after each prompt's opening role paragraph and before ticket-specific content; add one sentence telling agents to follow project context unless a ticket explicitly overrides it.
- Implementation: Register `tests/project-context.test.ts` in `tests/run-tests.mjs` entryPoints.
- Keep loader in `src/services/project-context/` to avoid growing `codex/index.ts` further; codex service only orchestrates `await formatProjectContextPromptSection(projectPath)`.
- Refactor prompt builders to accept an optional `projectContextSection: string` parameter rather than duplicating load calls.
- Do not implement the trashed epic's sidebar/modal CRUD (`tkt_01ks67615`); that is a separate future feature if ever requested.
- Feature root `plannedFiles` may be empty per schema; executable paths live on lean tasks.

## Codex Handoff

No Codex run has been started.
