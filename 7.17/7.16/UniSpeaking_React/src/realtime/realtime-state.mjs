// @ts-check

/** @typedef {{ id: string, role: "user" | "assistant", text: string, final: boolean }} RealtimeMessage */
/**
 * @typedef {Object} RealtimeState
 * @property {string} status
 * @property {string | null} sessionId
 * @property {string | null} conversationId
 * @property {string | null} providerSessionId
 * @property {RealtimeMessage[]} messages
 * @property {string | null} error
 * @property {boolean} muted
 * @property {boolean} paused
 * @property {boolean} audioAudible
 * @property {string | null} activeUserItemId
 * @property {number | null} startedAt
 */

const STATUS_TEXT = /** @type {Record<string, string>} */ ({
  idle: "点击语音球开始实时对话",
  requesting_microphone: "正在请求麦克风权限…",
  connecting: "正在建立实时连接…",
  connected: "已连接，你可以开始说话",
  user_speaking: "正在聆听你说话",
  ai_thinking: "AI 正在思考…",
  ai_speaking: "AI 正在回复",
  interrupted: "已打断 AI，正在听你说",
  paused: "对话已暂停，点击语音球恢复",
  disconnected: "网络已断开，点击语音球重试",
  ended: "对话已结束，点击语音球重新开始",
  error: "连接出现问题，点击语音球重试",
});

/** @returns {RealtimeState} */
export function createRealtimeState() {
  return {
    status: "idle",
    sessionId: null,
    conversationId: null,
    providerSessionId: null,
    messages: [],
    error: null,
    muted: false,
    paused: false,
    audioAudible: false,
    activeUserItemId: null,
    startedAt: null,
  };
}

/** @param {RealtimeMessage[]} messages @param {RealtimeMessage} next */
function upsertMessage(messages, next) {
  const index = messages.findIndex((message) => message.id === next.id);
  if (index < 0) return [...messages, next];
  const copy = [...messages];
  copy[index] = { ...copy[index], ...next };
  return copy;
}

/** @param {RealtimeMessage[]} messages @param {string} oldId @param {string} newId */
function rekeyMessage(messages, oldId, newId) {
  if (!oldId || oldId === newId) return messages;
  const oldIndex = messages.findIndex((message) => message.id === oldId);
  if (oldIndex < 0) return messages;
  if (messages.some((message) => message.id === newId)) {
    return messages.filter((message) => message.id !== oldId);
  }
  const copy = [...messages];
  copy[oldIndex] = { ...copy[oldIndex], id: newId };
  return copy;
}

/** @param {any} event */
function eventTranscript(event) {
  const content = /** @type {Array<any>} */ (event.item?.content || []);
  return String(
    event.transcript ||
    event.text ||
    content
      .map((part) => part?.transcript || part?.text || "")
      .join(" ")
      .trim() ||
    ""
  ).trim();
}

/** @param {any} event */
function responseItemId(event) {
  return String(
    event.item_id || event.response_id || event.response?.id || event.event_id || "current"
  );
}

