# UniSpeaking SDK 产品架构设计书

版本：v1.0  
日期：2026-07-10  
范围：UniSpeaking 第一阶段 SDK 接入版与 Web Realtime 自由对话 Demo  
状态：新建正式架构设计书，保留 `SDK产品架构.md` 作为 v1.1 历史资料

## 0. 依据与目标

### 0.1 设计依据

- 最新产品设计书：`tools/build_unispeaking_final_docx.py` 中的“UniSpeaking 产品计划书｜最终版”。
- 自由对话模型 Demo：`milestone1/Week1/Fri./UniSpeaking` 当前 WebRTC + Python 后端实现。
- 历史架构资料：`milestone1/Week1/Fri./UniSpeaking/SDK产品架构.md`。
- 架构规范：GitHub Wiki《02 架构设计规范》，核心要求是总架构先行、代码即架构、模块边界与真实接口清晰、风险前置、演进可追踪。

### 0.2 本文目标

本文不是技术栈清单，而是 SDK 产品架构说明。它要回答：

1. UniSpeaking 第一阶段如何通过 SDK 方式跑通自由口语对话主干。
2. 浏览器、后端代理、Realtime 模型、学习数据和观测数据之间如何协作。
3. 哪些接口、对象和模块是当前真实存在的契约，哪些是后续扩展点。
4. 哪些产品风险必须在架构层提前处理，不能只依赖 Prompt 或人工约定。
5. 后续场景广场、个人主页、专业训练和平台化能力如何在现有主干上叠加。

## 1. 架构定位

UniSpeaking 第一阶段采用“前端业务 SDK + 后端 SDK/代理 + 端到端 Speech-to-Speech Realtime API”的架构。

产品第一入口是自由对话，而不是完整课程平台。用户打开页面后应尽快进入类似电话通话的英语练习状态：AI 主动开场，用户自然说话，AI 以短回复和追问推动对话，系统根据多轮表现调整难度，并记录最小必要的学习者画像和体验指标。

当前架构主干如下：

```text
Browser Demo / Future Web SDK
  - microphone capture
  - WebRTC peer connection
  - realtime event handling
  - call-state UI
  - tool-call bridge
  - latency and quality collection
        |
        | HTTPS: session, SDP proxy, events, tools, metrics
        v
Python Backend SDK / Proxy
  - API key isolation
  - session lifecycle
  - prompt and policy injection
  - Realtime session config
  - learner profile persistence
  - tool-call validation
  - latency report writing
        |
        | WebRTC SDP exchange with server-side credentials
        v
Bailian Realtime API
  - ASR
  - LLM conversation
  - TTS
  - server VAD
  - function calling
        |
        v
Data and Observability
  - in-memory SessionState
  - JSON learner profile
  - Markdown latency report
```

这条主干的架构原则是：

- 前端不直接持有供应商 API Key。
- 前端不裸用底层模型接口，而是通过业务语义的 SDK/代理进入会话。
- 后端统一生成 Realtime 配置、Prompt、工具定义和策略约束。
- 模型可以建议难度调整，但最终写入必须经过后端校验。
- 自由对话不默认评分、不生成学习报告、不进入考试模式。
- 当前数据存储服务于 Demo 验证，生产化时替换为 Redis、PostgreSQL、对象存储和监控平台。

## 2. 需求梳理

### 2.1 产品需求到架构要求

| 产品要求 | 架构要求 |
| --- | --- |
| 用户 10 秒内知道如何开始 | 前端 SDK 暴露简单的 `startSession` 主流程，隐藏 WebRTC 与 Realtime 细节 |
| 自由对话是 P0 入口 | 架构主干优先服务 FreeTalk，不让场景、评分、报告阻塞第一阶段 |
| 端到端实时语音 | 使用 WebRTC + Realtime S2S，避免 ASR、LLM、TTS 串行管线带来的额外延迟 |
| 低压力、不评分 | Prompt 约束 + 后端策略层共同限制评分/报告类越界 |
| 难度动态适配 | 定义学习者等级画像，模型工具调用必须经后端多轮证据校验 |
| 可持续迭代 | SDK 边界先固定，会话、事件、工具、指标、模型接入独立演进 |
| 后续场景训练 | 预留 Scenario Service，将场景目标注入 lesson focus，而不是改动实时语音底座 |
| 后续个人主页 | 预留学习记录、反馈记录、错题本、复练入口的数据模型 |
| 后续平台化 | 预留 Model Adapter 与 C++ core / 动态库边界 |

