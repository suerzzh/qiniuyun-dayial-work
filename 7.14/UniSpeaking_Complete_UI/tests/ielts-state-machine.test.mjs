import test from "node:test";
import assert from "node:assert/strict";

import { createExamState, transitionExam, allowedActions, currentExamItem } from "../src/ielts/exam-state-machine.mjs";

const question = (id, text) => ({ questionId: id, version: 1, renderedText: text, probes: [] });
const fullPaper = {
  paperId: "paper_test",
  mode: "full_mock",
  selectedPart: null,
  parts: {
    part1: { questions: [question("p1q1", "Question one?"), question("p1q2", "Question two?")] },
    part2: {
      cardId: "p2card",
      topicSentence: "Describe a person.",
      youShouldSay: ["who", "where", "why"],
      explain: "and explain the influence.",
      roundingOffQuestions: [question("p2r1", "Do you still meet this person?")],
      prepSeconds: 60,
    },
    part3: { questions: [question("p3q1", "Why do people influence others?"), question("p3q2", "Has this changed?")] },
  },
};

test("full mock follows Part 1, timed Part 2 and Part 3 in order", () => {
  let state = createExamState(fullPaper, { captionsEnabled: false, recordingEnabled: false });
  state = transitionExam(state, { type: "START" });
  assert.equal(state.status, "part1_answering");
  assert.equal(currentExamItem(state).questionId, "p1q1");

  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "part2_preparing");
  assert.equal(currentExamItem(state).cardId, "p2card");

  state = transitionExam(state, { type: "PREP_EXPIRED" });
  assert.equal(state.status, "part2_answering");
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "part2_rounding_off");
  assert.equal(currentExamItem(state).questionId, "p2r1");

  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "part3_answering");
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  state = transitionExam(state, { type: "SUBMIT_ANSWER" });
  assert.equal(state.status, "completed");
  assert.equal(allowedActions(state).length, 0);
});

test("full mock rejects pause, retry and next without advancing", () => {
  const started = transitionExam(createExamState(fullPaper), { type: "START" });
  for (const type of ["PAUSE", "RETRY", "NEXT"]) {
    const state = transitionExam(started, { type });
    assert.equal(state.currentItemIndex, 0);
    assert.equal(state.stateVersion, started.stateVersion);
    assert.match(state.lastError, /not allowed/i);
  }
});

test("Part practice allows retry and next", () => {
  const practicePaper = {
    ...fullPaper,
    mode: "practice_part",
    selectedPart: "part1",
    parts: { part1: fullPaper.parts.part1, part2: null, part3: null },
  };
  let state = transitionExam(createExamState(practicePaper), { type: "START" });
  state = transitionExam(state, { type: "RETRY" });
  assert.equal(state.attemptNo, 2);
  assert.equal(state.currentItemIndex, 0);
  state = transitionExam(state, { type: "NEXT" });
  assert.equal(state.currentItemIndex, 1);
  assert.equal(state.attemptNo, 1);
});

test("caption toggling changes display policy without advancing the exam", () => {
  let state = transitionExam(createExamState(fullPaper), { type: "START" });
  const version = state.stateVersion;
  state = transitionExam(state, { type: "TOGGLE_CAPTIONS" });
  assert.equal(state.captionsEnabled, true);
  assert.equal(state.currentItemIndex, 0);
  assert.equal(state.stateVersion, version + 1);
});

test("confirmed exit abandons a running full mock", () => {
  let state = transitionExam(createExamState(fullPaper), { type: "START" });
  state = transitionExam(state, { type: "EXIT_CONFIRMED" });
  assert.equal(state.status, "abandoned");
  assert.equal(state.completionKind, "user_abandoned");
});
