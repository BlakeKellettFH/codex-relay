---
schemaVersion: 1
id: tkt_01ks4yxwpdrp66tcf70ydvzw6p
title: Add switchable agent CLI selection and provider status modal
ticketType: feature
draftTargetType: null
status: archive
position: 5000
priority: high
effort: high
labels:
  - feature
  - agent-providers
  - cli-selection
  - sidebar
parentEpicId: null
parentFeatureId: null
subticketIds:
  - tkt_01ks50n4qsj30e5jwy86p6bx8h
  - tkt_01ks50n4r0x89v6x6kcst8hxmc
  - tkt_01ks50n4r5tv1xasdev3zht9gv
  - tkt_01ks50n4rdvpfn43ch3mfjzchf
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T09:47:37.037Z'
updatedAt: '2026-05-25T14:36:44.349Z'
authoringState: ready
summary: >-
  Relay lets users pick Codex, Cursor, or Claude from a sidebar modal with
  install/auth status, persists the choice in app-local registry, and routes new
  agent work through the selected CLI while in-flight work keeps its original
  provider.
codexThreadId: null
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add switchable agent CLI selection and provider status modal

## Context

Relay previously hardcoded Codex for sidebar status and all agent-backed work. Users can now inspect Codex, Cursor, and Claude CLI state, switch the active CLI for future work, and keep that choice in local app registry—not shared `.relay` project files.

## Requirements

- Sidebar CLI selector modal lists Codex, Cursor, and Claude with install/auth state, version when known, and current selection.
- Persist selected CLI in app-local registry (default Codex); do not write selection into `.relay/project.json` or tickets.
- Route new draft intake, draft/redraft, ticket update, repository chat, and implementation runs through the selected provider.
- In-flight or queued work keeps its stored provider id after a switch.
- Disable `Use CLI` when not installed, unauthenticated, or auth is `status unknown`.
- Reject provider changes while any registered project has active work-ledger processing; leave selection unchanged.

## Acceptance Criteria

- Status control opens a modal with three provider rows, correct disabled/enabled `Use CLI` states, and current-selection UI.
- Selection lives in registry only; project files stay unchanged on switch.
- Busy switch attempts fail with a clear message; prior selection remains.
- New agent actions use the new provider; existing queued/running work does not.
- Codex flows and normalized run progress/summaries still work for all supported providers.

## Delivered

- Additive provider inventory and switch APIs with registry-backed global selection and work-ledger busy guard.
- Shared sidebar modal and provider-aware footer/collapsed status wiring.
- Codex, Cursor, and Claude adapters for draft, redraft, update, chat, and implementation runs with per-work provider stamping.
- Implementation dispatch and recovery by stored provider id; provider stream-json normalized into existing run events and UI.