### 2.2 本期范围

本期真实主干：

- 创建自由对话会话。
- 建立浏览器到 Realtime API 的 WebRTC 连接。
- AI 通过音频为主、文本为辅进行实时回复。
- 记录用户和 AI 的最终转写事件。
- 基于多轮证据调整学习者等级。
- 记录延迟和通话质量指标。
- 关闭会话并清理内存状态。

本期明确不做：

- 不建设完整课程平台。
- 不在自由对话中默认评分、评级或生成长报告。
- 不保存长期对话总结。
- 不实现完整账户、订阅、支付和权限体系。
- 不把 C++ core 作为第一阶段交付，但保留边界。

## 3. 技术风险与架构处理

| 风险 | 影响 | 当前处理 | 后续架构要求 |
| --- | --- | --- | --- |
| API Key 泄露 | 供应商凭证暴露，成本和安全风险高 | 后端代理 SDP，前端不接触 `DASHSCOPE_API_KEY` | 生产环境接入密钥管理、审计和限流 |
| 自由对话滑向评分/报告 | 破坏低压力定位 | Prompt 要求不评分 | 后端策略层增加评分/报告请求识别和拒绝模板 |
| 等级误判 | 学习者画像被单轮异常输入污染 | 至少三轮 learner turn，单次最多一级 | 增加多维能力画像和可解释证据字段 |
| 长期记忆误写 | 隐私风险和错误记忆风险 | 只保存等级画像，不保存长期总结 | 只保存结构化、可撤销、可解释字段 |
| VAD 抢话 | AI 打断用户犹豫，降低开口意愿 | `server_vad` + 800 ms 静音判定 + Prompt 等待犹豫 | 结合真实测试调参，引入客户端音频活动状态 |
| 延迟不稳定 | 对话不自然，MVP 失败 | 前端采集延迟并写入报告 | 自动化压测、P50/P95 指标、供应商降级策略 |
| 多实例状态不一致 | 内存 session 与 JSON 文件无法水平扩展 | Demo 单实例运行 | Redis 保存实时 session，PostgreSQL 保存用户和记录 |
| 供应商锁定 | 后续成本和能力受限 | 当前接百炼 Realtime | 抽象 Model Adapter，支持其他实时模型和管线式备用方案 |
| C++ 过早工程化 | 提前复杂化，拖慢验证 | 当前不下沉 core | 先稳定 TypeScript/Python 状态机，再下沉音频/VAD/轮次逻辑 |

## 4. 模块拆分

### 4.1 前端 SDK / Browser Demo

当前载体：`webrtc_demo.html`。后续可抽象为 `@unispeaking/web-sdk`。

职责：

- 申请麦克风权限并管理媒体轨道。
- 创建 `RTCPeerConnection` 和 DataChannel。
- 调用后端创建 session、交换 SDP、上报事件和指标。
- 维护通话状态：Ready、Connecting、Connected、Ended、Error。
- 接收 Realtime 事件，归一化用户转写、AI 转写、工具调用和错误事件。
- 将模型工具调用转成后端 API 请求。
- 采集 ASR 延迟、首包音频延迟、打断停止时间、WebRTC stats。

前端 SDK 不负责：

- 保存供应商密钥。
- 直接决定学习者长期等级。
- 生成最终 Prompt 或工具安全策略。
- 在自由对话中生成评分报告。

### 4.2 后端 SDK / Proxy

当前载体：`backend/app.py` 与 `backend/business_logic.py`。

职责：

- 创建和关闭本地会话。
- 读取和写入学习者等级画像。
- 生成 Realtime `session.update` 配置。
- 拼接英语陪练 Prompt、等级策略和 lesson focus。
- 代理 SDP 到百炼 Realtime API。
- 校验模型工具调用并决定是否写入画像。
- 保存会话内最终转写事件。
- 记录延迟和通话质量数据。
- 提供健康检查和开发态画像检查接口。

后端 SDK 不负责：

- 直接播放音频或渲染 UI。
- 在 Demo 阶段保存长期对话总结。
- 在自由对话中产出正式评分。
- 直接实现完整场景广场、个人主页和订阅体系。

### 4.3 Model Adapter

当前实现直接接入百炼 Realtime：

- 模型：`qwen3.5-omni-plus-realtime`，可由 `BAILIAN_MODEL` 覆盖。
- ASR：`qwen3-asr-flash-realtime`。
- 音色：`Tina`。
- 输出模态：`text` + `audio`。
- Turn detection：`server_vad`。

