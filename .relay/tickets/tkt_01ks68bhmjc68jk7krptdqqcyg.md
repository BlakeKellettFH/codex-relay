---
schemaVersion: 1
id: tkt_01ks68bhmjc68jk7krptdqqcyg
title: Review column board layout for containers
ticketType: task
draftTargetType: null
status: completed
position: 9000
priority: medium
effort: medium
labels:
  - board
  - ui
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - src/renderer/src/lib/boardColumnLayout.ts
  - src/renderer/src/lib/boardReview.ts
  - tests/board-column-layout.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.082Z'
updatedAt: '2026-05-21T22:11:35.802Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::1f8d16a0-6132-4286-8edf-896519ca022b'
runStatus: completed
lastRunId: run_01ks69349qr2y8d1gh1ag1bkpz
lastRunStartedAt: '2026-05-21T22:05:51.463Z'
---
# Review column board layout for containers

## Context

Parent feature: Layered container review for epics and features

Review column visibility is entirely derived from in-column tasks today, so completed work makes parent headers disappear.

## Goal

Show features and epics awaiting container review as first-class Review column items without listing completed child tasks there.

## Requirements

- When `columnId === review`, include tickets where `ticketType` is `feature` or `epic` and `status === review`.
- Organize container-only groups: `feature-group` with empty `tasks` and `featureInColumn: true`; `epic-group` with empty `featureGroups` when epic is in review alone.
- Do not pull completed/not_doing tasks into Review groups when the container itself is in review.

## Acceptance Criteria

- Feature with `status: review` and all tasks `completed` renders one Review column group with no nested task cards.
- Epic with `status: review` and all features `completed` renders an epic header in Review without child task rows.
- Todo/Ready columns remain task-driven only (no regression).

## Implementation Plan

- Import gate/display helpers from `boardReview.ts` into `boardColumnLayout.ts`.
- Extend `ticketsForBoardColumn` to merge review-status containers for the Review column.
- Extend `organizeColumnBoardItems` to emit standalone container groups when `featureInColumn`/`epic.status === review` and no column tasks exist.
- Add Review-column cases to `tests/board-column-layout.test.ts`.

## Assumptions

- Container Review cards use the same epic/feature group components with empty child lists.

## Codex Handoff

### 5/21/2026, 11:08:17 PM

