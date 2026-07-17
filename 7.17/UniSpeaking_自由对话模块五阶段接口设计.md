# UniSpeaking

## 自由对话模块五阶段接口设计

**开始 · 暂停 · 恢复 · 打断 · 结束**

> **适用架构：**客户端（Web / iOS / Android）与 Qwen Realtime 建立单条 WebRTC；业务后端负责用户鉴权、额度检查、一次性 Session、SDP 代理、状态记录、用量归属与数据清理。

**文档版本：**V0.1

**文档日期：**2026-07-17

**适用范围：**自由对话模块接口预设与后续重构

# 1. 文档目的与设计边界

本文档用于明确 UniSpeaking 自由对话模块在“开始、暂停、恢复、打断、结束”五个阶段中，UI、Free Chat SDK、业务后端与 Qwen Realtime 各自需要提供的接口，以及各端发送和接收的数据。

该文档是面向后续重构的接口预设，不要求完全照搬当前 Demo 代码；UI 交互和产品流程相对稳定，底层实现可以替换，但 UI 和业务接口应尽量保持稳定。

## 1.1 核心产品定义

- 每次用户点击“开始自由对话”，创建一个全新的、一次性的 FreeChatSession。

- 自由对话不形成长期 Conversation 档案，也不支持跨多次会话持续记忆。

- 字幕、临时消息和实时事件只在限定时间内保存，到期自动删除。

- 为额度、计费和厂商账单对齐所需的最小用量记录可以长期保留，但不保存用户具体说话内容。

- 当前方案不绑定 Pion，也不假设双 WebRTC。

## 1.2 架构边界

```text
UI 页面
   │ 产品级方法与状态事件
   ▼
Free Chat SDK（Web / iOS / Android）
   ├─ HTTP 控制通道 ───────────► 业务后端
   │                              ├─ 用户鉴权
   │                              ├─ 额度与 Session
   │                              ├─ SDP 代理
   │                              ├─ 用量归属
   │                              └─ 数据清理
   │
   └─ WebRTC + DataChannel ────► Qwen Realtime
                                  ├─ 用户音频识别
                                  ├─ 大模型回复
                                  ├─ AI 音频
                                  └─ 实时字幕与事件
```

> **关键原则：**业务后端负责“控制面”，不实时转发音频；客户端和 Qwen Realtime 之间直接传输音频与 DataChannel 事件。

# 2. 参与端与职责划分

| 参与端 | 主要职责 | 明确不负责 |
| --- | --- | --- |
| UI 页面 | 按钮、字幕、倒计时、状态和错误提示；调用 SDK 产品级方法。 | 不创建 SDP；不处理 Qwen 原始事件；不直接管理 API Key。 |
| Free Chat SDK | 麦克风、播放器、PeerConnection、DataChannel、状态机、事件转换与资源清理。 | 不决定用户额度；不信任客户端传入的 userId；不保存长期业务数据。 |
| 业务后端 | 鉴权、额度检查、一次性 Session、Prompt/配置、SDP 代理、状态、用量和删除策略。 | 不实时播放音频；不通过普通 HTTP 转发实时音频。 |
| Qwen Realtime | ASR、VAD、模型推理、AI 音频、字幕和模型实时事件。 | 不理解产品会员、用户额度和内容保留策略。 |
| Usage/Cleanup | 最终用量对账、额度扣减、临时内容到期删除。 | 不参与 UI 实时交互。 |

# 3. 公共对象、状态与通信通道

## 3.1 核心标识

| 标识 | 生成方 | 生命周期 | 用途 |
| --- | --- | --- | --- |
| sessionId | 业务后端 | 一次自由对话 | 关联用户、额度、开始/结束、临时内容、厂商 Session 和最终用量。 |
| connectionId | SDK 或后端 | 一次 WebRTC 连接 | 预留断线重连；同一个 sessionId 可对应多个 connectionId。 |
| providerSessionId | Qwen Realtime | 厂商实时会话 | 厂商日志、Usage 和账单对齐。 |
| requestId | 业务后端 | 一次 HTTP 调用或链路 | 日志追踪、异常定位、跨服务关联。 |
| eventId | SDK / Qwen | 一个实时事件 | 事件去重、顺序与幂等保存。 |

## 3.2 三条通信通道

- HTTP 控制通道：创建 Session、交换 SDP、暂停/恢复状态、事件上报、质量上报和结束。

- WebRTC 音频通道：用户麦克风音频发给 Qwen；Qwen AI 音频返回客户端。

- DataChannel 事件通道：Session 配置、文字输入、回复取消、字幕、VAD、工具调用和错误。

