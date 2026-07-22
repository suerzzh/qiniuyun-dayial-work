# UniSpeaking Web UI 与 Realtime Demo 链接及部署操作说明

> 日期：2026-07-14  
> 本轮范围：仅 Web 端，不包含 iOS、Android。  
> 生产站点：<https://unispeaking-web.vercel.app>

## 1. 本次完成结果

本次没有把旧 Demo 页面嵌入新 UI，而是把 Demo 中已经验证的 WebRTC 自由对话能力拆成独立模块，接到 `UniSpeaking_Complete_UI` 的自由对话界面中。

已完成：

- 补齐原 UI 缺失的四阶段训练页，使完整 UI 可以正常启动。
- 将麦克风、WebRTC、DataChannel、字幕事件、文字消息、静音和结束清理接入正式 UI。
- 将原 Python 内存后端改造为可部署的 Supabase Edge Function。
- 将会话、最终文字转写、学习等级和匿名指标迁移到 Supabase Postgres。
- 在 Vercel 发布 Web 生产站点。
- 完成本地测试、浏览器渲染、Vercel 构建和 Supabase 会话创建/关闭验证。

后续用户已在 Supabase 控制台写入百炼 Secret，并确认真实 SDP、语音输入、转写、AI 文本和音频链路完全可用。本文件第 5 节保留为后续换 Key、重建项目或迁移环境时的操作说明。

## 2. 最终架构

```text
Vercel Web UI
  ├─ 完整 UI、路由与交互状态
  ├─ 麦克风与 RTCPeerConnection
  ├─ DataChannel 实时事件与字幕
  └─ Supabase Publishable Key（公开配置）
                 │ HTTPS
                 ▼
Supabase Edge Function: realtime-gateway
  ├─ 校验公开 Key、Origin 与请求频率
  ├─ 创建/关闭短期会话
  ├─ 构建口语教练 session.update
  ├─ 使用服务端 Secret 代理 SDP
  └─ 保存最终文字与匿名指标
          │                    │
          ▼                    ▼
Supabase Postgres       百炼 Qwen Realtime WebRTC
```

音频通过浏览器与百炼的 WebRTC 链路传输，不写入 Supabase，也不经过 Vercel 文件存储。数据库只保存最终文字转写和必要的会话元数据。

## 3. Demo 是怎样接到 UI 的

### 3.1 来源与目标对应关系

| 原 Demo 能力 | 新 Web 项目位置 | 作用 |
|---|---|---|
| `webrtc_demo.html` 的 PeerConnection/DataChannel | `src/realtime/realtime-client.mjs` | 建立会话、添加音轨、交换 SDP、接收实时事件、清理资源 |
| Demo 的字幕事件映射 | `src/realtime/realtime-state.mjs` | 合并用户转写、AI 增量文字、最终文字与错误状态 |
| Demo 的 `/api/sessions`、`/api/realtime` | `supabase/functions/realtime-gateway/index.ts` | 创建会话、构造 Prompt、代理百炼 SDP |
| Demo 的内存 session 和 JSON 文件 | Supabase 五张表 | 改为无状态云函数可使用的持久化数据 |
| UI 的模拟麦克风按钮 | `src/app.mjs` | 首次点击启动真实会话，通话中点击切换静音 |
| UI 的静态对话内容 | `src/views/conversation.mjs` | 活跃会话改为渲染真实 Realtime 消息 |
| UI 缺失的训练视图 | `src/views/training.mjs` | 恢复“学、读、说、诊”四阶段页面 |

原目录 `7.14/UniSpeaking` 继续作为能力参考 Demo，没有覆盖其已有数据文件；正式 Web 应用位于 `7.14/UniSpeaking_Complete_UI`。

### 3.2 浏览器实际流程

