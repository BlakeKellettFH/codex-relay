---
schemaVersion: 1
id: tkt_01ks7fsf1443s69gwe6xfxw7j6
title: Repository chat Cursor stream deltas and final text
ticketType: task
draftTargetType: null
status: archive
position: 23000
priority: high
effort: medium
labels:
  - backend
  - cursor
  - repository-chat
parentEpicId: null
parentFeatureId: tkt_01ks7dand93t0q183ks5eja51x
subticketIds: []
plannedFiles:
  - src/services/agents/cursorProvider.ts
  - src/services/codex/index.ts
  - tests/backend.test.ts
  - tests/cursor-cli.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-22T09:20:46.628Z'
updatedAt: '2026-05-25T13:07:01.600Z'
authoringState: ready
summary: >-
  Repository chat now streams Cursor answer text from message.completed and
  terminal result events with suffix deduping, and final HTTP/SSE text matches
  via improved cursorProvider extraction.
codexThreadId: 'cursor::454bbac5-c16a-46c8-8bf9-91b7580d618f'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Repository chat Cursor stream deltas and final text

## Requirements

- Forward assistant answer text from Cursor stream-json events used in practice (not only `agent.message.delta`).
- Final `completed` event and HTTP response use the same trimmed answer string.
- Cover stream-json sequences that previously produced zero deltas.

## Acceptance Criteria

- `tests/backend.test.ts` passes cursor-like payloads with answer text only at end or in `message.completed`.
- Existing mocked delta stream test still passes.

## Outcome

- `repositoryChatAnswerTextFromRelayEvent` treats deltas as fragments and completed events as cumulative text; raw fallback handles `result` / `assistant` when normalization yields no text.
- `sendRepositoryChatMessage` tracks `streamedAnswerText` and emits suffix-only deltas to avoid duplication.
- `cursorAnswerTextFromEvents` prefers terminal completed/result text when it already includes prior fragments.
- Tests added in `tests/backend.test.ts` and `tests/cursor-cli.test.ts`.
