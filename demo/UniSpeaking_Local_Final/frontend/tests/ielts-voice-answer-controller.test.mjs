import test from "node:test";
import assert from "node:assert/strict";

import { createVoiceAnswerController } from "../src/ielts/voice-answer-controller.mjs";

function createFixture({ supported = true, startError = null } = {}) {
  let handlers;
  let intervalCallback = null;
  const adapter = {
    starts: 0,
    pauses: 0,
    resumes: 0,
    stops: 0,
    disposed: 0,
    isSupported: () => supported,
    async start() { this.starts += 1; if (startError) throw startError; },
    pause() { this.pauses += 1; },
    async resume() { this.resumes += 1; },
    stop() { this.stops += 1; },
    dispose() { this.disposed += 1; },
    emitInterim(text) { handlers.onInterim(text); },
    emitFinal(text) { handlers.onFinal(text); },
    emitError(error) { handlers.onError(error); },
  };
  const controller = createVoiceAnswerController({
    createAdapter(callbacks) { handlers = callbacks; return adapter; },
    clock: {
      setInterval(callback) { intervalCallback = callback; return 1; },
      clearInterval() { intervalCallback = null; },
    },
  });
  return { controller, adapter, tick: () => intervalCallback?.() };
}

test("starts, pauses and resumes while appending final transcript", async () => {
  const fixture = createFixture();
  await fixture.controller.start();
  fixture.adapter.emitFinal("I enjoy reading");
  fixture.controller.pause();
  await fixture.controller.resume();
  fixture.adapter.emitFinal("because it helps me relax");
  const snapshot = fixture.controller.getSnapshot();
  assert.equal(snapshot.status, "listening");
  assert.equal(snapshot.finalTranscript, "I enjoy reading because it helps me relax");
  assert.equal(fixture.adapter.pauses, 1);
  assert.equal(fixture.adapter.resumes, 1);
});

test("timer advances only while listening", async () => {
  const fixture = createFixture();
  await fixture.controller.start();
  fixture.tick();
  fixture.controller.pause();
  fixture.tick();
  assert.equal(fixture.controller.getSnapshot().elapsedSeconds, 1);
  await fixture.controller.resume();
  fixture.tick();
  assert.equal(fixture.controller.getSnapshot().elapsedSeconds, 2);
});

test("manual edits survive interim results and future final speech appends", async () => {
  const fixture = createFixture();
  await fixture.controller.start();
  fixture.controller.updateTranscript("My corrected answer");
  fixture.adapter.emitInterim("temporary words");
  assert.equal(fixture.controller.getSnapshot().finalTranscript, "My corrected answer");
  fixture.adapter.emitFinal("with another point");
  assert.equal(fixture.controller.getSnapshot().finalTranscript, "My corrected answer with another point");
});

test("unsupported or denied recognition enters editable text fallback", async () => {
  for (const options of [{ supported: false }, { startError: new Error("NotAllowedError") }]) {
    const fixture = createFixture(options);
    await fixture.controller.start();
    assert.equal(fixture.controller.getSnapshot().status, "fallback");
    fixture.controller.updateTranscript("Typed answer");
    assert.equal(fixture.controller.finish(), "Typed answer");
  }
});

test("finish is idempotent and reset ignores late recognition events", async () => {
  const fixture = createFixture();
  await fixture.controller.start();
  fixture.adapter.emitFinal("One answer");
  assert.equal(fixture.controller.finish(), "One answer");
  assert.equal(fixture.controller.finish(), "One answer");
  assert.equal(fixture.adapter.stops, 1);
  fixture.controller.reset();
  fixture.adapter.emitFinal("late words");
  assert.equal(fixture.controller.getSnapshot().finalTranscript, "");
  assert.equal(fixture.controller.getSnapshot().status, "idle");
});

test("fatal recognition errors preserve text and switch to fallback", async () => {
  const fixture = createFixture();
  await fixture.controller.start();
  fixture.adapter.emitFinal("Preserved words");
  fixture.adapter.emitError({ code: "audio-capture", recoverable: false });
  const snapshot = fixture.controller.getSnapshot();
  assert.equal(snapshot.status, "fallback");
  assert.equal(snapshot.finalTranscript, "Preserved words");
});

test("finishing preserves the latest Qwen interim text so the spoken tail is not dropped", async () => {
  const fixture = createFixture();
  await fixture.controller.start();
  fixture.adapter.emitFinal("I enjoy learning");
  fixture.adapter.emitInterim("because it is practical");
  assert.equal(fixture.controller.finish(), "I enjoy learning because it is practical");
});
