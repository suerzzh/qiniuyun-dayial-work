# UniSpeaking Web：Vercel + Supabase 部署上线完整流程

> 日期：2026-07-14  
> 适用范围：Web 前端 + 后端接口 + Supabase 数据库/Auth/Storage/Edge Functions  
> 适用对象：本地已经能够完整运行前后端，准备迁移、联调、部署和长期维护的 UniSpeaking 开发团队  
> 当前参考生产站点：<https://unispeaking-web.vercel.app>

---

## 本次新增的两份专项行动指南

如果现在从 GitHub 接入自动部署并绑定 `unispeaking.cn`，请直接执行：

- [GitHub → Vercel/Supabase → unispeaking.cn 上线行动指南](./01_GitHub到Vercel与Supabase并绑定unispeaking.cn行动指南.md)

如果后续准备把 Web/API 迁移到自有服务器，请执行：

- [UniSpeaking 后续迁移到自有服务器行动指南](./02_UniSpeaking迁移到自有服务器行动指南.md)

如果开发团队正在把“本地可运行版本”整理成可部署版本，请先执行：

- [UniSpeaking 开发团队部署前置准备与生产化改造行动指南](./03_UniSpeaking开发团队部署前置准备与生产化改造行动指南.md)

本文件继续作为平台职责、接口边界和常见运维操作的总说明；三份专项指南分别覆盖当前上线、开发交接和未来服务器迁移。

---

## 1. 先给结论：两个平台分别负责什么

推荐的生产职责如下：

```text
用户浏览器
   │
   ├─ HTTPS ──> Vercel
   │             ├─ Web 页面、静态资源
   │             ├─ Next.js/适合 Serverless 的短请求接口（如有）
   │             └─ Preview / Production / 自定义网站域名
   │
   └─ HTTPS ──> Supabase
                 ├─ Postgres 数据库
                 ├─ Auth 用户认证
                 ├─ Storage 文件存储
                 ├─ Realtime 数据变化订阅
                 └─ Edge Functions：需要服务端密钥的短请求接口
                                      │
                                      └─ 百炼等第三方 AI 服务
```

对当前 UniSpeaking 自由对话链路：

- Vercel 托管完整 Web UI。
- 浏览器负责麦克风、WebRTC、DataChannel、字幕渲染和 AI 音频播放。
- Supabase Edge Function 负责保护百炼密钥、创建会话、交换 SDP、写入最终文字和指标。
- Supabase Postgres 保存会话元数据、最终文字和学习等级。
- 原始音频不上传、不落库。

当前这套链路已经完成真实生产验证，可以作为队友完整迁移后的上线参考基线。

---

## 2. 本地项目能运行，不代表可以直接原样上线

部署前必须先判断本地“后端”属于哪一种形态。

| 本地后端能力 | 推荐上线位置 | 是否需要改造 |
|---|---|---|
| 普通 CRUD、鉴权校验、短时第三方 API 调用 | Vercel Function 或 Supabase Edge Function | 通常只需改成无状态请求处理器 |
| 数据库、用户、文件、数据库事件订阅 | Supabase Database/Auth/Storage/Realtime | 按 Supabase 数据模型和权限体系迁移 |
| 需要隐藏百炼 Key 的 SDP/Token/会话初始化接口 | Supabase Edge Function | 推荐，与当前方案一致 |
| Next.js Route Handler / Server Action | Vercel | 可以直接随 Next.js 部署，但仍要检查超时与无状态要求 |
| 独立 Express/FastAPI，依赖一直运行的进程和监听端口 | 不能原样当传统服务器部署 | 拆成 Functions，或选择真正的常驻服务平台 |
| 长期 WebSocket、无限时长任务、内存队列 | 不应直接假定适合 Vercel/Supabase Edge Function | 改为 WebRTC、短连接、队列/工作流或独立常驻服务 |
| 写入本地 JSON、SQLite、上传目录 | 不能依赖云函数本地磁盘持久化 | 改用 Supabase Postgres/Storage |
| 定时任务、异步报告、长耗时分析 | Cron + 短任务，或队列/Workflow/Worker | 拆分同步请求与异步任务 |

判断标准：

1. 每次请求是否可以由任意一个新实例处理？
2. 实例重启后，业务状态是否仍保存在数据库/对象存储中？
3. 是否依赖永久内存、固定进程、固定端口或本地文件？
4. 请求是否能在平台规定时限内完成？
5. 长连接断开后是否有重连、幂等和状态恢复策略？

只要第 2、3、4 项不满足，就应在部署前先改造后端，而不是直接上传代码。

---

## 3. 建议队友迁移后保留的仓库结构

如果完整项目使用 Monorepo，建议至少保留这些边界：

