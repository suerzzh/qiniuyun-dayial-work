import test from "node:test";
import assert from "node:assert/strict";

import { loadQuestionBank, validateQuestionBank } from "../src/ielts/question-bank.mjs";

const fixtures = {
  manifest: {
    bank_version: "2026.07.20-demo.1",
    schema_version: 1,
    files: { part1: "part1.json", part2: "part2.json", part3: "part3.json" },
    defaults: { recent_completed_sessions_to_avoid: 5, part2_prep_seconds: 60 },
  },
  part1: {
    groups: [
      {
        group_id: "p1_home",
        version: 1,
        status: "active",
        topic: "Home",
        training_level: "standard",
        questions: [
          { question_id: "p1_home_q1", version: 1, text: "Where do you live?" },
          { question_id: "p1_home_q2", version: 1, text: "What do you like about your home?" },
        ],
      },
      {
        group_id: "p1_work",
        version: 1,
        status: "active",
        topic: "Work",
        training_level: "standard",
        questions: [
          { question_id: "p1_work_q1", version: 1, text: "What work do you do?" },
          { question_id: "p1_work_q2", version: 1, text: "What do you enjoy about it?" },
        ],
      },
    ],
  },
  part2: {
    cards: [
      {
        card_id: "p2_person",
        version: 1,
        status: "active",
        topic_cluster: "people",
        training_level: "standard",
        topic_sentence: "Describe a person who has influenced you.",
        you_should_say: ["who this person is", "how you know them", "what they did"],
        explain: "and explain how this person influenced you.",
        rounding_off_questions: [
          { question_id: "p2_person_r1", version: 1, text: "Do you still see this person?" },
        ],
      },
    ],
  },
  part3: {
    groups: [
      {
        group_id: "p3_people",
        version: 1,
        status: "active",
        topic_cluster: "people",
        training_level: "standard",
        questions: [
          { question_id: "p3_people_q1", version: 1, text: "Who influences young people today?" },
          { question_id: "p3_people_q2", version: 1, text: "Has this changed over time?" },
        ],
      },
    ],
  },
};

const clone = (value) => structuredClone(value);

test("loads manifest files and normalizes the IELTS question bank", async () => {
  const requested = [];
  const values = {
    "manifest.json": fixtures.manifest,
    "part1.json": fixtures.part1,
    "part2.json": fixtures.part2,
    "part3.json": fixtures.part3,
  };
  const bank = await loadQuestionBank(async (path) => {
    requested.push(path);
    return clone(values[path]);
  });

  assert.deepEqual(requested, ["manifest.json", "part1.json", "part2.json", "part3.json"]);
  assert.equal(bank.bankVersion, "2026.07.20-demo.1");
  assert.equal(bank.config.part2PrepSeconds, 60);
  assert.equal(bank.part2Cards[0].topicCluster, "people");
  assert.ok(bank.part2Cards.every((card) =>
    bank.part3Groups.some((group) => group.topicCluster === card.topicCluster)));
});

test("rejects a Part 2 topic cluster without an active Part 3 group", () => {
  const invalid = clone(fixtures);
  invalid.part3.groups[0].topic_cluster = "technology";
  assert.throws(() => validateQuestionBank(invalid), /topic_cluster.*people/i);
});

test("rejects duplicate IDs across the bank", () => {
  const invalid = clone(fixtures);
  invalid.part3.groups[0].questions[0].question_id = "p1_home_q1";
  assert.throws(() => validateQuestionBank(invalid), /duplicate.*p1_home_q1/i);
});

test("rejects an incomplete Part 2 cue card", () => {
  const invalid = clone(fixtures);
  invalid.part2.cards[0].you_should_say = ["who this person is", "how you know them"];
  assert.throws(() => validateQuestionBank(invalid), /you_should_say/i);
});
