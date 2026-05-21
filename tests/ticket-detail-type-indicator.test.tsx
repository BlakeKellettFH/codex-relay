import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketAuthoringStatePill, TicketRunStatusPill } from "../src/renderer/src/components/TicketCardPills";
import { TicketDetailTypeIndicator } from "../src/renderer/src/components/TicketDetailTypeIndicator";
import type { TicketSummary } from "../src/shared/schemas";

const ticket = (patch: Partial<TicketSummary> & Pick<TicketSummary, "id" | "title" | "ticketType">): TicketSummary => ({
  schemaVersion: 1,
  status: "todo",
  position: 1000,
  priority: "medium",
  effort: "medium",
  labels: [],
  parentEpicId: null,
  parentFeatureId: null,
  subticketIds: [],
  plannedFiles: [],
  blockedByIds: [],
  relatedTicketIds: [],
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
  authoringState: "ready",
  codexThreadId: null,
  runStatus: "idle",
  lastRunId: null,
  lastRunStartedAt: null,
  excerpt: "",
  summary: "",
  filePath: `/tmp/${patch.id}.md`,
  checklist: { total: 0, completed: 0, open: 0 },
  ...patch
});

test("ticket detail type indicator shows epic marker and label", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic" });
  const markup = renderToStaticMarkup(
    <TicketDetailTypeIndicator ticketType="epic" ticketId="epic_1" boardTickets={[epic]} />
  );

  assert.match(markup, /ticket-detail-type-indicator/);
  assert.match(markup, /has-hierarchy-marker/);
  assert.match(markup, /ticket-detail-type-marker/);
  assert.match(markup, />1</);
  assert.match(markup, />Epic</);
  assert.match(markup, /--hierarchy-marker-color/);
});

test("ticket detail type indicator shows feature marker and label", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature" });
  const markup = renderToStaticMarkup(
    <TicketDetailTypeIndicator ticketType="feature" ticketId="feat_1" boardTickets={[feature]} />
  );

  assert.match(markup, /has-hierarchy-marker/);
  assert.match(markup, />A</);
  assert.match(markup, />Feature</);
});

test("ticket detail type indicator renders type and statuses on one row with divider", () => {
  const task = ticket({ id: "task_1", title: "Fix bug", ticketType: "task" });
  const markup = renderToStaticMarkup(
    <TicketDetailTypeIndicator ticketType="task" ticketId="task_1" boardTickets={[task]}>
      <TicketRunStatusPill status="drafting" />
      <TicketAuthoringStatePill state="drafting" />
    </TicketDetailTypeIndicator>
  );

  assert.match(markup, /ticket-detail-type-status-row/);
  assert.match(markup, /ticket-detail-type-status-divider/);
  assert.match(markup, />\|</);
  assert.match(markup, />Task</);
  assert.match(markup, /detail-status-row/);
  assert.match(markup, /Drafting/);
});

test("ticket detail type indicator shows task label without hierarchy marker", () => {
  const task = ticket({ id: "task_1", title: "Fix bug", ticketType: "task" });
  const markup = renderToStaticMarkup(
    <TicketDetailTypeIndicator ticketType="task" ticketId="task_1" boardTickets={[task]} />
  );

  assert.match(markup, /ticket-detail-type-indicator task/);
  assert.match(markup, />Task</);
  assert.doesNotMatch(markup, /ticket-detail-type-marker/);
  assert.doesNotMatch(markup, /has-hierarchy-marker/);
});
