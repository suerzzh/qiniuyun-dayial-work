# UniSpeaking Integration Findings

## Workspace

- Git 根目录：`/Users/mac/Documents/七牛云`
- 当前分支：`codex/integrate-free-chat-v2`
- `7.16` 当前整体为父仓库未跟踪目录。
- 父仓库存在相邻目录和 `.DS_Store` 的既有改动，必须保持不变。
- `7.16` 包含 `UniSpeaking`、`UniSpeaking_React`、`.DS_Store` 和一个约 18MB 的无扩展名 `task_plan`。

## Instructions

- 未发现位于 `/Users/mac/Documents/七牛云` 或 `7.16` 路径上的 `AGENTS.md`。
- 领域技能要求：不暴露 Supabase service role/secret；Vite `VITE_` 变量仅允许公开配置；浏览器验证需使用应用内浏览器能力。

## Pending Audit

- `UniSpeaking_React` 是完整 UI：Vite + React 18 + JSX + 原生 CSS，npm 锁文件存在；当前只有 `dev`、`build`、`preview` 脚本。
- `UniSpeaking` 是真实自由对话 Demo：静态 `webrtc_demo.html` + Python 后端，而不是 Node/Express/WebSocket。
- Demo 浏览器使用 WebRTC 与阿里云百炼 Qwen Realtime 通信，Python 后端负责临时密钥签发、SDP 代理、会话业务逻辑和本地数据文件。
- `task_plan` 是包含旧 `UniSpeaking_React` 副本（含 `node_modules`/`dist`）的 ZIP，不是运行入口；保留不动。
- UI README 明确指定 `src/views/ConversationView.jsx` 为融合目标，但其中的 WebRTC 示例只是说明，真实实现必须从 Demo 拆分复用。
- Demo 已声明的服务端环境变量名：`DASHSCOPE_API_KEY`、`DASHSCOPE_USE_TEMP_KEY`、`DASHSCOPE_TEMP_KEY_TTL_SECONDS`、`BAILIAN_WORKSPACE_ID`、`BAILIAN_MODEL`、`DEMO_USER_ID`、`SESSION_IDENTITY_OUTPUT_FILE`、`VAD_SILENCE_DURATION_MS`、`IDLE_TIMEOUT_MS`、`LATENCY_REPORT_FILE`、`BASE_SYSTEM_PROMPT`、`LEARNER_PROFILE_FILE`、`BACKEND_HOST`、`BACKEND_PORT`、`ALLOWED_ORIGINS`，另有 `DASHSCOPE_REGION` 仅出现在现有本地 `.env` 名称清单中。

## Package Management

- 主应用采用 npm（`package-lock.json`）；不得切换到 pnpm/yarn/bun。
- Demo 后端采用 Python `requirements.txt` 和现有 `.venv`。

## UI Routing and Current Free Chat

- 主应用入口：`UniSpeaking_React/src/main.jsx`；根组件：`src/App.jsx`。
- 路由不是 React Router，而是 `App.jsx` 内基于 `window.location.hash` 的手写 hash router；自由对话入口为 `#/conversation`，静态托管刷新不会依赖服务端 fallback。
- 现有自由对话页：`src/views/ConversationView.jsx`。它只操作 UI 状态和本地演示消息：语音球切文字显示、麦克风按钮切 `ready/listening`、文本提交写本地数组、结束按钮 reset；没有媒体或实时连接。
- 现有测试引用已不存在的旧 `.mjs` 源文件，测试基线与当前 React 代码不一致；需在实施时用新的可测试模块修复关键测试路径。

## Demo Realtime Flow

