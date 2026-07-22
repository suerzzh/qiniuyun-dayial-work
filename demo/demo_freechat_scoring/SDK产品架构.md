# UniSpeaking SDK 接入版产品架构

版本：v1.1  
范围：AI 英语口语陪练 Web Realtime Demo  
日期：2026-07-10

依据：

- 产品设计终稿：`tools/build_unispeaking_final_docx.py` 中的“UniSpeaking 产品计划书｜最终版”内容。
- GitHub 最新代码：`fj-sunny/UniSpeaking`，`origin/main` 最新提交 `c07b99c Add FreeTalk realtime chat module`。
- 当前本地代码与 `origin/main` 已对齐；本地额外存在本架构文档与测试报告改动。

## 1. 架构定位

UniSpeaking 当前阶段采用“Web 端通话式体验 + Python 后端 SDK/代理 + 端到端 Speech-to-Speech Realtime API”的产品架构，优先验证自由口语对话主链路。

本架构不把产品一次性做成完整课程平台，而是先把“用户能低压力开口、AI 能实时承接、系统能根据表现调节难度、3-10 分钟稳定对话”这条闭环跑通。后续场景训练、跟读评分、学习报告和商业化能力都围绕这条实时语音底座扩展。

最新方法判断：

- 第一阶段优先用 Web 端 Demo，而不是直接做移动端。
- 实时语音优先采用端到端 S2S SDK/Realtime 方案，而不是前端录音上传、ASR、LLM、TTS 串行管线。
- 产品第一入口应更接近“电话式自由对话”，文本和字幕是辅助能力，不应把体验设计成重文字聊天。
- 后端必须保留密钥、会话配置、策略注入和工具调用校验权，避免把供应商 SDK Key 与产品策略暴露到前端。
- 架构上预留平台化能力：模型接入层、策略复用层、场景生成层、学习数据层和跨平台核心内核。

当前 Demo 的核心职责划分如下：

- 浏览器负责麦克风采集、WebRTC 连接、AI 音频播放、通话状态、可选字幕和会话 UI。
- Python 后端负责密钥保护、会话创建、Realtime 会话配置生成、SDP 代理、学习者等级持久化和性能数据记录。
- 实时大模型负责 ASR、对话生成、TTS、VAD 轮次管理和工具调用。
- 本地 JSON 与 Markdown 文件负责 Demo 阶段的轻量数据沉淀。

## 2. 产品能力分层

```text
┌──────────────────────────────────────────────┐
│ 产品体验层                                    │
│ 通话式自由对话、AI 语音回复、按需字幕、等级展示 │
├──────────────────────────────────────────────┤
│ 学习策略层                                    │
│ 英语陪练 Prompt、难度适配、短回复、轻纠错、追问 │
├──────────────────────────────────────────────┤
│ 实时会话层                                    │
│ WebRTC、Server VAD、ASR、LLM、TTS、工具调用     │
├──────────────────────────────────────────────┤
│ 后端代理层                                    │
│ Session API、SDP Proxy、CORS、密钥隔离、事件归档 │
├──────────────────────────────────────────────┤
│ 数据与观测层                                  │
│ 学习者等级、会话事件缓存、延迟报告、质量指标    │
├──────────────────────────────────────────────┤
│ 平台化预留层                                  │
│ 模型接入、策略复用、场景生成、C++/动态库内核边界 │
└──────────────────────────────────────────────┘
```

## 3. 当前技术架构

```text
┌──────────────────────┐
│ Browser Frontend      │
│ webrtc_demo.html      │
│                      │
│ - getUserMedia        │
│ - RTCPeerConnection   │
│ - DataChannel events  │
│ - Call-state UI        │
│ - Optional transcript  │
│ - Latency measurement │
└──────────┬───────────┘
           │ 1. POST /api/sessions
           │ 2. POST /api/realtime?session_id=...
           │ 3. POST events / latency / quality
           ▼
┌──────────────────────┐
│ Python Backend        │
│ aiohttp               │
│                      │
│ - Session manager     │
│ - Prompt composer     │
│ - SDP proxy           │
│ - Tool validation     │
│ - Profile store       │
│ - Latency reporter    │
│ - Policy injection     │
└──────────┬───────────┘
           │ SDP exchange with API key
           ▼
┌──────────────────────┐
│ Bailian Realtime API  │
│ qwen3.5-omni realtime │
│                      │
│ - ASR                 │
│ - LLM conversation    │
│ - TTS                 │
│ - Server VAD          │
│ - Function calling    │
└──────────────────────┘
```

