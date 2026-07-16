# UniSpeaking 自由对话融合与上线结果

完成日期：2026-07-16  
分支：`codex/integrate-free-chat-v2`  
正式入口：<https://app.unispeaking.cn/#/conversation>

## 1. 最终融合架构

`UniSpeaking_React` 是唯一产品前端和 React 根应用。自由对话沿用完整产品 UI，通过单一实时客户端连接 Supabase Edge Function；旧 `webrtc_demo.html` 不再是产品入口。

```text
Vercel / app.unispeaking.cn
  -> App / #/conversation
    -> ConversationView
      -> useRealtimeSession
        -> realtime-state reducer
        -> RealtimeClient
          -> microphone / audio-playback
          -> realtime-api
            -> Supabase Edge Function realtime-gateway
              -> 阿里云百炼 Qwen Realtime
              -> existing realtime_* tables
```

生产沿用现有 Supabase project `ropgifqbblzktgxllupi` 和 Vercel project `unispeaking-web`。未新建 Supabase 项目，未修改数据库 schema，未清空历史数据。

## 2. 主要调用链

1. 页面请求一次麦克风，创建唯一 `RTCPeerConnection`、音轨和 DataChannel。
2. `POST /api/sessions` 创建数据库会话并返回 Clara 最新提示词生成的 realtime config。
3. `POST /api/realtime` 由 Edge Function 使用服务端百炼密钥交换 SDP。
4. `session.created` 后绑定 provider session、恢复麦克风 sender 并发送 `session.update`。
5. 用户转写、AI transcript、状态和工具事件进入 reducer，产品页实时渲染字幕并自动滚动。
6. 结束、异常或卸载统一关闭 channel/peer、停止麦克风和音频，并上报质量、关闭数据库会话。

## 3. 主要修改与新增文件

- `src/services/realtime-api.mjs`：为 Edge Function 请求统一附加公开 `apikey`，覆盖 JSON、SDP 和健康检查。
- `src/hooks/useRealtimeSession.js`：读取 `VITE_SUPABASE_PUBLISHABLE_KEY` 并保持单一客户端生命周期。
- `tests/realtime-api.test.mjs`：验证 publishable key 请求头与现有 API 契约。
- `.env.example`：增加公开 Supabase publishable key 变量名，不包含真实值。
- `.gitignore`：忽略 `.vercel/` 和本地 env 文件，同时保留 `.env.example`。
- `../supabase/config.toml`：绑定现有 Supabase project ref。
- `../supabase/functions/realtime-gateway/index.ts`：生产实时网关、CORS、会话、SDP、事件、质量与关闭接口。
- `../supabase/functions/realtime-gateway/deno.json`：Edge Function 运行依赖配置。
- `../supabase/functions/realtime-gateway/clara_current_en.txt`：Clara 最新英文提示词源文件。
- `tests/realtime-gateway-contract.test.mjs`：验证网关路由、安全约束和嵌入提示词一致性。
- `docs/superpowers/specs/2026-07-16-production-cutover-design.md`：生产切换设计。
- `docs/superpowers/plans/2026-07-16-production-cutover.md`：生产切换执行计划。

未删除数据库表或现有 Vercel/Supabase 项目。旧 Demo 仅作为本地诊断参考，已从产品调用链废弃。

## 4. 本地启动

使用本地 Python 后端：

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking
.venv/bin/python -m backend.app
```

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking_React
npm ci
cp .env.example .env.local
npm run dev
```

使用托管 Edge Function 时，将 `VITE_REALTIME_API_BASE` 配置为函数公开 URL，并设置 `VITE_SUPABASE_PUBLISHABLE_KEY`。不得在浏览器端配置 service role、secret key 或百炼 API Key。

## 5. 测试与构建结果

- ESLint：通过。
- TypeScript checkJs：通过。
- 前端 Node tests：44/44 通过。
- Vite production build：通过。
- Python/backend tests：14/14 通过。
- Edge Function contract tests：包含在前端 44 项测试中并通过。
- 生产构建脱敏扫描：包含预期 Supabase function URL 和 publishable key；未使用 localhost；没有提交服务端密钥。
- GitHub：`codex/integrate-free-chat-v2` 已推送，远端与本地提交一致。

## 6. 生产部署结果

- Supabase Edge Function：`realtime-gateway` platform version 5，状态 ACTIVE。
- Edge Function health：200，model configured。
- Vercel deployment：`dpl_dtBRQ8xd6wgzQArrerv1RiB493SP`，READY，Production。
- Vercel deployment URL：<https://unispeaking-ktm3dvhp6-dal815842-7599s-projects.vercel.app>
- 正式域名：<https://app.unispeaking.cn>
- 正式自由对话入口：<https://app.unispeaking.cn/#/conversation>

## 7. 浏览器与真实链路验证

- 正式域名和 hash 路由直达正常，加载最新资源包，控制台 warning/error 为 0。
- 麦克风权限请求成功；会话创建 201；SDP 交换 200；provider session 绑定 201。
- WebRTC/DataChannel 连接成功，AI Clara 开场英文字幕实时显示，AI 音频播放成功。
- 结束通话后 UI 进入已结束状态；质量上报 201；session DELETE 200；数据库会话状态为 `closed`。
- 本次自动验收没有向麦克风实际说出一段可识别的英语，因此“真人发声内容的转写准确度”仍建议用户首次使用时人工听说确认；传输、字幕事件、AI 音频与资源清理链路均已通过。

## 8. 环境变量

只记录变量名，不记录值。

### 浏览器 / Vercel Production + Preview

- `VITE_REALTIME_API_BASE`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Supabase Edge Function / 服务端

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHSCOPE_API_KEY`
- `BAILIAN_MODEL`

### 本地 Python 服务端（可选）

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
- `CONVERSATION_MEMORY_FILE`
- `BACKEND_HOST`
- `BACKEND_PORT`
- `ALLOWED_ORIGINS`
- `LOG_LEVEL`

## 9. Remaining Issues

- 尚未由真人对麦克风说一句英语验证实际设备的转写准确度；不影响已验证的 WebRTC 建连、AI 字幕、AI 音频和清理链路。
- Vercel 历史 deployment 记录可清理，但不能删除当前 `unispeaking-web` 项目，否则会同时丢失复用的域名和环境变量。
- Python 后端的 aiohttp 弃用警告和 Vite 5 开发工具链审计问题仍属于后续维护项；没有执行破坏性依赖升级。

## 10. Deployment Readiness

当前版本已经完成 Production 发布并通过线上关键链路验收。后续发布应继续复用现有 Vercel/Supabase 项目，先在 Preview 验证，再提升到 Production；禁止把服务端密钥加入任何 `VITE_` 变量。
