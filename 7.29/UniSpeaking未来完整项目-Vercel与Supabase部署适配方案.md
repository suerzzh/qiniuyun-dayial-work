# UniSpeaking 未来完整项目：Vercel + Supabase 部署适配方案

> 日期：2026-07-29
>
> 适用对象：后续交付给你的“功能完整、可在本地运行”的 UniSpeaking 项目
>
> 目标：告诉开发同学要在哪些文件新增什么，也告诉部署负责人要在 Vercel、Supabase 里完成什么操作
>
> 不适用：把当前 `/项目/UniSpeaking` 雏形原样发布到公网

---

## 0. 先给结论

推荐继续使用你之前已经验证过的架构：

```text
用户浏览器
  |
  | HTTPS
  v
Vercel
  ├── Vite + React 页面
  ├── 登录/注册/个人中心 UI
  ├── 麦克风、WebRTC、AI 音频播放
  └── 仅包含 Supabase URL、Publishable Key 等公开配置
  |
  | HTTPS + Supabase access token
  v
Supabase
  ├── Auth：登录、注册、邮箱验证、找回密码
  ├── Edge Functions：会话创建、SDP 交换、限流、第三方 AI 调用
  ├── Postgres：用户、会话、字幕、评分、用量、质量指标
  └── Storage：头像、学习材料、报告文件
  |
  | 服务端长期密钥 + 短请求
  v
阿里云百炼 / 其他 AI 厂商

实时媒体主链路：
浏览器 <================ WebRTC ================> 百炼 Realtime
```

核心原则：

1. Vercel 只负责前端静态网站，不保存服务端密钥。
2. Supabase Edge Function 只负责短请求控制面，不持续转发整段实时音频。
3. 浏览器与百炼之间使用 WebRTC 传输音频。
4. Supabase Postgres 保存业务数据，不使用进程内 Map、SQLite、JSON 文件或本地上传目录作为生产存储。
5. 生产业务函数默认验证 Supabase Auth JWT，不再允许客户端自报 `userId`。
6. 不保存用户原始音频；默认只保存会话元数据、最终字幕、评分和质量指标。
7. 先部署 Preview/Staging，验收通过后再切 Production。

### 0.1 对比过的三条路线

| 路线 | 优点 | 代价 | 结论 |
|---|---|---|---|
| Vercel 前端 + Supabase 全套能力 | 复用你之前的项目、域名和经验；运维面最小 | 要把本地后端改成无状态短请求 | **推荐** |
| Vercel + Supabase + 独立容器后端 | 能保留复杂 Java/Python 常驻能力 | 多一个平台、部署和监控面 | 只有出现长期连接/任务时使用 |
| 整套 Docker Compose 放云服务器 | 对本地代码改动可能较少 | 域名、证书、备份、扩容、监控都要自行维护 | 不作为本轮默认方案 |

本方案选择第一条。第二条只作为未来完整项目无法消除常驻后端时的升级路线。

---

## 1. 为什么不直接部署“本地完整项目”

“本地可以运行”只证明功能链路可用，不代表适合 Vercel 与 Supabase。

以下本地实现不能原样上线：

| 本地实现 | 线上问题 | 必须改成 |
|---|---|---|
| 后端进程内保存 session | 函数实例会被销毁，不同请求可能落到不同实例 | Supabase Postgres |
| 写本地 JSON、SQLite、Markdown | 云函数本地磁盘不可作为持久存储 | Postgres / Storage |
| 长期 WebSocket 中转全部音频 | 不符合短生命周期函数模型，成本和延迟都高 | 浏览器直连百炼 WebRTC |
| 前端携带百炼 API Key | 所有人都能从浏览器包中读取 | Edge Function Secret |
| 客户端请求体提交 `userId` | 可冒充其他用户 | 从已验证 JWT 的 `sub` 获取 |
| 只检查“是否登录” | 登录用户仍可能访问别人的数据 | RLS + `auth.uid() = user_id` |
| `Access-Control-Allow-Origin: *` | 容易被其他网站滥用 | 精确 Origin 白名单 |
| 生产构建回退到 localhost | 页面能打开，但线上 API 全部失败 | 环境变量校验 + 构建产物扫描 |

---

## 2. 对未来完整项目的目录约定

以下以 `frontend/` 为 Vite/React 根目录。如果未来项目的前端就在仓库根目录，把表中的 `frontend/` 前缀去掉即可。

开发同学最终应交付类似结构：

```text
UniSpeaking/
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── env.js
│   │   │   └── supabase.js
│   │   ├── auth/
│   │   │   ├── AuthProvider.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── authService.js
│   │   ├── services/
│   │   │   ├── realtimeApi.js
│   │   │   ├── profileApi.js
│   │   │   └── storageApi.js
│   │   ├── realtime/
│   │   │   ├── realtimeClient.js
│   │   │   ├── microphone.js
│   │   │   ├── audioPlayback.js
│   │   │   └── realtimeState.js
│   │   └── hooks/
│   │       └── useRealtimeSession.js
│   ├── scripts/
│   │   └── check-production-build.mjs
│   ├── tests/
│   │   ├── deployment-config.test.mjs
│   │   ├── auth.test.mjs
│   │   ├── realtime-api.test.mjs
│   │   └── realtime-gateway-contract.test.mjs
│   ├── .env.example
│   ├── .gitignore
│   ├── .nvmrc
│   ├── package.json
│   ├── package-lock.json
│   ├── vercel.json
│   └── vite.config.js
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── <CLI生成时间戳>_init_unispeaking.sql
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── auth.ts
│   │   │   ├── cors.ts
│   │   │   ├── db.ts
│   │   │   ├── http.ts
│   │   │   └── rateLimit.ts
│   │   ├── health/
│   │   │   ├── deno.json
│   │   │   └── index.ts
│   │   └── realtime-gateway/
│   │       ├── deno.json
│   │       ├── index.ts
│   │       └── prompts/
│   │           └── free-chat-en.txt
│   ├── seed.sql
│   └── tests/
│       └── rls.sql
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-supabase.yml
├── .gitignore
└── README.md
```

