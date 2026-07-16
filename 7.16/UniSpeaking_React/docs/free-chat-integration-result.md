# UniSpeaking 自由对话融合结果

完成日期：2026-07-16  
分支：`codex/integrate-free-chat-v2`  
范围：仅本地融合与验收；未部署 Vercel Preview/Production，未修改生产 Supabase。

## 1. 最终融合架构

`UniSpeaking_React` 是唯一产品前端和 React 根应用。`UniSpeaking/webrtc_demo.html` 保留为诊断参考，但产品不再跳转、嵌入或依赖该页面。

```text
App / #/conversation
  -> ConversationView（现有产品视觉）
    -> useRealtimeSession（React 生命周期与 actions）
      -> realtime-state（纯 reducer、字幕和产品状态）
      -> RealtimeClient（单一连接与 teardown）
        -> microphone（单一 MediaStream）
        -> audio-playback（单一 Audio / AudioContext / analyser）
        -> realtime-api（HTTP/SDP 适配）
          -> UniSpeaking/backend/app.py（服务端密钥）
            -> 阿里云百炼 Qwen Realtime（WebRTC + DataChannel）
```

显式状态覆盖：未开始、请求麦克风、连接中、已连接、用户说话、AI 思考、AI 播放、用户打断、暂停/恢复、网络断开、重试、正常结束和异常结束。

## 2. 主要调用链

1. 用户点击语音球，Hook 调用唯一 `RealtimeClient.start()`。
2. 后端 `POST /api/sessions` 创建 session 并返回服务端生成的 realtime config。
3. 浏览器请求一次麦克风，建立一个 `RTCPeerConnection` 和 `oai-events` DataChannel。
4. 本地音轨先通过 `replaceTrack(null)` 门控；Offer SDP 由 `POST /api/realtime` 代理到百炼。
5. 收到 `session.created` 后恢复 sender track、发送 `session.update` 并绑定 provider session。
6. DataChannel 的用户转写、AI transcript、response 与 tool 事件进入 reducer，页面渲染实时气泡和状态。
7. 远端 track 交给唯一播放器；Analyser RMS 映射 AI 正在播放与打断状态。
8. 正常结束、断线、异常或页面卸载统一走幂等 teardown：关闭 channel/peer、停止 tracks、停止音频、取消 RAF、关闭 AudioContext，并关闭后端 session。

## 3. 修改文件

### 主应用修改

- `package.json`、`package-lock.json`：增加固定版本的 ESLint、TypeScript 与 React 类型工具，新增 lint/typecheck/test 脚本；未升级 React/Vite。
- `src/App.jsx`：抽取路由函数，移除自由对话模拟 reset 接线，把产品页交给真实会话模块。
- `src/views/ConversationView.jsx`：保留视觉类名与布局，接入实时字幕、状态、开始、重试、暂停、静音、文字和结束行为。
- `styles.css`：只增加真实状态、错误/重试、partial subtitle、静音和 disabled 样式。
- `vite.config.js`：本地开发和 preview 固定为 `127.0.0.1:8080`，匹配后端 CORS。
- `src/views/ScenesView.jsx`、`src/views/MembershipView.jsx`：修复浏览器发现的 JSX `class` 控制台警告。
- `README.md`：改为当前架构、前后端启动、安全、验证与部署关系说明。
- `tests/state.test.mjs`、`tests/router.test.mjs`、`tests/review-policy.test.mjs`、`tests/training-flow.test.mjs`、`tests/static-ui.test.mjs`：迁移过时静态断言到当前 React/模块结构。

### 后端文档与本地配置修改

- `../UniSpeaking/README.md`：路径从 `7.14` 更新为 `7.16`，产品入口改为 React `#/conversation`。
- `../UniSpeaking/.env.example`：补齐 `LOG_LEVEL` 和旧兼容配置名说明；没有真实值。
- `../UniSpeaking/.gitignore`：忽略本地 latency Markdown 和 session identity 输出。

## 4. 新增文件

- `.gitignore`：忽略前端 env、本地配置、依赖和构建产物。
- `.env.example`：公开的 `VITE_REALTIME_API_BASE` 示例。
- `eslint.config.js`、`tsconfig.json`：可信的 lint 与 checkJs typecheck 配置。
- `vercel.json`：未来静态托管使用的安全头与 hash 资源缓存；本轮未部署。
- `src/router.mjs`：可测试的 hash 路由解析与全局导航映射。
- `src/hooks/useRealtimeSession.js`：React 生命周期、单一 client ref、操作封装和卸载清理。
- `src/realtime/realtime-state.mjs`：产品会话 reducer、字幕合并、错误与状态文案。
- `src/realtime/realtime-client.mjs`：WebRTC/DataChannel、media gate、provider 绑定、工具调用、质量指标与 teardown。
- `src/realtime/microphone.mjs`：麦克风单一所有者、静音/暂停分离和停止。
- `src/realtime/audio-playback.mjs`：远端音频、RMS、暂停/恢复和关闭 AudioContext。
- `src/services/realtime-api.mjs`：Python API/SDP 客户端与安全错误映射。
- `tests/realtime-state.test.mjs`、`tests/realtime-api.test.mjs`、`tests/microphone.test.mjs`、`tests/audio-playback.test.mjs`、`tests/realtime-client.test.mjs`、`tests/conversation-integration.test.mjs`：关键链路最小测试。
- `docs/free-chat-integration-audit.md`：项目、部署和实时链路审计。
- `docs/superpowers/specs/2026-07-16-free-chat-integration-design.md`：融合设计。
- `docs/superpowers/plans/2026-07-16-free-chat-integration.md`：TDD 实施计划。
- `docs/free-chat-integration-result.md`：本结果文档。