## 3.3 Session 主状态

```text
CREATED
  └─ CONNECTING
       └─ ACTIVE
            ├─ PAUSED ──► ACTIVE
            ├─ INTERRUPTING ──► ACTIVE / USER_SPEAKING
            └─ ENDING ──► ENDED

任意阶段发生不可恢复异常：
FAILED / EXPIRED / ABNORMAL_ENDED
```

## 3.4 公共 HTTP 请求头

```text
Authorization: Bearer <user-access-token>
X-Request-Id: req_xxx
X-Device-Id: device_xxx
X-Client-Platform: WEB | IOS | ANDROID
X-Client-Version: 0.1.0
Content-Type: application/json
```

> **安全要求：**userId 不应由客户端请求体直接传入；业务后端应从用户访问令牌中解析当前用户身份。

## 3.5 SDK 对 UI 的统一事件外层

```jsonc
{
  "type": "session.connected",
  "timestamp": "2026-07-17T10:20:12.000Z",
  "payload": {
    "session_id": "fcs_xxx",
    "remaining_seconds": 600
  }
}
```

# 4. 开始阶段接口

> **阶段目标：**创建一次性自由对话 Session，完成权限、额度与配置检查，并让客户端与 Qwen Realtime 建立 WebRTC。

## 4.1 状态变化

```text
IDLE → CREATING_SESSION → REQUESTING_MICROPHONE → CONNECTING → ACTIVE
```

## 4.2 各端接口对照

| 调用方 | 接收方 | 接口/事件 | 发送内容 | 接收内容 |
| --- | --- | --- | --- | --- |
| UI | SDK | start(options) | 教练、音色、难度、语言 | Session 标识、剩余时间、连接状态 |
| SDK | 业务后端 | POST /v1/free-chat/sessions | 客户端配置与幂等键 | sessionId、时限、Realtime 配置 |
| SDK | 系统媒体层 | getUserMedia / Native Audio | 音频约束 | 本地麦克风流 |
| SDK | 业务后端 | POST /sessions/{id}/sdp | Offer SDP | Answer SDP |
| SDK | Qwen | session.update | Prompt、音色、VAD、模态 | session.updated |
| SDK | Qwen | response.create | 请求 AI 主动开场 | 字幕、AI 音频与 response 事件 |
| SDK | 业务后端 | POST /provider-session | providerSessionId | 绑定结果 |

## 4.3 UI → SDK

**SDK 方法**

```typescript
await freeChatClient.start({
  coachId: "clara",
  voiceId: "clara_default",
  difficulty: "BEGINNER",
  language: "en-US"
});
```

**UI 接收的主要状态事件：**

- session.creating

- microphone.requesting

- session.connecting

- session.connected

- session.error

## 4.4 SDK → 业务后端：创建 Session

**POST  /v1/free-chat/sessions**

创建一次性自由对话 Session，并返回服务端确定的时限、Prompt 配置和 Realtime 参数。

**请求**

```jsonc
{
  "coach_id": "clara",
  "voice_id": "clara_default",
  "difficulty": "BEGINNER",
  "language": "en-US",
  "client": {
    "platform": "WEB",
    "app_version": "0.1.0",
    "device_id": "device_xxx"
  },
  "idempotency_key": "start_xxx"       //idempotency_key（幂等性键）—— 这是一个防止重复操作的保险机制
}
```

**后端处理**

- 验证登录状态、账号状态和用户权限。

- 检查会员权益、剩余额度、并发 Session 和创建频率。

- 创建 sessionId，并设置 createdAt、expiresAt、contentDeleteAt。

- 选择服务端 Prompt 版本、模型、音色和 VAD 配置。

- 预占或冻结本次会话允许使用的最大额度。

**响应**

```jsonc
{
  "request_id": "req_xxx",
  "session_id": "fcs_xxx",
  "status": "CREATED",
  "created_at": "2026-07-17T10:20:00Z",            //idempotency_key（幂等性键）—— 这是一个防止重复操作的保险机制
  "expires_at": "2026-07-17T10:30:00Z",            //会话有效期截止，10 分钟后过期，必须在这之前开始
  "content_delete_at": "2026-07-18T10:30:00Z",    //内容删除时间，24 小时后自动删除录音/聊天记录等
  "policy": {
    "max_duration_seconds": 600,        //单次练习最长 10 分钟（600 秒），到时间强制结束
    "remaining_seconds": 600,         //剩余可用时间，开始后会倒计时
    "idle_timeout_seconds": 60          //空闲超时 60 秒，如果你 1 分钟不说话/不操作，自动断开
  },
  "realtime_config": {
    "voice": "clara_default",
    "modalities": ["text", "audio"],
    "turn_detection": {                //话轮检测，判断"用户说完了，该 AI 回复了"的配置
      "type": "server_vad",          //服务器端语音活动检测。VAD = Voice Activity Detection（语音活动检测）
      "threshold": 0.5,                    //检测灵敏度阈值（0~1）。0.5 表示中等灵敏度，越高越容易触发"检测到说话"
      "silence_duration_ms": 800           //静音持续时间 800 毫秒。用户停止说话 0.8 秒后，认为说完了，AI 开始回复
    }
  }
}
```

