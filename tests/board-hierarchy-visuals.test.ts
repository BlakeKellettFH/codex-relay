import test from "node:test";
import assert from "node:assert/strict";
import {
  HIERARCHY_COLOR_PALETTE_SIZE,
  buildHierarchyVisualRegistry,
  getHierarchyVisual,
  indexToHierarchyLetter,
  indexToHierarchyNumber
} from "../src/renderer/src/lib/boardHierarchyVisuals";
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

test("indexToHierarchyLetter maps A-Z then AA", () => {
  assert.equal(indexToHierarchyLetter(0), "A");
  assert.equal(indexToHierarchyLetter(25), "Z");
  assert.equal(indexToHierarchyLetter(26), "AA");
  assert.equal(indexToHierarchyLetter(27), "AB");
});

test("indexToHierarchyNumber maps 1-based numbers", () => {
  assert.equal(indexToHierarchyNumber(0), "1");
  assert.equal(indexToHierarchyNumber(9), "10");
});

test("buildHierarchyVisualRegistry uses numbers for epics and letters for features", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic" });
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature" });
  const registry = buildHierarchyVisualRegistry([epic, feature]);

  assert.equal(getHierarchyVisual(registry, "feat_1")?.letter, "A");
  assert.equal(getHierarchyVisual(registry, "epic_1")?.letter, "1");
});

test("buildHierarchyVisualRegistry assigns separate pools per type", () => {
  const epicA = ticket({ id: "epic_1", title: "Alpha", ticketType: "epic" });
  const epicB = ticket({ id: "epic_2", title: "Beta", ticketType: "epic" });
  const featureA = ticket({ id: "feat_1", title: "Auth", ticketType: "feature" });
  const registry = buildHierarchyVisualRegistry([epicA, epicB, featureA]);

  assert.equal(getHierarchyVisual(registry, "epic_1")?.letter, "1");
  assert.equal(getHierarchyVisual(registry, "epic_2")?.letter, "2");
  assert.equal(getHierarchyVisual(registry, "feat_1")?.letter, "A");
});

test("each epic and feature gets a unique color until the palette is exhausted", () => {
  const epicCount = Math.ceil(HIERARCHY_COLOR_PALETTE_SIZE / 2);
  const featureCount = HIERARCHY_COLOR_PALETTE_SIZE - epicCount;
  const epics = Array.from({ length: epicCount }, (_, index) =>
    ticket({ id: `epic_${index}`, title: `Epic ${index}`, ticketType: "epic" })
  );
  const features = Array.from({ length: featureCount }, (_, index) =>
    ticket({ id: `feat_${index}`, title: `Feature ${index}`, ticketType: "feature" })
  );

  const registry = buildHierarchyVisualRegistry([...epics, ...features]);
  const colors = [...registry.values()].map((visual) => visual.color);
  assert.equal(new Set(colors).size, HIERARCHY_COLOR_PALETTE_SIZE);
});

test("colors reuse only after every palette entry has been assigned once", () => {
  const epics = Array.from({ length: HIERARCHY_COLOR_PALETTE_SIZE }, (_, index) =>
    ticket({ id: `epic_${index}`, title: `Epic ${index}`, ticketType: "epic" })
  );
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature" });

  const registry = buildHierarchyVisualRegistry([...epics, feature]);
  assert.equal(getHierarchyVisual(registry, "epic_0")?.color, getHierarchyVisual(registry, "feat_1")?.color);
});

test("first three hierarchy tickets use high-contrast red blue green", () => {
  const registry = buildHierarchyVisualRegistry([
    ticket({ id: "epic_1", title: "Alpha", ticketType: "epic" }),
    ticket({ id: "feat_1", title: "Auth", ticketType: "feature" }),
    ticket({ id: "feat_2", title: "Billing", ticketType: "feature" })
  ]);

  assert.equal(getHierarchyVisual(registry, "epic_1")?.color, "#ff6b6b");
  assert.equal(getHierarchyVisual(registry, "feat_1")?.color, "#339af0");
  assert.equal(getHierarchyVisual(registry, "feat_2")?.color, "#51cf66");
});

test("first epic and first feature use different colors from the shared palette", () => {
  const epic = ticket({ id: "epic_1", title: "Platform", ticketType: "epic" });
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature" });
  const registry = buildHierarchyVisualRegistry([epic, feature]);

  const epicVisual = getHierarchyVisual(registry, "epic_1");
  const featureVisual = getHierarchyVisual(registry, "feat_1");
  assert.notEqual(epicVisual?.color, featureVisual?.color);
});

test("buildHierarchyVisualRegistry is stable for the same ticket id", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature" });
  const first = buildHierarchyVisualRegistry([feature]);
  const second = buildHierarchyVisualRegistry([feature, ticket({ id: "task_1", title: "Login", ticketType: "task" })]);

  assert.deepEqual(getHierarchyVisual(first, "feat_1"), getHierarchyVisual(second, "feat_1"));
});

test("buildHierarchyVisualRegistry ignores tasks", () => {
  const feature = ticket({ id: "feat_1", title: "Auth", ticketType: "feature" });
  const registry = buildHierarchyVisualRegistry([
    feature,
    ticket({ id: "task_1", title: "Login", ticketType: "task" })
  ]);

  assert.equal(registry.size, 1);
  assert.equal(getHierarchyVisual(registry, "task_1"), undefined);
});