后续应抽象 Model Adapter：

```text
RealtimeModelAdapter
  - createRealtimeConfig(session)
  - exchangeSdp(offerSdp, session)
  - normalizeModelEvent(rawEvent)
  - defineTools(session)
  - mapToolResult(toolResult)
```

抽象后可支持百炼、豆包、OpenAI Realtime 或 ASR -> LLM -> TTS 备用管线。

### 4.4 Learning Policy Layer

当前实现位于 `RealtimeBusinessLogic`：

- 英语陪练系统 Prompt。
- 学习者等级说明。
- 回复长度、追问、卡壳帮助、低压力纠错规则。
- `update_learner_level` 工具定义。
- Realtime 事件归一化。

后续应把策略层从具体模型配置中拆出，形成可测试的业务策略模块：

- FreeTalk policy：短回复、不评分、不报告、主动追问。
- Scenario policy：角色、任务目标、lesson focus、完成条件。
- Report policy：只在场景训练或专业训练中启用。
- Safety policy：评分/评级/报告越界拦截、Prompt 注入防护。

### 4.5 Data and Observability

当前 Demo 数据：

- `SessionState`：后端进程内内存对象。
- `data/conversations.json`：学习者等级画像。
- `data/latency_report.md`：延迟与通话质量报告。

生产化替换：

- Redis：实时 session、短期状态、幂等事件缓存。
- PostgreSQL：用户、练习记录、场景、报告、订阅、结构化画像。
- Object Storage：必要音频片段、报告附件、测试样本。
- Observability：延迟、错误率、连接质量、模型调用成本、工具调用成功率。

## 5. SDK 接口契约

### 5.1 HTTP API

| 接口 | 当前状态 | 请求/输入 | 响应/输出 | 说明 |
| --- | --- | --- | --- | --- |
| `GET /health` | 已实现 | 无 | `status`、`api_key_configured`、`workspace_configured` | 服务与配置检查 |
| `POST /api/sessions` | 已实现 | `prompt?`、`conversation_id?` | `session_id`、`conversation_id`、`learner_profile`、`session_config` | 创建自由对话会话 |
| `GET /api/sessions/{id}/config` | 已实现 | `session_id` | `session_config` | 获取当前 Realtime 配置 |
| `POST /api/realtime?session_id=...` | 已实现 | SDP offer body | SDP answer body | 后端携密钥代理 Realtime SDP |
| `POST /api/sessions/{id}/events` | 已实现 | Realtime event | `stored`、`message`、`session_message_count` | 保存最终用户/AI 转写 |
| `POST /api/sessions/{id}/tools/learner-level` | 已实现 | `arguments.requested_level`、`arguments.reason` | `applied`、`learner_profile` | 校验并保存等级调整 |
| `POST /api/sessions/{id}/latency` | 已实现 | `LatencyMetric` | `recorded` | 记录单轮延迟 |
| `POST /api/sessions/{id}/quality` | 已实现 | `SessionQualityMetric` | `recorded` | 记录通话质量 |
| `GET /api/sessions/{id}/profile` | 已实现 | `session_id` | 当前消息缓存与等级 | 开发态检查接口 |
| `GET /api/latency-report` | 已实现 | 无 | Markdown | 读取性能报告 |
| `DELETE /api/sessions/{id}` | 已实现 | `session_id` | `closed` | 关闭内存会话 |
| `DELETE /api/conversations/{id}` | 已实现 | `conversation_id` | 204 | 清除某个 conversation 的画像 |

### 5.2 前端 SDK 建议接口

```ts
type UniSpeakingClient = {
  startSession(input?: StartSessionInput): Promise<SessionHandle>;
  endSession(sessionId: string): Promise<void>;
  resetConversation(conversationId: string): Promise<void>;
};

type SessionHandle = {
  sessionId: string;
  conversationId: string;
  learnerProfile: LearnerProfile;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onEvent(handler: (event: ConversationEvent) => void): void;
  onError(handler: (error: SDKError) => void): void;
};
```

第一阶段可以继续由 `webrtc_demo.html` 承载这些职责；进入 SDK 化时，应把会话生命周期和事件处理从页面 UI 中拆出。

### 5.3 服务端 SDK 建议接口

