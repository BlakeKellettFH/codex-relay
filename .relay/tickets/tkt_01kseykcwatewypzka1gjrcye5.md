---
schemaVersion: 1
id: tkt_01kseykcwatewypzka1gjrcye5
title: Fix repository chat pre-hydration draft race
ticketType: task
draftTargetType: null
status: review
position: 3000
priority: medium
effort: medium
labels:
  - repository-chat
  - bug
parentEpicId: null
parentFeatureId: tkt_01kseydxj7g1x80fxxz0v2cqgd
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - tests/repository-chat-hydration.test.ts
  - tests/run-tests.mjs
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:54:17.482Z'
updatedAt: '2026-05-25T07:17:38.801Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::b1a56072-6741-487d-9ba8-d4a1261b00c0'
runStatus: completed
lastRunId: run_01kseyt8sfdk279gjv043mf1wm
lastRunStartedAt: '2026-05-25T07:10:12.654Z'
---
# Fix repository chat pre-hydration draft race

## Context

Parent feature: Smooth repository chat typing and reduce autosave churn

Hydration effect at App.tsx:2705 treats non-empty draft as reason to skip loading store from server.

## Goal

Server draft restores correctly unless the user has intentionally edited local state.

## Requirements

- Remove draft from hydration effect dependency-driven skip logic.
- Track first local edit before hydration completes; only skip server apply when that ref is true.
- Preserve existing projectPath reset behavior (applyEmptyRepositoryChatState on path change).

## Acceptance Criteria

- Simulated test: query resolves after local draft typed from empty initial state still applies server draft when user had not edited.
- After intentional edit before hydration, server values do not overwrite local draft.
- Post-hydration draft typing behavior unchanged.

## Implementation Plan

- Add userEditedBeforeHydrationRef set in onDraftChange before repositoryChatPersistReadyRef is true.
- Split hydration into effect that runs once per projectPath when repositoryChatQuery.isSuccess.
- Add tests/repository-chat-hydration.test.ts covering early-typing vs intentional edit cases.
- Register test in tests/run-tests.mjs.

## Assumptions

- Server draft should win over empty local state when user has not edited yet.

## Codex Handoff

### 5/25/2026, 8:17:38 AM

The user needs help
resolving a race condition
in a repository chat
pre-hydration draft.
I need to locate the
onDraftChange function
in App.tsx for the
repository chat feature.
The ticket recommends
either exporting the
hydration logic or
testing it in a similar
manner.
The ticket recommends
extracting pure functions
for hydration logic
to enable testing,
similar to `getRepositoryChatShellState`.
The implementation
involves adding `userEditedBeforeHydrationRef`
in `onDraftChange`
before `repositoryChatPersistReadyRef`
becomes true, and splitting
hydration into an effect
that runs once per
`projectPath` when `repositoryChatQuery.isSuccess`.
This requires adding
`userEditedBeforeHydrationRef`
and either `repositoryChatPersistReadyRef`
or using `repositoryChatPersist.getRuntime().ready`.
Wrap `setDraft` in
`onDraftChange` to
set the ref when not
ready. Change the hydration
effect to skip based
only on `userEditedBeforeHydrationRef`,
`streaming`, `messages`,
and `threadId`, rather
than draft or messages.
Remove draft from the
hydration effect's
dependency-driven skip
logic. Track the first
local edit before hydration
completes, skipping
server apply only when
this ref is true. Simulate
a test where a query
resolves after a local
draft is typed from
an empty initial state,
ensuring the server
draft still applies
if the user had not
edited.
After an intentional
edit before hydration,
server values do not
overwrite the local
draft. Post-hydration
draft typing behavior
remains unchanged.
Skip conditions should
include: streaming
in progress, user editing
before hydration, and
possibly messages/threadId
from the active session.
However, early typing
from an empty state
should not count as
an intentional edit
that blocks server
restore, as the ticket
clarifies that only
intentional local edits
should prevent server
restore.
Track the first local
edit before hydration
completes; skip server
apply only if this
ref is true.  
The server
draft should win over
empty local state when
the user has not intentionally
edited.  
If the user
types "hello" before
the query completes,
it counts as an edit
only if it's an intentional
change, not just initial
typing.  
The test
simulates a scenario
where a local draft
is typed from an empty
statethis should still
allow the server draft
to apply if the user
hadn't made an intentional
edit.
When a query resolves
after a local draft
is typed from an empty
initial state, the
server draft still applies
if the user had not
intentionally edited.
The `userEditedBeforeHydrationRef`
is set in `onDraftChange`
before `repositoryChatPersistReadyRef`
becomes true, which
means any draft change
before hydration completion
prevents server restore.
However, early typing
from an empty state
does not count as an
intentional edit, so
the server draft should
still apply in such
cases.
The implementation
plan states that `userEditedBeforeHydrationRef`
is set in `onDraftChange`
before `repositoryChatPersistReadyRef`
is true, meaning any
draft change before
hydration completion
sets the ref. However,
the acceptance criteria
say the server draft
applies if the user
had not edited. This
seems contradictory
unless "intentional
edit" is defined more
carefullyperhaps only
counting as an edit
if the user makes a
change after having
a local draft, or only
when the draft differs
from what would be
applied.

