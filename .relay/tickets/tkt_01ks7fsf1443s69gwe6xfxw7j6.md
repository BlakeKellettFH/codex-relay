---
schemaVersion: 1
id: tkt_01ks7fsf1443s69gwe6xfxw7j6
title: Repository chat Cursor stream deltas and final text
ticketType: task
draftTargetType: null
status: completed
position: 16000
priority: high
effort: medium
labels:
  - backend
  - cursor
  - repository-chat
parentEpicId: null
parentFeatureId: tkt_01ks7dand93t0q183ks5eja51x
subticketIds: []
plannedFiles:
  - src/services/codex/index.ts
  - src/services/agents/cursorProvider.ts
  - tests/backend.test.ts
  - tests/cursor-cli.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-22T09:20:46.628Z'
updatedAt: '2026-05-22T09:37:00.000Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::454bbac5-c16a-46c8-8bf9-91b7580d618f'
runStatus: completed
lastRunId: run_01ks7g265anbkxxp20pgeyeck7
lastRunStartedAt: '2026-05-22T09:28:31.440Z'
---
# Repository chat Cursor stream deltas and final text

## Context

Parent feature: Fix repository chat streaming UX and missing responses

Chat streaming loops only emit deltas from `agent.message.delta`; Cursor CLI may emit other normalized event types during long turns.

## Goal

Backend delivers incremental and final assistant text for Cursor repository chat.

## Requirements

- Repository chat delta mapper forwards assistant answer text from Cursor stream-json events used in practice.
- Final `completed` event and HTTP response share the same trimmed answer string.
- Add tests for stream-json sequences that previously produced zero deltas.

## Acceptance Criteria

- `tests/backend.test.ts` stream test passes with cursor-like event payloads that include answer text only at end or in `message.completed`.
- No regression for existing mocked delta stream test.

## Implementation Plan

- Extend `repositoryChatDeltaFromRelayEvent` (or adjacent helper) in `src/services/codex/index.ts` to accept additional normalized text events for `repository.chat` only.
- Adjust `cursorProvider` text extraction if envelope fields differ from `message.delta` / `message.completed` fixtures.
- Add backend/cursor-cli tests for NDJSON sequences representing a real chat answer.

## Assumptions

- SSE transport and `publishRelayHttpRepositoryChatEvent` wiring remain unchanged.

## Codex Handoff

### 5/22/2026, 10:33:48 AM

The user wants me to
address a Relay ticket
regarding issues with
repository chat streaming
in Cursor CLI.
Now I understand the
flow: Cursor provider
yields `rawEvent` from
stream-json lines.
The flow processes
`rawEvent` from stream-json
lines, where `sendRepositoryChatMessage`
normalizes events into
RelayCodexEvent types,
and `repositoryChatDeltaFromRelayEvent`
only handles `agent.message.delta`
events. However, `message.completed`
events are mapped to
`agent.message.completed`
instead of `agent.message.delta`,
causing them to be
ignored. The fix addresses
this mismatch.
To fix the streaming
UX issue, `repositoryChatDeltaFromRelayEvent`
must now handle text
events specifically
from `repository.chat`,
including `agent.message.completed`
events. These should
be forwarded as deltas
to ensure the UI displays
content even before
the HTTP response finishes.
Additionally, the final
`completed` event and
HTTP response must
use the same trimmed
answer string (`result.text.trim()`),
ensuring consistency
between the incremental
deltas and the final
output.
I now understand the
issue better.
The `repositoryChatDeltaFromRelayEvent`
function needs to handle
additional event types
beyond `agent.message.delta`,
specifically `agent.message.completed`
and `result` events,
while ensuring incremental
text tracking to prevent
duplicate full text
emissions.
During streaming,
events such as `command.started`
do not generate deltas.
The `message.delta`
event with a `delta`
field maps to `agent.message.delta`,
while `message.completed`
with a `message` field
maps to `agent.message.completed`
but is not currently
forwarded. Additional
event types like `{
type: "assistant",
... }` and `{ type:
"text", ... }` may also
need handling, along
with partial output
in `result` subtypes.
Further review of the
ticket and parent findings
is required.
The backend only forwards
stream text when `repositoryChatDeltaFromRelayEvent`
encounters `agent.message.delta`.
Cursor's `runTextStream`
processes normalized
stream-json lines,
where non-text events
like commands produce
no chat deltas.