## 4. 核心会话流程

### 4.0 产品入口

产品终稿要求第一阶段把“自由对话”作为 P0 入口。用户打开 Web 页面后应尽快进入类似电话通话的练习状态：

1. 用户 10 秒内知道如何开始。
2. AI 主动开场并选择简单话题。
3. 用户不需要先选课、测评或填写复杂资料。
4. 对话结束后不弹评分页，只记录基础练习数据。
5. 文本、中文翻译、重新朗读等能力作为辅助展开，不作为主体验。

### 4.1 创建会话

1. 用户点击 `Start Session`，进入自由对话会话。
2. 浏览器调用 `POST /api/sessions`，传入可选的 `conversation_id` 和 lesson focus。
3. 后端校验参数，创建内存态 `SessionState`。
4. 后端从 `data/conversations.json` 读取或初始化学习者等级。
5. 后端返回 `session_id`、`conversation_id`、`learner_profile` 和 `session_config`。

### 4.2 建立实时连接

1. 浏览器通过 `getUserMedia` 获取麦克风，可选获取摄像头。
2. 浏览器创建 `RTCPeerConnection` 和 DataChannel。
3. 浏览器生成 WebRTC offer SDP。
4. 浏览器调用 `POST /api/realtime?session_id=...`，把 SDP 发给后端。
5. 后端携带 `DASHSCOPE_API_KEY` 和 `BAILIAN_WORKSPACE_ID` 转发到百炼 Realtime API。
6. Realtime API 返回 answer SDP，后端原样返回浏览器。
7. 浏览器设置 remote description，实时音频链路建立。

### 4.3 对话运行

1. 用户说话，音频通过 WebRTC 发送到 Realtime API。
2. Realtime API 进行服务端 VAD 与实时 ASR。
3. 模型基于系统 Prompt、学习者等级和当前上下文生成回复。
4. 回复以音频和文本 transcript 两种形式回到浏览器。
5. 浏览器优先播放 AI 音频；字幕用于调试和辅助理解，正式产品中应按需展开。
6. 浏览器把最终用户转写与 AI 转写通过 `POST /api/sessions/{id}/events` 写回后端当前 session。

### 4.4 难度自适应

1. 系统 Prompt 要求模型至少观察三轮用户表达后再判断难度变化。
2. 当模型认为需要调整等级时，调用 `update_learner_level` 工具。
3. 浏览器收到工具调用事件后，请求后端 `POST /api/sessions/{id}/tools/learner-level`。
4. 后端执行安全校验：
   - 至少三轮 learner turn 才允许更新。
   - 等级范围限制在 1-6。
   - 每次最多上调或下调一级。
   - 必须提供基于多轮证据的 reason。
5. 校验通过后，后端写入 `data/conversations.json`，并更新当前 session 的等级。

## 5. 模块职责

### 5.1 前端模块

文件：`webrtc_demo.html`

| 模块 | 职责 |
| --- | --- |
| Session 控制 | 开始会话、结束会话、新建 conversation |
| 媒体采集 | 调用麦克风和可选摄像头，管理音视频轨道 |
| WebRTC 连接 | 创建 offer、设置 answer、维护 peer connection |
| DataChannel | 接收 Realtime 事件，发送 session.update |
| 通话式 UI | 管理 Ready、Connecting、Connected、Ended、Error 等状态 |
| 实时字幕 UI | 当前代码展示用户输入、AI 回复、partial/final 状态；产品化时应改为按需展开 |
| 工具调用桥接 | 将模型工具调用转成后端 API 请求 |
| 性能采集 | 记录 ASR 延迟、首包音频延迟、打断停止时间、WebRTC stats |

