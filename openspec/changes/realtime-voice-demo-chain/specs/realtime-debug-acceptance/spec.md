# Realtime Debug and Acceptance Specification

## Purpose

定义 Demo 的调试可见性、隐私约束和验收标准。该规约用于判断后续实现是否真的跑通主链路。

## ADDED Requirements

### Requirement: Debug Panel
页面 SHALL 展示一个开发调试面板，用于观察 Realtime 链路状态。

#### Scenario: Debug panel after successful connection
- GIVEN 用户已开始通话
- AND 后端已连接供应商
- WHEN 页面收到 `session.ready`
- THEN 调试面板 SHALL 展示 `call_id`
- AND 调试面板 SHALL 展示 `provider=qwen`
- AND 调试面板 SHALL 展示模型名
- AND 调试面板 SHALL 展示当前状态 `connected`

#### Scenario: Debug panel first packet metrics
- GIVEN 用户已说话且 AI 已回复
- WHEN 首次转写和首次 AI 音频均已返回
- THEN 调试面板 SHALL 展示 `first_transcript_latency_ms`
- AND 调试面板 SHALL 展示 `first_ai_audio_latency_ms`

### Requirement: No Audio Persistence
系统 SHALL NOT 保存用户录音或可回放音频。

#### Scenario: No recording file after call
- GIVEN 用户完成一次通话
- WHEN 通话结束
- THEN 项目目录 SHALL NOT 新增用户录音文件
- AND 后端 SHALL NOT 生成可回放的音频历史文件

#### Scenario: Logs exclude full audio payload
- GIVEN 后端记录调试日志
- WHEN 日志输出到控制台或调试面板
- THEN 日志 SHALL NOT 包含完整 `audio_base64`
- AND 日志 SHALL NOT 包含供应商 API Key

### Requirement: Acceptance Happy Path
系统 SHALL 支持一条完整的手工验收主链路。

#### Scenario: Three-turn conversation
- GIVEN 后端已配置有效 Qwen 环境变量
- AND 浏览器已打开 Demo 页面
- WHEN 用户点击“开始对话”
- AND 用户允许麦克风权限
- AND 用户完成 3 轮英语发言
- THEN 页面 SHALL 展示至少 3 条用户消息
- AND 页面 SHALL 展示至少 3 条 AI 消息
- AND 浏览器 SHALL 播放至少 1 次 AI 语音
- AND 页面 SHALL 保持可继续对话状态

### Requirement: End Call Acceptance
系统 SHALL 在用户结束通话后释放资源。

#### Scenario: Manual end after conversation
- GIVEN 用户已完成至少 1 轮对话
- WHEN 用户点击“结束通话”
- THEN 页面状态 SHALL 变为 `ended`
- AND 通话计时 SHALL 停止
- AND 麦克风采集 SHALL 停止
- AND AI 音频播放 SHALL 停止
- AND 后端 SHALL 关闭供应商 WebSocket

### Requirement: Failure Acceptance
系统 SHALL 对关键失败场景给出明确提示。

#### Scenario: Missing provider key
- GIVEN 后端未配置 `DASHSCOPE_API_KEY`
- WHEN 用户点击“开始对话”并授权麦克风
- THEN 页面 SHALL 展示“实时语音服务配置缺失，请检查后端环境变量。”
- AND 调试面板 SHALL 展示错误码 `provider_config_missing`

#### Scenario: Backend unavailable
- GIVEN Demo 后端未运行
- WHEN 用户点击“开始对话”
- THEN 页面 SHALL 展示“无法连接本地实时语音服务，请确认服务已启动。”
- AND 页面状态 SHALL 变为 `failed`

### Requirement: AI Conversation Style
AI 回复 SHALL 保持低压力自由对话风格。

#### Scenario: Short AI reply
- GIVEN 用户说出一段普通英语日常表达
- WHEN AI 回复文本展示
- THEN AI 回复 SHOULD 为 1 到 3 句
- AND AI 回复 SHOULD 包含一个自然追问

#### Scenario: No scoring language
- GIVEN AI 回复文本展示
- WHEN 用户查看该文本
- THEN 文本 SHALL NOT 包含 `score`
- AND 文本 SHALL NOT 包含 `CEFR`
- AND 文本 SHALL NOT 包含 `pronunciation score`
- AND 文本 SHALL NOT 包含中文“评分”
- AND 文本 SHALL NOT 包含中文“等级”

