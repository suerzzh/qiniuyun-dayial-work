# Design: Realtime Voice Demo Chain

## 1. Implementation Lock

本规约用于直接指导开发。本期实现者不得重新选择供应商、协议或功能范围。

必须实现：

```text
Browser WebSocket
  <-> Demo Backend WebSocket
  <-> Qwen-Omni-Realtime WebSocket
```

不得实现：

- WebRTC。
- 豆包适配。
- 其他供应商适配。
- ASR + LLM + TTS 串联架构。
- 登录、会员、学习报告、评分、纠错。

## 2. Runtime Shape

本期必须创建一个前后端同仓的最小 Node.js Web Demo，不复用其他目录中的静态原型作为运行入口。

固定技术栈：

- Runtime：Node.js 20+。
- Package manager：npm。
- Frontend：Vite + React + TypeScript。
- Backend：Express + `ws` + TypeScript。
- Development command：`npm run dev`。
- Frontend dev URL：`http://localhost:5173`。
- Backend dev URL：`http://localhost:8787`。
- Browser-to-backend WebSocket：`ws://localhost:8787/api/realtime/client`。

后续实现者不得改用 Next.js、Vue、纯 HTML、Python、FastAPI、Socket.IO 或其他技术栈，除非另起 OpenSpec change。

强制运行边界：

- 浏览器页面负责麦克风授权、音频采集、消息展示、AI 音频播放、通话状态。
- Demo 后端负责供应商鉴权、供应商 WebSocket 连接、事件归一化、调试日志、连接清理。
- 浏览器不得直接连接 Qwen-Omni-Realtime。
- 浏览器不得接触 `DASHSCOPE_API_KEY`。

## 3. Environment Variables

后端必须读取以下环境变量：

```bash
REALTIME_PROVIDER=qwen
DASHSCOPE_API_KEY=replace_with_dashscope_api_key
DASHSCOPE_WORKSPACE_ID=replace_with_workspace_id
DASHSCOPE_REGION=cn-beijing
REALTIME_MODEL_NAME=qwen3.5-omni-plus-realtime
REALTIME_VOICE=Ethan
REALTIME_INPUT_AUDIO_FORMAT=pcm
REALTIME_INPUT_SAMPLE_RATE=16000
REALTIME_OUTPUT_AUDIO_FORMAT=pcm
REALTIME_OUTPUT_SAMPLE_RATE=24000
MAX_CALL_SECONDS=600
MAX_RECONNECT_ATTEMPTS=0
DEBUG_REALTIME_LOG=true
```

强制规则：

- `REALTIME_PROVIDER` 必须等于 `qwen`。
- `MAX_RECONNECT_ATTEMPTS` 本期必须为 `0`，不做自动重连。
- 缺少 `DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID`、`REALTIME_MODEL_NAME` 时，后端启动或创建会话必须失败，并返回可读错误。
- `.env.example` 可以包含变量名和占位值，不得包含真实 Key。

## 4. Provider Endpoint

后端必须使用以下 Qwen WebSocket 地址模板：

```text
wss://{DASHSCOPE_WORKSPACE_ID}.{DASHSCOPE_REGION}.maas.aliyuncs.com/api-ws/v1/realtime?model={REALTIME_MODEL_NAME}
```

连接供应商时必须携带：

```text
Authorization: Bearer {DASHSCOPE_API_KEY}
```

实现者必须在代码注释或配置说明中写明：该地址来自上一轮开发设计文档中引用的阿里云百炼 Qwen-Omni-Realtime 文档，若供应商文档更新，另起 OpenSpec change 修改，不在本期实现中临时改协议。

## 5. Session Lifecycle

### 5.1 状态机

浏览器 UI 和后端会话必须使用同一组状态名：

```text
idle
requesting_mic
connecting_app
connecting_provider
connected
user_speaking
ai_generating
ai_speaking
ending
ended
failed
```

状态流必须如下：

