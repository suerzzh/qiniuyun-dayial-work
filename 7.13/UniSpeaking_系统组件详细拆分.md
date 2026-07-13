# UniSpeaking 系统组件详细拆分

> 本文档用于描述 UniSpeaking 系统的完整组件结构，细化到可直接映射为 Spring Boot 模块、前端 Feature、Provider Adapter 和基础设施模块的粒度。
>
> 该结构是一棵**逻辑组件树**，不代表每个节点都必须独立部署成微服务。当前阶段仍建议采用 **Spring Boot 模块化单体**。

---

## 1. 客户端组件 Client Components

### 1.1 Web Client

#### App Shell
- 应用启动
- 全局 Provider
- 全局异常边界
- 全局主题与布局

#### Router
- 公共路由
- 登录路由
- 会员路由
- 学习路由
- Realtime 路由
- 权限守卫

#### Authentication Feature
- 登录
- 注册
- 验证码
- Token 刷新
- 退出登录

#### Home Feature
- 首页概览
- 自由聊天入口
- 推荐场景
- 今日学习数据
- 连续打卡展示

#### Free Chat Feature
- Realtime 会话创建
- 麦克风权限
- WebRTC 建连
- 音频播放
- 实时字幕
- 对话消息列表
- AI 打断
- 暂停与恢复
- 结束通话
- 网络重连

#### Scene Feature
- 场景广场
- 场景分类
- 场景搜索
- 场景筛选
- 场景详情
- 雅思入口
- 面试入口
- 自定义场景入口

#### Custom Scene Feature
- 场景描述输入
- 目标等级选择
- 学习时长选择
- 特殊要求输入
- 场景生成状态
- 场景预览
- 重新生成

#### Learning Feature
- 学习会话初始化
- 学习进度条
- 单词与词组阶段
- 听力阶段
- 阅读阶段
- 写作阶段
- 口语对话阶段
- 阶段提交
- 阶段通过
- 中断保存
- 恢复学习

#### Report Feature
- 报告生成状态
- 总分展示
- 维度分展示
- 优势展示
- 建议展示
- 错误句预览
- 跳转错题练习

#### Mistake Feature
- 错题列表
- 错题分类
- 错题详情
- 原句与纠正句
- 音频回放
- 跟读练习
- 重新作答
- 掌握状态

#### Progress Feature
- 学习日历
- 每日打卡
- 连续学习天数
- 能力趋势
- 学习时长趋势
- 成就展示
- 鼓励文案

#### Membership Feature
- 套餐列表
- 权益展示
- 剩余额度
- 订单创建
- 支付状态
- 会员升级

#### Profile Feature
- 用户资料
- 头像设置
- 学习目标
- 英语等级
- 音色设置
- 语速设置
- 纠错偏好
- 隐私设置
- 账户安全

#### Shared UI Components
- Button
- Input
- Modal
- Card
- Tabs
- ProgressBar
- AudioVisualizer
- ScoreChart
- Calendar
- EmptyState

#### State Management
- Auth Store
- User Store
- Realtime Store
- Learning Store
- Conversation Store
- UI Store

#### API Client
- Auth API
- User API
- Scene API
- Learning API
- Realtime API
- Report API
- Mistake API
- Progress API
- Payment API

#### Realtime SDK Adapter
- WebRTC Adapter
- Qwen Session Adapter
- DataChannel Event Adapter
- Audio Track Manager
- Device Manager
- Reconnect Manager

### 1.2 Mobile Client

- App Shell
- Navigation
- Authentication Feature
- Free Chat Feature
- Scene Feature
- Learning Feature
- Report Feature
- Mistake Feature
- Progress Feature
- Membership Feature
- Profile Feature

#### Native Permission Manager
- 麦克风权限
- 通知权限
- 存储权限

#### Native Realtime Adapter
- iOS WebRTC Adapter
- Android WebRTC Adapter
- Audio Route Manager
- Bluetooth Manager
- Background Audio Manager

#### Secure Storage
- iOS Keychain
- Android Keystore

#### 其他能力
- Push Notification
- In-App Purchase Adapter

### 1.3 Admin Client

- Admin Authentication

#### Dashboard
- 用户统计
- 会员统计
- 会话统计
- 学习统计
- 模型调用统计
- 异常统计

#### 管理模块
- User Management
- Membership Management
- Order Management
- Scene Management
- Prompt Management
- Agent Management
- Model Provider Management
- Evaluation Rule Management
- Content Review
- Report Management
- Notification Management
- System Configuration

---

## 2. 接入组件 Access Components

### 2.1 CDN
- Web 静态资源分发
- 场景图片缓存
- 公共音频缓存
- 报告资源缓存
- 缓存刷新
- 防盗链

