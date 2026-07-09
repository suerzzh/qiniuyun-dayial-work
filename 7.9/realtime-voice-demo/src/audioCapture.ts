// 麦克风音频采集：getUserMedia -> AudioContext -> 重采样为 PCM 16kHz mono -> 100ms 分片。
// design.md 第 8.1 节：单片目标 100ms，允许 80-200ms，超过 200ms 记录 audio_chunk_too_large。
// 隐私：音频块只在内存中短暂持有用于发送，不写入磁盘，不建立可回放缓存。
export interface AudioCaptureHandle {
  stop: () => void
}

export interface AudioCaptureCallbacks {
  onChunk: (pcmBase64: string, format: 'pcm', sampleRate: 16000) => void
  onChunkTooLarge: (durationMs: number) => void
  onError: (code: 'mic_unavailable') => void
}

// 采集目标参数
const TARGET_SAMPLE_RATE = 16000
const TARGET_CHANNEL_COUNT = 1
// 每片目标时长 100ms（在 16kHz 下约 1600 采样）
const CHUNK_DURATION_MS = 100

export async function startAudioCapture(
  callbacks: AudioCaptureCallbacks,
): Promise<AudioCaptureHandle> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: TARGET_CHANNEL_COUNT,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch (e) {
    callbacks.onError('mic_unavailable')
    throw e
  }

  // AudioContext：浏览器默认采样率（通常 44100/48000），需重采样到 16kHz
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioContext = new AudioCtx()
  const source = audioContext.createMediaStreamSource(stream)

  // 缓冲区大小：4096 采样（在 48kHz 下约 85ms，接近 100ms 目标）
  const bufferSize = 4096
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)

  const inputSampleRate = audioContext.sampleRate
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE

  // 累积重采样后的采样点，达到约 100ms 即分片发送
  let pendingSamples: Float32Array[] = []
  let pendingLength = 0
  const samplesPerChunk = Math.floor((TARGET_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000)

  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    const input = event.inputBuffer.getChannelData(0)
    // 降采样：按比例抽取采样点
    const downsampled = downsample(input, ratio)
    pendingSamples.push(downsampled)
    pendingLength += downsampled.length

    if (pendingLength >= samplesPerChunk) {
      // 合并并切片
      const merged = concatFloat32(pendingSamples)
      const chunk = merged.subarray(0, samplesPerChunk)
      const remainder = merged.subarray(samplesPerChunk)
      pendingSamples = remainder.length > 0 ? [remainder] : []
      pendingLength = remainder.length

      const durationMs = Math.round((chunk.length / TARGET_SAMPLE_RATE) * 1000)
      if (durationMs > 200) {
        callbacks.onChunkTooLarge(durationMs)
      }

      const pcm16 = float32ToPcm16(chunk)
      const base64 = pcm16ToBase64(pcm16)
      callbacks.onChunk(base64, 'pcm', TARGET_SAMPLE_RATE)
    }
  }

  source.connect(processor)
  processor.connect(audioContext.destination)

  return {
    stop: () => {
      try {
        processor.disconnect()
        source.disconnect()
      } catch {
        /* ignore */
      }
      stream.getTracks().forEach((t) => t.stop())
      audioContext.close().catch(() => {})
      // 清空内存中的采样缓存，确保无可回放音频
      pendingSamples = []
      pendingLength = 0
    },
  }
}

// 降采样：线性抽取
function downsample(input: Float32Array, ratio: number): Float32Array {
  if (ratio === 1) return new Float32Array(input)
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    out[i] = input[Math.floor(i * ratio)]
  }
  return out
}

function concatFloat32(arrays: Float32Array[]): Float32Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Float32Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

// Float32 [-1,1] 转 PCM 16-bit
function float32ToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

// Int16Array 转 Base64（小端序）
function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
