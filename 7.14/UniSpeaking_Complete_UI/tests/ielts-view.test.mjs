import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderIelts } from "../src/views/ielts.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const cueCard = {
  cardId: "p2_person",
  topicSentence: "Describe a person who has influenced you.",
  youShouldSay: ["who this person is", "how you know them", "what they did"],
  explain: "and explain how this person influenced you.",
  roundingOffQuestions: [],
};

const baseSession = {
  screen: "session",
  error: null,
  paper: {
    assemblyPolicy: { profile: "accelerated_demo" },
    parts: {
      part1: { questions: [{ questionId: "p1q1", renderedText: "Where do you live?" }] },
      part2: cueCard,
      part3: { topicCluster: "people", questions: [{ questionId: "p3q1", renderedText: "Who influences young people?" }] },
    },
  },
  exam: {
    mode: "full_mock",
    status: "part1_answering",
    currentPart: "part1",
    currentItemIndex: 0,
    attemptNo: 1,
    captionsEnabled: false,
    paper: null,
  },
  notes: "",
  notesLocked: true,
  captions: [{ role: "examiner", text: "Where do you live?" }],
  timer: null,
  answers: [],
};
baseSession.exam.paper = baseSession.paper;

const voiceSnapshot = (patch = {}) => ({
  status: "idle",
  finalTranscript: "",
  interimTranscript: "",
  elapsedSeconds: 0,
  permission: "unknown",
  message: "点击麦克风开始回答",
  ...patch,
});

test("IELTS home exposes Part 1, Part 2, Part 3 and full mock entries", () => {
  const html = renderIelts({ screen: "home", error: null });
  for (const label of ["Part 1 专项", "Part 2 专项", "Part 3 专项", "完整模拟考试"]) {
    assert.match(html, new RegExp(label));
  }
});

test("Part 2 answering renders the complete cue card and locked notes", () => {
  const snapshot = structuredClone(baseSession);
  snapshot.exam.status = "part2_answering";
  snapshot.exam.currentPart = "part2";
  snapshot.notes = "patient; encouraged me";
  snapshot.notesLocked = true;
  const html = renderIelts(snapshot);
  assert.match(html, /class="ielts-cue-card/);
  assert.match(html, /Describe a person who has influenced you/);
  assert.match(html, /You should say/);
  for (const bullet of cueCard.youShouldSay) assert.match(html, new RegExp(bullet));
  assert.match(html, /and explain how this person influenced you/);
  assert.match(html, /textarea[^>]+readonly/);
});

test("Part 2 preparation keeps notes editable and shows the accelerated countdown", () => {
  const snapshot = structuredClone(baseSession);
  snapshot.exam.status = "part2_preparing";
  snapshot.exam.currentPart = "part2";
  snapshot.notesLocked = false;
  snapshot.timer = { kind: "part2_preparation", remainingSeconds: 8, totalSeconds: 10 };
  const html = renderIelts(snapshot);
  assert.match(html, /00:08/);
  assert.match(html, /<textarea[^>]+data-action="ielts-update-notes"/);
  assert.doesNotMatch(html, /data-action="ielts-update-notes"[^>]+readonly/);
  assert.doesNotMatch(html, /ielts-mic-button/);
});

test("idle answer renders a microphone and an independent end-turn action", () => {
  const html = renderIelts(baseSession, voiceSnapshot());
  assert.match(html, /class="ielts-mic-button/);
  assert.match(html, /data-action="ielts-voice-start"/);
  assert.match(html, /data-action="ielts-voice-finish"/);
  assert.match(html, /开始说话/);
  assert.match(html, /结束本轮回答/);
});

test("listening and paused answers expose the correct microphone action", () => {
  const listening = renderIelts(baseSession, voiceSnapshot({ status: "listening", elapsedSeconds: 12 }));
  assert.match(listening, /data-action="ielts-voice-pause"/);
  assert.match(listening, /正在聆听/);
  assert.match(listening, /00:12/);
  const paused = renderIelts(baseSession, voiceSnapshot({ status: "paused", finalTranscript: "My answer" }));
  assert.match(paused, /data-action="ielts-voice-resume"/);
  assert.match(paused, /继续说话/);
  assert.match(paused, />My answer</);
});

test("fallback keeps an editable transcript and can finish the turn", () => {
  const html = renderIelts(baseSession, voiceSnapshot({ status: "fallback", message: "请直接输入回答" }));
  assert.match(html, /data-action="ielts-voice-transcript"/);
  assert.match(html, /请直接输入回答/);
  assert.match(html, /data-action="ielts-voice-finish"/);
});

test("full mock Part 1 hides the question card while captions are off", () => {
  const html = renderIelts(baseSession);
  assert.doesNotMatch(html, /data-current-question/);
  assert.doesNotMatch(html, />Where do you live\?</);
  assert.match(html, /请仔细听考官提问/);
});

test("full mock session has no pause, retry or skip controls", () => {
  const html = renderIelts(baseSession);
  assert.doesNotMatch(html, /data-action="ielts-retry"/);
  assert.doesNotMatch(html, /data-action="ielts-next"/);
  assert.doesNotMatch(html, /暂停考试/);
  assert.match(html, /结束本轮回答/);
});

test("report uses evidence feedback without a numeric IELTS score", () => {
  const html = renderIelts({
    screen: "report",
    exam: { status: "completed", mode: "full_mock" },
    report: {
      disclaimer: "本报告是参考 IELTS Speaking 维度的 AI 练习反馈，不是官方成绩。",
      summary: { answerCount: 6, captionsUsed: false, recordingEnabled: false },
      dimensions: {
        fluencyCoherence: { label: "Fluency & Coherence", status: "assessed", evidence: "evidence", strength: "strength", nextStep: "next" },
        pronunciation: { label: "Pronunciation", status: "not_assessed", evidence: "not assessed", strength: "none", nextStep: "record next time" },
      },
    },
  });
  assert.match(html, /AI 练习反馈/);
  assert.match(html, /Pronunciation/);
  assert.equal(/\b[0-9](?:\.5)?\s*\/\s*9\b/.test(html), false);
});

test("application wires the scene entry, IELTS route and controller actions", async () => {
  const [app, scenes] = await Promise.all([
    readFile(join(projectRoot, "src/app.mjs"), "utf8"),
    readFile(join(projectRoot, "src/views/scenes.mjs"), "utf8"),
  ]);
  assert.match(scenes, /href="#\/ielts"/);
  assert.match(app, /createIeltsDemoController/);
  assert.match(app, /route\.name === "ielts"/);
  assert.match(app, /captureIeltsNotesFocus/);
  assert.match(app, /restoreIeltsNotesFocus/);
  for (const action of [
    "ielts-select-mode", "ielts-toggle-recording", "ielts-start", "ielts-toggle-captions",
    "ielts-retry", "ielts-next", "ielts-exit", "ielts-restart",
  ]) assert.match(app, new RegExp(`action === "${action}"`));
});
