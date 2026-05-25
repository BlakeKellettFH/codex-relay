---
schemaVersion: 1
id: tkt_01ks7dand93t0q183ks5eja51x
title: Fix repository chat streaming UX and missing responses
ticketType: feature
draftTargetType: null
status: archive
position: 24000
priority: high
effort: medium
labels:
  - repository-chat
  - ui
  - streaming
  - cursor
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ks7fsf0m78t9frpxc2gc8pyh
  - tkt_01ks7fsf1443s69gwe6xfxw7j6
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-22T08:37:44.489Z'
updatedAt: '2026-05-25T13:07:49.771Z'
authoringState: ready
summary: >-
  Repository chat now shows a brief Thinking... state, streams Cursor assistant
  text during the turn, keeps the final answer visible, and surfaces stream
  errors. Renderer pending UX was split from SSE delivery; backend maps more
  Cursor stream-json events to deduped deltas and aligned completion text.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Fix repository chat streaming UX and missing responses

## Context

With the Cursor agent provider, repository chat kept a long "Reading repository context" spinner for the full HTTP request, did not render streamed assistant text during the turn, and sometimes finished with no visible answer.

## Requirements

- Show **Thinking...** only until the first assistant stream chunk; then render incremental transcript text.
- Keep the final assistant answer visible after a successful turn (markdown via `MarkdownBlock`).
- Stream Cursor provider partial output during the turn, not only after HTTP completion.
- Surface stream failures in the panel; avoid empty assistant placeholders; restore composer when appropriate.

## Acceptance Criteria

- Brief **Thinking...**, then live assistant text as chunks arrive—no persistent context-read spinner through the turn.
- Successful Cursor turns leave the final answer in the transcript, matching streamed/completed text.
- Stream failures show a user-visible error without an empty assistant-only outcome.

## Outcome

- **UI:** Split `pendingThinking` from composer in-flight (`pendingChat`); track `hasStreamedAssistant` so the thinking row hides once SSE deltas arrive; handle SSE `failed` with `errorMessage` and ref cleanup. Copy changed from "Reading repository context" to **Thinking...**.
- **Backend:** Broadened Cursor stream-json → repository-chat SSE deltas (`repositoryChatAnswerTextFromRelayEvent`, suffix-only delta emission); aligned final `completed`/HTTP text via improved `cursorAnswerTextFromEvents` extraction.
- **Tests:** `tests/ticket-draft-ui.test.tsx`, `tests/backend.test.ts`, `tests/cursor-cli.test.ts`.
