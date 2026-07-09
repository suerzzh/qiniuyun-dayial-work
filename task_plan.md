# Task Plan: 7.8 产品设计书模块 7/8/9 写作

## Goal
基于 `7.7` 昨日产出和 `7.8/产品设计书初稿写作框架.docx`，为我负责的产品设计书 7、8、9 模块形成可交付内容，并持续维护规划记录。

## Current Phase
Phase 17: Realtime Voice Demo AI Reply Event Mapping Fix

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

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `git status --short` 报错：当前目录不是 git 仓库 | 1 | 记录为环境事实；后续不依赖 git 提交，直接在项目根目录维护规划文件 |

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