不要让开发同学直接手写 migration 时间戳文件名。应先运行：

```bash
supabase migration new init_unispeaking
```

再把 SQL 写入 CLI 生成的文件。

本文中的 `<...>` 都是部署时必须替换的值，不是可以长期保留的未决项。

---

## 3. 开发同学必须新增或修改的文件

### 3.1 总表

| 优先级 | 文件 | 动作 | 要新增的内容 |
|---|---|---|---|
| P0 | `frontend/package.json` | 修改 | Node 22、可重复 build/test 脚本、锁定依赖 |
| P0 | `frontend/.nvmrc` | 新增 | `22` |
| P0 | `frontend/.env.example` | 新增/修改 | 只登记公开变量名，不填真实值 |
| P0 | `frontend/.gitignore` | 修改 | 忽略 `.env.local`、`.vercel/`、`dist/` |
| P0 | `frontend/src/lib/env.js` | 新增 | 启动时校验公开环境变量 |
| P0 | `frontend/src/lib/supabase.js` | 新增 | 初始化唯一 Supabase browser client |
| P0 | `frontend/src/auth/*` | 新增 | 真实注册、登录、会话恢复、退出和路由保护 |
| P0 | `frontend/src/services/realtimeApi.js` | 新增/修改 | API 封装、携带 publishable key 和 access token |
| P0 | `frontend/src/realtime/*` | 新增/整理 | WebRTC、麦克风、DataChannel、资源释放 |
| P0 | `frontend/vercel.json` | 新增/修改 | SPA 回退、安全头、缓存策略 |
| P0 | `supabase/config.toml` | 新增 | 函数 JWT、静态 prompt 等配置 |
| P0 | `supabase/migrations/*` | 新增 | 表、索引、GRANT、RLS、Storage policy |
| P0 | `supabase/functions/realtime-gateway/*` | 新增 | 会话、SDP、事件、质量、关闭接口 |
| P0 | `supabase/functions/_shared/*` | 新增 | 身份、CORS、数据库、错误、限流公共代码 |
| P0 | `frontend/tests/*` | 新增 | 部署配置、密钥隔离、API 头、路由和资源释放测试 |
| P1 | `frontend/scripts/check-production-build.mjs` | 新增 | 扫描正式构建产物 |
| P1 | `.github/workflows/ci.yml` | 新增 | lint、test、build、migration/函数检查 |
| P1 | `.github/workflows/deploy-supabase.yml` | 新增 | 受控发布 migration 与 Functions |
| P1 | `README.md` | 修改 | 本地、Preview、Production、回滚和环境变量表 |

---

## 4. 前端各文件具体新增什么

### 4.1 `frontend/package.json`

要求：

- Node.js 使用 22。
- 提交 `package-lock.json`。
- CI 与 Vercel 统一使用 `npm ci`。
- 至少提供 `dev`、`lint`、`test`、`build`、`check:production-build`。

示例结构：

```json
{
  "engines": {
    "node": "22.x"
  },
  "scripts": {
    "dev": "vite",
    "lint": "eslint src",
    "test": "node --test tests/*.test.mjs",
    "build": "vite build",
    "check:production-build": "node scripts/check-production-build.mjs",
    "verify": "npm run lint && npm test && npm run build && npm run check:production-build"
  }
}
```

需要新增依赖：

```text
@supabase/supabase-js
```

依赖必须锁版本并提交 lockfile，不在 CI 中无约束安装 `latest`。

### 4.2 `frontend/.nvmrc`

```text
22
```

### 4.3 `frontend/.env.example`

只写变量名和示例，不写真实 key：

```properties
# 浏览器公开配置
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
VITE_REALTIME_API_BASE=https://<project-ref>.supabase.co/functions/v1/realtime-gateway
VITE_SITE_URL=http://localhost:5173

# 可选：Sentry 等公开 DSN
VITE_SENTRY_DSN=
```

严禁放入：

```text
DASHSCOPE_API_KEY
BAILIAN_WORKSPACE_ID
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
数据库密码
Vercel Token
```

任何 `VITE_` 变量都会进入浏览器包，所以它只能是公开配置。

### 4.4 `frontend/.gitignore`

至少包含：

```gitignore
.env
.env.*
!.env.example
.vercel/
dist/
node_modules/
```

### 4.5 `frontend/src/lib/env.js`

职责：应用启动时检查公开配置，避免生产环境静默回退 localhost。

必须检查：

