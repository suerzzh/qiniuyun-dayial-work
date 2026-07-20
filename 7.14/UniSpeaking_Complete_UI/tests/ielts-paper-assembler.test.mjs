import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateQuestionBank } from "../src/ielts/question-bank.mjs";
import { assemblePaper } from "../src/ielts/paper-assembler.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(join(root, "backend/ielts/question_bank", name), "utf8"));
const bank = validateQuestionBank({
  manifest: await readJson("manifest.json"),
  part1: await readJson("part1.json"),
  part2: await readJson("part2.json"),
  part3: await readJson("part3.json"),
});

const options = {
  mode: "full_mock",
  recentQuestionIds: [],
  random: () => 0,
  now: () => new Date("2026-07-20T08:00:00.000Z"),
};

test("links Part 3 to the selected Part 2 topic cluster", () => {
  const paper = assemblePaper(bank, options);
  assert.equal(paper.parts.part3.topicCluster, paper.parts.part2.topicCluster);
  assert.equal(paper.parts.part1.questions.length, 2);
  assert.equal(paper.parts.part2.roundingOffQuestions.length, 1);
  assert.equal(paper.parts.part3.questions.length, 2);
});

test("avoids recent cards and questions while fresh candidates remain", () => {
  const paper = assemblePaper(bank, {
    ...options,
    recentQuestionIds: ["p2_person_001", "p1_home_001_q1", "p3_people_001_q1"],
  });
  assert.notEqual(paper.parts.part2.cardId, "p2_person_001");
  const usedIds = [
    ...paper.parts.part1.questions.map((item) => item.questionId),
    paper.parts.part2.cardId,
    ...paper.parts.part3.questions.map((item) => item.questionId),
  ];
  assert.equal(usedIds.includes("p1_home_001_q1"), false);
});

test("stores rendered text, versions and assembly policy in an immutable snapshot", () => {
  const paper = assemblePaper(bank, options);
  assert.equal(paper.bankVersion, "2026.07.20-demo.1");
  assert.equal(paper.assemblyPolicy.profile, "accelerated_demo");
  assert.match(paper.paperId, /^paper_20260720T080000/);
  assert.ok(paper.parts.part1.questions.every((item) => item.renderedText && item.version === 1));
  assert.throws(() => { paper.parts.part1.questions.push({}); }, TypeError);
});

test("Part 2 practice assembles only the cue-card flow", () => {
  const paper = assemblePaper(bank, { ...options, mode: "practice_part", selectedPart: "part2" });
  assert.equal(paper.parts.part1, null);
  assert.ok(paper.parts.part2.topicSentence);
  assert.equal(paper.parts.part3, null);
});
