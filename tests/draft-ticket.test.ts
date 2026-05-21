import test from "node:test";
import assert from "node:assert/strict";
import { resolveDraftPreferredTicketType } from "../src/shared/draftTicket";

test("resolveDraftPreferredTicketType uses draftTargetType for draft_ticket", () => {
  assert.equal(
    resolveDraftPreferredTicketType({ ticketType: "draft_ticket", draftTargetType: "feature" }),
    "feature"
  );
  assert.equal(resolveDraftPreferredTicketType({ ticketType: "draft_ticket", draftTargetType: null }), "task");
});

test("resolveDraftPreferredTicketType passes through finalized ticket types", () => {
  assert.equal(resolveDraftPreferredTicketType({ ticketType: "epic", draftTargetType: null }), "epic");
  assert.equal(resolveDraftPreferredTicketType({ ticketType: "task", draftTargetType: null }), "task");
});