### 5.2 后端 API 模块

文件：`backend/app.py`

| 接口 | 职责 |
| --- | --- |
| `GET /health` | 检查服务、API Key、Workspace 配置 |
| `POST /api/sessions` | 创建本地会话，返回 Realtime session 配置 |
| `GET /api/sessions/{id}/config` | 获取当前会话配置 |
| `POST /api/realtime` | 代理 SDP，保护服务端密钥 |
| `POST /api/sessions/{id}/events` | 保存最终用户和 AI 文本事件 |
| `POST /api/sessions/{id}/tools/learner-level` | 校验并保存学习者等级更新 |
| `POST /api/sessions/{id}/latency` | 写入单轮延迟数据 |
| `POST /api/sessions/{id}/quality` | 写入整段通话质量数据 |
| `GET /api/latency-report` | 读取 Markdown 性能报告 |
| `DELETE /api/sessions/{id}` | 关闭内存会话 |
| `DELETE /api/conversations/{id}` | 清除某个 conversation 的学习者画像 |

### 5.3 业务逻辑模块

文件：`backend/business_logic.py`

| 类/方法 | 职责 |
| --- | --- |
| `SessionState` | 保存当前会话 id、conversation id、等级、轮次、消息缓存 |
| `JsonConversationStore` | 读写轻量学习者画像 |
| `RealtimeBusinessLogic.build_instructions` | 拼接英语陪练系统 Prompt、等级策略和 lesson focus |
| `RealtimeBusinessLogic.build_session_config` | 生成 Realtime 会话配置、音色、ASR、TTS、VAD、工具定义 |
| `RealtimeBusinessLogic.message_from_event` | 从 Realtime 事件中提取可保存的用户/AI 文本 |

### 5.4 观测模块

文件：`backend/latency_report.py`

当前观测重点是验证实时语音产品是否成立，指标包括：

- 用户开始说话到首个转写出现的时间。
- 用户说完到 AI 首个可听音频出现的时间。
- 用户打断后 AI 音频停止时间。
- 用户说完到 AI 首个文本出现时间。
- 通话时长、丢包率、最大 jitter、平均 RTT 和连接中断情况。

## 6. Realtime Session 配置

当前后端生成的 Realtime 配置重点如下：

| 配置项 | 当前值/策略 |
| --- | --- |
| 模型 | `qwen3.5-omni-plus-realtime`，可通过 `BAILIAN_MODEL` 覆盖 |
| 音色 | `Tina` |
| 输入音频 | `pcm` |
| 输出音频 | `pcm` |
| ASR | `qwen3-asr-flash-realtime` |
| 输出模态 | `text` + `audio` |
| 最大输出 | `max_tokens = 128` |
| 温度 | `temperature = 0.7` |
| VAD | `server_vad` |
| 静音判定 | 默认 `800 ms` |
| 工具 | `update_learner_level` |

这套配置的产品意图是：

- 回复短，保证低延迟和口语陪练节奏。
- 开启音频与文本双输出，音频为主、文本为辅助。
- 用服务端 VAD 降低前端轮次判断复杂度。
- 将长期难度变化交给后端校验，避免模型单轮误判直接改画像。

## 6.1 MVP 体验指标

产品终稿将第一阶段 MVP 定义为“验证实时语音 AI 在学习者友好策略下，能否让用户自然、持续、低压力地开口说 3-10 分钟英语”。因此 SDK 接入方案必须围绕以下指标验证：

