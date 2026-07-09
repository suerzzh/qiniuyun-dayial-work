# Realtime 语音 Demo 方案与核心流程

日期：2026-07-09  
适用范围：Web 端自由对话 Demo  
项目背景：AI 英语口语陪练产品，自由对话模块链路验证  

项目里的**调试面板**是给开发/测试用的，不是给正式用户看的。它的作用是：当通话出问题时，快速判断问题发生在哪一层：前端、麦克风、后端 WebSocket、Qwen 连接、模型事件、音频播放等。

调试面板里的字段大概是这些意思：

| 字段                            | 含义                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `call_id`                     | 当前这次通话的唯一 ID。后端日志里也会有，方便前后端对照排查。                                                                              |
| `provider`                    | 当前使用的实时语音供应商，现在是 `qwen`。                                                                                      |
| `model`                       | 当前连接的模型名，例如 `qwen3.5-omni-plus-realtime`。                                                                     |
| `state`                       | 当前通话状态，比如 `idle`、`requesting_mic`、`connected`、`user_speaking`、`ai_generating`、`ai_speaking`、`ended`、`failed`。 |
| `first_transcript_latency_ms` | 从用户开始发音到首次出现用户转写文本的延迟。用于判断语音识别是否够快。                                                                           |
| `first_ai_audio_latency_ms`   | 从用户开始说话到首次收到 AI 音频的延迟。用于判断 AI 回复是否够快。                                                                         |
| `audio_chunks_sent`           | 前端已经发送给后端/模型的音频片段数量。这个持续增长说明麦克风音频正在被采集并发送。                                                                    |
| `ai_audio_chunks_received`    | 前端收到的 AI 音频片段数量。这个增长说明 AI 已经返回语音。                                                                             |
| `last_event`                  | 最近一次收到的后端事件。用于判断链路卡在哪个阶段。                                                                                     |
| `last_error`                  | 最近一次错误码。比如后端连接失败、供应商连接失败、鉴权失败等。                                                                               |

它下面那个黑色的小区域是**调试日志区**。

里面会按时间显示一些关键事件，比如：

```
app_ws_open
session.created call_id=...
debug provider_connect_start
debug provider_ws_open
debug session_update_sent
session.ready -> connected
debug user_speech_started
debug user_speech_stopped
server.error code=...
```

这些日志主要用来判断流程有没有正常走下去：

```
app_ws_open
```

说明浏览器已经连上你的 Demo 后端。

```
provider_ws_open
```

说明后端已经连上 Qwen。

```
session.ready -> connected
```

说明模型会话已经准备好，可以开始说话。

```
user_speech_started / user_speech_stopped
```

说明模型检测到了用户开始说话和停止说话。

```
server.ai_text_delta / server.ai_audio_delta
```

如果出现，说明 AI 已经开始返回文本或语音。

```
server.error ...
```

说明链路出现错误，后面通常会带错误码和 debug 信息。

简单说：

**上面的表格是当前状态快照，下面的日志区是事件流水。**

如果以后你要判断问题，可以这样看：

- `audio_chunks_sent` 一直是 0：麦克风没采集到或没发送。
- 有用户转写但没有 AI 回复：看日志有没有 AI 相关事件。
- `ai_audio_chunks_received` 是 0：AI 没返回语音或后端没转发。
- `last_error` 有值：优先看错误码。
- 卡在 `requesting_mic`：麦克风授权问题。
- 卡在 `connecting_provider`：后端连 Qwen 有问题。
- 进入 `connected` 但无转写：音频采集或发送问题。

## 1. Demo 定位

本 Demo 是 AI 英语口语陪练产品里的“自由对话”技术验证版。

它不做完整学习系统，只验证一件事：

> 用户能不能像打电话一样，用浏览器麦克风和 AI 连续进行英语语音对话。

本期验证的是实时语音主链路：

```text
用户说话
  -> 浏览器采集麦克风
  -> 后端转发实时音频
  -> Qwen-Omni-Realtime 处理语音和对话
  -> AI 返回文本和语音
  -> 前端显示对话并播放声音
  -> 用户结束通话
```

## 2. 核心技术方案

