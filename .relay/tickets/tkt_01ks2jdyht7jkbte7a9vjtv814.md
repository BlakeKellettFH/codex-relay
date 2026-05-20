---
schemaVersion: 1
id: tkt_01ks2jdyht7jkbte7a9vjtv814
title: Surface Codex authentication state in the app status rail
ticketType: task
status: completed
position: 1000
priority: high
effort: medium
labels:
  - codex
  - frontend
  - backend
  - ux
parentEpicId: null
subticketIds: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-20T11:30:42.874Z'
updatedAt: '2026-05-20T11:46:42.426Z'
authoringState: ready
codexThreadId: 019e452d-e6d5-7a83-af21-961cd8ab1a89
runStatus: completed
lastRunId: run_01ks2jvsabqytb4f9qvpq79mrr
lastRunStartedAt: '2026-05-20T11:38:16.387Z'
---
# Surface Codex authentication state in the app status rail

## Context

Relay already checks Codex status on app startup, but the fixed bottom-right status rail can hide an unauthenticated state by showing `cliVersion` instead of the backend warning message. Users can end up with a working CLI binary but no auth and no clear explanation for why Codex-backed features fail.

## Goal

Keep the existing startup status check and existing bottom-right Codex status rail; do not introduce a modal or separate onboarding flow.

## Decisions / Assumptions

- `authenticated: null` should remain a neutral/loading state used for the initial `Checking Codex...` placeholder rather than a user-visible error state.
- Reusing the existing `.status-rail` / `.codex-status` surface is the intended product direction for this task.
- Healthy-state detail can remain the CLI version; the required behavior change is that degraded states prioritize actionable warning text.

## Requirements

- Keep the existing startup status check and existing bottom-right Codex status rail; do not introduce a modal or separate onboarding flow.
- When `cliAvailable === true` and `authenticated === false`, the rail must visibly show the backend warning message instead of showing only `cliVersion`.
- Status semantics must distinguish healthy from degraded states: only a fully available and authenticated Codex status should render as healthy/`ok`; unauthenticated and CLI-missing states must render as warning/error states.
- Preserve the manual refresh affordance and make refreshed results use the same display rules as the initial startup load.
- The warning state text must remain readable in the rail rather than being reduced to an unhelpful single truncated version string.

## Acceptance Criteria

- On app startup, if Codex CLI is installed but Relay cannot find `~/.codex/auth.json`, `OPENAI_API_KEY`, or `CODEX_API_KEY`, the visible Codex rail shows the unauthenticated warning message.
- A CLI-installed but unauthenticated state is not styled as healthy and is visually distinct from the fully authenticated state.
- When Codex is available and authenticated, the rail still shows a healthy state and may continue to show the CLI version as the detail text.
- The existing refresh button continues to re-query `/api/codex/status` and updates the rail using the same healthy/degraded rules.
- Automated tests cover the backend auth signal and the renderer behavior that prevents the warning from being hidden by `cliVersion`.

## Test Plan

- Run `npm test -- backend.test.ts` and verify `getCodexStatus()` covers CLI-available authenticated and unauthenticated outcomes.
- Run `npm test -- ticket-draft-ui.test.tsx` or the renderer test file chosen for the rail assertions, and verify unauthenticated markup includes the warning message rather than only the CLI version.
- If the rail logic is extracted into a helper/component, add focused assertions for healthy, checking, unauthenticated, and CLI-missing display states.
- Run `npm run typecheck` to confirm the updated status-state logic and any exported test helpers compile cleanly.

## Implementation Notes

