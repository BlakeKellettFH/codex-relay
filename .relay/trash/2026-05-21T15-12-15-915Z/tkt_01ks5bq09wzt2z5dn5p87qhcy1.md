---
schemaVersion: 1
id: tkt_01ks5bq09wzt2z5dn5p87qhcy1
title: Add TEMP TEXT banner to main README
ticketType: feature
draftTargetType: null
status: todo
position: 2000
priority: medium
effort: low
labels:
  - docs
  - readme
parentEpicId: null
parentFeatureId: null
subticketIds: []
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T13:31:02.844Z'
updatedAt: '2026-05-21T15:12:15.914Z'
authoringState: reviewing
summary: >-
  This feature updates the repository's primary README so the literal line TEMP
  TEXT appears before all existing content. That gives the project a visible
  top-of-file marker for the requested scratch change without touching
  application code or Relay runtime behavior.


  - Edit only README.md at the repo root; leave the rest of the doc structure
  intact.

  - Insert the exact string TEMP TEXT as the first line, followed by a blank
  line before `# Relay`.

  - Ship as one lean documentation task with markdown diff review as validation.


  Risk is low: TEMP TEXT looks like placeholder copy and may need a follow-up
  editorial ticket before any public release.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ks5eppd1np7481txbd8p2qar
lastRunStartedAt: null
---
# Add TEMP TEXT banner to main README

## Context

Draft ticket tkt_01ks5bq09wzt2z5dn5p87qhcy1 failed during Codex drafting (`unknown option '--format'`). The user idea is unchanged: update the main readme and add TEMP TEXT at the top. Intake selected product_feature scope with Feature mode, so this plan is a parent feature with one executable lean task.

## Goal

Prepend the exact literal text TEMP TEXT to README.md as the first line of the file.

## Decisions / Assumptions

- TEMP TEXT is intentional literal copy from the user, not a placeholder to be invented or expanded by the implementer.
- Main readme means repository-root README.md only; no other markdown readmes exist in the project.
- A single lean task is sufficient because this is a one-file, two-line documentation prepend.
- No follow-up removal or replacement of TEMP TEXT is in scope unless the user opens a separate ticket.

## Requirements

- Prepend the exact literal text TEMP TEXT to README.md as the first line of the file.
- Insert one blank line between TEMP TEXT and the existing `# Relay` heading so markdown structure stays readable.
- Do not modify any other README sections, links, or images.
- Do not change application source, tests, or package metadata for this documentation-only request.
- Apply the change through the single lean task under this feature.

## Acceptance Criteria

- README.md first line is exactly TEMP TEXT with no leading whitespace or markdown prefix.
- A blank line separates TEMP TEXT from the original `# Relay` title.
- No files outside README.md are modified for this feature.
- The lean child task is completed and matches the above README state.

## Test Plan

- Run `head -n 3 README.md` and confirm line 1 is `TEMP TEXT`, line 2 is blank, line 3 is `# Relay`.
- Optionally run `git diff README.md` to verify only the intended prepend.
- Run `npm test` as a non-regression sanity check; no new automated README test is required.

## Implementation Notes

- Codebase finding: README.md at the repository root is the sole project readme; it currently opens with `# Relay` on line 1 and documents Quick Start, prerequisites, architecture (`src/http/`, `src/main.app.ts`, `src/renderer/`), and local `.relay/` storage (~282 lines).
- Codebase finding: package.json does not declare a separate readme field; GitHub and local clones use README.md as the default landing doc.
- Codebase finding: No tests assert README.md body content. tests/backend.test.ts uses README.md only in git path-lock fixtures (`# baseline` content), unrelated to repo marketing copy.
- Codebase finding: Relay draft schema in src/services/codex/index.ts (`ticketDraftSchemaJson`, `leanTaskDraftSchemaJson`) expects feature drafts with non-empty leanTasks and plannedFiles on each task; draft_target_type mapping lives in src/shared/draftTicket.ts (`effectiveDraftPreferredTicketType`).
- Codebase finding: Prior failed draft run is recorded under .relay/work/runs/run_01ks5c0x32gw5jpvzr2m8qp322/ with backend_failure from the Cursor agent CLI lacking `--format json`.
- Implementation: Land the README prepend via lean task Insert TEMP TEXT at top of README.md.
- Implementation: Keep all substantive README content below the new banner unchanged.
- Implementation: Mark the feature done when the lean task acceptance criteria pass.
- Prior Codex/Cursor draft automation failed on CLI flag `--format`; this handoff completes the draft payload only.
- If TEMP TEXT was meant as replaceable placeholder wording, the user should edit the ticket before implementation—defaults treat it as final requested text.

## Codex Handoff

No Codex run has been started.
