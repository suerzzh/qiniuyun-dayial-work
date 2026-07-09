# 国内端到端 Realtime 语音 Demo 开发设计文档

日期：2026-07-09  
适用范围：Web 端自由对话 Demo  
产品背景：AI 英语口语陪练，自由对话模块链路验证  

## 0. 文档结论

本 Demo 建议优先采用 **Qwen-Omni-Realtime** 作为主方案，原因是阿里云百炼公开文档已明确提供 Realtime 模型、WebSocket 和 WebRTC 两种接入方式、地域、模型名、会话配置、音频输入输出格式、文本和音频事件。  

豆包端到端实时语音大模型可作为备选方向，但当前未找到同等清晰、可直接开发的公开实时语音 API 文档。若团队已有火山引擎资源，应先申请接口权限并做技术实测，再决定是否切换。

本 Demo 不验证评分、纠错、CEFR、发音评测、错题本、登录、会员、录音保存、完整个人主页和复杂学习报告。

## 1. Demo 目标

### 1.1 要验证什么

本 Demo 只验证自由对话的最小实时语音链路是否成立：

```text
浏览器麦克风输入
  -> 国内端到端实时语音模型
  -> AI 实时语音回复
  -> 对话框输出对话文本
  -> 前端播放声音
  -> 用户可以结束通话
```

核心问题不是验证完整学习产品，而是验证用户能否像打电话一样，与 AI 进行低压力、连续、自然的英语语音对话。

### 1.2 成功标准

Demo 成功的标准是：

- 用户可以在浏览器中点击开始对话，并完成麦克风授权。
- 用户说英语后，系统能把用户语音送入实时模型。
- AI 能用英语进行实时语音回复，并同步展示文本。
- 对话能连续进行多轮，不需要每轮手动上传录音。
- 用户能看到自己和 AI 的对话文本。
- 用户能主动结束通话，前端停止麦克风采集和音频播放。
- 连接失败、鉴权失败、麦克风失败时有明确提示。
- 不保存用户录音，只记录必要调试信息。

建议内部 Demo 的体验目标：

- 首次连接成功率：稳定网络下大于 90%，需要实测。
- 用户停止说话到 AI 开始出声：目标小于 2 秒，是否可达需要实测。
- 单次自由对话可连续 3 到 5 分钟。
- AI 单次回复控制在 1 到 3 句，主要追问用户，而不是长篇教学。

## 2. 国内 Realtime 方案选择

### 2.1 候选方案对比

| 方案                 | 当前公开资料判断                                                                            | 优点                                                         | 风险                                 | 本 Demo 判断      |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- | -------------- |
| Qwen-Omni-Realtime | 阿里云百炼已有官方 Realtime 文档，明确支持 WebSocket 和 WebRTC。示例模型名包含 `qwen3.5-omni-plus-realtime`。 | 接入路径清楚；支持浏览器低延迟 WebRTC；也支持服务端 WebSocket；可输出文本和音频；有 VAD 配置。 | 实际延迟、并发、价格、账号权限、英语口语识别效果仍需要实测。     | 推荐主方案。         |
| 豆包端到端实时语音大模型       | 未找到同等明确的公开实时语音 API 文档。豆包产品侧支持语音通话，但开发者 API、协议、模型名、地域、事件格式需要权限确认。                    | 国内生态强；如果已有火山引擎资源，商务和技术支持可能更顺。                              | 权限申请、文档可得性、协议形态、延迟、转写事件、打断能力均需要实测。 | 备选方案，先申请权限再评估。 |

### 2.2 Qwen-Omni-Realtime 能力摘要

根据阿里云百炼公开文档，Qwen-Omni-Realtime 是实时音视频聊天模型，可理解流式音频与图像输入，并实时输出文本与音频。文档明确：