| 指标 | 目标 | 当前实现/记录方式 |
| --- | --- | --- |
| 用户停止说话后 AI 首句语音开始 | P50 <= 1.5s | 前端 audio energy + `/api/sessions/{id}/latency` |
| 用户打断后 AI 停止播报 | <= 300ms | 前端远端音轨能量监控 |
| 连续对话稳定性 | 3-10 分钟无明显卡顿 | WebRTC stats + `/api/sessions/{id}/quality` |
| 首次启动理解成本 | 10 秒内知道如何开始 | 当前 Demo 已有 Start Session，产品化需进一步通话式简化 |
| 有效开口时长 | 北极星指标 | 当前尚未独立统计，后续应从音频活动和 user turn 聚合 |
| 场景“学-读-说”完成率 | 第二阶段追踪 | 当前未实现，留给 Scenario Service |

## 6.2 为什么当前用 SDK/S2S 方法

当前 GitHub 代码采用 WebRTC Realtime 接入，符合终稿里“第一阶段优先端到端 Speech-to-Speech”的方向：

- 延迟更低：少了一次 ASR -> LLM -> TTS 的应用层串行编排。
- 打断更自然：WebRTC + Realtime VAD 更接近真实电话轮次。
- Demo 链路更短：浏览器、Python 后端、Realtime API 三层即可展示。
- 策略仍可控：后端生成 session config 和 instructions，模型工具调用也必须经后端校验。
- 可替换：后续可在模型接入层支持豆包、通义千问音频实时能力或管线式备用方案。

## 7. 数据模型

### 7.1 会话内存态

```text
SessionState
- session_id
- conversation_id
- user_prompt
- learner_level
- learner_level_label
- learner_turns_since_review
- created_at
- turn_messages
```

`SessionState` 只在后端进程内存在，适合 Demo 和单实例验证。生产环境应替换为 Redis 或数据库。

### 7.2 学习者画像

```text
learner_profile
- level: 1-6
- label: Starter / Basic / Intermediate / CET-4 / CET-6 / Advanced
- last_reason
- updated_at
```

当前长期存储只保存等级画像，不保存长期对话总结。这符合当前阶段“低压力自由对话”的边界，也降低隐私和误记忆风险。

### 7.3 性能报告

```text
latency metric
- conversation_id
- session_id
- learner_level_label
- speech_start_to_first_transcript
- speech_end_to_first_ai_audio
- interruption_to_audible_silence
- speech_end_to_first_ai_text
```

```text
quality metric
- duration
- packet_loss
- max_jitter
- avg_rtt
- disruptions
```

## 8. 产品闭环

当前 SDK 版产品闭环如下：

```text
用户开口
  ↓
实时 ASR 转写
  ↓
英语陪练 Prompt 控制 AI 行为
  ↓
AI 短回复 + 追问 + 轻纠错
  ↓
TTS 实时播放
  ↓
用户继续开口
  ↓
多轮表现触发等级调整
  ↓
下次会话以新等级继续
```

这个闭环解决的是第一阶段最重要的问题：用户能否在低压力环境中持续说英语，并获得足够自然、短促、可继续的 AI 反馈。

## 8.1 三大核心模块承接

根据产品终稿，后续产品不是只保留 FreeTalk，而是围绕三大模块演进：

| 模块 | 优先级 | 架构承接 |
| --- | --- | --- |
| 自由对话 | P0 | 当前 GitHub FreeTalk 模块已实现主链路 |
| 场景广场 | P1 | 通过 Scenario Service 生成场景、词汇、短句、任务和 lesson focus |
| 个人主页 | P1 | 通过学习记忆、练习记录、错题本、历史场景和复练入口沉淀留存 |
| 专业场景 | P2 | IELTS、面试、职场英语等使用独立题库、评分维度和用户资料增强 |

## 9. 后续演进架构

### 9.1 M2：场景化训练

新增模块：

- 场景创建 API：根据用户输入生成角色、任务、难度和目标表达。
- 场景内容服务：生成词汇、短句、示例表达。
- 场景对话配置：把场景目标注入 `Lesson focus`。
- 场景进度数据：记录“学-读-说”的完成状态。
- 个人主页基础数据：记录历史场景、学习记忆、错题本和复练入口。

架构变化：

```text
Scenario Service
  ├─ scenario metadata
  ├─ vocabulary and phrases
  ├─ role/task configuration
  └─ lesson focus injection
```

