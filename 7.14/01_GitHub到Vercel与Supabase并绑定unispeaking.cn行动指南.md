# GitHub → Vercel/Supabase → unispeaking.cn 上线行动指南

> **执行者说明：** 本文是一份逐项执行计划。每完成一步就勾选对应复选框；任何验证失败都应停止进入下一阶段，修复后重新验证。

**目标：** 将 GitHub 中的 UniSpeaking 完整 Web 项目连接到现有 Vercel 和 Supabase 生产项目，并将正式产品地址切换为 `https://app.unispeaking.cn`。

**架构：** GitHub `main` 是唯一生产代码源；Vercel 根据 Git 分支自动生成 Preview/Production；Supabase GitHub Integration 根据同一仓库中的 `supabase/` 自动验证和发布 migration/Edge Functions；阿里云 DNS 只负责把自有域名指向 Vercel。

**技术栈：** GitHub、Vercel、Supabase Postgres/Auth/Edge Functions、阿里云云解析 DNS、百炼 Realtime WebRTC。

## 全局约束

- 当前正式 Vercel 项目继续使用 `unispeaking-web`，不要重复创建同名生产项目。
- 当前 Supabase 项目继续使用 `ropgifqbblzktgxllupi`，不要把 Production Secrets 复制到 GitHub。
- GitHub `main` 是生产分支；功能开发必须通过分支和 Pull Request。
- 百炼 API Key、Supabase Secret Key、数据库密码不能进入浏览器、Git、Markdown 或 GitHub 普通变量。
- `app.unispeaking.cn` 是长期产品入口；`unispeaking.cn`、`www.unispeaking.cn` 跳转到它。
- `api.unispeaking.cn` 暂不配置，保留给未来自有服务器 API。
- 不修改阿里云 Nameserver；继续使用当前 `dns31.hichina.com`、`dns32.hichina.com`，只添加 Vercel 要求的 DNS 记录。
- Vercel 页面显示的 A/CNAME/TXT 值是唯一事实源，不照抄文档或他人项目示例值。

---

## 0. 当前已知信息和最终结果

### 0.1 当前信息

| 项目 | 当前值 |
|---|---|
| GitHub 仓库 | `suerzzh/unispeaking` |
| GitHub 默认分支 | `main` |
| 当前本地功能分支 | `codex/ui-demo-vercel-supabase` |
| 当前 Web 目录 | `/UniSpeaking_Complete_UI` |
| Vercel 项目 | `unispeaking-web` |
| 旧生产地址 | `https://unispeaking-web.vercel.app` |
| Supabase Project Ref | `ropgifqbblzktgxllupi` |
| Edge Function | `realtime-gateway` |
| 新购域名 | `unispeaking.cn` |
| DNS 服务商 | 阿里云云解析 DNS |

GitHub 仓库当前是私有或未向未认证 API 开放，因此部署前必须在 GitHub 网页人工确认完整文件已经进入 `main`。

### 0.2 完成后的域名结构

| 域名 | 当前路演阶段 | 后期自有服务器阶段 |
|---|---|---|
| `app.unispeaking.cn` | Vercel UniSpeaking Web 主域名 | 改为自有服务器 Web |
| `unispeaking.cn` | Vercel 重定向到 `app` | 可继续做品牌入口/重定向 |
| `www.unispeaking.cn` | Vercel 重定向到 `app` | 可继续做品牌入口/重定向 |
| `api.unispeaking.cn` | 暂不解析 | 自有服务器 API |
| `unispeaking-web.vercel.app` | 保留，可直接回退 | 保留一段时间作为灾备入口 |

---

## 1. 前置条件检查

### 1.1 账号权限

- [ ] 能登录 GitHub，并对 `suerzzh/qiniuyun-dayial-work` 拥有 Admin/Owner 权限。
- [ ] 能进入 Vercel Team，并管理 `unispeaking-web` 项目。
- [ ] 能进入 Supabase 项目 `ropgifqbblzktgxllupi` 的 Project Settings 和 Integrations。
- [ ] 能进入阿里云 `unispeaking.cn` 的云解析 DNS 页面。
- [ ] 阿里云域名实名认证状态为“已完成/审核通过”。
- [ ] GitHub、Vercel、Supabase 和阿里云管理员账号均开启 MFA。

### 1.2 本地工具

在项目根目录执行：

```bash
git --version
node --version
npm --version
npx supabase --version
npx vercel --version
```

