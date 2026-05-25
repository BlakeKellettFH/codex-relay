---
schemaVersion: 1
id: tkt_01kseyph9agqpws8zz0w4q2h2m
title: Archive completed tickets with lean agent summaries
ticketType: feature
draftTargetType: null
status: todo
position: 10000
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
updatedAt: '2026-05-25T07:20:36.666Z'
authoringState: reviewing
summary: >-
  Completed work can move to the hidden Archive lane with agent-rewritten lean
  markdown so long ticket bodies do not bloat project history.

  - Tiered summarization: epic soft, feature aggressive, task most aggressive
  (tasks drop Context/Goal)

  - Archive button on completed tasks plus existing container bundles

  - Summarize-then-move replaces status-only archiveBundle
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ksezs8fmn66dney8jgsyg4jy
lastRunStartedAt: null
---
# Archive completed tickets with lean agent summaries

## Context

Relay already has a terminal `archive` column (hidden via `boardVisibleColumns`), epic/feature archive gating in `boardArchive.ts`, and move-only archiving in `App.tsx` `archiveBundle`. Archiving does not yet rewrite ticket markdown or refresh frontmatter `summary`. Completed standalone tasks have no archive affordance on board cards or detail.

## Goal

Only tickets in `completed` status may be archived; reject archive for other statuses with a clear error.

## Decisions / Assumptions

- Archive is user-initiated only from `completed` status (not `not_doing` or `review`).
- Agent summarization is asynchronous like existing ticket updates; UI shows busy/disabled state until the run completes.
- Title, priority, and labels are preserved unless the archive prompt explicitly allows minor title tightening.
- Existing epic/feature child-completion gating (`featureCanArchive` / `epicCanArchive`) remains unchanged before bundle archive starts.

## Requirements

- Only tickets in `completed` status may be archived; reject archive for other statuses with a clear error.
- Archiving runs an agent `ticket.update` with purpose `archive` that returns `patch.fullMarkdown` (required) and `patch.summary`; on success persist markdown, set `frontMatter.summary`, then `transitionTicketStatus` to `archive`.
- Tiered lean rewrite: epic soft (keep short Context, trim verbose lists/notes); feature aggressive (drop Implementation Notes/Test Plan, shorten Context); task most aggressive (remove Context and Goal entirely; keep lean Requirements and Acceptance Criteria only).
- Bundle archive (epic/feature) summarizes bottom-up—tasks, then features, then epic—sequentially; abort the bundle on first agent/persist failure without moving later tickets.
- Completed task board cards and completed task detail show Archive and call the new summarize-then-archive API; replace container `archiveBundle` move-only flow with the same API.
- Archive must not create clarification questions; archive runs are read-only agent mode like existing ticket updates.

## Acceptance Criteria

- A completed task in the Completed column shows an Archive control; clicking it runs summarize-then-archive and the card disappears from visible board columns.
- Archived ticket markdown is materially shorter; task archives have no Context/Goal sections; Requirements and Acceptance Criteria remain as lean bullets.
- Archiving a feature or epic bundle processes child tasks first, then features, then the container; all end in `archive` with updated summaries, or none move if a step fails.
- Board card excerpt reflects the new `frontMatter.summary` after archive.

## Test Plan

- `tests/ticket-update.test.ts`: archive purpose persists lean `fullMarkdown`, sets `frontMatter.summary`, moves status to `archive`, rejects non-completed tickets.
- `tests/board-archive.test.ts`: `sortArchiveBundleIds` orders tasks before features before epics; `showTaskArchive` only on completed column + completed status.
- `tests/backend.test.ts` or new archive route test: POST archive returns updated board; bundle stops on mocked agent failure.
- Run `node tests/run-tests.mjs` (or targeted files above).

## Implementation Notes

- Codebase finding: `RELAY_ARCHIVE_STATUS` and `boardVisibleColumns` in `src/shared/schemas/board.ts`; archive lane is terminal but not shown on the main board.
- Codebase finding: `src/renderer/src/lib/boardArchive.ts` exports `featureCanArchive`, `epicCanArchive`, `archiveBundleForFeature`, `archiveBundleForEpic`, `showFeatureArchive`, `showEpicArchive`; no task-level helpers.
- Codebase finding: `App.tsx` `archiveBundle` (lines ~2003–2028) loops `moveTicketMutation` to `archive` without body changes; `BoardTaskCardLeading` supports archive UI but `BoardTaskCard` does not pass `showArchive`/`onArchive`.
- Codebase finding: Ticket detail archive (`detailArchiveTarget`, ~4178–4202) covers completed epic/feature only; completed tasks return `null`.
- Codebase finding: `startTicketUpdateRun` in `src/services/codex/index.ts` uses structured `AgentTicketUpdate` (`agentTicketUpdateSchema` in `src/shared/schemas/ticket.ts`); purposes today are `default` and `scope_recovery`. Completion writes markdown via `applyAgentTicketPatch` but does not set `frontMatter.summary` or change status.
- Codebase finding: `moveTicket` → `transitionTicketStatus` in `src/storage/filesystem.ts` only updates status/position; container moves limited to review/completed/archive per guard at ~1757.
- Implementation: Extend `agentTicketUpdateInputSchema` purpose union with `archive`; add `buildArchiveTicketUpdatePrompt(ticketType)` with tiered section rules and require `patch.fullMarkdown` + empty `clarificationQuestions`.
- Implementation: In `startTicketUpdateRun` completion branch for `purpose === 'archive'`: validate ticket is `completed`, require `fullMarkdown`, `writeTicket` with updated markdown and `frontMatter.summary` from `patch.summary`, then `transitionTicketStatus(..., RELAY_ARCHIVE_STATUS)`; skip clarification creation.
- Implementation: Add `archiveTicket` and `archiveTicketBundle` in codex service (optional `src/services/codex/archiveTicket.ts`), `sortArchiveBundleIds` in `boardArchive.ts`, POST `/api/tickets/archive` in `src/shared/http/tickets.ts` + `src/http/resources/tickets.ts`, and `useArchiveTicketMutation` in renderer API layer.
- Implementation: Wire UI: `showTaskArchive`/`taskCanArchive` helpers; pass `showArchive`/`onArchive` from completed-column `BoardTaskCard`; extend `detailArchiveTarget` for completed tasks; route `archiveBundle`/`archiveEpic`/`archiveFeature`/detail archive through new mutation with `archivingContainerIds` busy state.
- Implementation: Update SPEC.md container/archive note to document summarize-then-archive behavior.
- Reuse `submitTicketUpdateWork` and provider `runStructured` with `kind: 'ticket.update'`; archive completion is the only place that changes status after rewrite.
- After `writeTicket`, board excerpt refresh is automatic via `ticketPreviewSummary` once `frontMatter.summary` is set.

## Codex Handoff

No Codex run has been started.
