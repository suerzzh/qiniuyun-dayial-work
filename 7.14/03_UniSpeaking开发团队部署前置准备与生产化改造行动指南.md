# UniSpeaking 开发团队部署前置准备与生产化改造行动指南

> **执行对象：** 已经完成本地开发，团队成员克隆 GitHub 仓库并按 README 配置后可以完整运行项目的开发团队。  
> **执行目标：** 把“本地可复现版本”整理成可连接 GitHub、Vercel、Supabase 并安全上线的“生产候选版本”。  
> **适用范围：** 当前路演阶段的 Web 端，不包含 iOS、Android，也不要求本轮迁移到自有服务器。  
> **执行原则：** 每一项必须由实际代码、命令输出或 Preview 验收结果证明，不能只写“本地正常”。

**目标：** 开发同学交付一个不依赖个人电脑、不泄露密钥、可重复构建、可自动迁移数据库、可在 Preview 验收并可回滚的 UniSpeaking Web 生产候选版本。

**架构：** Web 页面部署到 Vercel；浏览器承担 UI、麦克风、WebRTC 和实时消息渲染；Supabase 承担 Postgres、Auth、Storage 和 Edge Functions；百炼等服务端密钥只由 Edge Function 或其他受控服务端代码访问。

**技术栈：** GitHub、Web 前端框架或静态 Web、Vercel、Supabase Postgres/Auth/Storage/Edge Functions、百炼 Realtime WebRTC。

## 全局约束

- GitHub `main` 是生产代码事实源，生产环境不接收只存在于开发电脑的代码或 SQL。
- Production、Preview/Staging、Development 必须使用可区分的配置。
- 浏览器不得包含百炼 API Key、Supabase Secret/Service Role、数据库密码或第三方管理凭据。
- 数据库结构、权限和 Storage policy 必须版本化，不能依赖生产控制台临时点选。
- Web/API 必须使用 HTTPS；正式 Web 地址统一按 `https://app.unispeaking.cn` 预留。
- 当前路演阶段优先使用 Vercel + 托管 Supabase，不要求同时迁移自有服务器。
- 不为了部署强行重写已经满足生产要求的代码，只改造不符合运行时、安全、迁移和运维要求的部分。

---

## 1. 我们的项目属于哪种类型

### 1.1 当前已经验证的生产基线

UniSpeaking 当前目标不是“传统前端 + 一台永久运行的后端服务器”，而是：

> **Vercel Web + 浏览器 Realtime/WebRTC + Supabase Serverless/BaaS 的混合架构。**

```text
用户浏览器
├── Vercel
│   └── Web 页面、JS/CSS、路由、静态资源
├── 浏览器运行时
│   ├── 麦克风权限与音轨
│   ├── RTCPeerConnection / DataChannel
│   ├── 字幕、消息和音频播放
│   └── 只持有可公开配置
└── Supabase
    ├── Edge Function：隐藏百炼密钥、创建会话、SDP 交换、限流
    ├── Postgres：用户、会话、最终消息和指标
    ├── Auth：登录与用户身份
    └── Storage：需要保存的文件资源
```

### 1.2 队友“本地完整版本”需要重新归类

队友版本可能包含完整 React/Vue/Next.js 前端和 Express/FastAPI/Python 后端。这不代表它已经适合上述生产架构。

| 本地能力 | 路演阶段目标位置 | 处理方式 |
|---|---|---|
| Web 页面和静态资源 | Vercel | 保留并完成 production build |
| 浏览器麦克风/WebRTC/UI | Vercel Web 的浏览器代码 | 保留，检查 HTTPS、权限和异常恢复 |
| 百炼 Key、SDP 交换、短请求网关 | Supabase Edge Function | 从本地后端迁移或对齐接口 |
| 用户、会话、学习记录 | Supabase Postgres | 改为 migration + 数据访问层 |
| 登录、找回密码、OAuth | Supabase Auth | 对齐正式域名和回调地址 |
| 上传图片、音频、报告 | Supabase Storage | 不写本地目录 |
| 内存 Session、内存限流 | Postgres/Redis/受控存储 | 必须迁出进程内存 |
| SQLite/JSON/Markdown 数据 | Supabase Postgres/Storage | 必须迁移 |
| 常驻 WebSocket 代理 | 不直接放入普通 Edge/Serverless | 优先浏览器 WebRTC；确需常驻则独立部署 |
| 长耗时 Worker、转码、报告 | 独立 Worker/队列/未来服务器 | 不放进同步 Edge 请求 |

