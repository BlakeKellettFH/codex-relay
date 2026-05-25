---
schemaVersion: 1
id: tkt_01kseykcwmdtw8py5p4e42rzfw
title: Quiet repository chat autosave HTTP logs
ticketType: task
draftTargetType: null
status: review
position: 4000
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
updatedAt: '2026-05-25T07:21:53.973Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::25c930a4-e513-40a9-bd97-d02876def5d9'
runStatus: completed
lastRunId: run_01kseyt90qbj493an86wsvdv7f
lastRunStartedAt: '2026-05-25T07:17:38.859Z'
---
# Quiet repository chat autosave HTTP logs

## Context

Parent feature: Smooth repository chat typing and reduce autosave churn

requestLoggingMiddleware logs every API call at INFO; autosave PUTs are high frequency during typing pauses.

## Goal

Autosave PUTs are not logged at INFO in normal dev runs.

## Requirements

- PUT /api/projects/repository-chat should not emit INFO [http] API request lines during autosave.
- Other methods/paths continue to log at INFO unchanged.

## Acceptance Criteria

- Test proves repository-chat PUT is skipped or downgraded.
- Manual typing still shows reduced [http] PUT noise compared to before.

## Implementation Plan

- Update requestLoggingMiddleware to return early or log at debug for PUT pathname /api/projects/repository-chat.
- Add tests/request-logging.test.ts and register in tests/run-tests.mjs.

## Assumptions

- Debug-level logging for this path is sufficient; no UI toggle needed.

## Codex Handoff

### 5/25/2026, 8:21:53 AM

The user requests implementing
a ticket to suppress
HTTP logs generated
by repository chat
autosave functionality.
I need to add logDebug
to Logging or use log("debug",
...) and check RelayLogLevel.
RelayLogLevel supports
only "info", "warn",
and "error" levels,
excluding "debug".
For testing request
logging middleware,
I should create test
cases that verify log
entries are generated
for each request, check
that log formats match
expected structures,
and ensure logs include
relevant request details
like method, URL, and
timestamps.
For testing the middleware,
I should export a helper
function like `shouldLogRequestAtInfo`
or test it directly
by mocking `logInfo`.
The cleanest approach
is to extract the skip
logic into a testable
pure function `isQuietRepositoryChatAutosave(method,
pathname)` and use
it in the middleware.
Alternatively, I can
test by spying on the
log module. I should
check if there's a
pattern for mocking
logs in tests and confirm
that `http-rest-api.test.ts`
is outside the planned
scope, since the ticket
only mentions modifying
`requestLogging.ts`,
`request-logging.test.ts`,
and `run-tests.mjs`.
My unit tests should
focus on the middleware
in isolation within
`request-logging.test.ts`.
Export a pure function
from `requestLogging.ts`
to handle the skip
condition for easier
testing. Alternatively,
test the middleware
by mocking `logInfo`
or spying on the log
module. The ticket
indicates that testing
should prove repository-chat
PUT requests are skipped
or downgraded, so either
exporting a helper
function or testing
via mocking would work.
Looking at codebase
patterns, they may
prefer testing the pure
condition directly.
The path is `/api/projects/repository-chat`.
The shell command was
rejected.
The shell is repeatedly
being rejected. The
final response will
indicate that tests
could not be executed
due to shell rejection,
while acknowledging
that the implementation
is complete.
Tests are built via
esbuild, which is good.
Implementing quiet logging for repository-chat autosave PUTs. Reviewing the current middleware and test setup.
Implementing skip logic for repository-chat PUT autosave and adding tests.
Implemented quiet logging for repository-chat autosave PUTs.

## Summary

`requestLoggingMiddleware` now skips INFO `[http] API request` lines for `PUT /api/projects/repository-chat`. All other methods and paths still log at INFO as before.

Relay logging only supports `info`, `warn`, and `error` (no `debug`), so autosave PUTs are skipped entirely rather than downgraded.

## Files changed

- `src/http/middleware/requestLogging.ts` — added `shouldLogApiRequestAtInfo()` and conditional logging
- `tests/request-logging.test.ts` — new tests for skip vs continue cases
- `tests/run-tests.mjs` — registered the new test file

## Commands run

Shell execution was unavailable in this environment, so tests were not executed here.

## Tests (to run locally)

```bash
node --test tests/request-logging.test.ts
# or
npm test
```

Expected: 3 passing tests — PUT repository-chat skipped; GET/POST on same path and other paths still log.

## Subagent usage

None used.

## Remaining risks / follow-up

- Manual check: type in repository chat and confirm dev logs no longer show repeated `INFO [http] API request {"method":"PUT","path":"/api/projects/repository-chat"}` during autosave pauses.
- If you want autosave visibility at a lower level later, Relay would need a `debug` log level in `RelayLogger` first.


No Codex run has been started.