```py
class UniSpeakingBackendSDK:
    def create_session(self, prompt: str, conversation_id: str | None) -> SessionState: ...
    def build_session_config(self, session: SessionState) -> dict: ...
    def exchange_realtime_sdp(self, session_id: str, offer_sdp: bytes) -> bytes: ...
    def remember_event(self, session_id: str, event: dict) -> dict | None: ...
    def apply_learner_level_tool(self, session_id: str, arguments: dict) -> dict: ...
    def record_latency(self, session_id: str, metric: dict) -> None: ...
    def record_quality(self, session_id: str, metric: dict) -> None: ...
    def close_session(self, session_id: str) -> None: ...
```

## 6. 核心对象与数据模型

### 6.1 SessionState

当前代码中的会话内存态：

```text
SessionState
- session_id: string
- conversation_id: string
- user_prompt: string
- learner_level: 1-6
- learner_level_label: string
- learner_turns_since_review: integer
- created_at: ISO datetime
- turn_messages: bounded queue<ConversationMessage>
```

约束：

- 仅存在于当前后端进程。
- 用于自由对话单次通话状态。
- 不承担长期学习记录职责。

### 6.2 LearnerProfile

```text
LearnerProfile
- level: 1-6
- label: Starter / Basic / Intermediate / CET-4 / CET-6 / Advanced
- last_reason: string
- updated_at: ISO datetime | null
```

约束：

- 默认等级为 4，即 CET-4。
- 等级调整只能在至少三轮 learner turn 后发生。
- 每次调整最多上升或下降一级。
- 必须提供基于多轮证据的 `reason`。

### 6.3 RealtimeSessionConfig

```text
RealtimeSessionConfig
- voice: Tina
- input_audio_format: pcm
- output_audio_format: pcm
- input_audio_transcription.model: qwen3-asr-flash-realtime
- instructions: string
- modalities: [text, audio]
- max_tokens: 128
- temperature: 0.7
- turn_detection.type: server_vad
- turn_detection.prefix_padding_ms: 500
- turn_detection.silence_duration_ms: 800 by default
- turn_detection.threshold: 0.5
- tools: update_learner_level
```

约束：

- 由后端生成，不由前端拼接。
- `instructions` 必须包含自由对话策略、学习者等级和可选 lesson focus。
- `tools` 只定义模型可请求的工具，最终执行仍由后端决定。

### 6.4 ConversationEvent

当前后端保存的事件来自 Realtime 最终转写：

```text
ConversationEvent
- role: user | assistant
- text: string
- timestamp: ISO datetime
- source_id: string
```

当前支持的原始事件：

- `conversation.item.input_audio_transcription.completed` -> user。
- `response.audio_transcript.done` -> assistant。
- `response.text.done` -> assistant。

约束：

- 只保存最终文本，不保存 partial。
- 同一 `source_id` 与 `role` 去重。
- 文本最长保存 8000 字符。
- 当前只在 session 内缓存，不写入长期对话记忆。

### 6.5 LearnerLevelToolCall

```text
LearnerLevelToolCall
- name: update_learner_level
- arguments.requested_level: integer 1-6
- arguments.reason: string
```

执行规则：

- `requested_level` 必须为 1-6。
- `reason` 必填。
- 当前 session 少于三轮 learner turn 时不执行。
- 请求等级会被限制在当前等级上下一级。
- 执行后 `learner_turns_since_review` 清零。

### 6.6 LatencyMetric

```text
LatencyMetric
- speech_start_to_first_transcript
- speech_end_to_first_ai_audio
- interruption_to_audible_silence
- speech_end_to_first_ai_text
```

指标目标：

- 用户停止说话后 AI 首句语音开始：P50 <= 1.5s。
- 用户打断后 AI 停止播报：<= 300ms。
- 指标由前端测量，后端追加到 Markdown 报告。

### 6.7 SessionQualityMetric

```text
SessionQualityMetric
- duration_minutes
- packet_loss
- max_jitter
- avg_rtt
- disruptions
```

通话通过标准：

- 3-10 分钟内无明显卡顿。
- packet loss <= 3%。
- max jitter <= 100 ms。
- avg RTT <= 500 ms。
- 无连接中断。

## 7. 主干流程

### 7.1 创建会话

```text
User clicks Start
  -> Browser calls POST /api/sessions
  -> Backend validates prompt and conversation_id
  -> Backend loads or creates LearnerProfile
  -> Backend creates SessionState
  -> Backend returns session_id, conversation_id, learner_profile, session_config
```

架构要求：

- `conversation_id` 可复用，用于跨会话保留等级画像。
- 没有 `conversation_id` 时后端生成新 ID。
- `session_config` 必须由后端生成，确保策略一致。

