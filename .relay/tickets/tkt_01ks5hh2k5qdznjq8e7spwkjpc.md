---
schemaVersion: 1
id: tkt_01ks5hh2k5qdznjq8e7spwkjpc
title: Prepend TEMP banner to main README
ticketType: feature
draftTargetType: null
status: archive
position: 13000
priority: low
effort: medium
labels:
  - docs
  - readme
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ks5hkmdy93w7efzw37437gav
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T15:12:40.037Z'
updatedAt: '2026-05-25T14:36:44.372Z'
authoringState: ready
summary: >-
  Documentation-only feature: prepend literal TEMP as line 1 of root README.md,
  with a blank line before the unchanged # Relay heading. Delivered through the
  child task; no runtime or board changes.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Prepend TEMP banner to main README

## Context

User-requested scratch marker on the project landing doc: prepend literal `TEMP` to repository-root `README.md`, then a blank line, then the existing `# Relay` heading and body unchanged.

## Requirements

- First line of `README.md` is exactly `TEMP` (no leading whitespace or markdown prefix).
- One blank line between `TEMP` and `# Relay`; all content from `# Relay` onward unchanged.
- Edit only `README.md`; no application source, tests, or `.relay/` artifacts.

## Acceptance Criteria

- `README.md` line 1 is `TEMP`, line 2 is blank, line 3 is `# Relay` with the rest of the file unchanged.
- Only `README.md` was modified for this feature.
- Child task completed the implementation.