```text
idle
  -> requesting_mic
  -> connecting_app
  -> connecting_provider
  -> connected
  -> user_speaking
  -> ai_generating
  -> ai_speaking
  -> connected
  -> ending
  -> ended
```

错误可从任意非终态进入：

```text
failed
```

`ended` 和 `failed` 是终态。进入终态后必须释放麦克风轨道、关闭浏览器 WebSocket、关闭供应商 WebSocket、停止 AI 音频播放。

### 5.2 Call ID

每次用户点击开始对话，后端必须生成一个 `call_id`。

`call_id` 格式：

```text
call_yyyyMMddHHmmss_random6
```

示例：

```text
call_20260709143005_a1b2c3
```

所有日志、事件和错误都必须携带同一个 `call_id`。

## 6. Browser to Backend WebSocket

浏览器必须连接：

```text
ws://localhost:8787/api/realtime/client
```

如果部署为 HTTPS，必须使用：

```text
wss://{host}/api/realtime/client
```

浏览器到后端只允许发送以下消息：

```json
{"type":"client.start","payload":{"requested_mode":"free_talk"}}
{"type":"client.audio","payload":{"audio_base64":"...","format":"pcm","sample_rate":16000}}
{"type":"client.stop","payload":{"reason":"user_clicked_end"}}
{"type":"client.ping","payload":{"client_time_ms":0}}
```

强制规则：

- `client.start` 必须是每次连接后的第一条业务消息。
- `client.audio` 只能在后端返回 `session.ready` 之后发送。
- `client.stop` 发送后，浏览器不得再发送 `client.audio`。
- `audio_base64` 不得写入磁盘。
- 浏览器可以在内存中短暂持有音频块用于发送，发送完成后不得建立可回放缓存。

## 7. Backend to Browser Events

后端向浏览器只允许发送 `realtime-event-contract` 规约中定义的事件。所有事件必须符合统一结构：

```json
{
  "type": "event.name",
  "call_id": "call_20260709143005_a1b2c3",
  "ts": 1783593005000,
  "payload": {}
}
```

## 8. Audio Handling

### 8.1 Input

浏览器必须采集麦克风音频，并转换为：

```text
PCM, 16 kHz, mono
```

音频发送分片：

- 每片目标时长：100 ms。
- 单片允许范围：80 ms 到 200 ms。
- 单片超过 200 ms 时必须记录 `audio_chunk_too_large` 调试事件。

### 8.2 Output

供应商返回 AI 音频后，后端必须转成 `server.ai_audio_delta` 事件转发给浏览器。

浏览器必须：

- 按收到顺序播放音频块。
- 在收到 `server.ai_audio_done` 后结束当前 AI 语音段。
- 在用户点击结束时立即停止播放队列。
- 本期不要求实现用户语音打断 AI 播放；如果用户在 AI 播放中开口，前端可以忽略该音频输入并显示“AI 正在说话”状态。

## 9. Prompt

供应商会话初始化时必须使用以下系统提示词，不得在实现阶段改写为教学、评分或纠错模式：

```text
You are an AI English speaking partner for adult learners.

Your goal is to help the user speak more English in a low-pressure, natural conversation.

Rules:
- Speak mostly in simple, natural English.
- Keep each reply short: 1 to 3 sentences.
- Ask more follow-up questions, and avoid long explanations.
- Do not score the user.
- Do not correct every mistake.
- Do not mention CEFR levels.
- Do not evaluate pronunciation.
- Do not create a study report.
- If the user gets stuck, give a light hint, a keyword, or a simple sentence starter.
- If the user uses Chinese, gently help them continue in English.
- Use friendly, calm, encouraging language.
- Let the user talk more than you.

Conversation style:
- Start with an easy daily topic.
- Prefer questions about the user's life, interests, plans, food, movies, travel, work, or study.
- If the user's answer is short, ask a simple follow-up.
- If the user seems confused, simplify your English.
- Never lecture unless the user asks for an explanation.
```

AI 开场必须为：

```text
Hi! Let's have a simple English chat. How was your day today?
```

## 10. Error Handling

错误码必须固定为：

