---
schemaVersion: 1
id: tkt_01ks5hkmdy93w7efzw37437gav
title: Insert TEMP at top of README.md
ticketType: task
draftTargetType: null
status: archive
position: 12000
priority: low
effort: medium
labels:
  - docs
  - readme
parentEpicId: null
parentFeatureId: tkt_01ks5hh2k5qdznjq8e7spwkjpc
subticketIds: []
plannedFiles:
  - README.md
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T15:14:03.838Z'
updatedAt: '2026-05-25T14:36:44.370Z'
authoringState: ready
summary: >-
  Prepended the TEMP intake banner to README.md: line 1 is TEMP, line 2 blank,
  line 3 is # Relay with the rest of the file unchanged.
codexThreadId: 'cursor::104b74a3-a0ed-494a-ada7-815509e47fe0'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Insert TEMP at top of README.md

## Requirements

- Line 1 of README.md is exactly `TEMP`.
- Line 2 is blank; line 3 is `# Relay`; content below unchanged.
- Only README.md is edited.

## Acceptance Criteria

- `head -n 3 README.md` shows TEMP, blank line, then `# Relay`.
- `git diff README.md` shows only the top prepend.
- No other repository files are modified.
