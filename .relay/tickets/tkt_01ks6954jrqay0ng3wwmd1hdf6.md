---
schemaVersion: 1
id: tkt_01ks6954jrqay0ng3wwmd1hdf6
title: Inject project context into all agent prompts
ticketType: task
draftTargetType: null
status: archive
position: 21000
priority: medium
effort: medium
labels:
  - agents
  - codex
parentEpicId: null
parentFeatureId: tkt_01ks67pttttnw8czrv9x240pj5
subticketIds: []
plannedFiles:
  - src/services/codex/index.ts
  - tests/project-context.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T22:05:34.680Z'
updatedAt: '2026-05-25T12:52:45.609Z'
authoringState: ready
summary: >-
  Project context from `.relay/context/*.md` is injected into all six codex
  agent prompt paths via `resolveProjectContextPromptSection`, with a single
  load per invocation and an integration test on `buildExecutionInput`.
codexThreadId: 'cursor::fd904a4c-8a71-4eda-993d-58a0c7b343b1'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Inject project context into all agent prompts

## Requirements

- `resolveProjectContextPromptSection(projectPath)` in the codex service, using the project-context formatter.
- Load context once per run in `buildExecutionInput` / `buildExecutionPrompt`.
- Inject into draft intake, ticket draft, hierarchy draft, ticket update, repository chat, and provider `buildExecutionPrompt` paths.
- Test that `buildExecutionInput` includes fixture context and excludes README.

## Acceptance Criteria

- Implementation prompt includes context file body when present.
- Draft intake prompt includes the same section for the same project.
- Empty context directory leaves prompt structure unchanged aside from shared refactors.
- Provider and `buildExecutionInput` paths both inject context.

## Delivered

- `resolveProjectContextPromptSection` and `formatProjectContextBlock` insert context after each prompt’s opening role paragraph with override guidance.
- All six prompt builders accept optional `projectContextSection`; async call sites await resolve once per invocation.
- `tests/project-context.test.ts`: `buildExecutionInput` includes fixture `conventions.md`, excludes README.
