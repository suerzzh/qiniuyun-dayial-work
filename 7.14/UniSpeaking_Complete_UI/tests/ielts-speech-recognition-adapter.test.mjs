import test from "node:test";
import assert from "node:assert/strict";

import { createSpeechRecognitionAdapter } from "../src/ielts/speech-recognition-adapter.mjs";

function createFixture({ supported = true } = {}) {
  const instances = [];
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  class FakeRecognition {
    constructor() {
      this.started = 0;
      this.stopped = 0;
      this.aborted = 0;
      instances.push(this);
    }
    start() { this.started += 1; }
    stop() { this.stopped += 1; }
    abort() { this.aborted += 1; }
    emitResult(results) { this.onresult?.({ resultIndex: 0, results }); }
    emitError(error) { this.onerror?.({ error }); }
    emitEnd() { this.onend?.(); }
  }
  const windowRef = supported ? { SpeechRecognition: FakeRecognition } : {};
  const calls = [];
  const mediaDevices = supported ? {
    async getUserMedia(constraints) {
      calls.push(constraints);
      return { getTracks: () => tracks };
    },
  } : null;
  return { instances, tracks, calls, windowRef, mediaDevices };
}

function recognitionResult(text, isFinal) {
  return Object.assign([{ transcript: text }], { isFinal });
}

test("requires recognition and media APIs", () => {
  const fixture = createFixture({ supported: false });
  const adapter = createSpeechRecognitionAdapter({ ...fixture, onInterim() {}, onFinal() {}, onError() {} });
  assert.equal(adapter.isSupported(), false);
});

test("starts English continuous recognition after requesting microphone permission", async () => {
  const fixture = createFixture();
  const adapter = createSpeechRecognitionAdapter({ ...fixture, onInterim() {}, onFinal() {}, onError() {} });
  await adapter.start();
  assert.deepEqual(fixture.calls, [{ audio: true }]);
  assert.equal(fixture.instances[0].lang, "en-GB");
  assert.equal(fixture.instances[0].continuous, true);
  assert.equal(fixture.instances[0].interimResults, true);
  assert.equal(fixture.instances[0].started, 1);
});

test("normalizes interim and final recognition results", async () => {
  const fixture = createFixture();
  const interim = [];
  const final = [];
  const adapter = createSpeechRecognitionAdapter({
    ...fixture,
    onInterim: (text) => interim.push(text),
    onFinal: (text) => final.push(text),
    onError() {},
  });
  await adapter.start();
  fixture.instances[0].emitResult([
    recognitionResult("I enjoy", false),
    recognitionResult("travelling", true),
  ]);
  assert.deepEqual(interim, ["I enjoy"]);
  assert.deepEqual(final, ["travelling"]);
});

test("pause keeps tracks, resume creates a fresh recognizer, and stop releases resources", async () => {
  const fixture = createFixture();
  const adapter = createSpeechRecognitionAdapter({ ...fixture, onInterim() {}, onFinal() {}, onError() {} });
  await adapter.start();
  adapter.pause();
  assert.equal(fixture.instances[0].stopped, 1);
  assert.equal(fixture.tracks[0].stopped, false);
  await adapter.resume();
  assert.equal(fixture.instances.length, 2);
  adapter.stop();
  assert.equal(fixture.instances[1].aborted, 1);
  assert.equal(fixture.tracks[0].stopped, true);
});

test("classifies recognition errors", async () => {
  const fixture = createFixture();
  const errors = [];
  const adapter = createSpeechRecognitionAdapter({ ...fixture, onInterim() {}, onFinal() {}, onError: (error) => errors.push(error) });
  await adapter.start();
  fixture.instances[0].emitError("no-speech");
  fixture.instances[0].emitError("not-allowed");
  assert.deepEqual(errors, [
    { code: "no-speech", recoverable: true },
    { code: "not-allowed", recoverable: false },
  ]);
});

test("restarts once after an unexpected recognition end, then reports a fatal interruption", async () => {
  const fixture = createFixture();
  const errors = [];
  const adapter = createSpeechRecognitionAdapter({ ...fixture, onInterim() {}, onFinal() {}, onError: (error) => errors.push(error) });
  await adapter.start();
  fixture.instances[0].emitEnd();
  assert.equal(fixture.instances.length, 2);
  assert.equal(fixture.instances[1].started, 1);
  fixture.instances[1].emitEnd();
  assert.deepEqual(errors, [{ code: "recognition-ended", recoverable: false }]);
});
