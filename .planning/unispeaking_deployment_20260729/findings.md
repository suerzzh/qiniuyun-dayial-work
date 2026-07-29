# Findings & Decisions

## Requirements
- 审查 `/Users/mac/Documents/七牛云/项目/UniSpeaking`。
- 结合用户工作区中此前部署上线的经历，说明这次如何部署。
- 明确需要新增或修改的代码。
- 将方案写入 `/Users/mac/Documents/七牛云/7.29`。
- 用户重新声明：当前仓库只是雏形，后续会拿到一份“完整且本地可运行”的项目；方案不应要求现在这份雏形直接生产化，而应作为未来完整项目的部署适配规范。
- 指定目标平台：Vercel + Supabase。文档必须拆成两条主线：开发同学在具体文件里新增什么；用户在 Vercel 与 Supabase 平台里做什么。

## Research Findings
- 项目是单仓结构：Spring Boot 后端、Vite/React 前端、`deploy` 下的 Compose 与 nginx。
- README 与 `deploy/docker-compose.yml` 声称前端目录为 `frontend/unispeaking-web`，但仓库实际目录是 `frontend/Unispeaking_fronted`；当前 Compose 的 frontend build context 会直接失败。
- README 明确标注当前仍是开发模式：用户缺失时回退到 `local-demo-user`、会话/用户/场景/对话存储均为内存实现，进程重启即丢失。
- 已有 `docs/deployment.md` 只覆盖本地/Compose 启动及百炼实时密钥，不包含正式域名、HTTPS、数据库、鉴权、健康检查、监控、备份、CI/CD、灰度/回滚。
- 当前实时链路是：浏览器提交 WebRTC offer → Spring Boot → 阿里云百炼/Qwen 换取 answer SDP → 浏览器直接与 Qwen Realtime 建立 WebRTC；服务端持有长期 API Key。
- 已有 Compose 三服务：backend 暴露 8080、frontend 暴露 3000、nginx 暴露 80；backend/frontend 端口也对宿主机公开，正式环境应只开放 nginx 的 80/443。
- 当前工作区 Git 分支为 `codex/integrate-free-chat-v2`，项目最近两次相关提交是导入单仓和初始项目代码；工作区还有大量与本任务无关的未提交/子模块改动，必须避免触碰。
- 前端实际没有 Dockerfile，Compose 的 frontend service 即使修正目录也无法按预期构建为监听 80 的镜像。
- 前端生产 API 变量实际读取 `VITE_UNISPEAKING_API_BASE`，Compose 却传入 `VITE_BACKEND_URL`，变量名不一致；而同域反代场景最简单的做法是前端默认使用相对 `/api` 与 `/ws`。
- nginx 只代理 `/backend/`，但前端和后端真实接口是 `/api/*` 与 `/ws/session-messages`；现有反向代理路由无法支持当前客户端。
- nginx 未配置 WebSocket Upgrade/Connection 头、HTTPS、域名、HSTS、请求体/超时、访问日志格式、静态缓存与安全响应头。
- 前端的深层 React 路由需要 `try_files ... /index.html` 回退；现有 nginx 是二次代理到“frontend:80”，但 frontend 镜像不存在。
- 后端 `pom.xml` 目前没有 Spring Security、Actuator、数据库驱动/迁移、JPA/MyBatis、Redis、Micrometer 等生产依赖。
- `application.yaml` 目前只配置端口、环境文件导入和 Qwen realtime；没有 prod profile、优雅停机、健康探针、代理头、数据库、日志/指标配置。
- 后端镜像使用 Java 21 多阶段构建，但构建阶段直接 `COPY . .`，没有 `.dockerignore`、缓存优化、非 root 用户、健康检查、JVM 容器参数或镜像固定 digest。
- 前端 UI 有登录/注册表单，但接口契约明确标注鉴权等大量功能只是“建议新增”；代码中仍固定 `local-demo-user`，后端 `AuthServiceImpl` 也回退同一开发用户。
- 四类核心持久化接口均由 `InMemory*` 实现；单实例重启丢数据，多实例之间状态不一致，因此当前不具备横向扩容基础。
- 环境样例包含百炼、DeepSeek、豆包、MiniMax、讯飞等多供应商长期密钥；必须进入服务器 Secret/环境变量，绝不能进入前端构建参数或 Git。
- 工作区存在清晰的既往上线记录（7.14 与 7.17/7.16）：此前采用 `Vercel 静态前端 + Supabase Edge Function 控制面 + Supabase Postgres/Auth/Storage + 浏览器直连百炼 WebRTC 媒体面`。
- 之前已经绑定/验证 `app.unispeaking.cn`、`www.unispeaking.cn`、`unispeaking.cn`，并复用原 Vercel 项目与 Supabase 项目，避免删除项目导致域名、环境变量、证书和数据重配。
- 之前的核心上线纪律：GitHub 是唯一代码源；先 Preview/Staging 验收再 Production；密钥分层；空库 migration 可恢复；精确 CORS；健康检查；构建产物脱敏扫描；保留上一 READY deployment；前端、函数、数据库分别回滚。
- 之前真实踩坑 1：Vercel Production 环境变量未正确进入构建，线上回退 localhost。解决方式是 production 预构建并扫描产物：必须包含正式网关 URL/公开 key，且不得包含 localhost 或服务端 secret。
- 之前真实踩坑 2：`www` 与根域名页面可打开但会话 `Failed to fetch`；根因是 Edge Function 精确 CORS 只允许 `app`。通过资源哈希、OPTIONS 预检和服务端日志定位，补齐三个精确 Origin 并加契约测试。
- 之前真实踩坑 3：不能把依赖进程内状态、本地文件或长期 WebSocket 的本地后端直接搬进 Vercel/Supabase 无状态函数；此前通过把控制面改成短请求、媒体面保持浏览器 WebRTC、状态落 Postgres 来适配。
- 之前使用过的前端生产安全配置包括 `X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy: microphone=(self), camera=()`、静态资源 immutable cache；旧版本还使用过 CSP。
- 之前上线时保留了“不存储原始用户音频”的边界，只保存会话元数据、最终字幕和质量指标；这可作为本次默认隐私策略。
- 历史方案里的 Supabase Edge Function 并不持续转发音频，只做会话、来源校验、SDP 交换和事件落库。这一经验仍适用，但当前项目已形成更完整的 Spring Boot 控制面，直接退回 Edge Function 会造成重复迁移。
- 架构参考对标准 Web 应用的默认建议是“模块化单体 + 单库 + 应用无状态”，只有读压力、慢操作或团队并行阻塞等证据出现后才加缓存、读副本、队列或拆服务；这与当前小团队/MVP 阶段匹配。
- 架构参考明确把“应用层有状态、过早微服务/分库分表、只认证不做对象级授权”列为反模式；本项目最优先的不是拆服务，而是外置内存状态并建立每条用户数据的授权边界。
- AI 产品在成长期应补会话存储、限流配额、模型调用成本/延迟可观测和供应商故障转移；当前已有多供应商路由骨架，但没有生产级用量持久化、集中限流和成本台账。
- 扩容必须由指标触发：例如主库 CPU 持续 >70%、P99 持续越线、某组件成为单点、模型成本/延迟恶化；未出现信号前不引入 Kubernetes、微服务、分片或复杂缓存。
- 前端认证页面完全是 UI 模拟：表单不提交后端，注册只切换“邮件已发送”状态，登录直接进入下一页；必须新增真实 Auth client、token/session 管理、路由保护和退出登录。
- `realtimeClient.js` 的 HTTP 与 WebSocket 均未携带身份凭据，HTTP body 允许客户端自报任意 `userId`，WebSocket frame 仅含 `sessionId`；公网环境存在冒用用户和越权操作任意会话的风险。
- 后端 `AuthServiceImpl` 只是把任意传入字符串当作 userId，空值则使用 `local-demo-user`；没有认证、密码、JWT 校验、对象归属验证或角色/权限。
- WebSocket 配置使用 `setAllowedOrigins("*")`，直接重现历史 CORS/Origin 风险；生产必须使用三个正式 Origin 的白名单并在握手阶段验证 access token。
- `SessionMessageWebSocketHandler` 根据客户端提交的 sessionId 直接追加/结束会话，没有校验当前连接用户是否拥有该 session；HTTP 结束接口也同样缺少归属校验。
- 日志会记录 prompt 摘要和消息 content 摘要；正式环境需要明确 PII/学习文本策略、脱敏与保留周期，默认不记录完整 SDP、Authorization、长期密钥和原始音频。
- 现有 repository 接口已经为替换存储预留了端口，但接口粒度较弱：没有 user/session 归属查询、幂等消息 ID、分页、状态版本/并发控制、TTL；生产实现前需扩展契约。
- `InMemorySceneRepository` 实际只是固定返回 Qwen/Katerina 场景配置，不一定需要立刻建业务表；MVP 可先保留为版本化配置，用户/会话/消息/用量必须持久化。
- Supabase 官方当前推荐至少区分 Production 与 Development，Staging/Preview 可选；GitHub 集成可部署 `supabase/` 中的 migrations、Edge Functions 与 `config.toml` 声明的 Storage buckets，Branching/PR Preview 属于可选付费能力。
- Supabase 官方当前强调：暴露 schema（默认含 `public`）中的表必须启用 RLS；Data API 的对象级 GRANT 与行级 RLS 是两层独立权限，不能只做其中一层。
- Supabase 鉴权/授权必须按 `auth.uid() = user_id` 做对象归属；仅写 `TO authenticated` 仍会造成 BOLA/IDOR。角色授权不得依赖用户可编辑的 `user_metadata`。
- Vercel 的 Vite SPA 深层路由应在项目根 `vercel.json` 添加全路径 rewrite 到 `/index.html`；Preview 与 Production 环境变量应分开配置，前端公开变量才允许使用 `VITE_` 前缀。
- Vercel 推荐通过 Git 集成自动创建 Preview；验证后可 promote 同一构建产物到 Production，回滚则把生产别名切回此前稳定 deployment，避免重新构建引入漂移。
- Supabase Edge Functions 当前自带项目 URL、publishable/secret key 集合与 JWKS 等默认 secrets；第三方 AI 长期密钥应通过 Dashboard 或 `supabase secrets set` 配置，本地 secrets 文件必须忽略。远端 secret 更新后可立即供函数使用，无需为此重部署函数。
- Supabase Auth 的生产 `Site URL` 必须从 localhost 改成正式域名；Production 使用精确 redirect URL，Vercel Preview 可单独增加受控通配规则。
- 当前工作区根 `/supabase` 目录没有可复用的 migration/function 源文件；虽然远端历史 Supabase 项目曾部署成功，本次未来完整项目必须把远端能力“源码化”回仓库，不能只依赖 Dashboard 中的不可追踪配置。
- 7.17 的历史前端仓库保留了可复用的 `realtime-api.mjs`、`realtime-client.mjs`、`useRealtimeSession.js`、部署配置测试与 Vercel 配置，可作为开发同学实现未来完整项目适配层的参考，但最终文件名应跟随新项目框架。
- 7.29 已有 AI Provider 源码导读覆盖多供应商后端适配；本部署方案不要求把全部 Spring Provider 搬进 Edge Function，首发只迁移实际上线链路必需的百炼 Realtime 控制面，其他 LLM/ASR/TTS/评分按是否存在短请求接口逐一迁移。
- 2026-07 的 Supabase changelog 有三项与本方案直接相关：新表不再自动暴露到 Data/GraphQL API，migration 必须显式 GRANT；Supabase JS 相关客户端在 2026-06-30 后不再支持 Node.js 20，构建基线应使用 Node.js 22；旧 `anon`/`service_role` key 虽可用到 2026 年底，但官方强烈建议现在改用 publishable/secret keys。
- 新 Free 项目若要自定义认证邮件，需要配置自有 SMTP；正式用户注册/找回密码不能把 Supabase 默认邮件能力当作已完成。
- 历史代码验证了适配层的合理拆分：`realtime-api` 只负责 HTTPS API 与公开 key/JWT 头；`realtime-client` 负责 WebRTC、DataChannel、麦克风、质量指标和 teardown；React hook 负责状态映射。未来完整项目应保留这三层边界。
- 历史生产网关契约可复用为首发接口：health、创建 session、SDP 交换、保存最终事件、绑定 provider session、记录质量、更新学习等级、关闭 session。
- 历史函数使用 `verify_jwt=false` 并自行校验 publishable key/Origin，是“无需登录 Demo”的折中。未来完整产品默认改为 `verify_jwt=true`，业务调用携带 Supabase access token；只有独立的最小健康接口或明确匿名体验才允许自定义认证。