## 4.5 SDK 内部媒体与 WebRTC 操作

1. 调用 Web 的 navigator.mediaDevices.getUserMedia，或移动端原生音频采集接口。

2. 创建 RTCPeerConnection。

3. 将本地音频 Track 加入 PeerConnection。

4. 创建名为 oai-events 的 DataChannel。

5. 生成 Offer SDP 并等待 ICE 收集完成。

## 4.6 SDK → 业务后端：交换 SDP

**POST  /v1/free-chat/sessions/{sessionId}/sdp**

业务后端验证 Session 后，使用服务端 Qwen 凭证代理 Offer/Answer SDP 交换。

**请求**

```text
Content-Type: application/sdp

v=0
o=- ...
...
```

**后端处理**

- 验证 Session 属于当前用户且未过期。

- 从服务端安全配置读取 Qwen API Key、Workspace 和模型。

- 将 Offer SDP 发送给 Qwen Realtime WebRTC 接口。

- 获取 Answer SDP 后原样返回客户端。

**响应**

```text
HTTP 200
Content-Type: application/sdp

v=0
o=- ...
...
```

## 4.7 SDK ↔ Qwen Realtime

**Qwen 建连后发送：**

```jsonc
{
  "type": "session.created",
  "session": {
    "id": "provider_session_xxx"
  }
}
```

**SDK 随后发送服务端生成的 Session 配置：**

```jsonc
{
  "event_id": "evt_config_xxx",     //事件唯一 ID，用于追踪、去重、日志排查
  "type": "session.update",       //事件类型：会话配置更新。其他可能值：session.created、response.created、response.done 等
  "session": {
    "instructions": "<server-generated-prompt>",        //系统提示词
    "voice": "clara_default",
    "modalities": ["text", "audio"],
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 500,         //前缀填充 500ms。检测到说话后，往前补 0.5 秒音频，防止截断用户开头的声音
      "silence_duration_ms": 800
    }
  }
}
```

**需要 AI 主动开场时：**

```jsonc
{
  "event_id": "evt_greeting_xxx",
  "type": "response.create"
}
```

## 4.8 SDK → 后端：绑定厂商 Session

**POST  /v1/free-chat/sessions/{sessionId}/provider-session**

将 Qwen 返回的 providerSessionId 与产品 sessionId 绑定，用于日志、Usage 和账单对齐。

**请求**

```jsonc
{
  "provider_session_id": "provider_session_xxx"
}
```

**响应**

```jsonc
{
  "bound": true,
  "session_id": "fcs_xxx"
}
```

## 4.9 开始阶段完整调用链

```text
UI
 └─ freeChatClient.start(options)
      │
SDK   ├─ POST /v1/free-chat/sessions
      ├─ 请求麦克风
      ├─ 创建 PeerConnection + DataChannel
      ├─ 生成 Offer SDP
      └─ POST /sessions/{sessionId}/sdp
                │
后端            └─ Offer → Qwen → Answer
                                      │
SDK ◄──────────────────────────────────┘
 ├─ setRemoteDescription(answer)
 ├─ 等待 session.created
 ├─ POST /provider-session
 ├─ DataChannel → session.update
 └─ DataChannel → response.create

UI ◄─ session.connected
```

# 5. 暂停阶段接口

> **阶段目标：**保留 WebRTC 与 DataChannel 连接，但暂时停止用户麦克风发送和 AI 音频播放。暂停不等于结束，sessionId 不变。

## 5.1 状态变化

```text
ACTIVE → PAUSING → PAUSED
```

## 5.2 各端接口对照

| 调用方 | 接收方 | 接口/事件 | 发送内容 | 接收内容 |
| --- | --- | --- | --- | --- |
| UI | SDK | pause() | 用户暂停操作 | session.paused 或 session.error |
| SDK | Qwen | response.cancel（条件触发） | 取消当前 AI 回复 | response.done / cancel 结果 |
| SDK | 本地媒体层 | setPaused(true) | 禁用麦克风、暂停播放器 | 本地暂停结果 |
| SDK | 业务后端 | POST /sessions/{id}/pause | 暂停原因与客户端时间 | PAUSED、剩余时间、最大暂停时长 |

