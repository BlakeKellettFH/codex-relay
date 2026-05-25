---
schemaVersion: 1
id: tkt_01ks50n4r0x89v6x6kcst8hxmc
title: Add the sidebar CLI selector modal and status wiring
ticketType: task
draftTargetType: null
status: archive
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
updatedAt: '2026-05-25T14:36:44.341Z'
authoringState: ready
summary: >-
  Shipped a shared sidebar CLI selector modal for Codex, Cursor, and Claude with
  provider-aware footer labeling, disabled switch rules, and renderer
  inventory/switch wiring.
codexThreadId: 019e4a34-7edb-79e0-bccd-199c7148b1bd
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add the sidebar CLI selector modal and status wiring

## Requirements

- Expanded sidebar footer and collapsed status control open the same provider selector modal.
- Modal lists Codex, Cursor, and Claude with status copy, version when known, and `Use CLI` or `In use` actions.
- `Use CLI` is disabled for providers that are not installed, unauthenticated, or `Installed, status unknown`, with explanatory text.
- Footer status label reflects the selected provider, not always Codex.
- Modal supports refresh, close, and Escape via the existing overlay shortcut pattern.

## Acceptance Criteria

- Sidebar tests render footer and modal trigger without regressing hide/add-project controls.
- Modal shows correct disabled states and current-selection state for all three providers.
- Collapsed indicator opens the selector instead of silently refetching provider status.
- Renderer queries and mutations update visible selected-provider state after a successful switch.

## Delivered

- Provider inventory query and switch mutation in `relayApi.ts` / `relayQueries.ts` with cache sync after switch.
- Shared selector modal and selected-provider labels in `App.tsx` for expanded and collapsed sidebar paths.
- Modal row styling in `styles.css`; coverage in `project-sidebar.test.tsx` and `ticket-draft-ui.test.tsx` (45 targeted tests passed).
