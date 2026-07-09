// AI 音频播放队列：接收 PCM 24kHz Base64 块，按顺序排队播放。
// design.md 第 8.2 节：按收到顺序播放；收到 ai_audio_done 结束当前段；用户结束时立即停止。
// 本期不实现用户语音打断。
export class AudioPlayer {
  private audioContext: AudioContext | null = null
  private queue: AudioBuffer[] = []
  private currentSource: AudioBufferSourceNode | null = null
  private nextStartTime = 0
  private playing = false
  private sampleRate = 24000

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioContext = new AudioCtx()
    }
    return this.audioContext
  }

  // 入队一个 PCM 块并尝试播放
  enqueue(pcmBase64: string): void {
    const ctx = this.ensureContext()
    const pcm16 = base64ToPcm16(pcmBase64)
    const float32 = pcm16ToFloat32(pcm16)
    const buffer = ctx.createBuffer(1, float32.length, this.sampleRate)
    // 显式构造 ArrayBuffer 以满足 copyToChannel 的类型约束
    const copyable = new Float32Array(float32.length)
    copyable.set(float32)
    buffer.copyToChannel(copyable, 0)
    this.queue.push(buffer)
    this.scheduleNext()
  }

  private scheduleNext(): void {
    if (this.playing) return
    const buffer = this.queue.shift()
    if (!buffer) return
    const ctx = this.ensureContext()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    this.currentSource = source
    this.playing = true

    const now = ctx.currentTime
    const startAt = Math.max(now, this.nextStartTime)
    source.start(startAt)
    this.nextStartTime = startAt + buffer.duration

    source.onended = () => {
      this.playing = false
      this.currentSource = null
      this.scheduleNext()
    }
  }

  // 结束当前 AI 播放段（收到 ai_audio_done）
  finishSegment(): void {
    // 让当前队列播完即停，不主动中断（保持自然）
    // 真正的立即停止由 stopAll 处理
  }

  // 立即停止所有播放（用户结束通话 / 致命错误）
  stopAll(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        /* ignore */
      }
      this.currentSource = null
    }
    this.queue = []
    this.playing = false
    this.nextStartTime = 0
  }

  async resume(): Promise<void> {
    const ctx = this.ensureContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
  }

  close(): void {
    this.stopAll()
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
  }
}

function base64ToPcm16(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Int16Array(bytes.buffer)
}

function pcm16ToFloat32(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    out[i] = pcm[i] / 0x8000
  }
  return out
}