- 支持地域：北京、新加坡。
- 支持协议：WebSocket、WebRTC。
- WebSocket 地址形态：`wss://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3.5-omni-plus-realtime`。
- WebRTC SDP 交换地址形态：`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime?model=qwen3.5-omni-plus-realtime`。
- 鉴权：`Authorization: Bearer DASHSCOPE_API_KEY`。
- 输入音频：PCM，16 kHz。
- 输出音频：PCM，24 kHz。
- 输出模态：可配置 `["text"]` 或 `["text", "audio"]`。
- VAD：支持 `server_vad` 和 `semantic_vad`，`qwen3.5-omni-realtime` 场景推荐语义 VAD。
- 单次会话最长 120 分钟。

以上能力仍需在本项目网络环境、浏览器环境和账号权限下实测。

### 2.3 豆包方案需要确认的问题

若选择豆包或火山引擎方向，必须先确认以下问题：

- 是否提供端到端实时语音模型，而不是 ASR、LLM、TTS 串联方案。
- 是否支持浏览器可用的 WebRTC。
- 若只支持 WebSocket，是否允许服务端中转实时音频。
- 是否提供实时用户转写文本事件。
- 是否提供 AI 回复文本事件。
- 是否提供流式 AI 音频事件。
- 是否支持打断或 barge-in。
- 输入输出音频格式、采样率、编码方式是什么。
- 是否需要企业认证、白名单、地域开通或专属并发申请。
- 计费口径是按音频时长、token、连接时长，还是混合计费。

在这些问题未确认前，豆包方案不适合作为本 Demo 默认主方案。

### 2.4 WebSocket 与 WebRTC 差异

| 维度       | WebSocket                           | WebRTC                          |
| -------- | ----------------------------------- | ------------------------------- |
| 传输特点     | 基于 TCP 的双向长连接，浏览器和服务端都容易实现。         | 面向实时音视频，媒体通常走 RTP/UDP，内置音频处理能力。 |
| 浏览器麦克风接入 | 需要前端采集音频、编码或转 PCM，再通过 WebSocket 发送。 | 浏览器原生支持 `getUserMedia` 和音频轨道传输。 |
| 延迟       | 可用于实时，但音频分片、Base64、TCP 队头阻塞可能增加延迟。  | 更适合低延迟语音；浏览器音频链路成熟。             |
| 调试复杂度    | 事件可见，方便打印日志和排查。                     | SDP、ICE、媒体轨道、DataChannel 调试更复杂。 |
| 后端代理     | 容易做后端代理，便于保护 API Key。               | 需要后端参与 SDP 交换，或发放短期令牌。          |
| Demo 适配  | 快速验证更简单。                            | 更接近真实通话体验。                      |

### 2.5 推荐主方案与备选方案

主方案：**Qwen-Omni-Realtime + 后端签名/代理 + 前端 WebRTC 或 WebSocket**

建议分两步：

1. 第一轮技术验证用 WebSocket：事件清楚，便于记录输入、转写、AI 文本、AI 音频、错误码和延迟。
2. 第二轮体验优化用 WebRTC：若 WebSocket 延迟或浏览器播放链路不理想，再切换到 WebRTC，以获得更接近通话的体验。

备选方案 A：**Qwen-Omni-Realtime WebSocket 全链路**

适合尽快跑通 Demo。前端把麦克风音频切成小片段，经后端代理发送给 Qwen WebSocket；后端把 AI 文本和音频事件转发给前端。

备选方案 B：**豆包端到端实时语音模型**

适合团队已有火山引擎资源或商务渠道。必须先拿到 API 文档和权限，并完成 1 天内的 POC 实测。若协议形态、延迟、文本事件、打断能力不满足 Demo，再回退到 Qwen。

## 3. 最小功能范围

本 Demo 只做以下功能：

