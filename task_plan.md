# Task Plan: 7.8 产品设计书模块 7/8/9 写作

## Goal
基于 `7.7` 昨日产出和 `7.8/产品设计书初稿写作框架.docx`，为我负责的产品设计书 7、8、9 模块形成可交付内容，并持续维护规划记录。

## Current Phase
Phase 35: Session Identity to User Usage Flow Documentation

## Phases

### Phase 1: Requirements & Discovery
- [x] 启用 `planning-with-files` 并检查上一轮会话记录
- [x] 初步识别项目目录、昨日材料和今日任务文档
- [x] 阅读 7.7 产出材料
- [x] 提取 7.8 Word 写作框架
- [x] 将关键发现写入 `findings.md`
- **Status:** complete

### Phase 2: Brainstorming & Writing Design
- [x] 梳理 7/8/9 模块在全文中的定位
- [x] 提出 2-3 种写作方案及取舍
- [x] 给出推荐写作设计并请用户确认
- **Status:** complete

### Phase 3: Drafting Modules 7/8/9
- [x] 按确认后的方案撰写模块 7
- [x] 按确认后的方案撰写模块 8
- [x] 按确认后的方案撰写模块 9
- [x] 统一术语、语气、逻辑衔接
- **Status:** complete

### Phase 4: Document Integration & QA
- [x] 将内容整理为适合交付的文档格式
- [x] 如生成或修改 `.docx`，按 documents 技能进行渲染检查
- [x] 检查缺漏、重复、格式和可读性
- **Status:** complete

### Phase 5: Delivery
- [x] 更新 `task_plan.md`、`findings.md`、`progress.md`
- [x] 向用户说明完成内容、文件位置和剩余风险
- **Status:** complete

### Phase 6: Commercial Model Refinement
- [x] 阅读 `7.8/竞品商业模式调研.md`
- [x] 根据竞品调研细化第 8 节商业化板块
- [x] 将价格表达统一为人民币
- [x] 给出暂定商业模型、初步定价和定价理由
- [x] 检查美元符号和旧价格表达残留
- **Status:** complete

### Phase 7: Acceptance Criteria Update
- [x] 阅读 `7.8/自由聊天模块产品设计.docx`
- [x] 提取自由聊天模块的功能边界、体验要求、性能指标和核心指标
- [x] 更新 `7.8/7-8-9模块草稿.md` 第 9 节验收标准
- [x] 将验收模块扩展为自由聊天功能验收、体验验收、性能验收、核心指标验收和总体通过标准
- **Status:** complete

### Phase 8: Scenario System Acceptance Update
- [x] 阅读 `7.8/AI口语训练场景体系Proposal.md`
- [x] 提取自由对话、普通自定义场景、专业化训练场景三类入口边界
- [x] 提取场景广场“学-读-说”路径和基础反馈验收点
- [x] 提取 IELTS 与英文面试专业模块验收点
- [x] 更新 `7.8/7-8-9模块草稿.md` 第 9 节验收标准
- **Status:** complete

### Phase 9: Personal Homepage Prototype
- [x] 复核个人主页需求和既有视觉风格
- [x] 设计个人主页原型信息架构
- [x] 创建 `7.8/个人主页原型.html`
- [x] 创建 `7.8/个人主页原型图.svg`
- [x] 导出 `7.8/个人主页原型图.png`
- [x] 查看 PNG 确认布局完整
- **Status:** complete

### Phase 10: Personal Homepage Client Prototype
- [x] 将个人主页桌面原型改造为移动 App 客户端信息结构
- [x] 创建 `7.8/个人主页客户端原型.html`
- [x] 创建 `7.8/个人主页客户端原型图.svg`
- [x] 导出 `7.8/个人主页客户端原型图.png`
- [x] 查看 PNG 确认布局完整
- **Status:** complete

### Phase 11: Daily Report Summary
- [x] 复核今日 `progress.md`、`task_plan.md` 和昨日日报风格
- [x] 总结今日完成内容、主要产出、阶段结论和明日建议
- [x] 创建 `7.8/占付龙—7.8日报.md`
- **Status:** complete

### Phase 12: 7.9 Realtime Voice Demo Technical Design
- [x] 使用 `planning-with-files` 和 `superpowers:brainstorming` 相关指导
- [x] 读取 7.8 产品定位、自由对话和场景体系资料
- [x] 核对 Qwen-Omni-Realtime、Qwen-Omni、Qwen2.5-Omni 公开资料
- [x] 搜索豆包/火山方舟实时语音公开文档，并标注需要权限确认和实测
- [x] 输出 `7.9/国内端到端Realtime语音Demo开发设计文档.md`
- [x] 自检文档覆盖 Demo 目标、方案选择、功能范围、页面设计、技术链路、环境变量、Prompt、日志、验收标准、风险与备选方案
- [x] 根据用户提醒，将本次 planning 摘要同步回项目根目录全局 planning 文件
- **Status:** complete

