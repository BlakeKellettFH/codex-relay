---
schemaVersion: 1
id: tkt_01ks6954hsm20dvs34avqbzgz8
title: Add `.relay/context/` storage path and project bootstrap
ticketType: task
draftTargetType: null
status: archive
position: 19000
priority: medium
effort: medium
labels:
  - storage
parentEpicId: null
parentFeatureId: tkt_01ks67pttttnw8czrv9x240pj5
subticketIds: []
plannedFiles:
  - SPEC.md
  - src/storage/filesystem.ts
  - src/storage/paths.ts
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T22:05:34.649Z'
updatedAt: '2026-05-25T12:51:48.369Z'
authoringState: ready
summary: >-
  Added `contextPath`, first-init bootstrap of `.relay/context/` with README,
  and SPEC §5.2 docs. Init is idempotent; pre-existing projects still need a
  later backfill slice.
codexThreadId: 'cursor::87ea5e33-6431-4190-b6f4-01707e80a3af'
runStatus: idle
lastRunId: null
lastRunStartedAt: null
---
# Add `.relay/context/` storage path and project bootstrap

## Requirements

- `contextPath` in `src/storage/paths.ts` joins `.relay/context` under the relay root.
- `initializeProject` creates `context/` and writes `README.md` on first init only (README is not agent-injected).
- SPEC §5.2 documents `context/` as OPTIONAL, reserved for agent instructions.

## Acceptance Criteria

- Fresh init creates `.relay/context/` and `README.md`.
- Re-init does not recreate context or overwrite README.
- SPEC layout and rules include `context/`.

## Outcome

- `contextPath` added; `initializeProject` mkdirs context and writes README when the directory did not exist before first init.
- SPEC §5.2 diagram and bullets updated.
- Older projects with existing `project.json` still skip init early; context backfill deferred to parent feature.
