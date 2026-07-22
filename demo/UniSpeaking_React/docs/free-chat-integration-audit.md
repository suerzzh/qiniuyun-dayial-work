# UniSpeaking 自由对话融合审计

审计日期：2026-07-16  
工作分支：`codex/integrate-free-chat-v2`  
审计范围：`/Users/mac/Documents/七牛云/7.16`

## 1. 结论摘要

- 完整 UI 主应用是 `UniSpeaking_React`。它是 Vite 5 + React 18 + JSX + 原生 CSS 项目，使用 npm 和手写 hash router。
- 新版自由对话 Demo 是 `UniSpeaking`。它由单页 `webrtc_demo.html` 和 Python `aiohttp` 后端组成，真实链路使用 WebRTC + DataChannel + SDP 代理，不是 Node/Express/WebSocket。
- 主应用当前自由对话页只有模拟 UI 状态；Demo 已具备麦克风、百炼 Realtime 会话、AI 音频、增量字幕、工具调用、资源清理和质量诊断。
- 推荐以 `UniSpeaking_React` 为唯一 React 根应用，把 Demo 的底层能力拆成模块接入 `#/conversation`；本地连接现有 Python 后端，不嵌入 Demo 页面，不改生产 Supabase，不部署 Vercel。
- 历史版本显示当前已部署实时服务曾位于 Supabase Edge Function `realtime-gateway`，Web UI 位于 Vercel 项目 `unispeaking-web`。`7.16` 新 Python 后端包含尚未同步到该 Edge Function 的能力，因此本轮本地融合以 Python 后端为准。

## 2. 当前目录结构

```text
/Users/mac/Documents/七牛云/7.16/
├── UniSpeaking/                    # 新版自由对话 Demo
│   ├── .env                        # 本地服务端配置，已忽略，不读取/记录值
│   ├── .env.example
│   ├── .gitignore
│   ├── .venv/
│   ├── backend/
│   │   ├── app.py                  # aiohttp 后端入口与 HTTP/SDP API
│   │   ├── business_logic.py       # 教练 prompt、session config、档案逻辑
│   │   ├── temporary_key.py        # 百炼临时 Key 签发
│   │   ├── session_identity.py     # provider session 绑定与本地记录
│   │   ├── latency_report.py       # 延迟和 WebRTC 质量报告
│   │   └── requirements.txt
│   ├── data/                       # 本地开发记录，不作为 Web 客户端数据源
│   ├── tests/                      # Python unittest
│   └── webrtc_demo.html            # Demo 浏览器入口与完整实时链路
├── UniSpeaking_React/              # 完整 UI 主应用
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── styles.css
│   ├── src/
│   │   ├── main.jsx                # React 入口
│   │   ├── App.jsx                 # 全局状态、hash 路由和页面壳
│   │   ├── components/
│   │   └── views/
│   │       └── ConversationView.jsx # 当前自由对话页面
│   ├── tests/                      # 旧静态版遗留 Node 测试，当前基线不匹配
│   └── acceptance/                 # 历史视觉验收截图
└── task_plan                       # 旧 UI ZIP 包，不是运行入口
```

`task_plan` 是 ZIP 压缩包，包含旧 `UniSpeaking_React`、`node_modules` 和 `dist` 副本。它不会被解压、覆盖或作为融合来源。

## 3. 两套代码职责

### 3.1 `UniSpeaking_React`：产品外壳

- 负责顶部导航、页面路由、完整产品页面、视觉设计、响应式布局、按钮和提示。
- 入口：`src/main.jsx`。
- 根组件：`src/App.jsx`。
- 路由：`App.jsx` 中基于 `window.location.hash` 的正则匹配，不使用 React Router。
- 自由对话路由：`#/conversation`。
- 自由对话页面：`src/views/ConversationView.jsx`。
- 当前页面只切换 `ready/listening`、本地静音标记和本地演示消息，没有真实媒体资源或网络连接。