| 功能      | 说明                             | 优先级 |
| ------- | ------------------------------ | --- |
| 开始对话    | 用户点击开始按钮，进入连接和授权流程。            | P0  |
| 麦克风授权   | 浏览器请求麦克风权限，失败时提示用户检查浏览器设置。     | P0  |
| 实时语音输入  | 采集用户麦克风音频，送入实时模型。              | P0  |
| 对话文本展示  | 展示用户转写文本和 AI 回复文本，区分临时转写和最终文本。 | P0  |
| AI 语音回复 | 播放模型返回的流式或分片音频。                | P0  |
| 通话计时    | 从连接成功或开始监听时计时，结束后停止。           | P0  |
| 结束对话    | 用户点击结束，关闭连接、停止麦克风、停止播放。        | P0  |
| 连接失败提示  | 显示连接失败、鉴权失败、模型错误、断连等状态。        | P0  |
| 简单调试日志  | 页面或控制台展示关键事件，便于开发排查。           | P0  |

明确不做：

- 不做评分。
- 不做纠错。
- 不做 CEFR 等级。
- 不做发音评测。
- 不做错题本。
- 不做登录。
- 不做会员。
- 不保存用户录音。
- 不做完整个人主页。
- 不做复杂学习报告。

## 4. 页面设计

页面只需要支持自由对话，不做复杂视觉设计。建议页面结构：

- 顶部：页面标题、连接状态、通话计时。
- 中部：对话消息列表。
- 底部：开始/结束按钮、麦克风状态、简单错误提示。
- 调试区：开发环境显示，可折叠，生产 Demo 可隐藏。

### 4.1 UI 状态

| 状态 | 页面表现 | 用户可做操作 |
| --- | --- | --- |
| 未开始 | 显示开始对话按钮，提示需要麦克风权限。 | 点击开始。 |
| 请求麦克风权限中 | 显示授权中/等待浏览器授权。 | 浏览器弹窗中允许或拒绝。 |
| 连接中 | 显示正在连接实时语音服务。 | 可取消或等待。 |
| 已连接但未说话 | 显示 AI 正在听，计时开始。 | 用户说话或结束通话。 |
| 用户说话中 | 显示麦克风动态状态，消息区展示临时转写。 | 继续说话。 |
| AI 思考/生成中 | 显示 AI 正在回复。 | 可等待；若支持打断，可直接开口。 |
| AI 播放中 | 播放 AI 语音，同时展示 AI 文本。 | 可结束；若支持打断，可开口打断。 |
| 连接失败 | 显示失败原因和重试入口。 | 重试或结束。 |
| 已结束 | 显示通话已结束和本次时长。 | 重新开始。 |

页面设计原则：

- 文案简单，不制造学习压力。
- 对话框必须可见，不能只有通话头像。
- AI 回复不要占满屏幕，用户应该能快速看到自己说了什么。
- 失败提示要可理解，例如“麦克风权限被拒绝”“实时语音服务连接失败”“服务繁忙，请稍后重试”。

## 5. 技术链路设计

### 5.1 整体链路

推荐整体链路：

```text
Browser
  - getUserMedia 获取麦克风
  - WebAudio / MediaStream 处理音频
  - WebSocket 或 WebRTC 连接本项目后端
  - 展示用户转写、AI 文本、连接状态、计时
  - 播放 AI 音频

        |
        | HTTPS / WebSocket / WebRTC signaling
        v

Demo Backend
  - 鉴权本项目自己的前端请求
  - 从环境变量读取供应商 API Key
  - 创建或代理 Realtime 会话
  - 转发音频输入
  - 转发模型文本和音频输出
  - 记录调试日志和错误码
  - 结束会话并释放资源

        |
        | Provider WebSocket / WebRTC / HTTP signaling
        v

Realtime Provider
  - Qwen-Omni-Realtime 或豆包端到端实时语音模型
  - 语音理解
  - 对话生成
  - 实时语音合成
  - 返回用户转写、AI 文本、AI 音频、错误事件
```

### 5.2 前端负责什么

前端负责：