### 1.3 判断结论

UniSpeaking 路演阶段属于“前端静态/框架部署 + 托管后端能力”的 Serverless/BaaS 项目。

- 队友版本已经采用 Supabase 数据库、Auth、Storage、Edge Function：主要做配置和生产安全检查。
- 队友版本仍依赖 Express/FastAPI 常驻进程、内存状态、本地文件或 SQLite：需要生产化改造。
- 后端必须永久连接、持续消费队列或代理长期 WebSocket：保留为独立常驻服务，但不属于本轮默认路演范围。

---

## 2. 第一阶段：完成架构盘点

负责人复制下面表格到 Pull Request 描述并填写。

| 检查项 | 团队版本实际情况 | 结论 |
|---|---|---|
| Web 技术栈与版本 | 由负责人填写 | Vercel 可直接构建 / 需要适配 |
| Web 根目录 | 由负责人填写 | 填入 Vercel Root Directory |
| 安装、测试、构建命令 | 由负责人填写 | 必须可重复 |
| 构建输出目录 | 由负责人填写 | 填入 Vercel Output Directory |
| 后端技术栈和启动方式 | 由负责人填写 | Function / 常驻服务 |
| 数据库类型 | 由负责人填写 | Supabase / 需要迁移 |
| 文件存储位置 | 由负责人填写 | Storage / 需要迁移 |
| Session/限流存储 | 由负责人填写 | 持久化 / 需要迁移 |
| Realtime 链路 | 由负责人填写 | 浏览器 WebRTC / 需要调整 |
| Auth 方案 | 由负责人填写 | Supabase Auth / 需要对齐 |
| 外部服务清单 | 由负责人填写 | Secret 与限额已识别 |
| 三类环境配置 | 由负责人填写 | 已隔离 / 需要拆分 |

### 2.1 全局搜索

在仓库根目录执行；没有 `rg` 时使用 IDE 全局搜索：

```bash
rg -n "localhost|127\.0\.0\.1|0\.0\.0\.0|http://|app\.listen|uvicorn|flask run"
rg -n "DASHSCOPE|BAILIAN|SERVICE_ROLE|SECRET_KEY|DATABASE_URL|password"
rg -n "writeFile|readFile|uploads/|sqlite|\.db|data\.json|new Map\(|setInterval"
rg -n "WebSocket|RTCPeerConnection|EventSource|worker|queue|cron"
```

每条结果标记为：

- `保留`：仅本地脚本、测试 fixture 或 README 示例。
- `环境变量化`：API URL、站点 URL、Origin、回调地址。
- `迁移`：本地数据库、文件、内存状态、服务端密钥。
- `架构例外`：必须常驻的服务，单独交给部署负责人。

### 2.2 直接阻断上线

出现任意一项，不进入 Vercel/Supabase 部署：

- [ ] 真实 Secret 已提交到 Git 历史。
- [ ] 只有开发启动命令，没有可验证的 production build。
- [ ] 前端直接调用百炼并携带真实 API Key。
- [ ] 业务数据保存在本地 JSON、SQLite、Markdown 或上传目录。
- [ ] Session、限流或任务状态只保存在进程内存。
- [ ] 数据库结构没有 migration。
- [ ] 浏览器可以使用 Service Role 或数据库管理密码。
- [ ] 后端必须永久运行，却仍计划作为普通 Function 部署。
- [ ] 登录和回调只支持 localhost。
- [ ] 没有 Preview/Staging 验收环境。

---

## 3. 第二阶段：补齐生产交付物

队友版本不要求与当前示例目录完全相同，但必须映射到以下职责：

