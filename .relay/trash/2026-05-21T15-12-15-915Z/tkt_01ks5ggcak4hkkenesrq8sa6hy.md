---
schemaVersion: 1
id: tkt_01ks5ggcak4hkkenesrq8sa6hy
title: Land TEMP TEXT banner in root README.md
ticketType: task
status: todo
position: 3000
priority: medium
effort: medium
labels:
  - docs
  - readme
draftTargetType: null
parentEpicId: null
parentFeatureId: tkt_01ks5bq09wzt2z5dn5p87qhcy1
subticketIds: []
plannedFiles:
  - README.md
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T14:54:48.659Z'
updatedAt: '2026-05-21T14:54:48.659Z'
authoringState: rough
summary: ''
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Land TEMP TEXT banner in root README.md

## Context

Parent feature: Add TEMP TEXT banner to main README

Extend existing feature Add TEMP TEXT banner to main README (tkt_01ks5bq09wzt2z5dn5p87qhcy1). Draft placeholder tkt_01ks5gbr7wwn0tpj1s03dkkrfh duplicates this intent and should become tasks under the feature, not a parallel capability. Sibling task Insert TEMP TEXT at top of README.md (tkt_01ks5er9n1e1t05wsncg3k3gcz) is marked completed and its handoff describes the correct prepend, but working-tree README.md at the repo root still begins with # Relay on line 1 with no TEMP TEXT banner.

## Goal

Make README.md on disk match the parent feature acceptance criteria by prepending the exact literal line TEMP TEXT, one blank line, then the existing # Relay heading without changing any other README content.

## Requirements

- Edit only README.md at the repository root; do not modify application source, tests, or package metadata.
- Set line 1 to exactly TEMP TEXT with no leading whitespace, markdown prefix, or quotes.
- Insert exactly one blank line 2 between TEMP TEXT and the existing # Relay heading on line 3.
- Leave all README content from the original # Relay section downward unchanged in wording, order, and formatting.

## Acceptance Criteria

- README.md line 1 is exactly TEMP TEXT.
- README.md line 2 is blank.
- README.md line 3 is exactly # Relay.
- git diff README.md shows only the two-line prepend at the top of the file.
- head -n 3 README.md output matches the three-line banner structure above.

## Implementation Plan

- Open repository-root README.md and confirm it currently starts with # Relay and lacks a TEMP TEXT banner.
- Prepend TEMP TEXT as line 1, insert a blank line 2, and shift the existing # Relay heading and all following content down without rewording.
- Save README.md without trailing whitespace on the TEMP TEXT line.
- Run head -n 3 README.md and git diff README.md; record results in the Codex handoff.

## Assumptions

- TEMP TEXT is the final requested literal banner text from the parent feature, not shorthand for alternate wording.
- No markdown heading or blockquote wrapper is required around the banner unless the user edits the ticket later.
- A single documentation edit is sufficient to close the working-tree gap; no Relay application code changes are required.

## Codex Handoff

No Codex run has been started.
