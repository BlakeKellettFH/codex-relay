---
schemaVersion: 1
id: tkt_01kseykcvyew4q55y9j3a81f97
title: Isolate repository chat transcript from draft re-renders
ticketType: task
draftTargetType: null
status: review
position: 2000
priority: medium
effort: medium
labels:
  - repository-chat
  - ui
parentEpicId: null
parentFeatureId: tkt_01kseydxj7g1x80fxxz0v2cqgd
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/components/RepositoryChatTranscript.tsx
  - src/renderer/src/components/RepositoryChatComposer.tsx
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:54:17.470Z'
updatedAt: '2026-05-25T07:10:12.595Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::91f2beb4-1936-491c-a8ab-e3d8e483dd2b'
runStatus: completed
lastRunId: run_01kseyt8mpww7f363q925ar0hn
lastRunStartedAt: '2026-05-25T07:01:38.698Z'
---
# Isolate repository chat transcript from draft re-renders

## Context

Parent feature: Smooth repository chat typing and reduce autosave churn

Addresses perceived page rerender: transcript MarkdownBlock reparses on every draft change today.

## Goal

Draft typing updates only the composer subtree.

## Requirements

- Extract transcript rendering (messages, pending/thinking/error) into React.memo component without draft prop.
- Extract composer form (textarea, options, actions) into separate component that receives draft and onDraftChange.
- Keep existing RepositoryChatPanelContent export API stable for tests in tests/ticket-draft-ui.test.tsx.

## Acceptance Criteria

- Changing draft alone does not change transcript component props when messages/pending/error are unchanged.
- Existing ticket-draft-ui repository chat markup tests still pass.
- Manual typing with long assistant answer does not flicker transcript or reset scroll.

## Implementation Plan

- Add RepositoryChatTranscript.tsx with memoized message map and MarkdownBlock rendering.
- Add RepositoryChatComposer.tsx for textarea and footer controls.
- Slim RepositoryChatPanelContent in App.tsx to compose the two children.
- Update/extend tests/ticket-draft-ui.test.tsx if import paths change.

## Assumptions

- React.memo is acceptable as first renderer memo usage in this area.

## Codex Handoff

### 5/25/2026, 8:10:12 AM

The user requests a
ticket to isolate repository
chat transcripts from
draft re-renders.
The files RepositoryChatTranscript.tsx
and RepositoryChatComposer.
I'll use React's memo
for optimization. Here's
my implementation plan:
1. Implement memoization
for components that
render frequently
2.
Use React.memo to prevent
unnecessary re-renders
3. Apply proper comparison
functions for complex
props
4. Test performance
improvements with large
datasets
5. Ensure
memoized components
don't break existing
functionality

The
memoization strategy
will focus on components
with static or infrequently
changing data to maximize
performance gains while
maintaining component
integrity.
**RepositoryChatTranscript.tsx**
is a memoized component
that receives props
including messages,
pending states, and
error messages, with
a helper function for
checking visible text.
**RepositoryChatComposer.tsx**
is a component that
handles draft-related
props such as draft
content and pending
states.
The RepositoryChatPanelContent
component in App.tsx
should be simplified
to include only the
header, transcript,
and composer.

Props
needed for the composer
include messages for
conversation checks,
draft-related information
like draftType and
draft, cursor agent
settings, recording
states, and all event
handlers. The pending
state requires checking
both chat and draft
statuses.
For React.memo to
work properly on the
transcript component,
the parent must pass
stable callback references
for `onAnswerCopied`
and `onAnswerCopyError`,
or we omit comparing
them. Since React.memo
performs shallow comparison,
if the parent passes
new function references
on every render, memoization
won't help with those
props, though `messages`,
`pending`, and `error`
will remain unaffected
during draft-only updates.
The key acceptance
criterion is that "changing
the draft alone should
not change the transcript
component props when
messages, pending,
and error remain unchanged."
When only draft changes,
the transcript should
receive the same messages,
pendingChat, pendingThinking,
pendingDraft, and errorMessage,
allowing memoization
to skip re-rendering.
When draft changes,
the composer re-renders
as expected since it
has the draft prop.
The transcript component
will use React.memo
with default shallow
comparison. I'll check
if pending state in
the transcript depends
on draft values by
reviewing the code.
The transcript component
calculates pending
state using `pending
= pendingChat || pendingDraft`
for determining empty
state. Since `pending`
is used in the transcript
for checking empty
state (`messages.length
=== 0 && !pending`),
it needs to be either
computed within the
transcript or passed
separately from the
parent component. This
ensures that the transcript
can accurately determine
when to show empty
state based on both
chat and draft pending
statuses.
I need to compute
the pending state inside
the transcript component
to ensure proper memoization.
The transcript will
calculate `pending
= pendingChat || pendingDraft`
to determine empty
state, avoiding the
need to pass separate
pending flags from
the parent.