当前 Demo 使用的技术方案如下：

```text
前端：Vite + React + TypeScript
后端：Node.js + Express + ws
实时模型：阿里云百炼 Qwen-Omni-Realtime
协议：WebSocket
```

本期选择 WebSocket，而不是 WebRTC。

原因是 WebSocket 更适合当前 Demo 快速跑通链路、调试事件、查看日志和定位问题。WebRTC 更接近真实电话体验，但接入复杂度更高，涉及 SDP、媒体轨道、DataChannel 等内容，本期暂不纳入。

整体架构：

```text
Browser
  -> Demo Backend WebSocket
  -> Qwen-Omni-Realtime WebSocket
  -> Demo Backend
  -> Browser
```

浏览器不直接连接阿里云模型。供应商 API Key 只放在后端 `.env` 中，不能暴露给前端。

## 3. 核心流程

### 3.1 开始对话

用户点击“开始对话”按钮。

前端进入通话启动流程，先请求浏览器麦克风权限。

### 3.2 麦克风采集

前端通过 `getUserMedia` 获取用户麦克风音频。

然后使用 WebAudio 将音频处理为模型需要的格式：

```text
PCM
16kHz
mono
约 100ms 一个音频片段
```

### 3.3 浏览器连接后端

前端通过 WebSocket 连接本项目后端：

```text
ws://localhost:8787/api/realtime/client
```

浏览器只向后端发送：

- `client.start`
- `client.audio`
- `client.stop`
- `client.ping`

### 3.4 后端连接 Qwen-Omni-Realtime

后端读取 `.env` 中的阿里云百炼配置：

```env
DASHSCOPE_API_KEY
DASHSCOPE_WORKSPACE_ID
DASHSCOPE_REGION
REALTIME_MODEL_NAME
REALTIME_VOICE
```

后端连接 Qwen-Omni-Realtime WebSocket：

```text
wss://{DASHSCOPE_WORKSPACE_ID}.{DASHSCOPE_REGION}.maas.aliyuncs.com/api-ws/v1/realtime?model={REALTIME_MODEL_NAME}
```

连接时携带：

```text
Authorization: Bearer {DASHSCOPE_API_KEY}
```

### 3.5 初始化模型会话

后端向 Qwen 发送 `session.update`，配置本次通话：

```text
输出模式：text + audio
输入音频：PCM 16kHz
输出音频：PCM 24kHz
音色：Ethan
系统提示词：低压力英语口语陪练
VAD：server_vad，自动判断用户说话结束
用户语音转写：开启
```

### 3.6 用户说话与实时转写

用户说话时：

```text
浏览器音频片段
  -> Demo 后端
  -> Qwen input_audio_buffer.append
```

Qwen 返回用户语音转写事件。

后端将供应商事件转换为统一事件后发给前端：

```text
server.user_transcript_delta
server.user_transcript_final
```

前端在对话框中展示用户说的话。

### 3.7 AI 回复

用户停止说话后，Qwen 通过服务端 VAD 自动触发回复。

Qwen 在 text + audio 输出模式下返回：

```text
AI 回复文本：
response.audio_transcript.delta
response.audio_transcript.done

AI 回复音频：
response.audio.delta
response.audio.done
```

后端将这些事件转换成前端统一事件：

```text
server.ai_text_delta
server.ai_text_done
server.ai_audio_delta
server.ai_audio_done
```

前端负责：

- 展示 AI 回复文本
- 播放 AI 返回的 PCM 24kHz 音频
- 更新状态为“AI 正在回复”或“AI 正在说话”

### 3.8 结束通话

用户点击“结束通话”后：

```text
前端停止麦克风采集
前端停止 AI 音频播放
前端发送 client.stop
后端关闭 Qwen WebSocket
后端关闭浏览器 WebSocket
页面进入 ended 状态
```

## 4. 当前实现的功能

本 Demo 已实现以下能力：