The
fix focuses on handling
`message.completed`
and potentially `result`
events. For consistent
final text:

- `responseMessage
= result.text.trim()`
from `cursorTextResultFromRawResponse`
- This joins `extractCursorEventText`
from all events

If
`message.completed`
is emitted as a delta,
incremental tracking
must prevent duplicate
emissions.
The sendRepositoryChatMessage
loop must track streamed
text length and emit
only the suffix from
completed events. Regarding
`type: "result"` with
subtype success and
result text, `normalizeProviderNativeEvent`
likely produces output.
For `{ type: "result",
subtype: "success",
result: "..." }`, the
`providerEventType`
is "result", which
doesn't align with message
delta or completed
patterns. It may match
command completed patterns,
but those don't apply
here. It falls through
to `normalizeProviderTextEvents`,
which checks for relevant
conditions.
The `repositoryChatDeltaFromRelayEvent`
function must also
handle `agent.message.completed`
events to emit text,
since `result` events
with text do not produce
relay events. For streaming,
when only a final `result`
or `message.completed`
event arrives, deltas
should still be emitted.
The plan is to extend
`repositoryChatDeltaFromRelayEvent`
to extract and return
text from `agent.message.completed`
events.
In the streaming loop,
track `streamedAnswerLength`
and compute incremental
delta (suffix only)
to avoid duplication
when partial deltas
are present.  
Extend
`repositoryChatDeltaFromRelayEvent`
in `src/services/codex/index.ts`
to handle additional
normalized text events
for `repository.chat`
only.
A helper function
can be added to map
relay events to delta
strings, including
completed events, with
incremental tracking
in `sendRepositoryChatMessage`.
Adjust `cursorProvider`
text extraction if
envelope fields differ,
as `extractCursorEventText`
already checks various
fields but nested structures
in stream events may
require further investigation.
The ticket requires
extending `repositoryChatDeltaFromRelayEvent`
for `repository.chat`
only. For `type: "result"`
events, `normalizeProviderNativeEvent`
returns an empty array,
so `repositoryChatDeltaFromRelayEvent`
never processes them.
The solution involves
either enhancing `normalizeProviderTextEvents`
in `codex/index.ts`
or mapping raw events
in the repository chat
loop before normalization.
The ticket suggests
extending `repositoryChatDeltaFromRelayEvent`
or an adjacent helper
to handle raw events,
though the current
flow processes events
through `normalizeProviderNativeEvent`
first.
I can add `repositoryChatDeltasFromProviderEvent(rawEvent)`
that calls `normalizeProviderNativeEvent`
and additionally checks
for `result`/`assistant`
text that normalization
misses.

Or extend
`normalizeProviderTextEvents`
to handle `type: "result"`
with string result,
but this would affect
all uses of `normalizeProviderNativeEvent`,
not just `repository.chat`.
Since the ticket specifies
"for repository.chat
only," I should not
change `normalizeProviderTextEvents`
globally.

