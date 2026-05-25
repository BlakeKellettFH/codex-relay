---
schemaVersion: 1
id: tkt_01ks50n4r5tv1xasdev3zht9gv
title: 'Add Codex, Cursor, and Claude provider adapters for non-implementation actions'
ticketType: task
draftTargetType: null
status: archive
position: 3000
priority: high
effort: medium
labels:
  - backend
  - routing
  - providers
parentEpicId: null
parentFeatureId: tkt_01ks4yxwpdrp66tcf70ydvzw6p
subticketIds: []
plannedFiles:
  - src/services/agents/claudeProvider.ts
  - src/services/agents/codexProvider.ts
  - src/services/agents/cursorProvider.ts
  - src/services/agents/index.ts
  - src/services/agents/providers.ts
  - src/services/codex/index.ts
  - tests/backend.test.ts
  - tests/ticket-draft.test.ts
  - tests/ticket-update.test.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T10:17:47.525Z'
updatedAt: '2026-05-25T14:36:44.344Z'
authoringState: ready
summary: >-
  Shipped Codex, Cursor, and Claude provider adapters and routed draft, redraft,
  update, and repository-chat through the selected provider at work creation,
  persisting provider id per submission without regressing Codex.
codexThreadId: 019e4a3d-3f99-7833-a512-5591eb45797c
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add Codex, Cursor, and Claude provider adapters for non-implementation actions

## Requirements

- Provider adapters for Codex, Cursor, and Claude return final JSON/text and a resumable session reference.
- Cursor and Claude use documented print/json or stream-json modes; surface `status unknown` when headless auth cannot be verified.
- Route draft intake, draft/redraft, ticket update, and repository chat through the selected provider when new work starts.
- Persist provider id on new submissions so later provider changes do not affect in-flight work.
- Keep Codex behavior on the same abstraction (additive migration, not per-call-site forks).

## Acceptance Criteria

- New draft, redraft, update, and repository-chat runs use the selected provider id at creation.
- Structured JSON parsing succeeds in backend tests; failures surface actionable errors.
- Provider changes affect only new work; submitted items retain their original provider id.
- Codex adapter path remains supported with no regression in existing tests.
