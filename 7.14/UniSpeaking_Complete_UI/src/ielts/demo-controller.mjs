import { loadQuestionBank } from "./question-bank.mjs";
import { assemblePaper } from "./paper-assembler.mjs";
import { createExamState, currentExamItem, transitionExam } from "./exam-state-machine.mjs";
import { buildPracticeFeedback } from "./feedback.mjs";

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
    screen: "home",
    loading: false,
    error: null,
    selection: null,
    preflight: { captionsEnabled: false, recordingEnabled: false },
    sessionPolicy: null,
    paper: null,
    exam: null,
    notes: "",
    notesLocked: true,
    answers: [],
    captions: [],
    captionsUsed: false,
    timer: null,
    report: null,
  };
}

function parseHistory(storage) {
  try {
    const value = JSON.parse(storage?.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function collectPaperIds(paper) {
  if (!paper?.parts) return [];
  return [
    ...(paper.parts.part1?.groups || []).map((group) => group.groupId),
    ...(paper.parts.part1?.questions || []).map((question) => question.questionId),
    ...(paper.parts.part2 ? [paper.parts.part2.cardId] : []),
    ...(paper.parts.part2?.roundingOffQuestions || []).map((question) => question.questionId),
    ...(paper.parts.part3 ? [paper.parts.part3.groupId] : []),
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

function questionText(item, examStatus) {
  if (!item) return "";
  if (examStatus === "part2_preparing") return "You have one minute to prepare. You may make notes.";
  if (examStatus === "part2_answering") return "Please begin speaking now. You can speak for up to two minutes.";
  return item.renderedText || item.topicSentence || "";
}

function answerQuestionId(item) {
  return item?.questionId || item?.cardId || "unknown";
}

export function createIeltsDemoController(dependencies) {
  if (typeof dependencies?.loadJson !== "function") throw new Error("IELTS Demo requires loadJson");
  const clock = dependencies.clock || defaultClock();
  const random = dependencies.random || Math.random;
  const storage = dependencies.storage || null;
  const speak = typeof dependencies.speak === "function" ? dependencies.speak : () => {};
  const demoPrepSeconds = Number(dependencies.demoPrepSeconds || 10);
  let snapshot = createHomeSnapshot();
  let timerId = null;
  let answerStartedAt = null;

  const publish = () => dependencies.onChange?.(structuredClone(snapshot));
  const clearTimer = () => {
    if (timerId !== null) clock.clearInterval(timerId);
    timerId = null;
  };
  const setNotesLock = () => {
    snapshot.notesLocked = snapshot.exam?.status !== "part2_preparing";
  };
  const addExaminerCaption = (text) => {
    if (!text) return;
    snapshot.captions.push({ role: "examiner", text, at: clock.now().toISOString() });
  };
  const speakCurrent = () => {
    const text = questionText(currentExamItem(snapshot.exam), snapshot.exam?.status);
    if (!text) return;
    addExaminerCaption(text);
    answerStartedAt = clock.now();
    speak(text);
  };
  const finishSession = () => {
    clearTimer();
    const session = {
      status: snapshot.exam.status,
      mode: snapshot.exam.mode,
      recordingEnabled: snapshot.sessionPolicy.recordingEnabled,
      captionsUsed: snapshot.captionsUsed,
      answers: snapshot.answers,
      notes: snapshot.notes,
    };
    snapshot.report = buildPracticeFeedback(session);
    snapshot.screen = "report";
    if (snapshot.exam.status === "completed") {
      saveCompletedHistory(storage, snapshot.paper, clock.now().toISOString());
    }
  };
  const afterTransition = (previousStatus) => {
    setNotesLock();
    if (snapshot.exam.status === "completed" || snapshot.exam.status === "abandoned") {
      finishSession();
      publish();
      return;
    }
    if (snapshot.exam.status === "part2_preparing" && previousStatus !== "part2_preparing") {
      clearTimer();
      snapshot.timer = { kind: "part2_preparation", totalSeconds: demoPrepSeconds, remainingSeconds: demoPrepSeconds };
      timerId = clock.setInterval(() => {
        if (snapshot.exam?.status !== "part2_preparing") return clearTimer();
        snapshot.timer.remainingSeconds = Math.max(0, snapshot.timer.remainingSeconds - 1);
        if (snapshot.timer.remainingSeconds === 0) {
          controller.expirePreparationForTest();
          return;
        }
        publish();
      }, 1000);
    } else {
      snapshot.timer = null;
    }
    speakCurrent();
    publish();
  };
  const dispatch = (event) => {
    const previousStatus = snapshot.exam.status;
    snapshot.exam = transitionExam(snapshot.exam, event);
    if (snapshot.exam.lastError) {
      snapshot.error = snapshot.exam.lastError;
      publish();
      return;
    }
    snapshot.error = null;
    afterTransition(previousStatus);
  };

  const controller = {
    getSnapshot() {
      return structuredClone(snapshot);
    },
    openHome() {
      clearTimer();
      snapshot = createHomeSnapshot();
      publish();
    },
    selectMode(mode, selectedPart = null) {
      if (!new Set(["full_mock", "practice_part"]).has(mode)) throw new Error(`Unsupported IELTS mode: ${mode}`);
      if (mode === "practice_part" && !new Set(["part1", "part2", "part3"]).has(selectedPart)) {
        throw new Error("Part practice requires part1, part2 or part3");
      }
      clearTimer();
      snapshot = {
        ...createHomeSnapshot(),
        screen: "preflight",
        selection: { mode, selectedPart },
        preflight: { captionsEnabled: mode === "practice_part", recordingEnabled: false },
      };
      publish();
    },
    setPreflight(patch) {
      if (snapshot.screen !== "preflight" || snapshot.exam) {
        throw new Error("Recording and initial caption preferences can only change before start");
      }
      snapshot.preflight = {
        ...snapshot.preflight,
        ...(Object.hasOwn(patch, "captionsEnabled") ? { captionsEnabled: Boolean(patch.captionsEnabled) } : {}),
        ...(Object.hasOwn(patch, "recordingEnabled") ? { recordingEnabled: Boolean(patch.recordingEnabled) } : {}),
      };
      publish();
    },
    async start() {
      if (snapshot.screen !== "preflight" || !snapshot.selection) throw new Error("Select an IELTS mode before start");
      snapshot.loading = true;
      snapshot.error = null;
      publish();
      try {
        const bank = await loadQuestionBank(dependencies.loadJson);
        const paper = assemblePaper(bank, {
          mode: snapshot.selection.mode,
          selectedPart: snapshot.selection.selectedPart,
          recentQuestionIds: recentQuestionIds(storage),
          random,
          now: clock.now,
        });
        snapshot.paper = paper;
        snapshot.sessionPolicy = { ...snapshot.preflight };
        snapshot.exam = transitionExam(createExamState(paper, snapshot.sessionPolicy), { type: "START" });
        snapshot.screen = "session";
        snapshot.loading = false;
        snapshot.answers = [];
        snapshot.captions = [];
        snapshot.notes = "";
        snapshot.captionsUsed = snapshot.exam.captionsEnabled;
        setNotesLock();
        afterTransition("ready");
      } catch (error) {
        snapshot.loading = false;
        snapshot.error = error.message || "IELTS Demo failed to start";
        publish();
      }
    },
    updateNotes(text) {
      if (snapshot.exam?.status !== "part2_preparing") {
        throw new Error("Notes are editable only during Part 2 preparation");
      }
      snapshot.notes = String(text || "");
      publish();
    },
    expirePreparationForTest() {
      if (snapshot.exam?.status !== "part2_preparing") return;
      clearTimer();
      snapshot.timer = null;
      dispatch({ type: "PREP_EXPIRED" });
    },
    submitAnswer(text = "") {
      if (!snapshot.exam) throw new Error("No IELTS exam is running");
      const item = currentExamItem(snapshot.exam);
      const endedAt = clock.now();
      const transcript = String(text || "").trim() || "Demo answer completed without a typed transcript.";
      snapshot.answers.push({
        answerId: `answer_${snapshot.answers.length + 1}`,
        part: snapshot.exam.currentPart,
        questionId: answerQuestionId(item),
        questionText: questionText(item, snapshot.exam.status),
        attemptNo: snapshot.exam.attemptNo,
        transcript,
        startedAt: (answerStartedAt || endedAt).toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: Math.max(1000, endedAt.getTime() - (answerStartedAt || endedAt).getTime()),
      });
      snapshot.captions.push({ role: "candidate", text: transcript, at: endedAt.toISOString() });
      dispatch({ type: "SUBMIT_ANSWER" });
    },
    toggleCaptions() {
      if (!snapshot.exam) return;
      snapshot.exam = transitionExam(snapshot.exam, { type: "TOGGLE_CAPTIONS" });
      snapshot.captionsUsed ||= snapshot.exam.captionsEnabled;
      publish();
    },
    retry() {
      dispatch({ type: "RETRY" });
    },
    next() {
      dispatch({ type: "NEXT" });
    },
    exit() {
      if (!snapshot.exam) return controller.openHome();
      dispatch({ type: "EXIT_CONFIRMED" });
    },
    restart() {
      controller.openHome();
    },
    dispose() {
      clearTimer();
      if (typeof speak.cancel === "function") speak.cancel();
    },
  };

  return controller;
}