- [ ] Git 可用。
- [ ] Node/npm 版本满足项目 `package.json`/README 要求。
- [ ] Supabase CLI 能输出版本。
- [ ] Vercel CLI 能输出版本。

如果 CLI 尚未加入项目：

```bash
npm install --save-dev supabase vercel
```

提交更新后的 `package.json` 和 lockfile，不使用团队成员各自不同的全局 CLI 版本。

---

## 2. 确认 GitHub `main` 包含完整部署源

### 2.1 在 GitHub 网页检查文件

打开：

```text
https://github.com/suerzzh/unispeaking
```

切换到 `main`，确认至少存在：

```text
/UniSpeaking_Complete_UI/
├── package.json
├── package-lock.json 或其他唯一 lockfile
├── index.html 或框架入口
├── src/
├── vercel.json
├── .env.example
├── supabase/
│   ├── config.toml
│   ├── migrations/202607140001_realtime_web.sql
│   └── functions/realtime-gateway/index.ts
└── tests/
```

- [ ] `main` 中有 Web 源码。
- [ ] `main` 中有 `supabase/config.toml`。
- [ ] `main` 中有全部 migration。
- [ ] `main` 中有 Edge Function 源码。
- [ ] `main` 中有唯一 lockfile。
- [ ] `main` 中没有 `.env`、`.env.local`、真实 Key 或数据库密码。

如果队友已经把完整项目整理成一个独立 GitHub 仓库，并且 `package.json` 与 `supabase/` 都在仓库根目录，则后文 Vercel Root Directory 和 Supabase Working Directory 都改填 `.`；除此之外步骤不变。

### 2.2 本地检查和测试

先保护未提交工作，不要在脏工作区直接切换分支。确认 `git status --short` 为空后执行：

```bash
git switch main
git pull --ff-only origin main
cd 7.14/UniSpeaking_Complete_UI
npm ci
npm test
```

如果完整迁移项目已经增加脚本，继续执行：

```bash
npm run lint
npm run typecheck
npm run build
```

预期：全部命令退出码为 0。

检查敏感信息：

```bash
git grep -nE 'sk-[A-Za-z0-9]|sb_secret_|service_role|DASHSCOPE_API_KEY=.+' -- . ':!*.example' ':!*.md'
```

预期：没有输出。若输出真实凭据，立即撤销并轮换，再从 Git 历史清理；不能只删除当前文件。

### 2.3 建立 GitHub 生产保护

路径：

```text
GitHub Repository → Settings → Branches / Rules → New ruleset
```

对 `main` 设置：

- [ ] Require a pull request before merging。
- [ ] Require approvals，至少 1 人。
- [ ] Require status checks to pass。
- [ ] Require branches to be up to date before merging。
- [ ] Block force pushes。
- [ ] Block deletions。
- [ ] 团队日常开发禁止直接 push `main`。

Vercel/Supabase 接入完成后，再回来把它们的 Preview checks 加入 required checks。

---

## 3. 把现有 Supabase 项目连接到 GitHub

### 3.1 先校准 migration 历史

进入包含 `supabase/` 的项目目录：

```bash
cd 7.14/UniSpeaking_Complete_UI
npx supabase --help
npx supabase login
npx supabase link --project-ref ropgifqbblzktgxllupi
npx supabase migration list
```

- [ ] 本地 migration `202607140001_realtime_web.sql` 存在。
- [ ] 远端 migration history 与本地一致。
- [ ] 不存在远端有 schema、Git 没 migration 的情况。

如果不一致，停止自动生产部署。先用 `npx supabase db pull` 或在明确实际 schema 后使用 `migration repair` 修复历史。`migration repair` 只改变记录，不会执行/回滚 SQL，必须由了解生产数据库的人操作。

### 3.2 检查 `config.toml`

当前应包含：

```toml
project_id = "ropgifqbblzktgxllupi"

[functions.realtime-gateway]
verify_jwt = false
```

当前公开路演函数在代码内校验 Publishable Key、Origin、限流和会话有效期，因此保留此配置。未来加入正式登录后，私有接口必须验证用户 JWT 和资源所有权，不能把 `verify_jwt = false` 当作通用模板。

### 3.3 在 Supabase Dashboard 授权 GitHub

路径：

```text
Supabase Dashboard
→ Project ropgifqbblzktgxllupi
→ Project Settings
→ Integrations
→ GitHub Integration
→ Authorize GitHub
```

