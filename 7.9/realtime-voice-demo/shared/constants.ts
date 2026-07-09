// 固定常量：状态名、状态文案、错误码与用户文案、系统提示词、AI 开场白。
// 内容完全匹配 openspec/changes/realtime-voice-demo-chain/design.md。

// ===== UI 状态机 =====
export type CallState =
  | 'idle'
  | 'requesting_mic'
  | 'connecting_app'
  | 'connecting_provider'
  | 'connected'
  | 'user_speaking'
  | 'ai_generating'
  | 'ai_speaking'
  | 'ending'
  | 'ended'
  | 'failed'

export const CALL_STATES: CallState[] = [
  'idle',
  'requesting_mic',
  'connecting_app',
  'connecting_provider',
  'connected',
  'user_speaking',
  'ai_generating',
  'ai_speaking',
  'ending',
  'ended',
  'failed',
]

// 终态：进入后释放麦克风、关闭 WebSocket、停止 AI 音频播放
export const TERMINAL_STATES: CallState[] = ['ended', 'failed']

// ===== 状态文案（design.md 第 12 节） =====
export const STATE_STATUS_TEXT: Record<CallState, string> = {
  idle: '准备开始自由对话',
  requesting_mic: '正在请求麦克风权限',
  connecting_app: '正在连接本地实时语音服务',
  connecting_provider: '正在连接实时语音模型',
  connected: 'AI 正在听',
  user_speaking: '正在识别你的语音',
  ai_generating: 'AI 正在回复',
  ai_speaking: 'AI 正在说话',
  ending: '正在结束通话',
  ended: '通话已结束',
  failed: '通话连接失败',
}

// ===== 错误码与用户文案（design.md 第 10 节） =====
import type { RealtimeErrorCode } from './types'

export const ERROR_USER_MESSAGES: Record<RealtimeErrorCode, string> = {
  mic_permission_denied: '麦克风权限被拒绝，请在浏览器设置中允许麦克风。',
  mic_unavailable: '未检测到可用麦克风，请检查设备后重试。',
  app_ws_connect_failed: '无法连接本地实时语音服务，请确认服务已启动。',
  provider_config_missing: '实时语音服务配置缺失，请检查后端环境变量。',
  provider_auth_failed: '实时语音服务鉴权失败，请检查 API Key。',
  provider_ws_connect_failed: '实时语音服务连接失败，请稍后重试。',
  provider_session_error: '实时语音服务返回错误，请查看调试日志。',
  audio_encode_failed: '麦克风音频处理失败，请刷新页面重试。',
  audio_playback_failed: 'AI 语音播放失败，但你仍可查看文本回复。',
  call_timeout: '本次 Demo 通话已到达时间上限。',
  client_stopped: '通话已结束。',
}

// ===== 固定系统提示词（design.md 第 9 节，不得改写为教学/评分/纠错模式） =====
export const SYSTEM_PROMPT = `You are an AI English speaking partner for adult learners.

Your goal is to help the user speak more English in a low-pressure, natural conversation.

Rules:
- Speak mostly in simple, natural English.
- Keep each reply short: 1 to 3 sentences.
- Ask more follow-up questions, and avoid long explanations.
- Do not score the user.
- Do not correct every mistake.
- Do not mention CEFR levels.
- Do not evaluate pronunciation.
- Do not create a study report.
- If the user gets stuck, give a light hint, a keyword, or a simple sentence starter.
- If the user uses Chinese, gently help them continue in English.
- Use friendly, calm, encouraging language.
- Let the user talk more than you.

Conversation style:
- Start with an easy daily topic.
- Prefer questions about the user's life, interests, plans, food, movies, travel, work, or study.
- If the user's answer is short, ask a simple follow-up.
- If the user seems confused, simplify your English.
- Never lecture unless the user asks for an explanation.`

// AI 开场固定文案
export const AI_OPENING_MESSAGE = "Hi! Let's have a simple English chat. How was your day today?"