The best
approach is to create
`repositoryChatDeltaFromRelayEvent`
that handles `agent.message.delta`
and `agent.message.completed`
events.
Add a `repositoryChatDeltasFromRawEvent(rawEvent)`
helper that processes
relay events from `normalizeProviderNativeEvent`,
maps them through `repositoryChatDeltaFromRelayEvent`,
and extracts text from
raw events using repository-chat-specific
rules if no deltas
are found. Use this
helper in the `sendRepositoryChatMessage`
loop with incremental
tracking. Also, check
`cursorProvider` to
ensure proper event
normalization at yield
time for consistent
`message.delta` shapes.
The mock test uses
`{ type: "message.delta",
text: "..." }` which
`normalizeProviderTextEvents`
maps via regex `^(delta|message)# Repository chat Cursor stream deltas and final text

## Context

Parent feature: Fix repository chat streaming UX and missing responses

Chat streaming loops only emit deltas from `agent.message.delta`; Cursor CLI may emit other normalized event types during long turns.

## Goal

Backend delivers incremental and final assistant text for Cursor repository chat.

## Requirements

- Repository chat delta mapper forwards assistant answer text from Cursor stream-json events used in practice.
- Final `completed` event and HTTP response share the same trimmed answer string.
- Add tests for stream-json sequences that previously produced zero deltas.

## Acceptance Criteria

- `tests/backend.test.ts` stream test passes with cursor-like event payloads that include answer text only at end or in `message.completed`.
- No regression for existing mocked delta stream test.

## Implementation Plan

- Extend `repositoryChatDeltaFromRelayEvent` (or adjacent helper) in `src/services/codex/index.ts` to accept additional normalized text events for `repository.chat` only.
- Adjust `cursorProvider` text extraction if envelope fields differ from `message.delta` / `message.completed` fixtures.
- Add backend/cursor-cli tests for NDJSON sequences representing a real chat answer.

## Assumptions

- SSE transport and `publishRelayHttpRepositoryChatEvent` wiring remain unchanged.

,
and `"message.delta"`
matches `/(message|text|content).*(delta|chunk|stream)/`.
For `{ type: "message.delta",
delta: "..." }`, it
uses the delta field.
For `{ type: "message.completed",
message: "..." }`,
it maps to `agent.message.completed`,
not a delta.

For incremental
streaming in `sendRepositoryChatMessage`,
track `streamedText`
and emit only the suffix
from completed events
to avoid duplicates.
The `appendRepositoryChatDelta`
function handles text
updates by computing
a suffix from the streamed
text to avoid duplicates.
For completed events,
where the full text
is often provided,
it emits the suffix
if the text starts with
the streamed text,
otherwise it emits the
full text. This ensures
no duplication during
incremental streaming.
No deltas are emitted
during tool use. When
`message.completed`
arrives with the full
answer, the entire
message should be emitted.
Similarly, if `result.text`
contains the full answer,
it may cause duplication
with `message.completed`.
The function `cursorTextResultFromRawResponse`
combines all extracted
text from events with
newlines, potentially
creating a final string
like "Applying...\nImplementation
finished." from a delta
and completed event.
For incremental streaming
UX, logic tracks `streamedText`
and emits only the
suffix from completed
events to prevent duplication.
If the full text from
a completed event starts
with previously streamed
text, only the new
suffix is sent; otherwise,
the full text is emitted.
If the sliced text
starts with the streamed
text, emit the difference
as a delta; otherwise,
if the streamed text
starts with the slice,
ignore it. For unrelated
chunks, decide whether
to emit as a new delta
or replace. If the
delta is empty, do nothing.
Otherwise, append the
delta to the streamed
text and emit it. For
completed events with
full text and no streamed
text, emit the full
text and set streamed
text to the full text.
When partial deltas
are followed by a completed
event with full text,
emit only the suffix
from the completed
event. For completed
events with full text
and no partial deltas,
emit the full text
directly.
For final `result`
events, deduplication
is needed to avoid
duplicating text from
`agent.message.completed`
events. The helper
should use prefix-based
deduping logic to prevent
this.

The `repositoryChatDeltaFromRelayEvent`
function should also
handle `agent.message.completed`
events.

For raw events
that do not normalize
into relay events,
add `repositoryChatAnswerTextFromRawEvent`
in `codex/index.ts`
to extract text from
`result`, `assistant`,
or `message.completed`
types.
I have a clear plan
and will now implement
it.
I will implement the
plan by adding new
helper functions in
`codex/index.ts` to
handle text extraction
from various event
types and updating the
streaming logic. I
will also improve `extractCursorEventText`
in `cursorProvider.ts`
and consider exporting
it for testing purposes.
Or tests use integration
path.

When considering
consistency between
cursorTextResultFromRawResponse
and streaming, the
final response uses
cursorTextResultFromRawResponse
to extract text and
sessionId. This function
aggregates text from
all events, including
command events with
stdout, which could
pollute the answer.
However, extractCursorEventText
only looks for specific
keys like result, output_text,
text, message, content,
and delta, but not
command.output's stdout
key, which is good.
Command output events
contain a `stdout`
field that is not extracted
by `extractCursorEventText`,
which is appropriate.
Message completed and
delta events are both
extracted. Result events
with a result field
are also extracted.
The final text is formed
by joining all extracted
texts with newlines,
such as "delta1\ndelta2\ncompleted
message". For repository
chat answers, the final
HTTP response uses
`result.text`, which
is the joined extraction.
Streaming should incrementally
send pieces that build
up to the same final
string when joined.
The final answer is
trimmed single answer:
`responseMessage =
result.text.trim()`.
Joining deltas like
"Hello " and "world"
with completed "Hello
world" results in "Hello
world", matching the
final string. If only
completed exists, a
single delta matches.
Duplicate suffixes
are prevented by suffix
logic. However, if
a result event at the
end contains the same
text as completed,
`extractCursorEventText`
on both would cause
duplication in `cursorTextResultFromRawResponse`
when joined with a
newline.
message.delta: "Applying
patch..."  
message.completed:
"Implementation finished."
Final text: "Applying
patch...\nImplementation
finished."  correct
and not duplicated.
If completed contained
the same text as the
deltas joined, duplication
would occur in the
final text from `cursorTextResultFromRawResponse`,
which is pre-existing.
For streaming suffix
logic: when result
event text duplicates
completed text, it
must be handled.

I
will implement `repositoryChatAnswerTextFromRawProviderEvent`
for events where `normalize`
returns empty but still
contain answer text.
```
The function `repositoryChatAnswerTextFromRawProviderEvent`
processes events to
extract answer text,
skipping non-essential
command or tool events
while focusing on relevant
types like "result",
"assistant", or "final
text". It checks for
text in fields such
as `result`, `output_text`,
`text`, `message`,
or `content`, returning
the first available
string value or null
if none are found.
For repository chat,
I should mirror `extractCursorEventText`
fields by either importing
it from `cursorProvider`
or duplicating the
minimal extraction logic
in `codex/index.ts`.
While exporting `extractCursorEventText`
from `cursorProvider`
is possible, it may
introduce unwanted
coupling. Instead, Ill
add repository-chat-specific
extraction logic in
`codex/index.ts`.
Additionally, I will
enhance `extractCursorEventText`
in `cursorProvider`
to support nested content
arrays commonly found
in API responses.
The function `extractCursorEventText`
now handles nested
content arrays by mapping
through them to extract
text. It checks for
text in fields like
`result`, `output_text`,
`text`, `message`,
`content`, and `delta`,
and supports nested
arrays in `content`.
Tests may need to be
updated to reflect
these changes, especially
regarding envelope
fields differing from
previous expectations.
Exporting `extractCursorEventText`
for testing purposes
is being considered.
Tests for `runTextStream`
can be found in `cursor-cli.test.ts`.
I will implement the
streaming loop changes,
including updating
`streamedAnswerText`
and emitting deltas
with proper suffix
handling.
The code processes
normalized events by
emitting deltas from
relay events and the
raw provider event.
It then handles suffix
logic for streamed
answers by comparing
incoming text with
the current streamed
text to determine if
a suffix should be
applied.

