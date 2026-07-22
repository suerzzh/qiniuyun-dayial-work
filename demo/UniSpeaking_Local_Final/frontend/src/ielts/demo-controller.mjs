import { loadQuestionBank } from "./question-bank.mjs";
import { assemblePaper } from "./paper-assembler.mjs";
import { createExamState, currentExamItem, transitionExam } from "./exam-state-machine.mjs";
import { buildPracticeFeedback } from "./feedback.mjs";
import { createExaminerPromptCatalog } from "./examiner-prompt-catalog.mjs";

const HISTORY_KEY = "unispeaking-ielts-demo-history";

function defaultClock() {
  return {
    now: () => new Date(),
    setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
    clearInterval: (id) => globalThis.clearInterval(id),
  };
}

function createHomeSnapshot() {
  return {
    screen: "home", loading: false, error: null, selection: null,
    preflight: { captionsEnabled: false, recordingEnabled: false, acceleratedDemo: false },
    sessionPolicy: null, paper: null, exam: null, notes: "", notesLocked: true,
    answers: [], captions: [], captionsUsed: false, timer: null, part3Timer: null,
    report: null, attemptId: null, scoringStatus: null,
  };
}

function parseHistory(storage) {
  try {
    const value = JSON.parse(storage?.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function collectPaperIds(paper) {
  if (!paper?.parts) return [];
  return [
    ...(paper.parts.part1?.groups || []).map((group) => group.groupId),
    ...(paper.parts.part1?.questions || []).map((question) => question.questionId),
    ...(paper.part2Part3TopicId ? [paper.part2Part3TopicId] : []),
    ...(paper.parts.part3?.questions || []).map((question) => question.questionId),
  ];
}

function recentQuestionIds(storage) {
  return parseHistory(storage).slice(0, 5).flatMap((entry) => entry.questionIds || []);
}

function saveCompletedHistory(storage, paper, completedAt) {
  if (!storage?.setItem) return;
  const history = parseHistory(storage);
  history.unshift({ completedAt, questionIds: collectPaperIds(paper) });
  storage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
}

function cardQuestionText(card) {
  const cues = Array.isArray(card?.youShouldSay) ? ` You should say: ${card.youShouldSay.join("; ")}.` : "";
  return `${card?.topicSentence || ""}${cues}`.trim();
}

function questionText(item, examStatus) {
  if (!item) return "";
  if (examStatus === "introduction") return "Please introduce yourself.";
  if (examStatus === "part2_answering" || examStatus === "part2_preparing") return cardQuestionText(item);
  return item.renderedText || item.topicSentence || "";
}

function answerQuestionId(item) {
  return item?.questionId || item?.cardId || "unknown";
}

export function createIeltsDemoController(dependencies) {
  dependencies ||= {};
  const loadJson = typeof dependencies.loadJson === "function" ? dependencies.loadJson : async (name) => {
    const response = await fetch(`/ielts/question-bank/${name}`);
    if (!response.ok) throw new Error(`题库加载失败（${response.status}）`);
    return response.json();
  };
  const clock = dependencies.clock || defaultClock();
  const random = dependencies.random || Math.random;
  const storage = dependencies.storage || null;
  const speak = typeof dependencies.speak === "function" ? dependencies.speak : () => {};
  const prompts = createExaminerPromptCatalog({ examinerName: dependencies.examinerName || "Alex" });
  let snapshot = createHomeSnapshot();
  let stageTimerId = null;
  let part3TimerId = null;
  let answerStartedAt = null;
  let part3ElapsedSeconds = 0;

  const publish = () => dependencies.onChange?.(structuredClone(snapshot));
  const clearStageTimer = () => {
    if (stageTimerId !== null) clock.clearInterval(stageTimerId);
    stageTimerId = null;
  };
  const clearPart3Timer = () => {
    if (part3TimerId !== null) clock.clearInterval(part3TimerId);
    part3TimerId = null;
    part3ElapsedSeconds = 0;
    snapshot.part3Timer = null;
  };
  const clearTimers = () => { clearStageTimer(); clearPart3Timer(); };
  const setNotesLock = () => { snapshot.notesLocked = snapshot.exam?.status !== "part2_preparing"; };
  const addExaminerCaption = (text) => {
    if (text) snapshot.captions.push({ role: "examiner", text, at: clock.now().toISOString() });
  };
  const sayInstruction = (text, onDone = () => {}) => {
    addExaminerCaption(text);
    speak(text);
    if (dependencies.runtime) dependencies.runtime.examinerInstruction(text, onDone);
    else onDone();
  };
  const startCountdown = (kind, totalSeconds, onExpired) => {
    clearStageTimer();
    const total = Math.max(1, Number(totalSeconds) || 1);
    snapshot.timer = { kind, totalSeconds: total, remainingSeconds: total };
    stageTimerId = clock.setInterval(() => {
      snapshot.timer.remainingSeconds = Math.max(0, snapshot.timer.remainingSeconds - 1);
      if (snapshot.timer.remainingSeconds === 0) {
        clearStageTimer();
        onExpired();
        return;
      }
      if (typeof dependencies.onTimer === "function") dependencies.onTimer(structuredClone(snapshot));
      else publish();
    }, 1000);
  };
  const timeLimitTranscript = () => String(dependencies.onAnswerTimeLimit?.() || "");
  const startPart3OverallTimer = () => {
    if (part3TimerId !== null) return;
    const timing = snapshot.paper.timing;
    part3ElapsedSeconds = 0;
    snapshot.part3Timer = { elapsedSeconds: 0, softLimitSeconds: timing.part3SoftLimitSeconds,
      hardLimitSeconds: timing.part3HardLimitSeconds, softLimitReached: false };
    part3TimerId = clock.setInterval(() => {
      part3ElapsedSeconds += 1;
      snapshot.part3Timer.elapsedSeconds = part3ElapsedSeconds;
      if (!snapshot.exam?.part3SoftLimitReached && part3ElapsedSeconds >= timing.part3SoftLimitSeconds) {
        snapshot.exam = transitionExam(snapshot.exam, { type: "PART3_SOFT_LIMIT" });
        snapshot.part3Timer.softLimitReached = true;
      }
      if (part3ElapsedSeconds >= timing.part3HardLimitSeconds && snapshot.exam?.status === "part3_answering") {
        clearPart3Timer();
        controller.submitAnswer(timeLimitTranscript(), "TIME_LIMIT");
        return;
      }
      if (typeof dependencies.onTimer === "function") dependencies.onTimer(structuredClone(snapshot));
      else publish();
    }, 1000);
  };
  const startAnswerTimer = () => {
    const status = snapshot.exam.status;
    const timing = snapshot.paper.timing;
    const seconds = status === "introduction" ? timing.introductionMaxSeconds
      : status === "part1_answering" ? timing.part1AnswerMaxSeconds
        : status === "part2_answering" ? timing.part2AnswerMaxSeconds
          : timing.part3AnswerMaxSeconds;
    const kind = status === "introduction" ? "introduction_answer" : `${snapshot.exam.currentPart}_answer`;
    answerStartedAt = clock.now();
    if (status === "part3_answering") startPart3OverallTimer();
    startCountdown(kind, seconds, () => controller.submitAnswer(timeLimitTranscript(), "TIME_LIMIT"));
    publish();
  };
  const openSilentTurn = (item, { part, longTurn = false, turnType = "STANDARD", scoringEligible = true } = {}) => {
    dependencies.runtime?.openTurn?.({ part, questionId: answerQuestionId(item),
      questionText: questionText(item, snapshot.exam.status), longTurn, turnType, scoringEligible });
  };
  const askCurrentQuestion = () => {
    const item = currentExamItem(snapshot.exam);
    const text = questionText(item, snapshot.exam.status);
    if (!text) return;
    addExaminerCaption(text);
    speak(text);
    const part = Number(String(snapshot.exam.currentPart || "part1").replace("part", ""));
    if (dependencies.runtime) {
      dependencies.runtime.questionAsked({ part, questionId: answerQuestionId(item), questionText: text,
        longTurn: false, onDone: startAnswerTimer });
    } else startAnswerTimer();
  };
  const startIntroduction = () => {
    const item = currentExamItem(snapshot.exam);
    openSilentTurn(item, { part: 0, turnType: "INTRODUCTION", scoringEligible: false });
    startAnswerTimer();
  };
  const startPart2Answer = () => {
    const item = currentExamItem(snapshot.exam);
    openSilentTurn(item, { part: 2, longTurn: true, turnType: "PART2_LONG_TURN", scoringEligible: true });
    startAnswerTimer();
  };

  const finishSession = () => {
    clearTimers();
    snapshot.timer = null;
    const session = { status: snapshot.exam.status, mode: snapshot.exam.mode,
      recordingEnabled: snapshot.sessionPolicy.recordingEnabled, captionsUsed: snapshot.captionsUsed,
      answers: snapshot.answers, notes: snapshot.notes };
    snapshot.report = dependencies.runtime
      ? { scoring_status: "FINALIZING", disclaimer: "评分生成中，请稍候…" }
      : buildPracticeFeedback(session);
    snapshot.scoringStatus = dependencies.runtime ? "FINALIZING" : "COMPLETE";
    snapshot.screen = "report";
    if (snapshot.exam.status === "completed") saveCompletedHistory(storage, snapshot.paper, clock.now().toISOString());
    if (dependencies.runtime && snapshot.exam.status === "completed") {
      dependencies.runtime.finalize().then((report) => {
        snapshot.report = report;
        snapshot.scoringStatus = report.scoringStatus || report.scoring_status || "PARTIAL";
        publish();
      }).catch((error) => {
        snapshot.scoringStatus = "UNSCORABLE";
        snapshot.report = { scoring_status: "UNSCORABLE", overallBand: null,
          disclaimer: "本次评分服务不可用，未生成分数。", dataQualityWarnings: [error.message] };
        publish();
      });
    }
  };
  const afterTransition = (previousStatus) => {
    setNotesLock();
    if (snapshot.exam.status === "completed") {
      sayInstruction(prompts.ending);
      finishSession();
      publish();
      return;
    }
    if (snapshot.exam.status === "abandoned") { finishSession(); publish(); return; }
    snapshot.timer = null;
    if (snapshot.exam.status === "opening") {
      sayInstruction(prompts.opening, () => dispatch({ type: "EXAMINER_DONE" }));
    } else if (snapshot.exam.status === "introduction") {
      startIntroduction();
    } else if (snapshot.exam.status === "part1_answering") {
      if (previousStatus === "introduction") sayInstruction(prompts.part1Start, askCurrentQuestion);
      else askCurrentQuestion();
    } else if (snapshot.exam.status === "part2_preparing") {
      sayInstruction(prompts.part2Preparation, () => startCountdown("part2_preparation",
        snapshot.paper.timing.part2PrepSeconds, () => controller.expirePreparationForTest()));
    } else if (snapshot.exam.status === "part2_answering") {
      sayInstruction(prompts.part2Start, startPart2Answer);
    } else if (snapshot.exam.status === "part3_answering") {
      if (previousStatus === "part2_answering") sayInstruction(prompts.part3Start, askCurrentQuestion);
      else askCurrentQuestion();
    }
    publish();
  };
  const dispatch = (event) => {
    const previousStatus = snapshot.exam.status;
    snapshot.exam = transitionExam(snapshot.exam, event);
    if (snapshot.exam.lastError) { snapshot.error = snapshot.exam.lastError; publish(); return; }
    snapshot.error = null;
    afterTransition(previousStatus);
  };

  const controller = {
    getSnapshot() { return structuredClone(snapshot); },
    openHome() { clearTimers(); snapshot = createHomeSnapshot(); publish(); },
    selectMode(mode, selectedPart = null) {
      if (!new Set(["full_mock", "practice_part"]).has(mode)) throw new Error(`Unsupported IELTS mode: ${mode}`);
      if (mode === "practice_part" && !new Set(["part1", "part2", "part3"]).has(selectedPart)) {
        throw new Error("Part practice requires part1, part2 or part3");
      }
      clearTimers();
      snapshot = { ...createHomeSnapshot(), screen: "preflight", selection: { mode, selectedPart },
        preflight: { captionsEnabled: mode === "practice_part", recordingEnabled: false,
          acceleratedDemo: mode === "practice_part" } };
      publish();
    },
    setPreflight(patch) {
      if (snapshot.screen !== "preflight" || snapshot.exam) throw new Error("Recording and initial caption preferences can only change before start");
      snapshot.preflight = { ...snapshot.preflight,
        ...(Object.hasOwn(patch, "captionsEnabled") ? { captionsEnabled: Boolean(patch.captionsEnabled) } : {}),
        ...(Object.hasOwn(patch, "recordingEnabled") ? { recordingEnabled: Boolean(patch.recordingEnabled) } : {}),
        ...(Object.hasOwn(patch, "acceleratedDemo") ? { acceleratedDemo: Boolean(patch.acceleratedDemo) } : {}) };
      publish();
    },
    async start() {
      if (snapshot.screen !== "preflight" || !snapshot.selection) throw new Error("Select an IELTS mode before start");
      snapshot.loading = true; snapshot.error = null; publish();
      try {
        const bank = await loadQuestionBank(loadJson);
        const timingProfile = snapshot.selection.mode === "full_mock" && !snapshot.preflight.acceleratedDemo
          ? "real_exam" : "accelerated_demo";
        const paper = assemblePaper(bank, { mode: snapshot.selection.mode,
          selectedPart: snapshot.selection.selectedPart, recentQuestionIds: recentQuestionIds(storage),
          random, now: clock.now, timingProfile, promptVersion: prompts.version });
        snapshot.paper = paper;
        snapshot.sessionPolicy = { ...snapshot.preflight, timingProfile };
        snapshot.exam = transitionExam(createExamState(paper, snapshot.sessionPolicy), { type: "START" });
        snapshot.screen = "session"; snapshot.loading = false; snapshot.answers = [];
        snapshot.captions = []; snapshot.notes = ""; snapshot.captionsUsed = snapshot.exam.captionsEnabled;
        if (dependencies.runtime) {
          const remote = await dependencies.runtime.start({ mode: snapshot.selection.mode, paperSnapshot: paper });
          snapshot.attemptId = remote.attempt_id;
          snapshot.scoringStatus = remote.scoring_status || "COLLECTING";
        }
        setNotesLock();
        afterTransition("ready");
      } catch (error) {
        await dependencies.runtime?.abandon?.().catch?.(() => {});
        snapshot.loading = false; snapshot.screen = "preflight"; snapshot.paper = null;
        snapshot.exam = null; snapshot.sessionPolicy = null; snapshot.attemptId = null;
        snapshot.scoringStatus = null; snapshot.error = error.message || "IELTS Demo failed to start";
        publish();
      }
    },
    updateNotes(text) {
      if (snapshot.exam?.status !== "part2_preparing") throw new Error("Notes are editable only during Part 2 preparation");
      snapshot.notes = String(text || ""); publish();
    },
    expirePreparationForTest() {
      if (snapshot.exam?.status !== "part2_preparing") return;
      clearStageTimer(); snapshot.timer = null; dispatch({ type: "PREP_EXPIRED" });
    },
    submitAnswer(text = "", reason = "USER_DONE") {
      if (!snapshot.exam) throw new Error("No IELTS exam is running");
      const item = currentExamItem(snapshot.exam);
      const endedAt = clock.now();
      const transcript = String(text || "").trim();
      const part = snapshot.exam.status === "introduction" ? 0
        : Number(String(snapshot.exam.currentPart || "part1").replace("part", ""));
      snapshot.answers.push({ answerId: `answer_${snapshot.answers.length + 1}`, part,
        turnType: part === 0 ? "INTRODUCTION" : snapshot.exam.status === "part2_answering" ? "PART2_LONG_TURN" : "STANDARD",
        scoringEligible: part >= 1, questionId: answerQuestionId(item),
        questionText: questionText(item, snapshot.exam.status), attemptNo: snapshot.exam.attemptNo,
        transcript, completionReason: reason,
        startedAt: (answerStartedAt || endedAt).toISOString(), endedAt: endedAt.toISOString(),
        durationMs: Math.max(1000, endedAt.getTime() - (answerStartedAt || endedAt).getTime()) });
      if (transcript) snapshot.captions.push({ role: "candidate", text: transcript, at: endedAt.toISOString() });
      dependencies.runtime?.completeTurn(transcript, reason);
      clearStageTimer(); snapshot.timer = null;
      dispatch({ type: "SUBMIT_ANSWER" });
    },
    toggleCaptions() {
      if (!snapshot.exam) return;
      snapshot.exam = transitionExam(snapshot.exam, { type: "TOGGLE_CAPTIONS" });
      snapshot.captionsUsed ||= snapshot.exam.captionsEnabled; publish();
    },
    retry() { clearStageTimer(); dispatch({ type: "RETRY" }); },
    next() { clearStageTimer(); dispatch({ type: "NEXT" }); },
    exit() {
      if (!snapshot.exam) return controller.openHome();
      dependencies.runtime?.abandon?.().catch?.(() => {});
      dispatch({ type: "EXIT_CONFIRMED" });
    },
    restart() { controller.openHome(); },
    dispose() {
      clearTimers();
      if (typeof speak.cancel === "function") speak.cancel();
      dependencies.runtime?.stop?.().catch?.(() => {});
    },
  };
  return controller;
}