- Codebase finding: `src/renderer/src/App.tsx:3456-3465` mounts `useCodexStatusQuery()` on app startup and wires the existing refresh button through `useRefreshCodexStatusMutation()`; `App` renders the status rail at `src/renderer/src/App.tsx:3642-3651`.
- Codebase finding: The current renderer display logic is `codexStatus.cliVersion ?? codexStatus.message` and the rail gets `.ok` whenever `codexStatus.cliAvailable` is true (`src/renderer/src/App.tsx:3643-3647`), so an unauthenticated-but-installed CLI looks healthy and shows only the version string.
- Codebase finding: Backend status already exposes the needed signal in `getCodexStatus()` (`src/services/codex/status.ts:11-45`): `cliAvailable`, `cliVersion`, `authenticated`, and a user-facing `message` that explicitly says `Codex CLI is available, but no Codex auth file or API key was found.`
- Codebase finding: The current rail styling is single-line and truncates status text (`src/renderer/src/styles.css:1349-1389`), so simply swapping in the longer unauthenticated message will likely still hide part of the warning unless the warning state layout is adjusted.
- Codebase finding: Existing tests cover CLI availability states in `tests/backend.test.ts:967-1030`, and renderer/App-adjacent UI tests already use `renderToStaticMarkup` with `QueryClientProvider` from `tests/ticket-draft-ui.test.tsx:1-37`; query mocking patterns live in `tests/renderer-query-hooks.test.tsx:44-60`. Docs already establish the expected auth flow in `README.md` "Optional Codex Setup" / "Codex and Secrets" and `SPEC.md` sections `9.4 Codex API` and `12.2 Codex Errors`.
- Implementation: Update the status rail rendering in `src/renderer/src/App.tsx` to derive an explicit display state from `cliAvailable` and `authenticated`, and prioritize `message` for degraded states while retaining `cliVersion` as healthy-state detail.
- Implementation: Adjust the status rail class naming in `src/renderer/src/App.tsx` so the current `.ok` treatment applies only when `cliAvailable && authenticated === true`; add a warning/error variant for unauthenticated or missing-CLI states.
- Implementation: Update `src/renderer/src/styles.css` so degraded Codex status text can wrap or otherwise remain readable, while preserving the existing fixed rail placement and refresh button layout.
- Implementation: Add or extend renderer-facing tests around the App status rail, likely alongside other `App.tsx` exports in `tests/ticket-draft-ui.test.tsx`, to assert that unauthenticated status renders the warning text and that healthy status can still show the CLI version.
- Implementation: Extend `tests/backend.test.ts` with `getCodexStatus()` auth-state coverage for at least one unauthenticated case and one API-key/auth-file positive case so the UI contract remains backed by service tests.
- No dedicated App-level status-rail test exists today; the simplest testable path may be extracting a small presentational helper/component from `App.tsx` and covering it with the existing server-rendered test style used in `tests/ticket-draft-ui.test.tsx`.
- Research did not confirm an existing backend test helper specifically for overriding home-directory auth-file detection, so the implementation may need to use the existing service dependency seams or temp environment setup already used elsewhere in `tests/backend.test.ts`.

## Codex Handoff

### 5/20/2026, 12:42:03 PM

**Summary**
Updated the Codex status rail to derive an explicit display state and use consistent rules for startup and refresh. Healthy state now requires `cliAvailable && authenticated === true`, unauthenticated installed-CLI state renders the backend warning message instead of `cliVersion`, and CLI-missing state renders as error. I also adjusted the rail styling so degraded text wraps instead of collapsing to a truncated single-line version string.

On the backend, I kept the runtime behavior the same but added narrow test seams for API-key and auth-file detection so `getCodexStatus()` can be covered directly for authenticated and unauthenticated outcomes. Renderer tests now cover loading, healthy, warning, and error rail behavior.

**Files changed**
- [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:694)
- [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:1349)
- [src/services/codex/status.ts](/Users/blakekellett/repos/codex-relay/src/services/codex/status.ts:7)
- [tests/backend.test.ts](/Users/blakekellett/repos/codex-relay/tests/backend.test.ts:1033)
- [tests/ticket-draft-ui.test.tsx](/Users/blakekellett/repos/codex-relay/tests/ticket-draft-ui.test.tsx:42)

**Commands run**
- `npm test -- backend.test.ts`
- `npm test -- ticket-draft-ui.test.tsx`
- `npm run typecheck`

**Tests run and results**
- `npm test -- backend.test.ts`: passed, runner reported `188` tests with `184` passed and `4` skipped.
- `npm test -- ticket-draft-ui.test.tsx`: passed, runner reported `188` tests with `184` passed and `4` skipped.
- `npm run typecheck`: passed.

**Subagent usage**
- none used

**Remaining risks or follow-up work**
- The rail width is still fixed at `292px`, so very long degraded messages will wrap to multiple lines within the existing footprint rather than expanding the surface. That matches the ticket, but it is the main remaining UI constraint.


No Codex run has been started.