1. 用户点击自由对话页的麦克风按钮。
2. UI 调用 Edge Function `POST /session` 创建短期会话并取得 `session_config`。
3. 浏览器申请麦克风权限并创建 `RTCPeerConnection`。
4. 浏览器生成 Offer SDP，通过 `POST /sdp` 发给 Edge Function。
5. Edge Function 使用服务器端百炼密钥将 SDP 发给百炼，返回 Answer SDP。
6. DataChannel 收到 `session.created` 后发送 `session.update`。
7. 收到 `session.updated` 后请求 AI 主动开场。
8. 用户转写事件和 AI transcript 事件进入 `realtime-state.mjs`，实时显示在现有 UI 中。
9. 最终文字事件异步写入 Supabase；原始音频不保存。
10. 用户点击结束后，停止媒体轨道、关闭 DataChannel/PeerConnection，并调用 `DELETE /session`。

文字输入复用同一 DataChannel，发送 `conversation.item.create` 后请求 `response.create`，因此语音和文字共享一个上下文。

## 4. Supabase 部署内容

### 4.1 项目信息

- 项目 ID：`ropgifqbblzktgxllupi`
- 区域：`ap-southeast-1`
- Edge Function：`realtime-gateway`
- 当前函数版本：`1`
- 函数状态：`ACTIVE`

### 4.2 数据表

| 表 | 用途 |
|---|---|
| `learner_profiles` | 保存匿名 conversation 对应的学习等级 |
| `realtime_sessions` | 保存短期会话、状态、过期时间和哈希客户端标识 |
| `session_messages` | 只保存用户/AI 最终文字，不保存音频 |
| `realtime_metrics` | 保存结构化客户端质量指标 |
| `request_rate_limits` | 对公开 Demo 的会话创建进行限流 |

五张表全部开启 RLS，并撤销 `anon`、`authenticated` 的直接表权限。没有公开 RLS policy 是有意的“默认拒绝”设计；只有 Edge Function 内的服务端 Secret 可以写入。

### 4.3 为什么函数使用 `verify_jwt = false`

前端使用 Supabase 新版 `sb_publishable_...` Key。新版 Key 应放在 `apikey` 请求头中，不应伪装成 JWT 放进 `Authorization: Bearer`。

因此平台旧式 JWT 校验关闭，函数内部会把请求的 `apikey` 与 Supabase 自动注入的 publishable keys 做匹配，并继续执行 Origin、限流、会话有效期和输入校验。这不是匿名绕过校验。

## 5. 已完成的一次性 Secret 配置（后续迁移/换 Key 仍按此操作）

打开：<https://supabase.com/dashboard/project/ropgifqbblzktgxllupi/functions/secrets>

从本机 `7.14/UniSpeaking/.env` 读取对应值，在 Supabase 中新增：

| Secret 名称 | 是否必需 | 说明 |
|---|---|---|
| `DASHSCOPE_API_KEY` | 必需 | 百炼 API Key |
| `BAILIAN_WORKSPACE_ID` | 必需 | 百炼 Workspace ID |
| `BAILIAN_MODEL` | 可选 | 默认 `qwen3.5-omni-plus-realtime` |
| `ALLOWED_WEB_ORIGINS` | 可选 | 可设为生产域名和本地地址的逗号分隔列表 |

建议的 `ALLOWED_WEB_ORIGINS`（不含密钥）：

```text
https://unispeaking-web.vercel.app,http://localhost:8080,http://127.0.0.1:8080
```

保存 Secret 后不需要重新部署函数。重新访问健康接口，`model_configured` 应从 `false` 变为 `true`。不要把 Secret 写入 `runtime-config.mjs`、Vercel 前端变量、Git 或本文档。

## 6. 本地运行与验证

进入 Web 项目：

```bash
cd /Users/mac/Documents/七牛云/7.14/UniSpeaking_Complete_UI
npm test
npm run dev
```

打开 <http://localhost:8080>。

本地检查顺序：

1. 自由对话页出现“点击麦克风开始实时对话”。
2. 场景训练可以进入“学、读、说、诊”四个阶段。
3. 点击麦克风后浏览器请求权限。
4. 授权后 AI 主动开场，字幕显示 AI 文本并播放音频。
5. 说一句英文，确认用户转写和 AI 回应出现。
6. 麦克风按钮可切换静音；结束按钮可回到准备状态。
7. 刷新页面后没有残留麦克风采集。

## 7. 本次实际部署操作

### 7.1 Supabase

