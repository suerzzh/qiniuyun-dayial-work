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
    demoPrepSeconds: 10,
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
  controller.submitAnswer("Yes, I still keep in touch with her.");
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.screen, "report");
  assert.equal(snapshot.exam.status, "completed");
  assert.equal(snapshot.report.dimensions.pronunciation.status, "not_assessed");
  assert.equal(/\b[0-9](?:\.5)?\s*\/\s*9\b/.test(JSON.stringify(snapshot.report)), false);
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
