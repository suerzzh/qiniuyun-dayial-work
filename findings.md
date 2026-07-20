# Findings & Decisions

## Requirements
- 用户明确收窄 7.20 范围：暂不考虑部署上线、Supabase 生产配置、RLS 或运维问题，这些属于后话。
- 用户明确指出题库存后端目录 JSON 还是关系数据库尚无定论，需要先根据本地开发阶段的真实维护需求做选型，不能预设答案。
- 用户确认当前题库由开发人员直接修改文件维护，因此本地开发阶段正式选择后端 JSON，不引入关系数据库。
- 用户在 2026-07-20 要求基于 `7.20/雅思口语特训场景方案调研与设计.md`，把当天要解决的问题完整梳理并形成可落地方案；本轮目标是方案设计，不直接开发完整功能。
- 7.20 预期交付覆盖：雅思口语完整产品流程、题库技术选择、Part 2/3 关联、组卷逻辑、后端状态控制、Realtime 复用、核心模块和 MVP 分期。
- 用户在 `/Users/mac/Documents/七牛云` 下开展工作。
- `7.7` 是昨天的工作产出，需要作为今天写作的背景材料。
- `7.8` 中的文档是今天要完成的任务。
- 用户负责产品设计书中的 7、8、9 模块，希望我帮助撰写这些内容。
- 用户明确要求调用 `superpowers:brainstorming` 进行头脑风暴。
- 用户明确要求使用 `$planning-with-files` 制定开发/写作计划，并维护 `task_plan.md`、`findings.md`、`progress.md`。
- 用户在 2026-07-09 明确纠正：`planning-with-files` 的输出应是整个项目全局记录，位置是 `/Users/mac/Documents/七牛云` 根目录；后续不要只写入具体 Demo 或日期子目录。
- 用户在 2026-07-10 要求开展非正式的大模型性能与能力边界测试，重点验证某项产品能力能否由 Realtime 模型直接实现、能否通过修改提示词实现，或必须由工程能力实现；测试想法和用例最终写入 `7.10`。
- 用户在 2026-07-13 要求为 UniSpeaking 设计可落地的空项目骨架，写清完整项目框架、目录、必备文件和扩展预留；正式交付写入 `7.13`，全局 planning 继续只维护在根目录。

