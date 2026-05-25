---
schemaVersion: 1
id: tkt_01ks50n4rdvpfn43ch3mfjzchf
title: >-
  Dispatch implementation runs by stored provider and normalize provider event
  streams
ticketType: task
draftTargetType: null
status: archive
position: 4000
priority: high
effort: medium
labels:
  - backend
  - implementation-runs
  - run-events
parentEpicId: null
parentFeatureId: tkt_01ks4yxwpdrp66tcf70ydvzw6p
subticketIds: []
plannedFiles:
  - src/main.app.ts
  - src/services/codex/index.ts
  - src/services/run-events/index.ts
  - src/services/work/index.ts
  - src/services/work/ticket/TicketWorkService.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T10:17:47.533Z'
updatedAt: '2026-05-25T14:36:44.346Z'
authoringState: ready
summary: >-
  Implementation work now stamps and dispatches by stored provider id, with
  app-start recovery and normalized run events for Codex, Cursor, and Claude.
  Backend tests cover mixed-provider queue continuity and terminal event
  handling.
codexThreadId: 019e4a4d-21cc-76a3-b5a7-1cd5f8167327
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Dispatch implementation runs by stored provider and normalize provider event streams

## Requirements

- Submit new implementation work with the selected provider id; queued or recovered work dispatches by the provider id on the work item.
- Provider adapters expose resumable session ids and stream-json (or equivalent) events for implementation runs.
- Normalize provider-native file, command, approval, and completion signals into the existing `RendererRunEvent` and run-log pipeline.
- App-start recovery wakes queued work for any supported provider.
- Run summaries and ticket run-state transitions continue to work with provider-backed events.

## Acceptance Criteria

- Switching providers affects only future implementation runs; queued or recovered runs resume on the stored provider.
- Non-Codex implementation runs populate the run log, activity panel, and summary fields.
- App-start recovery no longer assumes Codex-only work.
- Backend tests cover mixed-provider queue continuity and normalized terminal events.
