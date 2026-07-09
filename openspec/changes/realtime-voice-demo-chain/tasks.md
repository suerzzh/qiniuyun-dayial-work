# Tasks: Realtime Voice Demo Chain

本任务清单用于后续 AI 直接执行开发。执行时不得重新选择供应商、协议或功能范围。

## 0. Preflight

- [x] 0.1 确认工作目录为 `/Users/mac/Documents/七牛云`。
  - 完成判定：执行者能列出 `7.9/国内端到端Realtime语音Demo开发设计文档.md`。
- [x] 0.2 阅读本 change 的 `proposal.md`、`design.md` 和三个 `spec.md`。
  - 完成判定：执行者能说明本期固定为 Qwen-Omni-Realtime WebSocket 后端代理链路。
- [x] 0.3 确认不实现 WebRTC、豆包、ASR+LLM+TTS 串联、登录、评分、纠错、录音保存。
  - 完成判定：实现计划中不出现上述功能任务。

## 1. Project Skeleton

- [x] 1.1 创建最小前后端同仓 Node.js Web Demo。
  - 完成判定：存在根目录 `package.json`，并固定使用 Vite + React + TypeScript 前端、Express + `ws` + TypeScript 后端。
- [x] 1.2 添加 `.env.example`。
  - 完成判定：`.env.example` 包含 `DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID`、`DASHSCOPE_REGION`、`REALTIME_MODEL_NAME`、`MAX_CALL_SECONDS`，且不包含真实 Key。
- [x] 1.3 添加 README 或启动说明。
  - 完成判定：说明中包含安装、配置环境变量、启动 Demo、访问页面的步骤。
- [x] 1.4 添加固定开发脚本。
  - 完成判定：`npm run dev` 同时启动前端 `http://localhost:5173` 和后端 `http://localhost:8787`。

## 2. Backend Realtime Session

- [x] 2.1 实现后端环境变量读取和校验。
  - 完成判定：缺少 `DASHSCOPE_API_KEY` 或 `DASHSCOPE_WORKSPACE_ID` 时，创建会话返回 `provider_config_missing`。
- [x] 2.2 实现浏览器 WebSocket 入口 `/api/realtime/client`。
  - 完成判定：浏览器可以通过 `ws://localhost:8787/api/realtime/client` 建立 WebSocket 连接。
- [x] 2.3 实现 `call_id` 生成。
  - 完成判定：每次 `client.start` 后的所有后端事件都有相同 `call_id`。
- [x] 2.4 实现后端到 Qwen-Omni-Realtime 的 WebSocket 连接。
  - 完成判定：后端使用 `DASHSCOPE_WORKSPACE_ID`、`DASHSCOPE_REGION`、`REALTIME_MODEL_NAME` 拼接供应商地址，并使用 `Authorization: Bearer` 鉴权。
- [x] 2.5 实现供应商会话初始化。
  - 完成判定：初始化内容包含系统提示词、`text/audio` 输出模态、输入 PCM 16 kHz、输出 PCM 24 kHz 和音色。
- [x] 2.6 实现浏览器事件到供应商事件的转发。
  - 完成判定：`client.audio` 会被转发给供应商 WebSocket。
- [x] 2.7 实现供应商事件到统一后端事件的归一化。
  - 完成判定：后端能输出 `server.user_transcript_delta`、`server.user_transcript_final`、`server.ai_text_delta`、`server.ai_audio_delta`、`server.error` 中的实际可用事件。
- [x] 2.8 实现结束通话清理。
  - 完成判定：收到 `client.stop` 后，后端关闭供应商 WebSocket，并向浏览器发送 `session.closed`。
- [x] 2.9 实现 `MAX_CALL_SECONDS` 超时关闭。
  - 完成判定：通话超过配置秒数后，后端发送 `call_timeout` 并关闭连接。

## 3. Browser Realtime Client

- [x] 3.1 实现自由对话页面的五个区域：状态栏、消息列表、控制区、错误提示区、调试面板。
  - 完成判定：页面初始打开时显示“准备开始自由对话”和“开始对话”按钮。
- [x] 3.2 实现 UI 状态机。
  - 完成判定：页面状态只使用 `design.md` 中列出的状态名。
- [x] 3.3 实现麦克风授权。
  - 完成判定：点击开始后浏览器请求麦克风权限；拒绝时显示 `mic_permission_denied` 对应中文提示。
