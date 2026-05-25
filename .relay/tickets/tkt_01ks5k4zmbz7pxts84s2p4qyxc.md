---
schemaVersion: 1
id: tkt_01ks5k4zmbz7pxts84s2p4qyxc
title: Add "Hello world" to main README
ticketType: feature
draftTargetType: null
status: todo
position: 3000
priority: low
effort: medium
labels:
  - docs
  - readme
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ks5k9bpasfbt0chntmq6zxwv
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T15:41:00.939Z'
updatedAt: '2026-05-21T15:43:24.363Z'
authoringState: reviewing
summary: >-
  This feature inserts the exact literal line Hello world into the repository
  README after the existing TEMP banner and before the Relay heading, so the
  landing doc shows the requested scratch copy without changing application
  code.


  - Documentation-only change to root README.md; TEMP banner and all content
  from `# Relay` onward stay intact.

  - Target top-of-file layout: TEMP, blank, Hello world, blank, then `# Relay`.

  - One lean child task; validate with `head -n 5` and `git diff README.md`.


  Low risk: placeholder copy sits above production readme text and may need a
  follow-up editorial ticket.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ks5k4zm00k2ej7g9j38dc0v5
lastRunStartedAt: null
---
# Add "Hello world" to main README

## Context

User requested adding the exact literal text Hello world to the main readme. Intake confirmed repository-root README.md only, Feature draft mode, documentation-only scope, and conservative placement after the TEMP blank line and before `# Relay`. Related ticket tkt_01ks5hh2k5qdznjq8e7spwkjpc (TEMP banner) is already reflected on disk.

## Goal

Insert the exact literal line `Hello world` (no quotes, markdown prefix, or trailing spaces) on a new line after the blank line following TEMP and before `# Relay`.

## Decisions / Assumptions

- Hello world is the exact final literal copy from the user (not a placeholder for longer marketing text).
- Main readme means repository-root README.md only.
- TEMP banner from tkt_01ks5hh2k5qdznjq8e7spwkjpc remains at the top; removing or editing TEMP is out of scope.
- Plain unformatted text (not a markdown heading or blockquote) is the intended presentation.

## Requirements

- Insert the exact literal line `Hello world` (no quotes, markdown prefix, or trailing spaces) on a new line after the blank line following TEMP and before `# Relay`.
- Keep line 1 `TEMP` and the blank line 2 unchanged; leave all README content from `# Relay` through end of file byte-identical aside from line-number shift.
- Use layout: TEMP, blank, Hello world, blank, `# Relay` (five-line header block before Quick Start).
- Modify only README.md; do not change application source, tests, package metadata, or `.relay/` artifacts.
- Deliver through one lean child task under this feature.

## Acceptance Criteria

- README.md line 3 is exactly `Hello world` with no prefix or trailing spaces.
- Lines 1–2 remain `TEMP` and blank; lines 4–5 are blank then `# Relay`; all content below `# Relay` is unchanged from the pre-change version.
- Only README.md is modified for this feature.
- The lean child task is completed and satisfies the header layout above.

## Test Plan

- Run `head -n 5 README.md` and confirm lines 1–5 are TEMP, blank, Hello world, blank, `# Relay`.
- Run `git diff README.md` and confirm only the Hello world + blank insert between the TEMP block and `# Relay`.
- Optional non-regression: `npm test` — no new automated README body test is required for this docs-only change.

## Implementation Notes

- Codebase finding: README.md (repo root) currently opens with line 1 `TEMP`, line 2 blank, line 3 `# Relay`; Quick Start, Codex setup, architecture, and `.relay/` sections follow unchanged below the heading.
- Codebase finding: Glob search finds no other README* files at the project root; package.json (`relay` v0.1.0) has no separate `readme` field — clones and GitHub use root README.md as the landing doc.
- Codebase finding: Completed lean task tkt_01ks5hkmdy93w7efzw37437gav under feature tkt_01ks5hh2k5qdznjq8e7spwkjpc established the TEMP prepend pattern; this feature adds Hello world below that banner without relocating TEMP.
- Codebase finding: tests/backend.test.ts writes ephemeral `# baseline` README.md only inside temp git fixture projects for path-lock tests — no assertion on root README marketing copy.
- Codebase finding: Relay draft schema in src/services/codex/index.ts (`ticketDraftSchemaJson`, `leanTaskDraftSchemaJson`) requires feature drafts with non-empty `leanTasks` and `plannedFiles` per child; `src/shared/draftTicket.ts` maps draft tickets to feature type via `resolveDraftPreferredTicketType`.
- Implementation: Open repository-root README.md and insert `Hello world` as line 3 (after TEMP and its following blank line).
- Implementation: Insert one blank line between `Hello world` and the existing `# Relay` heading so `# Relay` moves to line 5.
- Implementation: Confirm lines 1–5 match TEMP, blank, Hello world, blank, `# Relay` with `head -n 5 README.md`.
- Implementation: Confirm `git diff README.md` shows only the two-line insert (Hello world + blank) between TEMP block and `# Relay`.
- Implementation: Mark feature complete when the lean child task acceptance criteria pass.
- Implementation agent should edit README.md only per plannedFiles — no file discovery pass needed.
- If the user intended different placement or formatting, revise the ticket before execution; defaults follow intake layout between TEMP and `# Relay`.

## Codex Handoff

No Codex run has been started.
