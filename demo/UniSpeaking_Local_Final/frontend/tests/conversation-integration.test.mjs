import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the product conversation page uses the real session hook without Demo embedding", async () => {
  const source = await read("src/views/ConversationView.jsx");
  assert.match(source, /useRealtimeSession/);
  assert.match(source, /sendText/);
  assert.match(source, /togglePause/);
  assert.match(source, /toggleMute/);
  assert.match(source, /retry/);
  assert.match(source, /role="alert"/);
  assert.equal(/<iframe|webrtc_demo\.html|window\.location\.(href|assign)/.test(source), false);
  assert.equal(source.includes("内容由 AI 模拟生成"), false);
});

test("the hook owns one client and releases it on unmount", async () => {
  const source = await read("src/hooks/useRealtimeSession.js");
  assert.match(source, /createRealtimeClient/);
  assert.match(source, /clientRef/);
  assert.match(source, /stop\(\{\s*silent:\s*true/);
  assert.match(source, /createRealtimeApi\(\)/);
  assert.doesNotMatch(source, /VITE_REALTIME_API_BASE/);
  assert.doesNotMatch(source, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.equal(source.includes("DASHSCOPE_API_KEY"), false);
  assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
});

test("the free chat route remains a product hash route", async () => {
  const router = await read("src/router.mjs");
  const app = await read("src/App.jsx");
  assert.match(router, /#\\\/conversation/);
  assert.match(app, /<ConversationView/);
  assert.equal(app.includes("webrtc_demo"), false);
});
