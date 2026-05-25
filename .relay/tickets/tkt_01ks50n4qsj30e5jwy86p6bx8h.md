---
schemaVersion: 1
id: tkt_01ks50n4qsj30e5jwy86p6bx8h
title: Add provider selection persistence and switchability APIs
ticketType: task
draftTargetType: null
status: archive
position: 1000
priority: high
effort: medium
labels:
  - backend
  - agent-providers
  - api
parentEpicId: null
parentFeatureId: tkt_01ks4yxwpdrp66tcf70ydvzw6p
subticketIds: []
plannedFiles:
  - src/http/resources/agents.ts
  - src/http/resources/index.ts
  - src/services/registry/index.ts
  - src/shared/http/agents.ts
  - src/shared/http/index.ts
  - src/shared/schemas/agents.ts
  - src/shared/schemas/index.ts
  - src/shared/schemas/registry.ts
  - tests/backend.test.ts
  - tests/schemas.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T10:17:47.513Z'
updatedAt: '2026-05-25T14:36:44.339Z'
authoringState: ready
summary: >-
  Shipped shared provider schemas plus GET/POST provider APIs with
  registry-backed global selection (legacy default codex). Switching is blocked
  when the target is unusable or any registered project has active work-ledger
  snapshots.
codexThreadId: 019e4a2a-8f3b-7c20-89e6-f0b94ab1fe81
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add provider selection persistence and switchability APIs

## Requirements

- Shared schema for codex, cursor, and claude with install/auth state and selected provider id
- Registry persists global selected provider across restarts; existing installs default to codex
- Additive HTTP endpoints to read provider inventory/selection and switch providers
- Block switch when target is unavailable, unauthenticated, status unknown, or incomplete work-ledger snapshots exist in any registered project
- Busy guard uses work-ledger snapshots, not sidebar counts; blocks on created, queued, running, cancelling, and stale

## Acceptance Criteria

- Read returns three providers, selected id, and switchability metadata
- Allowed switch persists selection; blocked switch is deterministic and leaves registry unchanged
- Schema tests cover migration when selected provider field is absent
