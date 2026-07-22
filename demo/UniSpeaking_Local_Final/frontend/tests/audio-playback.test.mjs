import test from "node:test";
import assert from "node:assert/strict";

import { createAudioPlayback } from "../src/realtime/audio-playback.mjs";

test("owns one remote player and audio context, reports audibility, and tears down once", async () => {
  const callbacks = new Map();
  let frameId = 0;
  const cancelled = [];
  const audibleChanges = [];
  const audio = {
    autoplay: false,
    playsInline: false,
    muted: true,
    srcObject: null,
    playCalls: 0,
    pauseCalls: 0,
    async play() { this.playCalls += 1; },
    pause() { this.pauseCalls += 1; },
  };
  const source = { connectCalls: 0, disconnectCalls: 0, connect() { this.connectCalls += 1; }, disconnect() { this.disconnectCalls += 1; } };
  let fill = 255;
  const analyser = {
    fftSize: 0,
    getByteTimeDomainData(samples) { samples.fill(fill); },
  };
  const context = {
    state: "suspended",
    resumeCalls: 0,
    suspendCalls: 0,
    closeCalls: 0,
    createMediaStreamSource: () => source,
    createAnalyser: () => analyser,
    async resume() { this.resumeCalls += 1; this.state = "running"; },
    async suspend() { this.suspendCalls += 1; this.state = "suspended"; },
    async close() { this.closeCalls += 1; this.state = "closed"; },
  };
  const playback = createAudioPlayback({
    createAudio: () => audio,
    createAudioContext: () => context,
    requestFrame(callback) { const id = ++frameId; callbacks.set(id, callback); return id; },
    cancelFrame(id) { cancelled.push(id); callbacks.delete(id); },
    onAudibleChange: (audible) => audibleChanges.push(audible),
  });
  const stream = { getAudioTracks: () => [{ kind: "audio" }] };

  await playback.attach(stream);
  assert.equal(audio.srcObject, stream);
  assert.equal(audio.autoplay, true);
  assert.equal(audio.playsInline, true);
  assert.equal(audio.muted, false);
  assert.equal(audio.playCalls, 1);
  assert.equal(context.resumeCalls, 1);
  assert.equal(source.connectCalls, 1);

  callbacks.get(frameId)();
  assert.equal(playback.isAudible(), true);
  assert.deepEqual(audibleChanges, [true]);

  fill = 128;
  callbacks.get(frameId)();
  callbacks.get(frameId)();
  callbacks.get(frameId)();
  assert.equal(playback.isAudible(), false);
  assert.deepEqual(audibleChanges, [true, false]);

  await playback.setPaused(true);
  assert.equal(audio.pauseCalls, 1);
  assert.equal(context.suspendCalls, 1);
  await playback.setPaused(false);
  assert.equal(audio.playCalls, 2);

  await playback.stop();
  await playback.stop();
  assert.equal(source.disconnectCalls, 1);
  assert.equal(context.closeCalls, 1);
  assert.equal(audio.srcObject, null);
  assert.equal(cancelled.length >= 1, true);
});

test("rejects a remote stream without an audio track", async () => {
  const playback = createAudioPlayback({
    createAudio: () => ({}),
    createAudioContext: () => ({}),
    requestFrame: () => 1,
    cancelFrame: () => {},
    onAudibleChange: () => {},
  });
  await assert.rejects(playback.attach({ getAudioTracks: () => [] }), /远端音频/);
});