## Research Findings
- 7.20 原始文档的 7 个问题可归并为三条主线：考试体验（练习/模考与 Part 流程）、确定性编排（题库/组卷/状态机）、能力与数据闭环（Realtime 复用/记录/评分）。
- 初步设计原则：考试流程不能只交给 Prompt；题目、计时、Part/题号切换、完成条件和快照需要由确定性应用状态持有，模型只承担考官话术、有限追问和语音交互。
- 题库选型最终结论：MVP 不需要 RAG；在“开发人员改文件、本地开发、不考虑上线”的约束下，结构化后端 JSON 比关系数据库更合适。之前偏向数据库的初步判断已被用户补充约束推翻。
- Part 2 与 Part 3 应通过稳定的 `topic_cluster`/主题关系绑定；组卷单位应是可版本化的完整试卷快照，而不是运行时让模型自由生成题目。
- 当前最直接的 Web 复用基线位于 `7.14/UniSpeaking_Complete_UI`：已有 `src/realtime/realtime-client.mjs`、Realtime 事件状态、会话 API、Supabase Edge Function 与会话表 migration；麦克风、WebRTC/DataChannel、字幕/音频播放和开始/结束会话可复用。
- 当前普通场景训练 `src/views/training.mjs` 是“词语→句子→模拟→诊断”的静态流程，不适合直接承载 IELTS 考试流程；IELTS 应使用独立路由、独立 session controller 和独立视图，同时复用底层 Realtime transport。
- 现有 `src/realtime/realtime-state.mjs` 只处理连接/收听/思考等通用语音状态，不能表达 `part/current_item/preparation/countdown/answering/completed` 等考试领域状态；需要将“连接状态”与“考试状态”拆开。
- `architecture-copilot` 的 AI 对话参考明确指出：MVP 宜采用供应商 API + 薄编排层、无 RAG；常见反模式包括不记录用量、把会话状态全塞在不可靠的客户端、信任模型自由编排。其升级信号是规模、成本、P99 延迟和会话一致性问题，而不是为了架构完整度提前加组件。
- IELTS 官方当前说明：Speaking 总时长 11–14 分钟，共 3 个 Part；Part 1 为 4–5 分钟的熟悉话题问答；Part 2 含 1 分钟准备、1–2 分钟长回答，Part 总计 3–4 分钟，并可有 1–2 个同题收尾问题；Part 3 为 4–5 分钟，围绕 Part 2 相关主题做更一般、抽象和深入的讨论。
- IELTS 官方 7 页样题中，示例 Part 1 有两组共 8 个主问题，Part 2 为 1 张题卡 + 2 个 rounding-off questions，Part 3 示例框架有 3 个主问题并展示额外追问；这些是样题而非固定法定题数。因此产品配置应存 `target_duration`、题组和追问上限，而不是声称正式考试永远固定为 8/1/3 题。
- 官方评分维度为 Fluency and Coherence、Lexical Resource、Grammatical Range and Accuracy、Pronunciation，且官方说明由认证考官综合评估。UniSpeaking 可输出“AI 练习参考分/区间 + 证据 + 不确定性”，不得宣称等同官方成绩。
- Supabase 的生产安全、RLS、Data API grants、迁移和部署不属于本轮讨论范围，保留为后续上线阶段事项。
- 项目既有 `7.8/AI口语训练场景体系Proposal.md` 已明确：IELTS 独立于普通场景广场，支持 Part 1、Part 2、Part 3 专项训练与完整模拟，并把“只做完整模考”作为被放弃方案；本轮除非用户明确改变，应继承这一产品决策。
- 根目录 `UniSpeaking产品计划书_v2.md` 与 `7.13/UniSpeaking产品-AI-技术总体架构设计基线.md` 已将 IELTS 定位为第三阶段付费专业场景，要求独立题型、评价规则与合规声明，复用实时底座但不复用通用反馈规则。
- 当前 UI 已有 IELTS 入口与会员文案，但 `src/views/membership.mjs` 中“官方标准打分报告”表述与既有“非官方练习参考”边界冲突，后续设计应改成“参考 IELTS 维度的 AI 练习报告”，避免误导。
- 题库存储与考试流程控制必须拆成两个决策：即使题库存 JSON，也可以由后端确定性状态机控制；JSON 不等于 Prompt 全控。候选应重列为后端 JSON、关系数据库、统一接口下可切换存储三种，而不是把存储选择和编排方案捆绑。
- 推荐方案的关键分工：前端负责展示、计时视觉、用户操作和媒体；后端负责权威考试状态、组卷、快照、推进条件和持久化；Realtime 模型负责考官话术、发问、有限追问和语音交互；异步评估模块负责考后练习反馈。
- 推荐使用同一 `ExamSession` 内核支持 `practice_part` 与 `full_mock` 两种模式：练习模式允许暂停、重试、跳过并提供即时提示；完整模考模式不允许重试/跳过、不在过程中教学纠错，反馈统一在结束后生成。
- 题库存储对比结论：后端 JSON 对小规模、低频、开发人员维护的本地版本最简单；关系数据库只在多人维护、动态上下架、查询统计和频繁更新时占优。当前采用 JSON，并通过 `QuestionBankRepository` 隔离存储细节。
- JSON 题库仍应放在后端域内，前端不能直接把题库当作可修改状态；建议按 Part 分文件并由只读 `QuestionBankRepository` 加载、校验和查询，避免业务代码散落读取文件路径。
- 建议目录形态：`backend/ielts/question_bank/manifest.json`、`part1.json`、`part2.json`、`part3.json`；`manifest.json` 保存题库版本和启用文件，三个 Part 文件保存题组、题卡、主题关联和状态。
- 数据库迁移触发条件不是“准备部署”本身，而是出现非开发人员维护、频繁上下架、多人并行编辑、跨版本查询、复杂运营筛选或题量大到文件评审困难；在这些信号出现前保持 JSON。
- 用户选择题目来源方案 A：所有计划内主问题、Part 2 cue card、Part 2 收尾问题和 Part 3 核心问题均来自后端 JSON；AI 不得临场生成、替换或改写这些题目的语义。
- AI 的动态权限仅限受控追问：基于用户刚才的回答做自然澄清或展开，不能切换主题，不能引入题库外的新主问题，且每道题的动态追问次数必须有上限。
- 组卷完成时应保存 `question_id + question_version + rendered_text` 快照；后续即使开发人员修改 JSON，本次训练仍能复现当时实际使用的题目。
- 用户选择考试流程控制方案 A：后端 `ExamStateMachine` 是 Part、题号、计时阶段、允许操作和完成条件的唯一权威；前端只根据后端状态展示，Realtime 模型不自行决定切题或结束。
- Part 2 必须按 IELTS 规范显示抽中的完整 cue card，不能只由 AI 口述。页面至少展示主题句、全部 `You should say` 提示点和最后的 `and explain...` 要求。
- Part 2 状态建议固定为：`part2_intro -> part2_preparing(60s) -> part2_answering(最长120s) -> part2_rounding_off -> part3_intro`。题卡在 60 秒准备和正式回答期间都保持可见；AI 可朗读引导语，但视觉题卡是必要信息载体。
- 前端倒计时只做视觉同步，后端以状态进入时间和截止时间判断真实结束，避免页面计时漂移决定考试流程。
- 用户在 Visual Companion 中最终选择 Part 2 布局 B“考试桌面·全宽题卡”：顶部显示 Part/阶段与倒计时，中部用全宽区域展示完整 cue card，下部承载准备笔记和麦克风/回答状态。
- 选择 B 的设计含义：考试任务信息优先于 AI 考官形象；Part 2 页面不占用主要空间展示虚拟考官，避免挤压题卡阅读区域。
- 用户选择 Part 2 笔记方案 A：60 秒准备阶段允许编辑数字笔记；回答阶段继续展示题卡与笔记，但笔记切换为只读锁定，避免边打字边回答。
- Part 2 回答结束后，笔记作为本次考试快照的一部分与题卡、转写、时间信息一并保留，供考后复盘使用；考试过程中不对笔记内容给提示或纠错。
- 用户选择模式操作方案 A：完整模考严格执行考试流程，不允许暂停、跳题或重试；用户只能确认退出整场，退出后状态记为 `abandoned`/未完成，不生成完整模考结论。
- Part 1/2/3 专项练习采用训练型操作：允许重试当前题、结束当前题并进入下一题；这些操作只影响专项练习，不得复用到完整模考。
- “暂停”需要区别处理：完整模考无暂停；专项练习可在题目之间暂停，但不建议在 Part 2 的 60 秒准备或计时回答中冻结倒计时，否则会破坏训练的时间感。
- 用户选择完整模考组卷方案 A“时间预算 + 配置上限”：Part 1 和 Part 3 以官方规定的 Part 时长为主约束，后端配置默认题组、最小覆盖数和最大题数；状态机在满足最小覆盖后按时间预算推进，模型不决定考试题量。
- Part 2 保持固定结构：1 张 cue card、60 秒准备、1–2 分钟长回答，再从 JSON 中依配置执行 0–2 个收尾问题。Part 1/3 的“默认题数”是产品组卷参数，不对外声称为 IELTS 固定法定题数。
- 为保证可复现，组卷时就保存按顺序排列的候选题快照和时长/题量配置；考试过程只是决定执行到快照中的哪一题，不再临时抽题或由 AI 自由续卷。
- 用户选择 Part 2/Part 3 关联方案 B“主题簇关联”：Part 2 题卡和 Part 3 题组在 JSON 中都声明稳定的 `topic_cluster`，组卷器只从相同主题簇的兼容 Part 3 题组中选择。
- `topic_cluster` 是题库编辑时就确定的结构化关系，不由 AI 在考试现场做语义匹配。若抽中的 Part 2 主题簇没有任何可用 Part 3 题组，组卷应在开考前失败并重新选题，不应在考试中临时生成或换题。
- 主题簇方案相比一对一固定套题能提高组合多样性，相比 AI 动态匹配又保留了可测试、可追踪和可复现性。
- 用户选择题目文字展示方案 A：完整模考中 Part 1 和 Part 3 只由 AI 考官通过语音提问，不显示当前问题题卡；专项练习中可显示当前问题文字。Part 2 作为题型规则例外，两种模式都必须展示完整 cue card。
- 完整模考中“不显示 Part 1/3 题目卡”已确认，但实时考官字幕和用户转写是否也隐藏需要单独决策；它们会影响仿真度、易用性和对考生的视觉提示程度，不应从“不显示题卡”自动推导。
- 专项练习以学习可理解性为主，Part 1/3 可显示题目文字和转写；这些 UI 开关属于 `mode_policy`，不能由 Realtime 模型自行更改。
- 用户将完整模考字幕政策定为“默认隐藏，会话中可随时开启”；字幕是会话级 UI 辅助开关，不会暂停计时、改变题目或推进考试状态。
- 完整模考 Part 1/3 即使开启字幕，也不显示独立问题卡；只将考官已经实际说出的内容和用户转写作为实时字幕呈现。系统可保存 `captions_used`/`captions_enabled_at` 等会话偏好记录，在考后复盘中标注使用过字幕辅助，但不因此改变练习结果的计算逻辑。
- 用户选择 MVP 试卷类型方案 A：只支持随机组卷，不同期实现人工固定试卷、试卷编辑或发布能力。
- “随机”只发生在开考前的 `PaperAssembler` 阶段；一旦创建 `paper_snapshot`，题目、顺序、版本、主题关联和配置就冻结，考试过程不得再随机换题。保存完整快照比只保存随机种子更可靠，因为 JSON 题库后续可能被开发者修改。
- 固定试卷是后续扩展点：可未来在组卷层增加 `paper_template`，但不改动 `ExamStateMachine` 和快照数据结构。
- 用户选择重复题目回避方案 A：当前试卷内的 `question_id`/`card_id` 必须唯一，同时尽量避开用户最近 5 场已完成训练中使用过的题目。
- 历史回避是软约束：候选池不足时，`PaperAssembler` 可从最早一场开始逐步释放历史题，直到可以组卷；但当前试卷不重复、Part 2/3 `topic_cluster` 匹配和题目启用状态始终是硬约束。
- 试卷快照应保存实际应用的回避策略和放宽级别，便于解释“为什么这次又抽到某题”并对组卷逻辑做确定性测试。
- 用户选择难度适配方案 A：完整模考不根据用户当前水平降低、改写或加难题目，统一从当前启用的标准题库中组卷，保持模考之间的一致性。
- Part 1/2/3 专项练习可使用 `foundation`/`standard`/`advanced` 等产品训练标签筛选题目；这些标签只表示训练复杂度，不与 IELTS 0–9 分或任何官方分数段建立直接映射。
- Realtime 模型可依用户回答决定是否使用被允许的有限追问，但不得改写快照中的主问题；“回答水平影响追问”不等于“改变整张试卷难度”。
- 用户选择 MVP 考后反馈方案 A：按 Fluency and Coherence、Lexical Resource、Grammatical Range and Accuracy、Pronunciation 四个 IELTS 参考维度生成结构化练习反馈，每维提供表现证据、优点和下一步改进建议，但不输出精确 0–9 分。
- 反馈产品文案必须使用“AI 练习反馈”“参考 IELTS 维度”等边界清晰的表述，不得使用“官方评分”“官方标准打分报告”或暗示与认证考官结果等价的语言；现有会员页的冲突文案应在后续 UI 实施中改正。
- 发音维度必须依赖可靠的音频或声学证据；如果 MVP 未采集、保存或分析满足要求的用户音频，报告中必须显示“证据不足，未评估”，不得根据 ASR 转写文本猜测发音。
- 用户选择原始录音方案 B：每场开考前提供“保存我的回答录音”选项，默认关闭，只有用户主动开启后才按回答分段保存音频。
- 录音选项在开考时写入 `session_policy.recording_enabled`，考试中不能补录之前的音频；未开启时仍保存题目快照、转写、回答时间和状态事件，并将发音反馈标为未评估。
- 用户明确表示后续未决内容按推荐方案收敛，可不再对每一个小决策逐项询问；仍需在最终书面方案中清楚列出推荐假设、边界和待用户复核项。
- 已将收敛后的完整方案写回 `7.20/雅思口语特训场景方案调研与设计.md`，文档包含官方规则边界、三条候选路线、两类产品模式、完整流程、JSON 示例、组卷算法、状态机、Realtime 复用、数据记录、反馈边界、异常策略、MVP 做/不做、验收和 ADR。
- 方案自检通过：4 个 JSON 代码块都能正常解析，18 个 Markdown 代码围栏成对，必需模块/状态/政策术语均存在，未发现 TODO、TBD 或待定占位。
- 自检后的一致性口径：Part 1/3 完整模考不显示独立题卡，但字幕作为用户可开启的 UI 辅助例外；Part 2 始终显示完整题卡；原始录音默认不保存；完整模考不做难度适配、暂停、跳题或精确估分。
- 7.9 Demo 已具备浏览器麦克风输入、Qwen-Omni-Realtime WebSocket 连接、用户转写、AI 文本与音频回复、结束通话及调试日志，可作为 7.10 模型能力测试载体。
- 本轮测试需要严格区分三类结论：模型原生可实现、提示词可稳定实现、提示词无法稳定保证且需要工程实现。否则容易把音频链路、事件处理或前端状态问题误判为模型能力不足。
- 当前工作树已有用户改动（`.DS_Store`、Obsidian workspace、`7.9/UniSpeaking产品计划书_v2.md`），与本轮文档设计无关，应保留不动。
- 当前 Demo 基线系统提示词已约束：简单自然英语、每次 1-3 句、多追问、少讲课、不评分、不逐错纠错、用户卡住时给轻提示、用户用中文时帮助回到英语。
- 当前会话配置为 `text + audio`、输入转写开启、`server_vad`、静音阈值 800ms；这些参数会影响轮次切分、首包延迟和对话连续性，测试时应固定并记录。
- OpenSpec 明确本期不要求实现用户打断 AI 播放，因此“打断是否成功”不能直接归因为模型能力；需要单独标记为模型协议能力、后端转发和前端播放控制共同决定的链路能力。
- `7.10` 目录已存在 `测试用例初稿.md`，后续应先读取并保留已有内容，再决定扩写或新建文档。
- 用户已确认 7.10 首轮只覆盖当前 Demo 的自由对话核心能力，不把评分、完整场景训练、学习报告等未来功能纳入首轮。
- `7.10/测试用例初稿.md` 当前为空，可以在方案确认后直接作为主测试文档使用。
- 用户确认采用组合测试法：能力清单负责覆盖范围，受控 Prompt 对照负责能力归因，少量自由压力测试负责发现意外边界。
- 用户确认测试分层：P0 最小提示词判断模型原生表现，P1 当前产品提示词判断现方案表现，P2 仅用于 P0/P1 不稳定项；每组重复 3 次，并将链路异常单独归因。
- 用户确认首轮能力范围：对话策略、上下文记忆、话题控制、学习者支持、产品边界、角色稳定；语音适应和压力测试作为单独辅助组，计划形成约 18-22 条具体用例。
- 用户确认结果记录采用 2/1/0/X 四档，三次有效执行按 3/3、2/3、0-1/3 判断稳定性，并按 ASR、VAD、模型/Prompt、音频链路、网络/供应商分别归因。
- 当前运行代码从 `shared/constants.ts` 引入 `SYSTEM_PROMPT` 并通过 `session.update.instructions` 发送给 Qwen，后续实际执行 Prompt 对照测试时需要切换该变量或提供测试配置，但本轮只编写测试文档，不修改代码。
- 已将确认后的测试设计写入 `7.10/测试用例初稿.md`，包含 16 条核心模型行为用例和 4 条语音/连续性辅助用例。
- 文档中的 P1 提示词已与 `7.9/realtime-voice-demo/shared/constants.ts` 当前 `SYSTEM_PROMPT` 对齐；P2 采用五组单变量增强规则，不允许一次叠加多个规则组。
- 文档静态自检通过：15 个连续编号章节、20 个唯一用例、16 个核心用例、4 个辅助用例、5 组 P2 规则、18 个成对代码围栏；未发现 TODO/TBD/含糊占位词或 `sk-` 形式值。
- 用户要求将 7.10 测试文档扩写得更多、更详细，重点关注大模型本身的性能；每条用例需要写清每一步怎么做、测试者说什么，并提供空白表格供用户记录结果。
- 第二版采用执行手册结构：先固定 P1 测当前产品表现，再对代表性用例做 P0/P2 对照；计划扩展为 36 条，其中 30 条模型行为用例、6 条模型性能与稳定性用例。
- 大模型性能不能只写“延迟快慢”：还应记录指令遵循率、相关性、上下文记忆准确率、事实一致性、重复率、语言难度适配、跨轮稳定性和相同输入的一致性。
- 第二版手册默认先用 P1 完成产品现状测试，P0 仅用于判断原生能力，P2 仅用于 P1 失败项；这比每条都跑三种 Prompt 更适合人工测试，也能保留能力归因。
- 已新增 `7.10/大模型性能测试执行手册.md`，包含 36 条逐步用例；已新增 `7.10/大模型测试结果记录表.md`，包含 36 条空白总表和延迟、一致性、20 轮、六事实记忆专表。
- 第二版静态校验通过：执行手册 15 个章节、36 个唯一用例，INS/DIA/SEM/CTX/ROB/PERF 各 6 条；每条均含操作步骤与判定信息；记录表 36 行与手册 ID 完全一致。
- 7.10 测试 Demo 位于 `7.10/demo测试/UniSpeaking`，当前文件只有 `webrtc_demo.html`、README、`.env.example`、`.gitignore`、LICENSE，没有 `package.json`。
- 该项目当前看起来是静态 WebRTC 页面，是否能安全读取 `.env`、是否需要本地后端交换 SDP，必须阅读源码后确认；真实 API Key 不得直接写入 HTML 或浏览器 JavaScript。
- 当前 Git 工作树显示 7.9 `realtime-voice-demo` 大量删除，这是本轮开始前已有状态，本轮不恢复、不删除、不修改这些用户改动。
- `7.10/demo测试/UniSpeaking/README.md` 说明预期架构为静态 WebRTC 前端 + Python 后端：后端读取凭据、创建会话并代理 SDP，前端调用 `http://127.0.0.1:8000`。
- `.env.example` 实际变量名为 `DASHSCOPE_API_KEY`、`BAILIAN_WORKSPACE_ID`、`BAILIAN_MODEL`；用户给出的 workspace 值需要写入 `BAILIAN_WORKSPACE_ID`，不是该项目未使用的 `DASHSCOPE_WORKSPACE_ID`。
- 项目 `.gitignore` 已包含 `.env` 和 `.vscode/.env`，适合保存本地真实凭据；HTML 不直接读取或暴露 Key。
- 当前目录缺少 README 引用的 `backend/requirements.txt`、`backend/app.py`、`backend/business_logic.py` 等后端文件，因此当前快照无法按 README 直接启动，需先在仓库搜索可复用副本或恢复缺失文件。
- 后续复查时 `backend/` 已完整出现（可能是项目文件同步尚未完成），包含 `app.py`、`business_logic.py`、`latency_report.py` 和 `requirements.txt`；之前“后端缺失”结论已失效。
- 后端会依次读取项目根 `.env` 和 `.vscode/.env`，使用 `DASHSCOPE_API_KEY`、`BAILIAN_WORKSPACE_ID`、`BAILIAN_MODEL`；健康接口只返回是否已配置，不返回真实值。
- Realtime 会话由后端生成，当前默认 `qwen3.5-omni-plus-realtime`、Tina、PCM、text+audio、server_vad、ASR `qwen3-asr-flash-realtime`；前端不接触凭据。
- 项目是独立嵌套 Git 仓库，`git check-ignore` 已确认 `.env` 命中 `.gitignore:1`，写入真实凭据不会被该仓库跟踪。
- 后端 WebRTC 上游端点固定为 `https://{BAILIAN_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime?model={BAILIAN_MODEL}`，与用户提供的 `cn-beijing` 一致；`DASHSCOPE_REGION` 可保留在 `.env` 作为说明，但当前代码不读取。
- 本机当前 `python3` 为 3.14.6，未发现可用 `conda` 命令；8000、8080 端口均空闲。推荐在项目内创建 `.venv` 并安装 `backend/requirements.txt`，替代 README 的 Conda 依赖。
- 已创建项目 `.venv`，但 `pip install -r backend/requirements.txt` 因当前环境无法解析 `pypi.org` 失败；错误是网络/DNS限制，不是依赖版本冲突。
- 系统 Python 3.14、pyenv 3.11.9、项目 `.venv`、Codex bundled Python 均未安装 `aiohttp`；常用 pip 缓存未找到 aiohttp/certifi wheel。
- 已写入项目根 `.env`：使用项目实际识别的 `BAILIAN_WORKSPACE_ID` 映射用户提供的 Workspace，保留北京地域并补齐模型、VAD、端口、CORS 和数据文件配置；文件权限为 600，真实值不写入 planning 或回复。
- 国内镜像和 PyPI 域名在当前执行环境均无法 DNS 解析；本机没有 Conda、uv、poetry、pipx 或其他含 aiohttp 的 Python 环境，无法在本轮工具沙箱中完成依赖下载。
- 前端 `python3 -m http.server 8080 --bind 127.0.0.1` 在当前 Codex 沙箱被系统以 `PermissionError: Operation not permitted` 拒绝；8000/8080 均无进程占用，属于执行环境限制。
- 为提高依赖兼容性，已用本机 `/Users/mac/.pyenv/versions/3.11.9/bin/python3` 重新创建项目 `.venv`；用户在普通联网终端只需安装依赖一次。
- 本周周会汇报范围按现有记录确定为 2026-07-07 至 2026-07-10：从产品定位与调研，推进到产品设计、商业化与原型，再到 Realtime Demo 技术验证和模型能力测试体系。
- 7.7 核心产出：产品分析、AI 英语口语陪练调研与构思备忘录、产品图谱、用户画像/用户旅程/功能与技术架构可视化、简洁汇报稿；产品定位从泛聊天收敛为面向中国成人学习者的真实场景口语陪练。
- 7.8 核心产出：产品设计书第 7/8/9 模块、商业化人民币定价思路、自由聊天与场景体系验收标准、桌面和移动端个人主页原型；明确自由聊天低压力、不默认评分纠错，专业场景独立承接。
- 7.9-7.10 阶段记录显示技术工作已覆盖方案设计、OpenSpec、Demo 开发调试、模型能力边界测试和第二个 WebRTC 测试 Demo 配置；需进一步提取可汇报数字和未完成风险。
- 7.9 技术方案结论：Qwen-Omni-Realtime 作为主方案，先用 WebSocket 跑通和调试，WebRTC 用于后续低延迟体验；豆包保留为需权限与实测的备选。
- OpenSpec change 包含 proposal/design/tasks 和 3 个 spec，经复核合计 23 个 Requirement、45 个 Scenario。
- Demo 调试解决三类关键问题：供应商 Workspace 400 错误被误显示为正常结束、React state updater 读取已清空 ref 导致黑屏、Qwen text+audio 模式遗漏 `response.audio_transcript.*` 导致 AI 回复不展示。
- 7.10 建立 P0/P1/P2 Prompt 分层和能力归因方法，扩展为 36 条唯一模型测试用例，覆盖 6 类能力并配套空白记录表。
- 第二个 WebRTC Demo 已完成本地凭据安全配置、Python 3.11 `.venv` 和启动说明；由于 Codex 执行环境无法联网安装 aiohttp/监听端口，不能把服务运行验证描述为已完成。
- 7.13 新任务输入已定位：根目录 `UniSpeaking产品计划书_v2.md` 和 `码上好戏 AI 短剧全流程自动化创作系统架构设计基线文档.docx`；`7.13` 目录存在但当前为空。
- 用户要求基于 UniSpeaking 产品计划书设计“总体框架”，参考“码上好戏”DOCX 的格式和内容组织；需要先判断交付应是架构基线文档、产品总体框架，还是兼具产品与技术的总蓝图。
- `UniSpeaking产品计划书_v2.md` 共 665 行，内容覆盖：用户问题、竞品差异化、四层产品能力、自由对话/场景广场/个人主页、核心体验、学习者对话策略、MVP 六项假设、四阶段路线图、S2S 与客户端方案、系统全景、核心数据流、专业场景、商业模式和指标体系。
- 计划书已明确关键基线：成人四级左右用户、10 秒内进入对话、自由对话不评分纠错、AI 回复 1-3 句、第一阶段验证 S2S 实时链路、目标 P50 首音频 <=1.5s、打断 <=300ms、连续 3-10 分钟。
- 计划书的现有“架构设计”只有系统全景、自由对话数据流和三项技术选型，尚不足以作为总体架构基线；需要补齐架构原则、能力边界、组件职责、接口/事件、数据与安全、可观测性、部署、演进路线和验收追踪。
- 参考 DOCX SHA-256 为 `c9d70818717449ee4daf8e0364439f34477ff76413ef0b46d32a9a316d69dc7a`，大小约 39 KB，需保持原件不变并蒸馏模板。
- 原测试初稿中的 P1 仍与 Demo `shared/constants.ts` 的 `SYSTEM_PROMPT` 完全一致；第二版文件未发现 TODO/TBD/敏感 Key 形式内容。
- 项目根目录当前不是 git 仓库，`git status --short` 返回 `fatal: not a git repository`。
- 目录中存在 `7.8/产品设计书初稿写作框架.docx`，应作为今天任务的主框架。
- `7.7` 目录中发现多份可复用材料：`汇报.md`、`AI英语口语陪练产品调研与构思备忘录.md`、`简洁汇报稿.md`、`产品图谱.md`、`占付龙—7.7日报.md`、`产品分析.md`，以及 `user-persona-design` 设计产出。
- `7.8/产品设计书初稿写作框架.docx` 共提取到 98 个段落、1 个表格。
- 今日负责模块为：
  - `7. 个人主页`：定义个人主页的信息结构，避免变成无边界功能集合。
  - `8. 商业化思路`：说明免费能力与付费能力边界，为后续版本预留方向。
  - `9. 验收标准`：定义产品设计初稿怎样算达成，便于后续开发和评审判断。
