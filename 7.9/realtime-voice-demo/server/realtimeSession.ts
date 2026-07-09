// Realtime 会话：绑定浏览器 WebSocket 与 Qwen 供应商连接。
// 职责：call_id 生成、供应商连接、事件归一化转发、结束清理、超时关闭、调试日志。
// 隐私约束：不保存录音、不输出完整音频 Base64、不暴露 API Key。
import type WebSocket from 'ws'
import type { RealtimeConfig } from './config.js'
import { missingProviderVars } from './config.js'
import { generateCallId } from './callId.js'
import {
  QwenProviderClient,
  ProviderAuthError,
  ProviderConnectError,
} from './qwenProvider.js'
import { ERROR_USER_MESSAGES } from '../shared/constants.js'
import type { RealtimeErrorCode, ServerEventEnvelope, ClientEvent } from '../shared/types.js'
import { ALLOWED_CLIENT_EVENT_TYPES } from '../shared/types.js'
import { AI_OPENING_MESSAGE } from '../shared/constants.js'

// 调试日志字段（design.md 第 11 节）
interface DebugLog {
  call_id: string
  provider: string
  model: string
  region: string
  connect_start_at: number
  app_ws_connected_at: number
  provider_ws_connected_at: number
  mic_permission_result: string
  first_user_audio_at: number
  first_transcript_at: number
  first_ai_text_at: number
  first_ai_audio_at: number
  call_duration_seconds: number
  disconnect_reason: string
  provider_error_code: string
  client_error_code: string
  audio_chunks_sent: number
  ai_audio_chunks_received: number
}

export class RealtimeSession {
  private callId: string
  private provider: QwenProviderClient | null = null
  private ready = false
  private ended = false
  private timeoutTimer: NodeJS.Timeout | null = null
  private connectStartAt = Date.now()
  private appWsConnectedAt = Date.now()
  private providerWsConnectedAt = 0
  private firstUserAudioAt = 0
  private firstTranscriptAt = 0
  private firstAiTextAt = 0
  private firstAiAudioAt = 0
  private audioChunksSent = 0
  private aiAudioChunksReceived = 0
  private lastEvent = ''
  private lastError = ''
  private providerErrorCode = ''
  private clientErrorCode = ''
  private disconnectReason = ''

  constructor(
    private config: RealtimeConfig,
    private ws: WebSocket,
  ) {
    this.callId = generateCallId()
    this.appWsConnectedAt = Date.now()
  }