## 5.3 UI → SDK

```typescript
await freeChatClient.pause();
```

**UI 应进入以下表现：**

- 显示“已暂停”和恢复按钮。

- 停止麦克风输入动画和 AI 播放动画。

- 保持 Session 倒计时或显示暂停上限，具体取决于产品计时规则。

## 5.4 SDK 内部处理

1. 若 AI 正在生成或播放，先向 Qwen 发送 response.cancel。

2. 停止当前 AI 音频播放并清理未播放缓冲。

3. 禁用本地音频 Track，或将 Sender 暂时 replaceTrack(null)。

4. 保持 PeerConnection、DataChannel 和 MediaStream 对象不关闭。

5. 调用后端 pause 接口，确认服务端状态。

## 5.5 SDK → Qwen：取消当前回复

```jsonc
{
  "event_id": "evt_pause_cancel_xxx",
  "type": "response.cancel"
}
```

> **触发条件：**只有 AI 当前正在生成或播放时才发送；若当前没有 AI 回复，暂停主要由客户端媒体层和后端状态接口完成。

## 5.6 SDK → 业务后端：暂停

**POST  /v1/free-chat/sessions/{sessionId}/pause**

将业务 Session 标记为 PAUSED，记录暂停时间并返回暂停策略。

**请求**

```jsonc
{
  "reason": "USER_PAUSED",
  "client_paused_at": "2026-07-17T10:23:00Z"
}
```

**后端处理**

- 验证当前 Session 为 ACTIVE，且属于当前用户。

- 记录 pausedAt 和暂停次数。

- 设置最大暂停时长，避免长时间占用厂商连接。

- 根据产品规则确定暂停时间是否计入总时长或计费时长。

**响应**

```jsonc
{
  "session_id": "fcs_xxx",
  "status": "PAUSED",
  "paused_at": "2026-07-17T10:23:00Z",
  "remaining_seconds": 420,
  "max_pause_seconds": 120     //最大暂停时间
}
```

## 5.7 暂停阶段完整调用链

```text
UI
 └─ freeChatClient.pause()
      │
SDK   ├─ response.cancel（AI 正在回复时）
      ├─ 停止 AI 当前音频
      ├─ 禁用麦克风 Track
      └─ POST /sessions/{sessionId}/pause
                │
后端            └─ ACTIVE → PAUSED
                      │
SDK ◄─────────────────┘
 └─ emit session.paused

UI ◄─ 更新暂停界面
```

# 6. 恢复阶段接口

> **阶段目标：**在不重新创建 Session 和 WebRTC 的情况下，验证 Session 仍有效，重新启用麦克风和 AI 播放。

## 6.1 状态变化

```text
PAUSED → RESUMING → ACTIVE
```

## 6.2 各端接口对照

| 调用方 | 接收方 | 接口/事件 | 发送内容 | 接收内容 |
| --- | --- | --- | --- | --- |
| UI | SDK | resume() | 用户恢复操作 | session.resumed 或 session.expired |
| SDK | 业务后端 | POST /sessions/{id}/resume | 客户端恢复时间 | ACTIVE、暂停时长、剩余时间 |
| SDK | 本地媒体层 | setPaused(false) | 恢复播放器与音频 Track | 本地恢复结果 |
| SDK | Qwen | 通常无事件 | 无 | 等待用户下一次说话 |

## 6.3 UI → SDK

```typescript
await freeChatClient.resume();
```

## 6.4 SDK → 业务后端：恢复

**POST  /v1/free-chat/sessions/{sessionId}/resume**

验证暂停 Session 尚未过期，并将服务端状态恢复为 ACTIVE。

**请求**

```jsonc
{
  "client_resumed_at": "2026-07-17T10:23:20Z"
}
```

**后端处理**

- 验证 Session 当前状态为 PAUSED。

- 检查 Session 总时限和最大暂停时长。

- 计算本次 pauseDurationSeconds。

- 更新状态为 ACTIVE，并返回最新剩余时间。

**响应**

```jsonc
{
  "session_id": "fcs_xxx",
  "status": "ACTIVE",
  "resumed_at": "2026-07-17T10:23:20Z",
  "pause_duration_seconds": 20,
  "remaining_seconds": 400
}
```

## 6.5 SDK 内部恢复

1. 必须先等待后端 resume 成功，避免已过期 Session 仍继续发送音频。

2. 恢复 AI 音频播放器。

3. 重新启用麦克风 Track，或将 Track 重新放回 RTCRtpSender。

