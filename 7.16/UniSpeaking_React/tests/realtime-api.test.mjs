import test from "node:test";
import assert from "node:assert/strict";

import { createRealtimeApi } from "../src/services/realtime-api.mjs";

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("normalizes the Python backend URL and uses the current session endpoints", async () => {
  const requests = [];
  const api = createRealtimeApi({
    baseUrl: "http://127.0.0.1:8000/",
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (String(url).endsWith("/api/realtime?session_id=session-1")) {
        return new Response("v=0\r\nanswer", { status: 200, headers: { "Content-Type": "application/sdp" } });
      }
      if (options.method === "DELETE") return new Response(null, { status: 204 });
      return jsonResponse({ ok: true, session_id: "session-1" }, options.method === "POST" ? 201 : 200);
    },
  });

  await api.health();
  await api.createSession({ prompt: "daily life", conversation_id: "conversation-1" });
  const sdp = await api.exchangeSdp("session-1", "v=0\r\noffer");
  await api.rememberEvent("session-1", { type: "response.text.done", text: "Hi" });
  await api.bindProviderSession("session-1", "sess_0123456789abcdef");
  await api.updateLearnerLevel("session-1", { requested_level: 4, reason: "stable" });
  await api.recordQuality("session-1", { packets_lost: 0 });
  await api.closeSession("session-1");

  assert.equal(sdp, "v=0\r\nanswer");
  assert.deepEqual(requests.map((request) => request.url), [
    "http://127.0.0.1:8000/health",
    "http://127.0.0.1:8000/api/sessions",
    "http://127.0.0.1:8000/api/realtime?session_id=session-1",
    "http://127.0.0.1:8000/api/sessions/session-1/events",
    "http://127.0.0.1:8000/api/sessions/session-1/provider-session",
    "http://127.0.0.1:8000/api/sessions/session-1/tools/learner-level",
    "http://127.0.0.1:8000/api/sessions/session-1/quality",
    "http://127.0.0.1:8000/api/sessions/session-1",
  ]);
  assert.equal(requests[2].options.headers["Content-Type"], "application/sdp");
  assert.equal(requests[2].options.body, "v=0\r\noffer");
});

test("sends the configured Supabase publishable key on JSON and SDP requests", async () => {
  const requests = [];
  const publicKey = "sb_publishable_test_key";
  const api = createRealtimeApi({
    baseUrl: "https://example.supabase.co/functions/v1/realtime-gateway",
    publicKey,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (String(url).includes("/api/realtime")) {
        return new Response("v=0\r\nanswer", {
          status: 200,
          headers: { "Content-Type": "application/sdp" },
        });
      }
      return jsonResponse({ ok: true, session_id: "session-1" }, 200);
    },
  });

  await api.health();
  await api.createSession({ prompt: "daily life" });
  await api.exchangeSdp("session-1", "v=0\r\noffer");

  assert.deepEqual(
    requests.map(({ options }) => options.headers?.apikey),
    [publicKey, publicKey, publicKey]
  );
});

test("surfaces a safe backend error without leaking request configuration", async () => {
  const api = createRealtimeApi({
    baseUrl: "http://127.0.0.1:8000",
    fetchImpl: async () => jsonResponse({ error: "实时模型服务尚未配置" }, 503),
  });
  await assert.rejects(api.createSession({}), /实时模型服务尚未配置/);
});

test("requires an http or https public backend URL", () => {
  assert.throws(() => createRealtimeApi({ baseUrl: "javascript:alert(1)", fetchImpl: async () => jsonResponse({}) }), /HTTP/);
});
