import test from "node:test";
import assert from "node:assert/strict";

import { createMicrophone } from "../src/realtime/microphone.mjs";

const makeTrack = () => ({
  enabled: true,
  stopCalls: 0,
  stop() { this.stopCalls += 1; },
});

test("requests one microphone stream and keeps mute separate from pause", async () => {
  const audioTrack = makeTrack();
  const extraTrack = makeTrack();
  const stream = {
    getAudioTracks: () => [audioTrack],
    getTracks: () => [audioTrack, extraTrack],
  };
  let calls = 0;
  const microphone = createMicrophone({
    mediaDevices: {
      async getUserMedia(constraints) {
        calls += 1;
        assert.deepEqual(constraints, { audio: true });
        return stream;
      },
    },
  });

  assert.equal(await microphone.request(), stream);
  assert.equal(await microphone.request(), stream);
  assert.equal(calls, 1);

  microphone.setMuted(true);
  assert.equal(audioTrack.enabled, false);
  microphone.setPaused(true);
  microphone.setMuted(false);
  assert.equal(audioTrack.enabled, false, "pause must still hold the track closed");
  microphone.setPaused(false);
  assert.equal(audioTrack.enabled, true);
  assert.equal(microphone.isMuted(), false);
  assert.equal(microphone.isPaused(), false);
});

test("stops every track exactly once and can request a fresh stream after teardown", async () => {
  const firstTrack = makeTrack();
  const secondTrack = makeTrack();
  const streams = [firstTrack, secondTrack].map((track) => ({
    getAudioTracks: () => [track],
    getTracks: () => [track],
  }));
  let index = 0;
  const microphone = createMicrophone({ mediaDevices: { getUserMedia: async () => streams[index++] } });

  await microphone.request();
  microphone.stop();
  microphone.stop();
  assert.equal(firstTrack.stopCalls, 1);
  assert.equal(microphone.getStream(), null);

  assert.equal(await microphone.request(), streams[1]);
  assert.equal(index, 2);
});

test("maps browser permission denial to a user-facing error", async () => {
  const denied = new Error("browser detail");
  denied.name = "NotAllowedError";
  const microphone = createMicrophone({ mediaDevices: { getUserMedia: async () => { throw denied; } } });
  await assert.rejects(microphone.request(), /麦克风权限/);
});