### 3.2 `UniSpeaking`：真实自由对话能力

- 浏览器负责麦克风、`RTCPeerConnection`、DataChannel、远端音频播放、字幕事件和 WebRTC 指标。
- Python 后端负责服务端密钥、百炼临时 Key、会话配置、SDP 代理、CORS、学习等级、事件记录和本地诊断文件。
- 浏览器入口：`webrtc_demo.html`。
- 后端入口：`python -m backend.app`，默认监听 `127.0.0.1:8000`。
- 后端框架：`aiohttp`，不是 Express。

## 4. 路由与页面入口

| 项目 | 入口 | 自由对话位置 | 路由方式 |
|---|---|---|---|
| 完整 UI | `UniSpeaking_React/src/main.jsx` | `src/views/ConversationView.jsx` | hash router，`#/conversation` |
| Demo 浏览器 | `UniSpeaking/webrtc_demo.html` | 同一 HTML 内部 | 无产品路由 |
| Demo 后端 | `UniSpeaking/backend/app.py` | `/api/*` 与 `/health` | aiohttp routes |

hash 路由不会要求静态托管服务为 `/conversation` 配置 rewrite；刷新 `/#/conversation` 会继续请求根 `index.html`。直接访问 `/conversation` 不是当前产品定义的路由。

## 5. Demo 实时调用链

1. `POST /api/sessions` 创建本地 session，返回 `session_id`、`conversation_id`、学习等级和服务端构造的 `session_config`。
2. 浏览器创建一个 `RTCPeerConnection`，请求一次 `getUserMedia({ audio: true })`。
3. 音轨先加入 PeerConnection，但在百炼 `session.created` 前通过 media gate 暂停发送。
4. 浏览器创建 `oai-events` DataChannel，生成 Offer SDP。
5. `POST /api/realtime?session_id=...` 将 SDP 发给 Python 后端。
6. 后端使用服务端 `DASHSCOPE_API_KEY`，可先签发 1–1800 秒临时 Key，再代理请求到百炼 Qwen Realtime，返回 Answer SDP。
7. 浏览器设置远端 Answer；DataChannel 收到 `session.created` 后绑定 provider session、恢复音轨并发送 `session.update`。
8. 收到 `session.updated` 后发送 `response.create`，AI 主动开场。
9. 用户转写、AI transcript、响应状态和工具调用从 DataChannel 持续进入页面。
10. 结束时停止 tracks、关闭 PeerConnection、移除远端 audio、取消 RAF/interval/timeout、关闭 AudioContext，并关闭后端 session。

## 6. 麦克风、连接、音频与字幕

### 6.1 麦克风

- 采集：`navigator.mediaDevices.getUserMedia({ audio: true })`。
- 发送：本地 audio track 加入唯一 PeerConnection sender。
- 媒体门控：在 `session.created` 前禁用 track/`replaceTrack(null)`，避免配置完成前发送音频。
- 静音：切换 audio track 的 `enabled`。
- 结束：遍历 `localStream.getTracks()` 执行 `stop()`。

### 6.2 WebRTC/DataChannel

- `RTCPeerConnection({ iceServers: [] })`。
- 浏览器生成 Offer；Python 仅代理 SDP，不转发实时音频。
- 实时事件通过名为 `oai-events` 的 DataChannel 双向传输。
- 当前 Demo 遇到 `failed/disconnected/closed` 会结束，没有自动重连。

### 6.3 AI 音频

- `pc.ontrack` 取得远端 stream。
- stream 绑定隐藏 `<audio autoplay playsInline>`。
- 单个 `AudioContext` + `AnalyserNode` 监测远端 RMS，用于识别首个可听音频、AI 播放中和用户打断后的静音时间。
- Demo 还使用 `MediaRecorder` 录制远端音频供下载；该诊断功能不属于产品验收，不建议迁移。

### 6.4 字幕与消息事件

用户：