### Phase 13: OpenSpec Realtime Voice Demo Development Specification
- [x] 查找 OpenSpec 相关 skill/目录，确认本轮可见 skills 列表中无 OpenSpec skill，但本机存在 OpenSpec 文档与 CLI 源码目录
- [x] 阅读 OpenSpec workflows、concepts、writing-specs、examples、agent-contract 相关说明
- [x] 根据上一轮开发设计文档创建项目级 `openspec/` 规约目录
- [x] 创建 `openspec/config.yaml` 和 `openspec/project.md`
- [x] 创建 `openspec/changes/realtime-voice-demo-chain/proposal.md`
- [x] 创建 `openspec/changes/realtime-voice-demo-chain/design.md`
- [x] 创建三个 delta spec：链路行为、事件契约、调试与验收
- [x] 创建 `openspec/changes/realtime-voice-demo-chain/tasks.md`
- [x] 将实现方案锁定为 Qwen-Omni-Realtime WebSocket 后端代理链路
- [x] 将技术栈锁定为 Vite + React + TypeScript、Express + ws + TypeScript、npm run dev
- [x] 静态检查规约文件，确认无待定/自行选择/TODO，三个 spec 合计 23 个 Requirement、45 个 Scenario
- **Status:** complete

### Phase 14: Realtime Voice Demo Start-Then-Ends Debugging
- [x] 使用 systematic-debugging、test-driven-development、verification-before-completion 和 planning-with-files
- [x] 检查 `7.9/realtime-voice-demo` 项目结构、脚本和关键源码
- [x] 运行 `npm run typecheck` 与 `npm run build`
- [x] 确认 `.env` 必填项均已设置但不读取真实 Key
- [x] 启动/检查本地服务，确认 8787 与 5173 已有当前 Demo 进程
- [x] 通过最小 WebSocket 客户端复现 `client.start` 后收到 `session.closed reason=provider_closed`
- [x] 直连 Qwen WebSocket 捕获握手 400 响应体：`BadRequest.IllegalEndpoint` / `Workspace endpoint is invalid.`
- [x] 添加失败测试，覆盖供应商握手错误消息保留响应体
- [x] 修复供应商握手失败被误显示为通话结束的问题
- [x] 验证错误路径和构建
- **Status:** complete

### Phase 15: Realtime Voice Demo Click-Then-Black-Screen Debugging
- [x] 使用 systematic-debugging、planning-with-files 和浏览器调试能力
- [x] 打开当前本地前端页面，确认初始 UI 正常渲染且无控制台错误
- [x] 点击“开始对话”，观察页面进入 `requesting_mic`，按钮状态变为开始禁用、结束可用
- [x] 截图确认页面不是 React 崩溃黑屏，而是深色背景下停在“正在请求麦克风权限”
- [x] 检查后端 `/api/health`，确认配置就绪
- [x] 通过最小 WebSocket 客户端绕过浏览器麦克风，确认后端已成功连接 Qwen 并收到 `session.ready` 与 AI 开场文本
- [x] 给用户说明当前根因方向和浏览器/系统麦克风授权检查步骤
- **Status:** complete

### Phase 16: Realtime Voice Demo React Null Ref Crash Fix
- [x] 读取用户提供的 React 错误堆栈，定位 `useRealtimeCall.ts` 中 `currentAiMessageRef.current!.id` 崩溃
- [x] 扫描 `useRealtimeCall.ts` 中所有在 React state updater 内读取 mutable ref 的类似写法
- [x] 按 TDD 增加消息替换 helper 的回归测试，并先观察 RED
- [x] 新增 `src/messageState.ts`，封装 `replaceMessageById`
- [x] 将用户临时转写、用户最终转写、AI 文本增量、AI 文本完成四处更新改为先捕获 `updated` 局部变量
- [x] 将测试移出 `src/`，避免前端 tsconfig 纳入 Node 测试类型
- [x] 运行消息测试、供应商错误测试、类型检查和生产构建
- **Status:** complete

### Phase 17: Realtime Voice Demo AI Reply Event Mapping Fix
- [x] 根据用户反馈确认现象：用户语音可转写并显示，但 AI 不显示回复
- [x] 对照阿里云 Qwen-Omni-Realtime 官方文档确认 text+audio 输出模式的文本事件为 `response.audio_transcript.delta/done`
- [x] 检查 `server/qwenProvider.ts`，确认当前只映射 `response.text.delta/done`
- [x] 新增 provider 事件映射回归测试，先观察 RED
- [x] 在 `server/qwenProvider.ts` 增加 `response.audio_transcript.delta/done` 到 `server.ai_text_delta/done` 的映射
- [x] 运行 provider 测试、消息测试、类型检查和生产构建
- **Status:** complete

