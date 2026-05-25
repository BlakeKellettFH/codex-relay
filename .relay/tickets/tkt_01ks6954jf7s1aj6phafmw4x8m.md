---
schemaVersion: 1
id: tkt_01ks6954jf7s1aj6phafmw4x8m
title: Implement project context loader and prompt formatter
ticketType: task
draftTargetType: null
status: completed
position: 12000
priority: medium
effort: medium
labels:
  - agents
parentEpicId: null
parentFeatureId: tkt_01ks67pttttnw8czrv9x240pj5
subticketIds: []
plannedFiles:
  - src/services/project-context/index.ts
  - tests/project-context.test.ts
  - tests/run-tests.mjs
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T22:05:34.671Z'
updatedAt: '2026-05-22T07:10:41.113Z'
authoringState: ready
summary: ''
codexThreadId: 'cursor::434bfb29-07a5-4522-8f3c-4060145562d7'
runStatus: completed
lastRunId: run_01ks77j57ryn27k2a2b9gvx891
lastRunStartedAt: '2026-05-22T06:58:10.139Z'
---
# Implement project context loader and prompt formatter

## Context

Parent feature: Inject project agent context from `.relay/context/` markdown

Centralizes filesystem reads and formatting before codex prompt wiring.

## Goal

Expose `formatProjectContextPromptSection(projectPath)` for prompt injection.

## Requirements

- Create `src/services/project-context/index.ts` exporting load + format functions using Effect `FileSystem` / `readDirectory` pattern from `readTickets`.
- Return empty string when directory missing or no injectable `.md` files.
- Format as `Project context (from .relay/context/):` followed by `## filename` sections.
- Apply per-file and total character budgets with truncation suffix.
- Add `tests/project-context.test.ts` and register in `tests/run-tests.mjs`.

## Acceptance Criteria

- Loader returns sorted documents for multiple `.md` files.
- README and non-`.md` entries are ignored.
- Oversized fixture content is truncated and total budget enforced.
- Tests pass in CI/local `run-tests.mjs`.

## Implementation Plan

- Implement `loadProjectContextDocuments` and `formatProjectContextPromptSection` in `src/services/project-context/index.ts`.
- Reuse `slashPath` / path join via `backendPath()` and `contextPath`.
- Add focused unit tests with `mkdtemp` project fixtures.
- Register test file in `tests/run-tests.mjs` entryPoints.

## Assumptions

- Read errors on individual files log a warning and skip that file without failing the run.

## Codex Handoff

### 5/22/2026, 8:00:12 AM

The user requests implementation
of a project context
loader and prompt formatter
based on a provided
ticket.
The user wants a project
context loader that
reads Markdown files
from a `.relay/context/`
directory and formats
them into a prompt
section, handling missing
directories and file
limits with truncation.
I will read the storage-stores.test
file.
I have sufficient context
to proceed with implementation.
Constants defined:
PER_FILE_MAX_CHARS
at 16,384 characters
and TOTAL_MAX_CHARS
at 32,768 characters.
README.md is excluded
with exact case matching,
and truncation uses
ellipsis after whitespace
trimming. The ProjectContextDocument
type includes filename
and content fields.
The loadProjectContextDocuments
function begins with
backendPath(), resolves
the project path, and
sets the context directory.
Check if the directory
exists; if not, return
an empty array. Read
the directory, filter
out .md files while
skipping README.md,
and sort them lexicographically.
For each file, check
if it's a file, read
its content, and log
warnings while skipping
on errors. Apply per-file
truncation when storing
content and return
the sorted documents.
Format the project
context prompt section
by loading documents,
returning an empty
string if none exist,
and building sections
with `## filename`.
Apply the total budget
across the formatted
output, where the combined
injected content should
respect the 32 KiB
limit.
The document body
content is what gets
truncated under the
total budget, not including
headers or section
markers. The total budget
applies to the combined
injected content, which
includes only the markdown
file contents.
Apply per-file character
limits to each file's
content before formatting
into sections. Use
a total character budget
on the combined content,
truncating the last
file's content if needed
when formatting.

The
implementation plan
formats the project
context prompt section
by loading documents,
returning an empty
string if none exist,
and building sections
with `## filename`.
It applies the total
budget across the formatted
output, where the combined
injected content respects
the 32 KiB limit. The
document body content
is truncated under
the total budget, excluding
headers or section
markers.
The total character
budget is applied when
assembling the formatted
output, not during
file reading. Per-file
truncation occurs in
the loader, while the
formatter handles the
total budget across
all content. Whitespace
normalization follows
the same logic as truncatePromptText.
I will implement similar
local helpers in the
project-context module
to avoid importing
from codex.

README
files are skipped with
case-sensitive matching.
Only top-level `.md`
files are included
in the context directory.
For missing directories,
a check using `fs.exists`
or error handling on
`readDirectory` should
be used, returning
an empty array if the
directory does not
exist.
If the directory does
not exist, return an
empty array. For readDirectory
errors, return an empty
array or log a warning;
individual file read
errors should log a
warning and skip the
file. Export constants
for testing purposes
to verify truncation
behavior with known
sizes.