- 模块 7 建议包含：个人设置、学习记录、错题本/反馈记录、历史场景、会员或特定场景入口。关键取舍是本期只做基础承接，不做复杂数据看板；错题本服务模拟对话反馈，不破坏自由对话轻松感。
- 模块 8 建议包含：免费/基础能力是自由对话和用户自定义普通场景；付费/高级场景是 IELTS 模拟、外企实习、面试训练等；高级场景价值来自题库、评分规则、反馈标准和个性化输入。关键取舍是本期不完整实现付费体系，但需要说明商业化承接位置；收费点不能影响自由对话的轻量体验。
- 模块 9 建议包含：自由语音连续交流、场景输入并生成“学-读-说”路径、完成场景模拟对话并获得反馈、个人主页查看基础学习记录、自由对话与模拟对话反馈机制区分明确、产品设计书说明本期做/不做和关键取舍。关键取舍是验收标准要可验证，避免主观描述。
- `7.7/AI英语口语陪练产品调研与构思备忘录.md` 的核心结论：产品应围绕“敢开口 -> 有场景 -> 被纠错 -> 看见进步 -> 愿意复练 -> 愿意付费”的学习闭环；小团队更适合先切入中国成人学习者的真实场景口语训练。
- 昨日备忘录强调：自由聊天不能等同于学习；场景化训练、低压力陪练、训练后反馈、复练任务和可见进步是核心价值。
- 昨日备忘录对模块 7/8/9 可复用的观点：个人记录应服务“看见进步”和复练；商业化应优先围绕强场景付费包；验收应验证用户是否愿意持续开口、是否相信反馈有用、是否愿意为场景脚本/陪练/反馈/进步记录付费。
- `7.7/产品分析.md` 明确产品定位为 AI 英语口语场景陪练产品，不是单纯聊天工具，也不是背单词/刷题工具；核心价值是帮助用户在真实场景中开口、获得反馈、反复改进。
- `7.7/产品分析.md` 给出 MVP 基础功能：场景训练库、语音输入和转写、AI 追问、结构化反馈卡、二次复练、学习记录和打卡。模块 7 可重点承接“学习记录和打卡”，模块 9 可把这些功能转化为验收项。
- `7.7/产品分析.md` 的结构化反馈卡字段：表达亮点、关键问题、原句修改、更自然表达、可复用句式、复练任务。这些字段可沉淀到个人主页的错题本/反馈记录。
- `7.7/产品图谱.md` 将产品拆为场景训练层、练习交互层、反馈评估层、学习成长层、商业转化层、运营与安全层。其中模块 7 对应学习成长层，模块 8 对应商业转化层，模块 9 可对应 MVP 阶段成果检查。
- 产品图谱中的学习成长层包括：练习记录、连续打卡、个人表达库、常见错误库、进步报告。今日框架中模块 7 本期只要求基础承接，因此可将“个人表达库、进步报告”写为后续增强，不纳入本期复杂看板。
- 产品图谱中的商业转化层包括：免费体验、专项训练包、7 天训练营、订阅会员、人工点评增值。今日框架中模块 8 本期不完整实现付费体系，因此可重点写“入口预留、能力边界、未来付费方向”。
- 产品图谱 MVP 阶段强调：先验证用户是否愿意开口、复练和付费，再投入高成本技术能力。模块 9 可把验收标准分成体验闭环、功能结果、边界说明三类。
- `7.7/简洁汇报稿.md` 的汇报口径很适合延续到今天正文：产品关键不在 AI 能不能聊天，而在能否围绕真实场景建立“开口、追问、反馈、复练、进步记录”的完整闭环。
- `7.7/user-persona-design/orchestration-summary.json` 显示用户画像设计聚焦四类用户：职场人、考试备考、留学生、长期想开口但不敢说的人；视觉和文档风格为极简商务、咨询报告式。这意味着今日正文应保持正式、克制、产品设计书语气。
- `7.8` Word 框架末尾有“初稿整合检查表”，其中与负责模块直接相关的检查项为：个人主页只保留基础承接能力，不发散；商业化说明高级场景为什么有收费价值；验收标准至少 4 条可验证标准。
- 备忘录商业化建议：第一版不要把付费点放在“无限聊天”，更适合围绕场景训练包、面试/考试专项、每日反馈报告、训练营打卡、个性化表达库、关键场景模拟与复练收费。
- 备忘录付费验证建议：9.9 元单个专项体验包；29-49 元 7 天开口训练营；99-199 元面试/雅思专项 14 天陪练包，含社群和人工点评 1-2 次。
- 备忘录商业化判断指标：体验后付费转化率、第 2 天留存、7 天完成率、每个用户平均开口次数、用户是否主动分享反馈卡、用户是否愿意提交真实场景需求。
- 备忘录 30 天验证计划中，第 2 周目标是让用户完成一次“说 -> 反馈 -> 复练”；第 3 周目标是验证付费意愿；第 4 周判断是否继续，继续信号包括用户连续练 3 天以上、反馈卡被认为有用、用户主动提出更多场景、有人愿意为更高强度训练付费。
- 风险清单可支撑模块 9 的验收/风险边界：同质化、留存、反馈质量、技术体验、合规、获客。验收标准应避免只写“体验好”，而应写成可演示、可记录、可判断的结果。
- 用户在 `7.8` 新增 `竞品商业模式调研.md`，要求据此细化草稿第 8 节商业化板块，并将价格表达统一为人民币。
- 新增竞品调研结论：同类产品主流不是单次买断，而是“免费体验 + 月/年订阅 + 高级场景/专项训练 + 测评报告 + B 端服务”的组合。
- AI 口语陪练类竞品启发：免费版通常控制练习额度，付费版解锁更多 AI 对话、发音反馈、进度追踪、高级模式和专项场景。
- 传统语言学习 App 启发：免费入口负责规模化拉新，年付折扣负责提升现金流和长期留存。
- 真人外教/陪练平台启发：AI 口语陪练不应与真人外教比绝对专业性，而应强调更便宜、更随时、更低压力、更高频。
- 对本项目更合理的暂定商业模型：免费版降低开口门槛；基础会员承接日常练习；高级场景包承接 IELTS、外企面试、商务会议等强目标需求；深度报告/测评作为增值功能；B 端作为后续拓展。
- 初步人民币定价建议可按国内早期验证而非海外成熟产品定价：免费版限额；基础会员 `¥19.9/月`、`¥129/年`；高级会员 `¥39.9/月`、`¥199/年`；单个专项包 `¥29.9-69.9`；7 天训练营 `¥49-99`；30 天训练营/专项陪练 `¥199-399`；单次深度测评 `¥9.9-29.9`；B 端按账号或测评包报价。
- 用户新增 `7.8/自由聊天模块产品设计.docx`，要求据此更新验收模块。
- 自由聊天模块定位：产品核心入口，提供接近电话通话式的实时英语语音对话体验，核心价值是让用户愿意开口并持续说下去，而不是评估用户说得好不好。
- 自由聊天模块包含：实时语音对话、实时转写、AI 主动开场与追问、语音和文本同步回复、用户打断 AI、中文翻译、朗读、轻量容错和动态难度调整。
- 自由聊天模块不包含：本轮聊天评分、详细纠错报告、逐句语法纠正、考试化任务练习、强制固定话题、聊天结束后的压力反馈。
- 自由聊天体验验收重点：用户 10 秒内理解如何开始聊天；AI 回复短、自然、可听懂；AI 不频繁纠错；AI 每 1-3 轮主动追问；用户困难时 AI 降低难度；结束后不展示评分/纠错/等级评价。
- 自由聊天性能验收指标：首个转写文本出现 `<= 500ms`；AI 回复文本首字出现 `<= 800ms`；用户停止说话后 AI 首句语音开始播放 `<= 1.2s`；打断停止播报 `<= 300ms`；普通网络下连续聊天 3-10 分钟无明显卡顿、崩溃或音频断流。
- 自由聊天北极星指标建议为“用户单次自由聊天有效开口时长”，关键指标包括自由聊天启动率、首次开口成功率、平均对话时长、用户有效发言轮数、次日再次使用率、打断成功率、翻译/朗读点击率和低水平用户连续对话完成率。
- 用户新增 `7.8/AI口语训练场景体系Proposal.md`，要求据此更新验收模块。
- 场景体系 Proposal 将口语训练入口分为三类：自由对话、普通自定义场景、专业化训练场景。
- 普通自定义场景通过场景广场处理，采用“场景输入 -> 学习资料 -> 跟读 -> 模拟对话 -> 基础反馈”的结构化路径。
- 场景广场本期做：支持用户输入普通自定义场景；生成单词、短语、常用表达和示例句；拆分为“学-读-说”三步；“说”阶段复用自由对话能力但增加场景角色和任务目标；模拟对话后生成基础反馈。
- 场景广场本期不做：不覆盖 IELTS、英文面试、研究生英文面试等专业训练场景；不提供考试级评分、招聘级评价或官方标准预测；不要求用户上传简历、JD、题库、考试目标分等复杂资料；不在纯自由对话中默认生成结构化训练报告；不作为即时翻译或现场应急沟通工具。
- IELTS 属于专业化训练模块，应支持 Part 1、Part 2、Part 3 或完整模拟，并提供练习维度反馈；反馈需明确不等同于官方 IELTS 成绩。
- 英文面试属于专业化训练模块，应采用训练项目方式，支持用户输入简历、JD 或目标面试信息，先生成并确认 Brief，再进入模拟面试；系统不得编造用户没有提供的经历或成果。
- 验收模块需要新增“入口分流与场景体系验收”“场景广场功能验收”“专业化训练场景验收”“个人主页与记录验收”等内容，并将普通场景与专业场景边界纳入通过标准。
- 用户要求根据目前设计为个人主页界面设计原型图，便于展示。
- 个人主页原型应覆盖：学习概况、最近练习记录、错题本/反馈记录、历史场景、高级场景入口、基础设置。
- 原型风格沿用用户画像设计中的极简商务风：黑白灰为主、深色主色、边框卡片、低阴影、信息密度适中。
- 原型设计原则：个人主页承担记录、回看、复练和商业化承接，不做复杂数据看板；自由聊天记录、普通场景记录和专业训练记录需要区分展示。
- 已创建 `7.8/个人主页原型.html` 作为可打开的静态页面，另创建 `7.8/个人主页原型图.svg` 和 `7.8/个人主页原型图.png` 用于展示。
- 用户要求将个人主页原型“做成客户端的版本”。本轮按移动 App 客户端理解，保留个人主页的学习概况、反馈记录、历史场景、高级场景入口和设置能力，但改为手机端常见的信息结构：顶部个人卡、三项核心数据、快捷入口、最近练习列表和底部 Tab。
- 用户要求总结今天工作并生成日报。日报需要承接昨天 `7.7/占付龙—7.7日报.md` 的口吻，同时覆盖今天完成的 7/8/9 模块写作、商业模式细化、自由聊天验收更新、场景体系验收更新和个人主页原型产出。
- 用户在 2026-07-09 要求先生成国内端到端 Realtime 语音 Demo 开发设计文档，不直接写代码。
- 7.9 Realtime Demo 的链路只验证：浏览器麦克风输入 -> 国内端到端实时语音模型 -> AI 实时语音回复 -> 对话框输出文本 -> 前端播放声音 -> 用户结束通话。
- 7.9 Realtime Demo 明确不做：评分、纠错、CEFR 等级、发音评测、错题本、登录、会员、录音保存、完整个人主页、复杂学习报告。
- Qwen-Omni-Realtime 公开资料清晰：阿里云百炼官方文档说明其支持实时音视频聊天，支持 WebSocket 和 WebRTC，支持北京/新加坡地域，示例模型名包括 `qwen3.5-omni-plus-realtime`。
- Qwen-Omni-Realtime 文档说明 WebSocket 适合服务端集成和快速接入，WebRTC 适合浏览器端低延迟语音场景；输入音频为 16 kHz PCM，输出音频为 24 kHz PCM；支持文本和音频输出、VAD/语义 VAD、系统提示词配置。
- 豆包/火山方舟方向已搜索公开资料，但未找到与 Qwen-Omni-Realtime 同等明确、可直接开发的端到端实时语音 API 文档；豆包方案需要火山引擎账号权限、商务或技术支持确认后实测。
- 7.9 Demo 技术方案结论：主方案推荐 Qwen-Omni-Realtime；豆包作为备选，需先确认协议、模型名、地域、转写事件、AI 音频事件、打断能力、限流和价格。
- 7.9 开发文档已输出到 `7.9/国内端到端Realtime语音Demo开发设计文档.md`。
- 2026-07-09 用户要求使用 OpenSpec 的规约方式，基于上一轮开发设计文档输出完整、具体、可直接执行的开发规约文档。
- 本轮可见 skills 列表中没有 OpenSpec skill，但本机存在 `/Users/mac/.codex/skills/OpenSpec` 文档和源码目录；已读取 OpenSpec workflows、concepts、writing-specs、examples、agent-contract 相关说明作为格式参考。
- OpenSpec 核心结构：`proposal.md` 写 intent/scope，`specs/*/spec.md` 写可观察行为和 GIVEN/WHEN/THEN 场景，`design.md` 写技术方案，`tasks.md` 写实现清单。
- 已在项目根目录创建 `openspec/`，并建立 change：`openspec/changes/realtime-voice-demo-chain`。
- 本次 OpenSpec 规约将实现路径锁定为 Qwen-Omni-Realtime WebSocket 后端代理链路，不再给后续 AI 保留 WebRTC、豆包或 ASR+LLM+TTS 串联的选择空间。
- 本次 OpenSpec 规约将技术栈锁定为 Node.js 20+、npm、Vite + React + TypeScript、Express + `ws` + TypeScript，固定 `npm run dev`，前端端口 5173，后端端口 8787。
- 本次 OpenSpec 规约包含三个 delta spec：`realtime-voice-chain`、`realtime-event-contract`、`realtime-debug-acceptance`，合计 23 个 Requirement、45 个 Scenario。
- 尝试运行本地 OpenSpec CLI 验证失败，因为 `/Users/mac/.codex/skills/OpenSpec/dist/cli/index.js` 不存在；已改用静态文本检查确认结构、约束和待定词。
- 2026-07-09 调试 `7.9/realtime-voice-demo`：用户反馈点击“开始对话”后立即结束，不能聊天。
- `7.9/realtime-voice-demo` 已按规约实现 Vite + React + TypeScript 前端、Express + ws + TypeScript 后端，并已有 `node_modules`、`dist`、`.env`。
- `npm run typecheck` 通过，`npm run build` 通过；`.env` 中所有必填项均为 SET（未读取真实值）。
- 本地已有 Demo 进程监听：前端 5173，后端 8787；健康检查返回 `config_ready: true`。
- 最小 WebSocket 客户端发送 `client.start` 后，事件顺序为：`session.created` -> `provider_connect_start` -> `provider_ws_error Unexpected server response: 400` -> `provider_ws_close 1006` -> `session.closed reason=provider_closed`。
- 直连 Qwen WebSocket 并监听 `unexpected-response` 得到响应体：`{"code":"BadRequest.IllegalEndpoint","message":"Workspace endpoint is invalid."}`。
- 当前代码的问题分两层：真实外部配置/端点问题导致 Qwen 返回 400；应用错误处理问题导致握手失败被 UI 表示为“通话已结束”而不是“连接失败/端点无效”。
- 已修复供应商握手失败错误路径：`qwenProvider.ts` 监听 `unexpected-response`，读取 HTTP 状态与响应体，构造 `ProviderConnectError`；连接阶段失败会标记 provider closed，避免 close 事件再触发 `session.closed provider_closed`。
- 已修复后端 fatal 会话清理：`realtimeSession.ts` 增加 `failSession`，发送 `server.error` 后清理 provider/timeout 并短延迟关闭浏览器 WebSocket，不再发送 `session.closed` 覆盖前端 `failed` 状态。
- 已增强前端调试日志：`useRealtimeCall.ts` 收到 `server.error` 时追加 `debug_message` 到调试日志。
- 新增回归测试 `server/qwenProvider.test.ts`，覆盖 `formatUnexpectedResponseError` 必须保留 `400 Bad Request`、供应商错误码和响应体消息。
- 验证备用端口 8877 的更新后端：发送 `client.start` 后返回 `server.error code=provider_ws_connect_failed`，debug message 包含 `BadRequest.IllegalEndpoint` 和 `Workspace endpoint is invalid.`，随后 WebSocket 关闭；未再返回 `session.closed provider_closed`。
- 注意：应用错误呈现已修复，但真实聊天仍依赖阿里云侧 Workspace endpoint 有效。当前供应商返回 `Workspace endpoint is invalid.`，需要检查 `DASHSCOPE_WORKSPACE_ID`、`DASHSCOPE_REGION`、API Key 所属地域/业务空间以及模型权限。
- 2026-07-09 用户反馈配置完成后点击开始出现黑屏。本轮浏览器复现显示：页面初始 UI 正常，无控制台错误；点击“开始对话”后 UI 进入 `requesting_mic`，显示“正在请求麦克风权限”和“请求麦克风中…”，未观察到 React 崩溃或 root 被清空。
- 点击后截图显示页面本身仍在深色背景中正常渲染，调试面板 state 为 `requesting_mic`，没有后端事件日志，说明尚未进入浏览器到后端 WebSocket 阶段。
- 后端 `/api/health` 返回 `config_ready: true`，provider `qwen`，model `qwen3.5-omni-plus-realtime`，region `cn-beijing`。
- 使用最小 WebSocket 客户端绕过浏览器麦克风直接发送 `client.start`，事件显示后端已成功连接 Qwen：`provider_ws_open`、`session_update_sent`、`provider_ws_connected`、`provider_session_created`、`session.ready`，并收到 AI 开场文本 `Hi! Let's have a simple English chat. How was your day today?`。
- 当前“点击后黑屏”根因方向：不是阿里云 Workspace/API Key/供应商 WebSocket；更可能是浏览器麦克风权限弹窗、系统隐私权限、浏览器未允许 localhost 使用麦克风、无可用输入设备，或页面被权限提示层压暗但用户没有完成授权。
- 用户提供 React 崩溃堆栈：`TypeError: Cannot read properties of null (reading 'id')`，定位到 `src/useRealtimeCall.ts` 的消息 `setMessages((msgs) => msgs.map(... currentAiMessageRef.current!.id ...))`。
- 根因：React state updater 不是立即同步执行；代码在 `server.ai_text_done` 中先注册 updater，随后把 `currentAiMessageRef.current = null`。当 updater 稍后执行时再读取 `currentAiMessageRef.current!.id`，就会读到 `null.id` 并导致 App 崩溃黑屏。
- 同类风险还存在于 `tempUserMessageRef.current!.id` 和 `server.ai_text_delta` 的 updater 中。正确修法是先构造局部常量 `updated`，再 `setMessages((msgs) => replaceMessageById(msgs, updated))`，updater 不再依赖 mutable ref。
- 已新增 `src/messageState.ts` 的 `replaceMessageById` 纯函数，并新增 `test/messageState.test.ts` 回归测试。测试最初 RED：缺少 `messageState.ts`；实现后 GREEN。
- 2026-07-09 用户反馈：用户说话能被记录并显示在对话框，但 AI 没有回复。对照阿里云 Qwen-Omni-Realtime 官方文档，WebSocket 在“输出文本+音频”模式下，文本回复通过 `response.audio_transcript.delta` 和 `response.audio_transcript.done` 返回；`response.text.delta/done` 是仅输出文本或 WebRTC DataChannel 场景的文本事件。
- 当前 `server/qwenProvider.ts` 原先只映射 `response.text.delta/done`，没有映射 `response.audio_transcript.delta/done`，因此当 Qwen 返回音频模式下的 AI 文本转录时，后端会进入 `provider_event_unhandled`，前端不会收到 `server.ai_text_delta/done`。
- 已新增 `server/qwenProvider.test.ts` 的回归测试：模拟 `response.audio_transcript.delta/done`，要求触发 `onAiTextDelta/onAiTextDone` 且不进入 `provider_event_unhandled`。测试先 RED，补映射后 GREEN。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 使用根目录下的 `task_plan.md`、`findings.md`、`progress.md` 保存工作记忆 | 符合用户要求和 planning-with-files 规则，便于中断后恢复 |
| 对 `.docx` 相关工作启用 documents 技能 | 今日主框架是 Word 文档；若后续修改或生成 DOCX，需要渲染检查 |
| 先输出写作方案等待确认，再整合正文 | brainstorming 技能对创作/修改行为设置了确认门槛 |
| 后续 planning-with-files 统一写入项目根目录 | 用户已明确要求全局记录位于 `/Users/mac/Documents/七牛云`，子目录 planning 只能作为临时或局部补充，最终必须同步根目录 |
| OpenSpec change 名称使用 `realtime-voice-demo-chain` | 该名称准确表达本次规约只服务自由对话 Realtime 语音主链路跑通 |
| 本期 OpenSpec 规约不让实现者二次选择协议/供应商/技术栈 | 用户明确要求规约能让 AI 完全照着开发，不需要判断抉择 |
| Realtime Demo 调试先修错误呈现路径 | 供应商端点无效可能需要用户在阿里云侧调整 Workspace/地域/API Key，但应用应先准确显示 `provider_ws_connect_failed` 和响应体，不能误导为正常结束 |
| 黑屏排查应优先检查麦克风权限链路 | 供应商握手已成功；前端点击停在 `requesting_mic`，说明连接后端前的 `getUserMedia`/系统权限步骤没有完成 |
| React 消息更新不能在 updater 中读取会被清空的 ref | 这会在 AI 快速返回 `server.ai_text_delta` 和 `server.ai_text_done` 时触发竞态；后续类似逻辑应捕获局部快照 |
| Qwen text+audio 模式必须监听 `response.audio_transcript.*` | Demo 配置 `modalities: ['text','audio']`，不能只监听 `response.text.*`，否则 AI 回复文本不会显示 |
| 7.13 参考模板取舍 | 继承工程基线式章节、表格驱动表达和阶段验收闭环；不继承全篇直接格式化、缺少 Heading 样式和表格跨页缺少上下文的问题 |

