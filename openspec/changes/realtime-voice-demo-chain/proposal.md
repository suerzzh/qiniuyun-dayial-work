# Proposal: Realtime Voice Demo Chain

## Intent

把上一轮《国内端到端 Realtime 语音 Demo 开发设计文档》落成可执行开发规约，使后续 AI 实现时不需要再判断供应商、协议、功能范围、事件格式、页面状态或验收方式。

本变更的唯一目标是跑通自由对话实时语音链路：

```text
浏览器麦克风输入
  -> Demo 后端
  -> Qwen-Omni-Realtime WebSocket
  -> Demo 后端
  -> 浏览器对话文本展示与音频播放
  -> 用户结束通话
```

## Scope

In scope:

- 自由对话页面的最小链路 UI。
- 浏览器麦克风授权与音频采集。
- 浏览器到 Demo 后端的 WebSocket 连接。
- Demo 后端到 Qwen-Omni-Realtime 的 WebSocket 代理连接。
- 用户语音输入转发。
- 用户转写文本展示。
- AI 文本回复展示。
- AI 音频回复播放。
- 通话计时。
- 用户主动结束通话。
- 连接、权限、供应商错误的可理解提示。
- 简单调试日志。
- 不保存用户录音。

Out of scope:

- WebRTC 接入。
- 豆包端到端实时语音适配。
- ASR + LLM + TTS 串联兜底。
- 用户登录、账号、会员、支付。
- 评分、纠错、CEFR、发音评测。
- 错题本、学习报告、完整个人主页。
- 录音文件保存、音频回放历史。
- 多场景训练、IELTS、面试、场景广场。

## Fixed Decisions

后续实现必须遵守以下决策：

1. MUST 使用 Qwen-Omni-Realtime 作为唯一供应商。
2. MUST 使用 WebSocket 作为唯一 Realtime 协议。
3. MUST 由 Demo 后端持有供应商 API Key。
4. MUST 由 Demo 后端代理供应商 WebSocket。
5. MUST 使用统一内部事件契约向浏览器转发状态、文本、音频和错误。
6. MUST 不保存用户录音。
7. MUST 不输出评分、纠错、CEFR 或发音评测结果。

## Source Material

- `/Users/mac/Documents/七牛云/7.9/国内端到端Realtime语音Demo开发设计文档.md`
- `/Users/mac/Documents/七牛云/7.8/UniSpeaking产品设计书初稿.md`
- `/Users/mac/Documents/七牛云/7.8/AI口语训练场景体系Proposal.md`

