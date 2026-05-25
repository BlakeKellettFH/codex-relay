---
schemaVersion: 1
id: tkt_01ks4yxwpdrp66tcf70ydvzw6p
title: Add switchable agent CLI selection and provider status modal
ticketType: feature
draftTargetType: null
status: todo
position: 1000
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
updatedAt: '2026-05-21T10:17:47.538Z'
authoringState: reviewing
summary: >-
  Let Relay pick between Codex, Cursor, and Claude for new agent work instead of
  assuming Codex everywhere. Users need to see which CLIs are installed and
  connected before switching, and the choice should stay local to their app
  profile.


  - Add provider status and selection APIs with a busy-work guard.

  - Add a sidebar modal that shows install/auth states and the current
  selection.

  - Route new draft, chat, update, and implementation work through the selected
  provider.


  The main risk is normalizing Cursor and Claude CLI behavior into Relay’s
  existing Codex-shaped run logs and queues.
codexThreadId: null
runStatus: draft_complete
lastRunId: run_01ks502zq5e4yn95qzbd6pwysa
lastRunStartedAt: null
---
# Add switchable agent CLI selection and provider status modal

## Context

Relay currently exposes a codex-only status chip in the left sidebar and hardcodes `providerId: "codex"` across draft intake, drafting, repository chat, ticket updates, and implementation runs. The feature should let the user inspect Codex, Cursor, and Claude CLI availability/login state, choose the CLI Relay will use for future agent-backed work, and keep that choice local to the app rather than stored in shared `.relay` project files.

## Goal

Add a left-sidebar CLI selector modal that lists Codex, Cursor, and Claude with install state, connection state, version text when available, and the current Relay selection.

## Decisions / Assumptions

- Provider selection is global to the local Relay app instance, not per project, because the entry point is the shared sidebar footer and the user wants the choice to stay out of `.relay` files.
- Existing codex-scoped run endpoints and event schema names can remain in place for this feature; the provider-management API should be additive so the implementation does not spend effort on broad naming churn.
- The busy-work switch guard should conservatively block while any registered project has non-terminal work in `created`, `queued`, `running`, `cancelling`, or `stale`; blocked and terminal work do not block a switch.
- Cursor and Claude should use their documented CLI defaults for model and provider-specific permissions in MVP; existing Codex-only project settings such as `codexWebSearchMode` and `codexAdditionalDirectories` remain Codex-specific unless an adapter can map them directly.

## Requirements

- Add a left-sidebar CLI selector modal that lists Codex, Cursor, and Claude with install state, connection state, version text when available, and the current Relay selection.
- Persist the selected CLI in app-local registry state, defaulting existing installs to Codex, and do not write provider selection into `.relay/project.json` or ticket files.
- Apply the selected CLI to all new agent-backed actions: draft intake, ticket draft/redraft, ticket update, repository chat, and implementation runs.
- Keep already-claimed or already-queued work on the provider stored with that work item so a later selection change only affects newly started actions.
- Disable `Use CLI` for any provider that is not installed, is explicitly unauthenticated, or has `status unknown`; show the requested `Installed, status unknown` state for providers whose login cannot be verified non-interactively.
- Reject provider changes while Relay still has active processing work across registered projects, with a user-facing reason, and leave the current selection unchanged.

## Acceptance Criteria

- The left sidebar opens a CLI selector modal from the status control, and the modal shows Codex, Cursor, and Claude rows with installed/auth state, version when known, and current-selection UI.
- Relay stores the selected CLI in app-local registry data and leaves `.relay/project.json` unchanged when the user switches providers.
- `Use CLI` is enabled only for installed, authenticated providers with a verifiable connected state; providers with unverifiable auth display `Installed, status unknown` and remain disabled.
- If any registered project has active processing work, a switch attempt is rejected with a clear message and the previously selected provider remains selected.
- After switching providers, all newly started draft intake, draft/redraft, update, repository chat, and implementation actions record and use the new provider, while already queued or running work continues on its originally stored provider id.
- Codex behavior remains intact for existing flows, and Relay continues to show normalized run progress and final summaries for provider-backed runs in the existing UI.

## Test Plan