## Phase 22 Reference DOCX Findings
- 参考文档共 9 页、70 个正文段落、17 张表格，页面为 Letter 纵向、四边 1 英寸边距、单节，无图片和目录域。
- 内容结构依次覆盖：文档定位、产品约束、技术决策、总体架构、核心模块、核心数据、业务流程、接口边界、异步任务与状态机、存储边界、模型适配、异常处理、安全/成本/可观测性、部署、阶段演进、不做事项、验收标准。
- 写作模式以“结论段 + 约束说明 + 对照表”为主，表格经常同时回答职责、输入输出、责任边界、放弃项和阶段边界，适合直接支持开发拆分。
- 视觉上使用深蓝标题、浅蓝灰表头、细边框和页脚；无架构图片，链路以单行文本框表达。最终 UniSpeaking 文档可保留克制配色与表格密度，同时补充可读的架构图和时序图。
- 原文所有段落均为 `Normal`，存在 469 个直接字符格式和 488 个直接段落格式，标题没有使用 Heading 样式。最终文档不复制这一可维护性缺陷，应使用 Heading 1/2/3、自动目录和统一表格样式。
- 当前待确认的首要问题是文档受众：产品+AI+技术联合评审、纯技术开发基线或立项汇报版。推荐联合评审基线。
- 用户已确认采用“产品、AI、技术联合评审基线”。后续内容应兼顾决策可读性和开发可拆分性，并明确产品目标、模型原生能力、Prompt/策略能力、工程保障能力之间的责任边界。
- 用户从三种组织方式中选择方案 3“产品-AI-技术一体化基线型”。文档不以单一端到端语音 Demo 为全部系统，而是把 Demo 作为实时语音基础层的首个验证切片。
- 最终文档将系统组织为实时媒体、会话控制、学习策略、业务数据四个平面，明确 WebRTC 是产品目标通道、WebSocket 是 MVP 诊断通道，S2S 为主且保留管线式降级。
- 最终输出 25 页 DOCX、同源 Markdown 和 7 张 PNG 架构图，覆盖能力全景、总体分层、自由对话时序、状态机、数据关系、部署拓扑和 MVP 演进。
- DOCX 最终审计结果：21 个 Heading 1、42 个 Heading 2、7 张带替代文本图片、页码字段正常、可访问性 high/medium/low 均为 0。
- 参考 DOCX SHA-256 复核仍为 `c9d70818717449ee4daf8e0364439f34477ff76413ef0b46d32a9a316d69dc7a`，确认未修改参考文档。