- `VITE_SUPABASE_URL` 是 `https://`。
- `VITE_SUPABASE_PUBLISHABLE_KEY` 以当前 publishable key 格式配置。
- Production 的 API base 不能包含 `localhost`、`127.0.0.1`。
- 不允许代码内存在默认生产地址。

行为：

- 本地缺失变量时显示明确错误。
- Production 缺失变量时直接阻止应用启动或构建。
- 不在日志中打印完整 key。

### 4.6 `frontend/src/lib/supabase.js`

全项目只创建一个 browser client：

```js
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabase = createClient(
  env.supabaseUrl,
  env.supabasePublishableKey,
);
```

不要在多个组件里重复 `createClient`。

### 4.7 `frontend/src/auth/authService.js`

至少封装：

```text
signUp(email, password)
signIn(email, password)
signOut()
sendPasswordReset(email)
updatePassword(password)
getCurrentSession()
onAuthStateChange(callback)
```

生产默认流程：

1. 注册。
2. 发送邮箱验证。
3. 验证成功后恢复 session。
4. 登录。
5. access token 自动刷新。
6. 退出登录。
7. 找回密码。

不要使用 UI 假登录，也不要使用固定 `local-demo-user`。

### 4.8 `frontend/src/auth/AuthProvider.jsx`

职责：

- 应用初始化时读取 Supabase session。
- 监听登录、登出、token 刷新。
- 向子组件提供 `user`、`session`、`loading`。
- 初始化完成前不渲染受保护页面。

### 4.9 `frontend/src/auth/ProtectedRoute.jsx`

要求：

- 未登录访问会话、个人中心、学习资产时跳转登录页。
- 登录后回到原目标地址。
- 不能仅在前端隐藏按钮；数据库仍必须依赖 RLS。

### 4.10 `frontend/src/services/realtimeApi.js`

此文件只负责 HTTPS API，不负责 WebRTC。

至少实现：

```text
health()
createSession()
exchangeSdp()
rememberEvent()
bindProviderSession()
updateLearnerLevel()
recordQuality()
closeSession()
```

每个生产业务请求必须携带：

```http
apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>
Authorization: Bearer <当前用户 access_token>
```

重要要求：

- 不在请求体传 `userId`。
- access token 从当前 Supabase session 获取。
- 401 时先尝试刷新 session，仍失败则回登录页。
- 429 显示“操作过于频繁”，不自动无限重试。
- 5xx 使用指数退避，且最多重试有限次数。
- SDP 请求使用 `Content-Type: application/sdp`。
- 不打印 Authorization、完整 SDP、长期密钥。

### 4.11 `frontend/src/realtime/realtimeClient.js`

职责：

- 申请麦克风。
- 创建唯一 `RTCPeerConnection`。
- 创建 Offer SDP。
- 通过 `realtimeApi.exchangeSdp()` 获取 Answer SDP。
- 建立 DataChannel。
- 处理字幕、AI 音频和工具事件。
- 收集 RTT、丢包率、jitter、断线次数。
- 通话结束时关闭 DataChannel、PeerConnection、MediaStreamTrack 和播放器。

必须具备：

- `startPromise` 去重，防止连点产生多个会话。
- `teardownPromise` 去重，保证清理只执行一次。
- 页面卸载时自动清理。
- 网络断开时进入可重试状态。
- 只保存最终字幕事件，不保存每个中间音频帧。
- 不把原始音频上传到 Postgres。

### 4.12 `frontend/src/hooks/useRealtimeSession.js`

职责：

- 把 realtime client 事件映射为 React 状态。
- 向 UI 暴露 `start`、`retry`、`mute`、`pause`、`sendText`、`end`。
- 不直接拼接 Supabase URL。
- 不保存敏感身份信息到 `localStorage`。

`localStorage` 只可保存可丢失的 UI 偏好。正式会话历史以 Supabase 为准。

### 4.13 `frontend/vercel.json`

最低要求：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "microphone=(self), camera=()"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

上线前还应增加 CSP，但 `connect-src` 必须写真实 Supabase 域名和实际需要的厂商域名，不能直接复制旧项目值，也不要为了省事写成无限制 `*`。

### 4.14 `frontend/scripts/check-production-build.mjs`

构建后扫描 `dist/`：

必须满足：

- 包含 Production Supabase hostname。
- 包含正确的 publishable key 前缀或配置标记。
- 不包含 `localhost`、`127.0.0.1`。
- 不包含 `DASHSCOPE_API_KEY` 等变量名对应的真实值。
- 不包含 `sb_secret_`、旧 `service_role` key、数据库连接串。

检查失败时退出码必须非 0，阻止发布。

---

## 5. Supabase 仓库文件具体新增什么

### 5.1 `supabase/config.toml`

建议：

```toml
project_id = "unispeaking"

[functions.health]
verify_jwt = false

[functions.realtime-gateway]
verify_jwt = true
static_files = [
  "./functions/realtime-gateway/prompts/free-chat-en.txt"
]
```

说明：

- `health` 只返回最小状态，因此可不要求用户 JWT。
- `realtime-gateway` 是业务函数，必须验证 JWT。
- 如果未来产品明确支持匿名体验，应单独设计 anonymous session，不要直接关闭全部鉴权。

### 5.2 `supabase/functions/_shared/cors.ts`

职责：

