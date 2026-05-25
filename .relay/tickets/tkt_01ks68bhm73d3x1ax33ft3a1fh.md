---
schemaVersion: 1
id: tkt_01ks68bhm73d3x1ax33ft3a1fh
title: Review gates and container status transitions
ticketType: task
draftTargetType: null
status: completed
position: 7000
priority: medium
effort: medium
labels:
  - backend
  - review
parentEpicId: null
parentFeatureId: tkt_01ks6810f8qgk82fbeh7wfbqga
subticketIds: []
plannedFiles:
  - src/renderer/src/lib/boardReview.ts
  - src/storage/filesystem.ts
  - tests/board-review.test.ts
  - tests/backend.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:51:36.071Z'
updatedAt: '2026-05-21T22:11:16.989Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::a68b4c88-85a0-4288-9215-e52a91a560e7'
runStatus: completed
lastRunId: run_01ks68ppzxjcn3mvazqv0r23s2
lastRunStartedAt: '2026-05-21T21:57:42.100Z'
---
# Review gates and container status transitions

## Context

Parent feature: Layered container review for epics and features

Storage currently blocks all non-archive container workflow moves; promotion logic does not exist yet.

## Goal

Enable automatic container promotion to Review when child gates pass and allow container accept/reject transitions.

## Requirements

- Create `boardReview.ts` with terminal detection, linked task/feature collectors, gate predicates, and `maybePromoteOrDemoteContainers(projectPath, changedTicketId?)`.
- Allow epic/feature `transitionTicketStatus` only to `review`, `completed`, or `archive`.
- After a task status change via `moveTicket`, run promotion/demotion for affected feature and epic ancestors.

## Acceptance Criteria

- Last task under a feature moving to `completed` sets feature `status` to `review` in storage.
- Moving a completed task back to `todo` demotes a feature that was in `review` to `todo`.
- `transitionTicketStatus` rejects feature→`todo` but allows feature→`review` and `completed`.

## Implementation Plan

- Add `src/renderer/src/lib/boardReview.ts` exporting gate helpers and `maybePromoteOrDemoteContainers`.
- Change the epic/feature guard in `transitionTicketStatus` to allowlist `review`, `completed`, `archive`.
- Invoke promotion from `moveTicket` after successful task transitions (pass ticket id).
- Add `tests/board-review.test.ts`; extend `tests/backend.test.ts` for allowed/disallowed container transitions and promotion on task complete.

## Assumptions

- Epic promotion runs only after linked features are `completed`, not merely terminal tasks.

## Codex Handoff

### 5/21/2026, 11:01:44 PM

The user requests implementation
of a ticket concerning
review gates and container
status transitions.
The file boardReview.ts
does not exist yet.
I need to read more
context to proceed.
The file board-review.test.ts
does not exist yet.
I need to review the
backend test around
line 1768 for the epic/feature
workflow guard test.
The ticket instructs
to create boardReview.ts
in the renderer, but
the filesystem needs
to call it.
The ticket explicitly
requires creating `src/renderer/src/lib/boardReview.ts`
and modifying `filesystem.ts`
to import `maybePromoteOrDemoteContainers`
from `moveTicket`,
which likely violates
existing import boundaries
since storage cannot
import from renderer.
The filesystem needs
to call boardReview.ts,
but this may conflict
with current import
rules.
It's unclear whether
storage can import
from renderer, as import
boundaries only test
backend entries. While
tests bundle everything
together and import
from renderer paths,
this may not reflect
architectural constraints.
A pure logic implementation
in boardReview.ts that
avoids React dependencies
could allow filesystem
to import it safely.
Tests importing directly
from the renderer module.
Good - there's `@renderer/*`
path alias.
The filesystem supports
importing modules using
the `@renderer/*` path
alias, enabling imports
like `import { maybePromoteOrDemoteContainers
} from "@renderer/lib/boardReview"`.
The `boardReview.ts`
file will implement
the following logic:
1. **Terminal detection**:
A task is terminal
if its status is completed,
not_doing, archive,
or if its column has
`terminal: true`.
2. **Linked task collectors
for features**: Collect
tasks that match `subticketIds`
and `parentFeatureId`
from `linkedChildTickets`,
filtering to tasks
only.