| 功能 | 说明 |
| --- | --- |
| 开始对话 | 用户点击按钮进入通话流程 |
| 麦克风授权 | 浏览器请求麦克风权限 |
| 实时语音输入 | 前端采集麦克风并发送音频片段 |
| 用户语音转写 | Qwen 返回用户转写，前端显示 |
| AI 文本回复 | Qwen 返回 AI 回复文本，前端显示 |
| AI 语音播放 | 前端播放 Qwen 返回的语音音频 |
| 通话计时 | 连接成功后开始计时 |
| 结束通话 | 用户可主动结束，释放麦克风和连接 |
| 连接失败提示 | 对后端连接、供应商连接、鉴权等错误给出提示 |
| 调试面板 | 显示 call_id、状态、事件、延迟、错误码等信息 |
| 后端健康检查 | 提供 `/api/health` 检查配置状态 |
| API Key 保护 | API Key 只在后端环境变量中读取 |
| 不保存录音 | 用户音频只用于实时转发，不落盘保存 |

## 5. 前端模块

前端主要负责页面交互、音频采集、状态管理和音频播放。

```text
App.tsx
  页面 UI、状态展示、按钮、消息列表、调试面板

useRealtimeCall.ts
  通话状态机，控制开始、连接、收消息、结束、错误处理

audioCapture.ts
  采集麦克风，把音频转成 PCM 16kHz

audioPlayer.ts
  播放 AI 返回的 PCM 24kHz 音频

realtimeClient.ts
  浏览器到后端的 WebSocket 客户端

messageState.ts
  消息列表更新工具，避免 React 状态更新竞态
```

## 6. 后端模块

后端主要负责供应商连接、事件代理、错误处理和调试日志。

```text
server.ts
  启动 Express 和 WebSocket 服务

config.ts
  读取和校验环境变量

realtimeSession.ts
  管理一次通话会话，连接前端和模型

qwenProvider.ts
  连接 Qwen-Omni-Realtime，处理模型事件

callId.ts
  生成通话 ID
```

## 7. 使用的模型能力

本 Demo 使用 Qwen-Omni-Realtime 的以下能力：

| 能力 | 用途 |
| --- | --- |
| 实时音频输入 | 接收用户麦克风 PCM 音频 |
| 用户语音转写 | 将用户说话转成文本并展示 |
| 端到端对话生成 | 根据用户语音内容生成 AI 回复 |
| 实时语音合成 | 返回 AI 回复音频 |
| 文本 + 音频输出 | 同时展示 AI 文本并播放语音 |
| server_vad | 自动判断用户说话开始和结束 |
| session.update | 设置音频格式、音色、Prompt 和输出模式 |

## 8. Prompt 设计

系统提示词的目标是让 AI 成为低压力英语口语陪练，而不是老师或评分器。

核心要求：

- 使用简单自然英语。
- 每次回复 1 到 3 句。
- 多追问，少讲课。
- 不评分。
- 不纠错。
- 不提 CEFR。
- 不做发音评价。
- 不生成学习报告。
- 用户卡住时给轻量提示。
- 用户使用中文时，引导其继续用英语表达。

## 9. 本期不做的内容

本 Demo 只验证实时自由对话链路，明确不做：

- WebRTC
- 豆包适配
- ASR + LLM + TTS 串联兜底
- 登录
- 会员
- 评分
- 纠错
- CEFR 等级
- 发音评测
- 错题本
- 个人主页
- 学习报告
- 用户录音保存

## 10. 当前 Demo 的价值

这个 Demo 的价值不是完整产品能力，而是验证自由对话模块的底层可行性：

1. 浏览器是否能稳定采集用户语音。
2. 国内 Realtime 语音模型是否能完成实时语音理解和回复。
3. AI 是否能像电话一样连续与用户对话。
4. 前端是否能同步展示用户文本和 AI 文本。
5. 前端是否能播放 AI 语音。
6. 通话是否能正常开始、持续和结束。
7. 失败时是否能定位到麦克风、后端、供应商或事件映射问题。

## 11. 一句话总结

这个 Demo 用 Web 端最小实现，跑通了：

```text
浏览器实时语音输入
  -> 国内端到端 Realtime 模型
  -> AI 实时文本和语音回复
```

它用于验证 AI 英语口语陪练产品中“自由对话”模块的基础通话体验是否可行。