The key distinction
lies in whether early
typing from an empty
state counts as an
intentional edit. Early
typing should not block
server restore, but
intentional editsthose
made after the user
has a local draftshould
prevent server restore.
The test simulates
a scenario where a local
draft is typed from
an empty state, which
should still allow
the server draft to
apply if no intentional
edit occurred.
The issue is that
typing before the GET
/api/projects/repository-chat
request completes causes
the server draft to
be permanently skipped.
The fix involves replacing
draft.trim() as a skip
condition with an explicit
"user edited" reference.
The userEditedBeforeHydrationRef
should only be true
after an intentional
edit, not during early
typing. To prevent
early typing from setting
the ref, the system
must distinguish between
initial typing and
intentional edits.
I need to understand
the distinction between
different concepts
or elements, but the
provided text is incomplete
and does not specify
what those distinctions
are. Therefore, no
meaningful summary can
be generated from this
fragment alone.
```
Early typing while
a query is pending
should not set the userEditedBeforeHydrationRef
flag, as it shouldn't
block server updates.
Intentional edits made
by the user before
hydration should block
server updates.

The
current implementation
sets the reference
in onDraftChange before
ready is true, which
triggers on any typing
activity prior to hydration.
The proposed solution
involves the effect
running once upon query
success, rather than
skipping the apply
step when draft is non-empty.
If userEditedBeforeHydrationRef
is false, the server
should be applied even
when there's a local
draft. The ref becomes
true when a user makes
an intentional edit,
which differs from
simple typing. An intentional
edit likely refers
to when a user modifies
the draft after seeing
server-provided state,
not during initial
typing. In the scenario
where a query resolves
after local typing,
the server draft should
still apply if the
user hadn't intentionally
edited.
Server drafts should
apply when users haven't
intentionally edited,
even if they've typed.
"Had not edited" means
userEditedBeforeHydrationRef
is false, so the flag
shouldn't trigger from
early typing but only
from deliberate edits.
Early typing occurs
before server data
loads and should favor
server updates, while
intentional edits happen
after seeing server
data and should favor
local changes. The
distinction lies in
whether the user is
actively modifying after
server state is visible.
The `userEditedBeforeHydrationRef`
flag is set only when
user interactions occur
after hydration, not
during early typing.
This distinction ensures
that server updates
aren't blocked by unintentional
typing before the server
data is loaded. The
flag should only activate
for intentional editsthose
that differ from what
the server would provideafter
the user has seen the
server state. Early
typing, which happens
before hydration, should
not block server updates.
Any non-empty draft
blocks hydration. If
the user types "a"
before the query returns
and the server returns
"full saved text,"
the effect runs, sees
the draft "a," and
skips applying the server
draft permanently.
Under the new behavior,
the server draft "full
saved text" should
overwrite the local
"a" unless the user
intentionally edited.
An intentional edit
means the user typed
before hydration completed
and should be respected.
In test case 2, if
the user types "my
new idea" before hydration,
that local draft should
be kept instead of
overwritten by the server
draft.
That's an intentional
edit!

In Test Case
1, if a user types
and "had not edited,"
the server draft should
apply. If the user
"had edited," the local
draft should be respected.
The distinction between
Case 1 and Case 2 isn't
simply "typed vs not
typed"  both involve
user input. Instead,
the key difference
may lie in whether the
draft results from
programmatic state changes
(like React's strict
mode double mount)
or actual user interaction,
since the `userEditedBeforeHydrationRef`
flag should only activate
for genuine user edits,
not automatic state
changes.
Or case 1: if the
user didn't type at
all and the local draft
came from another source
without setting the
ref, then the server
draft should apply.
"Typed from empty
initial state" means
the user did type,
so "when user had not
edited" implies userEditedBeforeHydrationRef
is false.

Therefore,
userEditedBeforeHydrationRef
should not be set from
regular typing before
hydration. 

To detect
intentional edits for
case 2, the flag must
distinguish between
genuine user interactions
and programmatic changes
like React's strict
mode double mount.
Perhaps userEditedBeforeHydrationRef
is set on onDraftChange
before ready, but for
case 1, the ref resets
on projectPath change,
and the test typing
is simulated without
going through onDraftChange
(using direct setState).
When the chat opens
after typing before
the initial load, it
still restores the
persisted draft from
the server if the local
state was empty.
When the user starts
typing in an empty
chat panel and the server
has a persisted draft,
the server content
should restore. However,
if the user intentionally
edits content after
hydration, local changes
should be preserved.
The key distinction
lies between race typing
and intentional edits.
Race typing occurs
when users type quickly
before server data
loads, where server
content should take
precedence. Intentional
edits happen when users
deliberately modify
content after hydration,
preserving local changes.
Distinguishing programmatically
requires detecting
whether user input occurs
during the hydration
phase versus after
it completes. One approach
considers setting `userEditedBeforeHydrationRef`
only when the previous
draft was non-empty,
but this fails for
the first keystroke
from an empty state,
which is still intentional.
Setting a reference
only when the user
focuses the composer
and types doesn't solve
the issue, as the first
keystroke still triggers
it. The "local state
was empty" condition
refers to the panel
starting empty at hydration
time, meaning any typing
during the load race
should not count as
intentional. The "after
intentional edit" scenario
relates to deliberate
changes made after
hydration, not necessarily
prior session state.
The logic should distinguish
between early typing
race and intentional
edits by setting `userEditedBeforeHydrationRef`
only when `ready` is
false and `onDraftChange`
is called. Early typing
that bypasses `onDraftChange`such
as direct `setDraft`
callsshould not trigger
the ref, avoiding incorrect
preservation of unintended
changes during hydration.
The intentional edit
test uses `onDraftChange`
to set the reference.
While this approach
is somewhat artificial,
it aligns with the
bug where non-empty
drafts from `setState`
re-renders block hydration
due to draft dependencies.
The fix involves only
blocking hydration
when the reference is
explicitly set via
`onDraftChange`. 

Real
user typing flows through
`onDraftChange`, which
means `setDraft` is
called directly without
a wrapper. Therefore,
wrapping `setDraft`
with a handler that
sets the reference
when not ready is necessary.
If all user typing
sets the reference,
real users typing before
load would always block
server restoration,
contradicting the intended
behavior.  

The product
intent clarifies that
when a user opens a
chat with a server-draft
and types before the
load completes, the
server content should
still take precedenceassuming
the local state was
empty at open time.
The users early input
should not override
the server draft.
"Intentional edit" refers
to deliberate changes
made after hydration,
not during the initial
load race.
Intentional edits
refer to changes made
after hydration, not
just draft modifications.
The logic should skip
hydration if streaming
is active, if `userEditedBeforeHydrationRef`
is set, or if there's
an active conversation
beyond the draft (messages
or thread ID). Removing
draft checks ensures
that non-empty drafts
alone don't prevent
hydration.

The `userEditedBeforeHydrationRef`
is set only on intentional
draft changes before
the component is ready.
Setting this reference
on every draft change
during hydration would
cause early typing
to block server restoration,
which contradicts intended
behavior.
Let me reconsider the
parent AC at line 76.
When users open chat
with empty local state
and type before initial
load, the server-drafted
content should still
be restored. However,
if there's an intentional
edit before hydration
occurs, the server
values should not overwrite
the local draft.

The
distinction between
intentional and accidental
race conditions during
typing needs clarification.
One possibility is
that intentional edits
should always take
precedence over server
updates, while accidental
race conditions might
allow server values
to overwrite local
drafts.

If a user types
before hydration completes,
it's unclear whether
this should count as
"user edited before
hydration" or not.
This affects whether
server values can overwrite
local drafts.

The
key question is: does
typing before hydration
constitute an intentional
edit that should prevent
server restoration?
Or is it considered
an accidental race
condition that allows
server values to overwrite
local drafts?
Option 4 suggests
that the `userEdited`
reference is only set
when the original draft
was non-empty, meaning
fresh typing from an
empty state doesn't
count as an intentional
edit. This approach
distinguishes between
editing existing content
and initial typing,
which could help determine
whether server values
should overwrite local
drafts.
When a user opens
a chat and types before
hydration completes,
the behavior depends
on whether the draft
originates from stale
state or a fresh open.
A fresh open resets
the state to empty,
so typing in this case
shouldn't count as
an intentional edit.
However, if the user
had prior messages
or a thread ID, then
typing would be considered
an intentional edit.
If `userEdited` is
only set when there
are existing messages
or a thread ID, then
typing from an empty
state won't trigger
the ref, allowing server
values to overwrite
local drafts. This
distinction helps differentiate
between accidental
race conditions and
intentional edits.
But before hydration,
messages are always
empty due to reset.
Separate ref for "intentional"
editsonly set when
`onDraftChange` is called
with `intentional:
true` from composer
events like focus and
input after a delay.
`userEditedBeforeHydrationRef`
is set during `onDraftChange`
when `ready` is false
and the draft was already
non-empty before the
changeindicating editing
existing text, not
the first character.
Early typing race:
user types first character
from empty, triggering
a change from "" to
"h"don't set the ref.
Intentional edit:
user types a second
character or modifies
existing textset the
ref.
For the intentional
edit test, if a user
types a full phrase
before hydration, the
first character alone
wouldn't set the ref,
but subsequent characters
would. However, this
leads to a poor user
experience where the
first character gets
overwritten by the
server.

A simpler approach
is to set `userEdited`
when the local draft
differs from the server
draft at hydration
time and the user has
made changes after
the query data was fetched
but before it was applied.
This logic avoids
complexity by focusing
on actual differences
between local and server
states rather than
tracking every keystroke.
The implementation
plan sets the ref in
`onDraftChange` before
`ready` is true. Tests
should distinguish
between "early typing"
where the local draft
exists but `userEditedBeforeHydrationRef`
remains false  and
"intentional edits,"
where the ref is true.
In production, this
would set the ref on
every `onDraftChange`
before `ready`, yet
the parent AC may fail
for real users if the
ref is set too early.
Alternatively, if
`repositoryChatPersistReadyRef`
becomes true before
a user types, that
could prevent the issue,
though its unlikely
if the query is slow.
If `ready` becomes
true at the start of
hydration, even when
skipping the apply
step, then in the skip
branch, `ready` is
set to true without
applying changes. This
means after skipping,
`ready` is true and
the reference won't
be set on subsequent
edits.

With the old
code flow:
1. Mount
with empty state and
loading query
2. User
types "a"  draft becomes
"a"
3. Query succeeds,
effect runs, sees draft.trim()
> 0, skips apply, sets
ready=true
4. User
remains stuck with "a"
instead of server draft
With the new code
(setting ref on every
`onDraftChange` before
ready):
1. Mount, user
types "a"  ref is set
to true
2. Query succeeds,
effect runs, sees ref=true,
skips apply
3. User
gets correct behavior
with server draft applied
The ref must not be
set during normal pre-hydration
typing. The implementation
plan may be incorrect,
or the detection of
intentional edits is
more complex.

The
server draft should
overwrite local state
when the user has not
intentionally edited.
However, "not edited"
does not mean the draft
is emptynon-empty drafts
that result from initial
typing during load
should still accept
server values.

What
constitutes an "edit"?
The `userEditedBeforeHydrationRef`
may only be set when
the change does not
originate from the
initial empty state
transition during loading.
Setting the reference
when `onDraftChange`
occurs after `repositoryChatQuery.isSuccess`
ensures intentional
edits are detected.
The flow is:
1. Mount
with empty state and
loading query
2. User
types while query is
loading  `isSuccess`
is false, so the ref
is not set
3. Query
succeeds, effect runs,
and since `isSuccess`
is now true, the server
draft is applied, overwriting
any local typing

This
prevents accidental
race conditions from
overwriting server
values while preserving
intentional edits.
When the effect runs
and the reference is
true, the apply step
is skipped. If a user
edits after the query
is successful but before
hydration completes,
the reference is set,
preventing server values
from overwriting the
local draft. Early
typing during query
loading doesn't set
the reference, so server
values will overwrite
local drafts. This
approach aligns with
all acceptance criteria.
The implementation
sets `repositoryChatPersistReadyRef`
to mirror `runtime.ready`
or read from `repositoryChatPersist.getRuntime().ready`.
In `onDraftChange`,
if `!repositoryChatPersistReadyRef.current
&& repositoryChatQuery.isSuccess`,
then `userEditedBeforeHydrationRef.current`
is set to true. It
may also be set if messages
or thread ID change
before hydration.
The hydration effect
runs once per project
path when `isSuccess`
is true, using dependencies
`[projectPath, repositoryChatQuery.isSuccess,
repositoryChatQuery.data]`.
It skips execution
if `hydratedProjectPath`
already matches `projectPath`.
Skip the apply step
if streaming is active,
messages exist, a thread
ID is present, or the
user has edited the
draft before hydration.
Otherwise, apply the
server store. Remove
the draft from the
skip condition entirely.
Reset the `userEditedBeforeHydrationRef`
when the project path
changes, and also reset
it during the apply
empty state effect.
For one-time execution,
use a guard checking
that `hydratedProjectPath
=== projectPath` so
the effect runs only
once per project path.
Remove draft, messages,
and threadId from the
effect dependencies,
reading their current
values via refs or
closure at runtime.
At query success, messages
and threadId will be
reset to default values,
while the draft may
contain user input
from typing during load.
The userEdited flag
will remain false if
the query wasn't successful
during typing.

If
the query succeeds and
the user types immediately
before the effect runs,
isSuccess becomes true,
the ref is set, and
the effect skipspreserving
intentional edits.
A pure function is exported
for testing purposes.
I'll implement exporting
pure functions near
repositoryChatMessageSequence
for testing purposes.
Add refs in RepositoryChatPanel
and fix hydration effect.
Implement onDraftChange
wrapper and reset userEditedBeforeHydrationRef
on projectPath change.
Create test file and
register it in run-tests.mjs.
Export apply decision
for `shouldApplyRepositoryChatStore`
when not skipping,
and check if resolve
function needs to be
exported for draft
application after hydration.
Tests include early
typing scenario where
local draft is non-empty,
userEdited is false,
and query success occurs,
requiring server application
(shouldSkip = false).
Also include intentional
edit scenario where
userEdited is true,
requiring shouldSkip
= true.
Also test shouldMarkRepositoryChatUserEditedBeforeHydration:
- query not success,
not ready -> false
(don't mark)
- query
success, not ready
-> true (mark)
- ready
-> false (don't mark)
For skip hydration:
- userEdited true ->
skip
- streaming ->
skip  
- messages >
0 -> skip
- threadId
-> skip
- already hydrated
-> skip (different
- "return early" vs
skip apply)

Implement
hydration resolver
as one function returning
'apply' | 'skip' |
'already_hydrated'
export const resolveRepositoryChatHydrationAction
= (input: {
  hydratedProjectPath:
string | null;
  projectPath:
string;
  querySuccess:
boolean;
  userEditedBeforeHydration:
boolean;
  streaming:
boolean;
  messageCount:
number;
  threadId:
string | null;
}):
RepositoryChatHydrationAction
=> {
  if (!input.querySuccess)
return ... // effect
wouldn't run
  if (input.hydratedProjectPath
=== input.projectPath)
return "already_hydrated";
if (input.streaming
|| input.messageCount
> 0 || input.threadId
|| input.userEditedBeforeHydration)
{
    return "skip_local";
}
  return "apply_store";
};
For onDraftChange
in the component, I'll
create a handleDraftChange
callback function.
I also need to manage
repositoryChatPersistReadyRef
by syncing it from
runtime.ready when it
changes, or reading
getRuntime().ready
directly in the handlerthough
using getRuntime().ready
in onDraftChange is
acceptable since it's
stable. For query success
in onDraftChange, I'll
use repositoryChatQuery.isSuccess
from the closure within
useCallback with proper
dependencies.

I'll
reset userEditedBeforeHydrationRef
to false when projectPath
changes, inside the
useEffect hook.
The hydration effect
now properly resets
the runtime when the
project path changes,
setting `hydratedProjectPath`
to null and `ready`
to false. It also includes
checks to skip hydration
if streaming is active,
messages exist, a thread
ID is present, or if
the user has edited
before hydration. The
effect ensures that
hydration only proceeds
under appropriate conditions
by returning early
when these flags are
set.
The effect now runs
once at query success,
using messages/threadId/draft
values at that time
for skip branch signature
and apply logic. Since
these values are read
at effect time, they
don't need to be in
dependencies, though
they're still accessed
for conditional logic.
The effect skips hydration
when streaming is active,
messages exist, a thread
ID is present, or if
the user has edited
before hydration. It
ensures hydration only
proceeds under appropriate
conditions by returning
early when these flags
are set.
I'll add the exported
functions after repositoryChatMessageSequence
and before emptyRepositoryChatPanelState.
Then modify RepositoryChatPanel
with refs and effects,
using refs for tracking
hydration state and
runtime changes. The
repositoryChatPersistReadyRef
will be updated when
setting runtime with
ready, and reset to
false during reset
operations.
The `handleDraftChange`
function now checks
if the user has edited
before hydration using
`repositoryChatPersistReadyRef`
and `repositoryChatQuery.isSuccess`,
then updates `userEditedBeforeHydrationRef`.
Alternatively, it can
use `getRuntime().ready`
instead of the separate
ref for checking hydration
status.
The hydration effect
needs to be fixed by
removing threadId from
dependencies and splitting
it into a one-shot
effect that only depends
on projectPath and
isSuccess.
The hydration effect
continues to read `messages`,
`threadId`, and `draft`
from its closure, which
may trigger ESLint
warnings about missing
dependencies.
The hydration effect
reads `messages`, `threadId`,
and `draft` from its
closure, potentially
causing ESLint warnings
about missing dependencies.
For one-shot behavior,
the snapshot is read
at success time. However,
a subtle bug exists:
when the effect runs
with dependencies `[projectPath,
isSuccess, data]`,
it captures the snapshot
at that render time.
If the user typed before
`isSuccess` was true,
`userEdited` remains
false, so `apply_store`
overwrites the draft
with server data. If
the user types after
`isSuccess` but before
the effect runs within
the same render cycle,
the behavior is less
likely. When the query
succeeds in render
N, `userEdited` is false,
and `draft` is "x"
from pre-success typing;
the effect runs after
paint, still using
render N state, and
`apply_store` uses server
data.
A new render occurs,
updating the draft
and potentially setting
`userEdited` if `isSuccess`
is true. However, the
effect from the previous
render still executes
with its original closure
where `userEdited`
was false, creating
a race condition. To
fix this, the effect
should read the latest
`userEdited` value
from a ref instead of
the closure. Additionally,
for the skip local
signature, the effect
must use the most recent
state at execution
timereading `messages`,
`threadId`, and `draft`
from the closure could
be incorrect if the
user typed between
renders.
For `apply_store`,
we set the state from
the server, which is
correct. For `skip_local`,
we need the current
local state for the
signature and should
read from refs or the
latest state. The ticket
indicates a one-shot
behavior, typically
occurring when `messages`
are empty at the first
success. 

If the user
intentionally edits
after `isSuccess` is
true, `userEdited`
is set via a ref. The
effect must check the
ref at runtime rather
than at definition
time. I already use
`userEditedBeforeHydrationRef.current`
in `resolveRepositoryChatHydrationAction`,
which is the correct
approach. I need to
update the call to
use the ref instead
of passing the value
at definition time.
The code currently
reads:

```javascript
userEditedBeforeHydration:
userEditedBeforeHydrationRef.current,
```
The hydration effect
retains messages and
threadId in its closure
but excludes them from
dependencies, which
may trigger an ESLint
warning.
Shell is completely
rejected. Tests couldn't
be run.
Let me double-check
the implementation
for correctness.

One
issue: the hydration
effect reads `messages`
and `threadId` from
closure but they're
not included in dependencies.
When the query becomes
successful, the first
run should correctly
start with messages=[]
from initial state.
Another issue: `resolveRepositoryChatHydrationAction`
returns "already_hydrated"
when querySuccess is
false, but the effect
returns early anyway
regardless.

For the
intentional edit scenario
in production:
1. Query
succeeds
2. Effect
is scheduled
3. User
types  `handleDraftChange`
sets `userEdited` ref
(isSuccess true, ready
false)
4.
Other setDraft calls
bypass userEdited tracking.
I'll inspect the repository chat hydration logic in `App.tsx` and any existing tests so we can fix the pre-hydration draft race.
Implementing hydration logic: only mark edits as intentional after the query succeeds but before hydration completes; pre-query typing won't block server restore.
## Summary

Fixed the pre-hydration draft race by stopping non-empty `draft` from blocking server restore. Hydration now runs once per `projectPath` when the query succeeds, and only skips applying the server store when the user edited **after** the query succeeded but **before** persist was ready.

## Changes

**Hydration skip logic** — Removed `draft.trim().length > 0` from skip conditions. Added `userEditedBeforeHydrationRef` and `repositoryChatPersistReadyRef`, reset on `projectPath` change.

**Intentional edit detection** — `handleDraftChange` sets `userEditedBeforeHydrationRef` only when `shouldMarkRepositoryChatUserEditedBeforeHydration` is true (`querySuccess && !persistReady`). Typing while the query is still loading does not set the flag, so the server draft still applies.

**One-shot hydration** — Effect deps are now `[projectPath, repositoryChatQuery.isSuccess, repositoryChatQuery.data]` (no `draft`/`messages`/`threadId`). Uses exported `resolveRepositoryChatHydrationAction` for skip vs apply.

**Tests** — Added `tests/repository-chat-hydration.test.ts` for early-typing (apply server) vs intentional edit (skip server) and registered it in `tests/run-tests.mjs`.

## Files changed

- `src/renderer/src/App.tsx`
- `tests/repository-chat-hydration.test.ts` (new)
- `tests/run-tests.mjs`

## Commands run

Shell execution was unavailable in this session, so tests were not run here.

To verify locally:

```bash
node tests/run-tests.mjs
```

Or only the new tests:

```bash
node --test tests/repository-chat-hydration.test.ts
```

## Subagent usage

None used.

## Remaining risks / follow-up

- Run `node tests/run-tests.mjs` to confirm the full suite passes.
- Very narrow race: user types in the same tick as query success but before the hydration effect runs — `userEditedBeforeHydrationRef` is read at effect time, which should still catch it.
- Programmatic `setDraft` paths (submit, voice, clear) do not set the user-edited flag; that matches intended behavior.


No Codex run has been started.
