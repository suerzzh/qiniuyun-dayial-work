# UniSpeaking 产品 UI

UniSpeaking 是一个 AI 英语口语陪练产品。本目录是唯一的产品前端，使用 Vite 5、React 18、JavaScript/JSX 和原生 CSS。自由对话真实能力已接入产品路由 `#/conversation`，不再跳转或嵌入独立 Demo。

## 融合架构

```text
ConversationView
  -> useRealtimeSession
    -> realtime-state reducer
    -> RealtimeClient（唯一 PeerConnection / DataChannel）
      -> microphone（唯一 MediaStream）
      -> audio-playback（唯一 Audio / AudioContext）
      -> realtime-api
        -> Python aiohttp backend :8000
          -> 阿里云百炼 Qwen Realtime
```

- 产品 UI 决定页面、按钮、气泡、状态提示和响应式布局。
- `src/hooks/useRealtimeSession.js` 拥有一个实时客户端实例，并在页面卸载时幂等清理。
- `src/realtime/` 负责状态、麦克风、AI 音频、WebRTC/DataChannel 和资源释放。
- `src/services/realtime-api.mjs` 只访问公开的后端 URL；百炼密钥始终保留在服务端。
- 断线或异常后提供显式重试，避免自动循环创建多个 session。

## 本地环境

前端采用仓库现有的 npm 与 `package-lock.json`：

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking_React
npm ci
cp .env.example .env.local
```

前端唯一环境变量：

| 变量名 | 端 | 必需 | 说明 |
|---|---|---:|---|
| `VITE_REALTIME_API_BASE` | 浏览器 | 是 | 公开的实时后端基础 URL；本地为 `http://127.0.0.1:8000` |

`VITE_` 变量会进入浏览器构建。不得把 `DASHSCOPE_API_KEY`、Supabase service role、secret key 或 token 放入前端环境文件。

## 本地启动

终端一，启动真实 Python 后端：

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m backend.app
```

终端二，启动产品前端：

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking_React
npm run dev
```

打开 <http://127.0.0.1:8080/#/conversation>。首次开始对话时，浏览器会请求麦克风权限。

安全检查后端配置状态：

```bash
curl http://127.0.0.1:8000/health
```

`/health` 只返回配置布尔值和 credential mode，不返回任何密钥。

## 验证命令

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking_React
npm run lint
npm run typecheck
npm test
npm run build
```

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking
.venv/bin/python -m unittest discover -s tests -v
```

浏览器验收重点：

1. 打开并刷新 `#/conversation`，再从场景训练等页面返回。
2. 点击语音球，允许麦克风，等待 AI 开场字幕与音频。
3. 验证静音、暂停/恢复、文字输入、实时字幕和结束。
4. 结束或离开页面后，确认后端收到质量记录和 session DELETE，且没有重复连接。
5. 检查控制台无阻断性错误，并扫描 `dist` 不包含服务端密钥名或密钥格式。

## 目录入口

- 产品入口：`src/main.jsx`
- 路由与产品壳：`src/App.jsx`、`src/router.mjs`
- 自由对话页面：`src/views/ConversationView.jsx`
- 会话 Hook：`src/hooks/useRealtimeSession.js`
- 实时模块：`src/realtime/`
- 后端 API 适配：`src/services/realtime-api.mjs`
- 审计：`docs/free-chat-integration-audit.md`
- 融合结果：`docs/free-chat-integration-result.md`

## Vercel 与 Supabase

- 当前 `7.16` 产品前端新增了 `vercel.json` 静态安全头，但没有执行 Preview 或 Production 部署。
- `.vercel/project.json` 不存在，本目录没有绑定或修改 Vercel 项目。
- 当前 `7.16` 不使用 Supabase SDK，也没有 `supabase/config.toml`、migration 或 Edge Function。
- 历史版本曾使用 Vercel 项目 `unispeaking-web` 和 Supabase project ref `ropgifqbblzktgxllupi` 的 `realtime-gateway` Edge Function。
- 新 Python 后端包含历史 Edge Function 尚未覆盖的临时 Key、provider session 绑定和本地诊断能力，且依赖进程内 session 与可写文件系统，不能原样部署到 Vercel Serverless。
- 本轮没有修改 Supabase schema、RLS、远程数据或生产环境。

部署前必须先确定一个支持常驻 Python 进程和 WebRTC SDP 代理的 HTTPS 后端运行环境，再把 `VITE_REALTIME_API_BASE` 配置为该 Preview 后端地址并更新服务端 CORS。正式域名为 `app.unispeaking.cn`，仓库内尚无可验证的域名绑定配置。
