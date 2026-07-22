import test from "node:test";
import assert from "node:assert/strict";

import { applyRealtimeEvent, createRealtimeState } from "../src/realtime/realtime-state.mjs";

test("maps speech and transcript events into stable user and assistant messages", () => {
  let state = createRealtimeState();
  state = applyRealtimeEvent(state, { type: "input_audio_buffer.speech_started", item_id: "u1" });
  assert.equal(state.status, "listening");

  state = applyRealtimeEvent(state, { type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "I had a good day." });
  state = applyRealtimeEvent(state, { type: "response.audio_transcript.delta", response_id: "a1", delta: "That sounds" });
  state = applyRealtimeEvent(state, { type: "response.audio_transcript.done", response_id: "a1", transcript: "That sounds lovely." });

  assert.deepEqual(state.messages.map(({ role, text, final }) => ({ role, text, final })), [
    { role: "user", text: "I had a good day.", final: true },
    { role: "assistant", text: "That sounds lovely.", final: true },
  ]);
});

test("reports connection and transcription failures without discarding history", () => {
  const started = { ...createRealtimeState(), messages: [{ id: "old", role: "assistant", text: "Hello", final: true }] };
  const failed = applyRealtimeEvent(started, { type: "conversation.item.input_audio_transcription.failed", item_id: "u2" });
  assert.equal(failed.messages.length, 2);
  assert.match(failed.messages[1].text, /没有识别/);
  assert.equal(failed.error, "语音没有识别成功，请再试一次");
});

test("session lifecycle transitions remain explicit", () => {
  let state = createRealtimeState();
  state = applyRealtimeEvent(state, { type: "session.created" });
  assert.equal(state.status, "configuring");
  state = applyRealtimeEvent(state, { type: "session.updated" });
  assert.equal(state.status, "ai_speaking");
  state = applyRealtimeEvent(state, { type: "response.done" });
  assert.equal(state.status, "listening");
});
