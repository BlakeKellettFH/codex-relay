---
schemaVersion: 1
id: tkt_01ksf1rxv6tgkswvbmbf4kvef8
title: Add POST /api/tickets/archive backend integration test
ticketType: task
draftTargetType: null
status: archive
position: 38000
priority: medium
effort: medium
labels:
  - api
  - backend
parentEpicId: null
parentFeatureId: tkt_01ksf1exckn6dxhhy05deq7qrr
subticketIds: []
plannedFiles:
  - src/http/resources/tickets.ts
  - src/workflows/tickets.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:49:44.422Z'
updatedAt: '2026-05-25T14:52:44.010Z'
authoringState: ready
summary: >-
  Added backend integration tests for POST /api/tickets/archive covering
  successful multi-id bundle archival (200, sort order, archive status, board
  visibility) and rejection of non-completed tickets.
codexThreadId: 'cursor::07a5a38a-949d-4c70-b220-ee9ed67a3af5'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add POST /api/tickets/archive backend integration test

## Requirements

- Cover `POST /api/tickets/archive` with a multi-id bundle; expect `200` and `TicketArchiveResult` shape.
- Assert archived tickets reach `archive` status; reject non-completed tickets with an error.

## Acceptance Criteria

- New `backend.test.ts` cases pass in CI with existing ticket mutation tests.
- Bundle archives in tasks → features → epics order per `sortArchiveBundleIds`.
- Archived tickets are excluded from visible board columns.

## Outcome

- **Bundle archive** — Seeds completed epic/feature/task hierarchy, posts unsorted `ticketIds`, mocks archive agent completion, asserts `200` `{ ticket, board }`, epic last in `archivedOrder`, all `archive` status, ids absent from visible columns.
- **Non-completed** — Posts a todo ticket via production route; expects failure with “Only completed tickets can be archived”; status unchanged.
- **Scope** — Changes limited to `tests/backend.test.ts` (helpers: archive Codex mock, test route, `startTestArchiveApi`, `seedCompletedArchiveBundle`).
- **Verify** — Run `npm test` or `node tests/run-tests.mjs`; success path uses test route mirroring production for mockability.