依次操作：

1. 点击 `Authorize GitHub`。
2. 在 GitHub 选择账号/组织。
3. 只授权包含 UniSpeaking 的仓库。
4. 回到 Supabase，选择 `suerzzh/qiniuyun-dayial-work`。
5. `Production branch` 选择 `main`。
6. `Working directory` 填：

```text
7.14/UniSpeaking_Complete_UI
```

这里填写的是“包含 `supabase/` 的父目录”，不是 `supabase` 目录本身。

7. 先开启 Preview/检查能力。
8. 若套餐支持且需要隔离 Preview 数据，开启 `Automatic branching`。
9. 暂时不要急着开启 `Deploy to production`，先完成一次 PR 验证。
10. 点击 `Enable integration`。

### 3.4 创建一次 Supabase Preview 验证

从 `main` 创建测试分支：

```bash
git switch -c chore/verify-cloud-deployment
git commit --allow-empty -m "chore: verify cloud deployment checks"
git push -u origin chore/verify-cloud-deployment
```

创建 PR，但不合并。

在 PR 中检查：

- [ ] 出现 Supabase Preview/check。
- [ ] migration 验证成功。
- [ ] `realtime-gateway` 函数构建/部署检查成功。
- [ ] 无 config.toml 错误。
- [ ] Preview Branch 不包含生产用户数据。

注意：Supabase Preview Branch Secrets 不会自动继承 Production。需要真实 AI Preview 时，为 Preview 单独设置测试 Key；不要复制高权限生产 Secret。

### 3.5 开启生产自动部署

Preview check 成功后回到：

```text
Supabase → Project Settings → Integrations → GitHub
```

- [ ] 开启 `Deploy to production`。
- [ ] 确认 Production branch 是 `main`。
- [ ] 确认 Working directory 不变。

开启后，`main` 变化会自动：

- 应用新的 migration。
- 部署 `config.toml` 声明的 Edge Functions。
- 部署 `config.toml` 声明的 Storage buckets。

Auth、API 配置和 seed 默认不会自动部署，仍需明确管理。

### 3.6 把 Supabase check 加到 GitHub 门禁

回到 GitHub `main` ruleset：

- [ ] 在 required status checks 中选择 `Supabase Preview` 或界面显示的实际 Supabase check 名称。
- [ ] 保存 ruleset。
- [ ] 确认失败的 Supabase check 会阻止合并。

---

## 4. 把现有 Vercel 项目连接到 GitHub

### 4.1 不创建重复项目

进入：

```text
Vercel Dashboard → Project unispeaking-web → Settings → Git
```

操作：

1. 点击 `Connect Git Repository`。
2. 选择 GitHub。
3. 选择 `suerzzh/qiniuyun-dayial-work`。
4. 若看不到私有仓库，在 GitHub App 设置中给 Vercel 授权该仓库。
5. Production Branch 设为 `main`。
6. 保存。

### 4.2 设置 Root Directory

路径：

```text
Vercel Project → Settings → Build and Deployment → Root Directory
```

当前仓库填写：

```text
7.14/UniSpeaking_Complete_UI
```

如果未来使用独立仓库且项目文件在仓库根目录，改成 `.`。

### 4.3 设置框架和构建命令

先查看 GitHub 中该目录的 `package.json`。

| 实际项目 | Framework Preset | Install | Build | Output |
|---|---|---|---|---|
| 当前原生 HTML/ES Modules | Other | 默认或 `npm install` | 留空 | `.` |
| Vite React | Vite | `npm ci` | `npm run build` | `dist` |
| Next.js | Next.js | `npm ci` | `npm run build` | 自动 |

不要同时填写不属于当前框架的 Output Directory。

### 4.4 配置 Vercel 环境变量

路径：

```text
Vercel Project → Settings → Environment Variables
```

完整迁移项目常用变量：

| Name | Production | Preview | 是否可公开 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` 或 `VITE_SUPABASE_URL` | 正式 Supabase URL | Preview/测试项目 URL | 是 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 或 `VITE_SUPABASE_PUBLISHABLE_KEY` | 正式 Publishable Key | Preview/测试 Key | 是 |
| `NEXT_PUBLIC_SITE_URL` 或 `VITE_SITE_URL` | `https://app.unispeaking.cn` | Preview URL/动态值 | 是 |