3. **Linked feature
collectors for epics**:
Collect features that
match `subticketIds`
and `parentEpicId`,
filtering to features
only.

4. **Gate predicates**:
(details to be specified)
The `boardReview.ts`
file implements logic
for determining review
readiness and promoting/demoting
containers. A feature
is ready for review
if it has at least
one linked task and
all linked tasks are
terminal. An epic is
ready for review if
it has features, all
features are completed,
and all descendant
tasks are terminal.
The `maybePromoteOrDemoteContainers`
function reads the
board and config, identifies
affected feature/epic
ancestors from a changed
ticket, and promotes
features or epics to
review if ready and
not already in review
or completed, or demotes
them to todo if not
ready and currently
in review.
The `maybePromoteOrDemoteContainers`
function in the renderer
library is called from
the filesystem and
must handle asynchronous
storage transitions.
It can either perform
transitions directly
using storage APIs
or return decisions
for storage to apply.
To avoid circular dependencies,
it should accept a
board snapshot and columns
as parameters along
with a callback for
transitions, rather
than importing storage
functions directly.
boardReview.ts should
avoid importing filesystem
to prevent circular
dependencies. It should
export pure logic and
delegate storage operations
to a separate filesystem
function. The `maybePromoteOrDemoteContainers`
function in boardReview.ts
should instead expose
`computeContainerPromotionChanges`
to handle promotion
logic without direct
filesystem access.
The `maybePromoteOrDemoteContainers`
function in `boardReview.ts`
handles promotion and
demotion logic without
direct filesystem access.
It should be split
into pure logic and
orchestration, with
the latter handling
storage operations.
The function can either
use an injected reader
for board data or be
separated into pure
logic and filesystem
orchestration to avoid
circular dependencies.
This function is invoked
from `moveTicket` and
operates on a board
snapshot and column
configuration.
The `maybePromoteOrDemoteContainers`
function must handle
storage updates without
causing circular imports
from `@storage/filesystem`.
To avoid circular dependencies,
it should accept an
optional transition
callback, allowing
the filesystem layer
to manage storage operations
while keeping the core
logic in `boardReview.ts`
pure and reusable.
This approach aligns
with the pattern where
`boardReview.ts` provides
pure helpers and delegates
orchestration to the
filesystem module,
which is invoked by
`moveTicket` to trigger
promotions.
The ticket requires
`maybePromoteOrDemoteContainers`
to be implemented in
`boardReview.ts` and
called from the filesystem
layer. To avoid circular
dependencies, the cleanest
approach is to have
the filesystem layer
read the board, call
the pure logic from
`boardReview.ts`, and
then apply transitions.
Alternatively, a dynamic
import of storage can
be used in `boardReview.ts`
to break the cycle,
or a type-only interface
can be employed.
It is acceptable for
`@storage` to import
`@renderer` from an
import boundary perspective,
even though `@renderer`
is not listed in backend
entries. However, architecturally,
this may seem unusual.
The filesystem layer
can call the `maybePromoteOrDemoteContainers`
function in `boardReview.ts`
directly, or `boardReview.ts`
can use a dynamic import
for `@storage` to avoid
circular dependencies.
This approach keeps
the core logic in `boardReview.ts`
pure while delegating
storage operations
to the filesystem layer.
The code uses a dynamic
import for `@storage/filesystem`
to avoid circular dependencies,
since `filesystem.ts`
imports `boardReview.ts`
at the top level, but
`boardReview.ts` does
not import `filesystem.ts`
at the top levelonly
inside the async function.
This ensures `boardReview.ts`
remains pure and avoids
loading `filesystem`
during module initialization.
Implementing `boardReview.ts`
fully now, starting
with constants.
RELAY_REVIEW_STATUS,
RELAY_COMPLETED_STATUS,
RELAY_TODO_STATUS,
RELAY_NOT_DOING_STATUS,
and RELAY_ARCHIVE_STATUS
are imported from @shared/schemas.
For a given feature
container, `linkedTasksForFeature`
retrieves tasks ordered
by `subticketIds`,
filtering to tasks only,
and derived from `parentFeatureId`.
This aligns with how
`linkedChildTickets`
in App.tsx includes
tasks under `subticketIds`
and matches `parentFeatureId`
for features, where
children are tasks.
`linkedFeaturesForEpic`
collects features from
an epic, ensuring only
features are included.
`collectLinkedTasksForFeature`
mirrors the `linkedChildTickets`
filtering for `ticketType
=== 'task'`.

