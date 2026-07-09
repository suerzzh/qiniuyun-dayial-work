// 自由对话主状态机 Hook。
// 状态流（design.md 第 5.1 节）：
//   idle -> requesting_mic -> connecting_app -> connecting_provider -> connected
//   -> user_speaking -> ai_generating -> ai_speaking -> connected -> ending -> ended
//   任意非终态 -> failed
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CallState } from '../shared/constants'
import { TERMINAL_STATES } from '../shared/constants'
import type {
  ServerEventEnvelope,
  RealtimeErrorCode,
} from '../shared/types'
import { RealtimeClient, buildBackendWsUrl } from './realtimeClient'
import { startAudioCapture, type AudioCaptureHandle } from './audioCapture'
import { AudioPlayer } from './audioPlayer'

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  final: boolean
}

export interface DebugInfo {
  callId: string
  provider: string
  model: string
  state: CallState
  firstTranscriptLatencyMs: number
  firstAiAudioLatencyMs: number
  lastEvent: string
  lastError: string
  audioChunksSent: number
  aiAudioChunksReceived: number
  logs: string[]
}

export interface RealtimeCallApi {
  state: CallState
  messages: ChatMessage[]
  errorUserMessage: string
  errorCode: RealtimeErrorCode | ''
  debug: DebugInfo
  callSeconds: number
  start: () => void
  end: () => void
}

