---
schemaVersion: 1
id: tkt_01ks50n4r0x89v6x6kcst8hxmc
title: Add the sidebar CLI selector modal and status wiring
ticketType: task
draftTargetType: null
status: completed
position: 2000
priority: high
effort: medium
labels:
  - renderer
  - sidebar
  - ux
parentEpicId: null
parentFeatureId: tkt_01ks4yxwpdrp66tcf70ydvzw6p
subticketIds: []
plannedFiles:
  - src/renderer/src/App.tsx
  - src/renderer/src/lib/relayApi.ts
  - src/renderer/src/lib/relayQueries.ts
  - src/renderer/src/styles.css
  - tests/project-sidebar.test.tsx
  - tests/ticket-draft-ui.test.tsx
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T10:17:47.520Z'
updatedAt: '2026-05-21T12:44:12.159Z'
authoringState: ready
summary: ''
codexThreadId: 019e4a34-7edb-79e0-bccd-199c7148b1bd
runStatus: completed
lastRunId: run_01ks538zdnwk242c7myd6bz2vj
lastRunStartedAt: '2026-05-21T11:03:34.669Z'
---
# Add the sidebar CLI selector modal and status wiring

## Context

Parent feature: Add switchable agent CLI selection and provider status modal

`ProjectSidebar`, `CodexSidebarStatus`, and `CodexCollapsedStatusIndicator` live in `src/renderer/src/App.tsx`, and existing sidebar tests already cover footer and collapsed rendering paths.

## Goal

Give users a provider selector modal in the left sidebar that consumes the new backend APIs.

## Requirements

- The expanded sidebar footer and collapsed floating status control must open the same provider selector modal.
- The modal must list Codex, Cursor, and Claude with status copy, version text when known, and `Use CLI` or `In use` actions.
- `Use CLI` must be disabled for providers that are not installed, unauthenticated, or `Installed, status unknown`, with visible explanatory text.
- The footer status label should reflect the selected provider rather than always saying Codex.
- The modal must support refresh, close, and Escape handling using the existing overlay shortcut pattern.

## Acceptance Criteria

- Sidebar tests can render the footer and modal trigger without regressing existing hide/add-project controls.
- The modal shows the correct disabled states and current-selection state for all three providers.
- The collapsed indicator opens the selector instead of silently refetching provider status.
- Renderer queries and mutations update the visible selected-provider state after a successful switch.

## Implementation Plan

- Add provider inventory query and switch mutation hooks to the renderer API layer.
- Update sidebar status components to read the selected provider summary and open a modal rather than directly refreshing.
- Render a modal dialog in `App.tsx` that lists provider rows, status copy, refresh, and switch actions.
- Add modal styling in `styles.css` consistent with existing `modal` and `modal-backdrop` patterns.
- Extend renderer tests for sidebar markup, modal labels, and disabled-action states.

## Assumptions

- The modal can reuse existing `Dialog` and `DialogBackdrop` primitives instead of introducing a new UI abstraction.

## Codex Handoff

### 5/21/2026, 12:13:08 PM

Summary of changes made
- Added renderer support for agent provider inventory and provider switching in [relayApi.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayApi.ts) and [relayQueries.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayQueries.ts), including query-cache sync after a successful switch.
- Updated the sidebar status UI in [App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx) so both the expanded footer and collapsed floating control open the same CLI selector modal, and the footer label now reflects the selected provider.
- Added the provider selector modal in [App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx) with refresh, close, Escape handling, provider rows for Codex/Cursor/Claude, version text, disabled-action explanations, and loading/error fallback states.
- Added modal/row styling in [styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css).
- Extended [project-sidebar.test.tsx](/Users/blakekellett/repos/codex-relay/tests/project-sidebar.test.tsx) and [ticket-draft-ui.test.tsx](/Users/blakekellett/repos/codex-relay/tests/ticket-draft-ui.test.tsx) to cover the new trigger markup, selected-provider labels, modal row states, and query-cache update behavior.

Files changed
- [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx)
- [src/renderer/src/lib/relayApi.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayApi.ts)
- [src/renderer/src/lib/relayQueries.ts](/Users/blakekellett/repos/codex-relay/src/renderer/src/lib/relayQueries.ts)
- [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css)
- [tests/project-sidebar.test.tsx](/Users/blakekellett/repos/codex-relay/tests/project-sidebar.test.tsx)
- [tests/ticket-draft-ui.test.tsx](/Users/blakekellett/repos/codex-relay/tests/ticket-draft-ui.test.tsx)

Commands run
- `npm test -- --test tests/project-sidebar.test.tsx tests/ticket-draft-ui.test.tsx`
- `node tests/run-tests.mjs --test tests/project-sidebar.test.tsx tests/ticket-draft-ui.test.tsx | rg -n "not ok|AssertionError|TypeError|ERR_TEST_FAILURE|Failed" -C 4`
- `node --input-type=module -e '...esbuild targeted test bundle for project-sidebar.test.tsx and ticket-draft-ui.test.tsx...'`

Tests run and their results
- Targeted bundled tests for `project-sidebar.test.tsx` and `ticket-draft-ui.test.tsx`: passed, `45/45`.
- Full repo test wrapper run: failed due an unrelated existing import-boundaries failure, `backend Node, Electron, and unstable Workflow imports stay behind approved service boundaries`, pointing at `src/services/registry/index.ts` outside this ticket’s file scope.

Subagent usage
- none used

Any remaining risks or follow-up work
- The scoped renderer/sidebar work is covered by targeted tests and stays within the planned file scope.
- The repo-wide test suite still has an unrelated failing import-boundaries check outside the allowed files, so I did not address it here.


No Codex run has been started.