```text
unispeaking/
├── apps/
│   └── web/                       # 部署到 Vercel 的 Web 项目
│       ├── src/
│       ├── public/
│       ├── package.json
│       ├── .env.example
│       └── vercel.json            # 只有确实需要时才添加
├── packages/
│   ├── contracts/                 # 前后端共享请求/响应/事件类型
│   ├── config/                    # 非敏感配置与校验器
│   └── observability/             # 日志、trace、错误上报封装
├── supabase/
│   ├── config.toml
│   ├── migrations/                # 所有数据库结构变更
│   ├── functions/                 # Edge Functions
│   └── seed.sql                   # 只放可公开的开发/测试种子数据
├── tests/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── api.md
│   ├── deployment.md
│   └── runbook.md
├── .gitignore
├── package.json
└── README.md
```

如果队友交付的是“一个前端目录 + 一个传统后端目录”，上线前先把后端接口分类，再决定哪些迁入 `apps/web` 的 Serverless API、哪些迁入 `supabase/functions`，不要同时保留两套重复接口。

---

## 4. 部署前必须预留的内容

### 4.1 环境划分

至少区分三套环境：

| 环境 | 用途 | 网站 | 数据 |
|---|---|---|---|
| Local | 本地开发 | localhost | 本地 Supabase 或专用开发项目 |
| Preview/Staging | PR 联调、产品验收 | Vercel Preview URL 或 `staging.example.com` | Supabase Branch 或独立测试项目 |
| Production | 正式用户 | 正式域名 | 正式 Supabase 项目 |

不要让所有 Preview 分支无条件读写生产数据库。预算有限时，至少保证：

- Preview 使用单独的测试数据和测试账号。
- Preview 不拥有生产 `service_role`/Secret Key。
- Preview 不发送真实生产邮件、支付、短信或推送。
- Production Secrets 只授权给 Production 环境。

### 4.2 一份完整的 `.env.example`

仓库必须提交变量名和说明，但不能提交真实值：

```dotenv
# 浏览器可见；只能放公开配置
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=

# Supabase Edge Function Secrets；绝不能进入浏览器
DASHSCOPE_API_KEY=
BAILIAN_WORKSPACE_ID=
BAILIAN_MODEL=qwen3.5-omni-plus-realtime
ALLOWED_WEB_ORIGINS=http://localhost:3000

# 仅服务端使用（若业务确实需要）
SUPABASE_SECRET_KEY=
```

如果项目使用 Vite，将 `NEXT_PUBLIC_` 换成 `VITE_`；凡带 `NEXT_PUBLIC_` 或 `VITE_` 的变量都会进入浏览器包，绝不能放百炼 Key、Supabase Secret Key、数据库密码或管理 Token。

当前原生静态 UI 使用 `runtime-config.mjs` 保存 Supabase URL 和 Publishable Key。这两项属于公开配置，可以出现在浏览器；完整迁移到 Next.js/Vite 后建议改成构建环境变量，并保留启动时缺失校验。

### 4.3 接口契约

正式部署前，每个接口至少要明确：

- HTTP 方法和路径。
- 请求字段、类型、最大长度和必填项。
- 成功响应结构。
- 错误结构、错误码、是否可重试。
- 是否需要用户登录、公开 Key 或服务端权限。
- 超时时间、限流规则和幂等键。
- 是否保存个人数据、保存期限和删除方式。
- 日志中哪些字段可以记录，哪些必须脱敏。

