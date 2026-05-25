---
schemaVersion: 1
id: tkt_01kseykcvg0q9r33s8c5p1hd0r
title: Tune repository chat autosave debounce and flush
ticketType: task
draftTargetType: null
status: archive
position: 27000
priority: medium
effort: medium
labels:
  - repository-chat
  - persistence
parentEpicId: null
parentFeatureId: tkt_01kseydxj7g1x80fxxz0v2cqgd
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/lib/repositoryChatPersist.ts
  - tests/repository-chat-persist.test.ts
  - tests/run-tests.mjs
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:54:17.456Z'
updatedAt: '2026-05-25T14:38:04.025Z'
authoringState: ready
summary: >-
  Repository chat autosave debounces PUTs at 1800ms with signature dedupe and
  ref-based flush on panel close, submit, clear, and unmount.
codexThreadId: 'cursor::29f015e9-493a-47e3-a14f-b5a36f7d98aa'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Tune repository chat autosave debounce and flush

## Requirements

- Export `REPOSITORY_CHAT_PERSIST_DEBOUNCE_MS` as 1800 from `repositoryChatPersist.ts`.
- Centralize debounced save and `flushRepositoryChatPersist` in a persist controller using refs for latest projectPath, threadId, messages, and draft.
- Flush on panel unmount, submit, clearChat, and onClose before the panel hides.
- Skip PUT when `repositoryChatStoreSignature` is unchanged.
- Keep `RepositoryChatPanel` persist effects off save-mutation status (stable mutate ref).

## Acceptance Criteria

- Continuous typing yields at most one PUT per ~1.8s idle window.
- Close, send, or clear persists the latest draft even if the debounce timer has not fired.
- Persist scheduling/sync effects do not re-subscribe when save mutation status changes.
