---
schemaVersion: 1
id: tkt_01ks2mx176p8cw1r8t4rqgpmrj
title: >-
  Scope create-ticket composer to the kanban workspace instead of a viewport
  overlay
ticketType: task
status: completed
position: 5000
priority: medium
effort: medium
labels:
  - bug
  - renderer
  - create-ticket
  - layout
parentEpicId: null
subticketIds: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-20T12:13:54.278Z'
updatedAt: '2026-05-20T12:25:50.695Z'
authoringState: ready
codexThreadId: 019e4554-e41c-7452-9c41-5399039473c7
runStatus: completed
lastRunId: run_01ks2n9rmtvnjh5qkhqhckzhfv
lastRunStartedAt: '2026-05-20T12:20:51.647Z'
---
# Scope create-ticket composer to the kanban workspace instead of a viewport overlay

## Context

The create-ticket composer is currently mounted at the app-shell level and styled as a fixed viewport overlay, so it spans across the board and repository chat areas. The intended behavior is for the composer to live inside the main kanban workspace, resize with that workspace, and stop overlaying the repository chat panel.

## Goal

Render the create-ticket composer as part of the board workspace owned by `BoardView`, not as an app-shell-level viewport overlay.

## Decisions / Assumptions

- Keep the feature as a normal board-visible workflow whenever a board is loaded; the composer should remain part of the workspace rather than becoming a modal or repository-chat feature.
- Keep existing keyboard-shortcut gating unchanged unless the move forces a minor refactor; repository chat does not need new shortcut behavior in this task.
- It is acceptable for the small-screen full-screen repository chat panel to fully cover the workspace while open, as long as the composer is no longer an independent viewport overlay.
- This task should avoid coupling to the separate in-progress repository-chat close-path fix beyond any necessary merge-safe edits in `App.tsx` or `styles.css`.

## Requirements

- Render the create-ticket composer as part of the board workspace owned by `BoardView`, not as an app-shell-level viewport overlay.
- Size and position the composer relative to the kanban workspace so opening repository chat only reduces the available workspace width instead of being visually overlapped by the composer.
- Preserve existing ticket-drafting behavior: textarea autosize, mention menu, draft options, submit flow, and `composerRef`-based focus support.
- Keep validation focused on renderer layout and UI behavior; do not change backend draft generation, intake logic, or repository chat service behavior.
- Maintain current shortcut policy unless required by the move: focusing the composer via the existing ref path should still work in the non-chat board state.

## Acceptance Criteria

- With a board loaded, the create-ticket composer is rendered inside the main kanban workspace rather than as an app-shell sibling fixed to the viewport.
- On desktop, opening repository chat does not leave the composer spanning across or visually overlaying the repository chat column; the composer remains constrained to the board workspace width.
- On small screens, opening repository chat as a full-screen panel does not leave a separate viewport-fixed create-ticket composer overlaying the chat UI.
- The create-ticket composer still supports the existing drafting controls, textarea behavior, mention menu, submit button state, and board-level focus wiring.
- No backend draft-generation behavior changes are introduced; only renderer structure, layout styling, and related UI tests are updated.

## Test Plan

- Run `npm test` to cover `tests/ticket-draft-ui.test.tsx`, `tests/repository-chat-shell-state.test.ts`, and the rest of the renderer suite via the existing bundled test runner.
- Run `npm run typecheck` to verify the `BoardView` prop changes and composer wiring compile cleanly.
- Manually verify in the renderer that with a board open: the composer stays inside the workspace, narrows when repository chat opens on desktop, and is not shown as a viewport-wide overlay over the full-screen mobile chat panel.

## Implementation Notes

- Codebase finding: `src/renderer/src/App.tsx` renders `BoardView` at app-shell level, then separately renders `RepositoryChatPanel` and `FloatingTicketComposer` as siblings; the composer is currently mounted outside `BoardView` at lines 3528-3536.
- Codebase finding: `src/renderer/src/App.tsx` defines `BoardView` as the main kanban workspace (`<main className="workspace">`) with the board content inside the DnD area; this is the natural ownership point for board-scoped create-ticket UI.
- Codebase finding: `src/renderer/src/App.tsx` exports `FloatingTicketComposer` (around line 1557); its behavior is self-contained UI state plus draft submission, mention menu handling, and optional `composerRef` for shortcut focus.
- Codebase finding: `src/renderer/src/styles.css` styles `.floating-ticket-composer` as `position: fixed`, centered against the viewport (`left: 50%`, `transform: translateX(-50%)`, `width: min(760px, calc(100vw - 36px))`), which causes the overlap problem. The app shell also adds a third desktop column when chat is open via `.app-shell.chat-open`.
- Codebase finding: `src/renderer/src/styles.css` makes `.repository-chat-panel` a third desktop column and a fixed full-screen panel on small screens; tests currently cover shell state and composer markup in `tests/repository-chat-shell-state.test.ts` and `tests/ticket-draft-ui.test.tsx`. `SPEC.md` says ticket creation is part of the board workflow.
- Implementation: Update `src/renderer/src/App.tsx` so `BoardView` receives the composer inputs it needs (`projectPath`, default effort, `composerRef`, refresh callback, `setToast`) and render `FloatingTicketComposer` inside the workspace layout instead of as a sibling at the app-shell root.
- Implementation: Adjust the `BoardView` workspace markup to include a board-scoped composer region below or attached to the kanban area, while keeping the existing topbar, health notices, and DnD board behavior intact.
- Implementation: Refactor the composer layout styles in `src/renderer/src/styles.css` so the create-ticket surface is no longer `position: fixed` or viewport-centered; make it fill or align to the workspace width and add any needed workspace/board bottom spacing so board content is not obscured.
- Implementation: Update responsive CSS so the board-scoped composer behaves correctly both in normal desktop layout and when repository chat is open as a third column, and does not appear as a viewport-wide overlay when small-screen repository chat takes over the screen.
- Implementation: Update renderer tests to reflect the new ownership and layout contract: add coverage that the composer is rendered from the board workspace path and revise any markup assertions that currently encode the old floating-overlay behavior.
- `App.tsx` is an active integration point for board layout, repository chat, and shortcut focus; coordinate carefully with unrelated local changes, especially the in-progress repository-chat layout restoration work.
- If static markup tests currently assert the old `floating` presentation, update them to validate board-scoped rendering and absence of modal/viewport-overlay assumptions rather than preserving the old CSS contract.