### Phase 18: Realtime Model Capability Boundary Test Design
- [x] 恢复全局 planning-with-files 上下文并核对未同步会话
- [x] 检查现有 7.9 Demo 方案、项目文件和最近提交
- [x] 明确本轮测试对象、优先能力和成功标准
- [x] 比较测试用例的组织方式并确定推荐方案
- [x] 设计基线 Prompt、变量控制、用例、记录表和能力归因规则
- [x] 经用户确认后将测试文档写入 `7.10`
- [x] 自检文档的完整性、歧义和可执行性
- **Status:** complete

### Phase 19: Expanded Realtime Model Performance Test Manual
- [x] 恢复会话并检查现有测试文档、Demo Prompt、配置和全局记录
- [x] 确定扩写结构：执行手册 + 36 条详细用例 + 空白结果表
- [x] 重写测试准备、Prompt 切换、单次执行和评分步骤
- [x] 扩充 30 条模型行为用例和 6 条模型性能/稳定性用例
- [x] 为每条用例补充逐轮话术、操作步骤、观察点、通过标准和归因方式
- [x] 增加可直接填写的空白测试结果总表和单次记录模板
- [x] 自检用例数量、编号、Prompt 一致性、表格完整性和敏感信息
- **Status:** complete

### Phase 20: 7.10 UniSpeaking Demo Configuration and Startup
- [x] 恢复 planning-with-files 会话并定位 7.10 Demo 项目
- [x] 确认项目为 `7.10/demo测试/UniSpeaking`，当前无 `package.json`
- [x] 阅读 README、HTML、`.env.example` 和 `.gitignore`，确认实际启动与鉴权方式
- [x] 将用户提供的凭据仅写入本地 `.env`，确保 Git 忽略
- [x] 按项目实际架构补齐必要的本地启动配置
- [ ] 启动服务并验证页面、鉴权/会话入口和错误日志（Codex 沙箱阻止联网安装与监听端口，需用户在普通终端执行）
- [x] 向用户给出后续自行启动和开始测试的命令
- **Status:** blocked_by_execution_environment

### Phase 21: Weekly Meeting Report Summary
- [x] 恢复本周会话记录并确定汇报范围为 7.7-7.10
- [x] 阅读 7.7、7.8 日报和全局阶段记录
- [x] 提取 7.9 技术方案、OpenSpec、Demo 调试与修复结论
- [x] 提取 7.10 模型测试体系、Prompt 分层和 WebRTC Demo 配置结论
- [x] 整理为周会口述版：本周目标、每日推进、成果、问题、结论、下周计划
- [x] 检查数字、文件名和未完成事项，避免把环境阻塞描述成已完成
- **Status:** complete

### Phase 22: UniSpeaking Overall Architecture Baseline Design
- [x] 使用 brainstorming、planning-with-files 与 documents 技能并恢复会话
- [x] 定位根目录产品计划书、参考 DOCX 和 `7.13` 输出目录
- [x] 完整提取 `UniSpeaking产品计划书_v2.md` 的产品、功能、商业、数据与技术约束
- [x] 提炼参考 DOCX 的目录层级、表格、图示、写作方式和视觉模板
- [x] 提出 2-3 种总体架构文档方案并请用户确认（已选择产品-AI-技术一体化基线型）
- [x] 确认详细目录、图表范围、技术深度和交付格式
- [x] 在 `7.13` 写入确认后的架构基线文档
- [x] 生成 7 张架构图并同时交付 Markdown 与 DOCX
- [x] 对 25 页 DOCX 执行渲染、逐页检查和迭代修复
- [x] 完成标题、图片、字段、可访问性和参考文档哈希审计
- [x] 更新全局 planning 记录并交付
- **Status:** complete

### Phase 23: UniSpeaking Empty Project Skeleton Specification
- [x] 使用 planning-with-files 与 Superpowers 工作流恢复全局上下文
- [x] 读取根目录三个全局 planning 文件
- [x] 概览 `7.13` 现有总体架构交付和根目录设计资料
- [x] 明确本次“空骨架”的交付边界与技术栈继承方式
- [x] 提出 2-3 种项目骨架组织方案并获得用户确认
- [x] 将确认后的项目目录树、文件职责和扩展预留写入 `7.13`
- [x] 更新根目录全局 planning 文件并完成静态自检
- [ ] 用户复核书面规范并确认是否进入实际骨架初始化计划
- **Status:** awaiting_user_review