/** @param {RealtimeState} state @param {any} event @returns {RealtimeState} */
export function applyRealtimeEvent(state, event = {}) {
  const type = String(event.type || "");
  let next = { ...state, error: null };

  if (type === "local.requesting_microphone") return { ...next, status: "requesting_microphone" };
  if (type === "local.connecting") {
    return { ...next, status: "connecting", startedAt: state.startedAt || Date.now() };
  }
  if (type === "local.connected") {
    return {
      ...next,
      status: "connected",
      sessionId: event.session_id || state.sessionId,
      conversationId: event.conversation_id || state.conversationId,
    };
  }
  if (type === "local.provider_session") {
    return { ...next, providerSessionId: event.provider_session_id || state.providerSessionId };
  }
  if (type === "local.muted") return { ...next, muted: Boolean(event.muted) };
  if (type === "local.paused") return { ...next, status: "paused", paused: true };
  if (type === "local.resumed") return { ...next, status: "connected", paused: false };
  if (type === "local.remote_audio") {
    const audible = Boolean(event.audible);
    let status = state.status;
    if (audible) status = "ai_speaking";
    else if (state.status === "interrupted") status = "user_speaking";
    else if (state.status === "ai_speaking") status = "ai_thinking";
    return { ...next, audioAudible: audible, status };
  }
  if (type === "local.text") {
    const id = String(event.event_id || `text_${Date.now()}`);
    return {
      ...next,
      status: "ai_thinking",
      messages: upsertMessage(state.messages, {
        id,
        role: "user",
        text: String(event.text || ""),
        final: true,
      }),
    };
  }
  if (type === "local.disconnected") {
    return {
      ...next,
      status: "disconnected",
      sessionId: null,
      paused: false,
      audioAudible: false,
      error: String(event.message || "网络连接已断开"),
    };
  }
  if (type === "local.ended") {
    return {
      ...next,
      status: "ended",
      sessionId: null,
      providerSessionId: null,
      muted: false,
      paused: false,
      audioAudible: false,
      activeUserItemId: null,
    };
  }
  if (type === "local.error" || type === "error") {
    return {
      ...next,
      status: "error",
      error: String(event.error?.message || event.message || "实时对话发生错误"),
      audioAudible: false,
    };
  }

  if (type === "session.created") return { ...next, status: "connecting" };
  if (type === "session.updated" || type === "response.created") {
    return { ...next, status: "ai_thinking" };
  }

  if (type === "input_audio_buffer.speech_started") {
    const itemId = String(event.item_id || `live_${Date.now()}`);
    return {
      ...next,
      status: state.audioAudible ? "interrupted" : "user_speaking",
      activeUserItemId: itemId,
      messages: upsertMessage(state.messages, {
        id: `user:${itemId}`,
        role: "user",
        text: "正在聆听…",
        final: false,
      }),
    };
  }

  if (type === "input_audio_buffer.speech_stopped") {
    const itemId = String(event.item_id || state.activeUserItemId || "current");
    const id = `user:${itemId}`;
    const existing = state.messages.find((message) => message.id === id);
    return {
      ...next,
      status: "ai_thinking",
      messages: !existing || existing.text === "正在聆听…"
        ? upsertMessage(state.messages, { id, role: "user", text: "正在识别…", final: false })
        : state.messages,
    };
  }

  const isUserTranscript = [
    "conversation.item.input_audio_transcription.delta",
    "conversation.item.input_audio_transcription.text",
    "conversation.item.input_audio_transcription.completed",
    "conversation.item.input_audio_transcription.failed",
  ].includes(type);
  if (isUserTranscript) {
    const eventItemId = event.item_id ? String(event.item_id) : null;
    let activeUserItemId = eventItemId || state.activeUserItemId || "current";
    let messages = state.messages;
    if (eventItemId && state.activeUserItemId && eventItemId !== state.activeUserItemId) {
      messages = rekeyMessage(messages, `user:${state.activeUserItemId}`, `user:${eventItemId}`);
      activeUserItemId = eventItemId;
    }
    const id = `user:${activeUserItemId}`;

    if (type.endsWith(".delta") || type.endsWith(".text")) {
      return {
        ...next,
        activeUserItemId,
        messages: upsertMessage(messages, {
          id,
          role: "user",
          text: String(event.text || "") + String(event.stash || ""),
          final: false,
        }),
      };
    }
    if (type.endsWith(".completed")) {
      return {
        ...next,
        activeUserItemId: null,
        messages: upsertMessage(messages, {
          id,
          role: "user",
          text: eventTranscript(event),
          final: true,
        }),
      };
    }
    return {
      ...next,
      activeUserItemId: null,
      error: "语音没有识别成功，请再试一次",
      messages: upsertMessage(messages, {
        id,
        role: "user",
        text: "语音没有识别成功，请再试一次。",
        final: true,
      }),
    };
  }

  if (["response.audio_transcript.delta", "response.text.delta"].includes(type)) {
    const id = `assistant:${responseItemId(event)}`;
    const current = state.messages.find((message) => message.id === id)?.text || "";
    return {
      ...next,
      status: state.audioAudible ? "ai_speaking" : "ai_thinking",
      messages: upsertMessage(state.messages, {
        id,
        role: "assistant",
        text: `${current}${String(event.delta || "")}`,
        final: false,
      }),
    };
  }

  if (["response.audio_transcript.done", "response.text.done"].includes(type)) {
    return {
      ...next,
      messages: upsertMessage(state.messages, {
        id: `assistant:${responseItemId(event)}`,
        role: "assistant",
        text: eventTranscript(event),
        final: true,
      }),
    };
  }

  if (type === "response.done") {
    return { ...next, status: "connected", audioAudible: false };
  }

  return next;
}

/** @param {RealtimeState} state */
export function sessionStatusText(state) {
  return STATUS_TEXT[state.status] || STATUS_TEXT.idle;
}

/** @param {RealtimeState} state */
export function canRetry(state) {
  return state.status === "disconnected" || state.status === "error" || state.status === "ended";
}
