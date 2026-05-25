# Agent Worktree Workflow

Relay worker agents must follow this workflow for implementation work.

## Isolation

- Never edit the user's current working tree directly for ticket implementation work.
- Every implementation ticket or feature gets its own isolated Git worktree.
- Use one ticket or feature per worktree.
- Chat and repository Q&A stay read-only and must not modify files.

## Naming

- Prefer worktree names like `../repo-MYT-123`.
- Prefer branch names like `agent/MYT-123-short-description`.
- Keep branch names short, readable, and tied to the ticket being worked.

## Change scope

- Make the smallest safe change that solves the ticket.
- Do not refactor unrelated code.
- Do not broaden the planned file scope unless the user approves or Relay raises clarification.
- Do not merge into the user's current branch automatically.
- Do not resolve merge conflicts silently.

## End of task

Before leaving a task ready for review, the worker should:

1. Run the relevant tests for the change.
2. Produce a review summary with:
   - files changed
   - reason for changes
   - tests run
   - known risks
   - follow-up work
3. Leave the ticket in review-ready state.

## Merge queue

- Merge queue work must happen serially, one item at a time.
- Before merge, the merge agent should update against the latest base branch, run tests, and stop on conflicts.
- If conflicts happen, write a conflict report and raise clarification instead of guessing.
- Only after explicit human approval may a conflict resolution be applied.