## Phase 23 Empty Skeleton Findings
- `7.13` 已有总体架构基线 Markdown、DOCX 和 7 张架构图，覆盖四平面架构、业务领域、AI 能力、Realtime 链路、数据、部署、测试和阶段演进。
- 本次骨架文档应承接总体架构基线，进一步回答“仓库如何组织、每个目录放什么、首批需要哪些空文件、哪些边界为未来功能预留”，不重复产品定位和总体架构论证。
- 根目录当前不是 Git 仓库，因此本轮设计文档仍直接写入项目目录，不执行提交；正式创建代码仓库应作为后续实施任务单独进行。
- 用户确认本次需要最终版、可直接照着开发的全栈骨架；客户端范围明确为 Web、iOS、Android，不是只做自由对话 MVP 或单一 Web 客户端。
- 用户选择方案 1：TypeScript Monorepo；Web 使用 React 技术栈，iOS/Android 使用同一套 React Native + Expo Prebuild 工程；后端与 Realtime 使用 Node.js + TypeScript；移动端保留 `ios/`、`android/` 原生扩展目录。
- 用户分段确认仓库边界、技术栈、领域优先目录、数据/事件/错误契约，以及测试、部署和扩展预留设计。
- 已写入 `7.13/UniSpeaking全栈项目空骨架与目录规范.md`：752 行、23 个正文部分，覆盖根目录、Web、iOS/Android、Admin、API、Realtime、Worker、共享包、数据库、AI 资产、测试、环境变量、基础设施、CI/CD、文档、阶段启用和首批工作包。
- 静态自检通过：34 个代码围栏成对；未发现 TODO/TBD/自行选择/敏感 Key 形式占位；关键目录全部命中。

## Phase 24 Daily Report Findings
- 7.13 当日成果不只包含总体架构基线和全栈空骨架，还包括核心业务组件层级、系统组件详细拆分、多个树状层级 DOCX 以及核心业务组件关系图。
- `UniSpeaking_系统组件详细拆分.md` 已覆盖 Web/Mobile/Admin、接入层、11 个核心业务组件、AI 能力、外部 Provider、基础设施、服务端包结构和组件边界规则。
- 网页版沟通进一步锁定最终客户端范围为 Web、iOS、Android，并确认 TypeScript Monorepo、React/Next.js、React Native + Expo Prebuild、Node.js TypeScript 后端、统一契约和 Provider Adapter。
- 用户要求日报保持简洁，应突出“完成总体框架 -> 拆细业务组件 -> 锁定三端全栈骨架 -> 为后续开发建立基线”的主线，避免罗列全部目录细节。
- 用户指定日报格式为“标题 + 今日完成 + 4 个带书名号标签的成果段落”，本次按该格式直接交付，不再执行 brainstorming 确认环节。