1. 使用 Supabase 插件对项目 `ropgifqbblzktgxllupi` 应用迁移 `realtime_web`。
2. 部署 `realtime-gateway` Edge Function，版本进入 `ACTIVE`。
3. 查询五张表，确认 RLS 全部为 `true`。
4. 执行安全和性能 Advisor：只有“RLS 无公开 policy”和“新索引尚未使用”的信息提示；前者符合默认拒绝设计，后者是新表尚无流量的正常结果。
5. 健康接口返回 HTTP 200。
6. 线上创建会话返回 201，关闭会话返回 200。

### 7.2 Vercel

- Team：`dal815842-7599's projects`
- 项目：`unispeaking-web`
- Project ID：`prj_AioUmL2jMPvV3jZavj7V1RexSBkN`
- Production Deployment：`dpl_FUKPRUpRhLyXop72QcfBsFaMmLp2`
- 正式域名：<https://unispeaking-web.vercel.app>

Vercel 插件上传 21 个 Web 文件并创建生产部署。最新构建状态为 `READY`，构建输出耗时约 36ms；首页、CSS 和 Realtime JavaScript 模块均返回 HTTP 200。

生产响应已包含 CSP、麦克风权限、禁止 MIME 猜测和 Referrer Policy 等安全响应头。

## 8. 后续更新和重新部署

### 修改前端

1. 在 `UniSpeaking_Complete_UI` 修改 UI 或 `src/realtime` 模块。
2. 运行 `npm test`。
3. 本地打开主要路由检查。
4. 使用 Vercel 插件重新部署同名项目 `unispeaking-web`。
5. 检查 Deployment 为 `READY`，再访问正式域名。

### 修改数据库

1. 新建一份只包含本次变更的 SQL migration。
2. 先检查 SQL 是否对现有数据兼容。
3. 使用 Supabase 插件应用 migration。
4. 查询目标表并运行 Security/Performance Advisor。

### 修改 Edge Function

1. 修改 `supabase/functions/realtime-gateway/index.ts`。
2. 运行 `npm test` 中的源代码安全检查。
3. 使用 Supabase 插件部署新版本。
4. 调用 `/health`、`POST /session` 和 `DELETE /session`。
5. 查看 Edge Function 日志是否出现 4xx/5xx 或上游错误。

## 9. 常见问题

### 页面能打开，但点击麦克风提示未配置

原因：Supabase 尚未设置 `DASHSCOPE_API_KEY` 或 `BAILIAN_WORKSPACE_ID`。按第 5 节设置后重新尝试。

### 浏览器没有弹出麦克风权限

检查浏览器地址栏的网站权限和 macOS“系统设置 → 隐私与安全性 → 麦克风”。生产站点必须通过 HTTPS 访问，本地可以使用 localhost。

### 会话创建返回 429

公开 Demo 当前限制同一哈希客户端每分钟最多创建 5 次会话。等待一分钟后再试，不要连续点击。

### 有字幕但没有 AI 声音

检查浏览器自动播放限制、系统输出设备，以及 DataChannel 是否已收到 `response.audio_transcript.*`。同时查看 Supabase Edge Function 日志。

### 回滚

- 前端：在 Vercel 项目 Deployments 中选择上一条成功部署并 Promote/Rollback。
- Edge Function：重新部署上一版 `index.ts`。
- 数据库：不要删除生产表；为迁移编写前向修复 migration。

## 10. 本轮验收状态

| 检查项 | 结果 |
|---|---|
| Node 自动测试 | 通过 |
| 本地自由对话页渲染 | 通过，无浏览器错误 |
| 本地四阶段训练页 | 通过 |
| Supabase migration | 成功 |
| 五张表 RLS | 全部开启 |
| Edge Function | ACTIVE，健康接口 200 |
| 会话创建/关闭 | 201 / 200 |
| Vercel 生产部署 | READY |
| 生产首页与核心模块 | HTTP 200 |
| 生产浏览器渲染 | 通过，无控制台错误 |
| 百炼 SDP、真实语音、AI 音频端到端 | 通过（用户确认生产链路完全可用） |

本轮不包含 iOS、Android，也没有把原始音频、百炼密钥或 Supabase 服务端 Secret 放入 Web 前端。