The implementation
will use React.memo
with default shallow
comparison, ensuring
that changes to draft
content don't trigger
unnecessary re-renders
of the transcript when
messages, pendingChat,
pendingDraft, and error
remain unchanged. This
approach maintains
performance benefits
while preserving component
integrity.
The transcript component
now uses React.memo
with default shallow
comparison, calculating
its own pending state
by combining pendingChat
and pendingDraft. This
ensures that changes
to draft content alone
won't trigger unnecessary
re-renders of the transcript
when messages, pendingChat,
pendingDraft, and error
remain unchanged. The
component computes
pending = pendingChat
|| pendingDraft internally
to maintain proper
memoization while preserving
functionality.
The component should
avoid importing from
App.tsx to prevent
circular dependencies.
A placeholder constant
is causing a circular
import issue. Options
include moving the
constant to a lib file,
duplicating it, passing
it as a prop, or re-exporting
it from App. The best
approach is to define
the placeholder in
the composer file and
export it from App
to avoid breaking the
component structure.
The constant is already
exported from App.tsx,
but importing it back
creates a circular
dependency. To maintain
stability of the export
API and avoid breaking
tests, the best approach
is to either pass the
placeholder as an optional
prop with a default
value in the composer,
or duplicate the string
in the composer file.
Another option is to
move the constant to
RepositoryChatComposer.tsx
and re-export it from
App.tsx, which would
eliminate the circular
import while keeping
the API stable.
The simplest solution
is to pass the placeholder
from RepositoryChatPanelContent
to the composer without
creating new exports.
Import REPOSITORY_CHAT_COMPOSER_PLACEHOLDER
in App and pass it
to the composer.

For
FloatingComposerDraftType,
since it's defined
in App.tsx and causes
circular imports, I'll
use RepositoryChatDraftType
instead, as it's identical
("epic" | "feature")
and avoids the circular
dependency issue.
Update App.tsx to use
the new components.
The initial search_replace
operation for imports
was successful.
The `onDraftTypeChange`
in `App` uses `FloatingComposerDraftType`,
while `composer` expects
`RepositoryChatDraftType`.
However, both represent
the same "epic" or
"feature" and should
be compatible.
I need to add a test
to verify that RepositoryChatTranscript
is properly memoized
and doesn't receive
a draft prop. I can
either import RepositoryChatTranscript
to check its props
type or create a test
that verifies React's
behavior regarding
memoization and draft
prop handling.
A simple approach
would be to read the
RepositoryChatTranscript
source and assert it
doesn't have draft
in props, though this
would be too brittle.
A better method involves
adding a test that
imports RepositoryChatTranscript,
renders it with the
same messages/pending,
and ensures Parent
re-renders with a different
draft passed only to
PanelContentthis is
hard to test memoization
with static markup.
The acceptance criteria
focus on props not
changing, so we could
test by exporting the
transcript and using
a spy.
Shell is completely
rejected. A small test
for transcript isolation
will be added as an
optional enhancement,
and types will be verified
manually.
`onDraftTypeChange`
in RepositoryChatPanelContent
expects `FloatingComposerDraftType`,
but RepositoryChatComposer
passes it to RepositoryChatOptionMenu,
which may require the
exact typeshould still
function correctly.
When only `pendingThinking`
updates without changes
to messages or draft,
the transcript should
refresh, which works
as intended since it's
a transcript property.
When only the draft
changes:
- RepositoryChatPanelContent
re-renders (parent
component)
- RepositoryChatTranscript
receives identical
messages, pendingChat,
pendingThinking, pendingDraft,
and errorMessagememoization
prevents unnecessary
re-renders
- RepositoryChatComposer
receives the updated
draft and re-renders
accordingly
The `onAnswerCopied`
and `onAnswerCopyError`
are inline arrow functions
in `RepositoryChatPanel`
that receive new references
on every render.
Since `onAnswerCopied`
and `onAnswerCopyError`
are inline arrow functions
in `RepositoryChatPanel`,
they receive new references
on every render. This
prevents memoization
of the transcript component
from skipping re-renders
when only the draft
changes.

