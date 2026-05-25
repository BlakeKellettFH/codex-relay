---
schemaVersion: 1
id: tkt_01ks5er9n1e1t05wsncg3k3gcz
title: Insert TEMP TEXT at top of README.md
ticketType: task
draftTargetType: null
status: completed
position: 5000
priority: medium
effort: medium
labels:
  - docs
  - readme
parentEpicId: null
parentFeatureId: tkt_01ks5bq09wzt2z5dn5p87qhcy1
subticketIds: []
plannedFiles:
  - README.md
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T14:24:10.913Z'
updatedAt: '2026-05-21T14:34:28.556Z'
authoringState: ready
summary: ''
codexThreadId: pending_run_01ks5f5gp3x5jx884dxgkcy4xa
runStatus: completed
lastRunId: run_01ks5f5gp3x5jx884dxgkcy4xa
lastRunStartedAt: '2026-05-21T14:31:24.157Z'
---
# Insert TEMP TEXT at top of README.md

## Context

Parent feature: Add TEMP TEXT banner to main README

Executable child of feature Add TEMP TEXT banner to main README. Only README.md at repo root needs editing.

## Goal

Make TEMP TEXT the first line of README.md while keeping the rest of the document intact.

## Requirements

- Set README.md line 1 to exactly TEMP TEXT.
- Add exactly one blank line before the existing `# Relay` heading.
- Do not reword, reorder, or delete any content below the new banner.

## Acceptance Criteria

- First non-empty line of README.md is TEMP TEXT.
- Second line of README.md is blank.
- Third line of README.md remains `# Relay`.
- git diff shows only the prepend at the top of README.md.

## Implementation Plan

- Edit README.md at the repository root.
- Insert `TEMP TEXT` as line 1, add a blank line 2, leave `# Relay` and all following content starting at line 3 unchanged.
- Save the file without trailing whitespace on the TEMP TEXT line.

## Assumptions

- No markdown heading or blockquote wrapper is required unless the user later requests formatted banner styling.

## Codex Handoff

### 5/21/2026, 3:31:48 PM

## Summary of changes

Prepended the TEMP TEXT banner to the root `README.md`: line 1 is `TEMP TEXT`, line 2 is blank, and the existing `# Relay` heading and all content below it are unchanged.

## Files changed

- `README.md`

## Commands run

None (git diff was not available in this environment).

## Tests run and results

None — README-only change; the ticket did not require tests.

## Subagent usage

None used.

## Verification

First lines of `README.md`:

```1:5:README.md
TEMP TEXT

# Relay

Relay is a local-first desktop kanban app for software work. Point it at a project folder, keep tickets in that project's `.relay/` directory, and manage the board without setting up a database, containers, hosted issue tracker, or `.env` file.
```

## Remaining risks / follow-up

- Confirm locally with `git diff README.md` that the diff is only the two-line prepend at the top.
- Mark the ticket complete in Relay when you are satisfied with the change.


No Codex run has been started.
