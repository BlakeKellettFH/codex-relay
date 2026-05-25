---
schemaVersion: 1
id: tkt_01ksf03k156jwpq2s0avhvw37h
title: Archive ticket HTTP API and bundle orchestration
ticketType: task
draftTargetType: null
status: archive
position: 35000
priority: medium
effort: medium
labels:
  - api
  - backend
parentEpicId: null
parentFeatureId: tkt_01kseyph9agqpws8zz0w4q2h2m
subticketIds: []
plannedFiles:
  - src/http/resources/tickets.ts
  - src/renderer/src/lib/boardArchive.ts
  - src/renderer/src/lib/relayApi.ts
  - src/renderer/src/lib/relayQueries.ts
  - src/services/codex/index.ts
  - src/shared/http/tickets.ts
  - src/workflows/tickets.ts
  - tests/board-archive.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:20:36.645Z'
updatedAt: '2026-05-25T14:51:44.648Z'
authoringState: ready
summary: >-
  Added POST archive API for single tickets and sorted bundles
  (tasks→features→epics), with Codex agent summarization, workflows, renderer
  mutations, and sortArchiveBundleIds tests.
codexThreadId: 'cursor::89897388-0b52-42e8-bc62-239b0c3de809'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Archive ticket HTTP API and bundle orchestration

## Requirements

- `archiveTicket(projectPath, ticketId)` runs archive update and returns ticket/board snapshot.
- `archiveTicketBundle` sorts IDs tasks→features→epic, then archives sequentially.
- `POST /api/tickets/archive` registered with shared schemas; `relayApi.tickets.archive` and `useArchiveTicketMutation` update caches.

## Acceptance Criteria

- Mid-sequence bundle failure leaves only earlier successful archives summarized; later IDs are not archived.
- `sortArchiveBundleIds` unit tests pass in `tests/board-archive.test.ts`.

## Delivered

- Codex `archiveTicket` / `archiveTicketBundle` (120s timeout per ticket); workflows and HTTP route accept `ticketId` or `ticketIds`.
- Renderer archive mutation with board/ticket cache updates for all archived IDs.
- `sortArchiveBundleIds` already in `boardArchive.ts`; test added.

## Follow-up

- UI can switch from `useStartTicketUpdateMutation` to `useArchiveTicketMutation` (sibling ticket).
- Integration tests for partial bundle failure need mocked agent providers.