- Demo 入口：`UniSpeaking/webrtc_demo.html`。
- 启动顺序：创建后端会话 → 创建单个 `RTCPeerConnection` → 请求 `getUserMedia({audio:true})` → 先关闭媒体门控并移除 sender track → 创建 `oai-events` DataChannel → 生成 Offer → `POST /api/realtime?session_id=...` 交换 SDP → 设置 Answer → 收到 `session.created` 后重新挂载音轨并发送服务端生成的 `session.update` → `session.updated` 后请求 AI greeting。
- 远端音频：`pc.ontrack` 将 stream 绑定隐藏 `<audio autoplay playsInline>`；另建一个 `AudioContext`/Analyser 监测是否可听，用于 AI 播放状态、首音频和打断停止延迟。
- 字幕事件：用户 `input_audio_buffer.speech_started/stopped`、`conversation.item.input_audio_transcription.delta|text|completed|failed`；AI `response.created`、`response.audio_transcript.delta|done`、`response.text.delta|done`、`response.done`。
- 文本发送协议：`conversation.item.create`（message/user/input_text）后发送 `response.create`。
- 工具调用：`response.function_call_arguments.done` 转发后端 learner-level 接口，再回送 `function_call_output` 和 `response.create`。
- 结束清理：停止本地 tracks、关闭 PeerConnection、解绑并移除远端 audio、取消 RAF/interval/timeout、断开 analyser/source、关闭 AudioContext、等待事件/延迟写入、记录质量、DELETE 后端 session。
- Demo 不提供产品层暂停/恢复或自动重连；`failed/disconnected/closed` 会静默调用结束流程。融合时需新增状态映射和受控重试路径。
- Demo 的远端录音下载是诊断附加能力，不属于当前产品验收，可不迁移以避免额外 MediaRecorder 和 Blob 生命周期。

## Historical Deployment Relationship

- `7.16` 当前没有 `vercel.json`、`.vercel/project.json`、`supabase/config.toml`、migration 或 Edge Function。
- 只读历史版本 `7.14/UniSpeaking_Complete_UI` 记录了已部署结构：Vercel 项目 `unispeaking-web` 托管静态 UI；Supabase 项目 ref `ropgifqbblzktgxllupi` 的 `realtime-gateway` Edge Function 代理百炼 SDP，并以 Postgres 表持久化会话/最终字幕/指标。
- 历史 Edge Function、`supabase/config.toml` 与 migration 均存在；project ref 为 `ropgifqbblzktgxllupi`，migration 创建五张默认拒绝的 RLS 表。本轮仍不执行或修改该 migration。
- 历史浏览器公开配置包含 Supabase URL 与 publishable key（可公开配置，不是服务端 secret）；百炼 Key、Supabase service role/secret 仅由 Edge Function 环境读取。
- `7.16` 新 Demo 的 Python 后端能力比历史 Edge Function 更新：临时 DashScope Key、provider session 绑定、session identity、细粒度延迟/质量记录和更完整 prompt 尚未同步到历史 Edge Function。
- 当前实时线上服务据历史文档位于 Supabase Edge Function；`7.16/UniSpeaking` Python 后端是本地常驻服务。后者依赖进程内 session 和本地 JSON/Markdown 文件，不能原样作为 Vercel 短生命周期函数部署。

## Visual Baseline

- 已查看桌面和移动端自由对话验收截图；品牌色、留白、圆角和 44px 触控目标可作为视觉参考。
- 截图与当前 React `ConversationView.jsx` 存在结构差异（旧截图含侧栏/标题/话题按钮，当前代码使用红色语音球和底部胶囊控制器）；最终以当前代码启动后的浏览器基线为主，避免恢复旧页面结构。

## Baseline Verification

- UI Node 测试：13 个中 4 通过、9 失败；根因是测试引用旧静态 `.mjs` 文件和旧 HTML 结构。
- UI build：现有复制的 `node_modules` 缺少 macOS Rollup optional package；需依据现有 lockfile 执行 `npm ci`。
- Python unittest：12/12 通过；有 aiohttp 弃用警告。
- 当前 UI 缺少 `.gitignore` 和 `.env.example`，且没有 lint/typecheck/test scripts。

## Implementation Findings

- 产品页现在由 `useRealtimeSession` 消费纯 reducer；一个 client ref 组合唯一 microphone、audio playback、PeerConnection 和 DataChannel。
- 本地真实百炼链路成功：麦克风权限、SDP 200、DataChannel、provider session、AI 开场字幕和第二轮文字回复均有浏览器/后端证据。
- AI 回复期间 UI 曾进入 `ai_speaking` 文案，证明远端音频 analyser 检测到可听能量；自动化浏览器没有向麦克风说真人英语，用户语音转写仍需人工设备补验。
- 正常结束触发质量记录和后端 session DELETE；单元测试覆盖重复 start、断线、retry 和幂等 teardown。
- Preview 当前阻塞于新版实时后端没有公开 HTTPS staging 地址；Python 进程内 session/本地文件不能原样放入 Vercel Serverless。
