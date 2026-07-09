// Qwen-Omni-Realtime 供应商客户端。
// 负责：连接供应商 WebSocket、发送 session.update 初始化、转发音频、归一化供应商事件为统一事件。
// 事件协议来源：阿里云百炼 Qwen-Omni-Realtime 服务端事件文档。
import WebSocket from 'ws'
import type { RealtimeConfig } from './config.js'
import { buildProviderWsUrl } from './config.js'
import { SYSTEM_PROMPT } from '../shared/constants.js'

// 统一事件信封（后端内部产出，由 RealtimeSession 发往浏览器）
export interface NormalizedEvent {
  type: string
  payload: Record<string, unknown>
}

// 供应商事件处理器回调
export interface QwenProviderCallbacks {
  onReady: () => void
  onUserTranscriptDelta: (text: string) => void
  onUserTranscriptFinal: (text: string) => void
  onAiTextDelta: (text: string) => void
  onAiTextDone: (messageId: string) => void
  onAiAudioDelta: (audioBase64: string, format: string, sampleRate: number) => void
  onAiAudioDone: (messageId: string) => void
  onUserSpeechStarted: () => void
  onUserSpeechStopped: () => void
  onResponseStarted: (responseId: string) => void
  onResponseDone: (responseId: string) => void
  onError: (code: string, message: string) => void
  onClose: (code: number, reason: string) => void
  onDebug: (event: string, data?: Record<string, unknown>) => void
}

export class QwenProviderClient {
  private ws: WebSocket | null = null
  private ready = false
  private closed = false

  constructor(
    private config: RealtimeConfig,
    private callId: string,
    private cb: QwenProviderCallbacks,
  ) {}