- [x] 3.4 实现浏览器连接 Demo 后端 WebSocket。
  - 完成判定：麦克风授权成功后页面进入 `connecting_app`，连接成功后发送 `client.start`。
- [x] 3.5 实现麦克风音频采集与 PCM 16 kHz mono 分片。
  - 完成判定：收到 `session.ready` 后，浏览器开始发送 `client.audio`，每片目标 100 ms。
- [x] 3.6 实现用户转写展示。
  - 完成判定：`server.user_transcript_delta` 显示为临时用户文本，`server.user_transcript_final` 固化为正式用户消息。
- [x] 3.7 实现 AI 文本展示。
  - 完成判定：`server.ai_text_delta` 追加到当前 AI 消息。
- [x] 3.8 实现 AI 音频播放。
  - 完成判定：`server.ai_audio_delta` 可排队播放，`server.ai_audio_done` 结束当前播放段。
- [x] 3.9 实现结束通话按钮。
  - 完成判定：点击结束后发送 `client.stop`，停止麦克风轨道，清空音频队列，计时停止。
- [x] 3.10 实现调试面板。
  - 完成判定：调试面板展示 `call_id`、provider、model、状态、首个转写延迟、首个 AI 音频延迟、最后事件、最后错误。

## 4. Event Contract Compliance

- [x] 4.1 后端所有事件使用统一信封。
  - 完成判定：每个后端事件都有 `type`、`call_id`、`ts`、`payload`。
- [x] 4.2 浏览器只发送允许的客户端事件。
  - 完成判定：浏览器只发送 `client.start`、`client.audio`、`client.stop`、`client.ping`。
- [x] 4.3 错误码与用户文案完全匹配 `design.md`。
  - 完成判定：每个错误码在 UI 中展示对应中文提示，在调试面板展示 code。
- [x] 4.4 事件和日志不暴露 API Key。
  - 完成判定：浏览器网络消息中搜不到 `DASHSCOPE_API_KEY` 或 `Authorization`。

## 5. Privacy and Guardrails

- [x] 5.1 禁止保存用户录音。
  - 完成判定：通话后项目目录中没有新增录音文件或音频历史文件。
- [x] 5.2 禁止日志输出完整音频 Base64。
  - 完成判定：后端控制台和调试面板不会打印完整 `audio_base64`。
- [x] 5.3 禁止学习评价输出。
  - 完成判定：结束页不出现评分、纠错、CEFR、发音评测、错题本、学习报告。
- [x] 5.4 固定系统提示词。
  - 完成判定：供应商会话初始化使用 `design.md` 中的完整系统提示词。

## 6. Manual Acceptance

> 以下为手工验收项，需要配置真实 `DASHSCOPE_API_KEY` 后在浏览器中联调验证。

- [ ] 6.1 成功启动 Demo。
  - 完成判定：浏览器可打开自由对话页面。
- [ ] 6.2 麦克风授权成功链路。
  - 完成判定：点击开始、授权麦克风后进入 `connected`。
- [ ] 6.3 三轮对话验收。
  - 完成判定：用户完成 3 轮英语发言后，页面至少展示 3 条用户消息和 3 条 AI 消息。
- [ ] 6.4 AI 语音播放验收。
  - 完成判定：至少听到 1 次 AI 语音回复。
- [ ] 6.5 结束通话验收。
  - 完成判定：点击结束后页面进入 `ended`，麦克风停止，AI 音频停止，连接关闭。
- [ ] 6.6 配置缺失失败验收。
  - 完成判定：移除 `DASHSCOPE_API_KEY` 后启动通话，页面展示配置缺失提示，调试面板展示 `provider_config_missing`。
- [ ] 6.7 后端不可用失败验收。
  - 完成判定：后端未运行时点击开始，页面展示“无法连接本地实时语音服务，请确认服务已启动。”
- [ ] 6.8 隐私验收。
  - 完成判定：验收完成后没有用户录音文件，没有完整音频 Base64 日志，没有 API Key 暴露到浏览器。

## 7. Completion

- [ ] 7.1 所有任务勾选完成。
- [ ] 7.2 所有 `spec.md` 场景均可手工验证。
- [x] 7.3 更新根目录 `progress.md`，记录实现、测试和剩余风险。
- [ ] 7.4 在最终回复中给出运行方式、验收结果和未完成项。