## 5. 删除或废弃文件

- 未删除任何现有可运行版本。
- `UniSpeaking/webrtc_demo.html` 仍可作为底层诊断参考，但已废弃为产品入口。
- `App.jsx` 与旧 `ConversationView.jsx` 中的模拟会话行为已删除；页面不再写入假 AI 消息。

## 6. 本地启动命令

后端：

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m backend.app
```

前端：

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking_React
npm ci
npm run dev
```

产品入口：<http://127.0.0.1:8080/#/conversation>  
后端健康检查：<http://127.0.0.1:8000/health>

## 7. 测试与构建结果

- 前端 Node tests：39/39 通过。
- ESLint：通过。
- TypeScript checkJs：通过。
- Vite production build：通过。
- Python unittest：12/12 通过；存在 aiohttp `AppKey`/bare handler 弃用警告，不阻断本轮。
- `npm audit --omit=dev`：0 漏洞；完整 `npm audit`：2 个 Vite 5/esbuild 开发服务器工具链问题（1 moderate、1 high），自动修复要求破坏性升级到 Vite 8，未执行 `--force`。
- 客户端构建密钥扫描：PASS；`dist` 未命中服务端变量名、Supabase service role 词样或常见 `sk-`/`st-` 密钥格式。
- 浏览器：移动/桌面产品 UI 可见；`#/scenes` 与 `#/conversation` 往返、自由对话刷新/直达通过。
- 真实会话：麦克风授权通过；session 创建、临时 Key 代理、SDP 200、provider session 绑定和 DataChannel 成功。
- 实时输出：AI 开场英文字幕显示；远端音频能量触发 AI 播放状态；文字输入产生用户气泡和第二轮 AI 字幕。
- 控制：静音不改变连接状态；暂停/恢复保持静音独立状态；正常结束回到 ended，后端收到 quality POST 与 session DELETE。
- 控制台：场景、会员、自由对话的干净标签页最终复测 warning/error 为 0。

## 8. 环境变量

只列名称，不记录值。

### 浏览器

- `VITE_REALTIME_API_BASE`

### Python 服务端

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_USE_TEMP_KEY`
- `DASHSCOPE_TEMP_KEY_TTL_SECONDS`
- `BAILIAN_WORKSPACE_ID`
- `BAILIAN_MODEL`
- `DEMO_USER_ID`
- `SESSION_IDENTITY_OUTPUT_FILE`
- `VAD_SILENCE_DURATION_MS`
- `IDLE_TIMEOUT_MS`
- `LATENCY_REPORT_FILE`
- `BASE_SYSTEM_PROMPT`
- `LEARNER_PROFILE_FILE`
- `CONVERSATION_MEMORY_FILE`（旧兼容）
- `BACKEND_HOST`
- `BACKEND_PORT`
- `ALLOWED_ORIGINS`
- `LOG_LEVEL`

## 9. 未解决问题

- 自动化浏览器没有向本机麦克风说出可转写的真人句子，因此“用户实际发声 → 实时转写气泡”仍需人工说一句英语完成最终设备验收。麦克风权限、audio sender 门控/恢复和真实 WebRTC 建连已通过，相关资源逻辑另有自动化测试。
- Python 后端依赖进程内 session 和本地 JSON/Markdown 文件，不适合原样部署到 Vercel Serverless，也未配置公开 HTTPS Preview 地址。
- 历史 Supabase `realtime-gateway` 缺少新版 Python 后端的部分能力；Preview 前必须选择同步 Edge Function 或部署 staging Python 服务。
- 正式域名 `app.unispeaking.cn` 的 DNS/Vercel 绑定不在当前仓库，尚未验证。
- Python 测试仍有 aiohttp 弃用警告，可在后续维护中迁移到 `web.AppKey` 和 async OPTIONS handler。
- 完整依赖审计的 2 个开发服务器工具链问题只可通过 Vite 8 破坏性升级自动修复；production-only audit 为 0。Preview 前应单独规划升级和回归，禁止直接执行 `npm audit fix --force`。

## 10. 部署前注意事项

当前本地融合可以进入人工麦克风补验，但暂不适合直接进入 Vercel Preview：前端 Preview 无法访问 `127.0.0.1:8000`，而新版实时后端没有公开 HTTPS staging 运行环境。

进入 Preview 前必须：

1. 选择并准备新版 staging 实时后端（常驻 Python 或同步后的 Supabase Edge Function）。
2. 服务端 CORS 加入 Preview origin，前端 `VITE_REALTIME_API_BASE` 指向 HTTPS staging 地址。
3. 在 staging 重新验证真人语音转写、AI 音频、断线重试和至少一次 3–10 分钟质量指标。
4. 确认 Preview/Production 环境中所有服务端密钥只存在于后端。
5. 验证 `app.unispeaking.cn` 绑定后再考虑 Production；本轮禁止且未执行任何部署。
