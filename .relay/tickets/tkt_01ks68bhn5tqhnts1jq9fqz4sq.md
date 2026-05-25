---
schemaVersion: 1
id: tkt_01ks68bhn5tqhnts1jq9fqz4sq
title: SPEC layered review documentation
ticketType: task
draftTargetType: null
status: completed
position: 10000
priority: low
effort: medium
labels:
  - docs
  - spec
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - SPEC.md
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.101Z'
updatedAt: '2026-05-21T22:11:41.835Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::768ac682-41b7-4380-adfc-abb04d369716'
runStatus: completed
lastRunId: run_01ks68q3x9nvhvp75ccdtcnbyf
lastRunStartedAt: '2026-05-21T22:04:16.575Z'
---
# SPEC layered review documentation

## Context

Parent feature: Layered container review for epics and features

SPEC currently says container status is ignored for board placement and epics/features cannot change workflow status.

## Goal

Align written spec with implemented layered review without changing task execution rules.

## Requirements

- Document feature Review gate (all linked tasks terminal) and epic gate (all linked features completed + tasks terminal).
- Document that container Accept/Reject moves only that container and does not cascade.
- Clarify board shows review-status containers in Review even without in-column tasks.

## Acceptance Criteria

- SPEC §5.5.1 describes layered Review and points to container-only Review board cards.
- SPEC no longer implies containers can never use `review`/`completed` statuses.

## Implementation Plan

- Edit SPEC.md §5.5.1 hierarchy bullets for container Review promotion and acceptance.
- Add a short §6.2 note that Review column may show container headers without child tasks.

## Assumptions

- Archive rules in boardArchive.ts remain unchanged by this feature.

## Codex Handoff

### 5/21/2026, 11:05:51 PM

The user wants me to
update SPEC.md to match
the implemented layered
review functionality.
I will read more of
SPEC.md around sections
5.
The board displays containers
in the Review column
with specific Accept/Reject
behaviors, but the
UI details and display
mechanisms require
further clarification.
I need to examine additional
sibling tickets and
existing SPEC fragments
related to review functionality.
The Review column container
logic is not yet implemented
in boardColumnLayout.ts.
The sibling ticket
tkt_01ks68bhmjc68jk7krptdqqcyg
indicates that ticketsForBoardColumn
needs to be extended.
Reading transitionTicketStatus
from the filesystem.
I now have a clear understanding
and need to update
SPEC.md 5.
5.1 To update the
outdated bullets at
lines 481483 in SPEC.md
and add a note in 6.2
regarding the Review
column.

Key points
to document:

1. **Layered
Review**  Features
and epics each have
their own review layer
above task review.
2. **Feature Review
gate**  All linked tasks
must be in a terminal
column (completed,
not_doing, archive,
or terminal).
3. **Epic
Review gate**  All
linked features must
be completed, and all
descendant tasks must
be terminal.
4. **Auto-promotion**
The system automatically
moves items to the
review column when gates
are satisfied; otherwise,
it demotes them back
to the todo column.
Now I'll craft the SPEC
edits to replace lines
481-483 with updated
content covering the
specified requirements.
Board column visibility
follows task-driven
logic, except for the
Review column. The
review section uses
a layered container
approach, while workflow
constraints apply only
to review, completed,
and archive states
rather than full workflow
cards. A note is added
at 6.2 after line 562.
For 5.5.1, replace
lines 481-483 with:
- Tasks whose parent
features no longer
exist appear as normal
cards in their column
instead of being hidden
in a missing group.
- **Board column visibility
(tasks)**: A task appears
in a column when its
status matches that
column.
Board column visibility
for non-Review columns
shows a `feature` or
`epic` only when at
least one linked descendant
`task` is in that column,
regardless of the container's
own `status`. In the
Review column, a `feature`
or `epic` with `status:
review` appears as
a container-only card
when all linked tasks
are terminal and the
container awaits acceptancesee
6.2.
On the board, epics
appear as lightweight
headers above nested
feature groups, while
features appear as
grouped containers around
their in-column tasks.
Sidebar swimlane counts
reflect only tasks
per column.

Layered
container review allows
tasks to progress through
workflow columns independently,
with feature and epic
tickets adding a secondary
review layer atop task
completion.
**Feature Review gate**:
When a feature has
at least one linked
task and all linked
tasks are in terminal
columns (`completed`,
`not_doing`, `archive`,
or columns marked `terminal:
true`), Relay may auto-promote
the feature to `review`
if it is not already
`review` or `completed`.
If any linked task
exits a terminal status
while the feature is
in `review`, Relay
demotes the feature
to `todo`.
**Epic Review gate**:
When an epic has at
least one linked feature
and every linked feature
is `completed` with
all descendant tasks
terminal, Relay may
auto-promote the epic
to `review` if not
already `review` or
`completed`. If a linked
feature leaves `completed`
while the epic is in
`review`, Relay demotes
the epic to `todo`.
**Container accept/reject**:
When a feature or epic
is in `review`, ticket
details show **Accept**
and **Reject** options
similar to tasks.
**Accept** and **Reject**
buttons move only the
opened container to
`completed` without
affecting sibling tasks,
child tasks, or parent
containers. Accepting
a task does not affect
its parent feature
or epic.

Container
status transitions for
epics and features
are limited to `review`,
`completed`, and `archive`
statuses. Ticket details
must not provide a
generic workflow **Status**
control for arbitrary
column moves. Status
transition APIs must
restrict epic/feature
movements to these
three states only.
That's part of an example
template in SPECsomething
I didn't introduce.
Reading SPEC.md and related implementation context to align documentation with layered review.
Updating SPEC.md §5.5.1 and §6.2 to document layered container review per the ticket.
## Summary

Updated `SPEC.md` so §5.5.1 and §6.2 match the implemented layered container review behavior, without changing task execution rules.

**§5.5.1** now covers:
- Split board visibility: tasks by `status`; containers task-driven except in **Review**
- **Container-only Review cards** when `status: review` and children are terminal elsewhere
- **Layered container review**: feature gate (all linked tasks terminal), epic gate (all features `completed` + all tasks terminal), auto-promote/demote rules
- **Accept/Reject** on containers in `review` — only that container moves to `completed`, no cascade
- Container transitions limited to `review` / `completed` / `archive`; other columns still require moving child tasks

**§6.2** adds a short note that the Review column may show container headers without in-column child tasks.

Removed the old wording that container `status` is ignored for placement and that epics/features cannot use workflow statuses.

## Files changed

- `SPEC.md`

## Commands run

None.

## Tests run

None (documentation-only change within ticket scope).

## Subagent usage

None.

## Remaining risks / follow-up

- Sibling implementation tickets (board layout, UI) may still be in flight; this spec documents the intended behavior they implement.
- Default columns table in §6.3 still omits a `review` row; add later if product wants it documented alongside other default columns.
- Archive rules in `boardArchive.ts` are unchanged per ticket assumptions.


No Codex run has been started.