## Codex Handoff

### 5/20/2026, 1:23:35 PM

Summary of changes made

Moved the create-ticket composer into `BoardView` so it now renders inside the kanban workspace instead of as an app-shell sibling overlay. The existing drafting behavior stayed intact because `projectPath`, `defaultEffort`, `composerRef`, refresh handling, and toast wiring are now passed through `BoardView` to the existing `FloatingTicketComposer`. I also changed the layout CSS so the composer sits in a dedicated workspace region and sizes against the board column width rather than the viewport.

I updated renderer UI coverage to assert the new ownership path: `BoardView` now renders the composer inside the workspace region, and the tests no longer rely on viewport-overlay assumptions for this flow.

Files changed

- [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx)
- [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css)
- [tests/ticket-draft-ui.test.tsx](/Users/blakekellett/repos/codex-relay/tests/ticket-draft-ui.test.tsx)

Commands run

- `rg -n "FloatingTicketComposer|function BoardView|const BoardView|<BoardView|repository-chat-panel|floating-ticket-composer" src/renderer/src/App.tsx src/renderer/src/styles.css tests`
- `git status --short`
- `sed -n '1169,1835p' src/renderer/src/App.tsx`
- `sed -n '3470,3555p' src/renderer/src/App.tsx`
- `sed -n '1528,1605p' src/renderer/src/styles.css`
- `sed -n '4170,4215p' src/renderer/src/styles.css`
- `sed -n '2128,2178p' src/renderer/src/styles.css`
- `sed -n '1,260p' tests/ticket-draft-ui.test.tsx`
- `sed -n '400,560p' tests/ticket-draft-ui.test.tsx`
- `sed -n '1,240p' tests/repository-chat-shell-state.test.ts`
- `rg -n "export \\{|export function BoardView|export .*BoardView|getRepositoryChatShellState|floatingComposerRef|useRef<HTMLTextAreaElement|ticket-draft-ui" src/renderer/src/App.tsx tests`
- `sed -n '1,220p' src/renderer/src/App.tsx`
- `sed -n '3380,3465p' src/renderer/src/App.tsx`
- `sed -n '240,340p' src/renderer/src/styles.css`
- `rg -n "\\.workspace\\b|\\.board\\b|topbar|health" src/renderer/src/styles.css`
- `sed -n '560,760p' src/renderer/src/styles.css`
- `sed -n '820,910p' src/renderer/src/styles.css`
- `sed -n '3928,4205p' src/renderer/src/styles.css`
- `sed -n '1798,1918p' src/renderer/src/App.tsx`
- `sed -n '1,120p' tests/run-tests.mjs`
- `npm test`
- `npm run typecheck`
- `nl -ba src/renderer/src/App.tsx | sed -n '3498,3518p'`
- `npm run typecheck`
- `git diff -- src/renderer/src/App.tsx src/renderer/src/styles.css tests/ticket-draft-ui.test.tsx`
- `git status --short src/renderer/src/App.tsx src/renderer/src/styles.css tests/ticket-draft-ui.test.tsx`

Tests run and their results

- `npm test`
  Result: passed. Test runner reported `188` tests, `184` passed, `0` failed, `4` skipped.
- `npm run typecheck`
  Result: passed after one nullability fix for `selectedPath` when passing `projectPath` into `BoardView`.

Subagent usage

- none used

Any remaining risks or follow-up work

Manual renderer verification is still outstanding. The automated coverage and typecheck are clean, but the desktop chat-open width behavior and the small-screen full-screen chat coverage should still be visually checked in the renderer to confirm the composer now narrows with the workspace and is fully covered by mobile chat.


No Codex run has been started.
