---
schemaVersion: 1
id: tkt_01ksf1exckn6dxhhy05deq7qrr
title: Archive completed epic and feature bundles from ticket detail
ticketType: feature
draftTargetType: null
status: archive
position: 42000
priority: medium
effort: medium
labels:
  - board
  - tickets
  - archive
  - ui
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ksf1rxtmf1p8tfj4xrx15mty
  - tkt_01ksf1rxv6tgkswvbmbf4kvef8
  - tkt_01ksf1rxvsd6g7cb7x8e4eprhg
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:44:16.275Z'
updatedAt: '2026-05-25T14:55:08.354Z'
authoringState: ready
summary: >-
  Completed epic and feature ticket detail now offers a gated Archive control
  that archives the full descendant bundle in one action via POST
  /api/tickets/archive, matching board archive behavior and adding route and
  detail affordance tests.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Archive completed epic and feature bundles from ticket detail

## Context

Completed epic or feature ticket detail exposes one Archive action that archives the full descendant tree when every child task is complete. Board Completed-column archive entry points share the same bundle helpers, gating, and POST archive API.

## Requirements

- Show Archive on completed epic/feature detail when an archive column exists
- Enable only when `featureCanArchive` or `epicCanArchive`; otherwise show the blocked toast
- One click archives the container plus descendants bottom-up with agent lean rewrite
- Board archive triggers remain behavior-equivalent
- No clarification questions during archive runs

## Acceptance Criteria

- Completed feature with all tasks done: detail Archive moves feature and tasks off visible board columns
- Completed epic with full tree done: archives epic, features, and tasks in one action
- Completed container with an incomplete child: blocked toast, no tickets move
- Archive flows use `POST /api/tickets/archive` via `useArchiveTicketMutation`, not client-side update polling
- `node tests/run-tests.mjs` passes, including archive route and detail affordance coverage
