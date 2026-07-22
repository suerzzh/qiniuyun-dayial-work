import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState } from "../src/state.mjs";
import { renderConversation } from "../src/views/conversation.mjs";

test("renders live realtime messages instead of demo history during an active session", () => {
  const state = createInitialState();
  state.activeConversation = "new";
  state.realtime = {
    status: "listening",
    muted: false,
    error: null,
    messages: [
      { id: "u1", role: "user", text: "My day was calm.", final: true },
      { id: "a1", role: "assistant", text: "What made it feel calm?", final: true },
    ],
  };
  const html = renderConversation(state);
  assert.equal(html.includes("My day was calm."), true);
  assert.equal(html.includes("What made it feel calm?"), true);
  assert.equal(html.includes("How was lunch with your classmates today?"), false);
  assert.match(html, /实时连接正常/);
});

test("shows a useful connection error in the approved UI", () => {
  const state = createInitialState();
  state.activeConversation = "new";
  state.realtime = { status: "error", muted: false, messages: [], error: "无法访问麦克风" };
  const html = renderConversation(state);
  assert.equal(html.includes("无法访问麦克风"), true);
  assert.match(html, /重新开始/);
});