### 7.2 建立 Realtime WebRTC 连接

```text
Browser getUserMedia
  -> Browser creates RTCPeerConnection and DataChannel
  -> Browser creates offer SDP
  -> Browser POST /api/realtime?session_id=...
  -> Backend validates session and server credentials
  -> Backend forwards offer SDP to Bailian Realtime
  -> Backend returns answer SDP
  -> Browser sets remote description
  -> Audio/DataChannel session connected
```

架构要求：

- SDP body 最大 1 MB。
- 上游请求超时当前为 15 秒。
- 后端校验 `BAILIAN_WORKSPACE_ID` 格式。
- 返回头包含 `Cache-Control: no-store`。

### 7.3 对话运行

```text
Learner speaks
  -> Realtime ASR produces transcript
  -> Model responds under FreeTalk policy
  -> Browser plays remote audio
  -> Browser receives transcript and events
  -> Browser POST final events to backend
  -> Backend deduplicates and stores session turn messages
```

架构要求：

- 音频是主体验，文本是辅助能力。
- AI 回复应短、可听、自然，不输出 Markdown。
- 用户卡壳时优先降压和提示，不抢话。

### 7.4 工具调用与等级更新

```text
Model calls update_learner_level
  -> Browser receives tool call event
  -> Browser POST /api/sessions/{id}/tools/learner-level
  -> Backend validates requested_level and reason
  -> Backend checks learner turns >= 3
  -> Backend bounds update to one level
  -> Backend writes learner profile
  -> Browser sends tool result back to Realtime
```

架构要求：

- 模型只能建议，不能直接写画像。
- 后端必须返回是否实际应用、是否被限制、当前画像。
- 未达到三轮证据时，应明确返回剩余轮数。

### 7.5 记录指标与关闭会话

```text
During call
  -> Browser POST latency metrics

End call
  -> Browser collects WebRTC stats
  -> Browser POST quality metric
  -> Browser DELETE /api/sessions/{id}
  -> Backend removes SessionState
```

架构要求：

- 关闭会话不写长期总结。
- 质量指标与延迟指标用于判断 MVP 是否成立。

## 8. 空骨架与 SDK 化落地建议

按照“代码即架构”的规范，后续正式 SDK 化时应先搭空骨架，而不是直接堆完整实现。

### 8.1 前端 SDK 空骨架

建议模块：

```text
web-sdk/
  client.ts
  session.ts
  realtime-connection.ts
  event-normalizer.ts
  tool-bridge.ts
  metrics.ts
  types.ts
```

骨架要求：

- `client.ts` 暴露业务语义 API。
- `realtime-connection.ts` 封装 WebRTC 和 SDP 交换。
- `event-normalizer.ts` 固定 Realtime 原始事件到业务事件的映射。
- `tool-bridge.ts` 只负责转发工具请求，不在前端做最终业务决策。
- `metrics.ts` 统一延迟和质量指标采集。
- `types.ts` 固定会话、画像、事件和指标类型。

### 8.2 后端 SDK 空骨架

建议模块：

```text
backend/
  app.py
  sdk/
    session_service.py
    realtime_adapter.py
    policy_service.py
    learner_profile_store.py
    tool_service.py
    metrics_service.py
    types.py
```

骨架要求：

- `session_service.py` 管会话生命周期。
- `realtime_adapter.py` 管供应商接入和 SDP 交换。
- `policy_service.py` 管 Prompt、lesson focus、自由对话边界。
- `learner_profile_store.py` 管画像读写。
- `tool_service.py` 管工具调用校验。
- `metrics_service.py` 管延迟与质量数据。
- `types.py` 固定跨模块数据结构。

## 9. 后续演进

### 9.1 M1：自由对话 SDK 主干稳定

目标：

- Web Demo 跑通自由语音对话。
- 会话、Realtime、事件、工具、指标契约稳定。
- 延迟和稳定性有可复测数据。
- Prompt 与后端策略共同守住低压力边界。

验收：

- 用户可完成 3-10 分钟自由对话。
- AI 回复短、自然、可持续追问。
- API Key 不出现在前端。
- 等级更新遵守三轮证据与单级限制。
- 延迟、打断、质量指标可查看。

### 9.2 M2：场景广场与个人主页

新增模块：

- Scenario Service：生成场景、角色、任务、词汇、短句和 lesson focus。
- Scenario Progress：记录“学-读-说”完成状态。
- Learning Record：记录历史练习、场景、基础反馈和复练入口。
- Error Book：保存用户主动进入场景训练后的可复练表达。

