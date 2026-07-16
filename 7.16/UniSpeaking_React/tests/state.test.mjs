import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the product shell delegates conversation lifecycle to the realtime module", async () => {
  const [app, conversation, hook] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/views/ConversationView.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/hooks/useRealtimeSession.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /<ConversationView state=\{state\} updateState=\{updateState\}/);
  assert.match(conversation, /useRealtimeSession\(\)/);
  assert.match(hook, /stop\(\{ silent: true \}\)/);
  assert.doesNotMatch(conversation, /activeConversation|voiceState/);
});