export function useRealtimeCall(): RealtimeCallApi {
  const [state, setState] = useState<CallState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [errorUserMessage, setErrorUserMessage] = useState('')
  const [errorCode, setErrorCode] = useState<RealtimeErrorCode | ''>('')
  const [callSeconds, setCallSeconds] = useState(0)
  const [debug, setDebug] = useState<DebugInfo>({
    callId: '',
    provider: 'qwen',
    model: '',
    state: 'idle',
    firstTranscriptLatencyMs: 0,
    firstAiAudioLatencyMs: 0,
    lastEvent: '',
    lastError: '',
    audioChunksSent: 0,
    aiAudioChunksReceived: 0,
    logs: [],
  })

  const clientRef = useRef<RealtimeClient | null>(null)
  const captureRef = useRef<AudioCaptureHandle | null>(null)
  const playerRef = useRef<AudioPlayer | null>(null)
  const stateRef = useRef<CallState>('idle')
  const readyRef = useRef(false)
  const endedRef = useRef(false)
  const audioStartedAtRef = useRef(0)
  const firstTranscriptAtRef = useRef(0)
  const firstAiAudioAtRef = useRef(0)
  const audioChunksSentRef = useRef(0)
  const aiAudioChunksReceivedRef = useRef(0)
  const currentAiMessageRef = useRef<ChatMessage | null>(null)
  const tempUserMessageRef = useRef<ChatMessage | null>(null)
  const timerRef = useRef<number | null>(null)

  const updateState = useCallback((s: CallState) => {
    stateRef.current = s
    setState(s)
    setDebug((d) => ({ ...d, state: s }))
  }, [])

  const pushLog = useCallback((line: string) => {
    setDebug((d) => ({ ...d, logs: [...d.logs.slice(-80), line] }))
  }, [])

  const failCall = useCallback(
    (code: RealtimeErrorCode, userMessage: string, fatal: boolean) => {
      if (fatal) {
        setErrorCode(code)
        setErrorUserMessage(userMessage)
        cleanup()
        updateState('failed')
      }
    },
    [updateState],
  )

  // 停止麦克风、播放、连接
  const cleanup = useCallback(() => {
    if (captureRef.current) {
      captureRef.current.stop()
      captureRef.current = null
    }
    if (playerRef.current) {
      playerRef.current.stopAll()
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 启动通话计时
  const startTimer = useCallback(() => {
    setCallSeconds(0)
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setCallSeconds((s) => s + 1)
    }, 1000)
  }, [])

  // 处理后端事件
  const handleEvent = useCallback(
    (evt: ServerEventEnvelope) => {
      switch (evt.type) {
        case 'session.created': {
          const p = evt.payload as { provider: string; model: string }
          setDebug((d) => ({
            ...d,
            callId: evt.call_id,
            provider: p.provider,
            model: p.model,
          }))
          pushLog(`session.created call_id=${evt.call_id}`)
          break
        }
        case 'session.ready': {
          readyRef.current = true
          updateState('connected')
          startTimer()
          pushLog('session.ready -> connected')
          break
        }
        case 'server.user_transcript_delta': {
          const p = evt.payload as { text: string }
          if (!firstTranscriptAtRef.current) {
            firstTranscriptAtRef.current = Date.now()
          }
          updateState('user_speaking')
          // 更新或创建临时用户消息
          if (tempUserMessageRef.current) {
            tempUserMessageRef.current = {
              ...tempUserMessageRef.current,
              text: p.text,
            }
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === tempUserMessageRef.current!.id ? tempUserMessageRef.current! : m,
              ),
            )
          } else {
            const msg: ChatMessage = {
              id: `u_${Date.now()}`,
              role: 'user',
              text: p.text,
              final: false,
            }
            tempUserMessageRef.current = msg
            setMessages((msgs) => [...msgs, msg])
          }
          break
        }
        case 'server.user_transcript_final': {
          const p = evt.payload as { text: string }
          if (tempUserMessageRef.current) {
            tempUserMessageRef.current = {
              ...tempUserMessageRef.current,
              text: p.text,
              final: true,
            }
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === tempUserMessageRef.current!.id ? tempUserMessageRef.current! : m,
              ),
            )
          } else {
            const msg: ChatMessage = {
              id: `u_${Date.now()}`,
              role: 'user',
              text: p.text,
              final: true,
            }
            setMessages((msgs) => [...msgs, msg])
          }
          tempUserMessageRef.current = null
          break
        }
        case 'server.ai_text_delta': {
          const p = evt.payload as { text: string }
          updateState('ai_generating')
          if (currentAiMessageRef.current) {
            currentAiMessageRef.current = {
              ...currentAiMessageRef.current,
              text: currentAiMessageRef.current.text + p.text,
            }
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === currentAiMessageRef.current!.id ? currentAiMessageRef.current! : m,
              ),
            )
          } else {
            const msg: ChatMessage = {
              id: `a_${Date.now()}`,
              role: 'ai',
              text: p.text,
              final: false,
            }
            currentAiMessageRef.current = msg
            setMessages((msgs) => [...msgs, msg])
          }
          break
        }
        case 'server.ai_text_done': {
          if (currentAiMessageRef.current) {
            currentAiMessageRef.current = {
              ...currentAiMessageRef.current,
              final: true,
            }
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === currentAiMessageRef.current!.id ? currentAiMessageRef.current! : m,
              ),
            )
            currentAiMessageRef.current = null
          }
          break
        }
        case 'server.ai_audio_delta': {
          const p = evt.payload as { audio_base64: string }
          if (!firstAiAudioAtRef.current) {
            firstAiAudioAtRef.current = Date.now()
            const latency = audioStartedAtRef.current
              ? firstAiAudioAtRef.current - audioStartedAtRef.current
              : 0
            setDebug((d) => ({ ...d, firstAiAudioLatencyMs: latency }))
          }
          aiAudioChunksReceivedRef.current++
          updateState('ai_speaking')
          playerRef.current?.enqueue(p.audio_base64)
          break
        }
        case 'server.ai_audio_done': {
          playerRef.current?.finishSegment()
          if (readyRef.current && !endedRef.current) {
            updateState('connected')
          }
          break
        }
        case 'server.error': {
          const p = evt.payload as {
            code: RealtimeErrorCode
            user_message: string
            debug_message: string
            fatal: boolean
          }
          setErrorCode(p.code)
          setErrorUserMessage(p.user_message)
          setDebug((d) => ({ ...d, lastError: p.code }))
          pushLog(`server.error code=${p.code} fatal=${p.fatal}`)
          if (p.fatal) {
            cleanup()
            updateState('failed')
          }
          break
        }
        case 'session.closed': {
          const p = evt.payload as { reason: string }
          pushLog(`session.closed reason=${p.reason}`)
          cleanup()
          updateState('ended')
          break
        }
        case 'server.debug': {
          const p = evt.payload as { event: string; first_transcript_latency_ms?: number; last_event?: string; last_error?: string }
          pushLog(`debug ${p.event}`)
          setDebug((d) => ({
            ...d,
            firstTranscriptLatencyMs:
              p.first_transcript_latency_ms ?? d.firstTranscriptLatencyMs,
            lastEvent: p.last_event ?? d.lastEvent,
            lastError: p.last_error ?? d.lastError,
            audioChunksSent: audioChunksSentRef.current,
            aiAudioChunksReceived: aiAudioChunksReceivedRef.current,
          }))
          break
        }
      }
      setDebug((d) => ({ ...d, lastEvent: evt.type }))
    },
    [cleanup, startTimer, updateState, pushLog],
  )

  // 开始对话
  const start = useCallback(async () => {
    if (stateRef.current !== 'idle' && stateRef.current !== 'ended' && stateRef.current !== 'failed') return
    // 重置
    endedRef.current = false
    readyRef.current = false
    setMessages([])
    setErrorUserMessage('')
    setErrorCode('')
    firstTranscriptAtRef.current = 0
    firstAiAudioAtRef.current = 0
    audioChunksSentRef.current = 0
    aiAudioChunksReceivedRef.current = 0
    currentAiMessageRef.current = null
    tempUserMessageRef.current = null

    // 1. 请求麦克风权限
    updateState('requesting_mic')
    try {
      // 预先创建播放器
      playerRef.current = new AudioPlayer(24000)
      await playerRef.current.resume()
      // 尝试采集（这里只为了触发权限请求，真正采集在 session.ready 后启动）
      const capture = await startAudioCapture({
        onChunk: (base64, format, sampleRate) => {
          if (!readyRef.current || endedRef.current) return
          if (!audioStartedAtRef.current) audioStartedAtRef.current = Date.now()
          audioChunksSentRef.current++
          clientRef.current?.send({
            type: 'client.audio',
            payload: { audio_base64: base64, format, sample_rate: sampleRate },
          })
        },
        onChunkTooLarge: (durationMs) => {
          pushLog(`audio_chunk_too_large ${durationMs}ms`)
        },
        onError: (code) => {
          failCall(code, getErrorMessage(code), true)
        },
      })
      captureRef.current = capture
    } catch {
      // 麦克风拒绝或不可用
      failCall('mic_permission_denied', getErrorMessage('mic_permission_denied'), true)
      return
    }

    // 2. 连接后端 WebSocket
    updateState('connecting_app')
    const url = buildBackendWsUrl()
    const client = new RealtimeClient(url, {
      onOpen: () => {
        pushLog('app_ws_open')
        updateState('connecting_provider')
        // 发送 client.start
        client.send({ type: 'client.start', payload: { requested_mode: 'free_talk' } })
      },
      onClose: (code, reason) => {
        pushLog(`app_ws_close code=${code} reason=${reason}`)
        if (!endedRef.current && stateRef.current !== 'ended' && stateRef.current !== 'failed') {
          failCall('app_ws_connect_failed', getErrorMessage('app_ws_connect_failed'), true)
        }
      },
      onError: () => {
        pushLog('app_ws_error')
        if (stateRef.current === 'connecting_app' || stateRef.current === 'connecting_provider') {
          failCall('app_ws_connect_failed', getErrorMessage('app_ws_connect_failed'), true)
        }
      },
      onEvent: handleEvent,
    })
    clientRef.current = client
    client.connect()
  }, [failCall, handleEvent, pushLog, updateState])

  // 结束通话
  const end = useCallback(() => {
    if (endedRef.current) return
    if (TERMINAL_STATES.includes(stateRef.current)) return
    endedRef.current = true
    updateState('ending')
    clientRef.current?.send({ type: 'client.stop', payload: { reason: 'user_clicked_end' } })
    // 立即停止麦克风和播放
    if (captureRef.current) {
      captureRef.current.stop()
      captureRef.current = null
    }
    if (playerRef.current) {
      playerRef.current.stopAll()
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    // 关闭 WebSocket（后端会在 session.closed 后关闭，这里兜底）
    setTimeout(() => {
      clientRef.current?.close()
    }, 500)
  }, [updateState])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      endedRef.current = true
      if (captureRef.current) captureRef.current.stop()
      if (playerRef.current) playerRef.current.close()
      if (timerRef.current) window.clearInterval(timerRef.current)
      clientRef.current?.close()
    }
  }, [])

  return {
    state,
    messages,
    errorUserMessage,
    errorCode,
    debug,
    callSeconds,
    start,
    end,
  }
}

function getErrorMessage(code: RealtimeErrorCode): string {
  const map: Record<RealtimeErrorCode, string> = {
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
  return map[code]
}