百炼 Key 不放 Vercel Web 项目。它已经安全存放在 Supabase Edge Function Secrets。

当前静态 UI 使用 `src/runtime-config.mjs` 保存 Supabase URL/Publishable Key；二者是公开配置。若完整迁移项目已改用 Next.js/Vite，删除重复硬编码，统一从环境变量读取。

### 4.5 创建 Vercel Preview

向刚才的测试分支再 push 一个空提交：

```bash
git commit --allow-empty -m "chore: trigger vercel preview"
git push
```

在 PR 中检查：

- [ ] 出现 Vercel Preview URL。
- [ ] Deployment 状态为 Ready。
- [ ] 首页和全部核心路由可以打开。
- [ ] 浏览器控制台无错误。
- [ ] Preview 使用正确的 Preview 环境变量。
- [ ] 麦克风权限、会话创建、字幕和 AI 音频正常。

### 4.6 把 Vercel check 加到 GitHub 门禁

回到 GitHub `main` ruleset：

- [ ] 添加 Vercel deployment/check 为 required status check。
- [ ] 保存。
- [ ] 确认 Preview 构建失败会阻止合并。

### 4.7 合并测试 PR

只有 Supabase 与 Vercel checks 都成功时：

1. 合并 PR 到 `main`。
2. 在 Vercel 查看新 Production deployment。
3. 确认状态为 Ready。
4. 打开旧生产地址完成一次冒烟测试：

```text
https://unispeaking-web.vercel.app
```

至此 GitHub 自动部署链路建立完成，再开始改域名。

---

## 5. 在 Vercel 添加自有域名

### 5.1 先添加产品主域名

路径：

```text
Vercel → unispeaking-web → Settings → Domains → Add Domain
```

输入：

```text
app.unispeaking.cn
```

Vercel 会显示该项目专属的 CNAME 目标。保持页面打开，复制准确值。

### 5.2 在阿里云添加 `app` CNAME

路径：

```text
阿里云控制台
→ 云解析 DNS
→ 权威域名解析
→ unispeaking.cn
→ 解析设置
→ 添加记录
```

填写：

| 字段 | 填写内容 |
|---|---|
| 记录类型 | `CNAME` |
| 主机记录 | `app` |
| 解析请求来源 | `默认` |
| 记录值 | Vercel Domains 页面为 `app.unispeaking.cn` 显示的完整 CNAME |
| TTL | `600` 秒或控制台允许的最小普通值 |
| 状态 | 启用 |

注意：主机记录只填 `app`，不要填 `app.unispeaking.cn`；记录值末尾有无点号按 Vercel/阿里云页面接受格式填写。

### 5.3 添加根域名

回到 Vercel Domains，添加：

```text
unispeaking.cn
```

Vercel 会显示 A 记录要求。

在阿里云添加：

| 字段 | 填写内容 |
|---|---|
| 记录类型 | `A` |
| 主机记录 | `@` |
| 解析请求来源 | `默认` |
| 记录值 | Vercel 当前页面显示的 IP 地址 |
| TTL | `600` 秒或控制台允许的最小普通值 |
| 状态 | 启用 |

不要把本文中的任何示例 IP 当作记录值；只复制当前 Vercel 页面值。

### 5.4 添加 `www`

在 Vercel Domains 添加：

```text
www.unispeaking.cn
```

在阿里云添加：

| 字段 | 填写内容 |
|---|---|
| 记录类型 | `CNAME` |
| 主机记录 | `www` |
| 解析请求来源 | `默认` |
| 记录值 | Vercel 为 `www.unispeaking.cn` 显示的 CNAME |
| TTL | `600` 秒或控制台允许的最小普通值 |
| 状态 | 启用 |

### 5.5 等待 Vercel 验证和签发 HTTPS

回到 Vercel Domains：

- [ ] `app.unispeaking.cn` 显示 Valid/Ready。
- [ ] `unispeaking.cn` 显示 Valid/Ready。
- [ ] `www.unispeaking.cn` 显示 Valid/Ready。
- [ ] 三个域名 HTTPS 证书正常。

不要额外购买或手工上传证书；Vercel 会在 DNS 验证后自动管理 HTTPS。

### 5.6 配置明确重定向

在 Vercel Domains：

