// 浏览器到 Demo 后端的 WebSocket 客户端。
// design.md 第 6 节：连接 ws://localhost:8787/api/realtime/client
// 浏览器只发送 client.start / client.audio / client.stop / client.ping。
import type { ClientEvent, ServerEventEnvelope } from '../shared/types'

export interface RealtimeClientCallbacks {
  onOpen: () => void
  onClose: (code: number, reason: string) => void
  onError: (e: Event) => void
  onEvent: (evt: ServerEventEnvelope) => void
}

export class RealtimeClient {
  private ws: WebSocket | null = null

  constructor(private url: string, private cb: RealtimeClientCallbacks) {}

  connect(): void {
    this.ws = new WebSocket(this.url)
    this.ws.onopen = () => this.cb.onOpen()
    this.ws.onclose = (e) => this.cb.onClose(e.code, e.reason)
    this.ws.onerror = (e) => this.cb.onError(e)
    this.ws.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as ServerEventEnvelope
        this.cb.onEvent(evt)
      } catch {
        /* ignore malformed */
      }
    }
  }

  send(evt: ClientEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(evt))
    }
  }

  close(): void {
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// 构造后端 WebSocket 地址：开发态直连 8787，生产态跟随页面协议
export function buildBackendWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  // 开发环境固定直连后端 8787；Vite 代理不代理 ws 根路径，这里直连
  if (window.location.hostname === 'localhost' && window.location.port === '5173') {
    return 'ws://localhost:8787/api/realtime/client'
  }
  return `${proto}://${window.location.host}/api/realtime/client`
}