The test plan
includes verifying
that the loader returns
sorted documents for
multiple .md files,
ignores README and
non-.md files, enforces
per-file and total
character limits, and
returns an empty result
when no valid files
or directory exist.
Files will be written
under .relay/context/
in a temporary directory
for testing.
Use `path.resolve`
from backend Path for
`resolveProjectPath`,
which takes `(path,
projectPath)` as arguments.
For the `## filename`
section header, use
the entry name directly,
such as `coding-rules.md`,
without including the
full path. Export the
defined types and functions.
CONTEXT_README_FILENAME
could duplicate "README.md"
locally to avoid importing
from filesystem.

Truncate
implementation uses
whitespace normalization
and ellipsis formatting
for text longer than
the maximum length.
Normalizing whitespace
in markdown files maytruncatePromptText
I will execute the tests
and resolve any issues
that arise.
Shell is completely
rejected. I will recheck
the lints and thoroughly
review the test logic.
I may need to address
the FileSystem.File.Info
type issue and review
the total budget test
logic. The test appears
to have issues with
character truncation
and budget calculation.
First.md is truncated
to 16384 characters
ending with ..., while
second.md is truncated
per-file to 16384 characters
but when formatting,
the totalContentChars
starts at 0. The first
document has content
of 16384 characters,
making the total 16384.
For the second document,
remaining space is
32768 - 16384 = 16384,
so it fits entirely
even though it was
truncated to 16384 characters
with .... This means
both first and second
documents would fit,
and potentially third
might also partially
fit. I'll recalculate
the test fixture accordingly.
First.md is truncated
to 16384 characters,
and second.md is also
truncated to 16384
characters, fitting
exactly into the budget
with no room for third.
The test verifies injectedContent
by stripping headers,
using a section format
that includes content
from both files.
Shell keeps getting
rejected. The summary
was provided, but tests
couldn't be run due
to environment issues.
Let me re-read the
implementation for
correctness. One potential
issue is with the total
budget in formatProjectContextPromptSection:
the `second.md` file
has 32768 characters,
which after per-file
truncation becomes
16384, matching the
exact total budget when
combined with `first.md`
(also 16384). This
seems correct.

However,
the third file should
not appear, which is
also correct. For the
injected content length
check in the test,
the regex replace may
not handle multiline
content properly. Let
me trace the section
structure:

Project
context (from .relay/context/):
## first.md

{16384
chars}

## second.md
{16384 chars}
The regex replacements
remove headers but
leave extra newlines
between sections, causing
the injected content
to exceed the 32768
character limit and
potentially failing
the test.
The test should count
only the document content
from loadProjectContextDocuments
and formatter logic,
excluding markup overhead.
The formatter tracks
totalContentChars based
on document content
only, not section separators,
so injected character
count includes `\n\n`
between sections. The
ticket refers to "total
max 32 KiB injected
characters" as content,
not markup overhead.
The test's regex approach
is fragile, so it should
be rewritten to directly
load documents and
compute expected content
instead. A simpler
fix involves loading
documents and summing
their content lengths
to verify formatting
produces the correct
output.
Implementing the project context loader per the ticket. Exploring existing patterns in the codebase.
Implementing the project-context service and tests using the established patterns and budget constants from the parent feature ticket.
Fixing a fragile assertion in the total-budget test that could fail due to section separators.
## Summary

Implemented the project context loader and prompt formatter in `src/services/project-context/index.ts`:

- **`loadProjectContextDocuments(projectPath)`** — Reads top-level `.relay/context/*.md` via Effect `FileSystem` (same `readDirectory` / `stat` / `readFileString` pattern as `readTickets`). Returns `[]` when the directory is missing or has no injectable files. Skips `README.md` and non-`.md` entries. Sorts filenames lexicographically. Per-file read failures log a warning and skip that file.
- **`formatProjectContextPromptSection(projectPath)`** — Returns `''` when there are no documents; otherwise builds `Project context (from .relay/context/):` plus `## filename` sections. Applies 16 KiB per-file and 32 KiB total content budgets with `...` truncation (aligned with `truncatePromptText`).

Exported budget constants for tests and downstream wiring.

## Files changed

| File | Change |
|------|--------|
| `src/services/project-context/index.ts` | **Created** — loader + formatter |
| `tests/project-context.test.ts` | **Created** — sorting, README/non-md skip, truncation, empty cases |
| `tests/run-tests.mjs` | Registered `project-context.test.ts` in `entryPoints` |

## Commands run

Shell execution was blocked in this session (including the test subagent). No tests were executed here.

**Please run locally:**

```bash
node tests/run-tests.mjs
```

Or only the new tests after the bundle step in `run-tests.mjs`.

## Tests run and results

**Not run** in this environment. Expected coverage (3 tests):

1. Sorted injectable `.md` files; `README.md` and `.txt` ignored  
2. Empty string when context dir missing or only README  
3. Per-file truncation (16 KiB) and total budget (32 KiB); third file omitted  

## Subagent usage

**none used** (test-runner subagent could not execute shell; no code changes from it integrated). A stray `tests/run-project-context-test.mjs` may have been created by that attempt — delete it if present; it is outside ticket scope.

## Remaining risks / follow-up

- **Codex wiring** is a separate ticket (`tkt_01ks6954jrqay0ng3wwmd1hdf6`) — call `formatProjectContextPromptSection` from prompt builders.
- **Whitespace normalization** collapses newlines (same as `truncatePromptText`); may flatten markdown structure in large context files.
- **Verify tests locally** with `node tests/run-tests.mjs` before marking the ticket complete.


No Codex run has been started.