The user requests a
ticket to review the
column board layout
for containers.
When `columnId` equals
`review`, only include
tickets with `ticketType`
of `feature` or `epic`
and `status` of `review`.
For container-only
groups, create `feature-group`
with empty `tasks`
and `featureInColumn:
true`, and `epic-group`
with empty `featureGroups`
when an epic is in
review alone. Exclude
completed or `not_doing`
tasks from Review groups
if the container itself
is in review. The implementation
requires importing
gate/display helpers
from `boardReview.ts`
into `boardColumnLayout.ts`.
I need to understand
what helpers are available
from boardReview.
The ticket requires
importing display helpers
from `boardReview.ts`
into `boardColumnLayout.ts`
and extending functions
to handle review-status
containers and standalone
container groups. Existing
helpers like `featureReadyForReview`
and `epicReadyForReview`
are available in `boardReview.ts`.
The ticket instructs
to import gate and
display helpers from
boardReview.ts.
I need to add display
helpers to boardReview.ts
if they don't exist
yet. The implementation
plan includes adding
helpers like `isReviewBoardColumn(columnId)`,
`reviewContainersInColumn(allTickets)`
for features/epics
with status === review,
and possibly `shouldExcludeTaskFromReviewGroup`
for completed/not_doing
tasks when container
is in review. Additionally,
I need to extend `ticketsForBoardColumn`
to merge in features/epics
with status === review
when columnId === review.
Extend `organizeColumnBoardItems`
to include standalone
container groups for
review-status containers
without column tasks.
When a container is
in review, exclude
completed or not-doing
tasks from groups,
showing empty tasks
instead. Create feature-groups
with `featureInColumn:
true` when `feature.status
=== review`, and epic-groups
with empty featureGroups
when an epic exists
alone in review. For
features in review
with all tasks completed,
display a feature-group
with empty tasks.
I now have a clear understanding
and need to proceed
accordingly.
I need to add display
helpers to boardReview.ts
including `isReviewBoardColumn`,
`reviewStatusContainers`
to filter features/epics
with status === review,
and potentially `taskCountsForReviewColumnGrouping`
to exclude completed/not_doing
tasks from groups when
the container is in
review. The key requirement
is to not pull completed/not_doing
tasks into Review groups
when the container
itself is in review,
meaning these tasks
should be filtered
out from the tasks list
in groups where the
feature/epic has status
=== review.
When tasks are in
review status, only
those tasks should appear
in the Review column
group, excluding completed
or not-doing tasks.
If all tasks are completed,
the feature itself
should render as a standalone
group without nested
task cards.
When a parent container
is in review status,
completed or not-doing
tasks must be excluded
from the review column
group. The `ticketsForBoardColumn`
function should include
features and epics
with status === review,
while `organizeColumnBoardItems`
needs to identify and
add standalone review-status
features and epics
that aren't already
included in the normal
organization process.
When a container is
in review, tasks in
the Review column group
should exclude completed
or not-doing tasks.
For epics in review,
if the epic is alone
(all features completed),
the featureGroups should
be empty. If both the
epic and its associated
feature are in review,
additional logic may
be needed to handle
the grouping properly.
Epic with review status
and all completed features
renders an epic header
in Review without child
task rows. If an epic
is in review while
its features are completed,
the featureGroups remain
empty. For epics in
review with features
also in review, features
are shown only if they
contain tasks in the
review column or are
in review with tasks.
Features in review
but with no tasks may
appear either nested
under the epic or as
top-level feature groups.
For an epic in review
with all completed
features, the features
won't appear in the
review column, resulting
in an empty feature
group. A feature in
review under an epic
that is not in review
will appear as a top-level
item if the epic is
not in review.

I will
implement display helpers
in boardReview.ts including
`isReviewBoardColumn`
and `reviewStatusContainers`.
( ticket.ticketType
=== "feature" || ticket.ticketType
=== "epic" ) && ticket.status
=== RELAY_REVIEW_STATUS
export const tasksForReviewColumnGroup
= (
  container: TicketSummary,
columnTasks: TicketSummary[]
): TicketSummary[]
=> {
  if (container.status
!== RELAY_REVIEW_STATUS)
return columnTasks;
return columnTasks.filter(
(task) => task.status
!== RELAY_COMPLETED_STATUS
&& task.status !==
RELAY_NOT_DOING_STATUS
);
};

For organizeColumnBoardItems,
when building groups
from columnTasks, tasks
must be filtered when
the feature is in review.
The flow is:

1.
Get columnTasks for
items with status ===
review, group them
by feature, and filter
out completed or not-doing
tasks when the feature
is in review. Add standalone
review-status containers
to the results if theyre
missing from the grouped
items.
When an epic is in
review and all its
features are completed,
avoid adding the features
as separate top-level
groups to prevent duplicates.
If an epic is in review
with no tasks in the
review column, it should
still appear as a group
with empty featureGroups.
For features in review
with no tasks, they
should be added as
groups with empty tasks
and marked as featureInColumn:
true. When an epic
is in review and has
a feature in review
with tasks, the tasks
should be included
in the review column
group.
Normal grouping creates
an epic-group with
a feature-group containing
tasks. A feature is
marked as `featureInColumn`
when its status equals
review.  