当前自由对话网关接口可以作为示例：

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/functions/v1/realtime-gateway/health` | 健康检查与模型配置状态 |
| `POST` | `/functions/v1/realtime-gateway/session` | 创建短期 Realtime 会话 |
| `POST` | `/functions/v1/realtime-gateway/sdp?session_id=...` | 代理 WebRTC SDP |
| `POST` | `/functions/v1/realtime-gateway/session/{id}/events` | 保存最终文本事件 |
| `POST` | `/functions/v1/realtime-gateway/session/{id}/learner-level` | 更新学习等级 |
| `POST` | `/functions/v1/realtime-gateway/session/{id}/metrics` | 保存匿名质量指标 |
| `DELETE` | `/functions/v1/realtime-gateway/session/{id}` | 关闭会话 |

建议完整迁移后为 API 增加 `/v1` 版本层，或至少保证旧客户端使用的字段不会被直接删除。

### 4.4 数据库迁移制度

必须做到：

- 所有表、索引、函数、触发器和权限变化都写入 `supabase/migrations`。
- 不把生产控制台的临时点击操作当作正式 schema 变更。
- migration 文件进入 Git，与对应代码一起评审。
- migration 尽量可重复验证、向后兼容。
- 生产变更前先在本地或 Staging 执行。
- 同一时间由一个明确负责人执行生产 migration。

需要删除字段或改变字段类型时，使用“扩展—迁移—收缩”：

1. 先新增新字段/新表，并保持旧代码可用。
2. 部署同时读写或回填数据的代码。
3. 验证新字段稳定。
4. 再部署只读取新字段的代码。
5. 最后用另一份 migration 删除旧字段。

不要把破坏性数据库变更与无法回滚的前端发布放在同一步。

### 4.5 权限与安全

上线前逐项确认：

- 暴露给 Data API 的表全部开启 RLS。
- 每条 policy 既验证登录状态，也验证资源所有权。
- `UPDATE` policy 同时有 `USING` 和 `WITH CHECK`。
- 浏览器绝不持有 Supabase Secret Key、旧 `service_role` 或百炼 Key。
- Edge Function/服务端日志不打印 Secret、Authorization、完整 SDP 或敏感用户文本。
- 上传文件限制类型、大小、路径和访问 policy。
- CORS 使用准确域名，不使用生产 `*`。
- 创建会话、注册、登录、上传和 AI 调用均有服务端限流。
- 管理员账号开启 MFA，至少有两个可靠 Owner。
- 正式项目检查 Security Advisor 和 Performance Advisor。

注意：新表是否暴露给 Supabase Data API，与是否启用 RLS 是两件事。需要浏览器访问的表，要同时确认 Data API grant 和 RLS policy；只允许 Edge Function 访问的表应保持默认拒绝。

### 4.6 域名和回调地址预留

建议在代码中统一定义：

```text
PUBLIC_SITE_URL=https://app.example.com
API_BASE_URL=https://<project-ref>.supabase.co/functions/v1
```

不要在多个组件中散落硬编码网址。以下位置都可能依赖正式域名：

- Supabase Auth `Site URL`。
- Supabase Auth `Redirect URLs`。
- OAuth 平台的回调 URL。
- Edge Function `ALLOWED_WEB_ORIGINS`。
- CSP `connect-src`。
- 邮件确认、密码重置链接。
- 支付 Webhook/返回地址。
- 分享链接、SEO canonical、sitemap、robots。
- Cookie Domain、CORS 和 CSRF 校验。

### 4.7 健康检查和可观测性

至少预留：

- `/health`：进程/函数存活，不返回 Secret。
- `/ready`（可选）：数据库和必要上游是否可用。
- 结构化日志：`request_id`、`user_id_hash`、route、status、latency、provider_error_code。
- Vercel 构建日志、Function 日志。
- Supabase Edge Function 日志、数据库 Advisor、慢查询。
- 前端错误上报和关键业务漏斗。
- 告警阈值：5xx、AI 上游失败率、会话创建失败、延迟、费用异常。

---

## 5. 上线前账号和工具准备

### 5.1 账号

需要：

- GitHub/GitLab/Bitbucket 代码仓库。
- Vercel Team 和项目管理权限。
- Supabase Organization 和项目管理权限。
- 域名注册商/DNS 管理权限（使用自定义域名时）。
- 百炼 Workspace 和 API Key 管理权限。
- OAuth、邮件、支付等外部平台权限（项目用到时）。

不要只让一个人拥有生产账号。建议至少两名 Owner，并使用团队账号、MFA 和密码管理器。

### 5.2 CLI

在执行机器安装后先检查版本和实际帮助，不要盲目复制旧命令：

```bash
supabase --version
supabase --help
supabase db push --help
supabase functions deploy --help

vercel --version
vercel --help
vercel deploy --help
```

官方常用安装方式：

```bash
npm install --save-dev supabase
npm install --save-dev vercel
```

团队项目推荐把 CLI 固定在 `devDependencies` 和 lockfile 中，通过 `npx supabase`、`npx vercel` 使用固定版本，避免每个人全局版本不同。

---

## 6. 第一步：把完整迁移项目在本地验收到“可上线”

在部署任何云端资源前完成：

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

项目没有某个脚本时，应由队友补齐，而不是跳过对应质量检查。

本地验收清单：

- [ ] 全新 clone 后按 README 能启动。
- [ ] `.env.example` 覆盖全部必需变量。
- [ ] `.env.local`、`.env.production.local` 已被 `.gitignore` 忽略。
- [ ] 仓库扫描不到真实 Key、密码和 Token。
- [ ] 前端构建通过。
- [ ] 后端接口测试通过。
- [ ] 数据库 migration 能从空库完整执行。
- [ ] 重复刷新、断网重连、麦克风拒绝、上游超时有明确错误。
- [ ] 不依赖本地 JSON/SQLite/上传目录保存生产数据。
- [ ] 关闭本地后端进程再重启，业务状态仍能从数据库恢复。

---

## 7. 第二步：准备 Supabase 环境

### 7.1 选择项目策略

有三种做法：

1. **继续使用当前生产项目**：适合兼容升级，必须先在 Preview/Staging 验证 migration。
2. **创建独立 Staging 项目**：最容易理解，成本和配置工作略高。
3. **使用 Supabase Branching**：每个分支有独立数据库和 Key，适合成熟 Git/PR 流程。

完整迁移期间推荐保留当前生产链路不动，让新代码先连接 Staging；验收完成后再切 Production。

### 7.2 登录并链接项目

在仓库根目录执行：

```bash
npx supabase login
npx supabase link --project-ref <SUPABASE_PROJECT_REF>
```

`<SUPABASE_PROJECT_REF>` 是 Supabase 项目 ID，不是数据库密码。

检查 `supabase/config.toml` 的项目和函数配置，示例：

```toml
project_id = "<SUPABASE_PROJECT_REF>"