For the suffix
logic, if the incoming
text is empty, it returns
null. If there's no
streamed text yet,
it returns the incoming
text. Otherwise, it
compares the incoming
text against the streamed
text to decide whether
to apply a suffix.
If the streamed text
starts with the incoming
text, return null.
Otherwise, return the
incoming text. For
disjoint segments, cursor
joins with newlines,
so the second chunk
should be prefixed
with a newline if streamed
text exists and there's
no prefix match.
The suffix logic ensures
that when a new text
chunk doesn't start
with the existing streamed
text, it's prefixed
with a newline to maintain
proper concatenation.
For example, if "A"
is streamed and "B"
arrives, "B" becomes
"\nB" to preserve the
intended order. This
prevents duplication
and ensures accurate
incremental updates.
For separate delta
chunks like "Hello"
and "world", since
"world" doesn't start
with "Hello", the system
emits "\nworld" to
correctly join them
into "Hello\nworld".
This approach mirrors
how `cursorTextResultFromRawResponse`
joins extracted text
pieces with newlines,
ensuring consistency
between streaming and
final results.
"world" doesn't start
with "Hello".

Message.delta
chunks are incremental
fragments meant to
be appended, not replaced,
while message.completed
contains the full cumulative
text. Therefore, delta
chunks should be appended
as-is without prefix
logic, whereas completed
messages require suffix
logic to compare against
the current streamed
text. Raw result events
should also use suffix
logic. The normalize
behavior confirms that
delta emits fragments
in the text field,
while completed emits
the full message.
The function `repositoryChatAnswerTextFromRelayEvent`
extracts text from
relay events, distinguishing
between delta fragments
and completed cumulative
text. For delta events,
it returns the text
with mode 'fragment',
and for completed events,
it returns the text
with mode 'cumulative'.
The emit function processes
these chunks by appending
fragment text to streamed
content and applying
suffix logic to cumulative
text.
For fragments, streamed
cumulative text is
updated by appending
the fragment. For completed
cumulative text, the
suffix is computed
by comparing against
the streamed text.
When completed text
starts with streamed
text, the suffix is
the remaining portion
of completed text.
If only completed text
exists without prior
fragments, the entire
completed text is used
as the suffix. Similarly,
for raw result events
at the end, the behavior
mirrors cumulative
logic.