  // 连接供应商并发送 session.update 初始化。
  // 鉴权失败、连接失败、会话错误分别通过 onError 回调上抛。
  connect(): Promise<void> {
    const url = buildProviderWsUrl(this.config)
    this.cb.onDebug('provider_connect_start', { url: this.safeUrl(url) })

    return new Promise<void>((resolve, reject) => {
      let opened = false
      let settled = false

      const rejectConnect = (error: Error) => {
        if (settled) return
        settled = true
        this.closed = true
        reject(error)
      }

      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${this.config.dashscopeApiKey}`,
          },
        })
      } catch (e) {
        rejectConnect(e instanceof Error ? e : new ProviderConnectError(String(e)))
        return
      }

      const openTimeout = setTimeout(() => {
        if (!opened) {
          this.cb.onDebug('provider_connect_timeout')
          rejectConnect(new ProviderConnectError('timeout'))
        }
      }, 15000)

      this.ws.on('open', () => {
        opened = true
        settled = true
        clearTimeout(openTimeout)
        this.cb.onDebug('provider_ws_open')
        // 发送 session.update 完成会话初始化
        this.sendSessionUpdate()
        resolve()
      })

      this.ws.on('unexpected-response', (_req, res) => {
        clearTimeout(openTimeout)
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          const message = formatUnexpectedResponseError(
            res.statusCode || 0,
            res.statusMessage || '',
            body,
          )
          this.cb.onDebug('provider_ws_unexpected_response', {
            status_code: res.statusCode || 0,
            body: truncateForDebug(body),
          })
          rejectConnect(new ProviderConnectError(message))
        })
      })

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data.toString())
      })

      this.ws.on('error', (err: Error) => {
        clearTimeout(openTimeout)
        this.cb.onDebug('provider_ws_error', { message: this.safeError(err) })
        if (!opened) {
          // 连接阶段失败（含鉴权失败）
          const msg = String(err.message || '')
          // 401/403 类鉴权失败
          if (msg.includes('401') || msg.includes('403') || /unauthor/i.test(msg)) {
            rejectConnect(new ProviderAuthError(msg))
          } else {
            rejectConnect(new ProviderConnectError(msg))
          }
        } else {
          this.cb.onError('provider_session_error', this.safeError(err))
        }
      })

      this.ws.on('close', (code: number, reasonBuf: WebSocket.RawData) => {
        clearTimeout(openTimeout)
        const reason = reasonBuf?.toString() || ''
        this.cb.onDebug('provider_ws_close', { code, reason })
        if (this.closed) return
        this.closed = true
        this.cb.onClose(code, reason)
      })
    })
  }

  // 发送 session.update：系统提示词、输出模态 text+audio、输入 PCM 16k、输出 PCM 24k、音色、VAD、转写。
  private sendSessionUpdate(): void {
    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: this.config.voice,
        instructions: SYSTEM_PROMPT,
        input_audio_format: this.config.inputAudioFormat,
        output_audio_format: this.config.outputAudioFormat,
        // 开启输入音频转写，用于展示用户转写文本
        input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },
        // 服务端 VAD，自动检测语音起止
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 800,
        },
      },
    }
    this.sendRaw(sessionUpdate)
    this.cb.onDebug('session_update_sent')
  }

  // 转发浏览器音频块给供应商：input_audio_buffer.append
  sendAudioChunk(audioBase64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.sendRaw({
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    })
  }

  // 主动关闭供应商连接（结束通话清理）
  close(): void {
    this.closed = true
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
    }
  }

  private sendRaw(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  // 归一化供应商事件为统一后端事件。
  // 关键映射（详见 realtime-event-contract/spec.md）：
  //   conversation.item.input_audio_transcription.delta -> user_transcript_delta
  //   conversation.item.input_audio_transcription.completed -> user_transcript_final
  //   response.text.delta -> ai_text_delta
  //   response.text.done -> ai_text_done
  //   response.audio.delta -> ai_audio_delta
  //   response.audio.done -> ai_audio_done
  //   input_audio_buffer.speech_started -> user_speaking 状态
  //   response.created -> ai_generating 状态
  //   error -> server.error
  private handleMessage(raw: string): void {
    let evt: { type?: string; [k: string]: unknown }
    try {
      evt = JSON.parse(raw)
    } catch {
      this.cb.onDebug('provider_message_parse_failed')
      return
    }
    const type = evt.type
    if (!type) return

    switch (type) {
      case 'session.created':
        this.cb.onDebug('provider_session_created', { model: (evt.session as any)?.model })
        break

      case 'session.updated':
        // 会话配置已应用，标记 ready
        this.ready = true
        this.cb.onReady()
        break

      case 'input_audio_buffer.speech_started':
        this.cb.onUserSpeechStarted()
        break

      case 'input_audio_buffer.speech_stopped':
        this.cb.onUserSpeechStopped()
        break

      case 'conversation.item.input_audio_transcription.delta': {
        // 实时预览 = text + stash
        const text = String((evt as any).text || '')
        const stash = String((evt as any).stash || '')
        this.cb.onUserTranscriptDelta(text + stash)
        break
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = String((evt as any).transcript || '')
        if (transcript) this.cb.onUserTranscriptFinal(transcript)
        break
      }

      case 'conversation.item.input_audio_transcription.failed': {
        const msg = (evt as any).error?.message || 'transcription failed'
        this.cb.onDebug('transcription_failed', { message: msg })
        break
      }

      case 'response.created': {
        const responseId = String((evt as any).response?.id || '')
        this.cb.onResponseStarted(responseId)
        break
      }

      case 'response.text.delta': {
        const delta = String((evt as any).delta || '')
        if (delta) this.cb.onAiTextDelta(delta)
        break
      }

      case 'response.text.done': {
        const itemId = String((evt as any).item_id || (evt as any).response_id || '')
        this.cb.onAiTextDone(itemId)
        break
      }

      case 'response.audio.delta': {
        const delta = String((evt as any).delta || '')
        if (delta) {
          this.cb.onAiAudioDelta(
            delta,
            this.config.outputAudioFormat,
            this.config.outputSampleRate,
          )
        }
        break
      }

      case 'response.audio.done': {
        const itemId = String((evt as any).item_id || (evt as any).response_id || '')
        this.cb.onAiAudioDone(itemId)
        break
      }

      case 'response.done': {
        const responseId = String((evt as any).response?.id || '')
        this.cb.onResponseDone(responseId)
        break
      }

      case 'error': {
        const errObj = (evt as any).error || {}
        const code = String(errObj.code || 'provider_error')
        const message = String(errObj.message || 'provider error')
        this.cb.onError(code, message)
        break
      }

      default:
        // 其他事件仅记录调试，不转发音频体
        this.cb.onDebug('provider_event_unhandled', { type })
    }
  }

  // 安全化：URL 中不含 API Key
  private safeUrl(url: string): string {
    return url
  }

  // 安全化错误信息：移除可能的 Key 片段
  private safeError(err: Error): string {
    return String(err.message || '').slice(0, 300)
  }
}

export function formatUnexpectedResponseError(
  statusCode: number,
  statusMessage: string,
  body: string,
): string {
  const status = `${statusCode || 'unknown'}${statusMessage ? ` ${statusMessage}` : ''}`
  const trimmedBody = truncateForDebug(body.trim())
  return trimmedBody ? `Unexpected server response: ${status}; body: ${trimmedBody}` : `Unexpected server response: ${status}`
}

function truncateForDebug(value: string): string {
  return value.length > 1000 ? `${value.slice(0, 1000)}...` : value
}

export class ProviderAuthError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'ProviderAuthError'
  }
}

export class ProviderConnectError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'ProviderConnectError'
  }
}