## Technical Decisions

| Decision | Rationale |
|---|---|
| 当前 Spring Boot 保留方案已被用户的新前提替代 | 现在只把雏形当参考，未来完整本地项目需要按 Vercel + Supabase 交付契约适配 |
| 复用历史域名、Vercel/Supabase 项目与上线纪律 | 减少域名、证书、密钥和数据库迁移风险 |
| 任何进程内状态与本地文件必须迁到 Supabase | 无状态函数不能依赖固定实例或持久本地磁盘 |
| 以未来完整本地项目为输入，本文定义“交付契约”而非直接修改当前雏形 | 用户已明确当前代码不是最终上线对象 |
| 最终推荐回到已验证的 Vercel + Supabase 无服务器架构 | 用户明确指定平台，且历史上已成功部署同类实时语音链路 |
| Vercel 只托管前端静态产物，Supabase Edge Function 只承载短请求控制面 | 避免把常驻进程、进程内状态、本地文件或全量实时音频硬塞进无状态平台 |
| Production 默认启用 Supabase Auth JWT；不把匿名 publishable-key 模式作为正式默认 | 防止仅靠 Origin/API key 带来的冒用与滥用风险 |
| 统一使用 Node.js 22 与新版 publishable/secret keys | 与 2026-07 当前 Supabase 支持基线一致 |

