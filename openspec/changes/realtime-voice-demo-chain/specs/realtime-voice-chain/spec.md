# Realtime Voice Chain Specification

## Purpose

定义自由对话 Realtime 语音 Demo 的可观察行为。该规约只关注链路是否跑通，不覆盖评分、纠错、学习报告或完整产品功能。

## ADDED Requirements

### Requirement: Start a Realtime Call
系统 SHALL 允许用户从未开始状态启动一次自由对话通话。

#### Scenario: Start button enters microphone flow
- GIVEN 用户打开自由对话 Demo 页面
- AND 页面处于 `idle` 状态
- WHEN 用户点击“开始对话”
- THEN 页面状态 SHALL 变为 `requesting_mic`
- AND 浏览器 SHALL 请求麦克风权限

#### Scenario: Start button is disabled during active call
- GIVEN 页面处于 `connected`、`user_speaking`、`ai_generating` 或 `ai_speaking`
- WHEN 用户查看底部控制区
- THEN “开始对话”按钮 SHALL 不可点击
- AND “结束通话”按钮 SHALL 可点击

### Requirement: Microphone Permission
系统 SHALL 在麦克风授权成功后进入应用 WebSocket 连接流程。

#### Scenario: Microphone granted
- GIVEN 页面处于 `requesting_mic`
- WHEN 用户允许浏览器麦克风权限
- THEN 页面状态 SHALL 变为 `connecting_app`
- AND 系统 SHALL 开始连接 Demo 后端 WebSocket

#### Scenario: Microphone denied
- GIVEN 页面处于 `requesting_mic`
- WHEN 用户拒绝浏览器麦克风权限
- THEN 页面状态 SHALL 变为 `failed`
- AND 页面 SHALL 展示“麦克风权限被拒绝，请在浏览器设置中允许麦克风。”
- AND 系统 SHALL NOT 创建供应商连接

### Requirement: Provider Connection
系统 SHALL 通过 Demo 后端连接 Qwen-Omni-Realtime WebSocket。

#### Scenario: Provider connection succeeds
- GIVEN 浏览器已连接 Demo 后端 WebSocket
- AND 后端环境变量完整
- WHEN 后端成功连接 Qwen-Omni-Realtime WebSocket
- THEN 浏览器 SHALL 收到 `session.ready`
- AND 页面状态 SHALL 变为 `connected`
- AND 通话计时 SHALL 开始

#### Scenario: Provider configuration missing
- GIVEN 浏览器已连接 Demo 后端 WebSocket
- AND 后端缺少 `DASHSCOPE_API_KEY` 或 `DASHSCOPE_WORKSPACE_ID`
- WHEN 用户发起 `client.start`
- THEN 浏览器 SHALL 收到 `server.error`
- AND 错误码 SHALL 为 `provider_config_missing`
- AND 页面状态 SHALL 变为 `failed`

### Requirement: Streaming User Audio
系统 SHALL 在会话 ready 后持续发送用户麦克风音频到 Demo 后端。

#### Scenario: Audio starts after session ready
- GIVEN 页面已收到 `session.ready`
- WHEN 用户开始说话
- THEN 浏览器 SHALL 发送 `client.audio`
- AND 每条 `client.audio` SHALL 包含 `audio_base64`、`format` 和 `sample_rate`

#### Scenario: Audio is not sent before ready
- GIVEN 页面尚未收到 `session.ready`
- WHEN 麦克风已授权
- THEN 浏览器 SHALL NOT 发送 `client.audio`

### Requirement: User Transcript Display
系统 SHALL 在收到用户语音转写事件后展示用户文本。

#### Scenario: Partial transcript
- GIVEN 页面处于 `user_speaking`
- WHEN 浏览器收到 `server.user_transcript_delta`
- THEN 消息列表 SHALL 展示一条用户临时转写文本
- AND 临时文本 SHALL 可被后续 delta 更新

#### Scenario: Final transcript
- GIVEN 消息列表存在用户临时转写文本
- WHEN 浏览器收到 `server.user_transcript_final`
- THEN 临时文本 SHALL 变为正式用户消息
- AND 该消息 SHALL 保留在消息列表中

### Requirement: AI Text and Audio Reply
系统 SHALL 展示 AI 文本回复并播放 AI 语音回复。

#### Scenario: AI text delta
- GIVEN 页面处于 `ai_generating`
- WHEN 浏览器收到 `server.ai_text_delta`
- THEN 消息列表 SHALL 展示或追加 AI 文本

#### Scenario: AI audio playback
- GIVEN 浏览器收到 `server.ai_audio_delta`
- WHEN 当前通话未结束
- THEN 浏览器 SHALL 将该音频块加入播放队列
- AND 页面状态 SHALL 变为 `ai_speaking`

#### Scenario: AI reply completion
- GIVEN 页面正在播放 AI 音频
- WHEN 浏览器收到 `server.ai_audio_done`
- THEN 当前 AI 播放段 SHALL 标记完成
- AND 页面 SHALL 回到 `connected`

### Requirement: End Call
系统 SHALL 允许用户主动结束通话并释放所有实时资源。

#### Scenario: User clicks end
- GIVEN 页面处于任意非终态通话状态
- WHEN 用户点击“结束通话”
- THEN 浏览器 SHALL 发送 `client.stop`
- AND 页面状态 SHALL 变为 `ending`
- AND 浏览器 SHALL 停止麦克风轨道
- AND 浏览器 SHALL 清空 AI 音频播放队列

#### Scenario: Call ended event
- GIVEN 页面处于 `ending`
- WHEN 浏览器收到 `session.closed`
- THEN 页面状态 SHALL 变为 `ended`
- AND 通话计时 SHALL 停止

### Requirement: Call Timeout
系统 SHALL 在通话达到 `MAX_CALL_SECONDS` 时自动结束通话。

#### Scenario: Timeout at configured limit
- GIVEN `MAX_CALL_SECONDS=600`
- AND 通话已连接
- WHEN 通话持续 600 秒
- THEN 后端 SHALL 关闭供应商连接
- AND 浏览器 SHALL 收到错误码 `call_timeout`
- AND 页面 SHALL 展示“本次 Demo 通话已到达时间上限。”

### Requirement: Scope Guardrails
系统 SHALL NOT 在本期自由对话 Demo 中输出学习评价类结果。

#### Scenario: No score after call
- GIVEN 用户结束通话
- WHEN 页面进入 `ended`
- THEN 页面 SHALL NOT 展示评分
- AND 页面 SHALL NOT 展示 CEFR 等级
- AND 页面 SHALL NOT 展示发音评测
- AND 页面 SHALL NOT 展示错题本或学习报告

#### Scenario: No correction during call
- GIVEN AI 正在回复用户
- WHEN AI 文本出现在消息列表
- THEN AI 回复 SHALL NOT 逐句纠正用户语法
- AND AI 回复 SHALL NOT 使用评分口吻评价用户表现