4. 将本地状态切换为 ACTIVE。

5. 恢复后默认等待用户继续说话，不自动继续暂停前被取消的 AI 回复。

## 6.6 SDK → Qwen

正常恢复通常不需要发送 Qwen 事件。只有产品明确要求“恢复后由 AI 主动提醒”时，才重新发送 response.create；默认不建议自动触发，以免 AI 在用户未开口时突然说话。

## 6.7 恢复阶段完整调用链

```text
UI
 └─ freeChatClient.resume()
      │
SDK   └─ POST /sessions/{sessionId}/resume
                │
后端            ├─ 验证未过期
                └─ PAUSED → ACTIVE
                      │
SDK ◄─────────────────┘
 ├─ 恢复 AI 播放器
 ├─ 启用麦克风 Track
 └─ emit session.resumed

UI ◄─ 恢复对话界面
```

# 7. 打断阶段接口

> **阶段目标：**用户在 AI 正在说话时，立即停止 AI 当前这一轮回复，并继续使用同一个 Session、WebRTC 和 DataChannel。

## 7.1 打断与暂停的区别

| 对比项 | 暂停 | 打断 |
| --- | --- | --- |
| 目的 | 整个对话暂时停止 | 只停止 AI 当前回复 |
| 麦克风 | 停止发送 | 保持开启，用户可立即继续说 |
| 播放器 | 暂停整个播放能力 | 停止当前 AI 音频并清空缓冲 |
| 后端状态 | PAUSED | 通常仍为 ACTIVE |
| Qwen 事件 | AI 回复中可发送 response.cancel | 必须发送 response.cancel |

## 7.2 状态变化

```text
AI_SPEAKING → INTERRUPTING → USER_SPEAKING / ACTIVE
```

## 7.3 各端接口对照

| 调用方 | 接收方 | 接口/事件 | 发送内容 | 接收内容 |
| --- | --- | --- | --- | --- |
| UI / VAD | SDK | interrupt(reason) | 按钮或检测到用户开始说话 | 打断完成事件 |
| SDK | 本地播放器 | 停止当前回复 | 当前 responseId | 停止播放并清空缓冲 |
| SDK | Qwen | response.cancel | 当前回复取消请求 | 停止后续生成 |
| SDK | 业务后端 | POST /events（可选） | 打断事件与 responseId | stored=true |

## 7.4 UI / 自动 VAD → SDK

```typescript
await freeChatClient.interrupt("USER_SPEAKING");

// 或由 SDK 检测：
// AI 正在播放 + input_audio_buffer.speech_started
```

## 7.5 SDK 内部处理

1. 确认 AI 当前处于生成或播放状态，避免重复打断。

2. 立即停止本地当前 AI 音频，并清空已经缓存但尚未播放的数据。

3. 向 Qwen DataChannel 发送 response.cancel。

4. 保持麦克风、PeerConnection 和 DataChannel 继续工作。

5. 发出产品事件 response.interrupted。

## 7.6 SDK → Qwen：打断当前回复

```jsonc
{
  "event_id": "evt_interrupt_xxx",
  "type": "response.cancel"
}
```

## 7.7 SDK → 后端：打断事件（可选）

**POST  /v1/free-chat/sessions/{sessionId}/events**

打断不需要单独的后端控制接口，可作为分析事件异步上报；上报失败不得影响实时打断。

**请求**

```jsonc
{
  "event_id": "evt_interrupt_xxx",
  "event_type": "ASSISTANT_RESPONSE_INTERRUPTED",
  "occurred_at": "2026-07-17T10:24:10Z",
  "payload": {
    "reason": "USER_SPEAKING",
    "provider_response_id": "resp_xxx"
  }
}
```

**响应**

```jsonc
{
  "stored": true
}
```

## 7.8 打断阶段完整调用链

```text
用户点击打断 / SDK 检测用户说话
            │
SDK         ├─ 停止本地 AI 当前音频
            ├─ 清空当前回复音频缓冲
            ├─ DataChannel → response.cancel
            ├─ 保持麦克风与 WebRTC
            └─ POST /events（可选、异步）
                         │
Qwen                     └─ 停止当前 Response

UI ◄─ response.interrupted
用户继续说话 → 原 WebRTC 音频通道
```

# 8. 结束阶段接口

> **阶段目标：**停止所有实时资源，将一次性 Session 关闭，记录预计用量并等待厂商 Usage 确认，同时设置临时内容删除时间。

## 8.1 状态变化

```text
ACTIVE / PAUSED / ERROR → ENDING → ENDED
```

## 8.2 结束原因

- USER_ENDED：用户主动结束。

- TIME_LIMIT_REACHED：达到可用时限。

