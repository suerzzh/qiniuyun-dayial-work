import test from "node:test";
import assert from "node:assert/strict";

import { createExaminerPromptCatalog } from "../src/ielts/examiner-prompt-catalog.mjs";

test("uses the approved fixed Hello opening and configurable examiner name", () => {
  const prompts = createExaminerPromptCatalog({ examinerName: "Alex" });
  assert.equal(prompts.opening,
    "Hello. My name is Alex, and I’ll be your examiner for this IELTS Speaking practice test. Welcome. Before we begin, please introduce yourself. You have up to one minute.");
  assert.doesNotMatch(prompts.opening, /Good morning|Good afternoon/);
  assert.match(prompts.version, /^ielts-examiner-/);
});

test("Part 2 preparation and start scripts never read the selected cue card", () => {
  const prompts = createExaminerPromptCatalog();
  assert.equal(prompts.part2Preparation,
    "Now, I’m going to give you a topic. You have one minute to think and prepare. You may make notes.");
  assert.equal(prompts.part2Start,
    "Your preparation time is over. You may begin speaking now.");
  assert.doesNotMatch(`${prompts.part2Preparation} ${prompts.part2Start}`, /Describe a famous person/);
});

test("all examiner scripts and exact-question instructions are English-only and deterministic", () => {
  const prompts = createExaminerPromptCatalog();
  const fixed = [prompts.opening, prompts.part1Start, prompts.part2Preparation,
    prompts.part2Start, prompts.part3Start, prompts.ending];
  assert.equal(fixed.some((value) => /[\u4e00-\u9fff]/.test(value)), false);
  assert.equal(prompts.askQuestion("Where do you live?"),
    "Ask exactly this IELTS question, then wait silently: Where do you live?");
});
