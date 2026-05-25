---
schemaVersion: 1
id: tkt_01ks7fsf0m78t9frpxc2gc8pyh
title: Repository chat thinking vs streaming UI
ticketType: task
draftTargetType: null
status: archive
position: 25000
priority: high
effort: medium
labels:
  - ui
  - repository-chat
parentEpicId: null
parentFeatureId: tkt_01ks7dand93t0q183ks5eja51x
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/styles.css
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-22T09:20:46.612Z'
updatedAt: '2026-05-25T13:08:19.521Z'
authoringState: ready
summary: >-
  Repository chat separates thinking from composer in-flight state so streamed
  assistant text appears before the POST completes, with the Thinking... row
  hidden once SSE deltas arrive.
codexThreadId: 'cursor::eb0fe42f-8d0d-432f-9d3e-0cc284741fea'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Repository chat thinking vs streaming UI

## Requirements

- Expose separate thinking vs in-flight props to `RepositoryChatPanelContent` (`pendingThinking` vs `pendingChat`).
- Hide the thinking row once assistant stream text exists for the active request (`hasStreamedAssistant`).
- Handle SSE `failed` by surfacing `errorMessage`, toasting, and clearing streaming refs.

## Acceptance Criteria

- Panel test covers **Thinking...** and streamed content without a concurrent pending spinner row.
- Manual Cursor chat shows typing transcript before the POST resolves.

## Outcome

- `RepositoryChatPanel` tracks `hasStreamedAssistant` on first SSE `delta`; `pendingThinking` is mutation-pending without streamed content.
- `RepositoryChatPanelContent` renders a **Thinking...** row (`thinking` class) distinct from draft **pending** and composer disable.
- SSE terminal handlers and HTTP completion clear streaming refs and reset thinking state.
- Tests updated in `tests/ticket-draft-ui.test.tsx`; shared spinner styles for thinking/pending rows in `styles.css`.
