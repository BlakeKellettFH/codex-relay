---
schemaVersion: 1
id: tkt_01ks7fsf0m78t9frpxc2gc8pyh
title: Repository chat thinking vs streaming UI
ticketType: task
draftTargetType: null
status: completed
position: 15000
priority: high
effort: medium
labels:
  - ui
  - repository-chat
parentEpicId: null
parentFeatureId: tkt_01ks7dand93t0q183ks5eja51x
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/styles.css
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-22T09:20:46.612Z'
updatedAt: '2026-05-22T09:36:55.014Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::eb0fe42f-8d0d-432f-9d3e-0cc284741fea'
runStatus: completed
lastRunId: run_01ks7g261h0wnbr5paq3cpb868
lastRunStartedAt: '2026-05-22T09:25:32.412Z'
---
# Repository chat thinking vs streaming UI

## Context

Parent feature: Fix repository chat streaming UX and missing responses

Renderer already receives SSE deltas but ties the visible spinner to the HTTP mutation pending flag.

## Goal

Make streamed assistant messages visible during the turn and keep the final answer on screen.

## Requirements

- Expose separate thinking vs in-flight props to `RepositoryChatPanelContent`.
- Hide the thinking row once assistant stream text exists for the active request.
- Handle SSE `failed` by surfacing `errorMessage` and cleaning up streaming refs.

## Acceptance Criteria

- Panel test covers Thinking... and streamed content without a concurrent pending spinner row.
- Manual Cursor chat shows typing transcript before the POST resolves.

## Implementation Plan

- Add `hasStreamedAssistant` (state/ref) in `RepositoryChatPanel`, set true on first matching `delta`, reset on submit completion/failure.
- Update `RepositoryChatPanelContent` props and pending render guard; rename copy to "Thinking...".
- Wire `failed` SSE to `setErrorMessage`; reset `streamingAssistantMessageIdRef` on terminal events.
- Update `tests/ticket-draft-ui.test.tsx` expectations and add a streaming-visible case.

## Assumptions

- Composer disabled state can remain tied to `repositoryChatMutation.isPending`.

## Codex Handoff

### 5/22/2026, 10:28:31 AM