- IDLE_TIMEOUT：长时间无交互。

- NETWORK_ERROR：WebRTC 或网络不可恢复。

- MICROPHONE_ERROR：麦克风权限或音轨异常。

- PROVIDER_ERROR：Qwen Realtime 异常。

- APP_CLOSED：页面关闭或 App 被结束。

## 8.3 各端接口对照

| 调用方 | 接收方 | 接口/事件 | 发送内容 | 接收内容 |
| --- | --- | --- | --- | --- |
| UI | SDK | end(reason) | 结束原因 | Session 结束结果 |
| SDK | Qwen | response.cancel（条件触发） | 取消未完成回复 | 停止生成 |
| SDK | 本地媒体层 | stop / close | Track、Player、Channel、Peer | 资源清理结果 |
| SDK | 业务后端 | POST /telemetry | WebRTC 质量指标 | accepted=true |
| SDK | 业务后端 | POST /end | 结束原因、时间、providerSessionId | ENDED 与预计用量 |
| 后端 | Usage/Cleanup | 内部任务 | Session 与厂商标识 | Usage 确认与到期删除 |

## 8.4 UI → SDK

```typescript
await freeChatClient.end("USER_ENDED");
```

## 8.5 SDK 资源清理顺序

1. 将本地状态切换为 ENDING，拒绝新的暂停、恢复、文字发送和重复开始。

2. AI 正在生成时，向 Qwen 发送 response.cancel。

3. 停止本地所有麦克风 Track。

4. 停止 AI 播放器并清空音频缓冲。

5. 收集 RTCPeerConnection.getStats() 质量指标。

6. 关闭 DataChannel。

7. 关闭 RTCPeerConnection。

8. 异步上报 telemetry；失败不得阻止 end。

9. 调用业务后端 end 接口并接收结束结果。

10. 清空 SDK 内存状态并通知 UI。

## 8.6 SDK → 业务后端：质量上报

**POST  /v1/free-chat/sessions/{sessionId}/telemetry**

上报客户端可观察到的 WebRTC 质量数据，仅用于诊断，不作为唯一计费依据。

**请求**

```jsonc
{
  "recorded_at": "2026-07-17T10:26:30Z",
  "metrics": {
    "duration_seconds": 388,        //实际通话时长 
    "packets_received": 8200,      //收到 8200 个音频数据包
    "packets_lost": 12,            //丢了 12 个包
    "packet_loss_percent": 0.15,       //丢包率 0.15%
    "max_jitter_ms": 20,          //最大抖动 20 毫秒
    "avg_rtt_ms": 105,             //平均往返延迟 105 毫秒
    "connection_disruptions": 0,        //连接中断 0 次
    "interrupt_count": 2,         //用户打断 AI 2 次
    "pause_count": 1      //用户暂停 1 次
  }
}
```

**响应**

```jsonc
{
  "accepted": true
}
```

## 8.7 SDK → 业务后端：结束 Session

**POST  /v1/free-chat/sessions/{sessionId}/end**

幂等地结束一次性 Session，记录服务端预计时长，等待厂商最终 Usage，并设置内容删除任务。

**请求**

```jsonc
{
  "reason": "USER_ENDED",
  "client_ended_at": "2026-07-17T10:26:30Z",
  "provider_session_id": "provider_session_xxx"
}
```

**后端处理**

- 验证 Session 归属，并保证重复调用不会重复扣费。

- 记录服务端 endedAt 和 endReason。

- 基于服务端时间计算预计连接时长、活动时长和暂停时长。

- 将 usageStatus 设置为 PENDING_PROVIDER_CONFIRMATION。

- 等待或异步查询厂商最终 Usage，并完成额度对账。

- 设置 contentDeleteAt，触发临时字幕与事件删除任务。

**响应**

```jsonc
{
  "session_id": "fcs_xxx",
  "status": "ENDED",
  "ended_at": "2026-07-17T10:26:30Z",
  "end_reason": "USER_ENDED",
  "usage_status": "PENDING_PROVIDER_CONFIRMATION",
  "estimated_usage": {
    "connected_seconds": 388,
    "active_seconds": 360,
    "paused_seconds": 20
  },
  "content_delete_at": "2026-07-18T10:26:30Z"
}
```

## 8.8 结束阶段完整调用链