- 请求麦克风权限。
- 获取用户音频流。
- 管理通话 UI 状态。
- 发送开始、结束、重试等用户操作。
- 将音频流发送到后端，或在后端授权后参与 WebRTC SDP 协商。
- 接收后端转发的用户转写文本、AI 回复文本、AI 音频或播放轨道。
- 播放 AI 音频。
- 显示通话计时、连接状态、失败提示和调试日志。
- 页面关闭、刷新、点击结束时主动清理连接和麦克风轨道。

前端不负责：

- 不保存用户录音。
- 不持有供应商 API Key。
- 不直接暴露供应商鉴权信息。
- 不做评分、纠错、等级判断。

### 5.3 后端负责什么

后端负责：

- 读取环境变量中的供应商配置。
- 保护供应商 API Key，不把 Key 返回给浏览器。
- 为每次通话创建会话 ID。
- 建立与供应商 Realtime 服务的连接，或完成 WebRTC SDP 交换。
- 转发前端音频到供应商。
- 转发供应商返回的文本、音频、状态、错误事件给前端。
- 记录调试日志：连接时间、首包延迟、断连原因、错误码、通话时长。
- 结束通话时关闭供应商连接，释放内存和网络资源。

后端不负责：

- 不保存用户录音文件。
- 不做用户体系。
- 不生成学习报告。
- 不做长期历史记录。

### 5.4 为什么 API Key 不能放在前端

供应商 API Key 不能放在前端，原因：

- 浏览器代码对用户可见，Key 会被任何人从 DevTools 或网络请求中拿到。
- Key 泄露后可能产生恶意调用和费用损失。
- 供应商限流、计费、权限通常绑定 Key，泄露会影响整个项目。
- 前端无法可靠限制调用频率和调用范围。

正确做法：

- API Key 只保存在后端环境变量中。
- 前端只连接本项目后端。
- 如使用 WebRTC 直连供应商，后端应生成短期会话或参与 SDP 交换，避免长期 Key 出现在浏览器。

### 5.5 如果供应商只支持 WebSocket

若供应商只支持 WebSocket，不支持 WebRTC，建议链路如下：

```text
Browser
  -> getUserMedia
  -> WebAudio 将麦克风音频转为供应商要求格式
  -> WebSocket 连接 Demo Backend
  -> 发送音频帧

Demo Backend
  -> 使用 API Key 连接供应商 WebSocket
  -> 转发音频帧
  -> 接收用户转写、AI 文本、AI 音频事件
  -> 转发给 Browser

Browser
  -> 展示文本
  -> 播放 AI 音频
```

关键设计点：

- 前端与后端之间也用 WebSocket，避免 HTTP 短轮询带来的延迟。
- 音频分片要小，建议 100 到 200 ms 一片，具体按供应商要求实测。
- 若供应商要求 PCM 16 kHz，前端需要重采样，或由后端进行重采样。
- 若供应商返回 Base64 PCM，前端需要解码并排队播放，避免爆音、断音和播放堆积。
- 后端要对单连接设置最大通话时长，避免异常连接持续计费。

## 6. 环境变量设计

不写真实 Key。建议环境变量：

```bash
# 供应商选择
REALTIME_PROVIDER=qwen

# 通用供应商配置
PROVIDER_API_KEY=replace_with_provider_api_key
PROVIDER_APP_ID=replace_with_app_or_workspace_id
PROVIDER_REGION=cn-beijing
REALTIME_MODEL_NAME=qwen3.5-omni-plus-realtime

# Qwen / DashScope 示例
DASHSCOPE_API_KEY=replace_with_dashscope_api_key
DASHSCOPE_WORKSPACE_ID=replace_with_workspace_id
DASHSCOPE_REALTIME_WS_URL=wss://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime
DASHSCOPE_REALTIME_WEBRTC_URL=https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime

# 语音参数
REALTIME_VOICE=Ethan
REALTIME_INPUT_AUDIO_FORMAT=pcm
REALTIME_INPUT_SAMPLE_RATE=16000
REALTIME_OUTPUT_AUDIO_FORMAT=pcm
REALTIME_OUTPUT_SAMPLE_RATE=24000

# Demo 限制
MAX_CALL_SECONDS=600
MAX_RECONNECT_ATTEMPTS=2
DEBUG_REALTIME_LOG=true
```