```text
repository/
├── package.json                    # 安装、测试、构建命令
├── package-lock.json               # 或团队唯一锁文件
├── .gitignore                      # 忽略本地 Secret 和生成物
├── .env.example                    # 变量名、用途、公开性
├── README.md                       # 本地、测试、部署、回滚
├── vercel.json                     # 需要重写、响应头或 Function 配置时
├── src/                            # Web 源码
├── tests/                          # 单元、集成、部署契约测试
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
└── .github/workflows/              # 使用自定义 CI 时
```

### 3.1 构建入口

`package.json` 至少明确：

```json
{
  "scripts": {
    "dev": "团队实际开发命令",
    "test": "团队实际测试命令",
    "build": "团队实际生产构建命令"
  }
}
```

要求：

- [ ] Node/包管理器版本已固定。
- [ ] 锁文件与依赖清单同步。
- [ ] 生产依赖没有错误放入只在开发环境安装的分组。
- [ ] 安装、测试、构建不需要人工输入。
- [ ] 静态项目明确输出目录；常驻服务才需要独立 `start`。

### 3.2 环境文件

`.gitignore` 至少覆盖：

```gitignore
.env.local
.env.*.local
.vercel/
node_modules/
dist/
coverage/
*.log
```

不要忽略 `.env.example`、migration 或平台配置。

`.env.example` 建议：

```dotenv
# Browser-visible
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
PUBLIC_SITE_URL=

# Server-only
DASHSCOPE_API_KEY=
BAILIAN_WORKSPACE_ID=
BAILIAN_MODEL=
SUPABASE_SECRET_KEY=
ALLOWED_WEB_ORIGINS=
```

变量前缀要适配实际框架，例如 `NEXT_PUBLIC_`、`VITE_`。任何进入浏览器 bundle 的变量都只能是公开配置。

### 3.3 README 生产章节

必须写清：

- Web Root Directory、Supabase Working Directory。
- 安装、测试、构建命令和输出目录。
- Development、Preview、Production 配置差异。
- migration 与 Edge Function 发布方式。
- Preview 验收步骤。
- 生产回滚方式。
- Secret 配置与轮换入口，不记录真实值。

---

## 4. 第三阶段：按代码区域处理

### 4.1 Web 构建和路由

必须验证：

```bash
npm ci
npm test
npm run build
```

按团队实际包管理器替换，但 README 和 CI 必须一致。

需要修改的典型位置：

- `package.json`：增加或修正 build/test。
- 框架配置：输出目录、Node 版本、路由策略。
- `vercel.json`：SPA rewrite、安全响应头、必要 Function 配置。
- 静态资源：消除开发电脑绝对路径。
- import：保证 Linux 大小写敏感环境可用。

如果全新环境已经能重复生成 production build，不需要为了 Vercel 重写 UI。

### 4.2 API 地址与运行时配置

不能保留：

```ts
const API_URL = "http://localhost:8000";
```

应由配置提供：

```ts
const API_URL = getRequiredPublicConfig("PUBLIC_API_URL");
```

要求：

- [ ] Development 指向本地/开发服务。
- [ ] Preview 指向 Preview/Staging 服务。
- [ ] Production 指向正式 Supabase/API。
- [ ] 缺少必填配置时明确报错，不静默回落到 localhost。
- [ ] URL 拼接、超时和错误码统一。

### 4.3 本地后端入口

若存在 `app.listen(...)`、`uvicorn`、`flask run`，逐个接口分类：

| 接口特点 | 目标处理 |
|---|---|
| 隐藏密钥、短时百炼调用、SDP 交换 | Supabase Edge Function |
| 简单鉴权、短 CRUD、Webhook | Edge Function 或合适的 Vercel Function |
| 适合 RLS 的数据库 CRUD | Supabase Client + RLS，或 Edge Function |
| 永久 WebSocket/长期连接 | 独立常驻服务 |
| 转码、长报告、队列消费 | 异步 Worker/队列/未来服务器 |

迁移到 Function 后必须：

- 不依赖固定端口或同一进程。
- 不用全局变量保存用户状态。
- 第三方请求有超时。
- 写操作有幂等键或唯一约束。
- 对外返回稳定错误码，不返回内部堆栈或完整供应商响应。

### 4.4 Session、限流和任务状态

