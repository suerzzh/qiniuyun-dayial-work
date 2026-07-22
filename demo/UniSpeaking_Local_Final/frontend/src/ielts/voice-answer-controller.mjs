function initialSnapshot() {
  return {
    status: "idle",
    finalTranscript: "",
    interimTranscript: "",
    elapsedSeconds: 0,
    permission: "unknown",
    message: "点击麦克风开始回答",
  };
}

function normalizeText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

export function createVoiceAnswerController({ createAdapter, clock = globalThis, onChange } = {}) {
  if (typeof createAdapter !== "function") throw new Error("Voice answer controller requires createAdapter");
  let snapshot = initialSnapshot();
  let timerId = null;
  let disposed = false;
  let finishedTranscript = null;

  const publish = () => onChange?.(structuredClone(snapshot));
  const clearTimer = () => {
    if (timerId !== null) clock.clearInterval(timerId);
    timerId = null;
  };
  const startTimer = () => {
    clearTimer();
    timerId = clock.setInterval(() => {
      if (snapshot.status !== "listening") return;
      snapshot.elapsedSeconds += 1;
      publish();
    }, 1000);
  };
  const enterFallback = (message) => {
    clearTimer();
    snapshot.status = "fallback";
    snapshot.interimTranscript = "";
    snapshot.message = message;
    publish();
  };

  const adapter = createAdapter({
    onInterim(text) {
      if (disposed || snapshot.status !== "listening") return;
      snapshot.interimTranscript = normalizeText(text);
      publish();
    },
    onFinal(text) {
      if (disposed || !new Set(["listening", "paused"]).has(snapshot.status)) return;
      const segment = normalizeText(text);
      snapshot.finalTranscript = normalizeText(`${snapshot.finalTranscript} ${segment}`);
      snapshot.interimTranscript = "";
      publish();
    },
    onError(error) {
      if (disposed) return;
      if (error?.recoverable) {
        snapshot.message = error.code === "no-speech" ? "没有检测到语音，请继续说话" : "语音识别暂时中断";
        publish();
        return;
      }
      adapter.stop();
      enterFallback("麦克风暂不可用，可直接输入回答");
    },
  });

  return {
    getSnapshot() { return structuredClone(snapshot); },
    async start() {
      if (disposed || snapshot.status !== "idle") return;
      finishedTranscript = null;
      if (!adapter.isSupported()) {
        enterFallback("当前浏览器不支持实时语音转写，请直接输入回答");
        return;
      }
      snapshot.status = "requesting_permission";
      snapshot.message = "正在请求麦克风权限…";
      publish();
      try {
        await adapter.start();
        if (disposed) return;
        snapshot.status = "listening";
        snapshot.permission = "granted";
        snapshot.message = "正在聆听，点击可暂停";
        startTimer();
        publish();
      } catch {
        snapshot.permission = "denied";
        enterFallback("麦克风权限未开启，可直接输入回答");
      }
    },
    pause() {
      if (disposed || snapshot.status !== "listening") return;
      adapter.pause();
      clearTimer();
      snapshot.status = "paused";
      snapshot.interimTranscript = "";
      snapshot.message = "回答已暂停，点击继续说话";
      publish();
    },
    async resume() {
      if (disposed || snapshot.status !== "paused") return;
      try {
        await adapter.resume();
        if (disposed) return;
        snapshot.status = "listening";
        snapshot.message = "正在聆听，点击可暂停";
        startTimer();
        publish();
      } catch {
        enterFallback("无法继续使用麦克风，可直接输入回答");
      }
    },
    updateTranscript(text) {
      if (disposed || snapshot.status === "finalizing") return;
      snapshot.finalTranscript = String(text || "");
      publish();
    },
    finish() {
      if (finishedTranscript !== null) return finishedTranscript;
      clearTimer();
      adapter.stop();
      finishedTranscript = normalizeText(`${snapshot.finalTranscript} ${snapshot.interimTranscript}`);
      snapshot.finalTranscript = finishedTranscript;
      snapshot.status = "finalizing";
      snapshot.interimTranscript = "";
      snapshot.message = "正在结束本轮回答…";
      publish();
      return finishedTranscript;
    },
    reset() {
      clearTimer();
      if (snapshot.status !== "finalizing") adapter.stop();
      snapshot = initialSnapshot();
      finishedTranscript = null;
      publish();
    },
    dispose() {
      disposed = true;
      clearTimer();
      adapter.dispose();
      snapshot = initialSnapshot();
    },
  };
}