### 9.2 M3：跟读评分与学习报告

新增模块：

- Pronunciation scoring service。
- Scenario report service。
- Error book service。
- 复练推荐策略。

评分只应出现在用户主动进入的场景训练或专业训练中，不应默认进入自由对话，避免破坏低压力体验。

### 9.3 M4：账户、订阅与生产化

新增模块：

- Auth。
- Subscription。
- Quota guard。
- Database。
- Object storage。
- Observability。

### 9.4 平台化与 C++ 核心预留

产品终稿提出：实时语音链路中可复用、性能敏感、跨平台价值高的部分，后续可以逐步抽象为 C++ 核心并封装为动态库。当前阶段不需要立即 C++ 化，但接口边界应提前留好。

适合下沉到核心内核的能力：

- 音频缓冲与音频活动检测。
- VAD 状态与打断状态机。
- 会话轮次管理。
- 策略事件上报。
- 跨平台音频接口抽象。

不适合下沉的能力：

- 页面 UI。
- Prompt 模板和教学策略文案。
- 用户权限、订阅、付费。
- 具体业务流程，如场景创建、报告展示。

推荐演进方式：

```text
M1: Web + Python + Realtime SDK 跑通自由对话
M2: 抽象 TypeScript/Python 会话状态机和模型接入接口
M3: 将音频/VAD/打断/轮次状态机中稳定部分下沉为 C++ core
M4: 通过动态库/FFI 供 Web 后端、桌面端、移动端复用
```

生产化后建议把当前本地文件替换为：

- Redis：保存实时 session 与短期状态。
- PostgreSQL：保存用户、场景、学习记录、报告、订阅。
- 对象存储：保存必要的音频片段或报告附件。
- 日志与指标平台：保存延迟、错误率、连接质量和模型调用成本。

## 10. 关键边界与风险

| 风险 | 当前处理 | 后续建议 |
| --- | --- | --- |
| API Key 泄露 | 后端代理 SDP，不在前端暴露密钥 | 生产环境使用服务端密钥管理 |
| 模型越界评分 | Prompt 限制自由对话不评分 | 对评分请求增加工程层拦截 |
| 难度误判 | 后端要求至少三轮、单次一级 | 增加更细的能力维度画像 |
| 长期记忆误写 | 当前不保存长期对话总结 | 后续仅保存结构化、可解释字段 |
| 多实例状态不一致 | 当前内存 session + JSON 文件 | 替换为 Redis/PostgreSQL |
| 延迟不稳定 | 前端采集延迟报告 | 加入自动化压测和线上监控 |
| VAD 抢话 | 默认 800 ms 静音判定，Prompt 要求不打断犹豫 | 根据真实测试继续调参 |
| UI 偏聊天化 | 当前 Demo 使用 chat transcript 便于调试 | 产品化时改为通话主界面，字幕按需展开 |
| 供应商锁定 | 当前代码接百炼 Realtime | 增加模型接入层，支持多供应商和管线式备用 |
| C++ 过早工程化 | 当前不下沉核心 | 先跑通策略与指标，再抽象稳定状态机 |

## 11. 当前架构结论

按产品终稿与 GitHub 最新实现综合判断，SDK 接入版架构适合作为 UniSpeaking 第一阶段的最小可验证产品：

- 链路足够短：浏览器、Python 后端、Realtime API 三层即可跑通端到端 S2S 语音陪练。
- 密钥足够安全：前端不直接持有供应商 API Key。
- 产品策略可控：Prompt 与工具调用都由后端生成和校验。
- 可观测性明确：延迟与连接质量可以被记录和复盘。
- 演进空间清晰：场景训练、评分报告、账户付费都能在现有实时语音底座上扩展。
- 方法符合终稿：Web 先行、自由对话 P0、通话式体验、量化指标验证、平台化能力预留。

因此，当前产品架构的核心不是“做一个完整英语学习平台”，而是先用 SDK 方式建立稳定的实时口语陪练底座，再逐步叠加结构化学习和商业化能力。