Tests are being
implemented to cover
scenarios with only
message.completed events,
result-type events
without deltas, and
other variations in
event structures.
I will implement all
changes.
There is a problem where
`repositoryChatAnswerTextFromRawProviderEvent`
references `providerEventType`,
which is defined later
in the file.
In JavaScript/TypeScript,
const functions are
not hoisted, so referencing
`providerEventType`
before its definition
causes runtime failure.
The new helper functions
are placed at line
1740, while `providerEventType`
is defined at line
3319, creating a dependency
issue. To resolve this,
the helpers must be
moved after `providerEventType`,
`providerEventType`
must be moved earlier,
or minimal type extraction
must be duplicated
in the helpers. The
ticket specifies extending
`repositoryChatDeltaFromRelayEvent`
around line 1740, but
this references `providerEventType`
which is defined later.
In TypeScript/JavaScript,
const declarations
are subject to the temporal
dead zone and must
be initialized before
use. Since functions
are only called at
runtime after module
initialization, they
are safe as long as
`providerEventType`
is initialized before
`sendRepositoryChatMessage`
runs. However, at module
load time, `repositoryChatAnswerTextFromRawProviderEvent`
is defined as a closure
referencing `providerEventType`,
and since all const
declarations are evaluated
in order during module
loading, this creates
a dependency issue.
When defining `repositoryChatAnswerTextFromRawProviderEvent`
at line 1740, `providerEventType`
at line 3319 hasn't
been initialized yet,
but since the arrow
function only references
`providerEventType`
without accessing it
until call time, and
by then the module
is fully loaded, this
should work fine.
The code works because
`bar` is initialized
before `foo()` is called,
even though `foo` references
`bar` in a const declaration.
To fix duplicate emissions,
the system must avoid
double-triggering when
both `message.completed`
and `repositoryChatAnswerTextFromRawProviderEvent`
are present in the
same raw event, as they
both produce `agent.message.completed`.
Fix the duplicate
emissions by using raw
fallback only when
relay events produce
no answer text, or
by excluding already
normalized types.
```typescript
let relayHadAnswer
= false;
for (const
relayEvent of relayEvents)
{
  const chunk = repositoryChatAnswerTextFromRelayEvent(relayEvent);
if (chunk) relayHadAnswer
= true;
  await emitRepositoryChatAnswerDelta(chunk);
}
if (!relayHadAnswer)
{
  await emitRepositoryChatAnswerDelta(repositoryChatAnswerTextFromRawProviderEvent(event.rawEvent));
}
```

