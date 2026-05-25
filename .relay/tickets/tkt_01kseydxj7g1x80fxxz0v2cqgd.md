---
schemaVersion: 1
id: tkt_01kseydxj7g1x80fxxz0v2cqgd
title: Smooth repository chat typing and reduce autosave churn
ticketType: feature
draftTargetType: null
status: todo
position: 5000
priority: medium
effort: medium
labels:
  - repository-chat
  - ui
  - performance
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01kseykcvg0q9r33s8c5p1hd0r
  - tkt_01kseykcvyew4q55y9j3a81f97
  - tkt_01kseykcwatewypzka1gjrcye5
  - tkt_01kseykcwmdtw8py5p4e42rzfw
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-25T06:51:17.959Z'
updatedAt: '2026-05-25T06:54:17.493Z'
authoringState: reviewing
summary: >-
  Repository chat should feel responsive while typing: fewer debounced PUTs and
  log noise, and the assistant transcript should not re-render on every
  keystroke. Autosave to `.relay/repository-chat.json` stays, with longer
  debounce and explicit flush on close/send/clear.

  - Longer debounced persist plus flush on panel close and send/clear

  - Memoized transcript vs composer so draft updates stay local

  - Safer first-load hydration when typing starts before GET completes

  Validate with focused renderer tests and manual typing in a project with a
  long assistant answer.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01kseydxhnss0jwe5fvvdsgrpw
lastRunStartedAt: null
---
# Smooth repository chat typing and reduce autosave churn

## Context

User reported chat typing causes visible panel rerenders and frequent INFO logs for PUT /api/projects/repository-chat. Intake confirmed autosave and panel-local rerenders are mostly by design; goal is smoother UX without removing persistence. Related streaming UX work (tkt_01ks7dand93t0q183ks5eja51x) is completed and separate.

## Goal

Keep autosave to .relay/repository-chat.json; do not remove PUT persistence.

## Decisions / Assumptions

- 1800ms debounce is acceptable default within the 1500-2000ms range from intake.
- React.memo on a new transcript subcomponent is acceptable; no project-wide memo convention exists yet.
- Autosave PUT logging can move to debug or be omitted at INFO without a user-facing log-level setting.

## Requirements

- Keep autosave to .relay/repository-chat.json; do not remove PUT persistence.
- Increase typing debounce to ~1500-2000ms and flush pending state on panel close, send, and clear so drafts are not lost.
- Typing in the composer must not re-render the assistant transcript/MarkdownBlock list when messages are unchanged.
- Fix pre-hydration race so typing before GET /api/projects/repository-chat completes does not permanently skip server draft restore.
- Reduce dev log noise from autosave without hiding other API request logging.
- No board refetch or RelayApp-wide rerender regression while typing in repository chat.

## Acceptance Criteria

- During continuous typing, PUT /api/projects/repository-chat fires at most about once per 1.5-2s idle window, plus one flush on close/send/clear.
- Assistant transcript does not visibly flicker or re-scroll on each draft keystroke when messages are unchanged.
- Opening chat after typing before initial load still restores persisted draft from server when local state was empty.
- Closing chat without waiting for debounce still persists the latest draft/messages.
- Board and ticket views do not refetch or rerender due to repository chat autosave.
- Dev console no longer spams INFO lines for each autosave PUT.

## Test Plan

- Add tests/repository-chat-persist.test.ts for signature equality and flush scheduling behavior.
- Add tests/repository-chat-hydration.test.ts (or renderer test) asserting server draft applies when user typed before query success.
- Extend tests/ticket-draft-ui.test.tsx to confirm RepositoryChatPanelContent still renders transcript/composer markup.
- Add request-logging test asserting repository-chat PUT is not logged at INFO.
- Run node tests/run-tests.mjs and manually type in repository chat with a long assistant answer; confirm smoother textarea and fewer PUT/log lines.

## Implementation Notes

- Codebase finding: src/renderer/src/App.tsx:309 defines REPOSITORY_CHAT_PERSIST_DEBOUNCE_MS = 400; persist useEffect (2731-2750) debounces saveRepositoryChatMutation.mutate to PUT /api/projects/repository-chat.
- Codebase finding: useSaveRepositoryChatMutation (src/renderer/src/lib/relayQueries.ts:502-505) has no onSuccess cache invalidation; board refetch is not the cause of typing churn.
- Codebase finding: RepositoryChatPanelContent (App.tsx:2348-2609) renders transcript MarkdownBlock list and draft Textarea in one function; draft prop changes re-render all assistant MarkdownBlock instances.
- Codebase finding: MarkdownBlock (src/renderer/src/components/MarkdownBlock.tsx:439) is not memoized; parseMarkdownBlocks runs on each parent render.
- Codebase finding: Hydration useEffect (App.tsx:2702-2729) depends on draft/messages/threadId; line 2705 skips server hydration when draft.trim() before query success, risking lost persisted draft on fast typing.
- Codebase finding: Panel unmount on closeRepositoryChat (App.tsx:6054-6065) clears debounce timeout but does not flush pending signature; closing chat can drop last unsaved draft.
- Implementation: Extract repository chat persist helpers (signature, debounce constant, flush via refs) from RepositoryChatPanel into a small renderer module; raise debounce to 1800ms.
- Implementation: Wire flush on panel unmount, submit (after clearing draft), clearChat, and wrapped onClose before parent hides the panel.
- Implementation: Hold saveRepositoryChat mutate in a ref so persist effect deps do not churn on mutation status transitions.
- Implementation: Split RepositoryChatPanelContent into memoized transcript and composer subtrees; transcript props exclude draft.
- Implementation: Refactor hydration into a one-shot effect on query success/projectPath with a userEditedBeforeHydrationRef guard instead of draft-in-deps skip logic.
- Implementation: Downgrade or skip INFO logging for PUT /api/projects/repository-chat in requestLoggingMiddleware.
- RepositoryChatPanel is conditionally mounted in RelayApp (App.tsx:6054-6065); unmount cleanup is the right flush hook when panel closes.
- saveRepositoryChatMutation status is not used in JSX today, but mutation object identity in effect deps may still cause extra effect runs—stabilize with refs.
- Completed feature tkt_01ks7dand93t0q183ks5eja51x covers streaming/thinking only; do not regress streaming handlers in RepositoryChatPanel.

## Codex Handoff

No Codex run has been started.
