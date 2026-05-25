---
schemaVersion: 1
id: tkt_01ks6954jrqay0ng3wwmd1hdf6
title: Inject project context into all agent prompts
ticketType: task
draftTargetType: null
status: completed
position: 13000
priority: medium
effort: medium
labels:
  - agents
  - codex
parentEpicId: null
parentFeatureId: tkt_01ks67pttttnw8czrv9x240pj5
subticketIds: []
plannedFiles:
  - src/services/codex/index.ts
  - tests/project-context.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T22:05:34.680Z'
updatedAt: '2026-05-22T07:10:44.119Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::fd904a4c-8a71-4eda-993d-58a0c7b343b1'
runStatus: completed
lastRunId: run_01ks77j5ct9fg8cnsp2xxfxtet
lastRunStartedAt: '2026-05-22T07:00:12.550Z'
---
# Inject project context into all agent prompts

## Context

Parent feature: Inject project agent context from `.relay/context/` markdown

Delivers the user-visible behavior: agents consider project context on every run.

## Goal

All `AgentWorkKind` prompts include project context when `.relay/context/*.md` files exist.

## Requirements

- Add `resolveProjectContextPromptSection(projectPath)` in codex service calling project-context formatter.
- Extend `buildExecutionPrompt` and `buildExecutionInput` to await/load context once per run.
- Inject into `buildDraftIntakePrompt`, `createTicketDraftPromise` prompt, hierarchy draft prompt (~1870), `buildTicketUpdatePrompt`, `buildRepositoryChatPrompt`, and provider path `buildExecutionPrompt` at ~5210.
- Add test that `buildExecutionInput` text includes fixture context and excludes README.

## Acceptance Criteria

- Implementation prompt contains context file body when present.
- Draft intake prompt contains the same section for the same project.
- Empty context directory produces byte-identical prompt structure aside from any shared refactor.
- Provider implementation path and `buildExecutionInput` path both inject context.

## Implementation Plan

- Import formatter from `src/services/project-context/index.ts`.
- Add optional `projectContextSection` param to each prompt builder; call `await resolveProjectContextPromptSection(projectPath)` at each async call site before `provider.runStructured` / `runText`.
- Update both `buildExecutionInput` and direct `buildExecutionPrompt` usage in implementation runner.
- Add integration assertion in `tests/project-context.test.ts` or `tests/backend.test.ts` for prompt substring.

## Assumptions

- Single load per agent invocation is sufficient; no cross-run cache.

## Codex Handoff

### 5/22/2026, 8:02:02 AM

The user intends to
address a Relay ticket
concerning adding project
context to all agent
prompts.
I need to locate `createTicketDraftPromise`
and figure out how
to inject project context.
I need to examine the
createTicketDraftPromise
function to understand
how prompts are constructed.
Now I have a clear picture.
I need to:
Now I need to design
the helper functions:
1.
`resolveProjectContextPromptSection`
is an async helper
function that formats
the project context
prompt section.  
`appendProjectContextToPrompt`
injects the project
context block immediately
after the opening role
paragraph and before
ticket-specific content,
followed by the guidance
sentence: "Follow project
context unless this
ticket explicitly overrides
it."
const appendProjectContextSection
= (prompt: string,
projectContextSection:
string): string =>
{
  if (!projectContextSection)
return prompt;
  //
Insert after first
paragraph (first blank
line split or first
\n\n)
}

The buildExecutionPrompt
function processes
prompts by inserting
the project context
section after the first
line and before the
subagent guidance,
ensuring proper formatting
and placement within
the prompt structure.
The helper functions
`resolveProjectContextPromptSection`
and `appendProjectContextToPrompt`
format and insert the
project context section
into prompts, placing
it after the initial
role paragraph and
before ticket-specific
details, along with
a guidance note.

The
`buildExecutionPrompt`
function ensures the
project context section
is correctly inserted
after the first line
and before subagent
guidance, maintaining
proper prompt structure.
Other functions like
`buildDraftIntakePrompt`,
`buildRepositoryChatPrompt`,
`buildTicketUpdatePrompt`,
`createTicketDraftPromise`,
and `hierarchy draft`
also follow similar
patterns, inserting
content after their
respective initial
paragraphs.
buildExecutionInput
is loaded once and
passed to buildExecutionPrompt,
with provider path
loading it once before
the request and codex
path loading it internally.
resolveProjectContextPromptSection
should be exported
if tests require it,
otherwise tests can
use buildExecutionInput
directly. Empty context
results in byte-identical
prompts except for
refactoring.
So using an optional
parameter with an empty
string default prevents
additional newlines
when the context is
empty.

A helper function
formats the project
context injection by
trimming the section
and appending the guidance
note.
If the trimmed project
context section is
empty, the function
returns an empty string.
Otherwise, it appends
the guidance note and
two newlines to the
trimmed section. Each
builder uses this helper
to insert the formatted
context block after
the first paragraph,
ensuring no extra blank
lines are added when
the context is empty.
This maintains byte-identical
prompt structures when
there's no project
context, preserving
the original formatting.
Helpers should be
placed near `buildExecutionPrompt`
around line 3807. The
`hierarchy draft` requires
reviewing the full
prompt template to identify
the correct injection
point.  

