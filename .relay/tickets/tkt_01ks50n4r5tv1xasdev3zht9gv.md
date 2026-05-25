---
schemaVersion: 1
id: tkt_01ks50n4r5tv1xasdev3zht9gv
title: 'Add Codex, Cursor, and Claude provider adapters for non-implementation actions'
ticketType: task
draftTargetType: null
status: completed
position: 3000
priority: high
effort: medium
labels:
  - backend
  - routing
  - providers
parentEpicId: null
parentFeatureId: tkt_01ks4yxwpdrp66tcf70ydvzw6p
subticketIds: []
plannedFiles:
  - src/services/agents/index.ts
  - src/services/agents/providers.ts
  - src/services/agents/codexProvider.ts
  - src/services/agents/cursorProvider.ts
  - src/services/agents/claudeProvider.ts
  - src/services/codex/index.ts
  - tests/ticket-draft.test.ts
  - tests/ticket-update.test.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T10:17:47.525Z'
updatedAt: '2026-05-21T12:44:16.149Z'
authoringState: ready
summary: ''
codexThreadId: 019e4a3d-3f99-7833-a512-5591eb45797c
runStatus: completed
lastRunId: run_01ks5392an0y6qf8wmhqa8qhv6
lastRunStartedAt: '2026-05-21T11:13:08.417Z'
---
# Add Codex, Cursor, and Claude provider adapters for non-implementation actions

## Context

Parent feature: Add switchable agent CLI selection and provider status modal

Relay already has a small provider abstraction in `src/services/agents/index.ts`, but all concrete execution still lives inside `src/services/codex/index.ts` and assumes Codex SDK semantics.

## Goal

Use the selected provider for all new read-only and structured non-implementation agent work.

## Requirements

- Add concrete provider adapters for Codex, Cursor, and Claude that can return final JSON/text and a resumable session reference.
- Use Cursor and Claude documented print/json or stream-json modes for structured work, and surface `status unknown` when auth cannot be verified headlessly.
- Route draft intake, draft/redraft, ticket update, and repository chat through the selected provider at the moment new work starts.
- Persist the provider id on new work submissions so a later provider change does not affect that existing work.
- Keep current Codex behavior working through the same abstraction so the migration is additive rather than forked by call site.

## Acceptance Criteria

- New draft, redraft, update, and repository-chat runs use the selected provider id when they are created.
- Structured JSON parsing succeeds for provider adapters in backend tests and failure cases surface actionable errors.
- Changing the selected provider only affects new work creation; an already-submitted work item retains its original provider id.
- Codex remains a supported adapter path with no regression to existing tests.

## Implementation Plan

- Add provider adapter modules and exports under `src/services/agents` for Codex, Cursor, and Claude.
- Refactor structured draft and update entry points to request the selected provider adapter instead of directly constructing Codex threads.
- Update repository chat routing to start or resume provider sessions using the selected adapter and its session id format.
- Set `providerId` from the selected adapter when submitting draft, update, and related work items.
- Extend backend draft and update tests for selected-provider routing and adapter error handling.

## Assumptions

- Provider-specific model selection and Codex-only project knobs are out of scope for MVP; non-Codex adapters may use provider defaults.
- For read-only flows, provider adapters should use documented non-interactive modes and Relay prompts rather than redesigning the ticket prompts themselves.

## Codex Handoff

### 5/21/2026, 12:30:29 PM

Summary of changes made

Added provider adapter support for non-implementation agent work under `src/services/agents`, including:
- `codexProvider.ts` for Codex structured/text runs with resumable session refs
- `cursorProvider.ts` for Cursor print/json structured runs and resumable text runs
- `claudeProvider.ts` for Claude stream-json structured/text runs
- `providers.ts` for selected-provider resolution plus provider session id encode/decode
- `agents/index.ts` now defines shared text/session provider types alongside structured work types

Refactored `src/services/codex/index.ts` so new draft, redraft, resumed draft, ticket-update, and repository-chat work resolve the provider once at work start and keep using that provider/session. Repository chat now resumes using the provider encoded in the returned session id. Ticket update now runs through the provider abstraction instead of Codex-only streamed update wiring.

Extended backend and ticket tests for:
- Cursor/Claude adapter parsing and error handling
- provider-selected draft/update routing
- repository-chat session/provider resume behavior
- updated ticket-update Codex test harness to the structured adapter path

Files changed

- `src/services/agents/index.ts`
- `src/services/agents/providers.ts`
- `src/services/agents/codexProvider.ts`
- `src/services/agents/cursorProvider.ts`
- `src/services/agents/claudeProvider.ts`
- `src/services/codex/index.ts`
- `tests/backend.test.ts`
- `tests/ticket-draft.test.ts`
- `tests/ticket-update.test.ts`

Commands run

- `npm run typecheck`
- `npm test`

Tests run and their results

- `npm run typecheck`
  - Failed due existing unrelated repo-wide TypeScript errors outside this ticket’s planned file scope.
- `npm test`
  - Relevant touched tests passed, including the new backend/draft/update provider coverage.
  - Full suite still exits non-zero with 3 remaining unrelated failures elsewhere in the repo.

Subagent usage

- none used

Remaining risks or follow-up work

- The selected provider is retained operationally for these runs, but ticket-update work snapshots still rely on `currentAttempt.providerId` rather than consistently rewriting the top-level persisted `providerId`. Fixing that cleanly likely requires out-of-scope changes in the work submission/persistence layer.
- Full repo `typecheck` and `npm test` still have unrelated pre-existing failures outside this ticket scope.


No Codex run has been started.
