import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveHttpBase } from "../services/local-service-config.mjs";

/** @typedef {Record<string, any>} RuntimeRecord */
/** @typedef {Record<string, any> & { screen: string, loading?: boolean, error?: string | null, exam?: any, paper?: any, report?: any }} IeltsSnapshot */
/** @typedef {{ status: "checking" | "ready" | "degraded" | "unavailable", service: "checking" | "ready" | "unavailable", microphone: "checking" | "ready" | "unavailable", messages: string[] }} ServiceHealth */
/** @typedef {(...args: any[]) => any} RuntimeFactory */
/**
 * @typedef {object} IeltsOwner
 * @property {RuntimeRecord} api
 * @property {RuntimeRecord} streamer
 * @property {RuntimeRecord | null} runtime
 * @property {RuntimeRecord | null} controller
 * @property {boolean} acceptingChanges
 * @property {number} cleanupGeneration
 * @property {boolean} disposed
 * @property {Promise<void> | null} healthPromise
 * @property {string | null} activeAnswerKey
 * @property {string | null} examContextKey
 * @property {string} liveTranscript
 * @property {Promise<any> | null} startPromise
 * @property {Promise<any> | null} restartPromise
 * @property {Promise<void> | null} teardownPromise
 * @property {boolean} controllerDisposed
 * @property {number} lifecycleGeneration
 */
/**
 * @typedef {object} IeltsSessionOptions
 * @property {RuntimeFactory} [createApi]
 * @property {RuntimeFactory} [createStreamer]
 * @property {RuntimeFactory} [createRuntime]
 * @property {RuntimeFactory} [createController]
 * @property {MediaDevices} [mediaDevices]
 * @property {(config?: AudioContextOptions) => AudioContext} [createAudioContext]
 * @property {(url: string) => WebSocket} [createWebSocket]
 * @property {() => RTCPeerConnection} [createPeerConnection]
 * @property {() => HTMLAudioElement} [createAudio]
 * @property {unknown} [apiOptions]
 * @property {Storage} [storage]
 * @property {(name: string) => Promise<unknown>} [loadJson]
 * @property {() => Promise<Record<string, unknown>>} [checkHealth]
 * @property {typeof fetch} [fetchImpl]
 */

// Vite eagerly bundles these established JavaScript modules. Using the glob boundary keeps
// their intentionally untyped internals outside this route hook's TypeScript check surface.
const FACTORY_MODULES = /** @type {Record<string, Record<string, RuntimeFactory>>} */ (import.meta.glob([
  "../ielts/demo-controller.mjs",
  "../ielts/ielts-session-runtime.mjs",
  "../ielts/pcm-scoring-streamer.mjs",
  "../services/ielts-api.mjs",
], { eager: true }));

const createIeltsDemoController = FACTORY_MODULES["../ielts/demo-controller.mjs"].createIeltsDemoController;
const createIeltsSessionRuntime = FACTORY_MODULES["../ielts/ielts-session-runtime.mjs"].createIeltsSessionRuntime;
const createPcmScoringStreamer = FACTORY_MODULES["../ielts/pcm-scoring-streamer.mjs"].createPcmScoringStreamer;
const createIeltsApi = FACTORY_MODULES["../services/ielts-api.mjs"].createIeltsApi;

const INITIAL_SNAPSHOT = /** @type {IeltsSnapshot} */ ({
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
});

const INITIAL_HEALTH = /** @type {ServiceHealth} */ ({
  status: "checking",
  service: "checking",
  microphone: "checking",
  messages: ["正在检查麦克风与本地服务…"],
});

const FALSE_PROVIDER_FLAGS = /** @type {ReadonlyArray<readonly [readonly string[], string]>} */ ([
  [["qwenRealtimeConfigured", "realtimeConfigured", "realtime_configured", "realtimeProviderConfigured"], "实时考官服务未配置"],
  [["qwenScoringConfigured", "scoringConfigured", "scoring_configured", "scoringProviderConfigured"], "语言评分服务未配置"],
  [["xfyunConfigured", "pronunciationConfigured", "pronunciation_configured", "pronunciationProviderConfigured"], "发音评估服务未配置"],
]);