## Issues Encountered

| Issue | Resolution |
|---|---|
| README/Compose 中的前端路径与真实目录不一致 | 在方案中列为 P0，要求统一目录名或修正所有 build context |
| Compose、nginx、前端 API 变量三者契约漂移 | 把“统一同域 `/api` + `/ws` 路由”列为上线前契约修复 |
| 当前没有真实鉴权与持久化 | 正式公网上线前必须新增；若只做邀请制演示，需明确采用受控访问并限制为临时方案 |

## Resources
- `/Users/mac/Documents/七牛云/项目/UniSpeaking`
- `/Users/mac/Documents/七牛云/7.29`
- `/Users/mac/Documents/七牛云/项目/UniSpeaking/docs/deployment.md`
- `/Users/mac/Documents/七牛云/项目/UniSpeaking/deploy/docker-compose.yml`
- `/Users/mac/Documents/七牛云/项目/UniSpeaking/README.md`
- `/Users/mac/Documents/七牛云/7.14/03_UniSpeaking开发团队部署前置准备与生产化改造行动指南.md`
- `/Users/mac/Documents/七牛云/7.14/UniSpeaking_Vercel与Supabase部署上线完整流程.md`
- `/Users/mac/Documents/七牛云/7.17/7.16/UniSpeaking_从融合完成到生产上线说明.md`
- `/Users/mac/Documents/七牛云/7.17/7.16/UniSpeaking_部署上线路演讲解与评委问答.md`

## Assumptions To Validate
- 当前交付是部署设计文档，不包含直接上线或修改业务代码。
- 首次正式上线按低至中等流量、单团队维护、需要可回滚处理。
- 未来完整项目的长时音频不经过 Edge Function；Edge Function 只做短生命周期控制面与落库。如果未来交付物强依赖常驻后端、长连接或本地文件，必须先重构，不得硬塞进 Vercel/Supabase。