### Phase 24: 7.13 Daily Report
- [x] 汇总 2026-07-13 根目录进度和 `7.13` 交付文件
- [x] 纳入网页版沟通确认的 Web、iOS、Android 与全栈骨架决策
- [x] 按用户给定的固定日报格式组织内容
- [x] 写入 `7.13/占付龙—7.13日报.md`
- [x] 更新根目录全局 planning 文件
- **Status:** complete

### Phase 25: 7.14 UI-Demo Integration and Deployment
- [x] 恢复全局 planning 上下文并检查未同步会话
- [x] 初步扫描 `7.14/UniSpeaking_Complete_UI` 与 `7.14/UniSpeaking`
- [x] 完整梳理 UI 自由对话交互与 Demo WebRTC/API 边界
- [x] 检查 Vercel、Supabase 插件可用性和部署授权状态
- [x] 提出 2-3 种集成/部署方案并获得用户确认
- [x] 写入设计说明；用户明确授权跳过复核并直接执行
- [x] 用户将本轮范围收敛为仅 Web 端，不包含 iOS/Android
- [x] 制定实施计划并按 TDD 完成 UI-Demo 集成
- [x] 恢复缺失训练页并完成 Realtime 状态、消息、API、WebRTC 与 UI 接入
- [x] 应用 Supabase migration，部署 `realtime-gateway` 并验证健康、RLS、会话创建/关闭
- [x] 部署 Vercel 生产站点并验证首页、模块、安全响应头和浏览器渲染
- [x] 编写链接与部署操作文档
- [x] 更新根目录全局 planning 文件并交付
- [x] 在已登录的 Supabase 控制台写入百炼两项 Secret，并完成真实 SDP/语音/AI 音频端到端验证（用户确认链路已完全可用）
- **Status:** complete

### Phase 26: 7.14 Vercel + Supabase Production Deployment Guide
- [x] 恢复全局 planning 上下文并确认真实 Realtime 链路已跑通
- [x] 阅读 Supabase、Vercel 部署与环境变量相关 skills
- [x] 复核 7.14 当前项目的配置、数据库 migration、Edge Function 和既有部署说明
- [x] 核对 Supabase/Vercel 官方最新文档与常见操作
- [x] 编写面向完整本地前后端项目迁移后的逐步上线手册
- [x] 覆盖部署前预留、环境变量、接口、数据库、域名、CORS、验证、回滚和日常运维
- [x] 写入 `7.14` 并完成 Markdown 静态检查
- [x] 更新根目录全局 planning 文件并交付
- **Status:** complete

### Phase 27: GitHub Deployment, Custom Domain, and Future Self-Hosted Guides
- [x] 恢复全局 planning 上下文并阅读相关 skills
- [x] 检查当前 Git 仓库、GitHub remote、项目部署结构和 `unispeaking.cn` 公共 DNS 状态
- [x] 核对 Vercel Git 集成、自定义域名、Supabase GitHub 集成和阿里云 DNS 官方流程
- [x] 核对未来中国大陆自有服务器所需域名、HTTPS、备案、安全与部署要求
- [x] 确定当前域名分工和未来平滑迁移策略
- [x] 编写 GitHub → Vercel/Supabase → `unispeaking.cn` 精确行动指南
- [x] 编写后续自有服务器部署与迁移精确行动指南
- [x] 执行 Markdown、链接、敏感信息和覆盖范围检查
- [x] 更新根目录全局 planning 文件并交付
- **Status:** complete

### Phase 28: Local-Ready to Production-Ready Engineering Gate
- [x] 明确“本地可运行”和“生产可部署”的差异
- [x] 核对 Vercel Functions、环境变量与部署生命周期要求
- [x] 核对 Supabase 生产检查、migration、Data API grant 与 RLS 要求
- [x] 整理开发团队需要改造的代码区域、配置文件和验收门禁
- [x] 给出无需结合当前仓库即可复用的判断方法
- **Status:** complete

### Phase 29: Developer Deployment Readiness Action Guide
- [x] 恢复全局 planning 上下文并读取相关 skills
- [x] 检查当前 Web、Realtime、Supabase、Vercel 代码边界
- [x] 判断 UniSpeaking 当前目标生产架构类型
- [x] 核对当前 Vercel/Supabase 生产要求与近期变更
- [x] 编写面向队友本地完整版本的部署前置与改造行动指南
- [x] 检查文档结构、敏感信息、链接和可执行性
- [x] 更新根目录全局记录并交付
- **Status:** complete

### Phase 30: DashScope Temporary API Key Test Assessment
- [x] 恢复全局规划上下文并定位当前 Realtime 密钥读取位置
- [x] 核对百炼临时 API Key 的生成接口、有效期范围和权限继承规则
- [x] 区分本地 `.env`、Supabase Edge Function Secrets 与 Vercel 前端配置
- [x] 核对 Supabase Secret 更新生效方式并形成分级测试建议
- [x] 更新全局记录并交付结论
- **Status:** complete

