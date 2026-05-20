---
schemaVersion: 1
id: tkt_01ks2mr9r8maad9snt5vwt7p9f
title: Fix repository chat close path so the renderer layout fully restores
ticketType: task
status: completed
position: 4000
priority: high
effort: medium
labels:
  - bug
  - renderer
  - repository-chat
parentEpicId: null
subticketIds: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-20T12:11:19.176Z'
updatedAt: '2026-05-20T12:25:46.201Z'
authoringState: ready
codexThreadId: 019e454e-928c-7ae1-b7a5-73a924cc3813
runStatus: completed
lastRunId: run_01ks2mx4d0c5k4150bxwz0fxgj
lastRunStartedAt: '2026-05-20T12:13:57.620Z'
---
# Fix repository chat close path so the renderer layout fully restores

## Context

Users can open the repository chat panel, but closing it leaves the renderer shell in a broken layout state instead of returning to the normal board view. This should be treated as a renderer-only bug in the repository chat shell and layout restoration path.

## Goal

Closing repository chat from any existing close path (topbar toggle, panel close button, or Escape) must fully dismiss the panel and remove any chat-open shell/layout state immediately.

## Decisions / Assumptions

- This bug is renderer-only; no backend repository chat API or thread behavior changes are needed.
- Closing repository chat should keep current semantics of unmounting the panel and resetting its local draft/message state when reopened, since the panel is already conditionally mounted by `repositoryChatOpen`.
- If the current test setup cannot drive a full DOM click flow, it is acceptable to extract and test the shell open/close state computation in a focused renderer helper as long as the regression explicitly covers open -> close restoration.

## Requirements

- Closing repository chat from any existing close path (topbar toggle, panel close button, or Escape) must fully dismiss the panel and remove any chat-open shell/layout state immediately.
- After close, the app shell must return to its pre-chat board layout with no leftover grid sizing, fullscreen overlay behavior, hidden status rail, or inaccessible controls on desktop or mobile-responsive widths.
- Add a focused renderer regression test for open -> close that proves the chat panel is no longer rendered and the shell/layout state returns to its non-chat baseline.

## Acceptance Criteria

- When repository chat is closed, `.app-shell` no longer carries the chat-open layout state and `RepositoryChatPanel` is no longer rendered.
- The board shell visually and interactively returns to the same layout it had before chat opened, including restored sizing and visible status rail/controls.
- A renderer regression test fails on the broken behavior and passes once the close/unmount restoration is fixed.

## Test Plan

- Run `npm test` to execute the bundled renderer/unit suite including the new repository chat regression test.
- Run `npm run typecheck` to verify the App/state refactor and any new exported test helper types compile cleanly.
- Manually validate in the Electron renderer at a desktop width and a sub-700px responsive width: open repository chat, close it, and confirm the board, status rail, and controls return to the pre-chat layout immediately.

## Implementation Notes

- Codebase finding: `RelayApp` owns `repositoryChatOpen` and applies the `chat-open` class to `.app-shell`; the chat panel is only mounted when `board && selectedPath && repositoryChatOpen` is truthy. Relevant close/open state is in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3276) and shell rendering at [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3434).
- Codebase finding: `BoardView` toggles chat from the topbar button, while `RepositoryChatPanelContent` closes it from the panel header button and `RepositoryChatPanel` also closes on Escape via `useShortcutOverlay`. Relevant symbols: `BoardView`, `RepositoryChatPanelContent`, `RepositoryChatPanel` in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:1142), [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:1349), and [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:1467).
- Codebase finding: The layout change is CSS-driven: `.app-shell.chat-open` adds a third grid column and hides `.status-rail`; `.repository-chat-panel` also switches to a fixed fullscreen overlay under the mobile breakpoint. Relevant CSS is in [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:269), [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:309), [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:2138), and [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:3999).
- Implementation: Refactor the renderer chat shell state in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3264) so open and close use explicit handlers instead of relying on independent toggle behavior, and make all existing close entry points route through the same close path that clears `repositoryChatOpen`.
- Implementation: Update the repository chat layout rules in [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:269) and the mobile override at [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:3999) so chat-only sizing/overlay/hidden-rail behavior is scoped strictly to the open state and does not persist after the panel unmounts.
- Implementation: Add a new renderer regression test file and register it in [tests/run-tests.mjs](/Users/blakekellett/repos/codex-relay/tests/run-tests.mjs:9); test the shell state before open, after open, and after close using the same exported renderer component/helper the fix introduces, rather than leaving this behavior untested.
- The current suite has no established jsdom/testing-library harness in `package.json`; prefer matching the repo's existing `node:test` + bundled renderer test pattern unless adding a minimal helper is clearly cheaper than introducing a new DOM stack.
- Because this is a quick bug ticket, keep the fix scoped to repository chat shell state and CSS restoration; do not expand into broader sidebar/detail layout refactors.

## Codex Handoff

### 5/20/2026, 1:16:25 PM

**Summary**
I fixed the renderer repository-chat close path by centralizing shell state in `RelayApp` and routing all close behavior through one explicit `closeRepositoryChat` handler. The `.app-shell` `chat-open` class and `RepositoryChatPanel` mount now both derive from the same exported helper, so open -> close immediately restores the non-chat shell baseline instead of leaving layout state behind.

I also added explicit CSS baseline restoration for the status rail/layout when chat is not active, and added a focused renderer regression test for baseline -> open -> close using the shared shell-state helper.

**Files changed**
- [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx)
- [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css)
- [tests/repository-chat-shell-state.test.ts](/Users/blakekellett/repos/codex-relay/tests/repository-chat-shell-state.test.ts)
- [tests/run-tests.mjs](/Users/blakekellett/repos/codex-relay/tests/run-tests.mjs)

**Commands run**
- `rg -n "repositoryChatOpen|RepositoryChatPanel|BoardView|chat-open|run-tests" src/renderer/src/App.tsx src/renderer/src/styles.css tests/run-tests.mjs`
- `sed -n '…p' src/renderer/src/App.tsx`
- `sed -n '…p' src/renderer/src/styles.css`
- `sed -n '1,220p' tests/run-tests.mjs`
- `sed -n '1,240p' tests/project-sidebar.test.tsx`
- `npm test`
- `npm run typecheck`
- `git status --short`
- `git diff -- src/renderer/src/App.tsx src/renderer/src/styles.css tests/repository-chat-shell-state.test.ts tests/run-tests.mjs`

**Tests run**
- `npm test`
  Result: passed, `187` tests passed, `0` failed, `4` skipped.
- `npm run typecheck`
  Result: passed.

**Subagent usage**
- none used

**Remaining risks / follow-up**
- Manual Electron validation at desktop width and sub-700px width is still pending; I did not run the renderer interactively here.
- The regression is helper-based rather than a full DOM click-flow test, which matches the repo’s current renderer test pattern and covers the open -> close state restoration explicitly.


No Codex run has been started.
