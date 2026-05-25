import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveDraftPreferredTicketType,
  resolveDraftPreferredTicketType
} from "../src/shared/draftTicket";

test("resolveDraftPreferredTicketType uses draftTargetType for draft_ticket", () => {
  assert.equal(
    resolveDraftPreferredTicketType({ ticketType: "draft_ticket", draftTargetType: "feature" }),
    "feature"
  );
  assert.equal(resolveDraftPreferredTicketType({ ticketType: "draft_ticket", draftTargetType: null }), "feature");
});

test("resolveDraftPreferredTicketType maps legacy task draft targets to feature", () => {
  assert.equal(
    resolveDraftPreferredTicketType({ ticketType: "draft_ticket", draftTargetType: "task" }),
    "feature"
  );
});

test("effectiveDraftPreferredTicketType never selects task for drafting", () => {
  assert.equal(effectiveDraftPreferredTicketType("task"), "feature");
  assert.equal(effectiveDraftPreferredTicketType("feature"), "feature");
  assert.equal(effectiveDraftPreferredTicketType("epic"), "epic");
});

test("resolveDraftPreferredTicketType passes through finalized ticket types", () => {
  assert.equal(resolveDraftPreferredTicketType({ ticketType: "epic", draftTargetType: null }), "epic");
  assert.equal(resolveDraftPreferredTicketType({ ticketType: "task", draftTargetType: null }), "task");
});