1. `app.unispeaking.cn` 保持连接 Production，作为应用主域。
2. 点击 `unispeaking.cn` 右侧 `Edit`。
3. `Redirect to` 选择 `app.unispeaking.cn`，使用永久重定向。
4. 点击 `www.unispeaking.cn` 右侧 `Edit`。
5. `Redirect to` 选择 `app.unispeaking.cn`，使用永久重定向。

- [ ] `https://unispeaking.cn` 最终跳转到 `https://app.unispeaking.cn`。
- [ ] `https://www.unispeaking.cn` 最终跳转到 `https://app.unispeaking.cn`。
- [ ] `https://app.unispeaking.cn` 不再跳转到其他域名。

---

## 6. 域名切换后的联动配置

### 6.1 Supabase Edge Function Origin

路径：

```text
Supabase → Edge Functions → Secrets
```

替换或新增：

```text
Name: ALLOWED_WEB_ORIGINS
Value: https://app.unispeaking.cn,https://unispeaking.cn,https://www.unispeaking.cn,http://localhost:8080,http://127.0.0.1:8080
```

如果完整迁移项目本地端口改成 3000/5173，把实际端口也加入，不保留无用端口。

不要发送新 Key 到聊天中。Secret 保存后调用健康接口和真实会话验证。

### 6.2 Supabase Auth URL

如果项目已使用 Supabase Auth，打开：

```text
Supabase → Authentication → URL Configuration
```

设置：

```text
Site URL:
https://app.unispeaking.cn
```

Redirect URLs 至少加入：

```text
https://app.unispeaking.cn/**
http://localhost:8080/**
```

如果实际本地端口为 3000/5173，使用实际端口。Vercel Preview 需要登录时，再加入受控 Team Preview 模式；不要使用允许任意互联网域名的宽泛通配符。

### 6.3 OAuth 平台

如果使用 Google/GitHub/Apple 登录：

- [ ] Supabase Provider 中仍使用正确 Client ID/Secret。
- [ ] OAuth 平台允许的 Web Origin 加入 `https://app.unispeaking.cn`。
- [ ] OAuth 回调保留 Supabase 回调：`https://ropgifqbblzktgxllupi.supabase.co/auth/v1/callback`。
- [ ] 如果未来给 Supabase API 绑定自定义域名，再额外增加新的 Supabase 回调，切换期间不要先删除旧回调。

### 6.4 Vercel Site URL

在 Vercel Production 环境变量设置：

```text
NEXT_PUBLIC_SITE_URL=https://app.unispeaking.cn
```

或项目实际使用的 `VITE_SITE_URL`。

保存后必须重新部署 Production，旧 deployment 不会自动读取新环境变量。

### 6.5 CSP 与代码硬编码

检查仓库：

```bash
git grep -n 'unispeaking-web.vercel.app\|http://localhost\|127.0.0.1' -- 7.14/UniSpeaking_Complete_UI
```

逐项判断：

- 正式站点公开 URL 改为 `https://app.unispeaking.cn`。
- 本地开发地址保留在开发配置，不写死到生产逻辑。
- CSP `connect-src` 继续允许 Supabase 项目域名。
- CORS/Origin 只允许真实站点和开发地址。

完成代码调整后走 PR → Preview → checks → merge，不在生产控制台直接改源码。

---

## 7. 完整验证

### 7.1 DNS 验证

```bash
dig +short CNAME app.unispeaking.cn
dig +short A unispeaking.cn
dig +short CNAME www.unispeaking.cn
```

预期：

- `app` 返回 Vercel 页面给出的 CNAME 链路。
- 根域返回 Vercel 页面要求的 A 记录。
- `www` 返回 Vercel页面给出的 CNAME 链路。

### 7.2 HTTPS 与重定向

```bash
curl -I https://app.unispeaking.cn
curl -I https://unispeaking.cn
curl -I https://www.unispeaking.cn
```

预期：

- `app` 返回 200/正常页面响应。
- 根域和 `www` 返回到 `app` 的 301/308 重定向。
- 没有证书错误或重定向循环。

证书检查：

