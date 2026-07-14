# UniSpeaking UI、Realtime Demo 与云部署设计

## 目标

> 范围更新：用户在执行中明确本轮只考虑 Web 端；iOS、Android 不在本设计和部署范围内。

将 `UniSpeaking_Complete_UI` 作为最终 Web UI，把 `UniSpeaking/webrtc_demo.html` 中已经验证的自由对话 Realtime 能力模块化并接入 UI；使用现有 Supabase 项目提供数据库与 Edge Function，使用 Vercel 发布前端，并输出可复现的链接和部署操作说明。

## 当前状态

- UI 是原生 HTML、CSS 和 ES Modules 应用，现有自由对话按钮只更新本地模拟状态。
- UI 缺少 `src/views/training.mjs`，导致 15 项测试中 1 项失败，浏览器顶层模块加载也会失败。
- Demo 是 Python aiohttp 后端与单文件 WebRTC 前端；后端保护百炼密钥、构造 session config、代理 SDP，并用内存和本地文件保存状态。
- Vercel、Supabase 插件均已连接；Vercel 无现有项目，Supabase 有一个健康且 `public` schema 为空的现有项目。

## 总体架构

```text
Browser UI on Vercel
  ├─ UI state and live transcript
  ├─ microphone / RTCPeerConnection / DataChannel
  └─ HTTPS with publishable Supabase credentials
             │
             ▼
Supabase Edge Function: realtime-gateway
  ├─ session creation and prompt composition
  ├─ SDP proxy with server-only Bailian credentials
  ├─ learner-level policy
  ├─ message and metric persistence
  └─ rate limit, origin and error handling
             │
       ┌─────┴─────────┐
       ▼               ▼
Supabase Postgres   Bailian Realtime WebRTC
```

浏览器音频经 WebRTC 直接流向百炼，不经 Vercel 或 Supabase 数据库。原始音频不落盘。

## 前端集成

新增：

- `src/realtime/realtime-client.mjs`：PeerConnection、DataChannel、媒体轨道和结束清理。
- `src/realtime/realtime-events.mjs`：将供应商事件转换为 UI 事件。
- `src/realtime/realtime-messages.mjs`：合并流式用户/AI消息并去重。
- `src/realtime/realtime-metrics.mjs`：收集首字、首音频、打断和 WebRTC质量指标。
- `src/services/config.mjs`：Supabase URL和Publishable Key等公开配置。
- `src/services/realtime-api.mjs`：调用 `realtime-api` Edge Function。
- `src/views/training.mjs`：恢复缺失训练视图，使完整 UI 可加载。

自由对话状态：

```text
idle -> requesting_mic -> creating_session -> connecting
     -> listening <-> ai_speaking -> ending -> ended
任意运行阶段 -> error -> idle/retry
```

交互映射：

- 语音球仅控制字幕显示。
- 麦克风首次点击建立会话；通话中切换静音。
- 结束按钮执行统一资源清理并关闭云端会话。
- 文字输入经 DataChannel 创建文本消息并请求 AI 回复。
- 快捷话题作为会话 Prompt 的附加上下文。
- 消息列表使用运行时消息，不修改静态演示数据。

## Supabase API

单一 Edge Function `realtime-gateway` 提供：

- `GET /health`
- `POST /session`
- `POST /sdp`
- `POST /events`
- `POST /learner-level`
- `POST /metrics`
- `DELETE /session`

Edge Function 将百炼错误转换为稳定的应用错误码，不返回密钥、内部堆栈或不必要的上游响应。

## 数据模型

### learner_profiles

- `conversation_id` 主键
- `level`，范围 1-6
- `level_label`
- `update_reason`
- `learner_turns_since_review`
- `updated_at`

### realtime_sessions

- `session_id` UUID 主键
- `conversation_id`
- `status`
- `topic_prompt`
- `learner_level`
- `provider`
- `model`
- `created_at`
- `expires_at`
- `ended_at`

### session_messages

- `id`
- `session_id`
- `source_id`
- `role`
- `text`
- `created_at`
- 唯一约束：`session_id, source_id, role`

### realtime_metrics

- `id`
- `session_id`
- `metric_type`
- `metric_payload` JSONB
- `created_at`

### request_rate_limits

- `client_hash`
- `action`
- `window_started_at`
- `request_count`

## 安全

- DashScope Key、Workspace ID、模型名只放在 Supabase Secret。
- 前端只包含可公开的 Supabase URL和Publishable Key。
- Edge Function使用新版 Publishable Key 的 `apikey` 头进行函数内校验，并验证 Vercel Origin；平台旧式 `verify_jwt` 关闭。
- 核心表开启 RLS；前端不直接写核心表。
- session创建、SDP和等级更新单独限流。
- 客户端标识仅保存哈希，不保存原始IP。
- 设置会话时长与请求上限，控制公开 Demo费用。
- 原始音频不保存，日志不写密钥。

## 错误与清理

必须覆盖：

- 麦克风拒绝或无设备。
- Edge Function不可用或超时。
- 百炼权限、地域、Workspace和限流错误。
- WebRTC disconnected/failed/closed。
- DataChannel关闭或未知事件。
- 页面卸载、用户主动结束和异常结束。

所有退出路径停止本地媒体轨道、远端音频、AudioContext、统计定时器、DataChannel和PeerConnection，并尝试关闭云端session。

## 测试

- 修复缺失视图后，现有15项UI测试全部通过。
- Realtime状态转换、消息合并、重复/迟到事件使用纯逻辑单元测试。
- API client使用Mock fetch测试成功、错误和超时。
- Edge Function测试路由、Schema、CORS、限流、过期和错误脱敏。
- Supabase迁移后检查表、约束、索引和RLS。
- 线上验证页面加载、session创建、SDP交换、转写、AI文本/音频、静音和结束清理。

## 部署顺序

1. 完成前端与函数本地实现和测试。
2. 使用Supabase插件应用迁移。
3. 安全设置百炼Secret。
4. 使用Supabase插件部署 `realtime-api`，开启JWT校验。
5. 获取项目URL和Publishable Key并写入前端公共配置。
6. 使用Vercel插件部署前端。
7. 将实际Vercel域名加入允许来源并重新验证。
8. 检查Supabase函数日志和Vercel构建/运行日志。

## 操作文档

最终文档保存为 `UniSpeaking_UI与Demo链接及部署操作说明.md`，包括代码对应关系、完整数据流、插件操作、迁移、Secret、本地运行、部署、验证、日志、回滚和后续更新方式，不记录真实密钥。

## 不做

- 不把原Demo页面嵌入最终UI。
- 不把DashScope密钥放入浏览器或Git。
- 不保存原始音频。
- 不在本轮实现完整登录、会员、场景训练后端或移动端。
- 不引入第三个云托管平台。
