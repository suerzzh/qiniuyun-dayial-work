// Demo 后端入口：Express + ws。
// 浏览器 WebSocket 入口：ws://localhost:8787/api/realtime/client
// 本期不实现 WebRTC、豆包、ASR+LLM+TTS 串联。
import express from 'express'
import http from 'node:http'
import { WebSocketServer } from 'ws'
import { loadConfig, missingProviderVars } from './config.js'
import { RealtimeSession } from './realtimeSession.js'

const config = loadConfig()
const app = express()
const server = http.createServer(app)

// 健康检查：返回服务状态与配置就绪情况（不返回 API Key）
app.get('/api/health', (_req, res) => {
  const missing = missingProviderVars(config)
  res.json({
    status: 'ok',
    provider: config.provider,
    model: config.modelName,
    region: config.dashscopeRegion,
    config_ready: missing.length === 0,
    missing_vars: missing,
  })
})

// WebSocket 服务器：浏览器连接 /api/realtime/client
const wss = new WebSocketServer({ server, path: '/api/realtime/client' })

wss.on('connection', (ws) => {
  const session = new RealtimeSession(config, ws)
  console.log(`[realtime] new connection call_id=${session.getCallId()}`)

  let started = false

  ws.on('message', (raw) => {
    let evt: { type?: string }
    try {
      evt = JSON.parse(raw.toString())
    } catch {
      return
    }

    // client.start 触发会话启动
    if (evt.type === 'client.start' && !started) {
      started = true
      session.start().catch((e) => {
        console.error(`[realtime] session start failed call_id=${session.getCallId()}`, e)
      })
      return
    }

    // 其他消息交给会话处理
    session.handleClientMessage(raw.toString())
  })

  ws.on('close', () => {
    session.onClientClose()
    console.log(`[realtime] connection closed call_id=${session.getCallId()}`)
  })

  ws.on('error', (err) => {
    console.error(`[realtime] ws error call_id=${session.getCallId()}`, err.message)
  })
})

server.listen(config.port, () => {
  const missing = missingProviderVars(config)
  console.log(`[realtime] backend listening on http://localhost:${config.port}`)
  console.log(`[realtime] ws endpoint: ws://localhost:${config.port}/api/realtime/client`)
  console.log(`[realtime] provider: ${config.provider} | model: ${config.modelName} | region: ${config.dashscopeRegion}`)
  if (missing.length > 0) {
    console.warn(`[realtime] WARNING provider config missing: ${missing.join(', ')}`)
    console.warn('[realtime] calls will fail with provider_config_missing until .env is configured.')
  } else {
    console.log('[realtime] provider config ready.')
  }
})
