---
schemaVersion: 1
id: tkt_01ks7dand93t0q183ks5eja51x
title: Fix repository chat streaming UX and missing responses
ticketType: feature
draftTargetType: null
status: completed
position: 17000
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
updatedAt: '2026-05-22T09:37:12.611Z'
authoringState: reviewing
summary: >-
  Repository chat should show a brief thinking state, stream assistant text as
  it arrives, and keep the final answer visible when the Cursor agent finishes.

  - Replace the long-lived "Reading repository context" spinner with
  thinking/streaming phases

  - Ensure Cursor stream-json events become UI deltas and final transcript text

  - Add regression tests for panel states and stream delivery
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ks7fm8djy30a8rqvwgrf1ec0
lastRunStartedAt: null
---
# Fix repository chat streaming UX and missing responses

## Context

User reports repository chat stays on a spinner until the full HTTP turn completes, does not type out streamed text, and sometimes shows no assistant answer at the end. They are using the Cursor agent provider (`selectedProviderId === "cursor"`).

## Goal

While a chat turn is in flight, show a short "Thinking..." state only until the first assistant stream content arrives; then hide the thinking row and render incremental assistant text in the transcript.

## Decisions / Assumptions

- Primary failure mode is Cursor provider + existing SSE/mutation wiring; Codex provider should keep working with the same UI changes.
- Cursor CLI continues to emit stream-json NDJSON on stdout; gaps will be fixed by extending event normalization rather than changing CLI flags.
- Composer may stay disabled for the full HTTP request; only the transcript thinking row should disappear once streaming starts.

## Requirements

- While a chat turn is in flight, show a short "Thinking..." state only until the first assistant stream content arrives; then hide the thinking row and render incremental assistant text in the transcript.
- When the turn completes successfully, the final assistant answer remains visible in the transcript (markdown rendered via `MarkdownBlock`) with no blank bubble.
- Streamed partial output from the Cursor agent provider surfaces in the UI during the turn, not only after HTTP completion.
- Stream failures surface a user-visible error in the panel and restore the composer prompt when appropriate.

## Acceptance Criteria

- Sending a repository chat message shows "Thinking..." briefly, then live assistant text as chunks arrive, without a persistent "Reading repository context" spinner through the whole turn.
- After a successful Cursor chat turn, the assistant answer is visible in the transcript and matches the final streamed/completed text.
- If the stream fails, the panel shows an error and does not leave an empty assistant message as the only outcome.

## Test Plan

- Update repository chat panel static test to expect "Thinking..." and a case where streamed assistant text hides the thinking row.
- Extend backend test to cover cursor-style stream-json lines that previously produced no `delta` events.
- Manual: with Cursor provider selected, send a repository chat question — brief thinking, typed stream, final answer persists after completion.

## Implementation Notes

- Codebase finding: `RepositoryChatPanelContent` in `src/renderer/src/App.tsx` shows pending UI when `pendingChat || pendingDraft`; chat pending copy is hardcoded to "Reading repository context." (line ~2307) while `pendingChat` is `repositoryChatMutation.isPending` for the entire POST — so the spinner stays until the HTTP call finishes even if SSE deltas arrive.
- Codebase finding: `RepositoryChatPanel` subscribes via `useRepositoryChatEventSubscription` and appends assistant text on `delta` / `completed` events (`streamingRequestIdRef`, `streamingAssistantMessageIdRef`), but still passes `pendingChat={repositoryChatMutation.isPending}` so pending and streamed assistant bubbles render together.
- Codebase finding: SSE path: `sendRepositoryChatMessage` in `src/services/codex/index.ts` publishes `started` / `delta` / `completed` / `failed` through `publishRelayHttpRepositoryChatEvent` (`src/http/resources/codex.ts`); renderer listens on `repository-chat-event` via `relayApi.subscribeRepositoryChatEvents` (`src/renderer/src/lib/relayApi.ts`).
- Codebase finding: Backend only forwards stream text when `repositoryChatDeltaFromRelayEvent` sees `agent.message.delta`; Cursor `runTextStream` in `src/services/agents/cursorProvider.ts` yields parsed stream-json `rawEvent` lines normalized by `normalizeProviderNativeEvent` — non-text events (commands, tools) produce no chat deltas.
- Codebase finding: Final text comes from provider `completed` (`cursorTextResultFromRawResponse`) and is re-applied on HTTP `mutateAsync` success; `failed` SSE handler clears `streamingRequestIdRef` but does not call `setErrorMessage` (lines ~2532–2534).
- Codebase finding: Tests: `tests/ticket-draft-ui.test.tsx` asserts "Reading repository context"; `tests/backend.test.ts` has "repository chat streams delta events before the final response completes"; `tests/cursor-cli.test.ts` covers stream-json final text parsing for `runText`.
- Implementation: Split repository chat pending UX in `RepositoryChatPanel` / `RepositoryChatPanelContent`: track whether the active request has received stream content (ref or state) and pass props such as `pendingThinking` vs `isRequestInFlight` instead of using `repositoryChatMutation.isPending` alone for the spinner row.
- Implementation: Change pending copy from "Reading repository context." to "Thinking..." and render the pending row only when thinking and no streamed assistant text exists yet; keep composer disabled for the full in-flight request.
- Implementation: On SSE `failed`, set `errorMessage`, clear streaming refs, and avoid leaving a stale empty assistant placeholder; on `completed` and mutation success, normalize assistant text once and reset streaming refs.
- Implementation: Broaden repository chat delta extraction in `sendRepositoryChatMessage` so Cursor stream-json assistant/text events reliably emit `delta` SSE events (extend `repositoryChatDeltaFromRelayEvent` or add a repository-chat-specific mapper; include `message.completed`-style payloads when they carry answer text).
- Implementation: Add/adjust tests in `tests/ticket-draft-ui.test.tsx`, `tests/backend.test.ts`, and `tests/cursor-cli.test.ts` for thinking vs streaming UI and cursor stream-json → delta → final message behavior.
- Ask-mode rules live in `.relay/context/chat.md` and are injected server-side via `resolveRepositoryChatContextPromptSection` — the UI label should not imply the user is only waiting on context file reads.
- Do not persist transcript changes in this feature unless a separate save-on-complete hook already exists; `useRepositoryChatQuery` is imported but panel state is local today.

## Codex Handoff

No Codex run has been started.