- Extend `tests/schemas.test.ts` to cover registry schema defaults and selected-provider persistence.
- Add backend coverage in `tests/backend.test.ts` for provider status payloads, busy switch rejection, selected-provider persistence, and old-work/new-work provider continuity across a selection change.
- Extend `tests/ticket-draft.test.ts` and `tests/ticket-update.test.ts` to assert draft, redraft, update, and repository-chat routing use the selected provider id.
- Extend `tests/project-sidebar.test.tsx` and `tests/ticket-draft-ui.test.tsx` to cover modal rendering, disabled `Use CLI` states, current-selection labels, and collapsed-indicator behavior.
- Run `npm run typecheck`.

## Implementation Notes

- Codebase finding: `src/renderer/src/App.tsx` contains `ProjectSidebar`, `CodexSidebarStatus`, and `CodexCollapsedStatusIndicator`; the expanded footer renders a codex-only status rail and the collapsed floating indicator currently refreshes status on click instead of opening a modal.
- Codebase finding: `src/services/codex/status.ts` and `src/services/codex/cli.ts` are the only provider probe today: Relay shells `codex --version`, then treats `~/.codex/auth.json` or `OPENAI_API_KEY/CODEX_API_KEY` as authentication for `CodexStatus`.
- Codebase finding: `src/shared/http/codex.ts`, `src/http/resources/codex.ts`, `src/renderer/src/lib/relayApi.ts`, and `src/renderer/src/lib/relayQueries.ts` expose only codex-scoped status/run endpoints and hooks, including `/api/codex/status` and `useCodexStatusQuery()`.
- Codebase finding: `src/services/work/ticket/TicketWorkService.ts`, `src/services/work/index.ts`, and `src/services/codex/index.ts` hardcode `providerId: "codex"` for new draft, update, and implementation work, and `src/main.app.ts` only wakes recovered work through `wakeRecoveredCodexWork()`.
- Codebase finding: `src/shared/schemas/registry.ts` and `src/services/registry/index.ts` store app-local state in Electron `userData/registry.json`, while project-shared settings live in `.relay/project.json` via `src/shared/schemas/project.ts` and `src/storage/filesystem.ts`; registry is the safer persistence layer for a user-local CLI choice.
- Codebase finding: `src/services/work/ledger/WorkLedger.ts` already supports `listIncomplete(projectPath)`, and `src/services/work/domain/Work.ts` defines work statuses including `created`, `queued`, `running`, and `blocked`; this is a better switch guard source than sidebar `activeRunCount`, which `src/storage/filesystem.ts` only increments for `runStatus === "running"`.
- Implementation: Add provider-selection schemas and app-registry persistence for a global selected provider id, plus additive HTTP endpoints that return provider inventory, current selection, and switch eligibility/errors.
- Implementation: Implement provider probe services for Codex, Cursor, and Claude that resolve installation, version, auth state, and explanatory messages using documented non-interactive commands where available and `status unknown` where they are not.
- Implementation: Replace the sidebar footer status action with a modal-driven CLI selector in `src/renderer/src/App.tsx`, wire it through new API hooks, and make the collapsed floating indicator open the same modal.
- Implementation: Introduce provider adapters under `src/services/agents` for structured read-only work, structured write work, session resume ids, and provider status so draft intake, draft/redraft, ticket update, and repository chat dispatch through the selected provider.
- Implementation: Stamp newly submitted work with the selected provider id and dispatch queued or recovered work by the provider id already stored on each work item so mixed-provider histories remain resumable.
- Implementation: Normalize Cursor and Claude CLI JSON or stream-json output into the existing `RendererRunEvent` and run-log pipeline, then extend backend and renderer tests around switch guards, provider routing, and modal states.
- There is no existing Cursor or Claude integration in the repo or `package.json`; Codex is the only current dependency (`@openai/codex-sdk`), so non-Codex support should be implemented as CLI subprocess adapters rather than assumed SDK parity.
- `src/services/run-events/index.ts` already provides the persistence and renderer fan-out path for normalized events; adapting provider-native stream-json into the current event model is lower risk than redesigning the event schema in the same ticket.
- `src/storage/filesystem.ts` sidebar `activeRunCount` is not sufficient for switch safety because it ignores queued and drafting work; use work-ledger snapshots for the actual guard and treat sidebar counts as display-only.

## Codex Handoff

No Codex run has been started.
