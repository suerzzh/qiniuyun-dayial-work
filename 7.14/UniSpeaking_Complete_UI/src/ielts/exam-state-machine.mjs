const TERMINAL_STATES = new Set(["completed", "abandoned", "technical_interrupted"]);

const EVENT_ACTION = {
  START: "start",
  EXAMINER_DONE: "examiner_done",
  SUBMIT_ANSWER: "submit_answer",
  PREP_EXPIRED: "prep_expired",
  PART3_SOFT_LIMIT: "part3_soft_limit",
  PART3_HARD_LIMIT: "part3_hard_limit",
  TOGGLE_CAPTIONS: "toggle_captions",
  RETRY: "retry",
  NEXT: "next",
  PAUSE: "pause",
  EXIT_CONFIRMED: "exit",
};

function isRunning(state) {
  return state.status !== "ready" && !TERMINAL_STATES.has(state.status);
}

export function allowedActions(state) {
  if (!state || TERMINAL_STATES.has(state.status)) return [];
  if (state.status === "ready") return ["start"];
  const actions = ["toggle_captions", "exit"];
  if (state.status === "opening") actions.push("examiner_done");
  if (state.status === "part2_preparing") actions.push("prep_expired");
  if (state.status === "part3_answering") actions.push("part3_soft_limit", "part3_hard_limit");
  if (new Set(["introduction", "part1_answering", "part2_answering", "part3_answering"]).has(state.status)) {
    actions.push("submit_answer");
    if (state.mode === "practice_part" && state.status !== "introduction") actions.push("retry", "next");
  }
  return actions;
}

export function currentExamItem(state) {
  if (!state?.paper) return null;
  if (state.status === "introduction") {
    return { questionId: "introduction", renderedText: "Please introduce yourself.", turnType: "INTRODUCTION" };
  }
  if (state.status === "part1_answering") return state.paper.parts.part1?.questions[state.currentItemIndex] || null;
  if (state.status === "part2_preparing" || state.status === "part2_answering") return state.paper.parts.part2 || null;
  if (state.status === "part3_answering") return state.paper.parts.part3?.questions[state.currentItemIndex] || null;
  return null;
}

export function createExamState(paper, policy = {}) {
  if (!paper?.parts) throw new Error("PaperSnapshot is required to create an IELTS exam state");
  return {
    paper,
    mode: paper.mode,
    selectedPart: paper.selectedPart,
    status: "ready",
    currentPart: null,
    currentItemIndex: 0,
    attemptNo: 1,
    stateVersion: 0,
    captionsEnabled: Boolean(policy.captionsEnabled),
    recordingEnabled: Boolean(policy.recordingEnabled),
    part3SoftLimitReached: false,
    completionKind: null,
    lastError: null,
    transitions: [],
  };
}

function firstState(state) {
  if (state.mode === "full_mock") return { status: "opening", currentPart: null };
  if (state.selectedPart === "part1" && state.paper.parts.part1) return { status: "part1_answering", currentPart: "part1" };
  if (state.selectedPart === "part2" && state.paper.parts.part2) return { status: "part2_preparing", currentPart: "part2" };
  if (state.selectedPart === "part3" && state.paper.parts.part3) return { status: "part3_answering", currentPart: "part3" };
  throw new Error(`Paper does not contain selected IELTS part: ${state.selectedPart}`);
}

function completedPatch() {
  return { status: "completed", currentPart: null, currentItemIndex: 0,
    attemptNo: 1, completionKind: "completed" };
}

function afterIntroduction() {
  return { status: "part1_answering", currentPart: "part1", currentItemIndex: 0, attemptNo: 1 };
}

function afterPart1(state) {
  if (state.currentItemIndex + 1 < state.paper.parts.part1.questions.length) {
    return { currentItemIndex: state.currentItemIndex + 1, attemptNo: 1 };
  }
  if (state.mode === "practice_part") return completedPatch();
  return { status: "part2_preparing", currentPart: "part2", currentItemIndex: 0, attemptNo: 1 };
}

function afterPart2Answer(state) {
  if (state.mode === "practice_part") return completedPatch();
  return { status: "part3_answering", currentPart: "part3", currentItemIndex: 0,
    attemptNo: 1, part3SoftLimitReached: false };
}

function afterPart3(state) {
  if (state.part3SoftLimitReached) return completedPatch();
  if (state.currentItemIndex + 1 < state.paper.parts.part3.questions.length) {
    return { currentItemIndex: state.currentItemIndex + 1, attemptNo: 1 };
  }
  return completedPatch();
}

function advanceAnswer(state) {
  if (state.status === "introduction") return afterIntroduction();
  if (state.status === "part1_answering") return afterPart1(state);
  if (state.status === "part2_answering") return afterPart2Answer(state);
  if (state.status === "part3_answering") return afterPart3(state);
  throw new Error(`Cannot advance answer from ${state.status}`);
}

function validPatch(state, event) {
  if (event.type === "START") return { ...firstState(state), currentItemIndex: 0, attemptNo: 1 };
  if (event.type === "EXAMINER_DONE") return { status: "introduction", currentPart: "introduction", currentItemIndex: 0 };
  if (event.type === "SUBMIT_ANSWER" || event.type === "NEXT") return advanceAnswer(state);
  if (event.type === "PREP_EXPIRED") return { status: "part2_answering", currentPart: "part2", currentItemIndex: 0, attemptNo: 1 };
  if (event.type === "PART3_SOFT_LIMIT") return { part3SoftLimitReached: true };
  if (event.type === "PART3_HARD_LIMIT") return completedPatch();
  if (event.type === "TOGGLE_CAPTIONS") return { captionsEnabled: !state.captionsEnabled };
  if (event.type === "RETRY") return { attemptNo: state.attemptNo + 1 };
  if (event.type === "EXIT_CONFIRMED") return { status: "abandoned", completionKind: "user_abandoned", currentPart: null };
  throw new Error(`Unhandled IELTS exam event: ${event.type}`);
}

export function transitionExam(state, event) {
  if (!state || !event?.type) throw new Error("IELTS exam transition requires state and event.type");
  if (TERMINAL_STATES.has(state.status)) return state;
  const action = EVENT_ACTION[event.type];
  if (!action || !allowedActions(state).includes(action)) {
    return { ...state, lastError: `${event.type} is not allowed in ${state.status}` };
  }
  const patch = validPatch(state, event);
  const next = { ...state, ...patch, stateVersion: state.stateVersion + 1, lastError: null };
  next.transitions = [...state.transitions, { event: event.type, from: state.status, to: next.status, version: next.stateVersion }];
  return next;
}

export function isExamRunning(state) {
  return isRunning(state);
}