For `createDraftIntake`,
`startTicketUpdateRunPromise`,
and `sendRepositoryChatMessage`,
await `resolve` before
calling their respective
prompt builders. For
`createHierarchyDraftPromise`
and `createTicketDraftPromise`,
await early in the
try block. For `startQueuedProviderRunNow`,
await once and use
the result in `buildExecutionPrompt`
at line 5210.
Input from the codex
SDK can be either a
string or an array.
For testing buildExecutionInput,
importing from codex
is necessary, though
it's a large bundle.
I'll add the test importing
buildExecutionInput
from codex.
I need a helper to
extract text from CodexRunInput.
I should check if buildDraftIntakePrompt
is exported, as it's
not mentioned in the
ticket but may be needed
for testing. The acceptance
criteria mentions that
draft intake prompt
contains the same section
for the same project,
but the test requirement
only covers buildExecutionInput.
I could export buildDraftIntakePrompt
for testing, though
it's outside the current
scope. The acceptance
criteria might be verified
manually or through
a smaller exported
helper.
The test requirement
specifically calls
for verifying that `buildExecutionInput`
text includes fixture
context and excludes
README, which is the
only test needed in
the planned scope.
For draft intake acceptance,
the implementation
should still inject
the necessary context,
but the test doesn't
need to cover all paths
per the ticket requirements.
I'll implement this
by adding the import
after other service
imports around line
120. I also need to
verify whether `resolveBackendPath`
affects the project
path in tests, since
`buildExecutionInput`
receives projectPath
and `createContextFixture`
uses absolute temporary
paths.
The implementation
in codex/index.ts needs
to ensure that `loadProjectContextDocuments`
correctly handles absolute
paths through `resolveProjectPath`.
Since project-context
tests already use `mkdtemp`
paths directly and
work correctly, this
approach is validated.
The `buildExecutionInput`
function does not call
`resolveBackendPath`
but relies on `resolveProjectContextPromptSection`
to process `projectPathInput`
through `formatProjectContextPromptSection`
`loadProjectContextDocuments`
`resolveProjectPath`.
This ensures proper
handling of project
paths throughout the
context building process.
I'll add the import
and helper functions
around line 3807, before
buildExecutionPrompt.
The function signature
will be updated to
include projectContextSection
as a parameter with
a default empty string
value.
When the project context
block is empty, it
should not add an extra
newline, ensuring the
prompt format remains
consistent whether
the block is present
or absent.
The template uses
`${projectContextBlock}`
which adds a newline
before "Follow the
ticket..." when the
block is non-empty,
maintaining consistent
formatting. When the
block is empty, it
preserves the original
format. The `buildExecutionInput`
function now properly
handles project context
blocks by including
them in the prompt
when present and omitting
them when empty, ensuring
consistent prompt structure
regardless of context
availability.
The implementation
now includes `projectContextSection`
resolution using `resolveProjectContextPromptSection`
before building the
execution prompt. This
ensures that the project
context is properly
included in both `startQueuedProviderRunNow`
and `createDraftIntake`
flows, maintaining
consistency in how project
context is handled
across different execution
paths. The `buildExecutionPrompt`
function is updated
to accept the `projectContextSection`
parameter, allowing
it to incorporate the
resolved project context
into the prompt structure.
The `buildDraftIntakePrompt`
function now accepts
a `projectContextSection`
parameter with a default
empty string value.
The `sendRepositoryChatMessage`
function resolves the
project context section
and passes it to `buildRepositoryChatPrompt`.
Similarly, `startTicketUpdateRunPromise`
resolves the project
context section before
using it. These changes
ensure consistent handling
of project context
across different execution
paths.
The prompt templates
for ticket updates
and drafts now include
a project context block,
which is formatted
using `formatProjectContextBlock`
and injected after
the first paragraph.
This applies to both
hierarchy and ticket
draft creation flows,
ensuring consistent
handling of project
context across different
execution paths.
Add the test to project-context.test.ts.
The shell is repeatedly
being rejected, so
tests will be documented
as something users
must run themselves.
Shell is completely
rejected. The summary
is provided, but note
that tests could not
be run in this environment.
Implementing project-context injection in the codex service per the ticket. Exploring the codebase and planned files.
Implementing project-context injection in the codex service and adding the test.
Project context from `.relay/context/*.md` is now wired into all six agent prompt paths in the codex service.

## Summary of changes

Added `resolveProjectContextPromptSection(projectPath)` in the codex service, delegating to `formatProjectContextPromptSection`. A shared `formatProjectContextBlock` helper inserts the context section immediately after each prompt’s opening role paragraph, plus guidance: *Follow project context unless this ticket explicitly overrides it.*

**Prompt builders** now accept an optional `projectContextSection` parameter (default `""` so empty context leaves prompt structure unchanged):

- `buildExecutionPrompt` / `buildExecutionInput` (Codex SDK path)
- `buildDraftIntakePrompt`
- `createTicketDraftPromise` (inline draft prompt)
- `createHierarchyDraftPromise` (hierarchy draft prompt ~1870)
- `buildTicketUpdatePrompt`
- `buildRepositoryChatPrompt`
- Provider implementation path in `startQueuedProviderRunNow` (~5246)

Each async call site loads context once per invocation with `await resolveProjectContextPromptSection(projectPath)` before `runStructured` / `runText`.

## Files changed

- `src/services/codex/index.ts`
- `tests/project-context.test.ts`

## Commands run

None — shell execution was unavailable in this environment.

## Tests run and results

Could not execute tests here. To verify locally:

```bash
node tests/run-project-context-test.mjs
```

Or the full suite:

```bash
npm test
```

The new test **`buildExecutionInput includes project context and excludes README`** checks that the implementation prompt contains fixture `conventions.md` content and does not include README text.

## Subagent usage

**none used**

## Remaining risks / follow-up

- Run `node tests/run-project-context-test.mjs` or `npm test` locally to confirm the new integration test passes with the codex bundle.
- Draft intake and other prompt paths are covered in code but only `buildExecutionInput` has an automated assertion in this ticket’s scope; broader prompt assertions could be added later if desired.


No Codex run has been started.