### Phase 31: Local DashScope Temporary Key Implementation
- [x] 恢复上下文并确认本地 Python Demo 的 Realtime 代理入口
- [x] 确定“后端动态签发 600 秒临时 Key、前端无感、可切回永久 Key”的本地方案
- [x] 编写设计说明与测试先行实施计划
- [x] 编写失败测试并实现临时 Key 签发模块
- [x] 接入本地 SDP 代理并更新本地环境配置
- [x] 更新 README、运行完整验证并交付启动步骤
- **Status:** complete

### Phase 32: Local Temporary Key 401 Diagnosis
- [x] 读取运行中后端日志并稳定复现 502/401
- [x] 安全检查本地主 Key 类型、长度与空白字符
- [x] 绕过临时签发模块，使用同一主 Key 直接探测 Realtime 鉴权
- [x] 对照百炼临时 Key、API Key 升级与 401 官方说明
- [x] 确认根因位于当前主 Key 无效，而非 TTL、前端或临时签发代码
- **Status:** complete

### Phase 33: Per-User Realtime Usage Attribution Design
- [x] 恢复全局 planning 上下文并依次读取三份根目录记录
- [x] 概览 `7.15` 文件并检查 request ID / `task_uuid` 截图
- [x] 复核当前 WebRTC、Supabase 会话表和 Realtime 事件处理边界
- [x] 核对百炼 `session.created`、`response.done.usage`、模型监控与推理日志官方说明
- [x] 评估 `session.id -> task_uuid` 事后归因路径及其一致性、安全和延迟风险
- [x] 形成实时采集、日志对账和替代方案的分层建议
- [x] 更新全局 planning 记录并交付方案
- **Status:** complete

### Phase 34: Local Session Identity Attribution Validation
- [x] 恢复全局 planning 上下文并复核本地 Demo 会话生命周期
- [x] 将范围锁定为固定测试用户、捕获 `session.created.session.id`、结束后输出文本
- [x] 编写最小设计说明与测试先行实施计划
- [x] 先写失败测试，再实现会话标识校验、绑定和文本输出
- [x] 接入后端创建/绑定/关闭接口及浏览器 `session.created` 事件
- [x] 更新本地运行说明并完成完整验证
- **Status:** complete

### Phase 35: Session Identity to User Usage Flow Documentation
- [x] 停止本地 Demo 后端和静态前端
- [x] 核对真实会话的用户、本地会话、provider session 和结束记录
- [x] 确认 `provider_session_id` 与千问云 `task_uuid` 实测完全一致
- [x] 在 `7.15` 写入从开启会话到用户用量归属的单一流程说明
- [x] 更新根目录全局 planning 记录
- **Status:** complete

### Phase 36: IELTS Speaking Special Training Design
- [x] 恢复全局 planning 上下文并读取 `7.20/雅思口语特训场景方案调研与设计.md`
- [x] 核对 IELTS Speaking 官方结构、时长和评分边界
- [x] 检查现有场景训练、Realtime、会话身份与数据存储的可复用边界
- [x] 在不考虑部署上线的前提下，对比后端 JSON、关系数据库和可迁移双层方案
- [x] 梳理 2-3 种产品与技术实现方案并给出推荐
- [x] 与用户确认 MVP 目标和关键产品取舍
- [x] 写入完整方案、题库对比、组卷流程、状态流转、Realtime 接入和迭代计划
- [x] 自检方案的一致性、可实施性、范围和验收口径
- [x] 用户已确认进入实施阶段，并要求编写详细计划与实现 Demo
- **Status:** complete
- **Scope note:** 本阶段只做本地开发期的产品与技术方案；不讨论部署、上线、RLS、生产运维。题库确定由开发人员维护后端 JSON 文件。

### Phase 37: IELTS Speaking Interactive Demo
- [x] 将已确认设计转换为详细 TDD 实施计划
- [x] 实现并校验后端 JSON 题库契约
- [x] 实现随机组卷、Part 2/3 主题关联和快照
- [x] 实现完整模考/专项练习状态机
- [x] 实现 Demo 会话控制器、计时、记录和反馈
- [x] 集成 IELTS 路由、入口、Part 2 全题卡和响应式 UI
- [x] 运行完整自动化回归、语法检查和浏览器验收
- [x] 补充 README 并更新全局 planning 记录
- **Status:** complete
- **Scope note:** Demo 集成到 `7.14/UniSpeaking_Complete_UI`，使用浏览器内编排和语音合成作为未来后端/Realtime 适配器的可替换 Demo；不改生产部署链路。

