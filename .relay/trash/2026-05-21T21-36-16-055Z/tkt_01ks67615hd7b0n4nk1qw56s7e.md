---
schemaVersion: 1
id: tkt_01ks67615hd7b0n4nk1qw56s7e
title: >-
  Draft: i want to create a new feature, to be able to manage a context doc/ in
  the .r...
ticketType: draft_ticket
draftTargetType: epic
status: needs_clarification
position: 4000
priority: medium
effort: medium
labels: []
parentEpicId: null
parentFeatureId: null
subticketIds: []
plannedFiles: []
blockedByIds: []
relatedTicketIds: []
createdAt: '2026-05-21T21:31:06.801Z'
updatedAt: '2026-05-21T21:34:19.651Z'
authoringState: needs_input
summary: ''
codexThreadId: null
runStatus: blocked
lastRunId: run_01ks676155vcq7j9rme41fwvwp
lastRunStartedAt: null
---
# Draft: i want to create a new feature, to be able to manage a context doc/ in the .r...

## Drafting State

The agent researched this draft but needs user input before it can produce an implementation-ready ticket. Answer the clarification questions below; drafting will resume automatically once every question is answered.

## Original Idea

i want to create a new feature, to be able to manage a context doc/ in the .relay. i want the agents to acknowledge this context doc with proprity and it will state context for the overall toolkit fir this project. Such as coding styles, and documentation on the project and features explaining what we trying to do etc. 

so in the directory panel, under the todo, ready, inprocess etc, we should have another folder called context, and it should be togglable to minify and expand.

when we expand we should see all the files in that directory being the context, and we should be able to click on the file and view its context in a markdown file in a modal., it should show the preview and edit toggle so we can edit it also

## Open Clarification Questions

- Should Relay v1 let users create and delete context markdown files from the UI, or only browse and edit files they add on disk? Why it matters: Splits the epic into a browse/edit-only slice versus a fuller CRUD feature with filesystem APIs, validation, and sidebar actions. Recommended answer: Browse and edit only in v1: list `.relay/context/*.md`, open modal with Preview/Edit, save via Relay APIs; users add or remove files through Finder/terminal until a follow-up slice adds in-app create/delete.

## Research Metadata

- No research metadata recorded.

## Codex Handoff

Ticket draft generation is blocked on clarification.
