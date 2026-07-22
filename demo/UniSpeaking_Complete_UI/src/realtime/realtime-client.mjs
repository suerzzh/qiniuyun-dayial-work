const eventId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function createRealtimeClient({ api, mediaDevices, createPeerConnection, createAudio = () => typeof Audio === "undefined" ? null : new Audio(), onEvent = () => {}, onMediaStream = () => {}, autoGreet = true }) {
  let sessionId = null;
  let sessionConfig = null;
  let peer = null;
  let channel = null;
  let stream = null;
  let muted = false;
  let greetingRequested = false;

  const emit = (event) => onEvent(event);
  const send = (event) => {
    if (!channel || channel.readyState !== "open") throw new Error("实时通道尚未连接");
    channel.send(JSON.stringify(event));
  };

  const handleMessage = (raw) => {
    let event;
    try { event = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { emit({ type: "local.error", message: "收到无法解析的实时事件" }); return; }
    emit(event);
    if (["conversation.item.input_audio_transcription.completed", "response.audio_transcript.done", "response.text.done"].includes(event.type)) api.rememberEvent?.(sessionId, event).catch(() => {});
    if (event.type === "session.created") send({ event_id: eventId("config"), type: "session.update", session: sessionConfig });
    if (event.type === "session.updated" && autoGreet && !greetingRequested) {
      greetingRequested = true;
      send({ event_id: eventId("greeting"), type: "response.create" });
    }
    if (event.type === "response.function_call_arguments.done" && event.call_id && api.updateLearnerLevel) {
      let args = {};
      try { args = typeof event.arguments === "string" ? JSON.parse(event.arguments) : event.arguments || {}; }
      catch { args = {}; }
      api.updateLearnerLevel(sessionId, { call_id: event.call_id, arguments: args })
        .then((result) => {
          send({
            event_id: eventId("tool"),
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(result) },
          });
          send({ event_id: eventId("response"), type: "response.create" });
        })
        .catch(() => {
          send({
            event_id: eventId("tool_error"),
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ applied: false, error: "Profile update unavailable" }) },
          });
        });
    }
  };

  async function start({ prompt = "", conversationId = null } = {}) {
    if (peer) return { sessionId };
    emit({ type: "local.connecting" });
    try {
      const backend = await api.createSession({ prompt, conversation_id: conversationId });
      sessionId = backend.session_id;
      sessionConfig = backend.session_config || {};
      peer = createPeerConnection();
      stream = await mediaDevices.getUserMedia({ audio: true });
      await onMediaStream(stream);
      for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
      peer.ontrack = (event) => {
        const audio = createAudio();
        if (!audio) return;
        audio.autoplay = true;
        audio.srcObject = event.streams?.[0] || null;
        audio.play?.().catch(() => {});
      };
      peer.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(peer?.connectionState)) emit({ type: "local.error", message: "实时连接已中断，请重新开始" });
      };
      channel = peer.createDataChannel("oai-events");
      channel.onmessage = (message) => handleMessage(message.data);
      const channelReady = channel.readyState === "open" ? Promise.resolve() : new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("实时通道连接超时")), 10_000);
        channel.onopen = () => { clearTimeout(timer); resolve(); };
        channel.onerror = () => { clearTimeout(timer); reject(new Error("实时通道连接失败")); };
      });
      peer.ondatachannel = ({ channel: incoming }) => { incoming.onmessage = (message) => handleMessage(message.data); };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answerSdp = await api.exchangeSdp(sessionId, peer.localDescription?.sdp || offer.sdp);
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      await channelReady;
      emit({ type: "local.connected", session_id: sessionId });
      return { sessionId, history: backend.history || [] };
    } catch (error) {
      await stop({ notifyBackend: false });
      emit({ type: "local.error", message: error?.message || "无法开始实时对话" });
      throw error;
    }
  }

  function sendText(text) {
    const clean = String(text || "").trim();
    if (!clean) return;
    const id = eventId("text");
    emit({ type: "local.text", event_id: id, text: clean });
    send({ event_id: id, type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: clean }] } });
    send({ event_id: eventId("response"), type: "response.create" });
  }

  function setMuted(value) {
    muted = Boolean(value);
    for (const track of stream?.getAudioTracks?.() || []) track.enabled = !muted;
    emit({ type: "local.muted", muted });
    return muted;
  }

  async function stop({ notifyBackend = true } = {}) {
    const closingId = sessionId;
    channel?.close?.();
    for (const track of stream?.getTracks?.() || []) track.stop();
    peer?.close?.();
    channel = null; stream = null; peer = null; sessionId = null; sessionConfig = null; greetingRequested = false; muted = false;
    if (notifyBackend && closingId) await api.closeSession?.(closingId).catch(() => {});
    emit({ type: "local.ended" });
  }

  return { start, stop, sendText, sendEvent: send, setMuted, getSessionId: () => sessionId, isActive: () => Boolean(peer) };
}
