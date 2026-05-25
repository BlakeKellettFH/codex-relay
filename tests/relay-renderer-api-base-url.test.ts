import test from "node:test";
import assert from "node:assert/strict";
import { relayRendererApiBaseUrl } from "../src/app/relayRendererApiBaseUrl";

test("relayRendererApiBaseUrl uses the Vite dev origin when the renderer URL is set", () => {
  assert.equal(
    relayRendererApiBaseUrl("http://localhost:5173/", "http://127.0.0.1:17654"),
    "http://localhost:5173"
  );
});

test("relayRendererApiBaseUrl keeps the HTTP API base URL outside dev", () => {
  assert.equal(relayRendererApiBaseUrl(undefined, "http://127.0.0.1:17654"), "http://127.0.0.1:17654");
});