However, result
events normalize to
[], so relayHadAnswer
remains false, triggering
the raw fallback correctly.
Now add tests. For backend.test.ts:
1.
The cursor-cli test
expectation for completed.text
might be incorrect.
The cursorTextResultFromRawResponse
function processes
events sequentially,
extracting text from
delta, completed, and
result fields. For
the given events, it
captures "The prompt
lives in " from delta,
and the full sentence
from both completed
and result fields.
These are then joined
together, resulting
in the assertion that
matches the expected
output. This behavior
aligns with the test
expectation for completed.text.
However, for repository
chat HTTP responses,
the final text must
match the trimmed answer
from the completed
event message. While
tests use `text: answer`
directly from the completed
event, real cursor
provider responses come
from `cursorTextResultFromRawResponse`,
which can introduce
duplicates. The ticket
clarifies that both
the final completed
event and HTTP response
should share the same
trimmed answer string.
The `sendRepositoryChatMessage`
function uses `result.text.trim()`
from the provider's
completed promise.
If the cursor returns
duplicated text, the
HTTP response would
also contain duplicates,
as both the HTTP response
and completed SSE use
`responseMessage =
result.text.trim()`
from the same source,
ensuring consistency.
However, users may
see streamed deltas
build correctly while
the final message contains
extra duplication from
the cursor provider,
which is a separate
UX issue. The ticket
indicates adjusting
cursorProvider text
extraction is needed.
For final text, `cursorTextResultFromRawResponse`
could prioritize `message.completed`
or `result` over accumulating
all deltas.
However, fixing this
might break existing
implementations.

For
repository chat, the
final text logic may
need to differ from
regular usage, since
`sendRepositoryChatMessage`
uses `provider.completed.text`
directly.

The ticket's
goal is ensuring stream
deltas and final/completed
events share the same
string. In tests, `completed.text`
is controlled directly.
For cursor-cli tests,
the duplication in
`completed.text` reflects
the current behavior
of `cursorTextResultFromRawResponse`.
While deduplication
is possible, the ticket
specifies adjusting
cursorProvider text
extraction when envelope
fields differ.
I'll enhance cursorTextResultFromRawResponse
to prioritize the final
answer from result/message.completed
events.
The function processes
events in reverse order
to find the final answer
from result or assistant
events, prioritizing
message.completed events
for the text extraction.
The function extracts
the final answer by
prioritizing message.completed
events, falling back
to joined event texts
when needed. For test
cases with delta and
completed events, it
handles "Implementation
finished." in message.completed
and session-only results
in result events.
The function should
prioritize message.completed
events but fall back
to combining delta
fragments when needed
to ensure complete
answer text is extracted.
When processing events,
it must check if a
message.completed event
contains the full answer
text, otherwise combine
delta fragments from
multiple events to
reconstruct the complete
response.
If the final answer
from message.completed
or result events exists
and joined delta fragments
form a prefix of it,
use only the completed/result
text. Otherwise, join
all fragments as before.
For repository chat
consistency, use the
cumulative final answer
from the last message.completed
or result event if
present, otherwise join
all fragments.
For implementation
tests, if the last
message.completed contains
only "Implementation
finished.", it would
break the test since
delta fragments would
also be needed.

The
order of events is
delta, completed, and
result (session only).
The last event with
text is completed,
which shows "Implementation
finished."this is incorrect
because delta fragments
are also required.
The final answer logic
should join fragments,
but if the last cumulative
text contains all prior
fragments as substrings,
then only the cumulative
text should be used.
The existing join
logic works for implementation,
but duplication occurs
when both delta fragments,
completed full text,
and result full text
contribute to the final
answer.
When building text
parts, skip message.delta
texts if a later message.completed
or result event exists
with text that encompasses
the full answer.