```text
UI
 └─ freeChatClient.end(reason)
      │
SDK   ├─ response.cancel（必要时）
      ├─ 停止麦克风 Track
      ├─ 停止播放器并清空缓冲
      ├─ 收集 getStats()
      ├─ 关闭 DataChannel
      ├─ 关闭 PeerConnection
      ├─ POST /telemetry（失败不阻塞）
      └─ POST /sessions/{sessionId}/end
                │
后端            ├─ 幂等结束 Session
                ├─ 记录预计用量
                ├─ 等待厂商最终 Usage
                ├─ 完成额度归属
                └─ 设置 contentDeleteAt
                      │
SDK ◄─────────────────┘
 └─ emit session.ended

UI ◄─ 显示结束状态或返回入口
```

# 9. 五阶段接口对照表

| 阶段 | UI → SDK | SDK → 后端 | SDK → Qwen | 本地媒体操作 | 服务端状态 |
| --- | --- | --- | --- | --- | --- |
| 开始 | start(options) | 创建 Session、交换 SDP、绑定 providerSession | session.update、response.create | 申请麦克风、创建 Peer/DataChannel | CREATED → ACTIVE |
| 暂停 | pause() | POST /pause | AI 回复中发送 response.cancel | 禁用 Track、暂停播放器 | ACTIVE → PAUSED |
| 恢复 | resume() | POST /resume | 通常无事件 | 启用 Track、恢复播放器 | PAUSED → ACTIVE |
| 打断 | interrupt() | POST /events（可选） | response.cancel | 停止当前 AI 音频、清空缓冲 | 通常保持 ACTIVE |
| 结束 | end(reason) | POST /telemetry、POST /end | 必要时 response.cancel | 停止 Track/Player，关闭 Channel/Peer | ACTIVE/PAUSED → ENDED |

## 9.1 SDK 产品级方法

```typescript
interface FreeChatClient {
  start(options: StartFreeChatOptions): Promise<StartFreeChatResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  interrupt(reason?: InterruptReason): Promise<void>;
  end(reason?: FreeChatEndReason): Promise<FreeChatEndResult>;

  on(event: FreeChatEventName, handler: FreeChatEventHandler): void;
}
```

# 10. 异常、幂等、超时与安全要求

## 10.1 幂等要求

- 创建 Session 必须支持 idempotencyKey，防止连续点击创建多个活动 Session。

- pause 和 resume 对重复调用应返回当前状态，而不是报不可恢复错误。

- end 必须严格幂等；重复调用不得重复扣减额度或重复创建账单。

- events 使用 eventId 或 providerEventId 去重。

## 10.2 超时要求

| 场景 | 建议超时 | 处理方式 |
| --- | --- | --- |
| 创建 Session | 5-10 秒 | 失败后释放额度预占，返回可重试错误。 |
| SDP 交换 | 15 秒 | 关闭本地 PeerConnection，并结束未建立的 Session。 |
| DataChannel 打开 | 10 秒 | 执行资源清理，允许重新开始。 |
| 最大暂停 | 60-120 秒 | 到期自动结束或要求重新开始。 |
| 无交互空闲 | 按产品策略，例如 60 秒 | 先发 warning，再自动 end。 |
| Session 总时限 | 由会员权益决定 | 服务端到期标记 EXPIRED，客户端收到后关闭连接。 |

## 10.3 错误码建议

| 错误码 | 含义 | 客户端行为 |
| --- | --- | --- |
| UNAUTHORIZED | 用户未登录或令牌失效 | 跳转登录，不自动重试。 |
| QUOTA_EXHAUSTED | 剩余自由对话额度不足 | 显示额度提示或会员入口。 |
| ACTIVE_SESSION_EXISTS | 已有活动 Session | 恢复或结束旧 Session。 |
| SESSION_EXPIRED | Session 达到时限 | 关闭实时资源并显示已结束。 |
| INVALID_SESSION_STATE | 当前状态不允许该操作 | 刷新 Session 状态，避免重复操作。 |
| MICROPHONE_DENIED | 麦克风权限被拒绝 | 提示用户开启权限。 |
| SDP_EXCHANGE_FAILED | SDP 或厂商建连失败 | 清理资源，允许重新开始。 |
| PROVIDER_CONNECTION_FAILED | Qwen 实时连接失败 | 结束本次 Session 或有限重试。 |
| NETWORK_DISCONNECTED | 网络断开 | 第一阶段可结束旧 Session 后重新开始。 |
| INTERNAL_ERROR | 服务端未知错误 | 展示通用错误并记录 requestId。 |

## 10.4 安全边界

- Qwen API Key、Workspace、Service Role 等服务端秘密不得放入 Web、iOS 或 Android 客户端。

- 客户端不得直接决定 userId、最大时长、剩余额度、最终计费秒数和最终 Prompt。

- 客户端上报字幕、质量和结束时间只能作为辅助记录，最终时长以服务端和厂商 Usage 为准。