- 解析请求 Origin。
- Production 只允许精确域名。
- Staging 单独允许 staging 域名。
- Preview 若需要通配，只允许本团队的 Vercel Preview 格式，不允许任意 `*.vercel.app`。
- 正确处理 OPTIONS，返回 204。
- 返回 `Vary: Origin`。

Production 默认白名单：

```text
https://app.unispeaking.cn
https://www.unispeaking.cn
https://unispeaking.cn
```

更推荐长期只把 `app.unispeaking.cn` 作为应用入口，根域名和 `www` 301 跳转到 `app`。在重定向完全稳定前，三者仍需一起验证。

### 5.3 `supabase/functions/_shared/auth.ts`

职责：

- 读取 `Authorization: Bearer ...`。
- 获取经过验证的 JWT claims。
- 以 JWT `sub` 作为唯一用户 ID。
- 请求体中的 `user_id` 一律忽略或拒绝。
- 业务层只能接收 `authenticatedUserId`。

禁止：

- 使用 `user_metadata` 做权限判断。
- 仅判断 `role=authenticated` 而不校验数据归属。
- 为了解决权限错误随意使用 `SECURITY DEFINER`。

### 5.4 `supabase/functions/_shared/db.ts`

职责：

- 创建 user client：携带用户 Authorization，遵守 RLS。
- 创建 admin client：仅 Edge Function 内部使用 secret key。
- admin client 只暴露固定业务方法，不能让前端传任意表名、列名或 SQL。
- 所有数据库错误统一脱敏。

### 5.5 `supabase/functions/_shared/rateLimit.ts`

首发至少限制：

- 每用户每分钟创建会话次数。
- 同一用户同时活动会话数。
- 每日会话分钟数。
- SDP 大小。
- prompt 长度。
- 事件 body 大小。
- 评分、TTS、ASR 等高成本能力调用次数。

限流键优先使用 `user_id + action`，IP hash 只作为补充。

### 5.6 `supabase/functions/health/index.ts`

只返回：

```json
{
  "status": "ok",
  "service": "unispeaking",
  "version": "<deployment-version>"
}
```

不返回：

- key 是否具体配置。
- Workspace ID。
- 数据库连接串。
- 用户数据。
- 上游完整错误。

### 5.7 `supabase/functions/realtime-gateway/index.ts`

建议沿用你之前验证过的接口契约：

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/api/sessions` | 创建业务会话，返回 session config |
| `POST` | `/api/realtime?session_id=...` | Offer SDP 换 Answer SDP |
| `POST` | `/api/sessions/:id/events` | 保存最终用户/AI 字幕 |
| `POST` | `/api/sessions/:id/provider-session` | 绑定厂商 session ID |
| `POST` | `/api/sessions/:id/tools/learner-level` | 更新学习等级 |
| `POST` | `/api/sessions/:id/quality` | 保存 WebRTC 质量指标 |
| `DELETE` | `/api/sessions/:id` | 结束并清理会话 |

每条路由都必须：

1. 获取 JWT user ID。
2. 校验 session 属于当前用户。
3. 校验 session 状态和过期时间。
4. 校验 body 大小和字段。
5. 执行配额/限流。
6. 记录 request ID、状态码、耗时和厂商错误分类。
7. 不记录完整 Authorization、SDP、原始音频和长期密钥。

创建 session 时：

- `user_id` 取 JWT `sub`。
- 从数据库读取用户等级、老师、语速等偏好。
- 服务端选择 prompt，不能完全信任客户端 prompt。
- 写入会话状态与过期时间。

交换 SDP 时：

- 只从 Supabase Secret 获取百炼长期 Key。
- 设置上游超时。
- 限制 SDP 最大 1 MiB 或更小的合理值。
- 上游失败只返回安全错误码，不返回厂商原始 body。

结束 session 时：

- 幂等；重复关闭返回成功状态。
- 更新结束时间和用量。
- 触发非关键总结时应异步化，不能阻塞用户退出。

### 5.8 `supabase/functions/realtime-gateway/deno.json`

要求：

- 严格模式。
- 依赖版本固定。
- 不从不受控 URL 动态加载未锁定版本。

示例：

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### 5.9 `supabase/migrations/<CLI生成时间戳>_init_unispeaking.sql`

首发建议包含：

| 表 | 核心字段 | 归属 |
|---|---|---|
| `profiles` | `id`, `display_name`, `level`, `teacher_id`, `settings`, timestamps | `id = auth.users.id` |
| `conversations` | `id`, `user_id`, `scene_type`, `title`, timestamps | `user_id` |
| `realtime_sessions` | `id`, `user_id`, `conversation_id`, `provider`, `model`, `status`, `expires_at`, timestamps | `user_id` |
| `session_messages` | `id`, `session_id`, `user_id`, `role`, `body`, `source_id`, timestamps | `user_id` |
| `realtime_metrics` | `id`, `session_id`, `user_id`, RTT、丢包、jitter、时长 | `user_id` |
| `usage_ledger` | `id`, `user_id`, `capability`, `provider`, `model`, `units`, `estimated_cost`, timestamps | `user_id` |
| `learning_assets` | `id`, `user_id`, `type`, `storage_path`, metadata, timestamps | `user_id` |

限流表建议放非暴露 schema，例如：

```text
private.request_rate_limits
```

所有暴露到 Data API 的表必须同时具备：

1. 显式对象级 GRANT。
2. 启用 RLS。
3. 逐操作 ownership policy。

示例模式：

```sql
grant select, insert, update, delete
on public.conversations
to authenticated;

