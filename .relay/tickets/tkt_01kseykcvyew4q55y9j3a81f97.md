---
schemaVersion: 1
id: tkt_01kseykcvyew4q55y9j3a81f97
title: Isolate repository chat transcript from draft re-renders
ticketType: task
draftTargetType: null
status: archive
position: 26000
priority: medium
effort: medium
labels:
  - repository-chat
  - ui
parentEpicId: null
parentFeatureId: tkt_01kseydxj7g1x80fxxz0v2cqgd
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/components/RepositoryChatComposer.tsx
  - src/renderer/src/components/RepositoryChatTranscript.tsx
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:54:17.470Z'
updatedAt: '2026-05-25T14:37:35.778Z'
authoringState: ready
summary: >-
  Split repository chat into memoized transcript and draft-bound composer so
  keystrokes no longer re-render message Markdown; stabilized copy callbacks
  preserve memo benefits.
codexThreadId: 'cursor::91f2beb4-1936-491c-a8ab-e3d8e483dd2b'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Isolate repository chat transcript from draft re-renders

## Requirements

- Memoized `RepositoryChatTranscript` for messages, pending/thinking/draft indicators, and errors — no `draft` prop.
- `RepositoryChatComposer` owns textarea, options, and actions with `draft` / `onDraftChange`.
- Keep `RepositoryChatPanelContent` export and DOM shape stable for `tests/ticket-draft-ui.test.tsx`.
- Stabilize answer-copy callbacks in `RepositoryChatPanel` so memo is not defeated by inline handlers.

## Acceptance Criteria

- Draft-only edits leave transcript props unchanged when messages, pending flags, and error are unchanged.
- `ticket-draft-ui` repository chat markup tests and transcript-isolation assertion pass.
- Long assistant replies stay stable while typing (no transcript flicker or scroll reset).