- `input_audio_buffer.speech_started`
- `input_audio_buffer.speech_stopped`
- `conversation.item.input_audio_transcription.delta`
- `conversation.item.input_audio_transcription.text`
- `conversation.item.input_audio_transcription.completed`
- `conversation.item.input_audio_transcription.failed`

AI：

- `response.created`
- `response.audio_transcript.delta`
- `response.audio_transcript.done`
- `response.text.delta`
- `response.text.done`
- `response.done`

文本输入使用 `conversation.item.create`（`message` / `user` / `input_text`）后发送 `response.create`，与语音共享同一实时会话上下文。

## 7. 会话状态审计与产品映射

| 产品状态 | Demo 现状 | 融合处理 |
|---|---|---|
| 未开始 | `Ready` | `idle` |
| 请求麦克风权限 | 文本状态 | `requesting_microphone` |
| 正在建立连接 | 多段连接文案 | `connecting` |
| 已连接 | `connected` | `connected` |
| 用户正在说话 | `speech_started` | `user_speaking` |
| AI 思考/生成 | `response.created` | `ai_thinking` |
| AI 播放语音 | 远端音频 RMS | `ai_speaking` |
| 用户打断 AI | 已做延迟测量但无 UI 状态 | `interrupted`，由 AI 可听时收到 `speech_started` 触发 |
| 暂停/恢复 | Demo 缺失 | 保持连接，暂停/恢复本地麦克风与远端播放器 |
| 网络断开 | 直接结束 | `disconnected`，清理资源并显示重试入口 |
| 自动重连或重试 | Demo 缺失 | 本轮提供显式重试，避免无边界自动重复创建 session |
| 正常结束 | `endSession(false)` | `ended` |
| 异常结束 | `endSession(true)` + error | `error` |

## 8. 后端接口

| 方法与路径 | 用途 |
|---|---|
| `GET /health` | 安全配置摘要，只返回是否配置和 credential mode |
| `POST /api/sessions` | 创建内存 session，返回 session config |
| `GET /api/sessions/{id}/config` | 读取当前 session config |
| `POST /api/sessions/{id}/events` | 保存当前通话最终字幕到内存 session |
| `POST /api/sessions/{id}/tools/learner-level` | 校验并保存学习等级调整 |
| `POST /api/sessions/{id}/latency` | 写入逐轮延迟指标 |
| `POST /api/sessions/{id}/quality` | 写入通话 WebRTC 质量指标 |
| `GET /api/sessions/{id}/profile` | 本地查看当前 session 信息 |
| `POST /api/sessions/{id}/provider-session` | 绑定百炼 provider session id |
| `DELETE /api/sessions/{id}` | 关闭 session 并写本地 identity 记录 |
| `DELETE /api/conversations/{id}` | 删除本地学习档案 |
| `POST /api/realtime?session_id=...` | 服务端密钥代理 SDP |
| `GET /api/latency-report` | 读取本地 Markdown 指标报告 |

活动 session 存在 Python 进程内，学习档案和指标写本地文件。该运行时依赖常驻、可写文件系统的 Python 环境，不适合原样部署为 Vercel 短生命周期 Function。

## 9. package scripts 与测试基线

### UI `package.json`

- `npm run dev` → `vite`
- `npm run lint` → `eslint src`
- `npm run typecheck` → `tsc -p tsconfig.json`
- `npm test` → `node --test tests/*.test.mjs`
- `npm run build` → `vite build`
- `npm run preview` → `vite preview`

以上 lint/typecheck/test 脚本由本轮在审计基线后补齐，React/Vite 版本未升级。

### 修改前基线

- Node 测试：13 个测试中 4 个通过、9 个失败。失败根因是测试仍引用已删除的旧静态 `.mjs` 源文件或旧 HTML 结构。
- Vite build：失败。现有 `node_modules` 来自打包/复制环境，缺少当前 macOS 所需的 Rollup optional dependency；应使用现有 `package-lock.json` 执行干净的 `npm ci` 重新安装生成物，不删除 lockfile。
- Python unittest：12/12 通过；存在 aiohttp `AppKey`/bare handler 弃用警告，但不阻断本次融合。