For epics,
linked features are
collected via `subticketIds`
and `parentEpicId`
where the ticket type
is `feature`.

A task
is terminal if its
status is `RELAY_COMPLETED_STATUS`,
`RELAY_NOT_DOING_STATUS`,
or `RELAY_ARCHIVE_STATUS`,
or if its column's
`terminal` property
is true.

A feature
is ready for review
if it has at least one
linked task and all
linked tasks are terminal.
An epic is ready for
review if it has features,
all features are completed,
and all descendant
tasks are terminal.
Features are linked
to epics, and if an
epic has no features,
it should not be promoted
to review. For promotion,
all linked features
must be completed,
and all descendant tasksfeaturestasksepictasksmust
be terminal. For demotion,
if a feature transitions
out of completed status
while its parent epic
is in review, the epic
moves back to todo.
Similarly, if a task
becomes non-terminal
while its parent feature
is in review, the feature
moves to todo. Promotion
occurs when an epics
features are all completed
and its descendant
tasks are terminal.
A feature is promoted
to review if it is
ready for review and
its status is not already
in review or completed.
An epic is promoted
to review if it is
ready for review and
its status is not already
in review or completed.
For demotion, if a
feature or epic in
review loses its readiness
conditionsuch as a
task reopeninga feature
transitions to todo,
and similarly for an
epic. However, if a
feature is already
completed, it likely
should not be demoted
upon task reopening.
If a task exits terminal
status while its parent
feature is in review,
the feature should
be demoted to todo.
This demotion only applies
when the parent feature
is specifically in
review.

Similarly,
if a feature exits completed
status while its parent
epic is in review,
the epic should be demoted
to review status.
When a ticket changes,
evaluate the following
ancestors for potential
status updates:
- If
the changed ticket
is a task, also consider
its parent feature
and parent epic (through
the feature).
- If
the changed ticket is
a feature, also consider
its parent epic.
If the changed ticket
is a feature, its parent
epic and the feature
itself are evaluated
for potential status
updates. If the changed
ticket is an epic,
only the epic is considered.
When a task is moved
via `moveTicket`, the
system evaluates the
parent feature and
epic. However, epic
promotion depends on
all linked features
being completed, not
just individual task
statuses. Therefore,
when a feature transitions
to completed, it may
trigger epic promotion.
The evaluation focuses
on whether the feature
is ready for review,
which requires all
linked tasks to be terminal
and all descendant
tasks to be terminal.
Epics are promoted
only after their linked
features are completed
and all descendant
tasks are terminal.
Demotion occurs if a
feature or epic loses
its readiness conditions
while in review.
Promotion logic should
trigger after `moveTicket`
for tasks, especially
when a task moves to
completed, which can
promote the parent
feature. For epics,
promotion occurs when
all linked features
are completed, handled
through `transitionTicketStatus`
on features rather
than `moveTicket` on
tasks. The scope of
the ticket is to invoke
promotion logic from
`moveTicket` after
successful task transitions.
Epic promotion should
occur through feature
transitions, not `moveTicket`,
since features are
completed via `transitionTicketStatus`,
not `moveTicket`. While
`moveTicket` triggers
promotion logic, epic
promotion depends on
all linked features
being completed, which
requires a hook on
feature transitionsoutside
this tickets scope.
Acceptance criteria
only specify feature
promotion on task completion,
not epic promotion.
Tests for this ticket
include `board-review.test.ts`
for gate helpers.
backend.test.ts includes
tests for container
transitions and promotion
when a task is completed.
I will call maybePromoteOrDemoteContainers
after container transitionTicketStatus
when a feature reaches
completed status to
enable epic promotion.
This addition is minimal
and uses the same function.
The ticket specifies
"pass ticket id" from
moveTicket, but does
not restrict other
entry points. Parent
feature promotion occurs
on task status changes.
For the epic gate,
feature completion triggers
promotion, so I will
invoke the function
after transitionTicketStatus
for any ticket type
change, or at least
after task moveTicket
and container transitions
to completed.
Call `maybePromoteOrDemoteContainers`
at the end of `transitionTicketStatus`
when a status actually
changes for all ticket
types, not just `moveTicket`,
to handle feature-to-completed
transitions that affect
epics. While the ticket
specifies `moveTicket`
only, testing shows
epic promotion works
in `board-review.test.ts`
but not in backend
integration.

