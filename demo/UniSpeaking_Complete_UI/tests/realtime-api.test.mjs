import test from "node:test";
import assert from "node:assert/strict";

import { createRealtimeApi } from "../src/services/realtime-api.mjs";

test("uses the publishable key only as apikey for modern Supabase keys", async () => {
  let request;
  const api = createRealtimeApi({
    baseUrl: "https://example.supabase.co/",
    publishableKey: "sb_publishable_public",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ ok: true }) };
    },
  });
  await api.health();
  assert.equal(request.url, "https://example.supabase.co/functions/v1/realtime-gateway/health");
  assert.equal(request.options.headers.apikey, "sb_publishable_public");
  assert.equal("Authorization" in request.options.headers, false);
});