alter table public.conversations enable row level security;

create policy "users_select_own_conversations"
on public.conversations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_conversations"
on public.conversations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_conversations"
on public.conversations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

注意：

- `UPDATE` 同时需要可用的 `SELECT` policy。
- `UPDATE` policy 同时写 `USING` 和 `WITH CHECK`。
- 不要只写 `TO authenticated`。
- 2026 年新项目不会保证新表自动暴露到 Data API，必须显式检查 GRANT。
- migration 必须能从空数据库完整恢复。

### 5.10 Storage

首发 bucket：

```text
avatars
learning-assets
reports
```

默认设为 private。对象路径统一：

```text
<user_id>/<业务对象id>/<文件名>
```

Storage policy 要校验首段目录等于当前 `auth.uid()`。

不要创建 `raw-audio` bucket，除非产品、隐私、保留周期和用户同意均已明确。

### 5.11 `supabase/seed.sql`

只能放：

- 测试老师。
- 测试场景。
- 非敏感演示数据。

不能放：

- 生产用户。
- 真实邮箱。
- API Key。
- 真实对话。

---

## 6. 必须新增的测试

### 6.1 `frontend/tests/deployment-config.test.mjs`

检查：

- `vercel.json` 有 SPA rewrite。
- 有麦克风 Permissions Policy。
- 静态 assets 使用 immutable cache。
- `.gitignore` 忽略 secrets。
- package 使用 Node 22。

### 6.2 `frontend/tests/auth.test.mjs`

检查：

- 注册调用真实 Supabase Auth。
- 登录使用邮箱密码。
- session 恢复。
- logout 清理用户状态。
- 未登录无法进入受保护页面。

### 6.3 `frontend/tests/realtime-api.test.mjs`

检查所有 JSON/SDP 请求：

- 带 publishable key。
- 带当前 access token。
- 不携带请求体 `userId`。
- 401、429、5xx 映射正确。
- 不泄露 token。

### 6.4 `frontend/tests/realtime-gateway-contract.test.mjs`

检查：

- 所有约定路由存在。
- Function 配置为 `verify_jwt=true`。
- Production 三域名 CORS 契约正确。
- 使用 `DASHSCOPE_API_KEY` 等服务端变量。
- 源码中不存在真实 key。
- prompt 文件被包含进 Function bundle。

### 6.5 `supabase/tests/rls.sql`

至少验证：

- 用户 A 能读写自己的资料。
- 用户 A 不能读写用户 B 的资料。
- 未登录用户不能读取学习记录。
- Storage 不能跨用户目录读取/覆盖。
- Edge Function 的固定服务端写入路径仍能工作。

### 6.6 `.github/workflows/ci.yml`

Pull Request 必须执行：

```text
Node 22
→ npm ci
→ lint
→ 前端测试
→ production build
→ 构建产物扫描
→ 启动本地 Supabase
→ 从空库执行 migrations
→ RLS 测试
→ Edge Function 静态/契约测试
```

Supabase CLI 版本必须固定为团队实际验证过的版本，不使用无约束 `latest`。

### 6.7 `.github/workflows/deploy-supabase.yml`

建议只允许受保护的 `main` 分支或人工 `workflow_dispatch` 发布 Production。

GitHub Secrets：

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
SUPABASE_DB_PASSWORD
```

执行顺序：

```text
link project
→ migration 状态检查
→ db push
→ health function
→ realtime-gateway function
→ 冒烟测试
```

Production Environment 应开启人工审批。Vercel 前端继续使用 Git 集成，不在同一个 workflow 中重复部署第二份前端产物。

### 6.8 `README.md`

必须写清：

- 前端 Root Directory、安装、构建和输出目录。
- 本地 Supabase 启动与重置方法。
- 环境变量公开/秘密分类表。
- migrations、Functions、Storage policies 的发布方式。
- Staging 与 Production project 的对应关系。
- Preview E2E 操作。
- 正式域名。
- 日志入口。
- 回滚步骤。
- 数据与音频保留策略。

---

## 7. 你需要在 Supabase 里做什么

### 7.1 项目策略

推荐：

- 复用现有 Production Supabase 项目，不删除。
- 新建一个 Staging Supabase 项目用于完整项目联调。
- 如果购买了支持 Branching 的方案，再启用 PR Preview Branch；不是首发必需。

不要让 Vercel Preview 直接连接 Production 数据库。

### 7.2 获取公开配置

在 Production 和 Staging 项目分别获取：

```text
Project URL
Publishable Key（sb_publishable_...）
```

这两个值放到对应环境的 Vercel `VITE_` 变量。

不要给前端：

```text
Secret Key（sb_secret_...）
旧 service_role
数据库密码
```

### 7.3 Auth 配置

Supabase Dashboard：

```text
Authentication
→ URL Configuration
```

Production：

```text
Site URL:
https://app.unispeaking.cn

Redirect URLs:
https://app.unispeaking.cn/**
https://www.unispeaking.cn/**
https://unispeaking.cn/**
```

Staging / 本地：

```text
http://localhost:5173/**
https://<固定-staging-域名>/**
```

Vercel Preview 若使用通配，只允许你的团队 Preview 格式，不要使用无边界的 `https://**.vercel.app/**`。