## Phase 25 UI-Demo Integration Findings
- `7.14/UniSpeaking_Complete_UI` 是无构建工具的原生 HTML/CSS/ES Modules 完整 UI 原型，入口为 `index.html` 和 `src/app.mjs`，已包含自由对话、场景、复习、个人中心、会员等静态交互与 Node 原生测试。
- UI 当前的自由对话按钮只修改本地 `voiceState`，尚未调用麦克风、WebRTC 或 Demo API。
- `7.14/UniSpeaking` 是 Python `aiohttp` 后端 + 单文件 `webrtc_demo.html` 的可运行自由对话 Demo；后端保护 DashScope/百炼凭据，提供 session、SDP 交换、事件记录、学习者等级和延迟报告接口。
- Demo 前端默认调用 `http://127.0.0.1:8000`，真实集成需要把其中 WebRTC、DataChannel、转写、AI 文本、音频播放、结束清理和性能记录逻辑抽成 UI 可调用模块。
- `7.14/UniSpeaking` 是独立 Git 仓库，`data/latency_report.md` 在本轮开始前已有修改，必须保留；`UniSpeaking_Complete_UI` 当前不是独立 Git 仓库。
- Supabase 更适合承接持久化数据/配置；Qwen Realtime 的 SDP 代理和长期 API Key 不能放到纯静态前端。Vercel 侧是否适合承载当前 Python `aiohttp` 长驻服务需在方案阶段结合运行限制确认。
- Vercel 与 Supabase 插件均已安装并成功连接账号。Vercel 有一个可用 Team；Supabase 有一个位于 `ap-southeast-1`、状态为 `ACTIVE_HEALTHY` 的现有项目，可优先复用，避免未经确认新建付费项目。
- 本轮在设计确认前仅执行账号与项目只读检查，尚未创建 Supabase 项目、迁移数据库或触发 Vercel 部署。
- UI 现有 15 项 Node 测试中 14 项通过；唯一失败稳定复现为 `src/views/training.mjs` 不存在。`app.mjs` 顶层静态导入该文件，因此浏览器加载整个应用时也会失败。这是 UI 文件集不完整的既有问题，不是 Demo 接入造成。
- 项目根目录、Git 历史和工作区其他位置均未找到 `training.mjs` 副本；若继续使用该 UI，必须依据既有路由、数据和验收截图恢复该视图，或临时移除训练路由。推荐恢复视图以保留完整 UI。
- Demo 的核心浏览器链路已经明确：创建后端 session -> 获取麦克风 -> 建立 RTCPeerConnection/DataChannel -> 交换 SDP -> 发送 session.update -> 映射用户转写与 AI transcript -> 播放远端音频 -> 工具调用/延迟记录 -> 结束清理。
- 官方平台资料表明 Supabase Edge Functions 可安全保存 Secret、向外部 API 发起 `fetch` 且按请求无状态运行；当前 Python aiohttp 的内存 session 和 JSON 文件存储不能原样部署到 serverless，需要改为数据库/请求级状态。
- 当前 Vercel Team 下没有既有项目，首次部署会创建项目；现有 Supabase 项目的 `public` schema 无表，可在用户确认后复用。
- 用户确认复用现有 Supabase 项目，并从三种方案中选择“Vercel 静态前端 + Supabase Edge Functions + Supabase 数据库”；不引入第三方 Python 托管平台。
- 用户在执行中进一步明确本轮只考虑 Web 端；iOS、Android 不进入本轮代码、部署和验收范围。
- 最终连接方式不是嵌入旧 Demo，而是把 WebRTC/DataChannel 抽成 `src/realtime` 模块，由 `src/app.mjs` 驱动现有自由对话 UI；活跃消息不再修改静态演示数据。
- 已恢复缺失的 `src/views/training.mjs`，补齐“学、读、说、诊”四阶段；主应用中遗漏的 `learningAssets` import 也已修正。
- Supabase migration `realtime_web` 已应用，创建 `learner_profiles`、`realtime_sessions`、`session_messages`、`realtime_metrics`、`request_rate_limits` 五张表；RLS 全部开启并撤销浏览器角色表权限。
- 新版 Supabase Publishable Key 只应使用 `apikey` 请求头，不能作为 Bearer JWT。`realtime-gateway` 因此使用函数内 Key 匹配、Origin、限流和会话期限校验，平台 `verify_jwt` 关闭。
- `realtime-gateway` Edge Function 版本 1 已为 `ACTIVE`，健康接口 200；线上 session 创建 201、关闭 200。健康结果 `model_configured:false` 说明尚缺百炼 Secret，不代表网关或数据库部署失败。
- Supabase 插件没有 Secret 写入接口；尝试打开控制台时需要单独登录，因此不能在不索取用户登录凭据的前提下自动设置 `DASHSCOPE_API_KEY`、`BAILIAN_WORKSPACE_ID`。
- Vercel 项目 `unispeaking-web` 已生产部署，最新 Deployment `dpl_FUKPRUpRhLyXop72QcfBsFaMmLp2` 状态 `READY`，正式域名为 `https://unispeaking-web.vercel.app`。
- 本地和生产浏览器均确认页面有内容、主路由和麦克风入口正常，无控制台错误；真实百炼 SDP、转写和 AI 音频需在 Secret 设置后完成最后验收。
- 用户已在 Supabase 写入百炼 Secrets，并确认生产 Realtime 全链路已经完全可用；Phase 25 可正式收口。

## Phase 26 Deployment Guide Findings
- 本轮交付目标是面向队友正在迁移的“前后端均可在本地运行”的完整 Web 项目，输出一份可直接照做的 Vercel + Supabase 生产上线手册，写入 `7.14`。
- 文档必须把当前已跑通架构与未来完整迁移项目区分清楚：Vercel 负责 Web/适合 Serverless 的接口，Supabase 负责 Postgres、Auth、Storage 与 Edge Functions；长驻进程、长期 WebSocket 或依赖本地磁盘的后端不能未经改造直接部署到无状态平台。
- 必须明确部署前契约：环境变量清单、客户端/服务端密钥边界、API Base URL、CORS/Origin、Auth 回调地址、数据库 migration、RLS、健康检查、日志、超时/幂等、回滚和自定义域名。
- 网址可以更改：可修改 Vercel 项目名获得新的默认 `*.vercel.app` 地址，更推荐绑定自有域名；改域名后还要同步 Supabase Auth Site URL/Redirect URLs、Edge Function Origin 白名单、应用公开 URL 和第三方 OAuth 回调地址。
- Supabase 官方当前流程仍以 `supabase login`、`supabase link --project-ref`、`supabase db push`、`supabase functions deploy` 为生产部署主路径；Edge Function Secrets 可通过 Dashboard 或 `supabase secrets set` 管理，平台预置的服务端 keys 不应进入浏览器。
- Supabase 团队协作的黄金规则是 schema 变更全部进入 `supabase/migrations`，避免直接在生产 Table Editor/SQL Editor 修改结构；同一时刻协调一人执行生产 `db push`，并用 `supabase migration list` 检查本地/远端历史。
- Supabase 2026-04-28 变更提示新表可能不会自动暴露给 Data/GraphQL API；是否暴露与 RLS 是两层控制，面向浏览器的数据表需要同时确认 Data API grant 与 RLS policy，服务端私有表应继续默认拒绝。
- Vercel 官方当前定义 Local、Preview、Production 三类默认环境；推荐 Git 集成：非生产分支/PR 自动生成 Preview，生产分支合并后生成 Production，再通过环境变量隔离数据库和密钥。
- Vercel 每个 deployment 都有生成 URL；生产使用项目域名或自定义域名。自定义域名在 Project Settings → Domains 添加，apex 通常配置 A 记录，子域名配置 Vercel 页面给出的唯一 CNAME，验证后自动启用 HTTPS。
- Supabase Auth 生产 `Site URL` 必须指向正式站点；Redirect URLs 应加入正式回调路径、本地路径和受控的 Vercel Preview 模式。生产环境推荐精确路径，不要使用过宽通配符。
- Supabase 自身也支持付费自定义 API 域名（如 `api.example.com`），但不是 Web 前端域名的必需项；Vercel 自定义站点域名与 Supabase API 自定义域名是两件事。
- Vercel Functions 适合请求响应型接口，但存在无状态、时长、包大小和请求体限制；需要无限时长/常驻进程、传统本地磁盘或稳定长连接语义的后端应先拆分/改造，不能只因本地能运行就默认适合直接上线。
- 最终手册已写入 `7.14/UniSpeaking_Vercel与Supabase部署上线完整流程.md`，共 987 行、20 个主章节、74 个成对代码围栏。
- 文档覆盖平台职责、后端适配判断、仓库结构、部署前预留、接口/环境变量/密钥、数据库迁移、RLS/Auth、Supabase/Vercel 逐步部署、Preview/Production、网址修改、自定义域名、Git/CI、常见操作、回滚、故障排查和最终检查表。
- 已同步修正 `7.14/UniSpeaking_Complete_UI/README.md` 与首次部署说明的旧状态：百炼 Secrets 和真实端到端链路均已完成，不再显示为等待人工配置。
- 交付验证：当前项目 Node 测试 33/33 通过；文档敏感模式扫描干净；生产站点和 13 个官方参考链接全部 HTTP 200。

## Phase 27 Domain and Deployment Guide Findings
- 用户新购阿里云域名 `unispeaking.cn`，当前路演阶段继续采用 Vercel + Supabase，后期计划迁移到自有服务器；需要分别输出两份逐步行动指南。
- 根目录 Git 仓库当前分支为 `codex/ui-demo-vercel-supabase`，remote 为 GitHub 仓库 `suerzzh/qiniuyun-dayial-work`；`7.14/UniSpeaking_Complete_UI` 当前仍在根仓库中显示为未跟踪目录，指南必须先要求确认完整项目已提交到 GitHub 生产分支，不能假设“上传过部分代码”等于 Vercel 可部署。
- 原 Demo `7.14/UniSpeaking` 是独立 GitHub 仓库 `fj-sunny/UniSpeaking`；正式 UI/Edge Function 应以包含 `UniSpeaking_Complete_UI`、`supabase/`、migration 和函数源码的完整 GitHub 仓库为部署源，避免 Vercel 和 Supabase 分别指向不同版本。
- `unispeaking.cn` 当前权威 DNS 为阿里云 DNS `dns31.hichina.com`、`dns32.hichina.com`；公共查询尚无 apex A、`www` CNAME 或 `app` CNAME，说明尚未开始指向 Vercel。
- 推荐从现在就固定域名分工：`unispeaking.cn`/`www.unispeaking.cn` 用作品牌入口，`app.unispeaking.cn` 用作产品 Web，`api.unispeaking.cn` 预留给未来自有服务器 API；路演阶段前三者可由 Vercel 域名/重定向承接，Supabase API 继续使用项目域名。
- Vercel GitHub 集成默认对每次 push/PR 创建 deployment；生产分支的新 deployment 自动更新已绑定的生产域名，PR 获得独立 Preview URL。个人 GitHub 仓库导入需要仓库 Owner 权限；组织仓库需要相应组织/仓库权限。
- Supabase GitHub Integration 在 Project Settings → Integrations 授权；Working directory 必须指向包含 `supabase/` 的父目录。启用 Deploy to production 后，生产分支会自动应用新 migration、部署 `config.toml` 声明的 Edge Functions 和 Storage buckets；Auth/API/seed 默认不会自动部署。
- Supabase 官方建议把集成检查设为 GitHub required status check，阻止 migration/function 失败的 PR 合并；Preview Branch 不复制生产数据，Secrets 也不会跨分支自动继承。
- 阿里云 DNS 官方说明：根域主机记录使用 `@`，子域只填前缀（如 `app`，不要填完整域名）；CNAME 用于指向另一个域名；TTL 越小切换生效通常越快。Vercel 的 A/CNAME 目标应逐项复制其 Domains 页面实际显示值，不能使用他人项目示例。
- 阿里云备案官方说明，在中华人民共和国境内提供非经营性互联网信息服务需要办理 ICP 备案。未来选择中国内地服务器时，应在切换正式 DNS 前完成域名实名、主体/服务器检查、ICP备案；上线后还需按要求办理公安联网备案并展示备案号。
- 自有服务器推荐先只迁移 Web/API/Worker，继续使用托管 Supabase，降低路演后首次迁移风险；是否自托管 Supabase 作为独立第二阶段。官方当前自托管 Docker 建议最低 2 核/4GB/40GB SSD，推荐 4 核/8GB+/80GB+ SSD，生产还需自行承担密钥、HTTPS、备份、升级、监控、SMTP 和故障恢复。
- 自有服务器部署基线选择 Ubuntu LTS + Docker Engine/Compose + Nginx/Caddy 反向代理 + 自动 TLS；GitHub Actions 构建不可变镜像并推送 GHCR，服务器只拉取经过测试的 commit SHA 镜像，避免在生产机临时编译。
- GitHub 根仓库远端默认分支确认为 `main`；GitHub Contents API 未认证查询返回 404，无法据此判断私有仓库远端是否已包含完整 UI，因此指南会把“在 GitHub 网页确认 `package.json`、`supabase/config.toml`、migration、function 和 lockfile 都在 production branch”列为部署前强制门禁。
- Vercel 当前官方说明：域名配置完成后自动指向最新 Production deployment；生产分支每次 push/merge 更新该域名；同项目的多个域名可在 Domains → Edit 中显式配置 redirect。官方偏好 `www` CNAME 作为普通网站主域，但 UniSpeaking 产品需要长期稳定的产品入口，因此选择 `app.unispeaking.cn` 为应用主域、root/www 重定向到 app。
- 阿里云官方当前明确：是否需要 ICP 取决于服务器地域；中国内地节点必须在服务器所属接入商办理备案，中国香港/海外节点无需中国内地 ICP 备案。阿里云可备案 ECS/轻量服务器通常要求中国内地节点、包年包月 3 个月以上并具备公网带宽，最终以购买时控制台规则为准。
- ICP 成功后网站应在相应位置展示备案编号并链接工信部备案系统；完成 ICP 后应在 30 日内提交公安联网备案申请，公安备案通过后也需在网站底部展示公安备案信息。
- Phase 27 最终域名分工确定为：`app.unispeaking.cn` 作为稳定产品入口，`unispeaking.cn` 与 `www.unispeaking.cn` 重定向到 `app`，`api.unispeaking.cn` 留给未来自有服务器 API；路演阶段保留 `unispeaking-web.vercel.app` 作为紧急回退入口。
- 2026-07-14 最终复查时，根域、`www`、`app`、`api` 均无公开 A/CNAME 记录；因此必须先在 Vercel Domains 添加域名，再把 Vercel 为当前项目显示的真实 A/CNAME 值录入阿里云 DNS，不能照抄示例目标。
- 自有服务器迁移采用两阶段原则：第一阶段只迁移 Web/API/Worker 并继续使用托管 Supabase；第二阶段只有在团队已具备数据库备份、监控、安全升级和故障恢复能力后，才单独评估自托管 Supabase。
- 两份行动指南中的官方参考链接完成可访问性检查：Vercel、Supabase、阿里云、Docker、GitHub、Nginx、Certbot 和公安备案入口均返回 HTTP 200；工信部备案入口对自动请求返回 HTTP 521，保留其官方入口供浏览器人工访问。