  // 启动会话：校验配置 -> 连接供应商 -> 通知浏览器
  async start(): Promise<void> {
    // 1. 校验供应商配置
    const missing = missingProviderVars(this.config)
    if (missing.length > 0) {
      this.sendError('provider_config_missing', `Missing env: ${missing.join(', ')}`, true)
      return
    }

    // 2. 发送 session.created
    this.sendEvent('session.created', { provider: 'qwen', model: this.config.modelName })
    this.recordEvent('session.created')

    // 3. 连接供应商
    this.connectStartAt = Date.now()
    this.provider = new QwenProviderClient(this.config, this.callId, {
      onReady: () => this.onProviderReady(),
      onUserTranscriptDelta: (text) => {
        if (!this.firstTranscriptAt) this.firstTranscriptAt = Date.now()
        this.sendEvent('server.user_transcript_delta', { text, is_final: false })
        this.recordEvent('server.user_transcript_delta')
      },
      onUserTranscriptFinal: (text) => {
        if (!this.firstTranscriptAt) this.firstTranscriptAt = Date.now()
        this.sendEvent('server.user_transcript_final', { text, is_final: true })
        this.recordEvent('server.user_transcript_final')
      },
      onAiTextDelta: (text) => {
        if (!this.firstAiTextAt) this.firstAiTextAt = Date.now()
        this.sendEvent('server.ai_text_delta', { text })
        this.recordEvent('server.ai_text_delta')
      },
      onAiTextDone: (messageId) => {
        this.sendEvent('server.ai_text_done', { message_id: messageId })
        this.recordEvent('server.ai_text_done')
      },
      onAiAudioDelta: (audioBase64, format, sampleRate) => {
        if (!this.firstAiAudioAt) this.firstAiAudioAt = Date.now()
        this.aiAudioChunksReceived++
        this.sendEvent('server.ai_audio_delta', {
          audio_base64: audioBase64,
          format,
          sample_rate: sampleRate,
        })
        this.recordEvent('server.ai_audio_delta')
      },
      onAiAudioDone: (messageId) => {
        this.sendEvent('server.ai_audio_done', { message_id: messageId })
        this.recordEvent('server.ai_audio_done')
      },
      onUserSpeechStarted: () => {
        this.sendDebug('user_speech_started')
        this.recordEvent('speech_started')
      },
      onUserSpeechStopped: () => {
        this.sendDebug('user_speech_stopped')
        this.recordEvent('speech_stopped')
      },
      onResponseStarted: (responseId) => {
        this.sendDebug('ai_response_started', { response_id: responseId })
        this.recordEvent('response.created')
      },
      onResponseDone: (_responseId) => {
        this.sendDebug('ai_response_done')
        this.recordEvent('response.done')
      },
      onError: (code, message) => {
        this.providerErrorCode = code
        this.lastError = code
        this.sendError('provider_session_error', message, true)
      },
      onClose: (_code, _reason) => {
        this.handleProviderClosed()
      },
      onDebug: (event, data) => {
        this.sendDebug(event, data)
      },
    })

    try {
      await this.provider.connect()
      this.providerWsConnectedAt = Date.now()
      this.sendDebug('provider_ws_connected', {
        latency_ms: this.providerWsConnectedAt - this.connectStartAt,
      })
    } catch (e) {
      if (e instanceof ProviderAuthError) {
        this.sendError('provider_auth_failed', this.safeMsg(e), true)
      } else if (e instanceof ProviderConnectError) {
        this.sendError('provider_ws_connect_failed', this.safeMsg(e), true)
      } else {
        this.sendError('provider_ws_connect_failed', this.safeMsg(e), true)
      }
    }
  }

