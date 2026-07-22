import test from "node:test";
import assert from "node:assert/strict";
import { createIeltsApi } from "../src/services/ielts-api.mjs";

test("IELTS API uses the current Vite origin and Java attempt endpoints", async () => {
  const calls = [];
  const api = createIeltsApi({ origin: "http://localhost:8080", fetchImpl: async (url, options = {}) => {
    calls.push([url, options.method || "GET"]);
    return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ ok: true }) };
  } });
  await api.createAttempt({ mode: "full_mock" });
  await api.finalize("att 1");
  await api.report("att 1");
  assert.deepEqual(calls.map(([url, method]) => [url.replace("http://localhost:8080", ""), method]), [
    ["/api/ielts/attempts", "POST"], ["/api/ielts/attempts/att%201/finalize", "POST"],
    ["/api/ielts/attempts/att%201/report", "GET"],
  ]);
});
