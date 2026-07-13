// 浏览器与 Demo 后端之间的统一事件契约。
// 所有后端到浏览器事件必须符合 ServerEvent 信封；浏览器只允许发送 ClientEvent。
// 来源：realtime-event-contract/spec.md

// ===== 后端到浏览器事件信封 =====

export interface ServerEventEnvelope {
  type: string
  call_id: string
  ts: number
  payload: Record<string, unknown>
}

// ===== 会话事件 =====

export interface SessionCreatedPayload {
  provider: 'qwen'
  model: string
}

export interface SessionReadyPayload {
  state: 'connected'
}

export interface SessionClosedPayload {
  reason: 'client_stopped' | 'call_timeout' | 'provider_closed'
}

// ===== 转写事件 =====

export interface UserTranscriptDeltaPayload {
  text: string
  is_final: false
}

export interface UserTranscriptFinalPayload {
  text: string
  is_final: true
}

// ===== AI 回复事件 =====

export interface AiTextDeltaPayload {
  text: string
}

export interface AiTextDonePayload {
  message_id: string
}

export interface AiAudioDeltaPayload {
  audio_base64: string
  format: 'pcm'
  sample_rate: 24000
}

export interface AiAudioDonePayload {
  message_id: string
}

// ===== 错误事件 =====

export type RealtimeErrorCode =
  | 'mic_permission_denied'
  | 'mic_unavailable'
  | 'app_ws_connect_failed'
  | 'provider_config_missing'
  | 'provider_auth_failed'
  | 'provider_ws_connect_failed'
  | 'provider_session_error'
  | 'audio_encode_failed'
  | 'audio_playback_failed'
  | 'call_timeout'
  | 'client_stopped'

export interface ErrorPayload {
  code: RealtimeErrorCode
  user_message: string
  debug_message: string
  fatal: boolean
}

// ===== 调试事件 =====

export interface DebugPayload {
  event: string
  data?: Record<string, unknown>
}

// ===== 浏览器到后端事件 =====

export interface ClientStartEvent {
  type: 'client.start'
  payload: { requested_mode: 'free_talk' }
}

export interface ClientAudioEvent {
  type: 'client.audio'
  payload: {
    audio_base64: string
    format: 'pcm'
    sample_rate: 16000
  }
}

export interface ClientStopEvent {
  type: 'client.stop'
  payload: { reason: 'user_clicked_end' }
}

export interface ClientPingEvent {
  type: 'client.ping'
  payload: { client_time_ms: number }
}

export type ClientEvent =
  | ClientStartEvent
  | ClientAudioEvent
  | ClientStopEvent
  | ClientPingEvent

// 浏览器只允许发送以下事件类型
export const ALLOWED_CLIENT_EVENT_TYPES = [
  'client.start',
  'client.audio',
  'client.stop',
  'client.ping',
] as const
