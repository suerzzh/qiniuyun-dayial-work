import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateQuestionBank } from "../src/ielts/question-bank.mjs";
import { assemblePaper } from "../src/ielts/paper-assembler.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(join(root, "public/ielts/question-bank", name), "utf8"));
const bank = validateQuestionBank({
  manifest: await readJson("manifest.json"),
  part1: await readJson("part1.json"),
  part2Part3: await readJson("part2_part3.json"),
});

const options = {
  mode: "full_mock",
  recentQuestionIds: [],
  random: () => 0,
  now: () => new Date("2026-07-21T08:00:00.000Z"),
};

test("freezes one atomic Part 2/3 source topic and never mixes its questions", () => {
  const paper = assemblePaper(bank, options);
  assert.equal(paper.part2Part3TopicId, paper.parts.part2.topicId);
  assert.equal(paper.parts.part3.topicId, paper.parts.part2.topicId);
  assert.ok(paper.parts.part3.questions.length >= 3);
  assert.ok(paper.parts.part3.questions.every((question) =>
    question.questionId.startsWith(`${paper.part2Part3TopicId}_p3_`)));
  assert.equal(Object.hasOwn(paper.parts.part2, "roundingOffQuestions"), false);
});

test("Part 1 selects four questions from one topic and preserves source order", () => {
  const paper = assemblePaper(bank, options);
  assert.equal(paper.parts.part1.questions.length, 4);
  assert.equal(new Set(paper.parts.part1.questions.map((item) => item.groupId)).size, 1);
  const orders = paper.parts.part1.questions.map((item) => item.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test("Part 1 can select five ordered questions", () => {
  const paper = assemblePaper(bank, { ...options, random: () => 0.999999 });
  assert.equal(paper.parts.part1.questions.length, 5);
  assert.equal(new Set(paper.parts.part1.questions.map((item) => item.groupId)).size, 1);
  const orders = paper.parts.part1.questions.map((item) => item.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test("stores the selected timing profile and immutable production durations", () => {
  const paper = assemblePaper(bank, options);
  assert.equal(paper.timingProfile, "real_exam");
  assert.equal(paper.timing.introductionMaxSeconds, 60);
  assert.equal(paper.timing.part3HardLimitSeconds, 300);
  assert.equal(paper.assemblyPolicy.profile, "real_exam");
  assert.throws(() => { paper.parts.part1.questions.push({}); }, TypeError);

  const accelerated = assemblePaper(bank, { ...options, timingProfile: "accelerated_demo" });
  assert.equal(accelerated.timing.part2PrepSeconds, 10);
  assert.equal(accelerated.timing.part3HardLimitSeconds, 75);
});

test("Part 2 practice assembles only the cue-card flow from an atomic bundle", () => {
  const paper = assemblePaper(bank, { ...options, mode: "practice_part", selectedPart: "part2" });
  assert.equal(paper.parts.part1, null);
  assert.ok(paper.parts.part2.topicSentence);
  assert.ok(paper.part2Part3TopicId);
  assert.equal(paper.parts.part3, null);
});
