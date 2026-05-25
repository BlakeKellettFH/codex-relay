---
schemaVersion: 1
id: tkt_01ksf03k156jwpq2s0avhvw37h
title: Archive ticket HTTP API and bundle orchestration
ticketType: task
draftTargetType: null
status: review
position: 10000
priority: medium
effort: medium
labels:
  - api
  - backend
parentEpicId: null
parentFeatureId: tkt_01kseyph9agqpws8zz0w4q2h2m
subticketIds: []
plannedFiles:
  - src/renderer/src/lib/boardArchive.ts
  - src/services/codex/index.ts
  - src/shared/http/tickets.ts
  - src/http/resources/tickets.ts
  - src/workflows/tickets.ts
  - src/renderer/src/lib/relayApi.ts
  - src/renderer/src/lib/relayQueries.ts
  - tests/board-archive.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:20:36.645Z'
updatedAt: '2026-05-25T07:34:31.974Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::89897388-0b52-42e8-bc62-239b0c3de809'
runStatus: completed
lastRunId: run_01ksf081dv4x7kqhm891p1erpx
lastRunStartedAt: '2026-05-25T07:30:31.843Z'
---
# Archive ticket HTTP API and bundle orchestration

## Context

Parent feature: Archive completed tickets with lean agent summaries

Renderer and board archive buttons will call this instead of move-only mutations.

## Goal

Clients can archive one ticket or a container bundle with correct ordering.

## Requirements

- archiveTicket(projectPath, ticketId) runs archive update and returns ticket/board snapshot.
- archiveTicketBundle sorts ids tasks→features→epic before sequential archiveTicket calls.
- HTTP route registered and typed in shared/http + relayApi.

## Acceptance Criteria

- Bundle with a failing mid-sequence archive leaves earlier tickets summarized only if already completed steps succeeded; later ids are not archived.
- sortArchiveBundleIds unit tests pass in board-archive.test.ts.

## Implementation Plan

- Add sortArchiveBundleIds to boardArchive.ts using ticket summaries from readBoard.
- Implement archiveTicket/archiveTicketBundle in codex service; wire TicketWorkflows + tickets route.
- Add archive endpoint schema, relayApi.tickets.archive, useArchiveTicketMutation.

## Assumptions

- None.

## Codex Handoff

### 5/25/2026, 8:34:31 AM

Implementing the archive ticket HTTP API and bundle orchestration. Exploring the codebase for existing patterns.
Implementing archive API across the planned files.
Implemented the archive ticket HTTP API and bundle orchestration per the ticket.

## Summary of changes

**Archive orchestration (`src/services/codex/index.ts`)**
- `archiveTicket` — validates archive column, runs agent update with `purpose: "archive"`, polls until status is `archive`, returns `{ ticket, board }`.
- `archiveTicketBundle` — sorts IDs via `sortArchiveBundleIds` (tasks → features → epics), archives sequentially; on mid-sequence failure, earlier successful archives remain and later IDs are not processed.

**HTTP & workflows**
- `POST /api/tickets/archive` with `ticketArchiveInputSchema` / `ticketArchiveResultSchema` in `src/shared/http/tickets.ts`.
- Route in `src/http/resources/tickets.ts` accepts `ticketId` (single) or `ticketIds` (bundle).
- `TicketWorkflows.archiveTicket` / `archiveTicketBundle` in `src/workflows/tickets.ts`.

**Renderer API**
- `relayApi.tickets.archive` and `useArchiveTicketMutation` with board/ticket cache updates and invalidation for all archived IDs.

**Tests**
- `sortArchiveBundleIds` test added to `tests/board-archive.test.ts` (acceptance criteria).

## Files changed

- `src/services/codex/index.ts`
- `src/shared/http/tickets.ts`
- `src/http/resources/tickets.ts`
- `src/workflows/tickets.ts`
- `src/renderer/src/lib/relayApi.ts`
- `src/renderer/src/lib/relayQueries.ts`
- `tests/board-archive.test.ts`

(`src/renderer/src/lib/boardArchive.ts` already had `sortArchiveBundleIds` and `ARCHIVE_TICKET_UPDATE_REQUEST`.)

## Commands run

None — shell execution was unavailable in this session.

## Tests

Please run locally:

```bash
node tests/run-tests.mjs tests/board-archive.test.ts
```

Expected: `sortArchiveBundleIds` orders tasks before features before epics.

## Subagent usage

None used.

## Remaining risks / follow-up

- **UI wiring** (sibling ticket `tkt_01ksf03k1r7gsmkpsjkch67jh7`): `App.tsx` still uses `useStartTicketUpdateMutation` + polling; can switch to `useArchiveTicketMutation` now that the API exists.
- **Integration tests** for `archiveTicket` / bundle partial-failure behavior would need mocked agent providers (not added here).
- **Archive timeout** is 120s per ticket; large bundles run sequentially and can take a while.


No Codex run has been started.