[functions.realtime-gateway]
verify_jwt = false
```

`verify_jwt = false` 不是通用推荐。当前公开 Demo 使用 Publishable Key，并在函数内额外校验 Key、Origin、限流和会话期限，所以采用此配置。完整项目加入正式用户登录后，私有接口应验证用户 JWT 和资源归属，不要直接复制公开 Demo 的鉴权方式。

### 7.3 本地验证 migration

```bash
npx supabase start
npx supabase db reset
npx supabase migration list
```

如果本地 schema 是通过控制台/手写 SQL 临时改出来的，先整理成正式 migration，再继续部署。

团队协作原则：不要在生产 Table Editor/SQL Editor 直接改变 schema；远端有临时变更时，应先通过 `supabase db pull` 恢复 migration 历史一致性。

### 7.4 部署数据库 migration

先检查将要执行的内容：

```bash
npx supabase db push --dry-run
```

确认无破坏性变更后执行：

```bash
npx supabase db push
npx supabase migration list
```

部署后在 Dashboard 检查：

- Database → Tables：表、字段、索引是否存在。
- Database → Policies：RLS 是否启用、policy 是否正确。
- Database → Security Advisor：无高危项。
- Database → Performance Advisor：无明显索引/查询问题。
- Integrations/Data API：需要暴露的 schema/table 是否已正确授权。

### 7.5 配置 Edge Function Secrets

路径：

```text
Supabase Dashboard
→ Project
→ Edge Functions
→ Secrets
```

每个变量单独一组 Name/Value。当前 Realtime 网关：

| Name | 是否必需 | Value 内容 |
|---|---|---|
| `DASHSCOPE_API_KEY` | 必需 | 百炼新生成的 API Key，只填值 |
| `BAILIAN_WORKSPACE_ID` | 必需 | 百炼 Workspace ID |
| `BAILIAN_MODEL` | 建议 | `qwen3.5-omni-plus-realtime` |
| `ALLOWED_WEB_ORIGINS` | 生产建议 | 正式域名和必要本地地址，逗号分隔 |

也可以使用 CLI，但不要把 Secret 写进 shell history、文档或 Git：

```bash
npx supabase secrets set --env-file supabase/.env.production
```

其中 `supabase/.env.production` 必须加入 `.gitignore`，使用后按团队安全制度保存或销毁。

Supabase 会自动向 Edge Function 提供项目 URL、Publishable Keys 和 Secret Keys。浏览器只能使用 Publishable Key；Secret Key/旧 `service_role` 会绕过 RLS，只能存在于可信服务端。

### 7.6 部署 Edge Functions

部署单个函数：

```bash
npx supabase functions deploy realtime-gateway --project-ref <SUPABASE_PROJECT_REF>
```

或部署 `supabase/functions` 中全部函数：

```bash
npx supabase functions deploy --project-ref <SUPABASE_PROJECT_REF>
```

部署后验证：

```bash
curl 'https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/realtime-gateway/health' \
  -H 'apikey: <SUPABASE_PUBLISHABLE_KEY>'
```

健康响应应只显示状态，例如：

```json
{
  "status": "ok",
  "model_configured": true
}
```

不要让健康接口返回 Key、Workspace 详细信息、数据库连接串或用户数据。

### 7.7 配置 Supabase Auth（项目使用登录时）

打开：

```text
Authentication → URL Configuration
```

设置：

- `Site URL`：正式生产站点，例如 `https://app.example.com`。
- `Redirect URLs`：精确加入登录回调、邮箱确认和密码重置路径。
- 本地开发：如 `http://localhost:3000/**`。
- Vercel Preview：使用受控的 Team Preview 模式，不要配置任意互联网域名通配符。

如果使用 Google/GitHub 等 OAuth，还要在对应 OAuth 平台添加 Supabase 回调：

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

注意区分两种回调：

- OAuth Provider 回调到 Supabase：上面这条 `/auth/v1/callback`。
- Supabase 完成登录后回到网站：在 Auth `Redirect URLs` 配置的网站地址。

---

## 8. 第三步：在 Vercel 创建项目

### 8.1 推荐方式：连接 Git 仓库

