// @ts-nocheck

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveHttpBase } from "../services/local-service-config.mjs";

// Vite eagerly bundles these established JavaScript modules. Using the glob boundary keeps
// their intentionally untyped internals outside this route hook's TypeScript check surface.
const FACTORY_MODULES = import.meta.glob([
  "../ielts/demo-controller.mjs",
  "../ielts/ielts-session-runtime.mjs",
  "../ielts/pcm-scoring-streamer.mjs",
  "../services/ielts-api.mjs",
], { eager: true });

const createIeltsDemoController = FACTORY_MODULES["../ielts/demo-controller.mjs"].createIeltsDemoController;
const createIeltsSessionRuntime = FACTORY_MODULES["../ielts/ielts-session-runtime.mjs"].createIeltsSessionRuntime;
const createPcmScoringStreamer = FACTORY_MODULES["../ielts/pcm-scoring-streamer.mjs"].createPcmScoringStreamer;
const createIeltsApi = FACTORY_MODULES["../services/ielts-api.mjs"].createIeltsApi;

const INITIAL_SNAPSHOT = {
  screen: "home",
  loading: false,
  error: null,
  selection: null,
  preflight: {
    captionsEnabled: false,
    recordingEnabled: false,
    acceleratedDemo: false,
  },
  paper: null,
  exam: null,
  notes: "",
  notesLocked: true,
  answers: [],
  captions: [],
  timer: null,
  part3Timer: null,
  report: null,
  attemptId: null,
};

const INITIAL_HEALTH = {
  status: "checking",
  service: "checking",
  microphone: "checking",
  messages: ["正在检查麦克风与本地服务…"],
};

const FALSE_PROVIDER_FLAGS = [
  [["qwenRealtimeConfigured", "realtimeConfigured", "realtime_configured", "realtimeProviderConfigured"], "实时考官服务未配置"],
  [["qwenScoringConfigured", "scoringConfigured", "scoring_configured", "scoringProviderConfigured"], "语言评分服务未配置"],
  [["xfyunConfigured", "pronunciationConfigured", "pronunciation_configured", "pronunciationProviderConfigured"], "发音评估服务未配置"],
];

/** @param {Record<string, unknown>} payload @param {boolean} microphoneAvailable */
function normalizeHealth(payload, microphoneAvailable) {
  const messages = [];
  if (!microphoneAvailable) messages.push("当前浏览器无法使用麦克风，请更换浏览器或检查权限。");
  for (const [keys, message] of FALSE_PROVIDER_FLAGS) {
    if (keys.some((key) => payload?.[key] === false)) messages.push(message);
  }
  const serviceAvailable = payload?.java === true
    || String(payload?.status || "").toUpperCase() === "UP";
  if (!serviceAvailable) messages.push("本地服务当前不可用。");
  return {
    status: serviceAvailable && microphoneAvailable && messages.length === 0 ? "ready" : "degraded",
    service: serviceAvailable ? "ready" : "unavailable",
    microphone: microphoneAvailable ? "ready" : "unavailable",
    messages,
  };
}

/** @param {typeof fetch} fetchImpl */
async function defaultHealthCheck(fetchImpl) {
  const response = await fetchImpl(`${resolveHttpBase()}/health`);
  if (!response.ok) throw new Error("health unavailable");
  return response.json();
}

/**
 * Owns all browser and IELTS session resources for one mounted IELTS route.
 * Factories are injectable so ownership can be verified without opening media devices.
 */