架构原则：

- 场景训练复用自由对话实时语音底座。
- 场景目标通过 lesson focus 和 policy 注入，不重写底层连接。
- 评分只出现在场景训练或专业训练，不进入自由对话默认流程。

### 9.3 M3：跟读评分与学习报告

新增模块：

- Pronunciation Scoring Service。
- Scenario Report Service。
- Review Recommendation。
- Structured Feedback Store。

架构原则：

- 普通场景使用通用反馈维度。
- IELTS、TOEFL、面试等专业场景使用独立评分标准。
- 报告生成必须由显式训练模式触发。

### 9.4 M4：账户、订阅和生产化

新增模块：

- Auth。
- Subscription。
- Quota Guard。
- Database。
- Object Storage。
- Observability。

架构原则：

- 免费自由对话可作为拉新入口。
- 付费能力主要承接专业场景、深度报告和高频额度。
- 商业化不应破坏首屏快速开口路径。

### 9.5 平台化与 C++ core

适合后续下沉到 C++ core / 动态库的能力：

- 音频缓冲。
- 音频活动检测。
- VAD 状态机。
- 打断状态机。
- 轮次状态机。
- 跨平台音频接口抽象。

不适合下沉的能力：

- Prompt 文案。
- 页面 UI。
- 账户、订阅、支付。
- 场景内容生成。
- 学习报告展示。

推荐节奏：

```text
M1: Web + Python + Realtime SDK 跑通自由对话
M2: 抽象 TypeScript/Python 会话状态机和模型接入接口
M3: 将稳定的音频/VAD/打断/轮次状态机下沉为 C++ core
M4: 通过动态库/FFI 供 Web 后端、桌面端、移动端复用
```

## 10. 架构演进记录

| 版本 | 时间 | 变化 | 原因 |
| --- | --- | --- | --- |
| app_architecture_v1 | 2026-07-07 | 初步描述 App 架构、模块和技术路线 | 产品方向仍在探索 |
| 产品计划书最终版 | 2026-07-10 | 明确自由对话 P0、场景广场 P1、个人主页 P1、专业场景 P2 | 根据导师会议补齐产品主干和平台化要求 |
| SDK产品架构 v1.1 | 2026-07-10 | 描述 Web Realtime Demo、接口、指标和演进方向 | 对齐当前 FreeTalk demo |
| 本文 v1.0 | 2026-07-10 | 新建正式 SDK 产品架构设计书，补齐 SDK 边界、接口契约、数据模型、风险和演进记录 | 满足架构规范中“总架构先行、代码即架构、主干串联”的要求 |

后续每个 Milestone 复盘时，应继续记录：

- 架构变更了什么。
- 为什么变更。
- 是否推翻主干。
- 是否提升交付能力。

## 11. 验收标准

本文对应的架构过线标准：

1. 主干清晰：浏览器 SDK、后端代理、Realtime 模型、数据与观测层职责明确。
2. 接口真实：文档中的 HTTP API 与当前 `backend/app.py` 保持一致。
3. 类型明确：会话、画像、配置、事件、工具、指标都有数据模型。
4. 风险前置：评分/报告越界、等级误判、密钥泄露、状态不一致、VAD 抢话、供应商锁定都有架构处理。
5. 可搭骨架：后续工程可以据此前后端 SDK 空骨架并行开发。
6. 可演进：场景广场、个人主页、报告、账户、订阅、C++ core 都能在主干上叠加，不需要推翻实时语音底座。
7. 可验证：延迟、打断、稳定性、用户有效开口、工具调用成功率都有可记录指标。

## 12. 结论

UniSpeaking 第一阶段 SDK 架构的核心，是先把“低压力实时英语自由对话”这条主链路用真实接口和数据模型固定下来。

当前 WebRTC Demo 已经证明浏览器、Python 后端和百炼 Realtime API 可以串联端到端 Speech-to-Speech 语音对话。接下来架构上最重要的不是扩大功能面，而是把会话生命周期、Realtime 接入、事件归一化、策略注入、工具校验和指标采集抽象成 SDK 边界。

只要这条主干稳定，后续场景广场、个人主页、评分报告、商业化和跨平台核心都可以在其上逐步叠加；反之，如果在 SDK 边界尚未固定前直接堆功能，架构会在编码过程中被动成型，难以支撑后续 Milestone。
