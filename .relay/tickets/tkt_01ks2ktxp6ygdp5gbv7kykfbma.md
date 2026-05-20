---
schemaVersion: 1
id: tkt_01ks2ktxp6ygdp5gbv7kykfbma
title: Remove the Generate Tickets feature end-to-end
ticketType: task
status: completed
position: 3000
priority: medium
effort: medium
labels:
  - tickets
  - frontend
  - backend
  - cleanup
parentEpicId: null
subticketIds: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-20T11:55:16.550Z'
updatedAt: '2026-05-20T12:14:17.765Z'
authoringState: ready
codexThreadId: 019e4541-2ca9-7f50-94a4-e04111e46ea1
runStatus: completed
lastRunId: run_01ks2kyv2ttp9z35hvdyz129rc
lastRunStartedAt: '2026-05-20T11:59:19.671Z'
---
# Remove the Generate Tickets feature end-to-end

## Context

Remove the Generate Tickets feature from Relay because it adds noise. This should be a full removal, not a hide-behind-flag change: delete the renderer entry point and modal flow, remove the renderer query/API contract, remove the backend suggestions endpoint and Codex service path, and delete obsolete suggestion-specific tests and styles while preserving manual draft creation and existing draft/redraft flows.

## Goal

Remove all user-facing Generate Tickets UI from the renderer, including the topbar button, modal components, modal-open state handling tied only to this feature, and feature-specific styles.

## Decisions / Assumptions

- Full removal is desired; no replacement UI, hidden flag, or temporary deprecation path is needed.
- It is acceptable to delete suggestion-only schema/types/tests rather than preserving compatibility for an internal API not used elsewhere.
- `ticket.suggestions` in `src/services/agents/index.ts` can be removed if no remaining runtime path depends on that enum member after feature deletion.

## Requirements

- Remove all user-facing Generate Tickets UI from the renderer, including the topbar button, modal components, modal-open state handling tied only to this feature, and feature-specific styles.
- Remove renderer-side API/query support for ticket suggestions so no code path calls `relayApi.tickets.generateSuggestions(...)` or references `ticketSuggestions` query keys/hooks.
- Remove the backend ticket suggestions HTTP contract and route, including `/api/tickets/suggestions` and related result types that exist only for this feature.
- Remove the Codex suggestion generation implementation and any feature-specific agent work kind or schema artifacts that are no longer referenced after endpoint removal.
- Keep manual ticket creation, draft intake, draft creation, redraft, repository chat, and other ticket flows behaviorally unchanged.

## Acceptance Criteria

- The renderer no longer shows any `Generate Tickets` entry point or suggestions modal, and there is no dead state/query wiring left for the feature.
- `relayApi`, query hooks, and shared HTTP contracts no longer expose a ticket suggestions operation.
- The backend no longer registers `/api/tickets/suggestions`, and the Codex service layer no longer contains `generateTicketSuggestions` or its unused schema/prompt plumbing.
- Suggestion-specific tests and styles are removed or updated so the suite passes without feature references.
- Manual draft creation and existing ticket draft/redraft behavior remain intact.

## Test Plan

- Run `node --test tests/ticket-draft-ui.test.tsx tests/schemas.test.ts` to verify remaining UI/schema coverage after removing suggestion-specific cases.
- Run `node --test tests/http-rest-api.test.ts tests/backend.test.ts` to catch contract or route regressions from deleting the suggestions endpoint.
- Run `node tests/run-tests.mjs` to confirm the project test manifest no longer references removed suggestion tests and the remaining suite still passes.
- Manually verify in the app that the board topbar no longer shows `Generate Tickets`, repository chat still opens, and manual draft creation / redraft flows still work.

## Implementation Notes

