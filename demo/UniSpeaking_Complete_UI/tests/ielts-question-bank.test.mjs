import test from "node:test";
import assert from "node:assert/strict";

import { loadQuestionBank, validateQuestionBank } from "../src/ielts/question-bank.mjs";

const question = (id, order, text) => ({
  question_id: id, version: 1, order, text, eligible: true, needs_review: false, warnings: [],
});

const fixtures = {
  manifest: {
    bank_version: "2026.01-04.2026-built.1",
    schema_version: 2,
    files: { part1: "part1.json", part2_part3: "part2_part3.json" },
    defaults: {
      recent_completed_sessions_to_avoid: 5,
      real_exam: {
        introduction_max_seconds: 60, part1_answer_max_seconds: 60,
        part2_prep_seconds: 60, part2_answer_max_seconds: 120,
        part3_answer_max_seconds: 60, part3_soft_limit_seconds: 240, part3_hard_limit_seconds: 300,
      },
      accelerated_demo: {
        introduction_max_seconds: 15, part1_answer_max_seconds: 20,
        part2_prep_seconds: 10, part2_answer_max_seconds: 45,
        part3_answer_max_seconds: 20, part3_soft_limit_seconds: 60, part3_hard_limit_seconds: 75,
      },
    },
  },
  part1: {
    groups: [
      {
        group_id: "p1_home", version: 1, status: "active", eligible: true,
        topic: "Home", training_level: "standard", sequence: 1,
        questions: [1, 2, 3, 4, 5].map((order) => question(`p1_home_q${order}`, order, `Home question ${order}?`)),
      },
      {
        group_id: "p1_work", version: 1, status: "active", eligible: true,
        topic: "Work", training_level: "standard", sequence: 2,
        questions: [1, 2, 3, 4, 5].map((order) => question(`p1_work_q${order}`, order, `Work question ${order}?`)),
      },
    ],
  },
  part2Part3: {
    bundles: [
      {
        topic_id: "p23_famous", version: 1, status: "active", eligible: true,
        title: "Famous person", sequence: 1,
        part2: {
          card_id: "p23_famous", topic_sentence: "Describe a famous person.",
          cue_points: [
            { cue_id: "p23_famous_c1", order: 1, text: "who the person is" },
            { cue_id: "p23_famous_c2", order: 2, text: "how you know them" },
            { cue_id: "p23_famous_c3", order: 3, text: "why you want to meet them" },
          ],
        },
        part3: { questions: [
          question("p23_famous_p3_q01", 1, "Why do people become famous?"),
          question("p23_famous_p3_q02", 2, "Is fame always positive?"),
        ] },
      },
    ],
  },
};

const clone = (value) => structuredClone(value);

test("loads the Part 1 and atomic Part 2/3 manifest files", async () => {
  const requested = [];
  const values = {
    "manifest.json": fixtures.manifest,
    "part1.json": fixtures.part1,
    "part2_part3.json": fixtures.part2Part3,
  };
  const bank = await loadQuestionBank(async (path) => {
    requested.push(path);
    return clone(values[path]);
  });

  assert.deepEqual(requested, ["manifest.json", "part1.json", "part2_part3.json"]);
  assert.equal(bank.bankVersion, "2026.01-04.2026-built.1");
  assert.equal(bank.config.realExam.part2PrepSeconds, 60);
  assert.equal(bank.part2Part3Bundles[0].topicId, "p23_famous");
  assert.ok(bank.part2Part3Bundles[0].part3Questions.every((item) => item.questionId.startsWith("p23_famous_p3_")));
});

test("rejects a Part 3 question that does not belong to its atomic source topic", () => {
  const invalid = clone(fixtures);
  invalid.part2Part3.bundles[0].part3.questions[0].question_id = "p23_other_p3_q01";
  assert.throws(() => validateQuestionBank({
    manifest: invalid.manifest, part1: invalid.part1, part2Part3: invalid.part2Part3,
  }), /does not belong.*p23_famous/i);
});

test("rejects duplicate IDs across the atomic bank", () => {
  const invalid = clone(fixtures);
  invalid.part2Part3.bundles[0].part3.questions[0].question_id = "p1_home_q1";
  assert.throws(() => validateQuestionBank({
    manifest: invalid.manifest, part1: invalid.part1, part2Part3: invalid.part2Part3,
  }), /duplicate.*p1_home_q1/i);
});

test("rejects an incomplete Part 2 cue card", () => {
  const invalid = clone(fixtures);
  invalid.part2Part3.bundles[0].part2.cue_points = invalid.part2Part3.bundles[0].part2.cue_points.slice(0, 2);
  assert.throws(() => validateQuestionBank({
    manifest: invalid.manifest, part1: invalid.part1, part2Part3: invalid.part2Part3,
  }), /cue_points/i);
});