The acceptance
criterion states that
changing the draft
alone should not affect
the transcript component's
props if messages,
pending status, or error
remain unchanged. However,
when parent components
pass new inline callbacks
on each render, the
props do change even
when only the draft
updates.

Two potential
solutions exist within
the current scope:
1. Stabilize the callbacks
in `RepositoryChatPanel`
- though this would
require changes in
`App.tsx` where `RepositoryChatPanel`
is located, which is
part of the planned
scope.
RepositoryChatPanelContent
continues to re-render
on every draft change,
while RepositoryChatTranscript
remains a memoized
child. When PanelContent
re-renders, React compares
memoized props on Transcript.
PanelContent re-renders
frequently due to draft
changes, but RepositoryChatTranscript
remains memoized. Tests
use inline noop callbacks,
which is acceptable.
A test should verify
that RepositoryChatTranscript
is properly exported
and memoized, potentially
reading its source
file directly.
The regex pattern for
transcript properties
could fail if "draft"
appears elsewhere in
the file, such as in
"pendingDraft." I should
verify how the transcript
file handles "draft"
to ensure accuracy.
RepositoryChatTranscript
has pendingDraft, but
the regex `\bdraft\b`
correctly avoids matching
within "pendingDraft"
because the word boundary
before "draft" in "pendingDraft"
is not satisfiedspecifically,
the character before
"d" in "pendingDraft"
is "g," which is a
word character, so the
word boundary condition
fails.
The regex `\bdraft\b`
won't match "Drafting"
because it requires
a word boundary, and
"Drafting" has a lowercase
"d" while the pattern
expects lowercase "draft".
Additionally, the `RepositoryChatTranscriptProps`
type includes `pendingDraft`,
which would be matched
by the regex if it
appears after the type
definition. However,
since `pendingDraft`
is part of the type
definition itself,
it's not a concern for
the regex matching.
Shell keeps rejecting
the commands. Tests
could not be run in
this environment.
I'll read the repository chat implementation and tests first, then split transcript and composer so draft updates don't re-render the transcript.
Creating the transcript and composer components and slimming down `RepositoryChatPanelContent`.
Stabilizing copy callbacks in `RepositoryChatPanel` so `React.memo` on the transcript isn't defeated by new inline handlers each render.
## Summary

Repository chat is split so typing only re-renders the composer:

- **`RepositoryChatTranscript`** — `React.memo` wrapper for messages, thinking/pending/draft indicators, and errors. No `draft` prop.
- **`RepositoryChatComposer`** — textarea, option menus, voice/ticket actions. Owns `draft` and `onDraftChange`.
- **`RepositoryChatPanelContent`** — header + transcript + composer; same exported props/API as before.
- **`RepositoryChatPanel`** — stable `useCallback` handlers for answer copy so memo isn’t busted on every keystroke.

## Files changed

- `src/renderer/src/components/RepositoryChatTranscript.tsx` (new)
- `src/renderer/src/components/RepositoryChatComposer.tsx` (new)
- `src/renderer/src/App.tsx`
- `tests/ticket-draft-ui.test.tsx`

## Commands run

None — shell execution was unavailable in this session.

## Tests

Please run locally:

```bash
node tests/run-tests.mjs
```

Or focus repository chat UI tests:

```bash
node tests/run-tests.mjs  # includes ticket-draft-ui.test.tsx
```

Added test: **"repository chat transcript component is memoized without draft props"** — checks `memo()`, no `draft` on transcript props, and `draft` on composer.

Existing `RepositoryChatPanelContent` markup tests should be unchanged (same DOM structure and `RepositoryChatPanelContent` import from `App.tsx`).

## Subagent usage

None.

## Remaining risks / follow-up

- **Manual check**: type in composer with a long assistant reply and confirm transcript doesn’t flicker and scroll stays put.
- **Copy callbacks in tests**: static tests use inline `noop` handlers; runtime panel uses stabilized callbacks.
- Run the test suite locally to confirm green.


No Codex run has been started.