- 后端应验证 sessionId 归属当前登录用户，并校验状态与 expiresAt。

- 所有异常响应都应携带 requestId，便于跨端排查。

# 11. 临时数据删除与最小用量账本

## 11.1 到期自动删除的数据

- 用户最终字幕和 AI 最终字幕。

- 增量字幕、实时事件和调试事件。

- 临时消息与工具调用明细。

- 完整 Prompt 快照和临时模型配置。

- 音频文件（若测试阶段曾临时录制）。

## 11.2 建议保留的最小用量账本

```jsonc
{
  "session_id": "fcs_xxx",
  "user_id": "user_xxx",
  "created_at": "2026-07-17T10:20:00Z",
  "ended_at": "2026-07-17T10:26:30Z",
  "end_reason": "USER_ENDED",
  "provider_session_id": "provider_session_xxx",
  "provider_request_id": "provider_request_xxx",
  "estimated_seconds": 388,
  "confirmed_billable_seconds": 360,
  "usage_status": "CONFIRMED"
}
```

> **隐私与计费平衡：**删除对话内容不等于删除用量账本。账本不包含用户具体说话文本，只用于会员额度、厂商账单对齐、异常扣费和申诉处理。

# 12. 第一阶段最小接口清单

**第一阶段建议先确定并实现下面 8 个 HTTP 接口：**

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | /v1/free-chat/sessions | 创建一次性 Session。 |
| POST | /v1/free-chat/sessions/{sessionId}/sdp | 代理 Offer/Answer SDP。 |
| POST | /v1/free-chat/sessions/{sessionId}/provider-session | 绑定 Qwen providerSessionId。 |
| POST | /v1/free-chat/sessions/{sessionId}/pause | 服务端记录暂停状态。 |
| POST | /v1/free-chat/sessions/{sessionId}/resume | 服务端验证并恢复 Session。 |
| POST | /v1/free-chat/sessions/{sessionId}/events | 保存必要的最终事件或分析事件。 |
| POST | /v1/free-chat/sessions/{sessionId}/telemetry | 上报 WebRTC 质量指标。 |
| POST | /v1/free-chat/sessions/{sessionId}/end | 幂等结束 Session。 |

**对应 UI 只需要认识五个 SDK 方法：**

```text
start()
pause()
resume()
interrupt()
end()
```

# 附录 A. SDK 类型定义建议

```typescript
type FreeChatSessionStatus =
  | "IDLE"
  | "CREATING_SESSION"
  | "REQUESTING_MICROPHONE"
  | "CONNECTING"
  | "ACTIVE"
  | "PAUSING"
  | "PAUSED"
  | "RESUMING"
  | "INTERRUPTING"
  | "ENDING"
  | "ENDED"
  | "FAILED"
  | "EXPIRED";

interface StartFreeChatOptions {
  coachId: string;
  voiceId: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  language: string;
}

interface StartFreeChatResult {
  sessionId: string;
  expiresAt: string;
  remainingSeconds: number;
  status: "ACTIVE";
}

type InterruptReason =
  | "USER_CLICKED"
  | "USER_SPEAKING"
  | "CLIENT_POLICY";

type FreeChatEndReason =
  | "USER_ENDED"
  | "TIME_LIMIT_REACHED"
  | "IDLE_TIMEOUT"
  | "NETWORK_ERROR"
  | "MICROPHONE_ERROR"
  | "PROVIDER_ERROR"
  | "APP_CLOSED";

interface FreeChatEndResult {
  sessionId: string;
  status: "ENDED";
  endedAt: string;
  endReason: FreeChatEndReason;
  estimatedUsageSeconds: number;
  contentDeleteAt: string;
}
```

# 附录 B. UI 建议监听的标准事件

| 产品事件 | UI 用途 |
| --- | --- |
| session.creating | 正在创建业务 Session。 |
| microphone.requesting | 正在申请麦克风权限。 |
| session.connecting | 正在进行 WebRTC 和 DataChannel 建连。 |
| session.connected | 连接完成，可以开始说话。 |
| session.paused | 会话已暂停。 |
| session.resumed | 会话已恢复。 |
| response.assistant.started | AI 开始生成。 |
| audio.assistant.started | AI 音频开始播放。 |
| response.interrupted | 当前 AI 回复已被用户打断。 |
| transcript.user.delta/final | 用户字幕增量/最终结果。 |
| transcript.assistant.delta/final | AI 字幕增量/最终结果。 |
| session.time.warning | 剩余时间提醒。 |
| session.ended | 本次一次性自由对话结束。 |
| session.error | 发生错误，包含 code、message 和 retryable。 |