1. 将完整迁移代码推送到 GitHub/GitLab/Bitbucket。
2. 登录 Vercel Dashboard。
3. 点击 `Add New → Project`。
4. 选择代码仓库并点击 Import。
5. 设置 Project Name，例如 `unispeaking-web`。
6. 如果是 Monorepo，将 Root Directory 指向 `apps/web`。
7. 检查 Framework Preset。
8. 检查 Install Command、Build Command、Output Directory。
9. 暂时先部署 Preview 或导入后立即配置环境变量。

常见框架设置：

| 项目 | Framework Preset | Build Command | Output |
|---|---|---|---|
| Next.js | Next.js | `npm run build` | 自动识别 |
| Vite React | Vite | `npm run build` | `dist` |
| 原生静态站点 | Other | 可为空 | 项目根或指定目录 |

项目名需要小写，可包含字母、数字、`.`、`_`、`-`。

### 8.2 Vercel 环境变量

路径：

```text
Vercel Project → Settings → Environment Variables
```

至少配置 Web 构建所需公开变量：

| 变量 | Production | Preview | Development |
|---|---:|---:|---:|
| `NEXT_PUBLIC_SUPABASE_URL` | 正式项目 | 测试/Branch 项目 | 本地/开发项目 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 正式 Publishable Key | 测试 Key | 开发 Key |
| `NEXT_PUBLIC_SITE_URL` | 正式域名 | Preview 可动态计算 | localhost |

如果 Vercel Function 本身需要服务端变量，可以在 Vercel 设置非 `NEXT_PUBLIC_` 变量；但当前百炼 Key 已由 Supabase Edge Function 使用，不应再重复放进 Web 前端项目。

环境变量更新后，旧 deployment 不会自动重新构建。应创建一次新的 deployment，确认新构建读取了更新后的变量。

### 8.3 `vercel.json` 要预留什么

只有需要时才配置：

- 安全响应头。
- SPA 路由 rewrite。
- Redirect。
- Function 区域和时限。
- Cron。

当前站点已经配置 CSP、麦克风权限、`nosniff` 和 Referrer Policy。完整迁移后尤其要更新 CSP `connect-src`，确保包含正确的 Supabase/API 域名，同时不要放开成无边界的 `*`。

Next.js 通常不需要为了路由再写 SPA fallback；Vite/纯 SPA 使用 History Router 时才需要 rewrite 到 `index.html`。当前原型使用 hash 路由，不需要该 rewrite。

---

## 9. 第四步：先部署 Preview，不直接覆盖 Production

Vercel Git 集成的标准流程：

1. 从 `main` 创建功能/迁移分支。
2. 推送分支并创建 PR。
3. Vercel 自动生成 Preview deployment 和 URL。
4. Preview 连接 Staging/Branch Supabase。
5. 执行产品验收、接口验收和 E2E。
6. 检查 Vercel/Supabase 日志。
7. 验收通过后合并到生产分支。

也可以用 CLI 手工创建 Preview：

```bash
npx vercel link
npx vercel
```

Preview 验收清单：

- [ ] 首页、登录、自由对话、训练、复习、个人中心均可进入。
- [ ] 浏览器控制台无未处理异常。
- [ ] 页面刷新和直接打开深层路由不 404。
- [ ] 登录、退出、邮件确认、密码重置回调正确。
- [ ] 麦克风授权允许/拒绝均有正确表现。
- [ ] AI 主动开场、用户转写、AI 文本和音频完整。
- [ ] 静音、文字输入、结束会话和刷新清理正确。
- [ ] 数据只写入 Staging，不污染 Production。
- [ ] Edge Function 无持续 4xx/5xx、上游超时或 Secret 泄露。
- [ ] 移动浏览器布局可用，即使本轮只部署 Web。

---

## 10. 第五步：生产发布顺序

推荐顺序：

```text
1. 冻结本次发布范围
2. 备份/确认恢复点
3. 执行向后兼容的数据库 migration
4. 部署 Supabase Edge Functions
5. 验证健康接口和核心 API
6. 部署 Vercel Preview
7. 完成 E2E 和产品验收
8. Promote Preview 或合并 main 生成 Production
9. 验证正式域名
10. 观察日志和指标
```

使用 Git 集成时，合并到生产分支会自动生成 Production deployment。

CLI 方式：

```bash
npx vercel --prod
```

更稳妥的方式是验证一个确定的 Preview 后再 Promote，确保正式环境使用的是同一构建产物，而不是重新构建一份未经验证的产物。

生产发布完成后，不要只检查首页。至少执行：

1. 首页 HTTP 200、静态资源无 404。
2. 登录/退出和回调。
3. `GET /health`。
4. 创建并关闭一次真实会话。
5. 完成一轮真实语音、转写和 AI 音频。
6. 查看数据库是否写入预期数据且没有音频。
7. 查看 Vercel 和 Supabase 最近日志。
8. 检查安全响应头、CORS 和 CSP。
9. 检查移动端浏览器和主流桌面浏览器。