以下写法不能作为生产状态：

```ts
const sessions = new Map();
const rateLimits = {};
```

应改为 Supabase Postgres、Redis 或受控队列。浏览器 `localStorage` 只适合非敏感 UI 偏好或可丢失状态，不能是正式学习记录的唯一来源。

### 4.5 文件、SQLite 和本地目录

搜索：

```text
uploads/
data.json
*.db
*.sqlite
fs.writeFile
open(..., "w")
```

处理规则：

- 业务数据写 Postgres。
- 用户文件写 Supabase Storage。
- 临时文件必须可重建。
- 原始语音没有明确产品需求时默认不保存。
- 最终字幕、指标和报告采用明确数据模型。

### 4.6 Realtime 语音链路

路演目标：

```text
Browser microphone
  → Browser RTCPeerConnection
  → Edge Function 保护密钥并交换 SDP
  → 百炼 Realtime
  → Browser audio/transcript
```

检查：

- [ ] 浏览器没有百炼 Key。
- [ ] 麦克风只在 HTTPS 或 localhost 下申请。
- [ ] SDP/会话初始化由服务端接口处理。
- [ ] 第三方调用有连接超时。
- [ ] 音轨、PeerConnection、DataChannel 在结束时释放。
- [ ] 权限拒绝、重复点击、网络切换有明确状态。
- [ ] 实时音频不长期代理到普通 Serverless Function。
- [ ] 最终消息有去重键，重试不会重复写入。

若队友版本使用本地 Python WebSocket 代理全部实时音频，应迁移为浏览器 WebRTC，或明确为独立常驻服务；不能直接作为 Vercel 静态站点部署。

### 4.7 数据库 migration、GRANT 和 RLS

禁止只在 README 中写“请到 Dashboard 手工建表”。

Migration 必须覆盖：

- 表、外键、唯一约束、CHECK、索引。
- `GRANT`/`REVOKE`。
- `ENABLE ROW LEVEL SECURITY` 和 policies。
- 数据库函数及 EXECUTE 权限。
- Storage bucket/policy。
- 必要且不含真实用户数据的 seed。

Supabase 当前将对象级 grant 与行级 RLS 作为两层权限。新表可能不会自动暴露给 Data API；出现 42501 时应检查授权，不要关闭 RLS 或给所有角色全部权限。

验收：

- [ ] 从空的本地/Preview Supabase 可以只靠 migration 建立结构。
- [ ] 用户 A 无法读取或修改用户 B 数据。
- [ ] anon 无法访问仅服务端表。
- [ ] Service Role 只存在于服务端。
- [ ] Security/Performance Advisor 没有未解释的高风险项。

### 4.8 Auth、CORS、Origin 和 Cookie

正式地址预留为 `https://app.unispeaking.cn`。开发同学必须交付：

- Supabase Auth Site URL。
- Redirect URLs。
- OAuth 回调地址。
- Edge Function `ALLOWED_WEB_ORIGINS`。
- Web `PUBLIC_SITE_URL`。
- Cookie `Secure`、`SameSite`、Domain。
- CSP `connect-src`、`media-src`。

要求：

- 精确允许 Production 域名。
- Preview 只允许受控 Preview 规则。
- localhost 仅用于 Development。
- 敏感接口不使用无限制的 CORS。
- 不把关闭 JWT 校验当作解决 401 的默认办法；自定义鉴权必须说明 API key/JWT、Origin、限流和权限设计。

### 4.9 Secret 和依赖

检查当前文件和历史：

```bash
git grep -n -E "sk-|service_role|DASHSCOPE_API_KEY=.+|SUPABASE_SECRET.+=" || true
git log -p --all -- .env .env.local '.env.*' | less
```

真实 Key 曾进入 Git 时：

1. 先轮换或撤销。
2. 再清理 Git 历史。
3. 更新平台 Secrets。
4. 重新部署。

依赖要求：

- [ ] 锁文件已提交。
- [ ] 高危依赖有处理结论。
- [ ] 升级 `@supabase/supabase-js` 时检查 TypeScript 版本；2026-07 官方已预告将要求 TypeScript 5.0。
- [ ] CI 不无版本约束地安装最新 CLI。