说明：

- `PROVIDER_API_KEY` 是抽象字段，方便未来切换豆包或其他供应商。
- Qwen 方案实际可使用 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_WORKSPACE_ID`。
- `REALTIME_MODEL_NAME` 不应写死在前端。
- 所有敏感变量只在后端读取。

## 7. Prompt 设计

### 7.1 自由对话系统提示词

建议系统提示词：

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

### 7.2 AI 开场示例

```text
Hi! Let's have a simple English chat. How was your day today?
```

或：

```text
Hi, I'm here to chat with you in English. What would you like to talk about today?
```

### 7.3 用户卡住时的轻量提示

AI 可以说：

```text
No rush. You can start with: "Today, I..."
```

```text
That's okay. Try one simple sentence first.
```

```text
You can say it in an easy way. For example: "I like it because..."
```

注意：这些提示不是纠错，也不是评分，只是帮助用户继续开口。

## 8. 日志与调试

### 8.1 需要记录的调试信息

只记录链路调试信息，不保存用户录音。

建议记录：

- `call_id`：本次通话 ID。
- `provider`：供应商名称，例如 qwen 或 doubao。
- `model`：模型名。
- `region`：地域。
- `connect_start_at`：开始连接时间。
- `connect_success_at`：连接成功时间。
- `mic_permission_result`：麦克风授权结果。
- `first_user_audio_at`：首个用户音频帧发送时间。
- `first_transcript_at`：首个用户转写文本返回时间。
- `first_ai_text_at`：首个 AI 文本返回时间。
- `first_ai_audio_at`：首个 AI 音频返回时间。
- `call_duration_seconds`：通话时长。
- `disconnect_reason`：断连原因。
- `provider_error_code`：供应商错误码。
- `client_error_code`：前端错误码。
- `reconnect_count`：重连次数。
- `audio_playback_error`：播放失败信息。

### 8.2 不记录的内容

不记录：

- 用户原始录音文件。
- 完整音频 Base64。
- 长期可回放音频。
- 用户敏感个人信息。

Demo 阶段可临时在浏览器中展示最近事件，但刷新页面后应消失。

### 8.3 调试面板建议

开发环境显示一个简单调试面板：

```text
status: connected
provider: qwen
model: qwen3.5-omni-plus-realtime
mic: granted
vad: semantic_vad
first_transcript_latency_ms: 620
first_ai_audio_latency_ms: 1450
last_event: response.audio.delta
last_error: none
```

## 9. 验收标准

至少满足以下标准：

1. 用户可以打开自由对话页面，并看到开始对话入口。
2. 用户点击开始后，浏览器可以弹出麦克风授权请求。
3. 用户允许麦克风后，系统可以连接实时语音服务。
4. 用户说英语后，对话框能展示用户语音转写文本。
5. AI 能返回英语文本回复，并显示在对话框中。
6. AI 能返回语音回复，前端可以播放声音。
7. AI 单次回复默认控制在 1 到 3 句，不进行评分、不纠错、不输出 CEFR。
8. 用户可以连续完成至少 3 轮语音对话。
9. 用户可以点击结束通话，麦克风采集停止，连接关闭，计时停止。
10. 麦克风权限被拒绝时，页面能给出明确提示。
11. 实时服务连接失败时，页面能给出明确提示，并允许重试。
12. 后端不会把供应商 API Key 返回给前端。
13. 系统不保存用户录音文件。
14. 调试日志能看到连接是否成功、首包延迟、断连原因、通话时长和错误码。
15. 刷新页面或关闭页面时，系统能释放麦克风和实时连接。

## 10. 风险与备选方案

| 风险 | 说明 | 应对策略 |
| --- | --- | --- |
| 国内服务权限申请风险 | Qwen、豆包等供应商可能需要开通地域、业务空间、白名单或企业认证。 | 优先选择公开文档完整的 Qwen 做 Demo；并行申请豆包权限；把供应商接入做成可替换适配层。 |
| 豆包 API 不明确风险 | 当前未找到同等公开的豆包端到端实时语音 API 文档。 | 不把豆包作为默认主方案；拿到文档后先做 1 天 POC，验证协议、转写、音频输出、打断、延迟和计费。 |
| WebSocket / WebRTC 调试风险 | WebRTC 低延迟但调试复杂；WebSocket 好调试但音频播放和延迟需要处理。 | 第一阶段用 WebSocket 跑通事件；第二阶段再切 WebRTC 优化体验。保留两种接入的抽象接口。 |
| 浏览器麦克风权限风险 | 用户可能拒绝授权，或浏览器安全策略限制非 HTTPS 页面使用麦克风。 | 本地开发使用 localhost；线上 Demo 必须 HTTPS；权限失败时给出浏览器设置提示。 |
| 延迟过高风险 | 音频采集、重采样、网络、模型首包、前端播放队列都可能增加延迟。 | 记录首包延迟；减小音频分片；优先北京地域；减少后端处理；必要时切 WebRTC。 |
| 英语识别效果不稳定风险 | 学习者口音、噪声、停顿、低音量可能影响识别。 | 使用服务端 VAD 或语义 VAD；前端提示用户靠近麦克风；记录转写延迟和空转写比例；需要实测不同口音。 |
| AI 回复过长风险 | 通用模型可能讲太多，破坏口语陪练体验。 | 系统提示词强约束 1 到 3 句；后端可设置最大输出时长或截断策略；验收时检查回复长度。 |
| 打断能力不稳定风险 | 用户在 AI 播放时开口，模型或前端可能无法及时停止播放。 | 第一版可先实现前端停止播放；供应商支持 barge-in 时再接入真实语义打断；能力标注需要实测。 |
| 音频播放异常风险 | PCM 流播放可能出现爆音、断音、堆积或采样率不匹配。 | 明确输入输出采样率；前端建立播放队列；记录播放错误；必要时后端转码为浏览器更易播放格式。 |
| 成本风险 | Realtime 连接可能按时长、音频、token 或并发计费。 | 设置最大通话时长；开发环境限制并发；记录每次通话时长；上线前确认计费规则。 |
| 供应商切换风险 | 不同供应商事件格式不同，直接写死会导致切换成本高。 | 后端定义统一事件：`user_transcript_delta`、`user_transcript_final`、`ai_text_delta`、`ai_audio_delta`、`error`、`closed`。 |

## 11. 后续开发拆分建议

虽然本期不写代码，但后续可按以下顺序开发：

1. 搭建最小前端页面：开始、结束、计时、消息列表、调试面板。
2. 搭建后端 Realtime 会话接口：创建会话、关闭会话、错误转发。
3. 接入 Qwen-Omni-Realtime WebSocket，跑通音频输入和文本输出。
4. 接入 AI 音频播放。
5. 补齐麦克风权限、断连、重试、通话结束清理。
6. 实测首包延迟、连续 3 到 5 分钟通话、不同浏览器兼容性。
7. 若 WebSocket 体验不足，再评估 WebRTC 接入。
8. 若豆包权限到位，按相同事件抽象做供应商适配实测。

## 12. 参考资料

- 阿里云百炼 Qwen-Omni-Realtime 文档：https://help.aliyun.com/zh/model-studio/realtime
- 阿里云百炼 Qwen-Omni 文档：https://help.aliyun.com/zh/model-studio/qwen-omni
- Qwen2.5-Omni GitHub：https://github.com/QwenLM/Qwen2.5-Omni
- Qwen2.5-Omni 技术报告：https://arxiv.org/abs/2503.20215
- WebRTC 背景说明：https://zh.wikipedia.org/wiki/WebRTC
- WebSocket 背景说明：https://zh.wikipedia.org/wiki/WebSocket