### 2.2 API Gateway
- Route Manager
- Authentication Filter
- Authorization Filter
- Rate Limit Filter
- CORS Filter
- Request Validation
- Request ID Generator
- Access Log
- API Version Router
- Gray Release Router
- Error Response Adapter

### 2.3 Business BFF
- Home Aggregator
- Profile Aggregator
- Learning Aggregator
- Report Aggregator
- Membership Aggregator
- Admin Aggregator
- DTO Assembler
- Client Capability Adapter

### 2.4 Realtime Gateway
- Realtime Session API
- RTC Credential Service
- WebRTC Signaling Adapter
- DataChannel Event Router
- Connection Manager
- Session State Manager
- Heartbeat Manager
- Interrupt Manager
- Pause / Resume Manager
- Reconnect Manager
- Provider Routing
- Usage Metering
- Event Normalizer
- Error Translator
- Realtime Audit Logger

---

## 3. 核心业务组件 Core Business Components

### 3.1 Auth Component
- Registration Module
- Login Module
- Verification Code Module
- Password Module
- JWT Module
- Refresh Token Module
- Logout Module
- Device Session Module
- Login Risk Control
- Account Lock Module

### 3.2 User Component
- User Account Module
- User Profile Module
- Avatar Module
- Learning Goal Module
- Ability Profile Module
- Visible Preference Module
- Hidden Preference Storage
- Privacy Setting Module
- Account Status Module
- User Data Export
- User Data Deletion

### 3.3 Membership Component
- Membership Plan Module
- Membership Subscription Module
- Entitlement Module
- Usage Quota Module
- Realtime Minute Quota
- Custom Scene Entitlement
- Advanced Report Entitlement
- Membership Expiration
- Membership Renewal
- Membership Event Handler

### 3.4 Payment Component
- Payment Order Module
- Payment Channel Router
- Payment Request Module
- Payment Callback Module
- Signature Verification
- Payment Status Module
- Refund Module
- Reconciliation Module
- Apple IAP Verification
- Google Play Verification
- Payment Event Publisher

### 3.5 Scene Component
- Scene Catalog Module
- Scene Category Module
- Scene Search Module
- Scene Filter Module
- Scene Detail Module
- Scene Version Module
- Scene Role Module
- Scene Goal Module
- Scene Vocabulary Module
- Scene Phrase Module
- Listening Content Module
- Reading Content Module
- Writing Content Module
- Speaking Plan Module
- Custom Scene Module
- IELTS Scene Module
- Interview Scene Module
- Scene Publish Module
- Scene Review Module

### 3.6 Learning Component
- Learning Session Module
- Learning State Machine
- Stage Factory
- Preview Stage
- Vocabulary Stage
- Listening Stage
- Reading Stage
- Writing Stage
- Speaking Stage
- Stage Content Loader
- Answer Submission Module
- Stage Evaluation Module
- Pass Condition Module
- Stage Advance Module
- Progress Save Module
- Pause Module
- Resume Module
- Learning Completion Module

### 3.7 Conversation Component
- Conversation Session Module
- Conversation Turn Module
- Transcript Module
- Conversation Event Module
- Conversation Context Module
- Scene Goal Progress Module
- Turn Count Module
- Conversation Checkpoint Module
- Provider Session Mapping
- Usage Statistics Module
- Audio Asset Reference
- Conversation Finish Module
- Conversation History Query

### 3.8 Evaluation Component
- Evaluation Task Module
- Evaluation Pipeline
- Conversation Evaluator
- Grammar Evaluator
- Vocabulary Evaluator
- Fluency Evaluator
- Task Completion Evaluator
- Pronunciation Evaluation Adapter
- IELTS Evaluation Module
- Interview Evaluation Module
- Dimension Score Module
- Overall Score Module
- Strength Analysis Module
- Suggestion Generation Module
- Encouragement Module
- Mistake Candidate Extractor
- Ability Update Module
- Evaluation Report Module

### 3.9 Mistake Component
- Mistake Item Module
- Mistake Type Module
- Original Sentence Module
- Corrected Sentence Module
- Explanation Module
- Pronunciation Mistake Module
- Grammar Mistake Module
- Vocabulary Mistake Module
- Sentence Pattern Module
- Review Plan Module
- Spaced Repetition Module
- Practice Record Module
- Mastery Level Module
- Next Review Time Module
- Mistake Source Tracking

### 3.10 Progress Component
- Learning Event Consumer
- Daily Statistics Module
- Check-in Module
- Streak Module
- Study Duration Module
- Session Count Module
- Vocabulary Progress Module
- Ability Trend Module
- Score Trend Module
- Achievement Module
- Growth Summary Module
- Encouragement Data Module
- Calendar Aggregation Module

### 3.11 Notification Component
- Notification Template Module
- In-App Message Module
- Push Notification Module
- SMS Notification Module
- Email Notification Module
- Learning Reminder Module
- Report Ready Notification
- Membership Expiration Notification
- Check-in Reminder Module
- Notification Preference Module
- Notification Task Module
- Delivery Result Module

