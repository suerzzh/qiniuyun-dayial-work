import { createExaminerPromptCatalog } from "./examiner-prompt-catalog.mjs";

const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function createIeltsRealtimeBridge({
  api, mediaDevices, createPeerConnection, createAudio, onEvent, onMediaStream,
  transportTimeoutMs, scheduleTransportTimeout, cancelTransportTimeout,
}) {
  let sessionId = null;
  let sessionConfig = null;
  let peer = null;
  let channel = null;
  let stream = null;
  let audio = null;
  const sendEvent = (event) => {
    if (!channel || channel.readyState !== "open") throw new Error("实时通道尚未连接");
    channel.send(JSON.stringify(event));
  };
  const handleMessage = (raw) => {
    let event;
    try { event = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { onEvent({ type: "local.error", message: "收到无法解析的实时事件" }); return; }
    onEvent(event);
    if (event.type === "session.created") {
      sendEvent({ event_id: id("config"), type: "session.update", session: sessionConfig });
    }
  };
  const waitForIceGathering = async (activePeer) => {
    if (activePeer.iceGatheringState === "complete") return;
    await new Promise((resolve, reject) => {
      const timer = scheduleTransportTimeout(() => reject(new Error("ICE 候选收集超时")), transportTimeoutMs);
      const previous = activePeer.onicegatheringstatechange;
      activePeer.onicegatheringstatechange = () => {
        previous?.();
        if (activePeer.iceGatheringState === "complete") {
          cancelTransportTimeout(timer);
          resolve();
        }
      };
    });
  };
  const waitForChannel = async (activeChannel) => {
    if (activeChannel.readyState === "open") return;
    await new Promise((resolve, reject) => {
      const timer = scheduleTransportTimeout(
        () => reject(new Error("实时通道连接超时")), transportTimeoutMs,
      );
      activeChannel.onopen = () => {
        cancelTransportTimeout(timer);
        resolve();
      };
      activeChannel.onerror = () => {
        cancelTransportTimeout(timer);
        reject(new Error("实时通道连接失败"));
      };
    });
  };
  const stop = async () => {
    const closingChannel = channel;
    const closingPeer = peer;
    const closingStream = stream;
    const closingAudio = audio;
    channel = null; peer = null; stream = null; audio = null;
    sessionId = null; sessionConfig = null;
    try { closingChannel?.close?.(); } catch { /* already closed */ }
    for (const track of closingStream?.getTracks?.() || []) track.stop();
    if (closingAudio) {
      closingAudio.pause?.();
      closingAudio.srcObject = null;
    }
    try { closingPeer?.close?.(); } catch { /* already closed */ }
  };
  return {
    async start() {
      if (peer) return { sessionId };
      try {
        const backend = await api.createSession({});
        sessionId = backend.session_id;
        sessionConfig = backend.session_config || {};
        peer = createPeerConnection();
        stream = await mediaDevices.getUserMedia({ audio: true });
        await onMediaStream(stream);
        for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
        peer.ontrack = (event) => {
          audio = createAudio();
          if (!audio) return;
          audio.autoplay = true;
          audio.srcObject = event.streams?.[0] || null;
          audio.play?.().catch(() => {});
        };
        channel = peer.createDataChannel("oai-events");
        channel.onmessage = (message) => handleMessage(message.data);
        peer.ondatachannel = ({ channel: incoming }) => { incoming.onmessage = (message) => handleMessage(message.data); };
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForIceGathering(peer);
        const answerSdp = await api.exchangeSdp(sessionId, peer.localDescription?.sdp || offer.sdp);
        await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
        await waitForChannel(channel);
        return { sessionId, history: backend.history || [] };
      } catch (error) {
        await stop();
        throw error;
      }
    },
    sendEvent,
    setMuted(value) {
      for (const track of stream?.getAudioTracks?.() || []) track.enabled = !value;
      return Boolean(value);
    },
    stop,
  };
}

export function createIeltsSessionRuntime({
  api, streamer, mediaDevices, createPeerConnection, createAudio, wsBaseUrl = "ws://127.0.0.1:8000",
  onTranscript = () => {}, onStatus = () => {}, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  examinerResponseTimeoutMs = 30_000,
  scheduleTimeout = (callback, ms) => globalThis.setTimeout(callback, ms),
  cancelTimeout = (timerId) => globalThis.clearTimeout(timerId),
  transportTimeoutMs = 10_000,
  scheduleTransportTimeout = (callback, ms) => globalThis.setTimeout(callback, ms),
  cancelTransportTimeout = (timerId) => globalThis.clearTimeout(timerId),
}) {
  let attempt = null;
  let activeTurn = null;
  let sequence = 0;
  let transcript = "";
  let remoteAudio = null;
  let candidateSpeaking = false;
  let realtimeConfigured = false;
  const turns = new Map();
  const itemTurns = new Map();
  const pendingExaminerEvents = [];
  const examinerRequests = [];
  const ignoredResponseIds = new Set();
  const prompts = createExaminerPromptCatalog();

  const event = (type, fields = {}) => ({ type, event_id: id("evt"), attempt_id: attempt?.attempt_id,
    sequence: ++sequence, timestamp_ms: Date.now(), ...fields });
  const scoringEvent = (type, fields) => streamer.control(event(type, fields));

  const realtimeApi = {
    createSession: async () => ({ session_id: attempt.attempt_id, session_config: attempt.realtime_session_config, history: [] }),
    exchangeSdp: (sessionId, sdp) => api.exchangeSdp(sessionId, sdp),
    closeSession: async () => {},
  };
  const settleExaminerRequest = (request, providerEvent) => {
    const index = examinerRequests.indexOf(request);
    if (index < 0) return false;
    examinerRequests.splice(index, 1);
    if (request.timerId != null) cancelTimeout(request.timerId);
    request.onDone(providerEvent);
    return true;
  };
  const clearExaminerRequests = () => {
    for (const request of examinerRequests.splice(0)) {
      if (request.timerId != null) cancelTimeout(request.timerId);
    }
    ignoredResponseIds.clear();
  };
  const sendExaminerEventNow = (providerEvent, onDone) => {
    realtime.sendEvent(providerEvent);
    const request = { responseId: null, onDone: typeof onDone === "function" ? onDone : () => {}, timerId: null };
    request.timerId = scheduleTimeout(() => {
      if (request.responseId) ignoredResponseIds.add(request.responseId);
      const timeoutEvent = { type: "local.examiner_response_timeout", response_id: request.responseId,
        timeout_ms: examinerResponseTimeoutMs };
      if (settleExaminerRequest(request, timeoutEvent)) onStatus(timeoutEvent);
    }, examinerResponseTimeoutMs);
    request.timerId?.unref?.();
    examinerRequests.push(request);
  };
  const sendExaminerEvent = (providerEvent, onDone) => {
    if (!realtimeConfigured) {
      pendingExaminerEvents.push({ providerEvent, onDone });
      return;
    }
    sendExaminerEventNow(providerEvent, onDone);
  };
  const openTurn = ({ part, questionId, questionText, longTurn = false,
    turnType = longTurn ? "PART2_LONG_TURN" : "STANDARD", scoringEligible = part >= 1 }) => {
    const turnId = id(part === 0 ? "turn_intro" : `turn_p${part}`);
    activeTurn = { turnId, part, questionId, questionText, longTurn, turnType,
      scoringEligible, transcript: "" };
    turns.set(turnId, activeTurn);
    candidateSpeaking = false;
    if (remoteAudio) remoteAudio.muted = false;
    transcript = "";
    if (part >= 1) scoringEvent("part.started", { part: `part${part}` });
    scoringEvent("question.asked", { part, question_id: questionId, question_text: questionText });
    scoringEvent("turn.opened", { turn_id: turnId, part, question_id: questionId,
      question_text: questionText, turn_type: turnType, scoring_eligible: scoringEligible });
    return turnId;
  };
  const realtime = createIeltsRealtimeBridge({
    api: realtimeApi, mediaDevices, createPeerConnection, createAudio: () => {
      remoteAudio = createAudio?.() || null;
      return remoteAudio;
    },
    async onMediaStream(stream) {
      const path = attempt.scoring_ws_url;
      const wsUrl = path.startsWith("ws") ? path : `${wsBaseUrl}${path}`;
      await streamer.attach(stream, wsUrl);
      scoringEvent("stream.start", {});
    },
    transportTimeoutMs, scheduleTransportTimeout, cancelTransportTimeout,
    onEvent(providerEvent) {
      if (providerEvent.type === "session.updated") {
        realtimeConfigured = true;
        for (const pending of pendingExaminerEvents.splice(0)) {
          sendExaminerEventNow(pending.providerEvent, pending.onDone);
        }
      }
      if (providerEvent.type === "response.created") {
        const responseId = providerEvent.response?.id || providerEvent.response_id || null;
        const request = examinerRequests.find((candidate) => candidate.responseId == null);
        if (request && responseId) request.responseId = responseId;
      }
      if (providerEvent.type === "response.done") {
        const responseId = providerEvent.response?.id || providerEvent.response_id || null;
        if (responseId && ignoredResponseIds.delete(responseId)) {
          onStatus(providerEvent);
          return;
        }
        let request = responseId
          ? examinerRequests.find((candidate) => candidate.responseId === responseId)
          : examinerRequests[0];
        if (!request && responseId) {
          request = examinerRequests.find((candidate) => candidate.responseId == null);
          if (request) request.responseId = responseId;
        }
        if (request) settleExaminerRequest(request, providerEvent);
        onStatus(providerEvent);
        return;
      }
      const providerItemId = providerEvent.item_id || providerEvent.item?.id || "";
      const eventTurn = itemTurns.get(providerItemId) || activeTurn;
      if (!eventTurn) { onStatus(providerEvent); return; }
      if (eventTurn.longTurn && candidateSpeaking && providerEvent.type === "response.created") {
        try { realtime.sendEvent({ type: "response.cancel", event_id: id("cancel") }); } catch { /* best effort */ }
      }
      if (providerEvent.type === "input_audio_buffer.speech_started") {
        if (providerItemId) itemTurns.set(providerItemId, eventTurn);
        scoringEvent("turn.speech_started", { turn_id: eventTurn.turnId, realtime_item_id: providerItemId });
      }
      if (providerEvent.type === "input_audio_buffer.speech_stopped") {
        scoringEvent("turn.speech_stopped", { turn_id: eventTurn.turnId });
        if (eventTurn.longTurn) {
          try { realtime.sendEvent({ type: "response.cancel", event_id: id("cancel") }); } catch { /* data channel may still be opening */ }
        }
      }
      if (["conversation.item.input_audio_transcription.delta",
        "conversation.item.input_audio_transcription.text"].includes(providerEvent.type)) {
        if (providerItemId) itemTurns.set(providerItemId, eventTurn);
        const confirmed = String(providerEvent.text || "");
        const tentative = String(providerEvent.stash || "");
        const interim = `${confirmed}${tentative}`.trim();
        if (interim && eventTurn === activeTurn) onTranscript({ interim });
      }
      if (providerEvent.type === "conversation.item.input_audio_transcription.completed") {
        const segment = String(providerEvent.transcript || providerEvent.text || "").trim();
        if (!segment) return;
        eventTurn.transcript = `${eventTurn.transcript || ""} ${segment}`.trim();
        if (eventTurn === activeTurn) transcript = eventTurn.transcript;
        scoringEvent("turn.transcript_chunk", { turn_id: eventTurn.turnId,
          realtime_item_id: providerItemId, text: eventTurn.transcript, final: true });
        if (eventTurn === activeTurn) onTranscript({ final: segment, complete: eventTurn.transcript });
      }
      onStatus(providerEvent);
    },
  });

  return {
    async start({ mode, paperSnapshot }) {
      realtimeConfigured = false;
      pendingExaminerEvents.length = 0;
      clearExaminerRequests();
      attempt = await api.createAttempt({ mode, paper_snapshot: paperSnapshot, client_exam_state_version: 1 });
      try {
        await realtime.start();
      } catch (error) {
        try { await streamer.stop(); } catch { /* preserve the original transport error */ }
        try {
          if (attempt?.attempt_id) await api.abandon(attempt.attempt_id);
        } catch { /* attempt cleanup is best effort */ }
        throw error;
      }
      return attempt;
    },
    examinerInstruction(text, onDone) {
      if (remoteAudio) remoteAudio.muted = false;
      try {
        sendExaminerEvent({ event_id: id("instruction"), type: "response.create",
          response: { instructions: prompts.sayExactly(text) } }, onDone);
      } catch { /* connection status is reported separately */ }
    },
    openTurn,
    questionAsked({ part, questionId, questionText, longTurn = false, onDone }) {
      const turnId = openTurn({ part, questionId, questionText, longTurn });
      try {
        sendExaminerEvent({ event_id: id("question"), type: "response.create",
          response: { instructions: prompts.askQuestion(questionText) } }, onDone);
      } catch { /* controller can still render the frozen question while connection settles */ }
      return turnId;
    },
    setMuted: (muted) => realtime.setMuted(muted),
    startAnswer() {
      candidateSpeaking = true;
      if (remoteAudio) remoteAudio.muted = true;
    },
    completeTurn(rawTranscript, reason = "USER_DONE") {
      if (!activeTurn) return;
      const clean = String(rawTranscript || transcript || "").trim();
      scoringEvent("turn.transcript_completed", { turn_id: activeTurn.turnId, text: clean, final: true });
      scoringEvent(activeTurn.longTurn ? "part2.speaking_completed" : "turn.completed",
        { turn_id: activeTurn.turnId, reason });
      candidateSpeaking = false;
      if (remoteAudio) remoteAudio.muted = false;
      activeTurn.completed = true;
      activeTurn = null;
      transcript = "";
    },
    async finalize() {
      if (!attempt) throw new Error("IELTS attempt has not started");
      // Keep the shared PCM stream alive for the configured 700 ms post-roll.
      await wait(750);
      scoringEvent("stream.end", {});
      await api.finalize(attempt.attempt_id);
      const terminal = new Set(["COMPLETE", "PARTIAL", "UNSCORABLE"]);
      for (let i = 0; i < 120; i += 1) {
        const report = await api.report(attempt.attempt_id);
        if (terminal.has(report?.scoringStatus || report?.scoring_status)) return report;
        await wait(1000);
      }
      return { scoring_status: "FINALIZING", attempt_id: attempt.attempt_id };
    },
    async abandon() { clearExaminerRequests(); if (attempt) await api.abandon(attempt.attempt_id); await realtime.stop(); await streamer.stop(); },
    async stop() { clearExaminerRequests(); await realtime.stop(); await streamer.stop(); },
    getAttemptId: () => attempt?.attempt_id || null,
  };
}

export function createIeltsRealtimeSpeechAdapter(runtime, handlers) {
  let listening = false;
  return {
    isSupported: () => Boolean(runtime),
    async start() { listening = true; runtime.startAnswer(); runtime.setMuted(false); },
    pause() { listening = false; runtime.setMuted(true); },
    async resume() { listening = true; runtime.startAnswer(); runtime.setMuted(false); },
    stop() { listening = false; runtime.setMuted(true); },
    dispose() { listening = false; },
    receive(event) {
      if (!listening) return;
      if (event.final) handlers.onFinal?.(event.final); else if (event.interim) handlers.onInterim?.(event.interim);
    },
  };
}