export function useIeltsSession(options = {}) {
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [serviceHealth, setServiceHealth] = useState(INITIAL_HEALTH);
  const ownerRef = useRef(null);
  const latestAttemptIdRef = useRef(null);

  useEffect(() => {
    if (!ownerRef.current) {
      const createApi = options.createApi || createIeltsApi;
      const createStreamer = options.createStreamer || createPcmScoringStreamer;
      const createRuntime = options.createRuntime || createIeltsSessionRuntime;
      const createController = options.createController || createIeltsDemoController;
      const mediaDevices = options.mediaDevices || globalThis.navigator?.mediaDevices;
      const createAudioContext = options.createAudioContext || ((config) => {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) throw new Error("当前浏览器不支持音频采集");
        return new AudioContextClass(config);
      });
      const api = createApi(options.apiOptions);
      const streamer = createStreamer({
        createAudioContext,
        createWebSocket: options.createWebSocket || ((url) => new WebSocket(url)),
      });
      const owner = {
        api,
        streamer,
        runtime: null,
        controller: null,
        acceptingChanges: true,
        cleanupGeneration: 0,
        disposed: false,
        healthPromise: null,
        activeAnswerKey: null,
        examContextKey: null,
        liveTranscript: "",
      };
      const publish = (nextSnapshot) => {
        if (!owner.acceptingChanges || owner.disposed) return;
        if (nextSnapshot?.attemptId) latestAttemptIdRef.current = nextSnapshot.attemptId;
        const exam = nextSnapshot?.exam;
        const examContextKey = nextSnapshot?.screen === "session" && exam
          ? [exam.status, exam.currentPart, exam.currentItemIndex, exam.attemptNo].join(":")
          : null;
        if (examContextKey !== owner.examContextKey) {
          owner.examContextKey = examContextKey;
          owner.activeAnswerKey = null;
          owner.liveTranscript = "";
        }
        const answerReady = new Set([
          "introduction",
          "part1_answering",
          "part2_answering",
          "part3_answering",
        ]).has(exam?.status) && String(nextSnapshot?.timer?.kind || "").endsWith("_answer");
        if (answerReady && owner.activeAnswerKey !== examContextKey) {
          owner.activeAnswerKey = examContextKey;
          owner.runtime?.startAnswer?.();
        }
        setSnapshot({ ...nextSnapshot, liveTranscript: owner.liveTranscript });
      };
      const runtime = createRuntime({
        api,
        streamer,
        mediaDevices: mediaDevices || {
          getUserMedia: async () => { throw new Error("当前浏览器无法使用麦克风"); },
        },
        createPeerConnection: options.createPeerConnection || (() => new RTCPeerConnection()),
        createAudio: options.createAudio || (() => new Audio()),
        onTranscript: ({ interim, final, complete }) => {
          const text = String(complete || final || interim || "");
          owner.liveTranscript = text;
          if (owner.acceptingChanges && text) {
            setSnapshot((current) => ({ ...current, liveTranscript: text }));
          }
        },
      });
      owner.runtime = runtime;
      const controller = createController({
        runtime,
        storage: options.storage || globalThis.localStorage,
        onChange: publish,
        onAnswerTimeLimit: () => owner.liveTranscript || "",
        loadJson: options.loadJson,
      });
      owner.controller = controller;
      ownerRef.current = owner;
      const initial = controller.getSnapshot?.();
      if (initial) publish(initial);
    }

    const owner = ownerRef.current;
    owner.acceptingChanges = true;
    owner.cleanupGeneration += 1;
    const microphoneAvailable = Boolean(
      (options.mediaDevices || globalThis.navigator?.mediaDevices)?.getUserMedia,
    );
    const checkHealth = options.checkHealth
      || (() => defaultHealthCheck(options.fetchImpl || globalThis.fetch));
    if (!owner.healthPromise) {
      owner.healthPromise = Promise.resolve()
        .then(() => checkHealth())
        .then((payload) => {
          if (owner.acceptingChanges && !owner.disposed) {
            setServiceHealth(normalizeHealth(payload || {}, microphoneAvailable));
          }
        })
        .catch(() => {
          if (owner.acceptingChanges && !owner.disposed) {
            setServiceHealth({
              status: "unavailable",
              service: "unavailable",
              microphone: microphoneAvailable ? "ready" : "unavailable",
              messages: ["本地服务暂不可用，请确认服务已启动后重试。"],
            });
          }
        });
    }

    return () => {
      let disposed = false;
      if (disposed) return;
      disposed = true;
      owner.acceptingChanges = false;
      const cleanupGeneration = ++owner.cleanupGeneration;
      Promise.resolve().then(() => {
        if (owner.cleanupGeneration !== cleanupGeneration || owner.disposed) return;
        owner.disposed = true;
        owner.controller?.dispose?.();
      });
    };
  // The route mount owns an immutable dependency graph by design.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callController = useCallback((method, ...args) => {
    const controller = ownerRef.current?.controller;
    return controller?.[method]?.(...args);
  }, []);

  const retryReport = useCallback(async () => {
    const owner = ownerRef.current;
    if (!owner || owner.disposed) return null;
    const attemptId = latestAttemptIdRef.current
      || owner.controller?.getSnapshot?.()?.attemptId
      || owner.runtime?.getAttemptId?.();
    if (!attemptId) {
      setSnapshot((current) => ({ ...current, error: "未找到可重试的 IELTS 测试记录。" }));
      return null;
    }
    latestAttemptIdRef.current = attemptId;
    setSnapshot((current) => ({ ...current, loading: true, error: null }));
    try {
      const report = await owner.api.report(attemptId);
      if (!owner.disposed) {
        setSnapshot((current) => ({ ...current, loading: false, report,
          scoringStatus: report?.scoringStatus || report?.scoring_status || current.scoringStatus }));
      }
      return report;
    } catch {
      if (!owner.disposed) {
        setSnapshot((current) => ({ ...current, loading: false,
          error: "报告获取失败，可以重试或退出。" }));
      }
      return null;
    }
  }, []);

  const actions = useMemo(() => ({
    selectMode: (...args) => callController("selectMode", ...args),
    setPreflight: (...args) => callController("setPreflight", ...args),
    start: (...args) => callController("start", ...args),
    submitAnswer: (text, reason) => callController(
      "submitAnswer",
      text ?? ownerRef.current?.liveTranscript ?? "",
      reason,
    ),
    updateNotes: (...args) => callController("updateNotes", ...args),
    toggleCaptions: (...args) => callController("toggleCaptions", ...args),
    retry: (...args) => callController("retry", ...args),
    next: (...args) => callController("next", ...args),
    exit: (...args) => callController("exit", ...args),
    restart: (...args) => callController("restart", ...args),
    retryReport,
  }), [callController, retryReport]);

  return { snapshot, actions, serviceHealth };
}

export default useIeltsSession;