### 4.10 健康检查、错误和日志

至少提供 `GET /health`。健康结果可说明配置状态，但不能返回 Secret 或内部完整错误。

日志至少包含：

```text
request_id
route
status_code
duration_ms
session_id（如适用）
user_id（脱敏或内部 ID）
error_code
deployment_commit
```

禁止记录 API Key、Authorization、完整 Cookie/JWT、密码以及不必要的原始音频和敏感对话全文。

---

## 5. 第四阶段：全新环境生产演练

### 5.1 Clean clone

```bash
git clone <repository-url> unispeaking-release-check
cd unispeaking-release-check
git checkout <candidate-commit-sha>
npm ci
npm test
npm run build
```

通过条件：

- [ ] 不读取仓库外文件。
- [ ] 不需要某位开发者电脑中的配置。
- [ ] 没有交互式选择。
- [ ] 测试和构建退出码为 0。
- [ ] 产物可以用 production preview 运行。

### 5.2 Preview 配置

准备独立的：

- Preview Supabase URL/Publishable Key。
- Preview Edge Function Secrets。
- Preview Site URL、Origin、Redirect URL。
- 测试百炼账号或受控配额。

不要让所有 PR 默认拥有生产 Service Role 或生产数据库密码。

### 5.3 空数据库恢复

```bash
npx supabase --version
npx supabase start
npx supabase db reset
```

具体命令以项目锁定的 Supabase CLI `--help` 为准。

通过条件：

- [ ] 空环境可以完整恢复 schema。
- [ ] migration 不依赖人工提前建表。
- [ ] Edge Function 可在本地/Preview 启动。
- [ ] grant、RLS、Storage policy 符合预期。

---

## 6. 第五阶段：PR 与 Preview 验收

### 6.1 生产候选 PR

PR 必须包含：

- 架构盘点表。
- clean clone 验证结果。
- production build 结果。
- migration 和环境变量名称清单。
- API/路由清单。
- 已知限制和回滚方式。

PR 描述和截图不得包含 Secret 值。

### 6.2 Preview 门禁

- [ ] Vercel Preview 构建成功。
- [ ] Supabase migration/function check 成功。
- [ ] Preview 页面正常加载，深层路由刷新不 404。
- [ ] 浏览器控制台无未解释错误。
- [ ] 请求指向预期环境。
- [ ] Preview Origin 已被 Function 允许。
- [ ] Preview 没有生产管理 Secret。

### 6.3 产品 E2E

至少验证：

1. 首页和主要模块。
2. 登录、退出、刷新和会话恢复。
3. 麦克风首次授权与拒绝后恢复。
4. 创建 Realtime 会话和 SDP 交换。
5. 用户语音转写。
6. AI 文本和音频返回。
7. 静音、文字消息、结束会话。
8. 资源释放与最终消息/指标保存。
9. 用户 A 不能读取用户 B 数据。
10. 限流、超时、供应商异常提示。
11. 公司网络、手机热点和目标浏览器。

---

## 7. 开发团队最终交付包

### 7.1 代码和构建

- [ ] GitHub 仓库、候选分支和 commit SHA。
- [ ] Production branch。
- [ ] Web Root Directory、Supabase Working Directory。
- [ ] 安装、测试、构建命令和输出目录。
- [ ] Node、包管理器、CLI 版本。

### 7.2 环境变量登记表

| 变量名 | 使用端 | 环境 | Secret | 配置平台 | 负责人 |
|---|---|---|---|---|---|
| `PUBLIC_SUPABASE_URL` | Browser | Dev/Preview/Prod | 否 | Vercel | 团队填写 |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Dev/Preview/Prod | 否 | Vercel | 团队填写 |
| `PUBLIC_SITE_URL` | Browser/Server | Preview/Prod | 否 | Vercel | 团队填写 |
| `DASHSCOPE_API_KEY` | Edge Function | Preview/Prod | 是 | Supabase Secrets | 团队填写 |
| `BAILIAN_WORKSPACE_ID` | Edge Function | Preview/Prod | 是 | Supabase Secrets | 团队填写 |
| `BAILIAN_MODEL` | Edge Function | Preview/Prod | 按团队规则 | Supabase | 团队填写 |
| `ALLOWED_WEB_ORIGINS` | Edge Function | Dev/Preview/Prod | 否 | Supabase | 团队填写 |

