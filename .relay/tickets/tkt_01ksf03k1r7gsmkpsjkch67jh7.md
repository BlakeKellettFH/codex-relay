---
schemaVersion: 1
id: tkt_01ksf03k1r7gsmkpsjkch67jh7
title: Wire archive UI for completed tasks and bundles
ticketType: task
draftTargetType: null
status: review
position: 7000
priority: medium
effort: medium
labels:
  - ui
  - board
parentEpicId: null
parentFeatureId: tkt_01kseyph9agqpws8zz0w4q2h2m
subticketIds: []
plannedFiles:
  - src/renderer/src/lib/boardArchive.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/BoardTaskCardLeading.tsx
  - tests/board-archive-button.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T07:20:36.664Z'
updatedAt: '2026-05-25T07:30:31.772Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::e8d58a1b-f16b-4db3-bfbc-da809f5f3973'
runStatus: completed
lastRunId: run_01ksf081j2md6v8p8bhw8hg31e
lastRunStartedAt: '2026-05-25T07:25:01.533Z'
---
# Wire archive UI for completed tasks and bundles

## Context

Parent feature: Archive completed tickets with lean agent summaries

Completes the user-facing request for archive buttons on completed tickets.

## Goal

All archive entry points use the new API and show appropriate busy/toast feedback.

## Requirements

- Completed-column task cards show BoardArchiveButton when status is completed.
- Completed task detail shows Archive tooltip like containers.
- archiveEpic/archiveFeature/archiveBundle/detail archive call archive mutation, not moveTicket alone.

## Acceptance Criteria

- Completed task card archive removes ticket from visible columns after successful run.
- Container archive still respects featureCanArchive/epicCanArchive gating with existing toast messages.

## Implementation Plan

- Add showTaskArchive/taskCanArchive helpers in boardArchive.ts.
- Thread onArchiveTask and archiving state through BoardTaskCard and board column render in App.tsx.
- Extend detailArchiveTarget for tasks; switch archiveBundle to archiveTicketBundle mutation.

## Assumptions

- Users wait on-page for archive runs; no background notification beyond existing run events/toasts.

## Codex Handoff

### 5/25/2026, 8:30:31 AM

Implementing archive UI for completed tasks and bundles. Exploring the planned files and related patterns.
Implementing UI wiring and switching archive flows to agent-based archive updates (`purpose: "archive"`) instead of `moveTicket`, since the dedicated archive HTTP API isn't in scope yet.
## Summary

Archive UI is wired for completed tasks and bundles. Board and detail flows now run the **agent archive update** (`startAgentUpdate` with `purpose: "archive"`) instead of looping `moveTicket` to the archive column.

### Changes

**`boardArchive.ts`**
- `taskCanArchive` / `showTaskArchive` for completed-column task cards
- `ARCHIVE_TICKET_UPDATE_REQUEST` constant
- `sortArchiveBundleIds` (tasks → features → epics)

**`App.tsx`**
- `archiveTicketIdsWithAgent` + polling until each ticket reaches `archive`
- `archiveBundle` / `archiveEpic` / `archiveFeature` use agent archive with sorted bundles
- `archiveTask` for standalone completed task cards
- `onArchiveTask` threaded through `BoardColumnsGrid` → `BoardColumn` → `BoardTicketCard` → `BoardTaskCardLeading`
- `detailArchiveTarget` extended for **tasks** with Archive tooltip (same pattern as containers)
- Detail Archive button uses agent archive instead of `moveTicket`

**`tests/board-archive-button.test.tsx`**
- Tests for task card archive button, `showTaskArchive`, and `sortArchiveBundleIds`

### Files changed
- `src/renderer/src/lib/boardArchive.ts`
- `src/renderer/src/App.tsx`
- `tests/board-archive-button.test.tsx`

(`BoardTaskCardLeading.tsx` already supported `showArchive` / `onArchive` — no edit needed.)

### Commands run
Shell execution was unavailable in this session; tests were not run here.

### Tests (please run locally)
```bash
node --import tsx --test tests/board-archive-button.test.tsx tests/board-archive.test.ts
```

### Subagent usage
**none used**

### Remaining risks / follow-up
1. **`useArchiveTicketBundle` / POST `/api/tickets/archive`** — not in repo yet (sibling ticket). UI uses `useStartTicketUpdateMutation` with `purpose: "archive"` plus board polling. Swap to the dedicated mutation when the HTTP API lands (`relayApi` / `relayQueries` are out of scope for this ticket).
2. **Tasks inside feature groups** in the Completed column still lack card-level archive buttons (`FeatureBoardGroup.tsx` is out of scope); only top-level `BoardTicketCard` tasks get the button. Detail Archive works for completed tasks regardless.
3. **Archive latency** — bundles run sequentially and wait up to 120s per ticket for the agent to finish; slow runs keep the busy state on the card/container id.


No Codex run has been started.