When an
epic is in review and
all its features are
completed, the featureGroups
remain empty. The epic
itself is added as
a group with no child
tasks. If an epic is
in review while its
features are completed,
it appears as a standalone
group with empty featureGroups.
If an epic is in
review and has features
in review with no tasks,
those features are
added as top-level groups
with empty task lists
and marked as `featureInColumn`.
This ensures proper
grouping behavior when
features are in review
but lack tasks in the
review column.
When a feature under
an epic is completed
and not in review,
it is excluded from
review containers. If
a feature is in review
while its epic is not,
the feature appears
as a top-level group
without epic parent.
For implementation,
standalone review containers
are identified and
added to items, ensuring
they're not duplicated
from existing groups.
If a feature is in
review and its parent
epic is also in review,
the feature might be
nested under the epic.
However, if the epic
is in review while
the feature is in review,
the feature could appear
under the epic or as
a standalone group
depending on whether
it has tasks in the
review column. If an
epic is in review and
all its features are
completed, the feature
groups remain empty,
and the epic itself
appears as a standalone
group. For features
in review with no tasks
in the review column,
they should be added
as top-level groups
with empty task lists
and marked as `featureInColumn`.
This prevents duplication
and ensures proper
grouping behavior when
features are in review
but lack tasks in the
review column.
For features in review
under an epic in review
with no tasks, the
feature is skipped if
its parent epic is
in review. Instead,
the feature is added
as a top-level group
with no tasks. For
epics in review, if
all features are completed,
the epic appears alone
in the review column
without nested features.
If an epic is in review
and has features in
review with no tasks,
those features are
added as standalone
groups with empty task
lists. If an epic is
in review and all its
features are completed,
the feature groups
remain empty, and the
epic appears as a standalone
group. When a feature
is in review while
its epic is not, the
feature appears as
a top-level group without
being nested under
the epic.
When building groups
from column tasks,
track `representedFeatureIds`
and `representedEpicIds`
to avoid duplicates.
For features under
an epic in review, if
the feature is also
in review, skip adding
it as a standalone
feature if the epic
is in review, since
the epic is displayed
alone.

For the `ticketsForBoardColumn`
function, when processing
review board columns,
add all review status
containers to the included
set before returning
the result.
When organizing review
groups, if a feature
is in review, only
include tasks from the
review column and exclude
completed or "not doing"
tasks. This ensures
that features in review
are grouped properly
without including irrelevant
completed tasks.
Current code uses
columnTasks, so no changes
needed there. If a
feature is not in review
but has a task in review,
the task shows under
the feature. If a feature
is in review and has
a task in review, the
task is shown. Implement
represented tracking
in organizeColumnBoardItems:
when pushing epic-
or feature-groups, add
their IDs to sets.
At the end, for each
review container, if
an epic isnt in representedEpicIds,
add an empty epic-group.
The task grouping loop
needs fixing because
appending tasks per
task may cause duplication
when multiple tasks
are assigned to the
same feature.
The logic processes
each task in columnTasks,
checking if it has
a parent feature and
if that feature exists
in the board. For valid
features, it retrieves
related tasks and appends
them to tasksByFeature
under the feature's
ID. However, this approach
may lead to duplicate
entries if multiple
tasks reference the
same feature.

The
issue arises because
tasks are appended
individually rather
than being grouped properly
by feature, potentially
causing repeated task
entries when multiple
tasks belong to the
same feature. This
requires refactoring
to ensure proper grouping
without duplication.
This is fine  each
task is filtered and
added to the existing
array. For non-review
columns, `tasksForReviewContainerGroup`
returns all `columnTasks`
when the container
is not a review status
container, which is
correct. For review
columns, when the feature
is not in review but
has tasks in review,
`tasksForReviewContainerGroup(feature,
[task])` returns `[task]`
since the feature is
not a review status
container. In review
columns, when the feature
is in review, it filters
out completed and not-doing
tasks, which is also
correct. Tests should
now be added to `board-column-layout.test.ts`.
I need to import RELAY_REVIEW_STATUS
and RELAY_COMPLETED_STATUS.
For empty feature groups,
the itemSortPosition
logic is correct: Math.min(item.feature.position,
...item.tasks.map((task)
=> task.position))
will return feature.position
when tasks is empty,
avoiding Infinity.
The same logic applies
to empty epic groups
where featurePositions
is calculated from
feature and task positions.
Run the tests and check
lints. Address the
duplicate push issue
by ensuring tasks are
processed only once,
even if multiple tasks
are associated with
the same feature.
The command was rejected,
likely due to network
or permissions issues.
Shell is completely
rejected.
I'll review the code
logic manually and
provide the summary.
Let me double-check
the implementation
once more.