变量名以实际框架为准，重点是公开性、环境范围、配置位置和负责人。

### 7.3 数据库、接口和运维

- [ ] migration 文件清单和执行顺序。
- [ ] Edge Function、API 路径、鉴权、错误码清单。
- [ ] RLS/授权模型和 Storage policy。
- [ ] Auth Site URL/Redirect/OAuth 清单。
- [ ] 健康检查和 Vercel/Supabase 日志入口。
- [ ] 第三方用量、告警和 Secret 轮换负责人。
- [ ] 上一稳定 Vercel Deployment/commit 和回滚步骤。
- [ ] 数据库采用回滚 migration 还是向前修复的说明。

---

## 8. 上线阻断清单

以下任何一项未解决都不能正式发布：

- [ ] production build 失败或只验证 dev server。
- [ ] GitHub 缺少锁文件、migration 或必要源码。
- [ ] 代码或 Git 历史存在有效 Secret。
- [ ] 浏览器能读取 Service Role、数据库密码或百炼 Key。
- [ ] API、CORS、Auth 回调仍只支持 localhost。
- [ ] 本地文件、SQLite、内存是正式数据唯一来源。
- [ ] migration 无法从空环境建立 schema。
- [ ] 暴露表没有经过 grant + RLS 审核。
- [ ] Function 依赖永久进程或本地持久化磁盘。
- [ ] 没有 Preview E2E、健康检查、日志或回滚目标。
- [ ] 正式域名变化未同步 Origin、Auth、OAuth、CSP。

---

## 9. 哪些情况不需要改代码

同时满足以下条件时，不需要为了部署重复重构：

- 全新 clone 后安装、测试、production build 通过。
- Web 没有硬编码本地 API 和开发路径。
- 浏览器只持有公开配置。
- Secret 只在服务端。
- 接口是无状态短请求。
- 没有本地文件、SQLite、内存 Session 依赖。
- schema、grant、RLS、Storage policy 已 migration 化。
- Auth、Origin、Redirect、CSP 支持 Preview 和正式域名。
- Preview E2E、权限和异常测试通过。
- 有健康检查、日志和回滚说明。

此时开发同学主要交付配置清单和验证证据；部署负责人完成平台连接、Secrets、域名和 Production 发布。

---

## 10. 开发负责人签字模板

```text
候选仓库：
候选分支：
候选 commit SHA：
Web Root Directory：
Supabase Working Directory：
安装命令：
测试命令：
构建命令：
构建输出目录：
Preview URL：
健康检查 URL：
Migration 检查结果：
RLS/权限检查结果：
Realtime E2E 结果：
已知限制：
回滚目标 commit/deployment：
开发负责人：
部署负责人：
验收日期：
```

只有信息完整且第 8 节没有未解决项，才能合并生产分支并正式部署。

---

## 11. 官方参考

- [Vercel GitHub 自动部署](https://vercel.com/docs/git/vercel-for-github)
- [Vercel Deployments](https://vercel.com/docs/deployments)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase GitHub Integration](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase API Security、GRANT 与 RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Edge Function Deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Changelog](https://supabase.com/changelog)

---

## 12. 完成判定

开发团队的部署前置准备只有在以下条件同时成立时完成：

- 已明确每项能力运行在 Vercel、浏览器、Supabase 或独立服务中的哪一处。
- 不适合 Serverless 的本地后端部分已迁移或排除在路演范围外。
- 全新 clone 的安装、测试、production build 可重复通过。
- 环境变量、公开配置和 Secret 分层完成。
- 本地数据、文件和内存状态依赖已消除。
- 数据库、grant、RLS、Storage policy 可由 migration 恢复。
- Preview 完成登录、Realtime、权限、异常和跨网络 E2E。
- PR 包含候选 SHA、构建证据、配置/migration 清单和回滚方式。
- 部署负责人不需要再猜测代码入口、环境变量或平台职责。

