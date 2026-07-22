import test from "node:test";
import assert from "node:assert/strict";

import { resolveHttpBase, resolveWsBase } from "../src/services/local-service-config.mjs";

test("resolves same-origin HTTP and WebSocket bases", () => {
  assert.equal(resolveHttpBase("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
  assert.equal(resolveWsBase("http://127.0.0.1:8080"), "ws://127.0.0.1:8080");
  assert.equal(resolveWsBase("https://local.example"), "wss://local.example");
});