One issue:
in the task grouping
loop for review column,
when feature is in
review and we filter
tasks - if we have
two tasks and one is
completed (shouldn't
be in columnTasks)
- fine.

Another edge
case: feature in review
with a task still in
review column - we'd
build group from columnTasks
with the task. representedFeatureIds
gets the feature. We
won't add duplicate
standalone. Good.
Epic in review with
feature and task in
review results in proper
grouping. Epic in review
with completed tasks
still gets grouped
correctly. Standalone
features in review
while epic is in todo
are handled properly.
Review tests for board-review
were updated with exports,
and existing tests
continue to pass. Exported
functions like isReviewBoardColumn
don't require test
updates.

ItemSortPosition
for feature groups
with empty tasks correctly
uses Math.min(item.feature.position,
...[]), returning 1000
when only one value
is provided, which
is expected behavior.
OrganizeColumnBoardItems
remains functional
for ready/todo columns,
with reviewContainersById
being null outside
of review columns. FeatureInColumn
continues to use feature.status
=== columnId as before.
The tasksForReviewContainerGroup
import is verified
to be used correctly
in the first loop,
calling featureParentInBoard
twice as intended.
The implementation appears
sound, but the shell
was rejected. This
should be noted in the
summary, and the user
should be advised to
run tests.
Implementing Review-column container layout. Reading the planned files and related code.
Checking board-review tests and how the Review column is used:
Implementing display helpers in `boardReview.ts` and extending board column layout logic.
Adding Review-column tests:
## Summary

Review column layout now treats features and epics with `status: review` as first-class board items, not only when descendant tasks are still in Review.

### `boardReview.ts`
Added display helpers used by the column layout:
- `isReviewBoardColumn` — whether the column is Review
- `isReviewStatusContainer` — feature/epic in review
- `reviewStatusContainers` — all review-status containers on the board
- `tasksForReviewContainerGroup` — omits `completed` / `not_doing` tasks when the parent container is in review

### `boardColumnLayout.ts`
- **`ticketsForBoardColumn`**: For Review, merges in review-status features/epics (not only task-driven parents).
- **`organizeColumnBoardItems`**:
  - Uses `tasksForReviewContainerGroup` when grouping Review tasks under containers in review.
  - Sets `featureInColumn` from `isReviewStatusContainer` in Review (not `feature.status === columnId`).
  - After task-driven grouping, adds standalone `feature-group` (empty `tasks`, `featureInColumn: true`) and `epic-group` (empty `featureGroups`) for review containers not already represented.
  - Skips standalone features whose parent epic is also in review (epic-only card per acceptance criteria).

### Tests
Added three cases in `tests/board-column-layout.test.ts`:
1. Feature in review, all tasks completed → one container-only feature group
2. Epic in review, all features completed → epic-only group with no nested rows
3. Todo column unchanged (no container without in-column tasks)

## Files changed
- `src/renderer/src/lib/boardReview.ts`
- `src/renderer/src/lib/boardColumnLayout.ts`
- `tests/board-column-layout.test.ts`

## Commands run
Shell execution was unavailable in this session (commands were rejected). Please run locally:

```bash
node tests/run-tests.mjs tests/board-column-layout.test.ts tests/board-review.test.ts
```

## Tests run and results
Not executed here due to shell rejection. The new tests align with the ticket acceptance criteria; run the command above to confirm.

## Subagent usage
**None used** — small, tightly coupled layout change within the planned file scope.

## Remaining risks / follow-up
- **Epic + feature both in review** with no in-column tasks: only the epic card is shown (feature suppressed when parent epic is in review). Matches “epic alone” behavior; mixed states may need product clarification later.
- **UI components** (`FeatureBoardGroup` / `EpicBoardGroup`) were not changed in this ticket; they should already handle empty child lists per assumptions.
- Sibling tickets (container Accept/Reject UI, storage transitions) are out of scope here.


No Codex run has been started.