Implement
`maybePromoteOrDemoteContainers`
to properly traverse
ancestor containers.
For a changed ticket,
resolve its parent
feature and epic IDs
using `ancestorsToReconcile`,
which adds the parent
feature ID and the
features parent epic
ID if the ticket is
a task.
If the ticket is a
feature, add the feature
ID and its parent epic
ID. If the ticket is
an epic, add the epic
ID. Reconcile features
first (bottom-up),
then epics. For each
feature ID, if the
feature is ready for
review and not in review
or completed status,
transition it to review;
if not ready for review
and currently in review
status, transition
it to todo. For each
epic ID, apply the
same logic based on
epic readiness. A feature
is not ready for review
if it has no tasks
or any task is non-terminal.
If a feature in review
loses readiness, it
should be demoted to
todo.
Features with zero
tasks never auto-promote
and should be demoted
from review if they
lose readiness. For
container transitions,
features and epics
must adhere to specific
status targets, throwing
errors for invalid
transitions except for
archive status. The
updated logic ensures
that epic or feature
status changes enforce
allowed target statuses,
excluding archive,
to prevent invalid state
transitions.
Now I'll implement the
linked children collection
mirroring for App.tsx
linkedChildTickets.
The function `linkedChildTicketIds`
filters tickets by
type and ID, mapping
parent subticket IDs
to their corresponding
ticket summaries. It
ensures that only tickets
matching the specified
child type are returned,
excluding any that
don't match the parent's
epic type.
The code filters items
based on parent ID
and excludes those already
included in parent
subticket IDs. For features,
it uses "task" as child
type, while for epics,
it uses "feature" and
also collects tasks
via `collectTasksUnderEpic`.
Epic ready for review
requires all linked
features to have a
completed status and
all tasks under the
epic to be terminal.
Features under epic
are filtered similarly
to `linkedChildTicketIds`
but for features specifically.
I will use the system
actor for automatic
promotion or manual
board for user-triggered
moves.
Add tests by updating
run-tests.mjs to include
board-review.test.
The ticket instructs
to only modify planned
files, excluding run-tests.mjs,
which is not in the
planned scope. Since
board-review.test.ts
needs to be included
in CI, and run-tests.mjs
explicitly lists entryPoints,
adding the test file
to run-tests.mjs would
violate the "do not
modify files outside
the planned file scope"
rule. Therefore, tests
may need to be run
manually or via direct
node test commands
instead of through the
full test suite.
I will add new tests
to the end of backend.test.ts.
I need to update the
existing backend test
that expects "cannot
change workflow status"
for feature transition
to in_progress, as
the error message has
changed.
The shell was rejected.
Attempting to run tests
via npm test or the
run-tests script on
specific files instead.
Shell is completely
rejected. Lints will
be checked and logic
verified manually.
Circular import check:
storage imports boardReview
which dynamically imports
storage, but this should
work fine.

An issue
was identified where
maybePromoteOrDemoteContainers
calling transitionTicketStatus
for featurereview won't
trigger maybePromoteOrDemote
again from moveTicket,
preventing infinite
loops. However, when
transitionTicketStatus
is called for feature
promotion via system_reconciliation,
maybePromoteOrDemoteContainers
isn't invoked, so epics
won't auto-promote
when features are accepted
to completed via manual
transitionTicketStatus.
Only moveTicket triggers
epic promotion, so
manual feature completion
won't auto-promote
epics. Feature promotion
via transitionTicketStatus
doesn't invoke maybePromote,
so epics won't auto-promote
during feature auto-promotion
to review.
Let me attempt to run
tests using the Task
tool or Await, as the
shell was rejected,
possibly due to missing
network permissions.
Shell is completely
rejected. Tests cannot
be run in this environment,
but test commands are
documented for the
user.
Let me double-check
the circular dependency
and that import-boundaries
won't fail. Storage
importing @renderer/lib/boardReview
is renderer allowed
to be imported from
storage? Import-boundaries
doesn't test storage->renderer,
which could be intentional
for this ticket.

