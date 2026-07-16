// @ts-check

const FINAL_MESSAGE_EVENTS = new Set([
  "conversation.item.input_audio_transcription.completed",
  "response.audio_transcript.done",
  "response.text.done",
]);

/** @param {string} prefix */
const eventId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** @param {string} sdp */
function normalizeSdp(sdp) {
  const normalized = String(sdp || "").trim().replace(/\r?\n/g, "\r\n");
  return normalized.endsWith("\r\n") ? normalized : `${normalized}\r\n`;
}

/**
 * @param {{
 *   api: any,
 *   microphone: any,
 *   audioPlayback: any,
 *   createPeerConnection: () => any,
 *   onEvent?: (event: any) => void,
 * }} options
 */
export function createRealtimeClient({
  api,
  microphone,
  audioPlayback,
  createPeerConnection,
  onEvent = () => {},
}) {
  /** @type {any} */
  let peer = null;
  /** @type {any} */
  let channel = null;
  /** @type {any} */
  let audioSender = null;
  /** @type {any} */
  let audioTrack = null;
  /** @type {string | null} */
  let sessionId = null;
  /** @type {string | null} */
  let conversationId = null;
  /** @type {any} */
  let sessionConfig = null;
  /** @type {Promise<any> | null} */
  let startPromise = null;
  /** @type {Promise<void> | null} */
  let teardownPromise = null;
  let greetingRequested = false;
  let disconnectHandled = false;
  let sessionStartedAt = 0;
  const processedToolCalls = new Set();
  /** @type {{ prompt?: string, conversationId?: string | null }} */
  let lastStartOptions = {};

  /** @param {any} event */
  const emit = (event) => onEvent(event);

  /** @param {any} event */
  function send(event) {
    if (!channel || channel.readyState !== "open") {
      throw new Error("实时通道尚未连接");
    }
    channel.send(JSON.stringify(event));
  }

  /** @param {any} activePeer */
  async function waitForIceGathering(activePeer) {
    if (activePeer.iceGatheringState === "complete") return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("ICE 候选收集超时")), 10_000);
      const previous = activePeer.onicegatheringstatechange;
      activePeer.onicegatheringstatechange = () => {
        previous?.();
        if (activePeer.iceGatheringState === "complete") {
          clearTimeout(timer);
          resolve(undefined);
        }
      };
    });
  }

  /** @param {any} activeChannel */
  async function waitForChannel(activeChannel) {
    if (activeChannel.readyState === "open") return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("实时通道连接超时")), 10_000);
      activeChannel.onopen = () => {
        clearTimeout(timer);
        resolve(undefined);
      };
      activeChannel.onerror = () => {
        clearTimeout(timer);
        reject(new Error("实时通道连接失败"));
      };
    });
  }

  /** @param {any} activePeer */
  async function collectQuality(activePeer) {
    const metric = /** @type {any} */ ({
      recorded_at: new Date().toISOString(),
      duration_minutes: sessionStartedAt ? (performance.now() - sessionStartedAt) / 60_000 : 0,
      packets_received: 0,
      packets_lost: 0,
      packet_loss_percent: 0,
      max_jitter_ms: 0,
      avg_rtt_ms: null,
      connection_disruptions: disconnectHandled ? 1 : 0,
    });
    if (!activePeer?.getStats) return metric;
    try {
      const reports = /** @type {any} */ (await activePeer.getStats());
      let rttTotal = 0;
      let rttSamples = 0;
      reports.forEach((/** @type {any} */ report) => {
        if (report.type === "inbound-rtp" && report.kind === "audio") {
          metric.packets_lost = Math.max(metric.packets_lost, Number(report.packetsLost || 0));
          metric.packets_received = Math.max(metric.packets_received, Number(report.packetsReceived || 0));
          metric.max_jitter_ms = Math.max(metric.max_jitter_ms, Number(report.jitter || 0) * 1000);
        }
        if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime != null) {
          rttTotal += Number(report.currentRoundTripTime) * 1000;
          rttSamples += 1;
        }
      });
      const packets = metric.packets_received + metric.packets_lost;
      metric.packet_loss_percent = packets ? metric.packets_lost / packets * 100 : 0;
      metric.avg_rtt_ms = rttSamples ? rttTotal / rttSamples : null;
    } catch {
      // Quality metrics are diagnostic and must not block session cleanup.
    }
    return metric;
  }

  /** @param {any} event @param {any} activeChannel */
  async function handleTool(event, activeChannel) {
    const callId = event.call_id;
    if (!callId || processedToolCalls.has(callId)) return;
    processedToolCalls.add(callId);
    let args = {};
    try {
      args = typeof event.arguments === "string" ? JSON.parse(event.arguments) : event.arguments || {};
    } catch {
      args = {};
    }
    let result;
    try {
      result = event.name === "update_learner_level"
        ? await api.updateLearnerLevel(sessionId, args)
        : { applied: false, reason: "Unsupported tool" };
    } catch {
      result = { applied: false, reason: "Profile update unavailable" };
    }
    if (activeChannel !== channel || activeChannel.readyState !== "open") return;
    send({
      event_id: eventId("tool"),
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    });
    send({ event_id: eventId("response"), type: "response.create" });
  }

  /** @param {any} raw @param {any} activeChannel */
  async function handleMessage(raw, activeChannel) {
    let event;
    try {
      event = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      emit({ type: "local.error", message: "收到无法解析的实时事件" });
      return;
    }
    emit(event);

    if (FINAL_MESSAGE_EVENTS.has(event.type) && sessionId) {
      void api.rememberEvent(sessionId, event).catch(() => {});
    }
    if (event.type === "response.function_call_arguments.done") {
      void handleTool(event, activeChannel);
    }
    if (event.type === "session.created") {
      const providerSessionId = event.session?.id;
      if (providerSessionId && sessionId) {
        void api.bindProviderSession(sessionId, providerSessionId)
          .then(() => emit({ type: "local.provider_session", provider_session_id: providerSessionId }))
          .catch(() => {});
      }
      if (audioTrack) {
        audioTrack.enabled = !microphone.isMuted() && !microphone.isPaused();
        await audioSender?.replaceTrack(audioTrack);
      }
      send({ event_id: eventId("config"), type: "session.update", session: sessionConfig });
    }
    if (event.type === "session.updated" && !greetingRequested) {
      greetingRequested = true;
      send({ event_id: eventId("greeting"), type: "response.create" });
    }
  }

  /**
   * @param {{ notifyBackend?: boolean, finalEvent?: any }} [options]
   */
  async function teardown({ notifyBackend = true, finalEvent = { type: "local.ended" } } = {}) {
    if (teardownPromise) return teardownPromise;
    if (!peer && !channel && !sessionId && !audioTrack) return;

    const closingPeer = peer;
    const closingChannel = channel;
    const closingSessionId = sessionId;
    peer = null;
    channel = null;
    sessionId = null;
    sessionConfig = null;
    audioSender = null;
    audioTrack = null;

    teardownPromise = (async () => {
      const quality = await collectQuality(closingPeer);
      try { closingChannel?.close?.(); } catch { /* already closed */ }
      microphone.stop();
      await audioPlayback.stop();
      try { closingPeer?.close?.(); } catch { /* already closed */ }
      if (notifyBackend && closingSessionId) {
        await api.recordQuality?.(closingSessionId, quality).catch(() => {});
        await api.closeSession?.(closingSessionId).catch(() => {});
      }
      greetingRequested = false;
      processedToolCalls.clear();
      sessionStartedAt = 0;
      if (finalEvent) emit(finalEvent);
    })().finally(() => {
      teardownPromise = null;
    });
    return teardownPromise;
  }

  /** @param {{ prompt?: string, conversationId?: string | null }} [options] */
  function start(options = {}) {
    if (startPromise) return startPromise;
    if (peer && sessionId) {
      return Promise.resolve({ sessionId, conversationId, history: [] });
    }
    lastStartOptions = { ...lastStartOptions, ...options };
    disconnectHandled = false;

    startPromise = (async () => {
      emit({ type: "local.connecting" });
      try {
        const backend = await api.createSession({
          prompt: options.prompt || "",
          conversation_id: options.conversationId || null,
        });
        sessionId = backend.session_id;
        conversationId = backend.conversation_id;
        sessionConfig = backend.session_config || {};
        greetingRequested = false;
        processedToolCalls.clear();

        const activePeer = createPeerConnection();
        peer = activePeer;
        activePeer.onconnectionstatechange = () => {
          if (activePeer !== peer) return;
          if (["failed", "disconnected", "closed"].includes(activePeer.connectionState) && !disconnectHandled) {
            disconnectHandled = true;
            void teardown({
              notifyBackend: true,
              finalEvent: { type: "local.disconnected", message: "网络连接已断开，请重试" },
            });
          }
        };
        activePeer.ontrack = (/** @type {any} */ event) => {
          const remoteStream = event.streams?.[0];
          if (!remoteStream) return;
          void audioPlayback.attach(remoteStream).catch((/** @type {any} */ error) => {
            emit({ type: "local.error", message: error?.message || "AI 音频播放失败" });
          });
        };

        emit({ type: "local.requesting_microphone" });
        const stream = await microphone.request();
        audioTrack = stream.getAudioTracks()[0] || null;
        if (!audioTrack) throw new Error("没有检测到可用的麦克风音轨");
        audioSender = activePeer.addTrack(audioTrack, stream);
        audioTrack.enabled = false;
        await audioSender?.replaceTrack(null);

        const activeChannel = activePeer.createDataChannel("oai-events");
        channel = activeChannel;
        activeChannel.onmessage = (/** @type {any} */ message) => { void handleMessage(message.data, activeChannel); };
        activePeer.ondatachannel = (/** @type {any} */ dataChannelEvent) => {
          const incoming = dataChannelEvent.channel;
          incoming.onmessage = (/** @type {any} */ message) => { void handleMessage(message.data, incoming); };
        };

        const offer = await activePeer.createOffer();
        await activePeer.setLocalDescription(offer);
        await waitForIceGathering(activePeer);
        const offerSdp = activePeer.localDescription?.sdp || offer.sdp || "";
        const answerSdp = await api.exchangeSdp(sessionId, offerSdp);
        await activePeer.setRemoteDescription({ type: "answer", sdp: normalizeSdp(answerSdp) });
        await waitForChannel(activeChannel);
        sessionStartedAt = performance.now();
        emit({
          type: "local.connected",
          session_id: sessionId,
          conversation_id: conversationId,
        });
        return { sessionId, conversationId, history: backend.history || [] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "无法开始实时对话";
        await teardown({ notifyBackend: true, finalEvent: null });
        emit({ type: "local.error", message });
        throw error;
      }
    })().finally(() => {
      startPromise = null;
    });
    return startPromise;
  }

  function retry() {
    if (peer || startPromise) return start(lastStartOptions);
    return start(lastStartOptions);
  }

  /** @param {string} text */
  function sendText(text) {
    const clean = String(text || "").trim();
    if (!clean) return false;
    const id = eventId("text");
    emit({ type: "local.text", event_id: id, text: clean });
    send({
      event_id: id,
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: clean }],
      },
    });
    send({ event_id: eventId("response"), type: "response.create" });
    return true;
  }

  /** @param {boolean} value */
  function setMuted(value) {
    const muted = microphone.setMuted(Boolean(value));
    emit({ type: "local.muted", muted });
    return muted;
  }

  /** @param {boolean} value */
  async function setPaused(value) {
    const paused = microphone.setPaused(Boolean(value));
    await audioPlayback.setPaused(paused);
    emit({ type: paused ? "local.paused" : "local.resumed" });
    return paused;
  }

  /** @param {{ notifyBackend?: boolean, silent?: boolean }} [options] */
  async function stop({ notifyBackend = true, silent = false } = {}) {
    if (startPromise) {
      try { await startPromise; } catch { /* startup cleanup already ran */ }
    }
    return teardown({
      notifyBackend,
      finalEvent: silent ? null : { type: "local.ended" },
    });
  }

  return {
    start,
    retry,
    sendText,
    setMuted,
    setPaused,
    stop,
    isActive: () => Boolean(peer || startPromise || teardownPromise),
  };
}
