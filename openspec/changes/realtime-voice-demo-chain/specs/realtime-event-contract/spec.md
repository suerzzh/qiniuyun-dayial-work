# Realtime Event Contract Specification

## Purpose

定义浏览器与 Demo 后端之间的唯一事件契约。后续实现必须按本契约发送和接收事件，不得新增未记录事件作为主链路依赖。

## ADDED Requirements

### Requirement: Event Envelope
所有后端到浏览器事件 SHALL 使用统一事件信封。

#### Scenario: Valid server event envelope
- GIVEN 后端要向浏览器发送任意事件
- WHEN 事件被序列化
- THEN 事件 SHALL 包含 `type`
- AND 事件 SHALL 包含 `call_id`
- AND 事件 SHALL 包含毫秒时间戳 `ts`
- AND 事件 SHALL 包含对象类型 `payload`

#### Scenario: No API key in events
- GIVEN 后端向浏览器发送任意事件
- WHEN 浏览器收到事件
- THEN 事件 SHALL NOT 包含 `DASHSCOPE_API_KEY`
- AND 事件 SHALL NOT 包含 `Authorization`

### Requirement: Client Start Event
浏览器 SHALL 使用 `client.start` 发起自由对话会话。

#### Scenario: Start event payload
- GIVEN 浏览器 WebSocket 已连接
- WHEN 用户点击“开始对话”
- THEN 浏览器 SHALL 发送 `client.start`
- AND `payload.requested_mode` SHALL 等于 `free_talk`

### Requirement: Client Audio Event
浏览器 SHALL 使用 `client.audio` 发送音频块。

#### Scenario: Audio event payload
- GIVEN 会话已 ready
- WHEN 浏览器发送用户音频
- THEN 事件 `type` SHALL 等于 `client.audio`
- AND `payload.audio_base64` SHALL 为非空字符串
- AND `payload.format` SHALL 等于 `pcm`
- AND `payload.sample_rate` SHALL 等于 `16000`

### Requirement: Session Events
后端 SHALL 使用固定会话事件通知浏览器连接状态。

#### Scenario: Session created
- GIVEN 后端已生成 `call_id`
- WHEN 后端接受 `client.start`
- THEN 后端 SHALL 发送 `session.created`
- AND `payload.provider` SHALL 等于 `qwen`
- AND `payload.model` SHALL 等于环境变量 `REALTIME_MODEL_NAME`

#### Scenario: Session ready
- GIVEN 后端已连接供应商 WebSocket
- WHEN 供应商会话初始化完成
- THEN 后端 SHALL 发送 `session.ready`
- AND `payload.state` SHALL 等于 `connected`

#### Scenario: Session closed
- GIVEN 通话结束
- WHEN 后端已关闭浏览器和供应商连接
- THEN 后端 SHALL 发送 `session.closed`
- AND `payload.reason` SHALL 为 `client_stopped`、`call_timeout` 或 `provider_closed`

### Requirement: Transcript Events
后端 SHALL 将供应商转写归一化为用户转写事件。

#### Scenario: User transcript delta
- GIVEN 供应商返回用户临时转写文本
- WHEN 后端转发给浏览器
- THEN 后端 SHALL 发送 `server.user_transcript_delta`
- AND `payload.text` SHALL 为字符串
- AND `payload.is_final` SHALL 等于 `false`

#### Scenario: User transcript final
- GIVEN 供应商返回用户最终转写文本
- WHEN 后端转发给浏览器
- THEN 后端 SHALL 发送 `server.user_transcript_final`
- AND `payload.text` SHALL 为非空字符串
- AND `payload.is_final` SHALL 等于 `true`

### Requirement: AI Reply Events
后端 SHALL 将供应商 AI 回复归一化为 AI 文本和音频事件。

#### Scenario: AI text delta
- GIVEN 供应商返回 AI 文本增量
- WHEN 后端转发给浏览器
- THEN 后端 SHALL 发送 `server.ai_text_delta`
- AND `payload.text` SHALL 为字符串

#### Scenario: AI text done
- GIVEN 供应商完成当前 AI 文本回复
- WHEN 后端转发给浏览器
- THEN 后端 SHALL 发送 `server.ai_text_done`
- AND `payload.message_id` SHALL 为非空字符串

#### Scenario: AI audio delta
- GIVEN 供应商返回 AI 音频增量
- WHEN 后端转发给浏览器
- THEN 后端 SHALL 发送 `server.ai_audio_delta`
- AND `payload.audio_base64` SHALL 为非空字符串
- AND `payload.format` SHALL 等于 `pcm`
- AND `payload.sample_rate` SHALL 等于 `24000`

#### Scenario: AI audio done
- GIVEN 供应商完成当前 AI 音频回复
- WHEN 后端转发给浏览器
- THEN 后端 SHALL 发送 `server.ai_audio_done`
- AND `payload.message_id` SHALL 为非空字符串

### Requirement: Error Event
后端 SHALL 使用 `server.error` 向浏览器发送错误。

#### Scenario: Error payload
- GIVEN 任意可恢复或不可恢复错误发生
- WHEN 后端通知浏览器
- THEN 后端 SHALL 发送 `server.error`
- AND `payload.code` SHALL 为规约中定义的错误码之一
- AND `payload.user_message` SHALL 为中文可读提示
- AND `payload.debug_message` SHALL 为开发者可读说明
- AND `payload.fatal` SHALL 为布尔值

#### Scenario: Fatal error terminates call
- GIVEN 浏览器收到 `server.error`
- AND `payload.fatal` 等于 `true`
- WHEN 页面处理该事件
- THEN 页面状态 SHALL 变为 `failed`
- AND 浏览器 SHALL 停止麦克风轨道
- AND 浏览器 SHALL 停止 AI 音频播放

### Requirement: Debug Events
后端 MAY 使用 `server.debug` 向浏览器发送调试事件。

#### Scenario: Debug event visible in panel
- GIVEN `DEBUG_REALTIME_LOG=true`
- WHEN 后端发送 `server.debug`
- THEN 调试面板 SHALL 追加展示该事件

#### Scenario: Debug event does not include audio body
- GIVEN 后端发送 `server.debug`
- WHEN 浏览器收到事件
- THEN `payload` SHALL NOT 包含完整音频 Base64
- AND `payload` SHALL NOT 包含用户录音内容

