import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createIeltsDemoController } from "../src/ielts/demo-controller.mjs";
import { buildPracticeFeedback } from "../src/ielts/feedback.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = async (name) => JSON.parse(await readFile(join(root, "backend/ielts/question_bank", name), "utf8"));

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function createController(overrides = {}) {
  const speech = [];
  const clock = {
    now: () => new Date("2026-07-20T09:00:00.000Z"),
    setInterval: () => 1,
    clearInterval: () => {},
  };
  const controller = createIeltsDemoController({
    loadJson,
    random: () => 0,
    clock,
    storage: createMemoryStorage(),
    speak: (text) => speech.push(text),
    ...overrides,
  });
  return { controller, speech };
}

test("recording is off by default and becomes immutable after start", async () => {
  const { controller } = createController();
  controller.selectMode("practice_part", "part2");
  assert.equal(controller.getSnapshot().preflight.recordingEnabled, false);
  controller.setPreflight({ recordingEnabled: true });
  await controller.start();
  assert.equal(controller.getSnapshot().sessionPolicy.recordingEnabled, true);
  assert.throws(() => controller.setPreflight({ recordingEnabled: false }), /before start/i);
});

test("Part 2 notes lock after the accelerated preparation deadline", async () => {
  const { controller } = createController();
  controller.selectMode("practice_part", "part2");
  await controller.start();
  controller.updateNotes("people, patience, confidence");
  assert.equal(controller.getSnapshot().notesLocked, false);
  controller.expirePreparationForTest();
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.exam.status, "part2_answering");
  assert.equal(snapshot.notesLocked, true);
  assert.throws(() => controller.updateNotes("late edit"), /preparation/i);
});

test("caption toggling is available during a full mock without changing the question", async () => {
  const { controller, speech } = createController();
  controller.selectMode("full_mock");
  await controller.start();
  const before = controller.getSnapshot();
  const spokenBeforeToggle = speech.length;
  controller.toggleCaptions();
  const after = controller.getSnapshot();
  assert.equal(before.exam.currentItemIndex, after.exam.currentItemIndex);
  assert.equal(after.exam.captionsEnabled, true);
  assert.equal(speech.length, spokenBeforeToggle, "caption display changes must not repeat the examiner question");
});

test("completed Part 2 practice produces evidence feedback without numeric IELTS score", async () => {
  const { controller } = createController();
  controller.selectMode("practice_part", "part2");
  await controller.start();
  controller.updateNotes("a teacher; patient; encouraged me");
  controller.expirePreparationForTest();
  controller.submitAnswer("My teacher influenced me because she encouraged me to speak confidently.");
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.screen, "report");
  assert.equal(snapshot.exam.status, "completed");
  assert.equal(snapshot.report.dimensions.pronunciation.status, "not_assessed");
  assert.equal(/\b[0-9](?:\.5)?\s*\/\s*9\b/.test(JSON.stringify(snapshot.report)), false);
});

test("full mock defaults to real timing and starts Introduction only after the opening response is done", async () => {
  const callbacks = [];
  let remotePaper;
  const runtime = {
    async start({ paperSnapshot }) { remotePaper = paperSnapshot; return { attempt_id: "att-real", scoring_status: "COLLECTING" }; },
    examinerInstruction(text, onDone) { callbacks.push({ text, onDone }); },
    openTurn() {}, questionAsked() {}, completeTurn() {},
  };
  const { controller } = createController({ runtime });
  controller.selectMode("full_mock");
  await controller.start();
  assert.equal(remotePaper.timingProfile, "real_exam");
  assert.equal(controller.getSnapshot().exam.status, "opening");
  assert.equal(controller.getSnapshot().timer, null);
  callbacks.shift().onDone();
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.exam.status, "introduction");
  assert.equal(snapshot.timer.kind, "introduction_answer");
  assert.equal(snapshot.timer.totalSeconds, 60);
});

test("full mock accelerated toggle freezes the accelerated timing profile", async () => {
  let remotePaper;
  const runtime = {
    async start({ paperSnapshot }) { remotePaper = paperSnapshot; return { attempt_id: "att-fast", scoring_status: "COLLECTING" }; },
    examinerInstruction() {}, openTurn() {}, questionAsked() {}, completeTurn() {},
  };
  const { controller } = createController({ runtime });
  controller.selectMode("full_mock");
  controller.setPreflight({ acceleratedDemo: true });
  await controller.start();
  assert.equal(remotePaper.timingProfile, "accelerated_demo");
  assert.equal(remotePaper.timing.introductionMaxSeconds, 15);
  assert.equal(controller.getSnapshot().sessionPolicy.acceleratedDemo, true);
});

test("Part 2 displays the card but the examiner only speaks preparation and start scripts", async () => {
  const { controller, speech } = createController();
  controller.selectMode("practice_part", "part2");
  await controller.start();
  const cardText = controller.getSnapshot().paper.parts.part2.topicSentence;
  assert.match(speech[0], /one minute to think and prepare/i);
  assert.equal(speech[0].includes(cardText), false);
  controller.expirePreparationForTest();
  assert.match(speech[1], /You may begin speaking now/i);
  assert.equal(speech[1].includes(cardText), false);
});

test("feedback refuses to assess pronunciation from transcript-only evidence", () => {
  const report = buildPracticeFeedback({
    status: "completed",
    mode: "full_mock",
    recordingEnabled: false,
    answers: [{ transcript: "A coherent sample response.", durationMs: 42000 }],
    notes: "",
    captionsUsed: false,
  });
  assert.equal(report.dimensions.pronunciation.status, "not_assessed");
  assert.match(report.dimensions.pronunciation.evidence, /未保存可分析的原始音频/);
});

test("remote start failure returns to preflight instead of showing a fake listening session", async () => {
  const runtime = {
    async start() { throw new Error("Internal Server Error"); },
    async abandon() {},
  };
  const { controller } = createController({ runtime });
  controller.selectMode("full_mock");
  await controller.start();
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.screen, "preflight");
  assert.equal(snapshot.exam, null);
  assert.match(snapshot.error, /Internal Server Error/);
});

test("an empty ASR result stays empty and is never replaced with a fabricated answer", async () => {
  let completedTranscript = "not-called";
  const runtime = {
    async start() { return { attempt_id: "att-empty", scoring_status: "COLLECTING" }; },
    questionAsked() {},
    completeTurn(transcript) { completedTranscript = transcript; },
  };
  const { controller } = createController({ runtime });
  controller.selectMode("practice_part", "part1");
  await controller.start();
  controller.submitAnswer("");
  assert.equal(completedTranscript, "");
  assert.equal(controller.getSnapshot().answers[0].transcript, "");
});