/** @param {Record<string, unknown>} payload @param {boolean} microphoneAvailable @returns {ServiceHealth} */
function normalizeHealth(payload, microphoneAvailable) {
  const messages = /** @type {string[]} */ ([]);
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

/** @param {IeltsOwner | null | undefined} owner @returns {owner is IeltsOwner} */
function canPublish(owner) {
  return Boolean(owner?.acceptingChanges && !owner?.disposed);
}

/** @param {IeltsOwner | null | undefined} owner @param {number} generation */
function canContinue(owner, generation) {
  return canPublish(owner) && owner.lifecycleGeneration === generation;
}

/** @param {IeltsOwner} owner @param {{ ensureStop?: boolean }} [options] */
function teardownRuntime(owner, { ensureStop = false } = {}) {
  if (owner.teardownPromise) return owner.teardownPromise;
  const teardown = (async () => {
    try {
      await owner.runtime?.abandon?.();
    } catch {
      // The local transport still has to close if server abandonment fails.
    } finally {
      if (ensureStop) {
        try { await owner.runtime?.stop?.(); } catch { /* cleanup is best effort */ }
      }
    }
  })();
  const trackedTeardown = teardown.finally(() => {
    if (owner.teardownPromise === trackedTeardown) owner.teardownPromise = null;
  });
  owner.teardownPromise = trackedTeardown;
  return owner.teardownPromise;
}

/** @param {IeltsOwner} owner */
function requestOwnerDisposal(owner) {
  if (owner.disposed) return;
  owner.lifecycleGeneration += 1;
  owner.acceptingChanges = false;
  owner.disposed = true;
  if (!owner.controllerDisposed) {
    owner.controllerDisposed = true;
    owner.controller?.dispose?.();
  }
  const pendingStart = owner.startPromise;
  if (pendingStart) {
    void pendingStart.then(
      () => teardownRuntime(owner, { ensureStop: true }),
      () => teardownRuntime(owner, { ensureStop: true }),
    );
  } else {
    void teardownRuntime(owner);
  }
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
/** @param {IeltsSessionOptions} [options] */
export function useIeltsSession(options = {}) {
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [serviceHealth, setServiceHealth] = useState(INITIAL_HEALTH);
  const ownerRef = useRef(/** @type {IeltsOwner | null} */ (null));
  const latestAttemptIdRef = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!ownerRef.current) {
      const createApi = options.createApi || createIeltsApi;
      const createStreamer = options.createStreamer || createPcmScoringStreamer;
      const createRuntime = options.createRuntime || createIeltsSessionRuntime;
      const createController = options.createController || createIeltsDemoController;
      const mediaDevices = options.mediaDevices || globalThis.navigator?.mediaDevices;
      const createAudioContext = options.createAudioContext || ((/** @type {AudioContextOptions | undefined} */ config) => {
        const AudioContextClass = globalThis.AudioContext
          || /** @type {{ webkitAudioContext?: typeof AudioContext }} */ (globalThis).webkitAudioContext;
        if (!AudioContextClass) throw new Error("当前浏览器不支持音频采集");
        return new AudioContextClass(config);
      });
      const api = createApi(options.apiOptions);
      const streamer = createStreamer({
        createAudioContext,
        createWebSocket: options.createWebSocket || ((/** @type {string} */ url) => new WebSocket(url)),
      });
      const owner = /** @type {IeltsOwner} */ ({
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
        startPromise: null,
        restartPromise: null,
        teardownPromise: null,
        controllerDisposed: false,
        lifecycleGeneration: 0,
      });
      /** @param {IeltsSnapshot} nextSnapshot */
      const publish = (nextSnapshot) => {
        if (!canPublish(owner)) return;
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
        onTranscript: (/** @type {{ interim?: string, final?: string, complete?: string }} */ transcript) => {
          const { interim, final, complete } = transcript;
          const text = String(complete || final || interim || "");
          owner.liveTranscript = text;
          if (canPublish(owner) && text) {
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
    if (!owner) return undefined;
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
          if (canPublish(owner)) {
            setServiceHealth(normalizeHealth(payload || {}, microphoneAvailable));
          }
        })
        .catch(() => {
          if (canPublish(owner)) {
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
        requestOwnerDisposal(owner);
      });
    };
  // The route mount owns an immutable dependency graph by design.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callController = useCallback((/** @type {string} */ method, /** @type {any[]} */ ...args) => {
    const controller = ownerRef.current?.controller;
    return controller?.[method]?.(...args);
  }, []);

  const start = useCallback((/** @type {any[]} */ ...args) => {
    const owner = ownerRef.current;
    if (!canPublish(owner)) return Promise.resolve(null);
    if (owner.startPromise) return owner.startPromise;
    /** @type {any} */
    let result;
    try {
      result = owner.controller?.start?.(...args);
    } catch (error) {
      result = Promise.reject(error);
    }
    const startPromise = Promise.resolve(result);
    owner.startPromise = startPromise;
    void startPromise.then(
      () => { if (owner.startPromise === startPromise) owner.startPromise = null; },
      () => { if (owner.startPromise === startPromise) owner.startPromise = null; },
    );
    return startPromise;
  }, []);

  const restart = useCallback(() => {
    const owner = ownerRef.current;
    if (!owner || owner.disposed) return Promise.resolve(null);
    if (owner.restartPromise) return owner.restartPromise;
    owner.lifecycleGeneration += 1;
    owner.acceptingChanges = false;
    const pendingStart = owner.startPromise;
    const restartPromise = (async () => {
      if (pendingStart) {
        try { await pendingStart; } catch { /* teardown still runs after failed start */ }
      }
      await teardownRuntime(owner, { ensureStop: true });
      if (owner.disposed) return null;
      latestAttemptIdRef.current = null;
      owner.liveTranscript = "";
      owner.examContextKey = null;
      owner.activeAnswerKey = null;
      owner.acceptingChanges = true;
      return owner.controller?.restart?.();
    })();
    owner.restartPromise = restartPromise;
    void restartPromise.then(
      () => { if (owner.restartPromise === restartPromise) owner.restartPromise = null; },
      () => { if (owner.restartPromise === restartPromise) owner.restartPromise = null; },
    );
    return restartPromise;
  }, []);

  const retryReport = useCallback(async () => {
    const owner = ownerRef.current;
    if (!canPublish(owner)) return null;
    const lifecycleGeneration = owner.lifecycleGeneration;
    const attemptId = latestAttemptIdRef.current
      || owner.controller?.getSnapshot?.()?.attemptId
      || owner.runtime?.getAttemptId?.();
    if (!attemptId) {
      if (canContinue(owner, lifecycleGeneration)) {
        setSnapshot((current) => ({ ...current, error: "未找到可重试的 IELTS 测试记录。" }));
      }
      return null;
    }
    latestAttemptIdRef.current = attemptId;
    if (canContinue(owner, lifecycleGeneration)) {
      setSnapshot((current) => ({ ...current, loading: true, error: null }));
    }
    try {
      const report = await owner.api.report(attemptId);
      if (canContinue(owner, lifecycleGeneration)) {
        setSnapshot((current) => ({ ...current, loading: false, report,
          scoringStatus: report?.scoringStatus || report?.scoring_status || current.scoringStatus }));
      }
      return report;
    } catch {
      if (canContinue(owner, lifecycleGeneration)) {
        setSnapshot((current) => ({ ...current, loading: false,
          error: "报告获取失败，可以重试或退出。" }));
      }
      return null;
    }
  }, []);

  const actions = useMemo(() => ({
    selectMode: (/** @type {any[]} */ ...args) => callController("selectMode", ...args),
    setPreflight: (/** @type {any[]} */ ...args) => callController("setPreflight", ...args),
    start,
    submitAnswer: (/** @type {string | undefined} */ text, /** @type {string | undefined} */ reason) => callController(
      "submitAnswer",
      text ?? ownerRef.current?.liveTranscript ?? "",
      reason,
    ),
    updateNotes: (/** @type {any[]} */ ...args) => callController("updateNotes", ...args),
    toggleCaptions: (/** @type {any[]} */ ...args) => callController("toggleCaptions", ...args),
    retry: (/** @type {any[]} */ ...args) => callController("retry", ...args),
    next: (/** @type {any[]} */ ...args) => callController("next", ...args),
    exit: (/** @type {any[]} */ ...args) => callController("exit", ...args),
    restart,
    retryReport,
  }), [callController, restart, retryReport, start]);

  return { snapshot, actions, serviceHealth };
}

export default useIeltsSession;