The
algorithm processes
events in order, collecting
delta text parts and
tracking any terminal
answer from completed
or result events. If
a terminal answer exists
and covers all prior
text, only that answer
is used; otherwise,
delta fragments are
joined as before.
If a terminal answer
exists and fully encompasses
prior text parts, it
is returned directly.
Otherwise, delta fragments
are joined with the
terminal answer. For
implementation, if
delta parts are not
fully contained in the
terminal answer, they
are combined with it.
For chat streams with
only completed events,
the full answer is
returned directly.
The extracted result
text is obtained before
the session_id, and
both fields are present
in the stream test
result event.
For the implementation
test, when receiving
`message.delta` followed
by `message.completed`
with "Implementation
finished", the partial
"Applying patch..."
should be joined with
a newline and returned.
Run tests and remove
any unused `repositoryChatDeltaFromRelayEvent`
function if it causes
lint errors, though
it may still be needed.
Verify that repository
chat using the real
cursor provider behaves
correctly, especially
noting that `streamedAnswerText`
at the end may differ
from `result.text`
if `result.text` uses
`cursorAnswerTextFromEvents`
while streaming uses
fragment logic. For
streaming, if the delta
fragment is "The prompt
lives in ", then `streamed`
should equal that value.
The run-tests.mjs script
executes all tests.
Shell is blocked. I
will remove the unused
`repositoryChatDeltaFromRelayEvent`
function if it is dead
code, as it may cause
linting warnings for
unused code.
I will keep the `repositoryChatDeltaFromRelayEvent`
function for now since
it might be useful
and doesn't cause lint
errors.

The mock test
uses `{ type: "message.delta",
text: "..." }` which
is handled correctly
by `normalizeProviderTextEvents`.
The completed test
properly normalizes
to `agent.message.completed`
with `relayHadAnswerText`
set to true, skipping
the raw event. The
emit logic uses cumulative
mode with suffix logic,
and streamed events
start empty with the
full answer emitted.
For result tests,
normalize returns command.output
for stdout, not answer,
and relayHadAnswerText
remains false. The
command.output type
is produced instead
of agent.message events,
with relayHadAnswerText
staying false. For
result types, repositoryChatAnswerTextFromRawProviderEvent
uses "result.success"
as the provider event
type.
Let me verify that the
existing delta stream
test still works with
fragment mode.
Implementing Cursor repository-chat stream deltas. Reading the planned files and related code.
Implementing repository-chat delta mapping for `message.completed` and result events, with incremental suffix tracking for cumulative text.
Preventing duplicate deltas when both normalized and raw handlers match the same event.
Improving final text extraction in `cursorProvider` so the HTTP response matches streamed content and avoids duplicate joins.
Removing unused `repositoryChatDeltaFromRelayEvent`.
Implemented repository chat streaming for Cursor stream-json events that carry answer text in `message.completed`, terminal `result`, and related envelopes.

## Summary of changes

**Repository chat delta mapping** (`src/services/codex/index.ts`):
- Added helpers to treat `agent.message.delta` as incremental fragments and `agent.message.completed` as cumulative answer text.
- Added a raw-event fallback for `result` / `assistant` / `message.completed` when normalization yields no text (e.g. command-only events).
- Streaming loop tracks `streamedAnswerText` and emits only new suffixes so completed/result events do not duplicate earlier deltas.

**Cursor final text** (`src/services/agents/cursorProvider.ts`):
- Expanded text extraction (`output`, nested `content`/`response` arrays).
- `cursorAnswerTextFromEvents` prefers terminal `message.completed` / `result` text when it already includes prior delta fragments, so HTTP `completed` and streamed text stay aligned.

**Tests**:
- Backend: existing delta stream test kept; added tests for answer-only-in-`message.completed` and terminal `result`.
- Cursor CLI: added `runTextStream` NDJSON test for a realistic chat sequence.

## Files changed

- `src/services/codex/index.ts`
- `src/services/agents/cursorProvider.ts`
- `tests/backend.test.ts`
- `tests/cursor-cli.test.ts`

## Commands run

None — shell execution was unavailable in this session.

## Tests run and results

Not run here. Locally:

```bash
cd /Users/blakekellett/repos/codex-relay && npm test
```

Or filter the five tests listed in the subagent report (3 backend + 2 cursor-cli).

## Subagent usage

**none used** (subagent attempted to run tests but shell was also rejected).

## Remaining risks / follow-up

- Run `npm test` locally to confirm green.
- If Cursor adds new stream-json shapes, extend `repositoryChatAnswerTextFromRawProviderEvent` / `extractCursorEventText` with a captured NDJSON sample.
- Unusual event order (e.g. cumulative text before fragments) may still append with a newline; worth a manual Cursor repository-chat check after deploy.


No Codex run has been started.