## Phase 28 Local-Ready to Production-Ready Findings
- “所有人克隆后都能在本地运行”只证明开发环境可复现，不证明代码适合云端运行；生产还必须满足运行时兼容、无状态化、环境隔离、安全、迁移、可观测、容量和回滚要求。
- 最常需要改的不是页面 UI，而是后端启动方式、状态存储、文件存储、环境变量读取、API 地址、CORS/Auth 回调、数据库变更方式、错误处理和健康检查。
- 如果项目只是静态前端，且后端能力已经全部通过 Supabase 等云服务提供，通常代码改动较少；如果包含传统 Express/FastAPI 常驻服务、内存 session、本地上传目录、SQLite、本地定时任务或长期 WebSocket，则不能原样放进无状态 Functions，需要拆分或选择常驻服务器。
- 生产代码必须消除 `localhost`、开发代理、固定端口和开发账号假设；外部地址应由环境变量或运行时配置提供，并区分 Development、Preview/Staging、Production。
- 浏览器只能持有 Supabase publishable key 等可公开配置；service role、百炼 Key、数据库密码等必须留在服务端或平台 Secrets。任何 `NEXT_PUBLIC_`/前端构建变量都会进入浏览器包。
- 数据库结构不能依赖 README 中的人工点选步骤；表、索引、函数、grant、RLS policy、Storage policy 和必要 seed 应写成版本化 migration，并在 Staging 先验证。
- Supabase 当前将对象级 grant 与行级 RLS 视为两层权限；新表可能不会自动暴露到 Data API，不能只检查 RLS，也不能仅因客户端报 42501 就放宽全部权限。
- 生产发布的最低交付物应包括锁文件、可重复 production build、`.env.example`、migration、平台配置、健康检查、日志与监控入口、测试、回滚说明和 README 部署章节。

## Phase 29 Developer Deployment Readiness Findings
- UniSpeaking 当前路演生产基线属于“Vercel Web + 浏览器 Realtime/WebRTC + Supabase Edge Function/Postgres”的 Serverless/BaaS 混合架构，不属于传统单机常驻前后端。
- 当前已验证参考实现的 Web 是静态 ES Modules 应用，由 Vercel 提供静态托管和安全响应头；实时密钥网关、会话元数据与最终消息由 Supabase Edge Function/Postgres 承担，浏览器直连 Realtime WebRTC 数据面。
- 队友的“本地完整版本”如果包含 Express/FastAPI/Python 常驻后端，不能仅凭本地可运行判断能直接部署；必须按能力拆分为 Edge/Function、Supabase 数据服务、浏览器 WebRTC 或独立常驻服务。
- 开发交付的核心不是替平台管理员点击部署，而是交付可重复 production build、环境/Secret 分层、无状态接口、migration/grant/RLS、Preview E2E、健康检查、日志和回滚信息。
- 新指南不要求队友照抄当前仓库文件，而是通过架构盘点和代码搜索把其版本逐项标记为保留、环境变量化、迁移或架构例外。
- Supabase 2026-07 changelog 提示 `@supabase/supabase-js` 后续将要求 TypeScript 5.0；2026-04 的 Data API 变更继续要求团队同时核对对象 grant 与行级 RLS，不能只检查其中一层。

## Phase 30 DashScope Temporary API Key Findings
- 百炼临时 API Key 不是在控制台中手工新增的永久 Key，而是由服务端使用主 API Key 调用 token 接口生成；有效期可设为 1–1800 秒，10 分钟对应 `expire_in_seconds=600`。
- 临时 Key 继承主 Key 的权限和访问限制，不能在到期前主动删除；主 Key 仍必须只保存在可信服务端。
- 当前线上实现由 Supabase Edge Function 的 `Deno.env.get("DASHSCOPE_API_KEY")` 读取密钥，并在 WebRTC SDP 交换时作为 Bearer 使用；Vercel 浏览器端不持有主 Key。因此只修改本地 `.env` 不会影响已部署线上链路。
- 旧本地 Python Demo 在进程启动时读取 `.env`，所以一次性本地兼容测试可以把临时 Key 注入本地环境并重启后端，无需修改前端代码。
- 若要正式让线上链路每次使用 10 分钟临时 Key，应由 Edge Function 保留主 Key、先生成临时 Key，再用临时 Key 完成 SDP 交换；需要修改 Edge Function、增加错误处理和测试，不只是改配置。
- 百炼账单支持按永久 API Key ID、工作空间、模型等维度拆分，但官方资料未明确临时 Key 会作为独立 Key ID 展示。预计调用量归属主 Key/工作空间，而不是生成一个可单独筛选的临时 Key；需要用带时间窗口的实测确认，不能预先承诺。
- 模型监控数据通常按小时更新，因此 10 分钟测试结束后不应立即判定“控制台没有用量”；应至少等待一个小时再核对监控与账单明细。
- Supabase 官方说明，生产 Edge Function Secret 可在 Dashboard 或 CLI 中更新，保存后立即可供函数读取，不需要重新部署函数代码；因此线上一次性替换测试需要改 Supabase Secret，而不是 Vercel 或本地 `.env`。
- 当前 Edge Function 在每次 `/sdp` 请求中调用 `Deno.env.get`，不会像旧 Python Demo 那样只在进程启动时缓存密钥；但直接把生产主 Secret 换成 10 分钟临时 Key 会让到期后的新会话失败，且必须及时恢复，不适合作为长期实现。
- WebRTC 鉴权发生在 SDP 交换阶段；临时 Key 到期可明确验证“到期后新建会话失败”，但不应假设它会强制断开已经完成鉴权并建立的现有 WebRTC 会话。
- 代码定位：`realtime-gateway/index.ts` 第 155 行读取 Key，第 160–162 行发起 Realtime SDP 请求；旧 Python Demo `backend/app.py` 第 56 行在启动时读取 Key。

## Phase 31 Local DashScope Temporary Key Implementation Findings
- 本地实施目标锁定为 `7.14/UniSpeaking` Python Demo，不改 Vercel、线上 Supabase 或完整 UI；永久 Key 继续只存在于被 Git 忽略的项目根 `.env`。
- 新增 `backend/temporary_key.py`，对 token 签发、TTL 1–1800 秒校验、响应结构校验和安全错误进行独立封装；Key 字段在 dataclass repr 中隐藏。
- `backend/app.py` 新增 `DASHSCOPE_USE_TEMP_KEY` 和 `DASHSCOPE_TEMP_KEY_TTL_SECONDS`。本地 `.env` 已开启 temporary 模式并设为 600 秒；每次新的 SDP 交换都会生成新的临时 Key。
- 临时 Key 签发失败时返回 502，不静默回退永久 Key，从而保证测试流量确实使用临时 Key；日志只记录会话 ID 和 `expires_at`。
- `/health` 新增安全的 `credential_mode` 与 `temporary_key_ttl_seconds` 字段。实际启动验证返回 temporary/600，未输出密钥。
- 新增 6 个 unittest，覆盖父 Key Bearer、600 秒 TTL、非法 TTL、上游非 2xx、缺失 token、临时/永久模式选择；完整测试、compileall 和 `git diff --check` 均通过。
- 正常 UI 测试每次新会话都会获得新临时 Key，因此10分钟后 Demo不会永久失效；到期的是单个 Key。若要对照永久 Key 路径，需要将开关设为 false 后重启。

## Phase 32 Local Temporary Key 401 Diagnosis Findings
- 浏览器创建本地 session 成功，失败边界稳定在 Python 后端向 DashScope token 接口签发临时 Key，返回 `401 InvalidApiKey`，因此前端、CORS、session 创建和 SDP 读取均不是根因。
- 本地 `.env` 的主 Key 已配置，属于新版 `sk-ws-` 工作空间 Key，长度 116，未包含空白字符；可排除空值、明显格式错误和复制换行。
- 使用同一个主 Key 绕过临时签发模块，直接向当前工作空间的北京 Realtime WebRTC endpoint 发送最小鉴权探测，同样返回 `401 InvalidApiKey`。这证明问题不是临时 token endpoint 不接受该 Key，也不是600秒 TTL，而是当前主 Key 本身已被服务端判定无效。
- 百炼官方说明新版 `sk-ws` Key 与旧 Key 具备相同模型调用能力；401 常见原因包括 Key错误、地域不匹配、Key被重置/禁用/删除等。当前 endpoint 与项目均为北京，结合此前链路曾可用，优先检查该 Key 是否已在控制台被重置、禁用或删除。
- 关闭 temporary 模式不会恢复功能，因为永久 Key直连也已被实测拒绝；必须先在北京地域 API Key管理页启用现有 Key，或创建/重置一个有效 Key并更新本地 `.env`。
- 用户更新本地凭据后于 2026-07-15 重启验证：token endpoint 返回 HTTP 200，响应包含临时 Key 和 `expires_at`，确认新的主 Key可以成功签发600秒临时 Key；未回显临时 Key内容。