### Phase 38: IELTS Microphone Answer Interaction
- [x] 与用户确认“开始 → 暂停 → 继续 + 独立结束本轮”的交互
- [x] 确认采用浏览器 Web Speech API 实时转写并保留文字降级
- [x] 写入并复核麦克风交互设计规格和 TDD 实施计划
- [x] 实现浏览器语音识别适配器、权限请求和资源释放
- [x] 实现单轮回答状态、计时、转写追加、暂停/继续和降级
- [x] 将 Part 1–3 与完整模考回答区替换为统一麦克风面板
- [x] 保持 Part 2 准备阶段无麦克风、回答阶段完整题卡置顶
- [x] 完成自动化回归、桌面/移动端和权限拒绝浏览器验收
- **Status:** complete
- **Scope note:** 原始音频不上传、不保存；浏览器转写不用于发音评估，不接入生产 Realtime 或部署链路。

## Key Questions
1. `7.8/产品设计书初稿写作框架.docx` 中第 7、8、9 模块的标题和要求分别是什么？
2. 昨日 `7.7` 的哪些调研、用户画像、产品分析、产品图谱内容应被复用到 7/8/9 模块？
3. 用户希望最终交付形式是直接修改原 Word 文档，还是先输出独立草稿供确认？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 先建立根目录规划文件，再深入阅读材料 | 用户明确要求维护 `task_plan.md`、`findings.md`、`progress.md`，且任务涉及多文件、多阶段写作 |
| 在写正文前先进行上下文探索和写作设计确认 | `superpowers:brainstorming` 要求先探索、提出方案并获得确认，避免方向偏差 |
| 将模块 7/8/9 作为“承接闭环”撰写 | 三个模块分别承接学习留痕、付费边界和 MVP 可验证结果，能自然衔接前文自由对话与场景广场 |
| 输出独立 Markdown 草稿而非直接修改 Word | 用户明确要求先在 `7.8` 写 Markdown 供确认 |
| 商业化板块采用分层人民币定价模型 | 新增竞品调研显示同类产品以免费体验、订阅、高级场景、测评报告和 B 端组合商业化；用户要求使用人民币并给出初步定价理由 |
| 验收模块按自由聊天核心入口重新组织 | 新增自由聊天设计明确其目标是低压力连续开口，不是评分纠错，因此验收需覆盖实时转写、打断、翻译、朗读、难度适配和性能指标 |
| 验收模块按三类口语训练入口继续扩展 | 场景体系 Proposal 明确普通自定义场景和 IELTS/英文面试等专业场景不能混同，因此验收需覆盖入口分流、学-读-说、专业模块边界和专业训练资产沉淀 |
| 个人主页原型采用桌面端仪表盘式布局 | 适合产品汇报展示，能同时呈现学习记录、反馈沉淀、历史场景、设置和高级场景入口 |
| 客户端原型采用移动 App 个人中心结构 | 用户要求做成客户端版本；手机端需要更突出顶部个人卡、关键数据、快捷入口、最近练习和底部导航 |
| planning-with-files 记录统一维护在项目根目录 | 用户明确指出全局 planning 应写入 `/Users/mac/Documents/七牛云`，后续不应只写入单个日期或 Demo 子目录 |
| 7.9 Realtime Demo 主方案选择 Qwen-Omni-Realtime | 阿里云百炼公开文档明确支持 Realtime、WebSocket/WebRTC、音频输入输出、文本事件和会话配置，适合快速落地 Demo |
| 豆包实时语音作为备选并标注需要实测 | 当前未找到与 Qwen-Omni-Realtime 同等清晰的公开 API 文档，协议、权限、地域、事件和延迟均需账号权限确认 |
| OpenSpec 规约采用单 change 多 spec 结构 | 本次目标是让后续 AI 可直接执行开发，因此将 proposal、design、tasks 与链路/事件/验收三个 spec 放在一个自包含 change 中 |
| Realtime Demo 实现路径锁定为 WebSocket 代理链路 | 用户要求后续 AI 不再判断抉择，因此不把 WebRTC 和豆包作为实现选项，只保留为本期明确不做 |
| Realtime Demo 技术栈锁定为 Vite + React + TypeScript、Express + ws + TypeScript | 避免后续实现阶段在前后端框架上继续选择，保持链路开发最小且可运行 |
| 点击开始立即结束的根因方向 | Qwen WebSocket 握手返回 400，响应体为 `BadRequest.IllegalEndpoint: Workspace endpoint is invalid.`；同时当前代码将 provider close 显示为 ended，导致用户看不到真实错误 |
| Phase 14 修复策略 | 不掩盖供应商配置/端点问题；先让应用准确显示 `provider_ws_connect_failed` 和供应商 400 响应体，并关闭 fatal 错误会话，避免 UI 误导为正常结束 |
| 点击后黑屏的当前根因方向 | 后端到 Qwen 链路已通，点击后前端卡在 `requesting_mic`；黑屏更可能是浏览器或系统麦克风授权/采集层未完成，而不是供应商配置问题 |
| React null ref 崩溃根因 | React state updater 可能延迟执行，不能在 updater 内读取稍后会被置空的 `currentAiMessageRef.current` 或 `tempUserMessageRef.current`；应先捕获局部 `updated` 消息再传入 updater |
| AI 不显示回复的根因 | Qwen 在 text+audio 输出模式下返回 `response.audio_transcript.delta/done`，原代码只监听 `response.text.delta/done`，导致 AI 回复文本被当作未处理事件丢掉 |
| 7.10 模型能力测试组织方式 | 采用能力清单管理测试范围，以受控 Prompt 对照为主，每项重复执行并补充少量压力测试；结论区分模型直出、Prompt 改善、效果不稳定、必须工程实现和暂无法判断 |
| 7.10 测试文档结构 | 使用一个综合 Markdown 文档承载方法、Prompt、20 条用例、记录模板和决策规则，便于直接执行和持续填充结果 |
| 7.10 文档不执行 Git 提交 | 本轮用户要求的是写入测试想法和用例，且此前 Git 流程明确要求不要代为提交；仅保留工作区文件供用户复核 |
| 7.10 测试手册第二版 | 将原 20 条摘要用例扩展为 36 条可照读用例，重点增加指令遵循、语义理解、上下文、稳定性、幻觉和响应性能测试，并保留链路归因 |
| 第二版结果记录方式 | 将结果表从长手册中拆为独立 Markdown，提供 36 条总表及延迟、一致性、20 轮、六事实专表，方便测试人员直接填写 |
| 7.10 Demo 配置安全边界 | 真实 DashScope Key 只能写入 `7.10/demo测试/UniSpeaking/.env`，不得回显、提交或写入浏览器静态源码；先核对项目是否具备后端代理 |
| 周会汇报主线 | 按“产品方向收敛 -> 产品设计落地 -> Realtime 链路验证 -> 模型能力测试”叙述，突出可交付结果、问题修复和下周可验证动作 |
| 7.13 总体架构文档方法 | 以 `UniSpeaking产品计划书_v2.md` 为内容事实源，以“码上好戏”架构基线 DOCX 为结构与视觉参考；先提炼模板并确认框架，再生成文档 |
| 7.13 参考模板取舍 | 继承“工程基线、表格驱动、职责与非职责并列、阶段演进与验收闭环”的信息结构；不照搬其全部直接格式化和缺少标题样式的问题，最终文档使用规范标题层级与可维护样式 |
| 7.13 文档受众 | 用户选择“产品、AI、技术联合评审基线”；文档需要同时解释产品拆分、AI 能力责任和工程验证链路，不下沉为接口字段或数据库表手册 |
| 7.13 文档组织方式 | 用户选择方案 3“产品-AI-技术一体化基线型”，正文按决策基线、六类架构视图、三条核心流程、MVP 实施与验收四部分组织 |
| 7.13 最终交付格式 | 同时交付 Markdown、DOCX 和 7 张可复用 PNG 架构图；DOCX 使用 A4、规范标题、静态目录、深蓝标题与浅蓝表头，并通过 25 页逐页渲染检查 |
| 7.14 集成部署方案 | 使用 `UniSpeaking_Complete_UI` 作为 Vercel 前端，将 Demo 浏览器 Realtime 逻辑模块化；Python 后端能力迁移为 Supabase Edge Functions，状态与记录迁移至现有空 Supabase 项目 |
| 7.14 本轮范围 | 用户在实施中明确只考虑 Web 端；iOS、Android 不进入本轮代码、部署和验收 |
| 7.14 Supabase 鉴权 | 新版 Publishable Key 只使用 `apikey` 头；Edge Function 关闭旧式 `verify_jwt` 并在函数内匹配 Supabase 注入的公开 Key，同时校验 Origin、限流和会话期限 |
| 7.14 生产部署 | Vercel 项目 `unispeaking-web` 最新 Deployment `dpl_FUKPRUpRhLyXop72QcfBsFaMmLp2` 已 READY，正式域名 `https://unispeaking-web.vercel.app`；Supabase `realtime-gateway` 版本 1 已 ACTIVE |
| 7.14 完整迁移上线手册 | 以当前已跑通的 Vercel Web + Supabase Edge Function/Postgres 为参考基线，同时增加后端形态判断；完整本地后端只有满足无状态、短请求、无本地持久化依赖时才直接迁入 Functions |
| 用户用量归因主路径 | 以 `response.done.response.usage` 的逐响应采集为主，保存 `session.created.session.id` 作为百炼会话 ID；`task_uuid` 推理日志只用于异步对账和审计 |
| 用户用量身份边界 | 必须由服务端在创建内部会话时绑定可信 `user_id`，不能仅依赖当前 `conversation_id`、`client_hash` 或浏览器上报值作为付费/配额依据 |
| 本地归因验证实现范围 | 固定 `DEMO_USER_ID`，浏览器捕获 `session.created.session.id` 后绑定到后端会话，结束时只写最新一份文本供人工与 `task_uuid` 比对；暂不查询日志或统计 usage |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `git status --short` 报错：当前目录不是 git 仓库 | 1 | 记录为环境事实；后续不依赖 git 提交，直接在项目根目录维护规划文件 |
| 7.10 Demo `.venv` 安装依赖失败：无法解析 `pypi.org` | 1 | 不重复安装；确认是当前执行环境网络/DNS受限，正在检查本机已有 Conda/uv/其他 Python 环境是否带 `aiohttp` |
| 本机所有已发现 Python 环境均缺少 `aiohttp` | 1 | 已排查系统、pyenv、bundled Python、Conda/uv/cache；配置完成，后端启动需用户在普通联网终端完成一次 pip 安装 |
| `python -m http.server 8080` 报 `PermissionError: Operation not permitted` | 1 | 端口空闲，根因是当前 Codex 沙箱禁止监听端口；不重复尝试，交由用户普通终端启动 |
| Vercel 首次部署参数校验失败 | 1 | 根据插件返回的必填字段改用 `target`、`name`、`files[{file,data}]`，限定上传 Web 项目 21 个文件后生产部署成功 |
| Supabase 健康接口 `model_configured:false` | 1 | 网关和数据库均正常；新项目缺少百炼 Secret，插件不支持 Secret 写入且控制台需要登录，已记录为唯一人工操作 |
| 本机未安装 `supabase`、`vercel` CLI，无法直接运行本地 `--help` | 1 | 不安装或猜测版本；以已读取的 2026-07 官方文档命令为手册依据，并在文档要求执行者安装后先运行 `--version`/`--help` |
| Vercel 域名重定向旧路径 `/docs/domains/deploying-and-redirecting` 返回 Page Not Found | 1 | 根据页面提示改用当前路径 `/docs/domains/working-with-domains/deploying-and-redirecting`，不重复请求旧路径 |
| zsh 循环使用变量名 `path` 覆盖特殊 `PATH` 数组，导致循环内 `curl/sed/rg` command not found | 1 | 保留已成功的 `git ls-remote` 结果；后续改用普通变量名 `item` 并重新执行未完成的只读检查 |
| 组合 `rg` 检索因第一段标题模式未命中而提前停止，项目检索未执行 | 1 | 拆成两个相互独立的只读检索并成功获取架构参考和项目匹配结果 |

