# UniSpeaking Free Chat Integration Design

## Goal

在 `UniSpeaking_React` 的 `#/conversation` 页面内运行 `UniSpeaking` 新版 Demo 的真实 WebRTC 自由对话链路，同时保留产品 UI、路由和响应式视觉，并保证麦克风、PeerConnection、DataChannel、远端音频和 AudioContext 都有唯一所有者和幂等清理路径。

## Chosen Architecture

采用模块化本地 Python 后端方案：React 页面只消费会话 hook；hook 持有一个 RealtimeClient；RealtimeClient 编排 API、麦克风、PeerConnection、DataChannel 与音频播放器；纯 reducer 将底层事件映射为产品状态和字幕消息。`VITE_REALTIME_API_BASE` 只保存公开后端 URL，百炼 Key 仍只由 Python 进程读取。

### Alternatives Considered

1. 直接接历史 Supabase Edge Function：部署路径存在，但功能落后于新版 Demo，而且会让本地验收依赖生产外部状态，本轮不采用。
2. 把 Python 后端改成 Vercel Function：与进程内 session、本地文件和常驻生命周期冲突，范围过大，本轮不采用。
3. iframe 或保留 Demo 独立页面：破坏统一路由和资源生命周期，明确禁止。

## Components

### `realtime-state.mjs`

纯函数状态机。状态包括 `idle`、`requesting_microphone`、`connecting`、`connected`、`user_speaking`、`ai_thinking`、`ai_speaking`、`interrupted`、`paused`、`disconnected`、`ended`、`error`。它合并用户/AI 增量字幕，支持 user item rekey，避免重复最终消息，并输出 UI 文案和可执行 action。

### `realtime-api.mjs`

封装 Python HTTP API：health、createSession、exchangeSdp、rememberEvent、bindProviderSession、updateLearnerLevel、recordQuality、closeSession。统一解析 JSON/text 错误，不包含任何 secret。

### `microphone.mjs`

唯一 `MediaStream` 所有者。负责请求权限、返回 audio tracks、静音、暂停/恢复和停止。所有方法幂等。

### `audio-playback.mjs`

唯一远端 `<audio>` 和 `AudioContext` 所有者。负责附加 remote stream、`play()`、RMS 可听状态回调、暂停/恢复、RAF/source/analyser/context 清理。

### `realtime-client.mjs`

唯一 PeerConnection/DataChannel 所有者。保留新版 Demo 的 media gate、SDP 交换、session update、AI greeting、最终事件保存、provider session 绑定、工具调用、文本发送、显式 pause/resume、网络断开清理和质量指标。`startPromise` 与幂等 teardown 阻止重复连接。

### `useRealtimeSession.js`

React 适配层。稳定创建一个 client，将事件 dispatch 到 reducer；暴露 `start`、`retry`、`togglePause`、`toggleMute`、`sendText`、`end`。组件卸载时静默 teardown，StrictMode 下不会遗留资源。

### `ConversationView.jsx`

保留当前豆包风格布局、类名、语音球、字幕区、胶囊输入器和响应式 CSS。语音球负责开始/暂停/恢复，chat 按钮只切字幕/文本模式，麦克风按钮只切静音，结束按钮只结束真实 session。错误/断线时显示重试入口。

## Data Flow

```text
User gesture
  -> useRealtimeSession.start()
  -> realtime-api.createSession()
  -> microphone.request()
  -> RTCPeerConnection + gated track + DataChannel
  -> realtime-api.exchangeSdp()
  -> session.created -> bind provider + open media gate + session.update
  -> session.updated -> response.create
  -> DataChannel events -> reducer -> React subtitles/status
  -> pc.ontrack -> audio-playback -> audible state -> reducer
```

## Error Handling

- 麦克风拒绝映射为可读权限错误，不重复弹权限。
- HTTP 错误统一保留安全服务端 message，不包含 response secret。
- DataChannel JSON 错误产生 `local.error`。
- 网络 `failed/disconnected` 触发一次 teardown 和 `disconnected` 状态；用户显式点击重试，避免无限 session 循环。
- `play()` 被自动播放策略拒绝时显示可恢复错误；用户再次点击语音球可恢复。
- `end`、异常 teardown、路由卸载都调用同一个幂等清理函数。

## Security

- 浏览器仅使用 `VITE_REALTIME_API_BASE`。
- `DASHSCOPE_API_KEY`、`BAILIAN_WORKSPACE_ID`、Supabase service role/secret 不进入 Vite 源码或构建。
- `.env.local`、`.env`、`node_modules`、`dist`、`.vite` 由主应用 `.gitignore` 忽略。
- 本轮不改 Supabase schema、migration、Edge Function 或生产环境。

## Testing

- Node 内置 test runner 覆盖 reducer、API、麦克风、音频播放器和 RealtimeClient 的 fake WebRTC 流程。
- 先运行目标测试确认因模块缺失/行为缺失而失败，再写最小实现使其通过。
- ESLint 检查 hooks、未定义变量和 React refresh 约束。
- TypeScript `checkJs` 只检查本次新增实时模块与 hook，不强制一次性迁移整个 JSX 原型。
- 运行 Vite production build，并用本地浏览器检查页面、路由、控制台、网络、麦克风与真实链路。

