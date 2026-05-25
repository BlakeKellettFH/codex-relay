---
schemaVersion: 1
id: tkt_01ksf1rxtmf1p8tfj4xrx15mty
title: Route renderer archive flows through POST /api/tickets/archive
ticketType: task
draftTargetType: null
status: archive
position: 37000
priority: medium
effort: medium
labels:
  - ui
  - api
parentEpicId: null
parentFeatureId: tkt_01ksf1exckn6dxhhy05deq7qrr
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/lib/relayApi.ts
  - src/renderer/src/lib/relayQueries.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:49:44.404Z'
updatedAt: '2026-05-25T14:52:27.491Z'
authoringState: ready
summary: >-
  Board and ticket-detail archive actions now call `useArchiveTicketMutation`
  (`POST /api/tickets/archive`) instead of client-side `startTicketUpdate`
  polling in `App.tsx`.
codexThreadId: 'cursor::4df3ff1f-79da-4f24-9b7b-e19874e9d1b2'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Route renderer archive flows through POST /api/tickets/archive

## Requirements

- BoardView archive handlers call `useArchiveTicketMutation` with `projectPath` and sorted bundle `ticketIds`
- Ticket detail Archive uses the same mutation with `detailArchiveTarget.bundleIds`
- Remove client archive polling helpers (`waitForTicketArchived`, `archiveTicketIdsWithAgent`) once the mutation owns completion

## Acceptance Criteria

- No direct `startTicketUpdate` archive calls remain in `App.tsx` archive handlers
- Successful bundle archive refreshes the board and shows existing success toasts
- Archive errors surface via mutation `catch` with prior toast messaging

## Done

- `App.tsx`: board `archiveBundle` / epic / feature and detail Archive wired to `mutateAsync`; per-container busy state and toasts preserved
- Removed `waitForTicketArchived`, `archiveTicketIdsWithAgent`, and related archive poll constants/imports
- `relayApi.tickets.archive` / `useArchiveTicketMutation` unchanged (already present)