## 10. 环境变量清单

只记录变量名，不记录值。

### 当前 Python 后端

| 变量名 | 端 | `.env.example` | 本地 `.env` 名称存在 |
|---|---|---:|---:|
| `DASHSCOPE_API_KEY` | 服务端 | 是 | 是 |
| `DASHSCOPE_USE_TEMP_KEY` | 服务端 | 是 | 是 |
| `DASHSCOPE_TEMP_KEY_TTL_SECONDS` | 服务端 | 是 | 是 |
| `BAILIAN_WORKSPACE_ID` | 服务端 | 是 | 是 |
| `BAILIAN_MODEL` | 服务端 | 是 | 是 |
| `DEMO_USER_ID` | 服务端 | 是 | 否（使用默认值） |
| `SESSION_IDENTITY_OUTPUT_FILE` | 服务端 | 是 | 否（使用默认值） |
| `VAD_SILENCE_DURATION_MS` | 服务端 | 是 | 是 |
| `IDLE_TIMEOUT_MS` | 服务端 | 是 | 是 |
| `LATENCY_REPORT_FILE` | 服务端 | 是 | 是 |
| `BASE_SYSTEM_PROMPT` | 服务端 | 是 | 是 |
| `LEARNER_PROFILE_FILE` | 服务端 | 是 | 是 |
| `BACKEND_HOST` | 服务端 | 是 | 是 |
| `BACKEND_PORT` | 服务端 | 是 | 是 |
| `ALLOWED_ORIGINS` | 服务端 | 是 | 是 |
| `LOG_LEVEL` | 服务端，可选 | 是（本轮补齐） | 否（使用默认值） |
| `CONVERSATION_MEMORY_FILE` | 服务端，旧兼容名 | 是（本轮补齐） | 否 |
| `DASHSCOPE_REGION` | 服务端，本地遗留/当前代码未读取 | 否 | 是 |

### 主应用前端

融合后仅新增以下公开环境变量：

| 变量名 | 端 | 是否可公开 | 用途 |
|---|---|---:|---|
| `VITE_REALTIME_API_BASE` | 浏览器 | 是 | Python 后端公开基础 URL；本地默认 `http://127.0.0.1:8000` |

不得新增 `VITE_DASHSCOPE_API_KEY`、`VITE_SUPABASE_SERVICE_ROLE_KEY` 或任何客户端服务端 secret。

### 历史 Supabase Edge Function（只读现状）

