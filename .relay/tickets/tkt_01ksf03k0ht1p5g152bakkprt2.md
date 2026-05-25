---
schemaVersion: 1
id: tkt_01ksf03k0ht1p5g152bakkprt2
title: Add archive purpose to ticket update agent flow
ticketType: task
draftTargetType: null
status: review
position: 5000
priority: medium
effort: medium
labels:
  - backend
  - codex
parentEpicId: null
parentFeatureId: tkt_01kseyph9agqpws8zz0w4q2h2m
subticketIds: []
plannedFiles:
  - src/shared/schemas/ticket.ts
  - src/services/codex/index.ts
  - tests/ticket-update.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:20:36.625Z'
updatedAt: '2026-05-25T07:26:19.211Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::68d2d7fe-2846-4b30-82c9-12c46d5303b5'
runStatus: completed
lastRunId: run_01ksf0818dv0t6pa3r8a83hbkb
lastRunStartedAt: '2026-05-25T07:23:02.413Z'
---
# Add archive purpose to ticket update agent flow

## Context

Parent feature: Archive completed tickets with lean agent summaries

Foundation for all archive behavior; mirrors scope_recovery branching in startTicketUpdateRun.

## Goal

Archive runs produce lean fullMarkdown and land tickets in the archive column.

## Requirements

- Add `archive` to agentTicketUpdateInput purpose schema.
- Archive prompt enforces tiered section retention and requires patch.fullMarkdown.
- Completion path writes ticket, sets summary, transitions to archive; no clarifications.

## Acceptance Criteria

- ticket-update.test.ts covers successful archive rewrite and non-completed rejection.
- Archive run emits run.completed without creating clarification records.

## Implementation Plan

- Add buildArchiveTicketUpdatePrompt and branch in buildTicketUpdatePrompt / startTicketUpdateRun completion.
- Validate completed status before starting archive update.
- Set frontMatter.summary from patch.summary when persisting archive result.

## Assumptions

- Archive agent output uses the existing AgentTicketUpdate schema.

## Codex Handoff

### 5/25/2026, 8:26:19 AM

I'll implement archive purpose in the ticket update flow by reading the planned files and how `scope_recovery` is handled today.
Implementing archive purpose across the schema, codex service, and tests.
## Summary of changes

Added `archive` as a ticket-update purpose, mirroring the `scope_recovery` branch in `startTicketUpdateRun`.

- **Schema:** `agentTicketUpdateInputSchema.purpose` now accepts `"archive"`.
- **Archive prompt:** `buildArchiveTicketUpdatePrompt` applies tiered section retention (epic soft, feature aggressive, task most aggressive), requires `patch.fullMarkdown`, forbids clarifications, and is selected from `buildTicketUpdatePrompt` when `purpose === "archive"`.
- **Guards:** Archive runs are rejected unless the ticket is in `completed` status (checked before the agent starts and again on persist).
- **Completion path:** Writes lean `fullMarkdown`, sets `frontMatter.summary` from `patch.summary`, transitions to `archive`, emits `run.completed`, and skips clarification creation.

## Files changed

- `src/shared/schemas/ticket.ts`
- `src/services/codex/index.ts`
- `tests/ticket-update.test.ts`

## Commands run

None — shell execution was unavailable in this environment.

## Tests run and results

Not run here. Please verify locally:

```bash
node tests/run-tests.mjs tests/ticket-update.test.ts
```

New coverage:

- Successful archive rewrite (lean `fullMarkdown`, `summary`, `archive` status, no clarifications, `run.completed`)
- Non-completed tickets rejected before the agent runs

## Subagent usage

None used.

## Remaining risks / follow-up

- **`archiveTicket` / API / UI** are out of scope for this ticket; callers must pass `purpose: "archive"` (planned in sibling tickets).
- **Epic/feature tiered prompts** are encoded in the prompt only; no automated assertion that the agent followed tier rules.
- Run the test file locally to confirm green before marking the ticket complete.


No Codex run has been started.
