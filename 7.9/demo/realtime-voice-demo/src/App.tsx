// 自由对话页面：五个区域（design.md 第 12 节）
// 1. 顶部状态栏：标题、连接状态、通话计时
// 2. 消息列表：用户消息、AI 消息、临时转写
// 3. 底部控制区：开始按钮、结束按钮、麦克风状态
// 4. 错误提示区：最近一个用户可读错误
// 5. 调试面板：默认展开
import { useRealtimeCall } from './useRealtimeCall'
import { STATE_STATUS_TEXT, TERMINAL_STATES } from '../shared/constants'
import type { CallState } from '../shared/constants'

const ACTIVE_STATES: CallState[] = [
  'connected',
  'user_speaking',
  'ai_generating',
  'ai_speaking',
]

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function App() {
  const call = useRealtimeCall()
  const isActive = ACTIVE_STATES.includes(call.state)
  const isConnecting =
    call.state === 'requesting_mic' ||
    call.state === 'connecting_app' ||
    call.state === 'connecting_provider' ||
    call.state === 'ending'
  const canStart =
    call.state === 'idle' || TERMINAL_STATES.includes(call.state)
  const canEnd = isActive || isConnecting

  return (
    <div className="app">
      {/* 1. 状态栏 */}
      <header className="status-bar">
        <div>
          <div className="title">AI 英语口语陪练 · 自由对话</div>
          <div className="status-text">{STATE_STATUS_TEXT[call.state]}</div>
        </div>
        <div className="timer">{formatSeconds(call.callSeconds)}</div>
      </header>

      {/* 2. 消息列表 */}
      <section className="messages">
        {call.messages.length === 0 ? (
          <div className="msg-empty">准备开始自由对话</div>
        ) : (
          call.messages.map((m) => (
            <div
              key={m.id}
              className={`msg ${m.role} ${m.final ? '' : 'temp'}`}
            >
              {m.text}
            </div>
          ))
        )}
      </section>

      {/* 3. 控制区 */}
      <section className="control-area">
        <button
          className="btn btn-start"
          onClick={call.start}
          disabled={!canStart}
        >
          开始对话
        </button>
        <button
          className="btn btn-end"
          onClick={call.end}
          disabled={!canEnd}
        >
          结束通话
        </button>
        <span className="mic-status">
          {isActive ? '麦克风已开启' : call.state === 'requesting_mic' ? '请求麦克风中…' : '麦克风未开启'}
        </span>
      </section>

      {/* 4. 错误提示区 */}
      {call.errorUserMessage && (
        <div className="error-banner">{call.errorUserMessage}</div>
      )}

      {/* 5. 调试面板（默认展开） */}
      <section className="debug-panel">
        <div className="debug-head">调试面板</div>
        <div className="debug-grid">
          <span className="k">call_id</span>
          <span className="v">{call.debug.callId || '-'}</span>
          <span className="k">provider</span>
          <span className="v">{call.debug.provider}</span>
          <span className="k">model</span>
          <span className="v">{call.debug.model || '-'}</span>
          <span className="k">state</span>
          <span className="v">{call.debug.state}</span>
          <span className="k">first_transcript_latency_ms</span>
          <span className="v">{call.debug.firstTranscriptLatencyMs || '-'}</span>
          <span className="k">first_ai_audio_latency_ms</span>
          <span className="v">{call.debug.firstAiAudioLatencyMs || '-'}</span>
          <span className="k">audio_chunks_sent</span>
          <span className="v">{call.debug.audioChunksSent}</span>
          <span className="k">ai_audio_chunks_received</span>
          <span className="v">{call.debug.aiAudioChunksReceived}</span>
          <span className="k">last_event</span>
          <span className="v">{call.debug.lastEvent || '-'}</span>
          <span className="k">last_error</span>
          <span className="v">{call.errorCode || call.debug.lastError || '-'}</span>
        </div>
        <div className="debug-logs">
          {call.debug.logs.length === 0
            ? '（暂无日志）'
            : call.debug.logs.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </section>
    </div>
  )
}