```bash
openssl s_client -connect app.unispeaking.cn:443 -servername app.unispeaking.cn </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

### 7.3 产品验收

- [ ] 首页和核心路由正常。
- [ ] 浏览器 Console 无未处理错误。
- [ ] 麦克风授权弹窗正常。
- [ ] AI 主动开场。
- [ ] 用户语音转写显示。
- [ ] AI 文本和音频正常。
- [ ] 静音、文字消息、结束会话正常。
- [ ] 刷新后麦克风轨道关闭。
- [ ] Supabase 健康接口 `model_configured` 为 true。
- [ ] Edge Function 日志无持续 401/403/429/5xx。
- [ ] `unispeaking-web.vercel.app` 仍可访问，作为备用入口。

### 7.4 路演网络验收

由于 Vercel/Supabase/百炼跨地域链路可能受现场网络影响：

- [ ] 在路演场地 Wi-Fi 实测一次完整对话。
- [ ] 使用手机热点实测一次完整对话。
- [ ] 准备 `app.unispeaking.cn` 和旧 `vercel.app` 两个书签。
- [ ] 准备无网络情况下的产品录屏。
- [ ] 路演前 2 小时不再合并非必要 PR。

---

## 8. 失败时如何回滚

### 8.1 代码/构建失败

在 Vercel Deployments 选择上一条成功部署并执行 Promote/Rollback。自定义域名会立即重新指向旧 deployment，不需要改 DNS。

CLI 备选：

```bash
npx vercel rollback
```

### 8.2 Supabase Function 失败

从 Git 找到上一条已验证 commit，恢复函数源码并重新部署：

```bash
npx supabase functions deploy realtime-gateway --project-ref ropgifqbblzktgxllupi
```

数据库不要通过删除表回滚；新增前向修复 migration。

### 8.3 新域名异常

新域名异常不影响旧地址：

```text
https://unispeaking-web.vercel.app
```

先使用旧地址完成路演，再检查 Vercel Domain 状态、阿里云记录、Origin、Auth Redirect 和证书。不要在临近路演时反复切换 Nameserver。

---

## 9. 接入完成后的日常发布流程

每次开发：

```text
1. 从 main 创建分支
2. 本地开发并运行测试
3. push 到 GitHub
4. 创建 PR
5. 检查 Vercel Preview
6. 检查 Supabase Preview/migration
7. 产品验收
8. 审核通过后合并 main
9. Vercel/Supabase 自动发布 Production
10. app.unispeaking.cn 冒烟测试
11. 观察日志与错误率
```

数据库变更必须先向后兼容；Edge Function 和 Web 使用同一 PR 时，在 PR 描述写明顺序：migration → function → web。

---

## 10. 路演前时间表

### 提前 48 小时

- [ ] GitHub、Vercel、Supabase 自动链路完成。
- [ ] 三个域名 DNS 和 HTTPS 全部 Ready。
- [ ] Auth/Origin/Site URL 已同步。
- [ ] 完成桌面和手机浏览器 E2E。

### 提前 24 小时

- [ ] 使用会场网络或相似网络测试。
- [ ] 检查百炼额度、Supabase/Vercel 配额。
- [ ] 检查域名续费和实名认证状态。
- [ ] 保存上一条稳定 deployment ID/commit SHA。

### 提前 2 小时

- [ ] 冻结非必要发布。
- [ ] 真实完成一轮对话。
- [ ] 打开 Vercel、Supabase 日志页面备用。
- [ ] 准备手机热点和录屏。

### 路演结束后

- [ ] 查看错误率、会话成功率和百炼用量。
- [ ] 记录现场问题，不直接在生产热改。
- [ ] 通过 PR 修复并重复 Preview 验收。

---

## 11. 官方资料

- [Vercel GitHub 集成](https://vercel.com/docs/git/vercel-for-github)
- [Vercel 添加自定义域名](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Vercel 域名部署与重定向](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting)
- [Vercel 环境变量](https://vercel.com/docs/environment-variables)
- [Supabase GitHub Integration](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Supabase Branch 配置](https://supabase.com/docs/guides/deployment/branching/configuration)
- [Supabase 数据库迁移](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Edge Function 部署](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [阿里云添加 DNS 解析记录](https://help.aliyun.com/zh/dns/add-a-dns-record)

---

## 12. 完成判定

只有同时满足以下条件才算完成：

- GitHub PR 同时有成功的 Vercel 和 Supabase checks。
- 合并 `main` 能自动更新两个生产平台。
- `https://app.unispeaking.cn` HTTPS 正常并完成真实语音 E2E。
- root 和 `www` 明确重定向到 `app`。
- 新域名已同步到 Origin、Auth、OAuth 和 Site URL。
- 旧 `vercel.app` 地址仍可用于紧急回退。
- GitHub、前端包和文档中不存在真实 Secret。