---

## 11. 网站网址能不能改？可以，推荐绑定自有域名

### 11.1 方案 A：继续使用 `vercel.app`

Vercel 会根据项目/部署生成 `*.vercel.app` 地址。项目名称参与生成 URL。

可以在：

```text
Vercel Project → Settings → General → Project Name
```

修改项目名，然后创建新 deployment，并在 Domains/Deployment 页面确认新的正式地址。项目名可能被占用，生成 URL 也可能包含 Team slug，因此不要只根据名称猜测最终 URL。

这种方式适合测试；正式产品更建议方案 B。

### 11.2 方案 B：绑定自有域名

例如：

```text
unispeaking.com
www.unispeaking.com
app.unispeaking.com
```

操作步骤：

1. 购买并持有域名。
2. 打开 `Vercel Project → Settings → Domains`。
3. 点击 `Add Domain`，输入域名。
4. 如果是根域名，按 Vercel 页面提示配置 A 记录或 Nameservers。
5. 如果是子域名，按页面提示配置唯一 CNAME；不要照抄其他项目的 CNAME。
6. 如果域名已在其他 Vercel 账号使用，按提示添加 TXT 验证记录。
7. 等待 DNS 验证和 HTTPS 证书生效。
8. 同时添加 `www` 和根域名，并选择其中一个作为主域名，另一个做永久重定向。
9. 用正式域名完成一次完整验收。

推荐使用 `app.unispeaking.com` 作为 Web 产品入口，官网可保留在 `www.unispeaking.com`。

### 11.3 改域名后必须同步修改的地方

假设从：

```text
https://unispeaking-web.vercel.app
```

改为：

```text
https://app.unispeaking.com
```

必须同步：

1. Vercel `NEXT_PUBLIC_SITE_URL`。
2. Supabase Auth `Site URL`。
3. Supabase Auth `Redirect URLs`。
4. Supabase Edge Function Secret `ALLOWED_WEB_ORIGINS`。
5. Edge Function 内任何 Origin allowlist。
6. OAuth 平台允许的登录回调/来源。
7. CSP、CORS、Cookie 和 CSRF 配置。
8. 邮箱确认、找回密码和邀请链接。
9. 支付回调、Webhook 和第三方平台白名单。
10. SEO canonical、sitemap、分享链接和文档。

当前 Realtime 函数虽然自动允许 `*.vercel.app`，自定义域名仍应明确加入 `ALLOWED_WEB_ORIGINS`：

```text
https://app.unispeaking.com,http://localhost:3000
```

完成新域名验证后，旧域名先保留一段时间并重定向，确认登录、邮件和第三方回调全部稳定后再考虑移除。

### 11.4 是否需要修改 Supabase 自己的网址

通常不需要。网站可以使用 Vercel 自定义域名，同时继续调用：

```text
https://<project-ref>.supabase.co
```

Supabase 也支持付费 API 自定义域名，例如 `api.unispeaking.com`，但这是另一项配置，不是修改网站域名的必需步骤。如果未来启用 Supabase API 自定义域名，还要同步 OAuth/SAML 回调和客户端 Supabase URL。

---

## 12. 推荐的 Git 与自动部署流程

最简单且足够可靠的团队流程：

```text
feature branch
   ↓ push / PR
Vercel Preview + Staging Supabase
   ↓ 自动测试 + 产品验收
合并 main
   ↓
Supabase migration / functions deployment
   ↓
Vercel Production
   ↓
生产冒烟测试与监控
```

分支要求：

- `main`：唯一生产分支。
- 功能分支：只能产生 Preview。
- migration 与使用它的代码必须在同一个 PR 中说明部署顺序。
- Production Secrets 只能由少数管理员维护。
- 禁止开发者从本地随意执行生产 `db push`。

如果暂时不搭建自定义 CI，也可以使用 Vercel Git 自动部署 + Supabase Dashboard/CLI 人工受控部署。团队成熟后再把测试、migration 和 functions deploy 放进 CI。

---

## 13. 常见更新操作

### 13.1 只修改前端

```text
改代码 → lint/typecheck/test/build → PR → Preview 验收 → 合并 main → Production 验收
```

### 13.2 修改 Vercel 环境变量

1. Project → Settings → Environment Variables。
2. 选择正确的 Production/Preview/Development 范围。
3. 保存。
4. 创建新 deployment。
5. 验证新 deployment，不要以旧页面缓存判断。

### 13.3 修改 Supabase Edge Function Secret

1. Edge Functions → Secrets。
2. 按原 Name 替换 Value。
3. 不在聊天、工单或日志中粘贴真实值。
4. 调用健康接口和真实最小请求。
5. 旧 Key 在供应商控制台撤销。

### 13.4 修改 Edge Function