## Phase 33 Per-User Realtime Usage Attribution Findings
- `7.15/json.png` 展示的一条百炼推理日志同时包含 `task_uuid: sess_...`、独立 `request_id` 和 `usage`；其中 `usage` 含 input/output/total token，以及 text/audio 分项。该截图支持“当前日志里的 `task_uuid` 与 Realtime `session.id` 相同”的实测结论，但官方事件文档没有把 `task_uuid` 字段定义为长期稳定的公开契约，正式实现必须保留契约测试与缺失告警。
- 百炼官方 Realtime 服务端事件文档确认：`session.created` 是连接建立后的首个服务端事件，`session.id` 形如 `sess_...`；`response.done` 的 `response.usage` 包含 `total_tokens`、`input_tokens`、`output_tokens` 及文本/音频分项。
- 百炼官方模型监控文档明确建议：如需通过 API 获取单次调用 Token 消耗，应在每次调用时从响应的 `usage` 字段提取；普通监控延迟小时级，高级监控/推理日志延迟分钟级，默认保留 30 天。
- 当前 `UniSpeaking_Complete_UI` 在 Supabase 中先生成内部 `realtime_sessions.id` UUID；前端收到 `session.created` 后只发送 `session.update`，没有保存 `event.session.id`。因此当前数据库无法直接用内部 session UUID 查询百炼 `task_uuid`。
- 当前数据库只有 `conversation_id` 和 `client_hash`，没有绑定 `auth.users.id` 或其他可信用户主键；当前静态登录页也没有真正的 Supabase Auth 调用。若目标是不同用户的可靠用量统计/配额/计费，必须先补服务端可验证的 `user_id` 绑定。
- 当前 WebRTC 架构的 Realtime DataChannel 直接在浏览器与百炼之间传输；Supabase Edge Function 只负责会话元数据和 SDP 交换，无法在服务端直接看到 `session.created` 与 `response.done`。浏览器上报可实现实时统计，但可被篡改，只能作为 provisional 用量，不能单独作为扣费账本。
- 推荐混合路径：浏览器收到 `session.created` 后立即把 provider session ID 绑定到内部 session；每次 `response.done` 以 `response.id` 为幂等键上报 usage，形成实时 provisional 统计；后台再用百炼推理日志/SLS 按 `task_uuid` 查询并对账，形成 authoritative/reconciled 统计。
- 若只做产品分析和用量展示，可先使用浏览器事件采集；若用量用于硬额度或计费，必须启用日志对账，或将协议切换为服务端可见事件的 WebSocket/有状态 Realtime 网关。
- 百炼模型监控的 Prometheus API可按 workspace、model、API Key ID、protocol、usage_type 聚合，但没有公开的 UniSpeaking 业务用户维度，不能直接解决单用户归因；“每用户一个 API Key”会放大密钥、配额和运维风险，不推荐。
- 百炼推理日志写入 SLS 后，可使用 SLS GetLogsV2 API按 Project、Logstore、时间窗和 `task_uuid` 查询；应使用最小权限 RAM/STS 凭据，并把查询放在服务端定时任务中，不能在浏览器保存 AccessKey。
- 参考资料：百炼服务端事件 `https://help.aliyun.com/zh/model-studio/server-events`；模型监控 `https://help.aliyun.com/zh/model-studio/model-telemetry/`；SLS GetLogsV2 `https://help.aliyun.com/zh/sls/developer-reference/api-sls-2020-12-30-getlogsv2`。

## Phase 34 Local Session Identity Attribution Validation Findings
- `7.14/UniSpeaking` 本地 Demo 已实现最小验证链路：创建后端会话时绑定固定测试用户；浏览器收到 `session.created` 后提取 `event.session.id`；通过独立接口绑定到本地会话；关闭时写出最新记录。
- 固定测试用户由 `DEMO_USER_ID` 配置，默认 `demo-user-001`。这是本地验证占位，不是生产鉴权；未来多用户实现仍需由可信登录态在服务端确定用户 ID。
- 最新记录文件固定为 `7.14/UniSpeaking/data/last_session_identity.txt`，包含 `user_id`、`local_session_id`、`provider_session_id`、开始/结束时间和云端比较字段 `task_uuid`。
- provider session 绑定是幂等且不可改绑：同一 ID 重复提交成功，同一本地会话尝试绑定不同 provider ID 会返回 400，避免关联被后续事件覆盖。
- 浏览器正常结束前会等待绑定请求完成；若事件未捕获或绑定失败，后端仍写文件并标记 `provider_session_id: NOT_CAPTURED` 和 `capture_status: missing`，便于定位验证失败。
- 本轮只证明并暴露可人工核验的关联键，不查询云端日志、不保存 usage、不做累计统计。`session.id == task_uuid` 的最终实测仍需用户完成一次真实会话并等待千问云记录生成后比对。
- TDD 与回归验证：先观察到缺模块、缺 `user_id`、缺浏览器捕获逻辑三次预期红灯；最终 unittest 12/12 通过，compileall、浏览器脚本 `node --check`、`git diff --check` 均通过。
- 当前本地后端已用新代码重启在 `127.0.0.1:8000`，健康检查为 temporary 模式、TTL 600；8080 静态页面也已确认包含新绑定逻辑。
- 用户完成真实会话验证：本地捕获的 `provider_session_id=sess_CQEnIAvxbwqto5CFOIoEh` 与千问云记录的 `task_uuid=sess_CQEnIAvxbwqto5CFOIoEh` 完全一致，Phase 34 的人工云端比对门禁已通过。

## Phase 35 Session Identity to User Usage Flow Documentation Findings
- 实际运行日志确认完整链路：`demo-user-001` 创建本地会话 `3a957e96064445babdf00d05cb418110`；百炼通过 `session.created.session.id` 返回 `sess_CQEnIAvxbwqto5CFOIoEh`；浏览器提交绑定；关闭时后端写出 identity record。
- 用量归属的唯一匹配链为 `user_id -> local_session_id -> provider_session_id == task_uuid -> usage`。
- 已创建 `7.15/用户会话标识与用量归属流程.md`，只说明标识来源、绑定、结束、日志匹配和用量归属，不扩展其他统计方案。
- 用户要求结束项目运行后，已停止 8000 后端与 8080 静态前端，两个端口均确认无监听。

## Phase 37 IELTS Speaking Interactive Demo Findings
- 题库方案无需在“JSON 或数据库”之间提前做不可逆选择：本轮以版本化后端目录 JSON 作为权威源，领域加载器只依赖抽象 `loadJson`，后续可替换为数据库读取而不改组卷和状态机。
- 组卷器冻结渲染文本、题库版本与关联策略；Part 3 必须按已抽取 Part 2 的 `topicCluster` 选组，最近五次已完成 Demo 的题目 ID 用于优先避重。
- 完整模考和专项练习共用纯状态机，但权限不同：完整模考拒绝暂停、跳题和重试；专项练习允许重试或进入下一题。字幕切换属于显示辅助，不改变题目索引，也不会重复播报问题。
- Part 1/3 完整模考不显示独立文字题卡，字幕默认隐藏且可在会话中开启；Part 2 在准备和回答阶段都完整展示 topic sentence、`You should say` 列表与 `and explain`，符合本轮确认的考试流程要求。
- Part 2 笔记只在准备阶段可写，倒计时结束后只读并保留内容；每秒重渲染通过焦点与光标恢复避免打断输入。对刚好落在状态切换后的陈旧 input 事件，UI 边界静默忽略，领域控制器继续严格拒绝越界写入。
- 反馈报告只根据回答转写、时间与录音偏好生成证据型四维建议，不输出 0–9 数字分；没有可分析原始音频时 Pronunciation 明确标记为未评估。
- 浏览器验收使用 1440px 桌面与 390px 移动视口完成全流程，移动端 `scrollWidth == innerWidth == 390`，控制台错误与 HTTP 失败资源均为 0。
- 当前 Demo 的考官语音是浏览器 `speechSynthesis`，回答结束按钮是未来 VAD/turn-end 的替身；录音开关只验证用户选择，不上传音频。真实 Realtime、后端会话存储、数据库和部署明确留待后续。

## Phase 38 IELTS Microphone Answer Interaction Findings
- 麦克风采集状态必须与考试状态分离：`paused` 只暂停当前回答的识别与回答计时，不改变 `ExamState`，因此完整模考仍然没有暂停整场、跳题或重试能力。
- 浏览器能力通过 `SpeechRecognitionAdapter` 隔离，优先使用标准 `SpeechRecognition`，兼容 `webkitSpeechRecognition`；权限只在用户点击后请求，不在页面加载或进入考试时触发。
- Web Speech API 可能意外结束识别，适配器允许自动重启一次；再次异常则进入文字回退，避免界面显示“正在聆听”但实际没有采集。
- 单轮回答控制器只把 final segment 合并到正式转写，interim 只做展示；手动修正后的文字不会被临时结果覆盖，继续说话会追加新 final segment。
- “结束本轮回答”是唯一推进考试的语音动作，`finish()` 幂等、先停止识别和轨道，再把最终转写交给原 `IeltsDemoController.submitAnswer()`；下一题立即重置为空闲状态。
- Part 2 准备阶段不创建麦克风面板，因此不会误触权限；倒计时结束后题卡仍完整置顶，笔记只读，回答面板才出现。
- 权限拒绝、浏览器不支持或音频设备错误不会阻断考试，统一降级为可编辑文字；由于本轮不保存可分析原始音频，Pronunciation 仍不得从转写推断。
- Chromium 验收确认初始不会请求权限、暂停时计时冻结、恢复后转写追加、结束只推进一次；390px 无横向溢出且主麦克风为 80px。

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 当前根目录不是 git 仓库，无法提交设计文档 | 将规划和交付文件直接维护在项目目录；最终说明不做 git 提交 |
| Vercel 首次调用缺少真实必填字段 | 根据插件返回的校验信息改用 `target`、`name` 和 `files[{file,data}]`，仅上传 Web 项目所需文件，生产部署成功 |
| Supabase 控制台未登录且插件无 Secret 写接口 | 不回显或搬运本地密钥；将两项 Secret 配置记录为操作说明中的唯一人工步骤，其余部署继续完成 |

## Resources
- `/Users/mac/Documents/七牛云/7.7`
- `/Users/mac/Documents/七牛云/7.8/产品设计书初稿写作框架.docx`
- `/Users/mac/Documents/七牛云/7.8/7-8-9模块草稿.md`
- `/Users/mac/Documents/七牛云/7.8/竞品商业模式调研.md`
- `/Users/mac/Documents/七牛云/7.8/自由聊天模块产品设计.docx`
- `/Users/mac/Documents/七牛云/7.8/AI口语训练场景体系Proposal.md`
- `/Users/mac/Documents/七牛云/7.8/个人主页原型.html`
- `/Users/mac/Documents/七牛云/7.8/个人主页原型图.svg`
- `/Users/mac/Documents/七牛云/7.8/个人主页原型图.png`
- `/Users/mac/Documents/七牛云/7.8/个人主页客户端原型.html`
- `/Users/mac/Documents/七牛云/7.8/个人主页客户端原型图.svg`
- `/Users/mac/Documents/七牛云/7.8/个人主页客户端原型图.png`
- `/Users/mac/Documents/七牛云/7.8/占付龙—7.8日报.md`
- `/Users/mac/Documents/七牛云/7.9/国内端到端Realtime语音Demo开发设计文档.md`
- `/Users/mac/Documents/七牛云/openspec/config.yaml`
- `/Users/mac/Documents/七牛云/openspec/project.md`
- `/Users/mac/Documents/七牛云/openspec/changes/realtime-voice-demo-chain/proposal.md`
- `/Users/mac/Documents/七牛云/openspec/changes/realtime-voice-demo-chain/design.md`
- `/Users/mac/Documents/七牛云/openspec/changes/realtime-voice-demo-chain/tasks.md`
- `/Users/mac/Documents/七牛云/openspec/changes/realtime-voice-demo-chain/specs/realtime-voice-chain/spec.md`
- `/Users/mac/Documents/七牛云/openspec/changes/realtime-voice-demo-chain/specs/realtime-event-contract/spec.md`
- `/Users/mac/Documents/七牛云/openspec/changes/realtime-voice-demo-chain/specs/realtime-debug-acceptance/spec.md`
- `/Users/mac/Documents/七牛云/task_plan.md`
- `/Users/mac/Documents/七牛云/findings.md`
- `/Users/mac/Documents/七牛云/progress.md`

## Visual/Browser Findings
- 已查看 `7.8/个人主页原型图.png`，图片为 1440 x 1024，布局完整，包含左侧导航、用户概况、学习概况、练习记录、反馈记录、历史场景、设置和高级场景入口。
- 已查看 `7.8/个人主页客户端原型图.png`，图片为 1080 x 1440，布局完整，包含手机端状态栏、个人卡、学习概况、常用入口、高级场景入口、最近练习和底部导航。

---
*Update this file after every 2 view/browser/search operations.*
