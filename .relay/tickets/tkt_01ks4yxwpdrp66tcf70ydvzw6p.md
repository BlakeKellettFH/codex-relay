---
schemaVersion: 1
id: tkt_01ks4yxwpdrp66tcf70ydvzw6p
title: >-
  Draft: We should add a button on the Codex:connected component at the left
  panel to...
ticketType: draft_ticket
draftTargetType: feature
status: todo
position: 1000
priority: medium
effort: high
labels: []
parentEpicId: null
parentFeatureId: null
subticketIds: []
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T09:47:37.037Z'
updatedAt: '2026-05-21T10:07:52.551Z'
authoringState: drafting
summary: ''
codexThreadId: null
runStatus: drafting
lastRunId: run_01ks502zq5e4yn95qzbd6pwysa
lastRunStartedAt: null
---
# Draft: We should add a button on the Codex:connected component at the left panel to...

## Drafting State

The agent researched this draft but needs user input before it can produce an implementation-ready ticket. Answer the clarification questions below; drafting will resume automatically once every question is answered.

## Original Idea

We should add a button on the Codex:connected component at the left panel to open a modal.

I want to move slightly away from being codex agnostic, 
I want to see in that panel if there is a codex cli, and if so check if the user is connected / logged in.
I want to also see if there is a cursor cli and if user is connected, 
I want to also see if the user has a claude cli and if user is connected,

Then i want to have a button next to each saying "Use CLI" which will change which cli relay uses for its actions.

## Open Clarification Questions

- Should the selected CLI apply to all new agent-backed actions in Relay, or only to implementation/code-edit runs at first? Why it matters: The current codepath hardcodes Codex across draft intake, ticket drafting/redrafting/updates, repository chat, and implementation. The MVP boundary changes both ticket scope and backend routing work. Recommended answer: Apply the selected CLI to all new agent-backed actions: draft intake, ticket drafting/redrafting/updates, repository chat, and implementation. Existing queued or running work stays on the provider it already claimed.
- If Cursor or Claude is installed but Relay cannot reliably verify login status non-interactively, what should the modal show and should `Use CLI` stay disabled? Why it matters: Reliable "connected" detection may differ by CLI. The ticket needs an explicit fallback state so the UI and acceptance criteria do not overpromise provider readiness. Recommended answer: Show `Installed, status unknown`, keep `Use CLI` disabled for that provider, and surface a short hint that Relay needs a detectable signed-in state before it can switch to that CLI.

## Research Metadata

- No research metadata recorded.

## Codex Handoff

Ticket draft generation is blocked on clarification.
