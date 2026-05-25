---
schemaVersion: 1
id: tkt_01ks5hh2k5qdznjq8e7spwkjpc
title: Prepend TEMP banner to main README
ticketType: feature
draftTargetType: null
status: todo
position: 2000
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
updatedAt: '2026-05-21T15:14:03.840Z'
authoringState: reviewing
summary: >-
  This feature adds the literal line TEMP at the very top of the repository
  README so the project landing doc shows the requested scratch marker before
  existing Relay copy. It is documentation-only and does not change application
  runtime, packaging, or board behavior.


  - Edit only root README.md; keep all sections below the new banner unchanged.

  - First line must be exactly TEMP, then a blank line, then the existing `#
  Relay` heading.

  - One lean child task carries the full change; validate with `head` and
  optional `git diff`.


  Risk is low: TEMP reads as placeholder copy and may need a follow-up editorial
  ticket before any public release.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ks5hh2jvzmde8j5k408262ry
lastRunStartedAt: null
---
# Prepend TEMP banner to main README

## Context

User requested a documentation-only prepend of the literal text TEMP to the top of the main readme. Intake confirmed README.md at the repo root is the sole project readme, Feature draft mode applies, and formatting should be TEMP plus blank line before the unchanged `# Relay` heading and body.

## Goal

Prepend the exact literal line TEMP as the first line of README.md with no leading whitespace or markdown prefix.

## Decisions / Assumptions

- TEMP is final requested literal copy from the user (not shorthand for longer placeholder text such as TEMP TEXT).
- Main readme means repository-root README.md only.
- Removing or replacing TEMP later is out of scope unless the user opens a separate ticket.
- No CI or packaging step requires README validation beyond manual diff review for this change.

## Requirements

- Prepend the exact literal line TEMP as the first line of README.md with no leading whitespace or markdown prefix.
- Insert exactly one blank line between TEMP and the existing `# Relay` heading.
- Leave all README content from `# Relay` onward unchanged (sections, links, images, code fences).
- Do not modify application source, tests, package metadata, or Relay `.relay/` artifacts for this documentation-only change.
- Complete work through the single lean child task under this feature.

## Acceptance Criteria

- README.md line 1 is exactly `TEMP` with no prefix or trailing spaces.
- Line 2 is blank and line 3 is `# Relay` with the rest of the document unchanged from the pre-change version.
- No files other than README.md are modified for this feature.
- The lean child task is completed and satisfies the README state above.

## Test Plan

- Run `head -n 3 README.md` and confirm line 1 is `TEMP`, line 2 is empty, line 3 is `# Relay`.
- Run `git diff README.md` to verify only the two-line prepend at the file top.
- Run `npm test` as a non-regression sanity check; no new automated README content test is required.

## Implementation Notes

- Codebase finding: README.md at repository root is the only readme in codex-relay; it currently opens with `# Relay` on line 1 (~282 lines of Quick Start, Codex setup, architecture, and `.relay/` storage docs).
- Codebase finding: package.json (`relay` v0.1.0) has no separate `readme` field; GitHub and local clones use root README.md as the default landing doc.
- Codebase finding: Glob search finds no other README* files under the project root.
- Codebase finding: tests/backend.test.ts uses ephemeral README.md content (`# baseline`) only in git path-lock fixture projects under temp dirs — unrelated to repo marketing copy; no test asserts root README body.
- Codebase finding: Relay feature drafts require non-empty leanTasks with plannedFiles per leanTaskDraftSchemaJson in src/services/codex/index.ts; draft_target_type feature mapping is in src/shared/draftTicket.ts (`resolveDraftPreferredTicketType`, `effectiveDraftPreferredTicketType`).
- Codebase finding: Unrelated board feature tkt_01ks4yxwpdrp66tcf70ydvzw6p covers agent CLI selection; trashed prior draft tkt_01ks5bq09wzt2z5dn5p87qhcy1 used different copy (TEMP TEXT) and is not authoritative for this ticket.
- Implementation: Open README.md at the repository root and insert `TEMP` as line 1.
- Implementation: Add a single blank line 2 so line 3 remains the original `# Relay` heading and all following content stays byte-identical below that point.
- Implementation: Save README.md only; do not touch other files.
- Implementation: Mark the feature done when the lean task acceptance criteria pass.
- Prior trashed draft used TEMP TEXT wording; this ticket follows intake: literal TEMP only.
- Implementation agent should not re-research file location — only edit README.md per plannedFiles.
- If the user intended different banner text, they should edit the ticket before execution; defaults treat TEMP as final.

## Codex Handoff

No Codex run has been started.