---

## 4. AI 能力组件 AI Components

### 4.1 Agent Orchestrator
- Agent Selection Module
- Agent Initialization Module
- Context Assembly Module
- Turn Processing Module
- Response Policy Module
- Correction Policy Module
- Hint Policy Module
- Difficulty Update Module
- Tool Call Dispatcher
- Scene Goal Controller
- Turn Limit Controller
- Finish Decision Module
- Provider Switch Handler
- Agent Event Publisher

### 4.2 Agent Registry
- Agent Definition Module
- Agent Type Module
- Agent Version Module
- Agent Metadata Module
- Prompt Binding Module
- Tool Binding Module
- Rubric Binding Module
- Turn Policy Module
- Voice Profile Binding
- Agent Enable / Disable Module

### 4.3 Agent Factory
- BaseSpeakingAgent
- FreeChatAgent
- SceneSpeakingAgent
- IELTSAgent
- InterviewAgent
- CustomSceneAgent
- Agent Dependency Injector
- Agent Lifecycle Manager

### 4.4 Prompt Engine
- Prompt Template Module
- Prompt Version Module
- System Policy Module
- Tutor Identity Module
- Agent Prompt Module
- Scene Prompt Module
- User Ability Prompt Module
- User Preference Prompt Module
- Difficulty Prompt Module
- Conversation State Prompt Module
- Prompt Variable Resolver
- Prompt Assembler
- Prompt Validator
- Prompt Cache
- Prompt Rollback
- Prompt Experiment Module

### 4.5 Difficulty Engine
- Ability Snapshot Loader
- Response Time Analyzer
- Sentence Length Analyzer
- Vocabulary Complexity Analyzer
- Grammar Error Analyzer
- Code-Switching Analyzer
- Help Request Analyzer
- Silence Analyzer
- Difficulty Rule Engine
- Speech Rate Controller
- Vocabulary Level Controller
- Sentence Complexity Controller
- Correction Intensity Controller
- Hint Frequency Controller
- Difficulty History Module

### 4.6 User Memory Engine
- Explicit Preference Loader
- Implicit Preference Extractor
- Memory Candidate Module
- Memory Confidence Module
- Memory Deduplication Module
- Memory Merge Module
- Memory Expiration Module
- Context Relevance Filter
- Session Memory Module
- Long-Term Memory Module
- Memory Write Policy
- Memory Privacy Control

### 4.7 Scene Generation Engine
- Scene Request Parser
- Scene Generation Prompt
- Scene Structure Generator
- Role Generator
- Goal Generator
- Vocabulary Generator
- Phrase Generator
- Listening Content Generator
- Reading Content Generator
- Writing Content Generator
- Speaking Plan Generator
- Difficulty Adapter
- JSON Parser
- Schema Validator
- Safety Validator
- Regeneration Module
- Scene Publish Adapter

### 4.8 Model Gateway
- Model Router
- Provider Registry
- Realtime Provider Selector
- Text Model Selector
- Speech Evaluation Selector
- Provider Health Checker
- Timeout Manager
- Retry Manager
- Circuit Breaker
- Rate Limiter
- Request Converter
- Response Normalizer
- Event Normalizer
- Error Normalizer
- Usage Collector
- Cost Calculator
- Provider Fallback
- Provider Audit Logger

### 4.9 Tool Layer
- Tool Registry
- Tool Permission Checker
- Tool Parameter Validator
- `save_user_preference`
- `update_user_memory`
- `update_difficulty`
- `give_expression_hint`
- `give_chinese_hint`
- `request_user_repeat`
- `record_learning_mistake`
- `complete_scene_goal`
- `advance_scene_goal`
- `query_scene_progress`
- `finish_conversation`
- Tool Result Adapter
- Tool Audit Logger

---

## 5. 外部模型适配组件 Provider Components

### 5.1 Qwen Realtime Provider
- Qwen Credential Module
- Qwen Session Creator
- Qwen WebRTC Adapter
- Qwen SDP Adapter
- Qwen Event Adapter
- Qwen Instruction Updater
- Qwen Voice Config Adapter
- Qwen VAD Config Adapter
- Qwen Interrupt Adapter
- Qwen Usage Adapter
- Qwen Error Adapter
- Qwen Health Check

### 5.2 Doubao Realtime Provider
- Doubao Credential Module
- Doubao Session Creator
- Doubao RTC Adapter
- Doubao Event Adapter
- Doubao Prompt Adapter
- Doubao Voice Config Adapter
- Doubao Interrupt Adapter
- Doubao Usage Adapter
- Doubao Error Adapter
- Doubao Health Check

