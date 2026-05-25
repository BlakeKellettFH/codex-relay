---
schemaVersion: 1
id: tkt_01kseykcwmdtw8py5p4e42rzfw
title: Quiet repository chat autosave HTTP logs
ticketType: task
draftTargetType: null
status: archive
position: 29000
priority: low
effort: medium
labels:
  - repository-chat
  - logging
parentEpicId: null
parentFeatureId: tkt_01kseydxj7g1x80fxxz0v2cqgd
subticketIds: []
plannedFiles:
  - src/http/middleware/requestLogging.ts
  - tests/request-logging.test.ts
  - tests/run-tests.mjs
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:54:17.492Z'
updatedAt: '2026-05-25T14:38:44.020Z'
authoringState: ready
summary: >-
  Skipped INFO `[http] API request` logging for `PUT
  /api/projects/repository-chat` autosave; other routes unchanged. Added
  `shouldLogApiRequestAtInfo()` and unit tests registered in the test runner.
codexThreadId: 'cursor::25c930a4-e513-40a9-bd97-d02876def5d9'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Quiet repository chat autosave HTTP logs

## Requirements

- `PUT /api/projects/repository-chat` must not emit INFO `[http] API request` lines during autosave.
- All other methods and paths continue logging at INFO unchanged.

## Acceptance Criteria

- Tests prove repository-chat PUT is skipped (not downgraded; Relay has no debug level).
- Dev typing in repository chat shows less repeated PUT `[http]` noise.

## Outcome

`requestLoggingMiddleware` uses `shouldLogApiRequestAtInfo()` to skip INFO lines for repository-chat autosave PUTs only. Tests cover skip vs continue paths; registered in `tests/run-tests.mjs`.