### 7.4 邮箱与 SMTP

在 Auth 中：

- 开启 Email/Password。
- Production 保持邮箱确认。
- 配置发件人域名。
- 配置自有 SMTP。
- 修改验证、重置密码模板。
- 实测收件、链接跳转、过期链接和重复点击。

不能把 Dashboard 中“能看到模板”当作邮件已经可发给正式用户。

### 7.5 初始化并关联仓库

在完整项目仓库中运行，实际命令参数先用当前 CLI 的 `--help` 核对：

```bash
supabase --version
supabase --help
supabase init
supabase login
supabase link --project-ref <STAGING_PROJECT_REF>
```

本地从空库验证：

```bash
supabase start
supabase db reset
supabase migration list --local
```

如果 Production 已存在 Dashboard 手工结构，先 `db pull`，把远端结构变成仓库 migration，再继续；不能让 Dashboard 成为唯一事实来源。

### 7.6 发布 migration

顺序：

1. 本地空库 `db reset` 成功。
2. RLS 测试通过。
3. 推到 Staging。
4. 在 Staging 做完整 E2E。
5. 确认 Production 恢复点/备份。
6. 再推 Production。

数据库变更先向后兼容，再发前端；不要让破坏性 schema 与无法回退的前端同时上线。

### 7.7 配置 Edge Function Secrets

Supabase Dashboard：

```text
Edge Functions
→ Secrets
```

至少配置：

```text
DASHSCOPE_API_KEY
BAILIAN_WORKSPACE_ID
BAILIAN_MODEL
BAILIAN_REGION
ALLOWED_WEB_ORIGINS
```

按实际启用能力再加：

```text
DEEPSEEK_API_KEY
DOUBAO_ASR_API_KEY
MINIMAX_API_KEY
XFYUN_APP_ID
XFYUN_API_KEY
XFYUN_API_SECRET
```

不要把“未来可能用”的所有厂商 Key 一次性塞进 Production。

也可使用 CLI：

```bash
supabase secrets set --env-file <不进入Git的文件>
supabase secrets list
```

### 7.8 部署 Functions

先部署 Staging：

```bash
supabase functions deploy health
supabase functions deploy realtime-gateway
```

验收：

- health 返回最小状态。
- 无 JWT 调业务函数返回 401。
- 用户 A 不能操作用户 B session。
- OPTIONS 预检正确。
- 创建 session 成功。
- SDP 成功交换。
- 最终字幕与质量指标落库。
- 日志没有 secret、完整 SDP、原始音频。

再按同一 Git commit 部署 Production。

### 7.9 数据库安全与运维

在 Dashboard 检查：

- 所有 `public` 表 RLS 已启用。
- GRANT 与 RLS 同时正确。
- Security Advisor 无高风险项。
- Performance Advisor 无明显缺索引。
- 备份策略和恢复点已确认。
- Auth、Function、Database 日志入口明确。
- 设置费用告警和用量预算。

---

## 8. 你需要在 Vercel 里做什么

### 8.1 复用现有项目

优先复用原来的 `unispeaking-web` 项目，不删除重建，因为原项目可能已经承载：

- 域名。
- HTTPS 证书。
- 环境变量。
- 团队权限。
- 历史 deployments。

### 8.2 连接 Git 仓库

Vercel Dashboard：

```text
Add New
→ Project
→ Import Git Repository
```

配置：

| 项目 | 值 |
|---|---|
| Framework Preset | Vite |
| Root Directory | `frontend`，或实际 Vite 根目录 |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | 22 |

Root Directory 必须指向真正包含 `package.json` 和 `vite.config.*` 的目录。

### 8.3 配置 Vercel 环境变量

Production：

| 变量 | 值 |
|---|---|
| `VITE_SUPABASE_URL` | Production Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production publishable key |
| `VITE_REALTIME_API_BASE` | Production realtime-gateway URL |
| `VITE_SITE_URL` | `https://app.unispeaking.cn` |

Preview：

| 变量 | 值 |
|---|---|
| `VITE_SUPABASE_URL` | Staging/Branch Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Staging/Branch publishable key |
| `VITE_REALTIME_API_BASE` | Staging gateway URL |
| `VITE_SITE_URL` | 固定 staging URL 或受控 Preview URL |

Development：

使用本地 Supabase 或专用开发项目。

每次修改环境变量后，要创建一次新 deployment；旧构建不会自动读取新值。

### 8.4 域名

Vercel：

```text
Project
→ Settings
→ Domains
```

建议：

- `app.unispeaking.cn` 为主应用域名。
- `unispeaking.cn` 和 `www.unispeaking.cn` 重定向到 `app`。
- 按 Vercel 页面给出的唯一 DNS 记录配置，不照抄其他项目记录。
- 等待 DNS 与 HTTPS 生效。

域名变化时必须同步：

1. Vercel `VITE_SITE_URL`。
2. Supabase Auth Site URL。
3. Supabase Auth Redirect URLs。
4. Edge Function `ALLOWED_WEB_ORIGINS`。
5. CSP `connect-src`。
6. OAuth 平台回调地址。

### 8.5 Preview 验收

Git feature branch / PR 推送后，Vercel 自动创建 Preview。

必须验收：

