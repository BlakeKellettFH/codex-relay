---
schemaVersion: 1
id: tkt_01ksf03k0ht1p5g152bakkprt2
title: Add archive purpose to ticket update agent flow
ticketType: task
draftTargetType: null
status: archive
position: 34000
priority: medium
effort: medium
labels:
  - backend
  - codex
parentEpicId: null
parentFeatureId: tkt_01kseyph9agqpws8zz0w4q2h2m
subticketIds: []
plannedFiles:
  - src/services/codex/index.ts
  - src/shared/schemas/ticket.ts
  - tests/ticket-update.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:20:36.625Z'
updatedAt: '2026-05-25T14:51:25.624Z'
authoringState: ready
summary: >-
  Ticket-update flow supports archive purpose with tiered lean prompts,
  completed-only guards, and completion that sets summary and transitions to
  archive without clarifications.
codexThreadId: 'cursor::68d2d7fe-2846-4b30-82c9-12c46d5303b5'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add archive purpose to ticket update agent flow

## Requirements

- `archive` on `agentTicketUpdateInputSchema.purpose`, branched like `scope_recovery` in `startTicketUpdateRun`
- `buildArchiveTicketUpdatePrompt` enforces task-tier section retention, requires `patch.fullMarkdown`, forbids clarifications
- Reject non-`completed` tickets before run and on persist; write lean body, set `frontMatter.summary`, transition to `archive`, emit `run.completed`

## Acceptance Criteria

- `ticket-update.test.ts` covers successful archive rewrite and non-completed rejection
- Archive run completes without clarification records