`SUPABASE_URL`、`SUPABASE_SECRET_KEYS`、`SUPABASE_PUBLISHABLE_KEYS`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_ANON_KEY`、`DASHSCOPE_API_KEY`、`BAILIAN_WORKSPACE_ID`、`BAILIAN_MODEL`、`ALLOWED_WEB_ORIGINS`。

## 11. Vercel 与 Supabase 现状

### `7.16` 当前目录

- 主应用本轮新增 `vercel.json`，只含静态安全头和静态资源缓存规则；没有执行部署。
- 无 `.vercel/project.json`。
- 无 `supabase/config.toml`。
- 无 `supabase/migrations` 或 Edge Functions。
- 无 Supabase Auth 客户端、数据库调用或 Realtime SDK 使用。

### 历史已部署版本（只读参考）

- Vercel 项目：`unispeaking-web`，历史文档记录站点为 `unispeaking-web.vercel.app`。
- Supabase project ref：`ropgifqbblzktgxllupi`。
- Edge Function：`realtime-gateway`，`verify_jwt = false`，函数内部校验 publishable key、Origin、限流和 session。
- migration：`202607140001_realtime_web.sql`。
- 表：`learner_profiles`、`realtime_sessions`、`session_messages`、`realtime_metrics`、`request_rate_limits`。
- 五张公开 schema 表均启用 RLS，并撤销 `anon`、`authenticated` 直接权限；Edge Function 使用服务端凭据访问。
- 没有使用 Supabase Auth 或 Supabase Realtime channel；这里的 “Realtime” 指百炼 WebRTC 服务。
- 用户声明正式域名为 `app.unispeaking.cn`，但 `7.16` 本地配置和历史 `vercel.json` 未记录该域名绑定，因此本轮无法从仓库验证 DNS/域名状态。

本轮融合不需要数据库结构变化，不创建 migration、不修改 schema、不 push Supabase。

## 12. 可复用代码

- Python 后端 `backend/`：整体复用为本地服务。
- Demo 的 session 创建、SDP 交换、provider session 绑定和学习等级接口协议。
- Demo 的媒体门控顺序、DataChannel 消息分发、文本消息协议和完整清理顺序。
- Demo 的字幕 upsert/rekey 规则和转写失败 fallback。
- Demo 的远端音频 RMS 监测，用于 AI 播放与打断状态。
- 历史 `7.14` 的 `realtime-client.mjs` / `realtime-state.mjs` 仅作为模块边界和测试方式参考；实际协议以 `7.16` Demo 为准。

## 13. 重复代码与潜在冲突

### 重复代码

- `webrtc_demo.html` 将 API、状态、WebRTC、音频、指标和 DOM 渲染写在同一脚本中。
- 历史 `7.14` 已有一套简化 realtime client/state，但缺少新版 Demo 的 provider session、媒体门控和更完整状态。
- `styles.css` 同时保留旧 `.conversation-view` 布局和后追加 `.conversation-view.doubao-theme` 规则。

### 潜在冲突

- 主 UI 当前 `voiceState` 只有 `ready/listening`；目标状态更多，不能继续用二值切换。
- 当前语音球点击只切换文字模式，真实产品中它需要承担开始/暂停/恢复；文字显示仍由独立 chat 按钮控制。
- 当前文本提交只写本地 state，必须改为发送 DataChannel 消息。
- React StrictMode 会执行开发期 effect setup/cleanup 检查；RealtimeClient 必须由稳定 ref 创建且 cleanup 幂等，避免双麦克风/双连接。
- Python 默认 CORS 允许 8080；Vite 默认 5173。应让本地主应用固定使用 8080，或由 `ALLOWED_ORIGINS` 显式加入实际端口。
- 当前 UI 缺少 `.gitignore`，已有 `dist`、`.vite` 和复制的 `node_modules`；必须新增忽略规则。
- 当前 Node 测试属于旧静态版，不能通过复制旧文件“修绿”；需要更新为当前 React/模块结构的测试。
- Demo 的 connectionState `disconnected` 可能是短暂状态。为避免无边界重连，本轮清理并显示显式重试入口，不自动循环创建 session。

## 14. 推荐融合方式

采用“React 页面壳 + 单一实时会话控制器 + 可测试状态 reducer + Python API 适配器”：

```text
ConversationView (现有产品页面)
  └─ useRealtimeSession (React 生命周期与 UI action)
       ├─ realtime-state (纯状态机、字幕合并、错误映射)
       ├─ realtime-client (唯一 PeerConnection/DataChannel 所有者)
       ├─ microphone (唯一 MediaStream 所有者)
       ├─ audio-playback (唯一 audio/AudioContext 所有者)
       └─ realtime-api (Python HTTP 接口适配器)
                         │
                         ▼
              UniSpeaking/backend/app.py
                         │ SDP + 服务端 Key
                         ▼
                Qwen Realtime WebRTC