- Codebase finding: [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:1278) renders the topbar `Generate Tickets` button via `onGenerateTickets`; the same file defines `TicketSuggestionsModalContent` and `TicketSuggestionsModal`, and mounts the modal from `ticketSuggestionsOpen` state near [App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3484) and [App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3707).
- Codebase finding: [src/renderer/src/lib/relayQueries.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayQueries.ts:39) defines `relayQueryKeys.ticketSuggestions` and `useTicketSuggestionsQuery`, which calls `relayApi.tickets.generateSuggestions(...)` at [relayQueries.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayQueries.ts:104).
- Codebase finding: [src/renderer/src/lib/relayApi.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayApi.ts:86) exposes `tickets.generateSuggestions`; the client implementation wires it to `ticketEndpoints.generateSuggestions` at [relayApi.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayApi.ts:206) and [relayApi.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayApi.ts:271).
- Codebase finding: [src/shared/http/tickets.ts](/Users/blakekellett/repos/codex-relay/src/shared/http/tickets.ts:49) defines POST `/api/tickets/suggestions` as `ticketEndpoints.generateSuggestions`; [src/http/resources/tickets.ts](/Users/blakekellett/repos/codex-relay/src/http/resources/tickets.ts:41) serves it through `ticketRoutes` by calling `generateTicketSuggestions(projectPath)` and returning `TicketSuggestionsGenerateResult`.
- Codebase finding: [src/services/codex/index.ts](/Users/blakekellett/repos/codex-relay/src/services/codex/index.ts:1394) implements `generateTicketSuggestions`; the feature also has dedicated schema/types in [src/shared/schemas/ticket.ts](/Users/blakekellett/repos/codex-relay/src/shared/schemas/ticket.ts:208), agent work kind support in [src/services/agents/index.ts](/Users/blakekellett/repos/codex-relay/src/services/agents/index.ts:11), styles in [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:1740), service tests in [tests/ticket-suggestions.test.ts](/Users/blakekellett/repos/codex-relay/tests/ticket-suggestions.test.ts:1), UI tests in [tests/ticket-draft-ui.test.tsx](/Users/blakekellett/repos/codex-relay/tests/ticket-draft-ui.test.tsx:419), schema coverage in [tests/schemas.test.ts](/Users/blakekellett/repos/codex-relay/tests/schemas.test.ts:250), and explicit test runner entries in [tests/run-tests.mjs](/Users/blakekellett/repos/codex-relay/tests/run-tests.mjs:30).
- Implementation: Update `src/renderer/src/App.tsx` to remove `onGenerateTickets` from the board/topbar flow, delete `ticketSuggestionsOpen` state and conditional modal rendering, and remove `TicketSuggestionsModalContent` and `TicketSuggestionsModal` plus now-unused imports/icons/types.
- Implementation: Update `src/renderer/src/lib/relayQueries.ts` to delete `relayQueryKeys.ticketSuggestions` and `useTicketSuggestionsQuery`, and update any related types/imports left unused.
- Implementation: Update `src/renderer/src/lib/relayApi.ts` and `src/shared/http/tickets.ts` to remove the `tickets.generateSuggestions` client method and `ticketEndpoints.generateSuggestions` contract entry.
- Implementation: Update `src/http/resources/tickets.ts`, `src/services/codex/index.ts`, `src/shared/schemas/ticket.ts`, and `src/services/agents/index.ts` to remove the suggestions route, `generateTicketSuggestions`, suggestion response/schema/types, and the `ticket.suggestions` work kind if nothing else references it.
- Implementation: Delete obsolete suggestion-specific tests and CSS coverage in `tests/ticket-suggestions.test.ts`, the suggestion-related cases in `tests/ticket-draft-ui.test.tsx` and `tests/schemas.test.ts`, the test runner entry in `tests/run-tests.mjs`, and the `.ticket-suggestions*` / `.ticket-suggestion*` / `.ticket-suggestions-modal` styles in `src/renderer/src/styles.css`.
- Research was completed in read-only mode only; this draft does not verify compile/test results after deletion, so the implementation should run the listed tests and clean up any resulting unused imports/types.
- If any additional references surface outside the files above during compilation, they should be treated as removal follow-through rather than new product discovery because the feature scope is already fully decided.

