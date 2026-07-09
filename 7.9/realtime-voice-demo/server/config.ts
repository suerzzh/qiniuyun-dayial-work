// 后端环境变量读取与校验。
// design.md 第 3 节：缺少 DASHSCOPE_API_KEY/DASHSCOPE_WORKSPACE_ID/REALTIME_MODEL_NAME 时必须失败。
import 'dotenv/config'

export interface RealtimeConfig {
  provider: 'qwen'
  dashscopeApiKey: string
  dashscopeWorkspaceId: string
  dashscopeRegion: string
  modelName: string
  voice: string
  inputAudioFormat: string
  inputSampleRate: number
  outputAudioFormat: string
  outputSampleRate: number
  maxCallSeconds: number
  maxReconnectAttempts: number
  debugLog: boolean
  port: number
}

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.startsWith('replace_with_')) {
    throw new ConfigError(name)
  }
  return v
}

export class ConfigError extends Error {
  constructor(public readonly missingVar: string) {
    super(`Missing required env var: ${missingVar}`)
    this.name = 'ConfigError'
  }
}

// 启动期校验：仅校验非敏感必填项是否存在，不阻止服务启动（以便 /api/health 可用）。
// 会话创建期校验：校验供应商必填项，缺失时返回 provider_config_missing。
export function loadConfig(): RealtimeConfig {
  const provider = (process.env.REALTIME_PROVIDER || 'qwen') as 'qwen'
  if (provider !== 'qwen') {
    throw new Error(`REALTIME_PROVIDER must be 'qwen' in this phase, got: ${provider}`)
  }
  return {
    provider,
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY || '',
    dashscopeWorkspaceId: process.env.DASHSCOPE_WORKSPACE_ID || '',
    dashscopeRegion: process.env.DASHSCOPE_REGION || 'cn-beijing',
    modelName: process.env.REALTIME_MODEL_NAME || '',
    voice: process.env.REALTIME_VOICE || 'Ethan',
    inputAudioFormat: process.env.REALTIME_INPUT_AUDIO_FORMAT || 'pcm',
    inputSampleRate: Number(process.env.REALTIME_INPUT_SAMPLE_RATE || 16000),
    outputAudioFormat: process.env.REALTIME_OUTPUT_AUDIO_FORMAT || 'pcm',
    outputSampleRate: Number(process.env.REALTIME_OUTPUT_SAMPLE_RATE || 24000),
    maxCallSeconds: Number(process.env.MAX_CALL_SECONDS || 600),
    // 本期必须为 0，不做自动重连
    maxReconnectAttempts: 0,
    debugLog: (process.env.DEBUG_REALTIME_LOG || 'true') === 'true',
    port: Number(process.env.PORT || 8787),
  }
}

// 校验供应商必填项是否就绪。返回缺失变量名数组（空表示就绪）。
export function missingProviderVars(config: RealtimeConfig): string[] {
  const missing: string[] = []
  if (!config.dashscopeApiKey || config.dashscopeApiKey.startsWith('replace_with_')) {
    missing.push('DASHSCOPE_API_KEY')
  }
  if (!config.dashscopeWorkspaceId || config.dashscopeWorkspaceId.startsWith('replace_with_')) {
    missing.push('DASHSCOPE_WORKSPACE_ID')
  }
  if (!config.modelName) {
    missing.push('REALTIME_MODEL_NAME')
  }
  return missing
}

// 拼接 Qwen-Omni-Realtime WebSocket 地址。
// 来源：阿里云百炼 Qwen-Omni-Realtime 文档。若供应商文档更新，另起 OpenSpec change 修改。
export function buildProviderWsUrl(config: RealtimeConfig): string {
  return `wss://${config.dashscopeWorkspaceId}.${config.dashscopeRegion}.maas.aliyuncs.com/api-ws/v1/realtime?model=${config.modelName}`
}