  // 供应商就绪：发送 session.ready，启动超时计时，发送 AI 开场白
  private onProviderReady(): void {
    if (this.ended) return
    this.ready = true
    this.sendEvent('session.ready', { state: 'connected' })
    this.recordEvent('session.ready')

    // 启动最大通话时长计时
    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout()
    }, this.config.maxCallSeconds * 1000)

    // AI 开场：作为第一条 AI 文本与音频提示
    // 注：供应商在 session.update 后会自动触发首轮响应；此处补发开场文本确保 UI 可见
    this.sendEvent('server.ai_text_delta', { text: AI_OPENING_MESSAGE })
    this.sendEvent('server.ai_text_done', { message_id: 'opening' })
    if (!this.firstAiTextAt) this.firstAiTextAt = Date.now()
  }

  // 处理浏览器消息
  handleClientMessage(raw: string): void {
    let evt: ClientEvent
    try {
      evt = JSON.parse(raw)
    } catch {
      this.sendDebug('client_message_parse_failed')
      return
    }

    // 浏览器只允许发送白名单内事件
    if (!ALLOWED_CLIENT_EVENT_TYPES.includes(evt.type as any)) {
      this.sendDebug('client_event_rejected', { type: evt.type })
      return
    }

    switch (evt.type) {
      case 'client.start':
        // client.start 已在连接后处理，重复发送忽略
        this.sendDebug('client_start_ignored')
        break

      case 'client.audio':
        if (!this.ready) {
          this.sendDebug('client_audio_before_ready_ignored')
          return
        }
        if (this.ended) return
        if (!this.firstUserAudioAt) this.firstUserAudioAt = Date.now()
        this.audioChunksSent++
        this.provider?.sendAudioChunk(evt.payload.audio_base64)
        break

      case 'client.stop':
        this.endCall('client_stopped')
        break

      case 'client.ping':
        this.sendDebug('client_ping', { client_time_ms: evt.payload.client_time_ms })
        break
    }
  }

  // 结束通话：关闭供应商连接、发送 session.closed、清理
  endCall(reason: 'client_stopped' | 'call_timeout' | 'provider_closed'): void {
    if (this.ended) return
    this.ended = true
    this.disconnectReason = reason
    if (reason === 'call_timeout') {
      this.sendError('call_timeout', 'Max call seconds reached', true)
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
    this.provider?.close()
    this.sendEvent('session.closed', { reason })
    this.recordEvent('session.closed')
    this.logDebugSummary()
    // 关闭浏览器连接
    try {
      this.ws.close()
    } catch {
      /* ignore */
    }
  }

  // 供应商主动关闭
  private handleProviderClosed(): void {
    if (this.ended) return
    this.endCall('provider_closed')
  }

  // 通话超时
  private handleTimeout(): void {
    this.endCall('call_timeout')
  }

  // 浏览器连接断开
  onClientClose(): void {
    if (this.ended) return
    this.endCall('client_stopped')
  }

  // ===== 事件发送 =====

  private sendEvent(type: string, payload: Record<string, unknown>): void {
    if (this.ws.readyState !== this.ws.OPEN) return
    const envelope: ServerEventEnvelope = {
      type,
      call_id: this.callId,
      ts: Date.now(),
      payload,
    }
    this.ws.send(JSON.stringify(envelope))
  }

  private sendError(
    code: RealtimeErrorCode,
    debugMessage: string,
    fatal: boolean,
  ): void {
    this.clientErrorCode = code
    this.lastError = code
    this.sendEvent('server.error', {
      code,
      user_message: ERROR_USER_MESSAGES[code],
      debug_message: debugMessage,
      fatal,
    })
    this.recordEvent('server.error')
  }

  // 调试事件：不包含完整音频 Base64 或用户录音
  private sendDebug(event: string, data?: Record<string, unknown>): void {
    if (!this.config.debugLog) return
    this.sendEvent('server.debug', { event, ...(data || {}) })
  }

  private recordEvent(event: string): void {
    this.lastEvent = event
  }

  // 输出调试汇总到后端控制台（不包含完整音频 Base64 / API Key）
  private logDebugSummary(): void {
    const summary: DebugLog = {
      call_id: this.callId,
      provider: this.config.provider,
      model: this.config.modelName,
      region: this.config.dashscopeRegion,
      connect_start_at: this.connectStartAt,
      app_ws_connected_at: this.appWsConnectedAt,
      provider_ws_connected_at: this.providerWsConnectedAt,
      mic_permission_result: 'granted',
      first_user_audio_at: this.firstUserAudioAt,
      first_transcript_at: this.firstTranscriptAt,
      first_ai_text_at: this.firstAiTextAt,
      first_ai_audio_at: this.firstAiAudioAt,
      call_duration_seconds: Math.round((Date.now() - this.connectStartAt) / 1000),
      disconnect_reason: this.disconnectReason,
      provider_error_code: this.providerErrorCode,
      client_error_code: this.clientErrorCode,
      audio_chunks_sent: this.audioChunksSent,
      ai_audio_chunks_received: this.aiAudioChunksReceived,
    }
    // 仅打印结构化字段，不打印音频内容
    console.log('[realtime-debug]', JSON.stringify(summary))
    // 同时通过调试事件把首包延迟推送给浏览器
    this.sendDebug('call_summary', {
      first_transcript_latency_ms: this.firstTranscriptAt
        ? this.firstTranscriptAt - this.firstUserAudioAt
        : 0,
      first_ai_audio_latency_ms: this.firstAiAudioAt
        ? this.firstAiAudioAt - this.firstUserAudioAt
        : 0,
      last_event: this.lastEvent,
      last_error: this.lastError,
    })
  }

  private safeMsg(e: unknown): string {
    return String(e instanceof Error ? e.message : e).slice(0, 300)
  }

  getCallId(): string {
    return this.callId
  }
}
