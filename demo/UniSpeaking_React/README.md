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
        -> Supabase Edge Function realtime-gateway（生产）
          / Python aiohttp backend :8000（本地可选）
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

前端环境变量：

| 变量名 | 端 | 必需 | 说明 |
|---|---|---:|---|
| `VITE_REALTIME_API_BASE` | 浏览器 | 是 | 公开的实时后端基础 URL；本地为 `http://127.0.0.1:8000` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 浏览器 | 使用 Edge Function 时是 | Supabase publishable key；这是公开 key，不得替换为 service role 或 secret key |

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

- 生产前端使用现有 Vercel 项目 `unispeaking-web`，正式域名为 <https://app.unispeaking.cn>。
- 生产实时后端使用现有 Supabase project ref `ropgifqbblzktgxllupi` 的 `realtime-gateway` Edge Function。
- Edge Function 负责创建会话、代理 SDP、绑定 provider session、记录字幕事件与质量指标，并将百炼密钥保留在服务端。
- 本次没有修改 Supabase schema，也没有创建新项目或清空历史数据；沿用已有表、RLS、项目密钥和域名。
- Vercel 的 `VITE_REALTIME_API_BASE` 与 `VITE_SUPABASE_PUBLISHABLE_KEY` 配置在 Production/Preview。两者会进入浏览器，必须保持为公开 URL/publishable key。
- `SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_SECRET_KEY`、`DASHSCOPE_API_KEY` 等仍只允许存在于服务端环境。

生产发布前应依次运行 lint、typecheck、test、build，并检查构建产物不包含服务端密钥。Vercel CLI 的本地预构建需要先执行 `vercel pull --yes --environment=production`，确保 `.vercel/.env.production.local` 已刷新。