Verify
the transition on feature
with todo  review when
tasks complete  the
system actor transition
should work.

When
demoting feature from
review to todo  feature
was in review, task
moved to todo  resolveFeatureContainerStatus
returns RELAY_TODO_STATUS
this is correct.
Epic test for backend
is not required by
acceptance criteria.
Existing test at line
1773 for feature to
in_progress still correctly
rejects. Creating a
ticket for a feature
defaults to status
"todo". Moving tickets
promotes tasks properly;
`createTaskUnderFeature`
links tasks and ensures
`linkedTasksForFeature`
finds them via `parentFeatureId`,
even if not in `subticketIds`,
since `createTaskUnderFeature`
adds to `subticketIds`
via `addSubticketIdToFeature`.
One final check confirms
that `boardReview`
is used by storage despite
being located in renderer.
I'll implement review gates and container status transitions per the ticket. Exploring the codebase and planned files first.
Implementing `boardReview.ts`, updating storage guards and `moveTicket`, and adding tests.
## Summary

Implemented review gates and container status transitions per the ticket.

### `boardReview.ts` (new)
- **Terminal detection**: `isTerminalTaskStatus` — `completed`, `not_doing`, `archive`, or any column with `terminal: true`
- **Linked collectors**: `linkedTasksForFeature`, `linkedFeaturesForEpic`, `linkedTasksForEpic` (same resolution as `linkedChildTickets` in the app)
- **Gate predicates**: `featureReadyForReview` (≥1 linked task, all terminal), `epicReadyForReview` (all linked features `completed`, all epic tasks terminal)
- **Promotion/demotion**: `maybePromoteOrDemoteContainers` promotes containers to `review` when gates pass and demotes `review` → `todo` when gates fail; uses dynamic `@storage/filesystem` import to avoid circular deps

### `filesystem.ts`
- Epic/feature `transitionTicketStatus` allowlist: `review`, `completed`, `archive` only
- `moveTicket` calls `maybePromoteOrDemoteContainers` after successful **task** moves

### Tests
- **`tests/board-review.test.ts`**: unit tests for gate helpers and resolve functions
- **`tests/backend.test.ts`**: container transition allow/deny; feature auto-promote on last task complete and demote on reopen; updated existing epic guard assertion message

## Files changed
- `src/renderer/src/lib/boardReview.ts` (new)
- `src/storage/filesystem.ts`
- `tests/board-review.test.ts` (new)
- `tests/backend.test.ts`

## Commands run
Shell execution was unavailable in this environment — no commands were run.

## Tests (to run locally)
```bash
npm test
# or targeted:
node tests/run-tests.mjs
```

**Note:** `tests/run-tests.mjs` is outside the planned file scope and was not updated, so `board-review.test.ts` is not in the default `entryPoints` list yet. Run it explicitly or add it in a follow-up:

```bash
# After adding board-review.test.ts to run-tests.mjs entryPoints, or:
npx esbuild tests/board-review.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/board-review.test.js && node --test /tmp/board-review.test.js
```

Expected coverage:
- Gate helpers promote/demote correctly
- Backend: feature→`review`/`completed` allowed; feature→`todo`/`ready` rejected
- Backend: last task `completed` → feature `review`; task back to `todo` → feature `todo`

## Subagent usage
**None used** — work was local and scoped to four files.

## Remaining risks / follow-up
1. Register `tests/board-review.test.ts` in `tests/run-tests.mjs` (blocked by file-scope constraint on this ticket).
2. **Epic auto-promotion** runs only when `maybePromoteOrDemoteContainers` is invoked; today that is wired from `moveTicket` on tasks only. Accepting a feature to `completed` via `transitionTicketStatus` does not yet promote the parent epic — add a hook on container transitions if product wants that in storage, not only via task moves.
3. Codex-driven task status changes through `transitionTicketStatus` (not `moveTicket`) do not trigger container promotion until that path also calls `maybePromoteOrDemoteContainers`.


No Codex run has been started.
