---
schemaVersion: 1
id: tkt_01kseyph9agqpws8zz0w4q2h2m
title: Archive completed tickets with lean agent summaries
ticketType: feature
draftTargetType: null
status: archive
position: 40000
priority: medium
effort: medium
labels:
  - board
  - tickets
  - archive
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ksf03k0ht1p5g152bakkprt2
  - tkt_01ksf03k156jwpq2s0avhvw37h
  - tkt_01ksf03k1r7gsmkpsjkch67jh7
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:56:00.298Z'
updatedAt: '2026-05-25T14:54:05.569Z'
authoringState: ready
summary: >-
  Completed tickets archive through agent lean rewrite and POST
  /api/tickets/archive, with tiered summarization, bottom-up bundle ordering,
  and board/detail controls for tasks and containers.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Archive completed tickets with lean agent summaries

## Context

Relay exposed a hidden terminal archive lane and move-only container archiving without rewriting ticket bodies or refreshing card excerpts. Completed standalone tasks had no archive affordance.

## Requirements

- Only tickets in `completed` may archive; reject other statuses with a clear error
- `ticket.update` with `purpose: archive` requires `patch.fullMarkdown` and `patch.summary`; persist lean body, set `frontMatter.summary`, then transition to `archive`
- Tiered rewrite: epic soft trim, feature drops Implementation Notes/Test Plan, task drops Context/Goal
- Bundle archive summarizes bottom-up (tasks → features → epic) and aborts on first failure
- Board cards, detail, and containers call `POST /api/tickets/archive`; archive runs must not create clarifications

## Acceptance Criteria

- Completed tasks show Archive on board cards and detail; successful archive removes tickets from visible columns
- Archived markdown is materially shorter; tasks keep lean Requirements and Acceptance Criteria only
- Feature/epic bundles process children first; all reach `archive` with updated summaries or none move on failure
- Board card excerpts reflect `frontMatter.summary` after archive

## Delivered

- Codex `archive` purpose with tiered prompts, completed-only guards, and summary + status transition in `startTicketUpdateRun`
- `archiveTicket` / `archiveTicketBundle`, `sortArchiveBundleIds`, HTTP route, workflows, and `useArchiveTicketMutation`
- `showTaskArchive` / `taskCanArchive` on completed-column cards; container gating unchanged; renderer uses POST instead of client polling
- Coverage in `ticket-update`, `board-archive`, `board-archive-button`, and `backend` archive route tests