```

备选方案及取舍：

1. **推荐：本地 Python 后端适配器。** 能完整复用新版 Demo 能力，不触碰生产，适合当前本地验收；缺点是 Vercel Preview 前必须准备可访问的 staging backend 或同步新版能力到 Supabase Edge Function。
2. **直接接历史 Supabase Edge Function。** 线上路径已验证，但它是旧协议/旧能力，且本轮接入会依赖生产外部状态，不符合“先本地、禁改生产”。
3. **把 Python 后端改成 Vercel Function。** 与内存 session、本地文件和实时会话生命周期冲突，改造范围大，不适合本次融合。

## 15. 预计与实际修改文件

主应用预计：

- `package.json` / `package-lock.json`：补齐 test、lint、typecheck 脚本和最小开发依赖。
- `.gitignore`：忽略 env、本地配置、`node_modules`、`dist`、`.vite`。
- `.env.example`：仅记录公开的 `VITE_REALTIME_API_BASE`。
- `vite.config.js`：本地端口和测试/构建需要的安全配置。
- `src/App.jsx`：删除自由对话底层模拟状态耦合，保留页面壳与路由。
- `src/views/ConversationView.jsx`：保留视觉结构，改接真实 hook/state/actions。
- `src/hooks/useRealtimeSession.js`：React 生命周期、显式重试、卸载清理。
- `src/realtime/realtime-state.mjs`：状态机、字幕合并和状态文案。
- `src/realtime/realtime-client.mjs`：PeerConnection/DataChannel/会话编排。
- `src/realtime/microphone.mjs`：麦克风请求、静音、暂停和释放。
- `src/realtime/audio-playback.mjs`：远端音频播放、RMS、暂停和释放。
- `src/services/realtime-api.mjs`：Python HTTP API。
- `tests/*`：替换不匹配旧源码的测试，并增加 realtime reducer/client/API/resource 测试。
- `styles.css`：只补充新状态、错误/重试和 disabled 样式，不重做视觉系统。
- `README.md`：前后端启动、环境、安全、测试与部署关系。
- `docs/free-chat-integration-result.md`：最终结果和验证证据。
- `vercel.json`：仅保存将来静态部署需要的安全头；本轮不部署。

实际实施与上述范围一致，并额外修改：

- `src/router.mjs`、`eslint.config.js`、`tsconfig.json`：恢复可信路由测试与静态检查工具链。
- `src/views/ScenesView.jsx`、`src/views/MembershipView.jsx`：修复浏览器验收发现的 React `class` 属性警告。
- `../UniSpeaking/README.md`、`.env.example`、`.gitignore`：更新 `7.16` 产品启动入口、可选配置名和本地产物忽略规则。

Demo 后端业务代码、Supabase schema、migration 和远程数据均未修改。

## 16. 风险点

- 真实语音验收依赖浏览器/macOS 麦克风权限、有效百炼服务端配置和网络。
- 浏览器自动播放策略可能阻止远端 audio `play()`；必须把启动放在用户手势链上并显示可恢复错误。
- `session.created` 前发送音频会产生配置竞态，必须保留 media gate。
- StrictMode、路由切换和错误重试容易产生重复连接，所有资源需要单一所有者和幂等 teardown。
- `disconnected` 可能短暂恢复；本轮采用显式重试而非无限自动重连。
- Python session 在进程重启后丢失，本地 JSON/Markdown 不适合多实例生产。
- 历史 Supabase Edge Function 与新版 Python 后端协议存在差异；Preview 前必须选择并完成一个 staging 后端方案。
- `app.unispeaking.cn` 的 DNS/Vercel 绑定不在当前仓库中，本轮不能验证。
- 当前 UI 测试基线陈旧、依赖目录跨环境复制；需要先恢复可信的本地依赖和测试基线。

## 17. 审计后实施状态

- 自由对话产品页已从模拟数据切换到真实 `useRealtimeSession`。
- 本地浏览器已完成麦克风授权、真实百炼 SDP/DataChannel 建连、AI 开场字幕与第二轮文字往返。
- 正常结束已观察到 quality POST 与 session DELETE；资源单一所有权和幂等清理由自动化测试覆盖。
- 完整验证证据与部署前阻塞项见 `docs/free-chat-integration-result.md`。