## Codex Handoff

### 5/20/2026, 1:08:46 PM

**Summary**

Removed the Generate Tickets feature end-to-end. The renderer no longer exposes the topbar button, modal flow, or suggestion-open state; the renderer query/API contract no longer includes ticket suggestions; the backend no longer registers `/api/tickets/suggestions`; and the Codex service no longer contains suggestion-generation logic or the `ticket.suggestions` agent work kind. Suggestion-only schemas, styles, and tests were removed while leaving manual draft creation, draft/redraft, and repository chat flows in place.

**Files Changed**

- [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx)
- [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css)
- [src/renderer/src/lib/relayApi.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayApi.ts)
- [src/renderer/src/lib/relayQueries.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayQueries.ts)
- [src/shared/http/tickets.ts](/Users/blakekellett/repos/codex-relay/src/shared/http/tickets.ts)
- [src/http/resources/tickets.ts](/Users/blakekellett/repos/codex-relay/src/http/resources/tickets.ts)
- [src/shared/schemas/ticket.ts](/Users/blakekellett/repos/codex-relay/src/shared/schemas/ticket.ts)
- [src/services/codex/index.ts](/Users/blakekellett/repos/codex-relay/src/services/codex/index.ts)
- [src/services/agents/index.ts](/Users/blakekellett/repos/codex-relay/src/services/agents/index.ts)
- [tests/schemas.test.ts](/Users/blakekellett/repos/codex-relay/tests/schemas.test.ts)
- [tests/ticket-draft-ui.test.tsx](/Users/blakekellett/repos/codex-relay/tests/ticket-draft-ui.test.tsx)
- [tests/run-tests.mjs](/Users/blakekellett/repos/codex-relay/tests/run-tests.mjs)
- Deleted [tests/ticket-suggestions.test.ts](/Users/blakekellett/repos/codex-relay/tests/ticket-suggestions.test.ts)

**Commands Run**

- `rg -n "Generate Tickets|ticketSuggestions|generateSuggestions|generateTicketSuggestions|ticket\\.suggestions|TicketSuggestions|ticket-suggestions|ticket-suggestion" src tests`
- `git status --short`
- `sed -n ...` on the affected source and test files for targeted inspection
- `tsc -p tsconfig.json --noEmit`
- `node --test tests/ticket-draft-ui.test.tsx tests/schemas.test.ts`
- `node --test tests/http-rest-api.test.ts tests/backend.test.ts`
- `node tests/run-tests.mjs`

**Tests Run**

- `tsc -p tsconfig.json --noEmit`
  Result: passed.
- `node tests/run-tests.mjs`
  Result: passed, `181` passing / `0` failing / `4` skipped.
- `node --test tests/ticket-draft-ui.test.tsx tests/schemas.test.ts`
  Result: failed due this repo’s direct `node --test` path not handling `.tsx` and directory-style imports in this environment (`ERR_UNKNOWN_FILE_EXTENSION`, `ERR_UNSUPPORTED_DIR_IMPORT`).
- `node --test tests/http-rest-api.test.ts tests/backend.test.ts`
  Result: failed for the same environment reason (`ERR_UNSUPPORTED_DIR_IMPORT`).
- Manual app verification
  Result: not run.

**Subagent Usage**

- none used

**Remaining Risks / Follow-up**

- Manual verification is still outstanding for the board topbar, repository chat open/close behavior, and manual draft/redraft flows.
- The repo had unrelated pre-existing worktree changes in files such as `package-lock.json`, `src/services/codex/status.ts`, `tests/backend.test.ts`, and `tests/toast-notification.test.tsx`; I left those untouched.
- The ticket’s two direct `node --test ...` commands are not runnable in this environment without the project’s bundling/shim path, but the full bundled manifest run passed.


No Codex run has been started.
