---
schemaVersion: 1
id: tkt_01ks68bhmy6as859qejv9d29kq
title: Accept and reject UI for container review
ticketType: task
draftTargetType: null
status: completed
position: 8000
priority: medium
effort: medium
labels:
  - ui
  - review
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.094Z'
updatedAt: '2026-05-21T22:11:23.280Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::aad3e29f-eac0-40b1-8f04-3bfb2f9d5e02'
runStatus: completed
lastRunId: run_01ks68q1gz9c2gfdgwa1e7jn94
lastRunStartedAt: '2026-05-21T22:01:45.232Z'
---
# Accept and reject UI for container review

## Context

Parent feature: Layered container review for epics and features

Detail already renders Accept/Reject for tasks via `reviewActionState.showAcceptReject`; containers show a static note that they follow child columns.

## Goal

Let users accept or reject a feature or epic in Review the same way as a task, moving only that ticket to Completed.

## Requirements

- Update `getTicketReviewActionState` to return true for `feature` and `epic` when `status === review` and completed column exists.
- When a container is in `review`, replace the generic follow-child-columns status note with review-specific guidance and keep Accept/Reject wired to existing `moveTicketTo`.
- Ensure accept/reject handlers do not loop promotion into parents.

## Acceptance Criteria

- Opening a feature in `review` shows Accept and Reject buttons.
- Clicking Accept on a feature in `review` moves only that feature to `completed`; linked tasks remain `completed`.
- Epic in `review` behaves the same; parent feature acceptance does not auto-accept the epic.

## Implementation Plan

- Edit `getTicketReviewActionState` in `App.tsx` for feature/epic review.
- Conditional container status copy in ticket detail sidebar (~L4147).
- Update `tests/ticket-draft-ui.test.tsx` expectations for feature/epic review state.

## Assumptions

- Reject continues to call `moveTicketTo(completed)` with the existing reject toast message.

## Codex Handoff

### 5/21/2026, 11:04:16 PM

Implement a feature
to accept or reject
container tickets (features
and epics) during review,
mirroring the existing
task-level functionality.
I need to understand
the context better.
Ensure that accept and
reject handlers do
not cause promotion
to loop into parent
elements.
The backend exclusively
invokes `maybePromoteOrDemoteContainers`
when the moved ticket
is classified as a
task.
The backend already
prevents parent promotion
loops in accept/reject
handlers through `maybePromoteOrDemoteContainers`,
so no UI changes are
required for that.
The implementation now
needs to extend `getTicketReviewActionState`
to support feature
and epic types when
status is review and
a completed column
exists. Additionally,
container status notes
should display review-specific
guidance instead of
generic follow-child
messages when containers
are in review.
For the review-specific
guidance copy, I'll
write something clear
and actionable that
provides specific instructions
tailored to the review
process.
I will implement the
changes now.
I will update `getTicketReviewActionState`
to include feature
and epic types in reviews
with completed column
availability, add `getContainerTicketStatusNote`
as an exported helper
for status note text
to improve testability,
update the sidebar
to use this helper,
and update the tests
accordingly.
export function getContainerTicketStatusNote(
ticketType: "epic"
| "feature",
  status:
string
): string {
if (status === RELAY_REVIEW_STATUS)
{
    const label =
ticketType === "epic"
? "epic" : "feature";
return `This ${label}
is in Review. Accept
or Reject moves only
this ${label} to Completed
without changing child
tasks${ticketType ===
"feature" ? " or parent
epics" : ""}.`;
  }
return ticketType
=== "epic"
    ? "Epics
follow child task columns.
Open tasks below to
move work across the
board."
    : "Features
follow child task columns.
</to_summarize>
For epic in review:
"This epic is in Review.
Use Accept or Reject
to move only this epic
to Completed; child
features and tasks
stay as they are."
For feature in review:
"This feature is in
Review. Use Accept
or Reject to move only
this feature to Completed;
child tasks stay as
they are."
TicketType includes
task, feature, and epic.
I need to address a
type narrowing issue
where `ticket.frontMatter.ticketType`
might not correctly
narrow to `epic` or
`feature` when `isContainerTicket`
is true, potentially
causing TypeScript
errors.
Shell is entirely rejected.
The type assertion
or conditional check
is needed because `ticket.frontMatter.ticketType`
includes "task" while
the function expects
only "epic" or "feature".
All shell commands are
rejected.
The implementation appears
to be complete.
The shell is unavailable
in this environment.
TypeScript may fail
to narrow the type of
`ticket.frontMatter`.
I'll implement container accept/reject in review by reading the planned files and the current review-action logic.
Implementing the changes.
## Summary

Container review now uses the same Accept/Reject flow as tasks. Features and epics in `review` show those controls and review-specific status copy; accept/reject still moves only the opened ticket via existing `moveTicketTo`.

## Changes

**`getTicketReviewActionState`** — `showAcceptReject` is true for `task`, `feature`, and `epic` when `status === review` and a Completed column exists.

**`getContainerTicketStatusNote`** (new) — Returns review guidance when a container is in `review`; otherwise keeps the existing “follow child task columns” message.

**Ticket detail sidebar** — Container status uses `getContainerTicketStatusNote` instead of static copy.

**Accept/reject handlers** — Unchanged. They still call `moveTicketTo(RELAY_COMPLETED_STATUS)` for the open ticket only. `moveTicket` in `filesystem.ts` runs `maybePromoteOrDemoteContainers` only for **task** moves, so container accept/reject does not promote parents.

## Files changed

- `src/renderer/src/App.tsx`
- `tests/ticket-draft-ui.test.tsx`

## Commands run

None — shell execution was blocked in this environment.

## Tests

Not run here. Locally:

```bash
node tests/run-tests.mjs
```

(or the project’s usual test command; `run-tests.mjs` runs the full bundled suite.)

**Test updates:**
- Renamed/expanded review action state test for task, feature, and epic in `review`
- Added `getContainerTicketStatusNote` tests for review vs non-review copy

## Subagent usage

**none used** — one subagent was launched to run tests but could not execute shell commands.

## Remaining risks / follow-up

- Run the test suite locally to confirm green.
- End-to-end accept/reject for features/epics depends on backend support from the parent feature (`transitionTicketStatus` allowing container `review`/`completed`); that is outside this ticket’s file scope.
- Epic auto-promotion when a child feature is accepted to Completed is a separate storage concern (not triggered by container moves today).


No Codex run has been started.