- 页面和所有深层路由直接刷新。
- 注册、邮箱验证、登录、退出、找回密码。
- 麦克风权限。
- session 创建、SDP、AI 开场音频。
- 实时字幕。
- 通话结束资源释放。
- Supabase 中数据归属正确。
- 浏览器 Console 无错误。
- Network 无持续 4xx/5xx。
- Function 日志无 secret。
- Production 数据未被 Preview 写入。

### 8.6 Production 发布

推荐做法：

1. 选择已验收的 Preview deployment。
2. 确认对应 Git commit。
3. 确认 Production 环境变量。
4. 先发布向后兼容的 Supabase migration。
5. 发布对应 Edge Function。
6. 验证 Production health 与核心接口。
7. 将同一 Preview artifact promote 到 Production。
8. 完成正式域名冒烟测试。

不要在验收后重新构建另一份“看起来一样”的产物再上线。

### 8.7 Vercel 回滚

前端故障：

- 将 Production 回滚/切换到上一条已知正常的 READY deployment。
- 不删除 Vercel 项目。
- 不删除域名。
- 不先删环境变量。

发布前必须保留至少一个上一稳定 deployment。

---

## 9. 完整上线顺序

严格按以下顺序：

```text
1. 开发同学完成代码适配
2. 全新 clone 安装依赖
3. 本地 Supabase 从空库恢复
4. 本地 lint / test / build / 产物扫描
5. Staging migration
6. Staging Edge Functions + Secrets
7. Vercel Preview 连接 Staging
8. Preview 全链路 E2E
9. Production 数据库备份/恢复点
10. Production 向后兼容 migration
11. Production Edge Functions
12. Production health/API 验证
13. Promote 已验收 Vercel artifact
14. 正式域名三层验收
15. 观察日志、错误率、会话成功率和费用
```

三层验收：

1. 代码层：lint、test、build、密钥扫描、RLS 测试。
2. 接口层：Auth、session、SDP、事件、质量、结束。
3. 用户层：正式域名、麦克风、AI 音频、字幕、退出和再次进入。

---

## 10. 上线阻断项

出现任意一项，不允许上线：

- 浏览器 bundle 包含长期 AI Key、Supabase secret key 或数据库密码。
- Production 构建包含 localhost。
- 业务函数关闭 JWT 且没有经过评审的自定义认证。
- 客户端可提交任意 `userId`。
- 用户 A 能读取或修改用户 B 数据。
- `public` 表未启用 RLS。
- 新表没有明确 GRANT。
- Edge Function CORS 使用生产 `*`。
- Vercel Preview 连接 Production Supabase。
- migration 不能从空库恢复。
- 没有自有 SMTP 却声称正式邮箱注册已完成。
- 没有上一稳定 Vercel deployment。
- 没有数据库恢复点。
- 没有真实麦克风/WebRTC 验收。
- 本地后端仍依赖进程内 session、本地 JSON、SQLite 或本地上传目录。

---

## 11. 回滚方案

### 前端

Vercel Production 别名切回上一稳定 READY deployment。

### Edge Function

从上一稳定 Git commit 重新部署函数。函数源码、prompt、依赖和配置必须全部在 Git 中。

### 数据库

- 优先使用向前修复 migration。
- 破坏性变更必须提前写明恢复方式。
- 采用“先加新字段/新表 → 双写/兼容 → 切换读取 → 最后删除旧结构”。
- 不依赖回滚前端来恢复已经破坏的数据结构。

### Secret

- 怀疑泄露时立即轮换。
- 轮换后检查 Function 与 Vercel 是否仍引用旧值。
- 不通过删除整个项目来处理单个 secret。

---

## 12. 未来完整项目交付给你时，你先检查什么

拿到项目后，先让开发同学填写：

| 问题 | 必须给出的答案 |
|---|---|
| 前端根目录 | 例如 `frontend` |
| 安装命令 | 例如 `npm ci` |
| 构建命令 | 例如 `npm run build` |
| 输出目录 | 例如 `dist` |
| Node 版本 | 22 |
| 本地后端入口 | 文件路径和启动命令 |
| 是否有常驻 WebSocket | 有/无，承担什么 |
| 是否有本地文件写入 | 路径和用途 |
| 数据库类型 | 当前本地类型及迁移方式 |
| 登录方案 | 是否已接 Supabase Auth |
| 实时媒体路径 | WebRTC / WebSocket / 其他 |
| 所有环境变量 | 名称、公开/秘密、Dev/Preview/Prod |
| 所有第三方服务 | 厂商、能力、超时、费用、回退 |
| 数据保留策略 | 字幕、音频、报告分别多久 |
| 健康检查 | URL 与返回示例 |
| 回滚目标 | 上一 commit/deployment |

然后全局搜索：

```bash
rg -n "localhost|127\\.0\\.0\\.1|local-demo-user"
rg -n "DASHSCOPE|service_role|sb_secret|API_KEY|SECRET|PASSWORD"
rg -n "WebSocket|RTCPeerConnection|EventSource|worker|queue|cron"
rg -n "sqlite|\\.db|writeFile|uploads|localStorage"
rg -n "userId|user_id|Authorization|Bearer"
```

搜索结果不是都要删除，而是逐项分类：

```text
前端公开配置
Edge Function Secret
Postgres 数据
Storage 文件
必须独立部署的常驻服务
仅本地开发代码
```

