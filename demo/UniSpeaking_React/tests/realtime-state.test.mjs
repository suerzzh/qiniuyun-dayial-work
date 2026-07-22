import test from "node:test";
import assert from "node:assert/strict";

import {
  applyRealtimeEvent,
  canRetry,
  createRealtimeState,
  sessionStatusText,
} from "../src/realtime/realtime-state.mjs";

const reduce = (...events) => events.reduce(applyRealtimeEvent, createRealtimeState());

test("maps the local session lifecycle to product states", () => {
  const requesting = reduce({ type: "local.requesting_microphone" });
  assert.equal(requesting.status, "requesting_microphone");

  const connecting = applyRealtimeEvent(requesting, { type: "local.connecting" });
  assert.equal(connecting.status, "connecting");

  const connected = applyRealtimeEvent(connecting, {
    type: "local.connected",
    session_id: "local-session",
    conversation_id: "conversation-1",
  });
  assert.equal(connected.status, "connected");
  assert.equal(connected.sessionId, "local-session");
  assert.equal(connected.conversationId, "conversation-1");

  const paused = applyRealtimeEvent(connected, { type: "local.paused" });
  assert.equal(paused.status, "paused");
  assert.equal(paused.paused, true);

  const resumed = applyRealtimeEvent(paused, { type: "local.resumed" });
  assert.equal(resumed.status, "connected");
  assert.equal(resumed.paused, false);

  const ended = applyRealtimeEvent(resumed, { type: "local.ended" });
  assert.equal(ended.status, "ended");
  assert.equal(ended.sessionId, null);
});

test("tracks mute independently from pause", () => {
  const state = reduce(
    { type: "local.connected" },
    { type: "local.muted", muted: true },
    { type: "local.paused" },
  );
  assert.equal(state.muted, true);
  assert.equal(state.paused, true);
});

test("rekeys a live user placeholder when transcription supplies the provider item id", () => {
  let state = reduce({ type: "input_audio_buffer.speech_started" });
  assert.equal(state.status, "user_speaking");
  assert.equal(state.messages[0].text, "正在聆听…");
  const temporaryId = state.activeUserItemId;

  state = applyRealtimeEvent(state, {
    type: "conversation.item.input_audio_transcription.delta",
    item_id: "provider-user-1",
    text: "Hello",
  });
  assert.equal(state.activeUserItemId, "provider-user-1");
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].id, "user:provider-user-1");
  assert.notEqual(state.messages[0].id, `user:${temporaryId}`);
  assert.equal(state.messages[0].text, "Hello");
});

test("marks speech stop as thinking and replaces the user message with final transcript", () => {
  let state = reduce({ type: "input_audio_buffer.speech_started", item_id: "user-1" });
  state = applyRealtimeEvent(state, { type: "input_audio_buffer.speech_stopped", item_id: "user-1" });
  assert.equal(state.status, "ai_thinking");
  assert.equal(state.messages[0].text, "正在识别…");

  state = applyRealtimeEvent(state, {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "user-1",
    transcript: "How was your day?",
  });
  assert.deepEqual(state.messages[0], {
    id: "user:user-1",
    role: "user",
    text: "How was your day?",
    final: true,
  });
  assert.equal(state.activeUserItemId, null);
});

test("appends AI deltas and replaces them with the final transcript", () => {
  let state = reduce(
    { type: "response.created", response: { id: "response-1" } },
    { type: "response.audio_transcript.delta", response_id: "response-1", delta: "Nice " },
    { type: "response.audio_transcript.delta", response_id: "response-1", delta: "to meet you." },
  );
  assert.equal(state.status, "ai_thinking");
  assert.equal(state.messages[0].text, "Nice to meet you.");
  assert.equal(state.messages[0].final, false);

  state = applyRealtimeEvent(state, {
    type: "response.audio_transcript.done",
    response_id: "response-1",
    transcript: "Nice to meet you.",
  });
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].final, true);

  state = applyRealtimeEvent(state, { type: "response.done", response: { id: "response-1" } });
  assert.equal(state.status, "connected");
});

test("uses actual remote audibility for AI playback and detects interruption", () => {
  let state = reduce(
    { type: "response.created" },
    { type: "local.remote_audio", audible: true },
  );
  assert.equal(state.status, "ai_speaking");
  assert.equal(state.audioAudible, true);

  state = applyRealtimeEvent(state, { type: "input_audio_buffer.speech_started", item_id: "interrupt-1" });
  assert.equal(state.status, "interrupted");

  state = applyRealtimeEvent(state, { type: "local.remote_audio", audible: false });
  assert.equal(state.audioAudible, false);
  assert.equal(state.status, "user_speaking");
});

test("maps transcription failure, network disconnect, retry and fatal error", () => {
  let state = reduce({ type: "conversation.item.input_audio_transcription.failed", item_id: "bad-1" });
  assert.match(state.error, /没有识别成功/);
  assert.equal(state.messages[0].final, true);

  state = applyRealtimeEvent(state, { type: "local.disconnected", message: "网络连接已断开" });
  assert.equal(state.status, "disconnected");
  assert.equal(canRetry(state), true);
  assert.match(sessionStatusText(state), /重试/);

  state = applyRealtimeEvent(state, { type: "local.connecting" });
  assert.equal(state.error, null);
  assert.equal(canRetry(state), false);

  state = applyRealtimeEvent(state, { type: "local.error", message: "麦克风权限被拒绝" });
  assert.equal(state.status, "error");
  assert.equal(canRetry(state), true);
  assert.equal(state.error, "麦克风权限被拒绝");
});

test("provides product copy for every required status", () => {
  for (const status of [
    "idle", "requesting_microphone", "connecting", "connected",
    "user_speaking", "ai_thinking", "ai_speaking", "interrupted",
    "paused", "disconnected", "ended", "error",
  ]) {
    const text = sessionStatusText({ ...createRealtimeState(), status });
    assert.equal(typeof text, "string");
    assert.notEqual(text.trim(), "");
  }
});
