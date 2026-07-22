import test from "node:test";
import assert from "node:assert/strict";
import { createPcmScoringStreamer } from "../src/ielts/pcm-scoring-streamer.mjs";

test("PCM scoring streamer sends 16-bit PCM and releases shared-stream processors", async () => {
  const sent = [];
  const socket = { readyState: 1, send: (value) => sent.push(value), close() { this.closed = true; } };
  let process;
  const processor = { connect() {}, disconnect() { this.disconnected = true; }, set onaudioprocess(value) { process = value; } };
  const source = { connect() {}, disconnect() { this.disconnected = true; } };
  const audioContext = { destination: {}, createMediaStreamSource: () => source, createScriptProcessor: () => processor, close: async () => {} };
  const streamer = createPcmScoringStreamer({ createAudioContext: () => audioContext, createWebSocket: () => socket });
  await streamer.attach({ id: "shared-stream" }, "ws://example");
  process({ inputBuffer: { getChannelData: () => new Float32Array([-1, 0, 1]) } });
  assert.ok(sent.at(-1) instanceof ArrayBuffer);
  assert.deepEqual([...new Int16Array(sent.at(-1))], [-32767, 0, 32767]);
  await streamer.stop();
  assert.equal(source.disconnected, true);
  assert.equal(processor.disconnected, true);
  assert.equal(socket.closed, true);
});
