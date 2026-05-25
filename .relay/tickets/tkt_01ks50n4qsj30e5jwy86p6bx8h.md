---
schemaVersion: 1
id: tkt_01ks50n4qsj30e5jwy86p6bx8h
title: Add provider selection persistence and switchability APIs
ticketType: task
draftTargetType: null
status: completed
position: 1000
priority: high
effort: medium
labels:
  - backend
  - agent-providers
  - api
parentEpicId: null
parentFeatureId: tkt_01ks4yxwpdrp66tcf70ydvzw6p
subticketIds: []
plannedFiles:
  - src/shared/schemas/registry.ts
  - src/shared/schemas/agents.ts
  - src/shared/schemas/index.ts
  - src/services/registry/index.ts
  - src/shared/http/agents.ts
  - src/shared/http/index.ts
  - src/http/resources/agents.ts
  - src/http/resources/index.ts
  - tests/schemas.test.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T10:17:47.513Z'
updatedAt: '2026-05-21T11:05:38.946Z'
authoringState: ready
summary: ''
codexThreadId: 019e4a2a-8f3b-7c20-89e6-f0b94ab1fe81
runStatus: completed
lastRunId: run_01ks52n2bnk8jmnbzvxe1rnn7b
lastRunStartedAt: '2026-05-21T10:52:42.326Z'
---
# Add provider selection persistence and switchability APIs

## Context

Parent feature: Add switchable agent CLI selection and provider status modal

The current codebase only has codex-scoped status APIs and no app-local provider selection. This task should add the provider-management contract without renaming existing codex run endpoints.

## Goal

Persist a global selected provider and expose backend APIs for provider status and safe switching.

## Requirements

- Add a shared provider schema that represents `codex`, `cursor`, and `claude`, their install/auth states, and the selected provider id.
- Extend app-local registry state so Relay can persist the selected provider across restarts while defaulting existing users to Codex.
- Add additive HTTP endpoints for reading provider inventory/current selection and for switching providers.
- Reject switch requests when the target provider is unavailable, unauthenticated, `status unknown`, or when busy work exists across registered projects.
- Use work-ledger snapshots rather than sidebar counts to decide whether Relay is idle enough to switch.

## Acceptance Criteria

- A backend read call returns three provider rows plus the selected provider id and switchability metadata.
- A switch call persists the new provider to registry state when allowed and returns the updated selection.
- A blocked switch returns a deterministic error/message and does not mutate registry state.
- Schema tests cover default migration behavior for installs that do not yet have a selected provider field.

## Implementation Plan

- Add provider schemas and registry fields in shared schema and registry store modules.
- Implement a provider status service that aggregates Codex, Cursor, and Claude probe results into a single API response.
- Add provider inventory and provider switch endpoints plus route registration and client exports.
- Implement the busy-work guard by reading incomplete work snapshots across registry projects and filtering to active processing statuses.
- Add backend and schema tests for persistence, successful switching, and blocked switching.

## Assumptions

- Selection is global to the local app instance, not per project.
- Busy statuses include `created`, `queued`, `running`, `cancelling`, and `stale` for switch blocking.

## Codex Handoff

### 5/21/2026, 12:02:54 PM

**Summary**
Added shared provider schemas plus additive provider APIs for `GET /api/agents/providers` and `POST /api/agents/providers/switch`. Registry state now persists a global `selectedProviderId` with legacy installs defaulting to `codex`, and switching is blocked deterministically when the target is unavailable, unauthenticated, unknown, or when active work-ledger snapshots exist in any registered project.

I implemented the provider aggregation in [src/services/registry/index.ts](/Users/blakekellett/repos/codex-relay/src/services/registry/index.ts), using Codex’s existing status probe and conservative PATH/env/file probes for Cursor and Claude. The switch guard reads incomplete work snapshots and blocks on `created`, `queued`, `running`, `cancelling`, and `stale`, as required.

**Files Changed**
- [src/http/resources/agents.ts](/Users/blakekellett/repos/codex-relay/src/http/resources/agents.ts)
- [src/http/resources/index.ts](/Users/blakekellett/repos/codex-relay/src/http/resources/index.ts)
- [src/services/registry/index.ts](/Users/blakekellett/repos/codex-relay/src/services/registry/index.ts)
- [src/shared/http/agents.ts](/Users/blakekellett/repos/codex-relay/src/shared/http/agents.ts)
- [src/shared/http/index.ts](/Users/blakekellett/repos/codex-relay/src/shared/http/index.ts)
- [src/shared/schemas/agents.ts](/Users/blakekellett/repos/codex-relay/src/shared/schemas/agents.ts)
- [src/shared/schemas/index.ts](/Users/blakekellett/repos/codex-relay/src/shared/schemas/index.ts)
- [src/shared/schemas/registry.ts](/Users/blakekellett/repos/codex-relay/src/shared/schemas/registry.ts)
- [tests/backend.test.ts](/Users/blakekellett/repos/codex-relay/tests/backend.test.ts)
- [tests/schemas.test.ts](/Users/blakekellett/repos/codex-relay/tests/schemas.test.ts)

**Commands Run**
- `cat package.json`
- `pnpm exec tsc --noEmit`
- `pnpm exec tsx --test tests/schemas.test.ts tests/backend.test.ts`
- `./node_modules/.bin/tsc --noEmit`
- `node --input-type=module -e '...esbuild targeted test harness for backend.test.ts and schemas.test.ts...'`
- `git diff -- src/http/resources/agents.ts src/http/resources/index.ts src/services/registry/index.ts src/shared/http/agents.ts src/shared/http/index.ts src/shared/schemas/agents.ts src/shared/schemas/index.ts src/shared/schemas/registry.ts tests/backend.test.ts tests/schemas.test.ts`
- `git status --short ...`

**Tests Run**
- Targeted backend/schema tests via the repo’s esbuild harness: `102` tests passed, `0` failed.
- `pnpm` commands could not run in this sandbox because Corepack attempted a network fetch.
- `./node_modules/.bin/tsc --noEmit` reports existing unrelated repo type errors outside this ticket’s scope; the targeted provider changes passed the bundled test run.

**Subagent Usage**
- none used

**Remaining Risks / Follow-Up**
- Cursor and Claude auth detection is intentionally conservative and currently based on PATH plus env/file heuristics. If product wants different install/auth semantics for those providers, that probe contract should be refined explicitly.
- Full repo typecheck is not green today due pre-existing unrelated errors, so only the targeted bundled tests were used for verification.


No Codex run has been started.