### 5.3 Text Model Provider
- Text Request Adapter
- Structured Output Adapter
- JSON Schema Adapter
- Scene Generation Adapter
- Grammar Evaluation Adapter
- Suggestion Generation Adapter
- Report Text Adapter
- Token Usage Adapter
- Error Adapter
- Health Check

### 5.4 Speech Evaluation Provider
- Audio Upload Adapter
- Reference Text Adapter
- Pronunciation Score Adapter
- Phoneme Score Adapter
- Word Score Adapter
- Fluency Score Adapter
- Stress Score Adapter
- Completeness Score Adapter
- Evaluation Result Normalizer
- Health Check

### 5.5 Payment Provider
- WeChat Pay Adapter
- Alipay Adapter
- Apple IAP Adapter
- Google Play Billing Adapter
- Payment Signature Adapter
- Payment Callback Adapter
- Refund Adapter
- Payment Error Adapter

---

## 6. 基础设施组件 Infrastructure Components

### 6.1 PostgreSQL
- User Schema
- Membership Schema
- Payment Schema
- Scene Schema
- Learning Schema
- Conversation Schema
- Evaluation Schema
- Mistake Schema
- Progress Schema
- Notification Schema
- Prompt Schema
- Agent Schema
- Transaction Manager
- Migration Manager
- Repository Implementation

### 6.2 Redis
- Session Cache
- Refresh Token Store
- Realtime Session State
- Conversation Temporary Context
- Membership Quota Cache
- Prompt Cache
- Provider Health Cache
- Distributed Lock
- Rate Limit Counter
- Idempotency Key
- Short-Lived Credential Cache

### 6.3 OSS
- Avatar Storage
- Scene Cover Storage
- Learning Audio Storage
- Conversation Audio Storage
- Pronunciation Audio Storage
- Report Resource Storage
- Upload Credential Module
- Download URL Module
- Lifecycle Policy
- Asset Metadata Module

### 6.4 Message Queue
- Event Publisher
- Event Consumer
- Payment Topic
- Conversation Topic
- Evaluation Topic
- Mistake Topic
- Progress Topic
- Notification Topic
- Retry Queue
- Dead Letter Queue
- Idempotent Consumer
- Event Schema Registry

### 6.5 Logging
- Access Log
- Application Log
- Realtime Log
- Provider Call Log
- Payment Audit Log
- Security Audit Log
- Tool Call Log
- Structured Log Formatter
- Trace ID Injection
- Sensitive Data Masking

### 6.6 Metrics
- API Latency Metrics
- API Error Metrics
- Realtime Connection Metrics
- Realtime Session Success Rate
- Provider Latency Metrics
- Provider Error Rate
- Provider Switch Count
- Model Usage Metrics
- Model Cost Metrics
- Payment Metrics
- Evaluation Task Metrics
- Business Conversion Metrics

### 6.7 Configuration
- Application Configuration
- Database Configuration
- Redis Configuration
- OSS Configuration
- MQ Configuration
- Security Configuration
- Realtime Configuration
- Qwen Provider Configuration
- Doubao Provider Configuration
- Payment Configuration
- Feature Flag Configuration
- Prompt Version Configuration
- Agent Configuration
- Environment Configuration
- Secret Management
- Dynamic Configuration

---

## 7. Spring Boot 一级包结构建议

```text
com.unispeaking
├── auth
├── user
├── membership
├── payment
├── scene
├── learning
├── conversation
├── evaluation
├── mistake
├── progress
├── notification
├── realtime
├── agent
│   ├── orchestrator
│   ├── registry
│   ├── factory
│   ├── prompt
│   ├── difficulty
│   ├── memory
│   ├── scenegeneration
│   └── tool
├── provider
│   ├── qwen
│   ├── doubao
│   ├── textmodel
│   ├── speechscore
│   └── payment
├── infrastructure
│   ├── database
│   ├── redis
│   ├── oss
│   ├── mq
│   ├── logging
│   ├── metrics
│   └── configuration
└── bootstrap
```

---

## 8. 组件边界规则

1. `Learning Component` 管理学习流程，`Scene Component` 管理学习内容。
2. `Conversation Component` 管理会话业务数据，`Realtime Gateway` 管理实时连接和事件。
3. `Evaluation Component` 管理评分，`Mistake Component` 管理错题复习。
4. `Agent Orchestrator` 管理 AI 对话决策，`Model Gateway` 管理模型厂商调用。
5. `Prompt Engine` 只负责构建 Prompt，不直接调用模型。
6. `User Memory Engine` 负责记忆筛选和更新，最终数据由 `User Component` 持久化。
7. 所有外部 SDK 只能出现在 Provider 或 Infrastructure 层。
8. 业务组件之间禁止直接访问对方的数据表。
9. 当前架构不包含 `ASR → LLM → TTS` 级联链路。
10. Web 与移动端共享 API、Realtime 事件协议和学习状态机。