| Code | Trigger | User message |
| --- | --- | --- |
| `mic_permission_denied` | 浏览器麦克风授权被拒绝 | 麦克风权限被拒绝，请在浏览器设置中允许麦克风。 |
| `mic_unavailable` | 浏览器无可用麦克风或采集失败 | 未检测到可用麦克风，请检查设备后重试。 |
| `app_ws_connect_failed` | 浏览器无法连接 Demo 后端 WebSocket | 无法连接本地实时语音服务，请确认服务已启动。 |
| `provider_config_missing` | 后端缺少供应商环境变量 | 实时语音服务配置缺失，请检查后端环境变量。 |
| `provider_auth_failed` | 供应商鉴权失败 | 实时语音服务鉴权失败，请检查 API Key。 |
| `provider_ws_connect_failed` | 后端无法连接供应商 WebSocket | 实时语音服务连接失败，请稍后重试。 |
| `provider_session_error` | 供应商返回会话错误 | 实时语音服务返回错误，请查看调试日志。 |
| `audio_encode_failed` | 前端音频编码失败 | 麦克风音频处理失败，请刷新页面重试。 |
| `audio_playback_failed` | AI 音频播放失败 | AI 语音播放失败，但你仍可查看文本回复。 |
| `call_timeout` | 通话超过 `MAX_CALL_SECONDS` | 本次 Demo 通话已到达时间上限。 |
| `client_stopped` | 用户主动结束 | 通话已结束。 |

UI 必须展示 `User message`，调试面板必须展示 `Code`。

## 11. Debug Logging

必须记录以下调试字段：

```json
{
  "call_id": "call_20260709143005_a1b2c3",
  "provider": "qwen",
  "model": "qwen3.5-omni-plus-realtime",
  "region": "cn-beijing",
  "connect_start_at": 1783593005000,
  "app_ws_connected_at": 1783593005100,
  "provider_ws_connected_at": 1783593005800,
  "mic_permission_result": "granted",
  "first_user_audio_at": 1783593010000,
  "first_transcript_at": 1783593010800,
  "first_ai_text_at": 1783593012100,
  "first_ai_audio_at": 1783593012600,
  "call_duration_seconds": 180,
  "disconnect_reason": "client_stopped",
  "provider_error_code": "",
  "client_error_code": "",
  "audio_chunks_sent": 0,
  "ai_audio_chunks_received": 0
}
```

日志允许输出到：

- 后端控制台。
- 浏览器调试面板。

日志不得写入用户录音、完整音频 Base64 或长期可回放音频。

## 12. UI Requirements

页面只允许包含以下区域：

1. 顶部状态栏：标题、连接状态、通话计时。
2. 消息列表：用户消息、AI 消息、临时转写。
3. 底部控制区：开始按钮、结束按钮、麦克风状态。
4. 错误提示区：显示最近一个用户可读错误。
5. 调试面板：默认展开，Demo 验收时可直接看到关键事件。

UI 文案固定：

| State | Status text |
| --- | --- |
| `idle` | 准备开始自由对话 |
| `requesting_mic` | 正在请求麦克风权限 |
| `connecting_app` | 正在连接本地实时语音服务 |
| `connecting_provider` | 正在连接实时语音模型 |
| `connected` | AI 正在听 |
| `user_speaking` | 正在识别你的语音 |
| `ai_generating` | AI 正在回复 |
| `ai_speaking` | AI 正在说话 |
| `ending` | 正在结束通话 |
| `ended` | 通话已结束 |
| `failed` | 通话连接失败 |

## 13. Completion Definition

本期实现完成的定义：

- 可以本地启动 Demo。
- 用户可以点击开始。
- 用户可以授权麦克风。
- 后端可以连接 Qwen-Omni-Realtime WebSocket。
- 用户说话后，页面可以出现用户文本。
- AI 可以出现文本回复。
- AI 可以播放语音回复。
- 用户可以点击结束，所有连接关闭。
- 调试面板可以看到首包延迟和断连原因。
- 未保存用户录音。
