# 国内端到端 Realtime 语音 Demo 进度记录

## 2026-07-09

- 读取并遵循 `planning-with-files` 与 `superpowers:brainstorming`。
- 检查当前仓库文件，确认已有 7.7、7.8 产品资料。
- 读取 7.8 中自由对话、产品定位、验收标准相关内容。
- 确认 `/Users/mac/Documents/七牛云/7.9` 目录已存在。
- 创建本次任务的 `task_plan.md`、`findings.md`、`progress.md`。
- 浏览并核对 Qwen-Omni、Qwen-Omni-Realtime、Qwen2.5-Omni 公开资料。
- 搜索豆包/火山方舟实时语音公开文档，未找到与 Qwen-Omni-Realtime 同等可落地的公开 API 文档，记录为需要实测/权限确认。
- 写入正式开发设计文档：`7.9/国内端到端Realtime语音Demo开发设计文档.md`。
- 自检文档覆盖 Demo 目标、国内 Realtime 方案、最小功能、页面状态、技术链路、环境变量、Prompt、日志、验收标准、风险与备选方案。
- 扫描占位词 `TODO|TBD|待定|xxx|sk-`，未发现未替换占位。

## 2026-07-09 实现（OpenSpec change: realtime-voice-demo-chain）

### 实现

- 使用 `openspec-apply-change` skill，基于 `openspec/changes/realtime-voice-demo-chain` 规约完成代码实现。
- Demo 代码位于 `7.9/realtime-voice-demo/`，前后端同仓。
- 固定技术栈：Vite + React + TypeScript 前端（5173）、Express + ws + TypeScript 后端（8787）。
- 链路：浏览器麦克风 -> Demo 后端 WebSocket -> Qwen-Omni-Realtime WebSocket -> 浏览器文本展示与音频播放。

### 文件清单

- `package.json` / `.env.example` / `README.md` / `tsconfig.json` / `tsconfig.server.json` / `vite.config.ts` / `index.html`
- `shared/types.ts`：统一事件契约（信封、客户端事件白名单、错误码）
- `shared/constants.ts`：状态名、状态文案、错误码用户文案、固定系统提示词、AI 开场白
- `server/config.ts`：环境变量读取校验 + Qwen 地址拼接
- `server/callId.ts`：call_id 生成（call_yyyyMMddHHmmss_random6）
- `server/qwenProvider.ts`：Qwen WebSocket 连接、session.update 初始化、事件归一化
- `server/realtimeSession.ts`：会话绑定、事件转发、清理、超时、调试日志
- `server/server.ts`：Express + ws 入口（/api/realtime/client、/api/health）
- `src/audioCapture.ts`：麦克风 PCM 16kHz mono 100ms 分片
- `src/audioPlayer.ts`：PCM 24kHz 播放队列
- `src/realtimeClient.ts`：浏览器 WebSocket 客户端
- `src/useRealtimeCall.ts`：UI 状态机 + 事件处理 Hook
- `src/App.tsx` / `src/index.css`：五区域页面（状态栏、消息列表、控制区、错误提示区、调试面板）

### 测试

- `npm install`：成功（183 包）。
- 后端 typecheck（tsc -p tsconfig.server.json --noEmit）：通过，0 错误。
- 前端 typecheck（tsc -p tsconfig.json --noEmit）：通过，0 错误。
- `npm run build`：成功，产物 155KB（gzip 50KB）。
- `npm run dev:server`：后端成功监听 8787，无 .env 时正确报告 `provider_config_missing`（DASHSCOPE_API_KEY/DASHSCOPE_WORKSPACE_ID/REALTIME_MODEL_NAME 缺失）。
- `/api/health`：返回 provider/model/region/config_ready/missing_vars，不暴露 API Key。

### 事件归一化映射（Qwen -> 统一事件）

- `session.updated` -> `session.ready`
- `conversation.item.input_audio_transcription.delta` -> `server.user_transcript_delta`（text+stash）
- `conversation.item.input_audio_transcription.completed` -> `server.user_transcript_final`
- `response.text.delta` -> `server.ai_text_delta`
- `response.text.done` -> `server.ai_text_done`
- `response.audio.delta` -> `server.ai_audio_delta`（pcm 24kHz）
- `response.audio.done` -> `server.ai_audio_done`
- `error` -> `server.error`

### 任务进度

- 第 0-5 节（Preflight / Skeleton / Backend / Frontend / Event Contract / Privacy）：全部完成并勾选（tasks.md）。
- 第 6 节（Manual Acceptance）：未勾选，需配置真实 DASHSCOPE_API_KEY 后在浏览器中联调。
- 第 7 节：7.3 已完成（本 progress.md）；7.1/7.2/7.4 待第 6 节验收通过后勾选。

### 剩余风险

1. 真实 Qwen 账号权限与地域开通未验证，可能影响首次连接成功率。
2. 首包延迟、连续 3-5 分钟通话稳定性需实测。
3. 浏览器 PCM 重采样采用线性抽取，音质与识别效果需实测。
4. 用户语音打断 AI 播放本期未实现（design.md 明确标注为后续）。
5. Qwen 事件字段（如 transcription.delta 的 text+stash 拼接）基于公开文档实现，需联调确认。

