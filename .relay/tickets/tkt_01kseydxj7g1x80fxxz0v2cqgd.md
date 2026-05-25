---
schemaVersion: 1
id: tkt_01kseydxj7g1x80fxxz0v2cqgd
title: Smooth repository chat typing and reduce autosave churn
ticketType: feature
draftTargetType: null
status: archive
position: 30000
priority: medium
effort: medium
labels:
  - repository-chat
  - ui
  - performance
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01kseykcvg0q9r33s8c5p1hd0r
  - tkt_01kseykcvyew4q55y9j3a81f97
  - tkt_01kseykcwatewypzka1gjrcye5
  - tkt_01kseykcwmdtw8py5p4e42rzfw
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:51:17.959Z'
updatedAt: '2026-05-25T14:39:12.902Z'
authoringState: ready
summary: >-
  Repository chat typing is smoother: autosave debounces at 1800ms with flush on
  close/send/clear, the assistant transcript no longer re-renders on draft
  keystrokes, pre-hydration draft restore is fixed, and autosave PUTs no longer
  spam INFO logs.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Smooth repository chat typing and reduce autosave churn

## Context

Repository chat autosave and panel-local updates caused visible transcript flicker and frequent INFO logs for `PUT /api/projects/repository-chat` while typing. Persistence to `.relay/repository-chat.json` was kept; the goal was a smoother composer without removing autosave.

## Requirements

- Keep autosave to `.relay/repository-chat.json`.
- Debounce typing saves (~1500–2000ms) and flush pending state on panel close, send, and clear.
- Draft keystrokes must not re-render the assistant transcript when messages are unchanged.
- Fix the pre-hydration race so typing before GET completes does not block server draft restore.
- Reduce dev log noise from autosave without affecting other API request logging.
- No board refetch or RelayApp-wide rerender regression while typing.

## Acceptance Criteria

- Continuous typing triggers at most one PUT per ~1.5–2s idle window, plus flush on close/send/clear.
- Assistant transcript does not flicker or re-scroll on draft keystrokes when messages are unchanged.
- Typing before initial load still restores the persisted server draft when appropriate.
- Closing chat without waiting for debounce persists the latest draft and messages.
- Board and ticket views do not refetch or rerender due to repository chat autosave.
- Dev console no longer spams INFO lines for each autosave PUT.