## Notes
- 根目录：`/Users/mac/Documents/七牛云`
- 昨日材料目录：`/Users/mac/Documents/七牛云/7.7`
- 今日任务文档：`/Users/mac/Documents/七牛云/7.8/产品设计书初稿写作框架.docx`
- 当前不直接改写 Word 正文；先完成阅读、脑暴和写作设计确认。
- 草稿文件：`/Users/mac/Documents/七牛云/7.8/个人主页、商业模式、验收标准.md`
- 自由聊天模块设计：`/Users/mac/Documents/七牛云/7.8/自由聊天模块产品设计.docx`
- 场景体系 Proposal：`/Users/mac/Documents/七牛云/7.8/AI口语训练场景体系Proposal.md`
- 个人主页原型：`/Users/mac/Documents/七牛云/7.8/个人主页原型.html`
- 个人主页原型图：`/Users/mac/Documents/七牛云/7.8/个人主页原型图.png`
- 个人主页客户端原型：`/Users/mac/Documents/七牛云/7.8/个人主页客户端原型.html`
- 个人主页客户端原型图：`/Users/mac/Documents/七牛云/7.8/个人主页客户端原型图.svg`
- 个人主页客户端 PNG：`/Users/mac/Documents/七牛云/7.8/个人主页客户端原型图.png`
- 今日日报：`/Users/mac/Documents/七牛云/7.8/占付龙—7.8日报.md`
- 7.9 Realtime 语音 Demo 开发设计文档：`/Users/mac/Documents/七牛云/7.9/国内端到端Realtime语音Demo开发设计文档.md`
- OpenSpec Realtime Demo change：`/Users/mac/Documents/七牛云/openspec/changes/realtime-voice-demo-chain`
