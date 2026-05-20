---
schemaVersion: 1
id: tkt_01ks2kpdj26bj6mafvmamgh0zx
title: Add dismissible auto-closing toast notifications
ticketType: task
status: completed
position: 2000
priority: medium
effort: medium
labels:
  - renderer
  - ux
  - notifications
parentEpicId: null
subticketIds: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-20T11:52:48.962Z'
updatedAt: '2026-05-20T12:00:55.428Z'
authoringState: ready
codexThreadId: 019e453d-ef19-7233-a564-b1c9d40714c0
runStatus: completed
lastRunId: run_01ks2kvvj61f4w3e07zc44rgct
lastRunStartedAt: '2026-05-20T11:55:47.248Z'
---
# Add dismissible auto-closing toast notifications

## Context

Relay shows a single bottom-centered toast for actions like ticket creation and agent start, but the current toast can only be dismissed by clicking the whole message and never closes automatically. Update the renderer toast to include an explicit close control and auto-dismiss after 5 seconds.

## Goal

Render a visible close button inside the bottom toast so users can dismiss notifications without clicking the message body.

## Decisions / Assumptions

- Use a uniform 5-second auto-dismiss for `info`, `success`, and `error` toasts unless product later asks for different timing by severity.
- The new close button replaces the current whole-toast click-to-dismiss interaction to avoid accidental dismissal while reading or selecting toast text.
- No hover-to-pause or focus-to-pause behavior is required for this pass.

## Requirements

- Render a visible close button inside the bottom toast so users can dismiss notifications without clicking the message body.
- Auto-dismiss every toast 5 seconds after it appears.
- Restart the 5-second dismissal timer whenever a new toast replaces the current one.
- Clean up any pending dismissal timer when the toast is cleared or `RelayApp` unmounts.
- Preserve existing toast semantics and variants: error toasts remain `role="alert"`, non-error toasts remain `role="status"`, and current toast producers continue to work without API changes.

## Acceptance Criteria

- When Relay shows a toast such as `Ticket update agent started: ...`, the toast includes a visible close button.
- Clicking the close button dismisses the toast immediately.
- If the user does nothing, the toast disappears 5 seconds after appearing.
- If one toast is replaced by another before 5 seconds elapse, the new toast remains visible for its own full 5-second window.
- No existing toast producer calls need to change, and error/non-error live-region roles remain unchanged.

## Test Plan

- Run `npm test` from the repo root.
- Add a renderer test that asserts the toast markup includes a dedicated close button and preserves `role="alert"` for error toasts and `role="status"` for non-error toasts.
- Add a renderer test for the dismissal timing logic that verifies a toast clears after 5000 ms and that replacing the toast restarts the timer.
- Run `npm run typecheck` to catch React effect or timeout typing issues.

## Implementation Notes

- Codebase finding: `RelayApp` owns the only toast state via `const [toast, setToast] = useState<Toast>(null)` and renders the toast at the app root in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3483) and [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3729).
- Codebase finding: The toast model is currently `type Toast = { kind: "info" | "error" | "success"; message: string } | null` in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:140), so auto-dismiss can be keyed off toast presence without touching backend schemas.
- Codebase finding: Current toast markup is a single clickable `<div>` with `onClick={() => setToast(null)}` and `role={toast.kind === "error" ? "alert" : "status"}` in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3730), which means there is no dedicated dismiss affordance today.
- Codebase finding: Toast styling is localized to `.toast`, `.toast.error`, and `.toast.success` in [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:3931); existing shared icon-button styling is available in [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:1493) and `X` is already imported in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:23).
- Codebase finding: Representative existing toast producers include `setToast({ kind: "info", message: \`Ticket update agent started: ${result.runId}\` })` in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:2527); renderer tests are bundled through `npm test` / `node tests/run-tests.mjs` in [package.json](/Users/blakekellett/repos/codex-relay/package.json:17), and UI-oriented assertions against `App.tsx` live in files like [tests/ticket-draft-ui.test.tsx](/Users/blakekellett/repos/codex-relay/tests/ticket-draft-ui.test.tsx:1) and [tests/project-sidebar.test.tsx](/Users/blakekellett/repos/codex-relay/tests/project-sidebar.test.tsx:1).
- Implementation: Update the `RelayApp` toast rendering in [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3729) to replace whole-container dismissal with explicit toast content structure: message region plus close button wired to `setToast(null)`.
- Implementation: Add a `useEffect` in `RelayApp` that schedules `setToast(null)` 5000 ms after a non-null toast is set, clears the timeout when the toast changes or is dismissed, and cleans up on unmount.
- Implementation: Keep the existing `Toast` type unless implementation needs an internal identifier; if an identifier is introduced, keep it renderer-local and do not change external mutation/query interfaces.
- Implementation: Adjust `.toast` styling in [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:3931) for horizontal layout, spacing, and a visible close affordance, reusing the existing icon-button pattern or a toast-specific variant so the close control is keyboard accessible and visually aligned.
- Implementation: Add renderer tests that cover toast markup including the close control and the auto-dismiss scheduling behavior, using the existing Node test harness and `App.tsx` test files rather than introducing a new test framework.
- Research was limited to the local repo; no external sources were needed because the change is renderer-local.
- There is no existing dedicated toast test file, so the implementation will likely extend an existing renderer test file or add a small new one under `tests/` and wire it into `tests/run-tests.mjs` if needed.

