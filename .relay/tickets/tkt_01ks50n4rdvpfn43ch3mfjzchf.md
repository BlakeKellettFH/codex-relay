---
schemaVersion: 1
id: tkt_01ks50n4rdvpfn43ch3mfjzchf
title: >-
  Dispatch implementation runs by stored provider and normalize provider event
  streams
ticketType: task
draftTargetType: null
status: completed
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
  - src/services/codex/index.ts
  - src/services/run-events/index.ts
  - src/services/work/ticket/TicketWorkService.ts
  - src/services/work/index.ts
  - src/main.app.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T10:17:47.533Z'
updatedAt: '2026-05-21T12:44:19.512Z'
authoringState: ready
summary: ''
codexThreadId: 019e4a4d-21cc-76a3-b5a7-1cd5f8167327
runStatus: completed
lastRunId: run_01ks5394y1svc1cqrcmgg7e04n
lastRunStartedAt: '2026-05-21T11:30:29.352Z'
---
# Dispatch implementation runs by stored provider and normalize provider event streams

## Context

Parent feature: Add switchable agent CLI selection and provider status modal

Implementation work is still wired through codex-only queue wake-up and stream handling in `src/services/codex/index.ts`, `src/services/work/ticket/TicketWorkService.ts`, `src/services/work/index.ts`, and `src/main.app.ts`.

## Goal

Make implementation queueing, recovery, and event logging work across selected providers while preserving the current activity UI.

## Requirements

- New implementation work must be submitted with the selected provider id, and queued or recovered work must dispatch by the provider id already stored on the work item.
- Provider adapters must expose resumable session ids and stream-json or equivalent events for implementation runs.
- Relay must normalize provider-native file, command, approval, and completion signals into the existing `RendererRunEvent` and run-log pipeline.
- Recovery on app start must wake queued work regardless of whether it belongs to Codex, Cursor, or Claude.
- Existing run summaries and ticket run-state transitions must keep functioning with provider-backed events.

## Acceptance Criteria

- Switching providers changes only future implementation runs; an already queued or recovered implementation run resumes on its stored provider.
- Implementation runs from non-Codex providers still populate the existing run log, activity panel, and summary fields.
- App-start recovery no longer assumes Codex-only work and can wake queued runs for any supported provider.
- Backend tests cover mixed-provider queue continuity and normalized terminal events.

## Implementation Plan

- Refactor implementation work submission and claim paths to stamp and read provider ids instead of hardcoding Codex.
- Replace codex-only recovery and queue wake-up dispatch with provider-based dispatch from the stored work snapshot.
- Add provider event normalization that maps external stream-json or CLI events into Relay’s current run-event schema.
- Keep run-log persistence and summary generation on the existing `src/services/run-events/index.ts` path.
- Extend backend tests around queue recovery, provider continuity after a switch, and normalized completion/failure events.

## Assumptions

- Existing codex-named event schemas can remain in place as the internal storage format for this feature.
- Provider event mappers should target the current event categories rather than inventing provider-specific renderer events.

## Codex Handoff

### 5/21/2026, 12:42:38 PM

**Summary**
- Implementation work submission now stamps the resolved provider id instead of hardcoding `codex`, and work claims/default status updates now preserve the stored provider from the work snapshot.
- App-start recovery wake-up is no longer named or treated as Codex-only; queued and recovered implementation work dispatches by the provider already stored on the work item.
- Non-Codex implementation runs now execute through provider `runText`, keep resumable session refs, persist encoded session ids on the ticket, and normalize provider-native command, file, approval, and terminal signals into the existing run-event/log pipeline.
- Backend coverage now includes mixed-provider queue continuity after a provider switch and normalized non-Codex completion/failure event handling.

**Files changed**
- [src/main.app.ts](/Users/blakekellett/repos/codex-relay/src/main.app.ts)
- [src/services/codex/index.ts](/Users/blakekellett/repos/codex-relay/src/services/codex/index.ts)
- [src/services/work/index.ts](/Users/blakekellett/repos/codex-relay/src/services/work/index.ts)
- [src/services/work/ticket/TicketWorkService.ts](/Users/blakekellett/repos/codex-relay/src/services/work/ticket/TicketWorkService.ts)
- [tests/backend.test.ts](/Users/blakekellett/repos/codex-relay/tests/backend.test.ts)

**Commands run**
- `rg` and `sed` to inspect the scoped implementation, work, and test paths
- `tsc -p tsconfig.json --noEmit`
- `npm test`

**Tests**
- `npm test`: new backend coverage passed, but the full suite still has an unrelated existing failure in `import-boundaries.test` about direct Node imports in `src/services/agents/*` and `src/services/registry/index.ts`.
- `tsc -p tsconfig.json --noEmit`: fails due existing repo-wide type errors outside the scoped ticket files.

**Subagent usage**
- none used

**Remaining risks / follow-up**
- Provider event normalization is heuristic because non-Codex adapters currently expose `rawResponse` rather than a typed event stream; if Cursor or Claude CLI payload shapes change, the mapper in `src/services/codex/index.ts` may need adjustment.
- The repo is not fully green outside this ticket because of the unrelated import-boundary and typecheck failures noted above.


No Codex run has been started.