---

## 13. 两种例外情况

### 例外 A：未来完整项目仍有复杂 Java/Python 常驻后端

如果后端必须：

- 保持长期 WebSocket。
- 持续消费队列。
- 运行超过函数时限的任务。
- 依赖固定内存 session。
- 执行大型音视频处理。

则不能只用 Vercel + Supabase。

处理方式：

- Vercel 与 Supabase 仍保留。
- 常驻后端单独部署到容器平台。
- Supabase 继续承担 Auth、Postgres、Storage。
- 前端用 Supabase JWT 调常驻后端。

这属于新增第三个平台，需要单独评审，不在本方案默认范围。

### 例外 B：首发明确是匿名路演 Demo

可临时使用：

- `verify_jwt=false`。
- Function 内校验 publishable key。
- 精确 Origin。
- IP/user-agent hash 限流。
- 严格请求大小。
- 不保存敏感个人数据。

但这不能直接升级为正式账号产品。接入真实用户后必须切到 JWT 与 user ownership。

---

## 14. 暂时不需要上的复杂能力

首发不需要：

- Kubernetes。
- 微服务拆分。
- 分库分表。
- 多区域数据库。
- 自建模型推理集群。
- 复杂消息队列。
- 语义缓存。

先记录以下指标：

- 会话创建成功率。
- WebRTC 建连 P50/P95/P99。
- SDP 上游错误率。
- 活跃会话数。
- 每用户日分钟数。
- 模型调用费用。
- Function 4xx/5xx。
- 数据库 CPU、慢查询和连接数。

真实指标触发后再升级。

---

## 15. 最终交付验收清单

开发同学交付完整项目时，以下全部打勾才算“可部署”：

### 代码

- [ ] `frontend/` 可在全新 clone 后 `npm ci && npm run verify`。
- [ ] Node 22。
- [ ] `.env.example` 完整且无真实 secret。
- [ ] `vercel.json` 有 SPA 回退和安全头。
- [ ] Supabase browser client 唯一。
- [ ] Auth 是真实 Supabase Auth。
- [ ] API 请求携带 access token。
- [ ] 不接受客户端任意 `userId`。
- [ ] WebRTC 资源可完整释放。
- [ ] production build 不包含 localhost 或 secret。

### Supabase

- [ ] `supabase/config.toml` 在 Git 中。
- [ ] migration 可从空库恢复。
- [ ] 所有暴露表有 GRANT + RLS。
- [ ] RLS 跨用户测试通过。
- [ ] Edge Function 源码、依赖、prompt 在 Git 中。
- [ ] Production 业务函数验证 JWT。
- [ ] Secrets 不在 Git。
- [ ] Auth URL、Redirect、SMTP 已配置。
- [ ] Storage bucket 与 policy 可由代码恢复。

### Vercel

- [ ] Root Directory 正确。
- [ ] Build/Output/Node 配置正确。
- [ ] Preview 与 Production 使用不同 Supabase 环境。
- [ ] 三个公开变量已按环境配置。
- [ ] Preview E2E 通过。
- [ ] 正式域名和 HTTPS 正常。
- [ ] 上一稳定 deployment 可回滚。

### 线上验证

- [ ] 正式域名打开。
- [ ] 深层路由刷新不 404。
- [ ] 注册/验证/登录/退出/重置密码正常。
- [ ] 麦克风授权正常。
- [ ] 会话创建和 SDP 成功。
- [ ] AI 音频与字幕正常。
- [ ] 结束后麦克风和连接释放。
- [ ] 数据写入正确用户。
- [ ] 日志无 secret。
- [ ] 费用和错误告警已开启。

---

## 16. 官方参考

- Supabase Deployment：<https://supabase.com/docs/guides/deployment>
- Supabase Managing Environments：<https://supabase.com/docs/guides/deployment/managing-environments>
- Supabase Edge Function Secrets：<https://supabase.com/docs/guides/functions/secrets>
- Supabase Auth Redirect URLs：<https://supabase.com/docs/guides/auth/redirect-urls>
- Supabase API Security / GRANT / RLS：<https://supabase.com/docs/guides/api/securing-your-api>
- Supabase React Tutorial：<https://supabase.com/docs/guides/getting-started/tutorials/with-react>
- Vercel Vite：<https://vercel.com/docs/frameworks/frontend/vite>
- Vercel Deployments：<https://vercel.com/docs/deployments/overview>
- Vercel Environment Variables：<https://vercel.com/docs/environment-variables>

---

## 17. 一句话交付要求

可以把下面这段原样发给未来项目的开发同学：

> 请把完整本地项目整理成可由 Vercel 构建的 Vite/React 前端，以及可由 Supabase CLI/GitHub 部署的 migrations、Auth、Storage policies 和 Edge Functions。前端只能包含 Supabase URL 与 publishable key；所有 AI 长期密钥必须进入 Supabase Secrets。生产业务函数必须验证 Supabase JWT，并以 JWT `sub` 作为用户身份；所有用户数据必须有 GRANT、RLS 和 ownership 测试。实时音频由浏览器通过 WebRTC 直连百炼，Edge Function 只做 session、SDP、限流、落库和质量记录。交付前必须通过全新 clone、空库恢复、Preview E2E、构建产物密钥扫描和可回滚验证。