The user requests implementation
of a repository chat
streaming UI feature.
I will read the relevant
sections of the App.
I now comprehend the
complete picture.
I need to add `hasStreamedAssistant`
state in `RepositoryChatPanel`
and replace the `pendingChat`
prop with separate
props: `pendingThinking`
for showing the "Thinking..."
row when a request
is in flight but no
streamed content has
appeared yet, keeping
`pendingDraft` for
drafting, and potentially
renaming `pendingChat`
to `chatRequestInFlight`
for the composer disabled
state. Additionally,
I must update `RepositoryChatPanelContent`
to accept `pendingThinking`
instead of relying
on `pendingChat` for
the spinner row.
```
Hide the thinking
row when `hasStreamedAssistant`
is true or when there's
a streamed assistant
message in messages.
Pass `hasStreamedAssistant`
to hide the thinking
row once assistant
stream text exists.
For pending logic, keep
`pending` for composer
disable as `repositoryChatMutation.isPending
|| createDraftMutation.isPending`.
Show the thinking row
when `pendingThinking
&& !hasStreamedAssistant`,
where `pendingThinking`
equals `chatMutation.isPending`
or `streamingRequestIdRef`
is set.
Expose separate props
for thinking and in-flight
states. Use `pendingThinking`
for the "Thinking..."
row and keep composer
disabled tied to `repositoryChatMutation.isPending`.
Show the thinking row
when `pendingThinking`
is true and `hasStreamedAssistant`
is false. Set `pendingThinking`
to true when `repositoryChatMutation.isPending`
and no assistant content
has streamed yet.
The panel should display
the "Thinking..." row
when a chat is in progress
but no streamed content
has appeared yet. This
occurs when `repositoryChatMutation.isPending`
is true and `hasStreamedAssistant`
is false. The thinking
row is hidden once
assistant content begins
streaming, even if
the HTTP request is
still pending. A separate
"Drafting ticket idea"
indicator handles draft
creation states. In
case of SSE failure,
relevant references
are reset to ensure
proper state handling.
The `hasStreamedAssistant`
state is reset to false
at the start of streaming
and upon completion
or error, ensuring
it accurately reflects
whether assistant content
has been streamed.
It is set to true when
a delta is received,
indicating assistant
activity. Consider
renaming `pendingChat`
for clarity.
The content component
currently uses `pendingChat`
for both the thinking
row and the `pending`
calculation, but these
should be separated.
The `RepositoryChatPanelContent`
should receive distinct
props: `pendingThinking`
to control the "Thinking..."
row, `chatRequestInFlight`
or mutation pending
for the composer's
disabled state, and
`pendingDraft` remains
unchanged. The composer
disabled state (`pending`)
will be calculated
as `repositoryChatMutation.isPending
|| pendingDraft`.
The chat composer's
pending state should
be managed separately
from the thinking and
drafting states. The
`pendingChat` prop
will now only control
the composer's disabled
state, while `pendingThinking`
and `pendingDraft`
will manage their respective
rows. This separation
allows for distinct
UI feedback: "Thinking..."
for pending requests
and "Drafting ticket
idea" for draft creation.
The composer will be
disabled when either
`repositoryChatMutation.isPending`
or `createDraftMutation.isPending`
is true. The thinking
row appears when `pendingThinking`
is true and no assistant
content has streamed
yet. The drafting row
shows when `pendingDraft`
is active. These changes
simplify the UI logic
and improve clarity.
The thinking row should
be hidden when assistant
content has started
streaming, but the
draft creation process
can still be independent.
Currently, a single
pending state controls
both chat and draft
behaviors, so it needs
to be split into distinct
states: one for the
"Thinking..." row and
another for the "Drafting
ticket idea" row. The
`pendingChat` prop
will be replaced with
`pendingThinking` for
controlling the thinking
row, while `chatInFlight`
or `chatComposerPending`
will manage the composers
disabled state. This
separation ensures
clearer UI behavior
and aligns with the
ticket's requirement
to expose separate
thinking and in-flight
props.
The `pendingChat`
prop will remain named
as-is to minimize test
changes, controlling
the composers disabled
state based on mutation
pending status. The
new `pendingThinking`
prop will manage the
display of the "Thinking..."
row. Tests must be
updated to reflect these
changes.

For styling,
a `.repository-chat-message.thinking`
class may be added
to differentiate the
thinking row from drafts,
which currently use
the `pending` class.
The thinking rows text
will be updated to
"Thinking...", and existing
styles may need adjustments
to support this change.
The `RepositoryChatPanelContent`
component now receives
separate props for
managing the "Thinking..."
row and draft creation,
with `pendingThinking`
controlling the former
and `pendingDraft`
the latter. The composers
disabled state is determined
by `pendingChat`, which
combines `repositoryChatMutation.isPending`
and `createDraftMutation.isPending`.
The thinking row displays
only when `pendingThinking`
is true and no assistant
content has streamed
yet. The draft row
appears when `pendingDraft`
is active, allowing
distinct UI feedback
for each state.
The "Thinking..."
row is displayed when
a chat request is in
flight and no assistant
content has streamed
yet. It is hidden once
assistant content begins
streaming, even if
the request is still
pending. The "Drafting
ticket idea" indicator
shows during draft
creation, independent
of assistant streaming.
The `hasStreamedAssistant`
state tracks whether
assistant content has
been received, resetting
to false on submission,
failure, or completion.
The thinking row is
controlled by `pendingThinking`,
while the composer's
disabled state uses
`pendingChat`, combining
`repositoryChatMutation.isPending`
and `createDraftMutation.isPending`.
Separate props allow
distinct UI feedback
for each state.
When a mutation occurs,
`hasStreamedAssistant`
is reset to false and
`streamingAssistantMessageIdRef`
is cleared. The `pendingThinking`
state is set to true
when the repository
chat mutation is pending
and no assistant content
has streamed yet. If
an SSE failure occurs,
the mutation may remain
pending until the HTTP
request completes,
but the error should
be displayed. When
streaming finishes via
SSE before the HTTP
request completes,
`hasStreamedAssistant`
is reset to false on
the completed event
to prevent the thinking
row from reappearing.
Edge case: when a
mutation completes with
a full response and
no SSE occurs, `hasStreamedAssistant`
stays false, so the
thinking row persists
until the HTTP request
finishesthis behavior
is correct.

Tests
must be updated to reflect
the new logic: "Reading
repository context"
should become "Thinking...",
the spinner row test
should use `pendingThinking`
instead of `pendingChat`,
and a new test case
should verify that
the thinking row disappears
once assistant content
streams in, with `pendingThinking`
false while `pendingChat`
remains true and no
concurrent spinner
row appears.

A new
test case verifies that
the "Thinking..." row
is shown until streamed
assistant content arrives,
ensuring proper UI
behavior during chat
responses.
// Case 1: thinking
only
const thinkingMarkup
= renderToStaticMarkup(
<RepositoryChatPanelContent
pendingChat
pendingThinking
messages={[user message]}
...
  />
);
assert.match(thinkingMarkup,
/Thinking\.\.\./);
assert.match(thinkingMarkup,
/aria-busy="true"/);
assert.doesNotMatch(thinkingMarkup,
/Reading repository
context/);

// Case
2: streamed content,
in flight, no thinking
row
const streamedMarkup
= renderToStaticMarkup(
<RepositoryChatPanelContent
pendingChat
pendingThinking={false}
hasStreamedAssistant
messages={[user
message, assistant
message]}
    ...
/>
);
assert.doesNotMatch(streamedMarkup,
/Thinking\.\.\./);
assert.match(streamedMarkup,
/aria-busy="true"/);
The testing logic
has been updated to
distinguish between
`pendingChat` and `pendingThinking`,
ensuring the "Thinking..."
row appears only when
appropriate. Tests
now verify that the
thinking row disappears
once assistant content
starts streaming, and
that `pendingChat`
controls the composer's
disabled state independently.
The "Thinking..." row
is shown only when
`pendingThinking` is
true and no assistant
content has streamed
yet. A new test case
confirms that assistant
content renders correctly
without the thinking
row appearing again.
Existing tests using
`pendingChat` are updated
to use `pendingThinking`
for the thinking row
and `pendingChat` for
disabling the composer.
The `pendingDraft`
state remains unaffected,
allowing draft creation
to proceed independently.
Add CSS for `.repository-chat-message.thinking
p` to match the pending
style. For failed events,
set both error message
and toast notification
similarly to the catch
handler. Since `setToast`
isn't in the useEffect
dependencies, a ref
should be used to ensure
it's accessible within
the effect.
There is a bug in the
completed handler where
streamingAssistantMessageIdRef
was set.
The streamed markup
assertion `repository-chat-message
assistant (?:pending|thinking)`
may fail because assistant
messages in the transcript
also use the `repository-chat-message
assistant` class.
The streamed markup
assertion `repository-chat-message
assistant (?:pending|thinking)`
may incorrectly match
regular assistant messages
because they also use
the `repository-chat-message
assistant` class. A
more specific assertion
is needed to exclude
thinking states.

The
updated assertions
should ensure that streamed
markup does not contain
"Thinking..." or the
`repository-chat-message
assistant thinking`
pattern. Additionally,
checking for `aria-busy`
attributes could help
distinguish between
regular and streaming
assistant messages.
Tests couldn't be run
due to shell rejection.
Implementing repository chat thinking vs streaming UI. Exploring the current implementation in the planned files.
Implementing separate thinking vs streaming props and updating SSE failure handling.
Fixing a bug: the `completed` handler clears `streamingAssistantMessageIdRef` before using it.
## Summary

Repository chat now separates **thinking** from **in-flight** state so streamed assistant text shows while the POST is still pending, without a duplicate spinner row.

### Changes

**`RepositoryChatPanelContent`**
- Added `pendingThinking` prop (separate from `pendingChat`, which still disables the composer).
- Split the status UI: a **Thinking...** row (`thinking` class) vs a **Drafting ticket idea.** row (`pending` class).
- Thinking row only renders when `pendingThinking` is true.

**`RepositoryChatPanel`**
- Tracks `hasStreamedAssistant` — set on first SSE `delta`, cleared on submit, terminal events, and HTTP completion/failure.
- Passes `pendingThinking={repositoryChatMutation.isPending && !hasStreamedAssistant}`.
- SSE `failed`: sets `errorMessage`, shows toast, clears streaming refs and `hasStreamedAssistant`.
- SSE `completed` / HTTP handlers: clear `streamingAssistantMessageIdRef` on terminal events.

**`styles.css`**
- Shared spinner layout for `.thinking` and `.pending` status rows.

**`tests/ticket-draft-ui.test.tsx`**
- Updated expectations: **Thinking...** instead of **Reading repository context**.
- Added test for thinking-only vs streamed-content-without-spinner.

### Files changed
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`
- `tests/ticket-draft-ui.test.tsx`

### Commands run
- Shell execution was unavailable in this session (commands were rejected).

### Tests
Could not run locally. To verify:

```bash
node --import tsx --test tests/ticket-draft-ui.test.tsx
```

### Subagent usage
None used.

### Remaining risks / follow-up
- **Manual check**: Cursor repository chat should show **Thinking...** briefly, then stream text before the POST resolves.
- If SSE `failed` fires while the HTTP mutation is still pending, both SSE and the mutation `catch` may set error state; behavior should still be correct but could duplicate toasts in edge cases.
- Run the test command above (or full `npm test`) before marking the ticket complete.


No Codex run has been started.
