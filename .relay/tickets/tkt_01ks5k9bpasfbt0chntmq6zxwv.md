---
schemaVersion: 1
id: tkt_01ks5k9bpasfbt0chntmq6zxwv
title: Insert Hello world in README.md
ticketType: task
draftTargetType: null
status: archive
position: 6000
priority: low
effort: medium
labels:
  - docs
  - readme
parentEpicId: null
parentFeatureId: tkt_01ks5k4zmbz7pxts84s2p4qyxc
subticketIds: []
plannedFiles:
  - README.md
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T15:43:24.362Z'
updatedAt: '2026-05-25T14:36:44.361Z'
authoringState: ready
summary: >-
  Inserted `Hello world` and a blank line in README.md after the TEMP prefix so
  lines 1–5 are TEMP, blank, Hello world, blank, `# Relay`; only README.md
  changed.
codexThreadId: 'cursor::cf9eca4a-a851-4390-a3aa-6f81905f8b72'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Insert Hello world in README.md

## Requirements

- Line 3 of README.md: exactly `Hello world`; blank line 4 before `# Relay`.
- Keep line 1 `TEMP`, line 2 blank, and all content from `# Relay` through EOF unchanged except line shift.
- Edit README.md only.

## Acceptance Criteria

- `head -n 5 README.md`: TEMP, blank, Hello world, blank, `# Relay` on lines 1–5.
- `git diff README.md`: only Hello world line and blank inserted before `# Relay`.
- No other repository files modified.