```bash
npx supabase functions deploy <function-name> --project-ref <SUPABASE_PROJECT_REF>
```

部署后检查 `/health`、核心接口、函数日志和上游错误。

### 13.5 修改数据库

```bash
npx supabase migration new <change_name>
npx supabase db reset
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

不要直接编辑已经进入生产的旧 migration；新增一份 migration 修正。

### 13.6 更换百炼 API Key

1. 在百炼创建新 Key。
2. 在 Supabase 替换 `DASHSCOPE_API_KEY`。
3. 健康检查和真实通话验证。
4. 确认新 Key 生效后撤销旧 Key。
5. 检查日志、Git 历史和聊天记录是否泄露旧 Key。

### 13.7 查看日志

Vercel：

```bash
npx vercel ls
npx vercel inspect <deployment-url>
npx vercel logs <deployment-url>
```

Supabase：

- Dashboard → Edge Functions → 对应函数 → Logs。
- Dashboard → Logs Explorer。
- Database → Security Advisor / Performance Advisor。

日志中保留 request ID 和错误码，隐藏 Key、Token、Cookie、Authorization 和个人敏感内容。

---

## 14. 回滚原则

### 14.1 Vercel 前端回滚

- 在 Deployments 选择上一条已验证成功的 deployment。
- 使用 Promote/Rollback 将生产域名重新指向旧版本。
- 回滚后重新跑生产冒烟测试。

CLI 示例：

```bash
npx vercel rollback
```

### 14.2 Edge Function 回滚

- 从 Git tag/上一提交取出旧函数代码。
- 重新部署旧版本。
- 验证健康接口、鉴权、数据写入和上游调用。

因此每次发布都必须有明确 commit/tag，不能只在 Dashboard 中编辑而不保存源码。

### 14.3 数据库回滚

生产数据库优先使用“前向修复 migration”，不要通过删除表或重放旧 SQL 粗暴回滚。

发布前应知道：

- 是否有备份/PITR。
- 本次 migration 是否会丢数据。
- 旧代码是否兼容新 schema。
- 修复 migration 如何恢复服务。

只有灾难恢复才考虑从备份恢复整个数据库，并且要评估恢复点之后的数据损失。

---

## 15. 常见故障排查

| 现象 | 优先检查 |
|---|---|
| Vercel 构建失败 | Root Directory、lockfile、Node 版本、Build Command、缺失环境变量 |
| 页面打开但 API 失败 | Supabase URL/Publishable Key、CSP `connect-src`、CORS、函数路径 |
| 生产可用、Preview 不可用 | Preview 环境变量、Supabase Auth Preview Redirect URL、Origin 白名单 |
| 登录后跳回 localhost | Supabase Auth Site URL/Redirect URLs、代码中的 `redirectTo` |
| 点击麦克风无弹窗 | HTTPS、浏览器站点权限、系统麦克风权限、可用输入设备 |
| 健康检查 `model_configured:false` | Supabase Secrets 中 API Key/Workspace ID 是否存在 |
| 会话返回 401 | `apikey` 是否为当前项目 Publishable Key；私有接口 JWT 是否有效 |
| 会话返回 403 | 当前网站 Origin 未加入 allowlist |
| 会话返回 429 | 限流命中，检查是否重复点击、重试策略或恶意流量 |
| SDP 返回 502/超时 | 百炼 Key、Workspace、模型、区域、上游网络和函数日志 |
| 数据表访问 401/403/空结果 | Data API grant、RLS policy、用户 JWT、资源所有权条件 |
| 更新数据返回 0 行但无报错 | RLS 缺少 SELECT policy 或 UPDATE 的 `USING/WITH CHECK` |
| 换域名后登录失败 | Site URL、Redirect URLs、OAuth 回调、Origin/CORS/Cookie 未同步 |
| 环境变量改了仍不生效 | Vercel 是否重新部署；变量是否设置到正确环境 |
| 本地能写文件、线上丢失 | 云函数本地磁盘不是持久化存储，应迁移到 Postgres/Storage |

---

## 16. 正式上线最终检查表

### 代码和构建

- [ ] `npm ci` 成功。
- [ ] lint、typecheck、test、build 全部通过。
- [ ] lockfile 已提交。
- [ ] 不存在真实 Secret。
- [ ] `.env.example` 完整。
- [ ] README 包含本地启动与部署方法。

### Supabase

- [ ] migration 在 Staging 验证。
- [ ] 生产 `db push` 成功，migration history 一致。
- [ ] RLS、grant、policy 审查通过。
- [ ] Security/Performance Advisor 无阻断项。
- [ ] Edge Functions 已部署。
- [ ] Secrets 已设置且未泄露。
- [ ] Auth Site URL/Redirect URLs 正确。
- [ ] 备份、恢复方式和 Owner 权限明确。

### Vercel

- [ ] Root Directory/Framework/Build/Output 正确。
- [ ] Preview 和 Production 环境变量分开。
- [ ] Preview 验收通过。
- [ ] Production deployment 为 READY。
- [ ] 正式域名和 HTTPS 正常。
- [ ] CSP、安全响应头、CORS 正确。
- [ ] 旧域名重定向策略明确。

### 业务链路

- [ ] 注册/登录/退出/找回密码。
- [ ] 自由对话创建、WebRTC、字幕、AI 音频。
- [ ] 静音、文字发送、结束和刷新清理。
- [ ] 场景、训练、复习、个人数据读取。
- [ ] 数据写入正确，用户之间不能越权。
- [ ] 原始音频和 Secret 未落库/未进日志。
- [ ] 失败提示、重试、限流和超时正确。

### 运维

- [ ] 已记录发布 commit、deployment 和 migration。
- [ ] Vercel/Supabase 日志可访问。
- [ ] 5xx、上游失败、延迟和费用有监控。
- [ ] 前端、函数和数据库回滚负责人明确。
- [ ] 上线后至少观察 30～60 分钟关键指标。

---

## 17. 针对 UniSpeaking 完整迁移的推荐执行顺序

队友完成全量迁移后，按下面顺序交接最稳妥：

1. 队友提交完整仓库、`.env.example`、migration、Edge Functions 和接口文档。
2. 使用全新目录 clone，按 README 本地启动前后端。
3. 执行 lint/typecheck/test/build，并从空数据库运行全部 migration。
4. 对照第 2 节，把传统后端中的内存状态、本地文件、长连接逐项改造。
5. 先部署到 Staging Supabase。
6. 设置 Staging Secrets、Auth 回调和测试数据。
7. 在 Vercel 导入仓库，Root Directory 指向 Web 应用。
8. 配置 Preview 环境变量，生成 Preview deployment。
9. 完成全功能、权限、异常和 Realtime E2E 验收。
10. 对生产数据库执行向后兼容 migration。
11. 部署生产 Edge Functions，并完成健康/API 验证。
12. Promote 已验收的 Web deployment 或合并生产分支。
13. 绑定正式自定义域名，并同步 Auth、Origin、OAuth、CSP 和邮件链接。
14. 完成正式域名的生产冒烟测试。
15. 观察日志、错误率、实时链路成功率、延迟和费用。
16. 将本次 deployment、migration、域名和回滚点写入发布记录。

如果队友的迁移项目改变了 API 路径、数据库表或鉴权方式，不要直接覆盖当前已跑通的生产链路；先用 Preview/Staging 并行验证，再切换正式流量。

---

## 18. 当前项目可直接参考的文件

当前已跑通项目位于：

```text
/Users/mac/Documents/七牛云/7.14/UniSpeaking_Complete_UI
```

重点文件：

| 文件 | 参考价值 |
|---|---|
| `src/runtime-config.mjs` | 浏览器公开配置边界 |
| `src/services/realtime-api.mjs` | 前端到 Edge Function 的接口封装 |
| `src/realtime/realtime-client.mjs` | WebRTC/DataChannel 客户端链路 |
| `supabase/functions/realtime-gateway/index.ts` | Secret、Origin、限流、SDP 代理和数据写入 |
| `supabase/migrations/202607140001_realtime_web.sql` | 表、索引、RLS 和默认拒绝策略 |
| `supabase/config.toml` | Edge Function 部署配置 |
| `vercel.json` | 静态站点安全响应头和 CSP |
| `.env.example` | 变量清单 |
| `UniSpeaking_UI与Demo链接及部署操作说明.md` | 本次实际链接和首次部署记录 |

完整迁移项目不必保持相同文件名，但应保持相同的职责边界、安全边界和可验证部署流程。

---

## 19. 官方参考资料

- [Vercel Git 部署](https://vercel.com/docs/git)
- [Vercel Local、Preview、Production 环境](https://vercel.com/docs/deployments/environments)
- [Vercel 环境变量](https://vercel.com/docs/environment-variables)
- [Vercel 添加自定义域名](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Vercel 生成的 Deployment URL](https://vercel.com/docs/deployments/generated-urls)
- [Vercel Functions 限制](https://vercel.com/docs/functions/limitations)
- [Supabase 数据库迁移](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Edge Function 部署](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase Branching](https://supabase.com/docs/guides/deployment/branching)
- [Supabase API 自定义域名](https://supabase.com/docs/guides/platform/custom-domains)

---

## 20. 一句话交接标准

只有当“新成员从 Git clone 后能本地运行、migration 能从空库执行、Preview 能完整验收、Production 可监控且可回滚、Secret 不进入浏览器或仓库、改域名有明确联动清单”全部成立时，才算真正完成了可持续的部署上线，而不只是生成了一个临时可访问网址。
