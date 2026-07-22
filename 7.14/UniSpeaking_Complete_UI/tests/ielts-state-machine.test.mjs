import test from "node:test";
import assert from "node:assert/strict";

import { createExamState, transitionExam, allowedActions, currentExamItem } from "../src/ielts/exam-state-machine.mjs";

const question = (id, text) => ({ questionId: id, version: 1, order: 1, renderedText: text });
const fullPaper = {
  paperId: "paper_test",
  mode: "full_mock",
  selectedPart: null,
  timingProfile: "real_exam",
  timing: { introductionMaxSeconds: 60, part1AnswerMaxSeconds: 60, part2PrepSeconds: 60,
    part2AnswerMaxSeconds: 120, part3AnswerMaxSeconds: 60,
    part3SoftLimitSeconds: 240, part3HardLimitSeconds: 300 },
  parts: {
    part1: { questions: [question("p1q1", "Question one?"), question("p1q2", "Question two?")] },
    part2: { topicId: "p23_topic", cardId: "p23_topic", topicSentence: "Describe a person.",
      youShouldSay: ["who", "where", "why"], prepSeconds: 60 },
    part3: { topicId: "p23_topic", questions: [
      question("p23_topic_p3_q01", "Why do people influence others?"),
      question("p23_topic_p3_q02", "Has this changed?"),
    ] },
  },
};

test("full mock follows Opening, Introduction, Part 1, Part 2 and Part 3", () => {
  let state = transitionExam(createExamState(fullPaper), { type: "START" });
  assert.equal(state.status, "opening");
  assert.equal(currentExamItem(state), null);

  state = transitionExam(state, { type: "EXAMINER_DONE" });
  assert.equal(state.status, "introduction");
  assert.equal(currentExamItem(state).questionId, "introduction");

  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "part1_answering");
  assert.equal(currentExamItem(state).questionId, "p1q1");
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "part2_preparing");

  state = transitionExam(state, { type: "PREP_EXPIRED" });
  assert.equal(state.status, "part2_answering");
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "part3_answering");
  assert.equal(currentExamItem(state).questionId, "p23_topic_p3_q01");
  assert.equal(state.transitions.some((item) => item.to === "part2_rounding_off"), false);
});

test("Part 3 soft limit completes after the current answer and hard limit completes immediately", () => {
  let state = { ...createExamState(fullPaper), status: "part3_answering", currentPart: "part3", currentItemIndex: 0 };
  state = transitionExam(state, { type: "PART3_SOFT_LIMIT" });
  assert.equal(state.part3SoftLimitReached, true);
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "completed");

  let hard = { ...createExamState(fullPaper), status: "part3_answering", currentPart: "part3", currentItemIndex: 0 };
  hard = transitionExam(hard, { type: "PART3_HARD_LIMIT" });
  assert.equal(hard.status, "completed");
});

test("full mock rejects pause, retry and next without advancing", () => {
  const started = transitionExam(createExamState(fullPaper), { type: "START" });
  for (const type of ["PAUSE", "RETRY", "NEXT"]) {
    const state = transitionExam(started, { type });
    assert.equal(state.stateVersion, started.stateVersion);
    assert.match(state.lastError, /not allowed/i);
  }
});

test("Part practice skips Opening and Introduction and retains retry and next", () => {
  const practicePaper = { ...fullPaper, mode: "practice_part", selectedPart: "part1",
    parts: { part1: fullPaper.parts.part1, part2: null, part3: null } };
  let state = transitionExam(createExamState(practicePaper), { type: "START" });
  assert.equal(state.status, "part1_answering");
  state = transitionExam(state, { type: "RETRY" });
  assert.equal(state.attemptNo, 2);
  state = transitionExam(state, { type: "NEXT" });
  assert.equal(state.currentItemIndex, 1);
});

test("caption toggling changes display policy without advancing", () => {
  let state = transitionExam(createExamState(fullPaper), { type: "START" });
  state = transitionExam(state, { type: "TOGGLE_CAPTIONS" });
  assert.equal(state.captionsEnabled, true);
  assert.equal(state.status, "opening");
});

test("confirmed exit abandons a running full mock", () => {
  let state = transitionExam(createExamState(fullPaper), { type: "START" });
  state = transitionExam(state, { type: "EXIT_CONFIRMED" });
  assert.equal(state.status, "abandoned");
  assert.equal(state.completionKind, "user_abandoned");
  assert.equal(allowedActions(state).length, 0);
});
