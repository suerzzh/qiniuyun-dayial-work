const upsertMessage = (messages, next) => {
  const index = messages.findIndex((message) => message.id === next.id);
  if (index < 0) return [...messages, next];
  const copy = [...messages];
  copy[index] = { ...copy[index], ...next };
  return copy;
};

const transcript = (event) => event.transcript || event.text || (event.item?.content || []).map((part) => part?.transcript || part?.text || "").join(" ").trim();

export function createRealtimeState() {
  return { status: "idle", sessionId: null, messages: [], error: null, muted: false, startedAt: null };
}

export function applyRealtimeEvent(state, event = {}) {
  const next = { ...state, error: null };
  const itemId = event.item_id || event.response_id || event.event_id || "current";

  if (event.type === "local.connecting") return { ...next, status: "connecting", startedAt: state.startedAt || Date.now() };
  if (event.type === "local.connected") return { ...next, status: "connected", sessionId: event.session_id || state.sessionId };
  if (event.type === "local.ended") return { ...next, status: "ended", sessionId: null, muted: false };
  if (event.type === "local.error") return { ...next, status: "error", error: event.message || "连接失败" };
  if (event.type === "local.muted") return { ...next, muted: Boolean(event.muted) };
  if (event.type === "local.text") return { ...next, messages: upsertMessage(state.messages, { id: itemId, role: "user", text: event.text, final: true }) };
  if (event.type === "session.created") return { ...next, status: "configuring" };
  if (event.type === "session.updated") return { ...next, status: "ai_speaking" };
  if (event.type === "response.created" || event.type === "response.audio.started") return { ...next, status: "ai_speaking" };
  if (event.type === "response.done") return { ...next, status: "listening" };
  if (event.type === "input_audio_buffer.speech_started") return { ...next, status: "listening", messages: upsertMessage(state.messages, { id: `user:${itemId}`, role: "user", text: "正在聆听…", final: false }) };
  if (event.type === "input_audio_buffer.speech_stopped") return { ...next, messages: upsertMessage(state.messages, { id: `user:${itemId}`, role: "user", text: "正在识别…", final: false }) };
  if (["conversation.item.input_audio_transcription.delta", "conversation.item.input_audio_transcription.text"].includes(event.type)) {
    return { ...next, messages: upsertMessage(state.messages, { id: `user:${itemId}`, role: "user", text: event.text || event.stash || "", final: false }) };
  }
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    return { ...next, messages: upsertMessage(state.messages, { id: `user:${itemId}`, role: "user", text: transcript(event), final: true }) };
  }
  if (event.type === "conversation.item.input_audio_transcription.failed") {
    return { ...next, error: "语音没有识别成功，请再试一次", messages: upsertMessage(state.messages, { id: `user:${itemId}`, role: "user", text: "语音没有识别成功，请再试一次。", final: true }) };
  }
  if (["response.audio_transcript.delta", "response.text.delta"].includes(event.type)) {
    const id = `assistant:${itemId}`;
    const current = state.messages.find((message) => message.id === id)?.text || "";
    return { ...next, status: "ai_speaking", messages: upsertMessage(state.messages, { id, role: "assistant", text: `${current}${event.delta || ""}`, final: false }) };
  }
  if (["response.audio_transcript.done", "response.text.done"].includes(event.type)) {
    return { ...next, messages: upsertMessage(state.messages, { id: `assistant:${itemId}`, role: "assistant", text: event.transcript || event.text || "", final: true }) };
  }
  if (event.type === "error") return { ...next, status: "error", error: event.error?.message || event.message || "实时对话发生错误" };
  return next;
}