## Codex Handoff

### 5/20/2026, 12:59:19 PM

**Summary**

Updated the renderer toast in [App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:174) and [styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:3931) so the toast now renders explicit message and close-button content, auto-dismisses after `5000` ms, restarts that timer when a new toast replaces the current one, and clears pending timeouts on toast change/unmount via a `useEffect` in [RelayApp](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:3510). The live-region behavior remains unchanged through `toastRole`, so error toasts stay `role="alert"` and non-error toasts stay `role="status"`.

Added focused renderer coverage in [toast-notification.test.tsx](/Users/blakekellett/repos/codex-relay/tests/toast-notification.test.tsx:1) and registered it in [run-tests.mjs](/Users/blakekellett/repos/codex-relay/tests/run-tests.mjs:11). The new tests cover the dedicated close button, preserved roles, 5-second dismissal, and timer reset when a toast is replaced.

**Files changed**

- [src/renderer/src/App.tsx](/Users/blakekellett/repos/codex-relay/src/renderer/src/App.tsx:174)
- [src/renderer/src/styles.css](/Users/blakekellett/repos/codex-relay/src/renderer/src/styles.css:3931)
- [tests/toast-notification.test.tsx](/Users/blakekellett/repos/codex-relay/tests/toast-notification.test.tsx:1)
- [tests/run-tests.mjs](/Users/blakekellett/repos/codex-relay/tests/run-tests.mjs:11)

**Commands run**

- `sed -n '1,120p' src/renderer/src/App.tsx`
- `sed -n '3680,3775p' src/renderer/src/App.tsx`
- `sed -n '1470,1525p' src/renderer/src/styles.css`
- `sed -n '3920,3995p' src/renderer/src/styles.css`
- `rg -n "toast|role=\"alert\"|role=\"status\"" tests src/renderer/src -g '!node_modules'`
- `sed -n '1,220p' package.json`
- `sed -n '1,260p' tests/ticket-draft-ui.test.tsx`
- `sed -n '1,220p' tests/project-sidebar.test.tsx`
- `sed -n '1,260p' tests/run-tests.mjs`
- `rg -n "renderToStaticMarkup|createRoot|act\\(|useFakeTimers|setTimeout|button" tests -g '!node_modules'`
- `rg -n "export (function|const|type)|function RelayApp|const RelayApp|export \\{.*RelayApp|export default" src/renderer/src/App.tsx`
- `sed -n '720,860p' src/renderer/src/App.tsx`
- `sed -n '3440,3525p' src/renderer/src/App.tsx`
- `sed -n '132,170p' src/renderer/src/App.tsx`
- `sed -n '1,80p' tests/markdown-block.test.tsx`
- `rg -n "export function Button|const Button|function Button\\(" src/renderer/src/components/ui* src/renderer/src/components -g '!node_modules'`
- `sed -n '1,220p' src/renderer/src/components/ui/Button.tsx`
- `sed -n '1,220p' src/renderer/src/components/ui/index.ts`
- `npm test`
- `npm run typecheck`
- `git status --short`
- `git diff -- src/renderer/src/App.tsx src/renderer/src/styles.css tests/toast-notification.test.tsx tests/run-tests.mjs`
- `nl -ba src/renderer/src/App.tsx | sed -n '140,220p'`
- `nl -ba src/renderer/src/App.tsx | sed -n '3490,3765p'`
- `nl -ba src/renderer/src/styles.css | sed -n '3930,3985p'`
- `nl -ba tests/toast-notification.test.tsx | sed -n '1,220p'`
- `nl -ba tests/run-tests.mjs | sed -n '1,40p'`

**Tests run and results**

- `npm test`  
  Passed: `191` tests, `0` failed, `4` skipped.

- `npm run typecheck`  
  Passed with no errors.

**Subagent usage**

- none used

**Remaining risks or follow-up work**

- The worktree already contained unrelated local changes outside this ticket, including `package-lock.json`, `src/services/codex/status.ts`, `tests/backend.test.ts`, `tests/ticket-draft-ui.test.tsx`, and `.relay/*`; I left those untouched.
- I did not add hover-to-pause or focus-to-pause behavior, per the ticket assumptions.


No Codex run has been started.
