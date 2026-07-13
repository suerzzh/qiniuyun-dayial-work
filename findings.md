# Findings & Decisions

## Requirements
- 用户在 `/Users/mac/Documents/七牛云` 下开展工作。
- `7.7` 是昨天的工作产出，需要作为今天写作的背景材料。
- `7.8` 中的文档是今天要完成的任务。
- 用户负责产品设计书中的 7、8、9 模块，希望我帮助撰写这些内容。
- 用户明确要求调用 `superpowers:brainstorming` 进行头脑风暴。
- 用户明确要求使用 `$planning-with-files` 制定开发/写作计划，并维护 `task_plan.md`、`findings.md`、`progress.md`。
- 用户在 2026-07-09 明确纠正：`planning-with-files` 的输出应是整个项目全局记录，位置是 `/Users/mac/Documents/七牛云` 根目录；后续不要只写入具体 Demo 或日期子目录。
- 用户在 2026-07-10 要求开展非正式的大模型性能与能力边界测试，重点验证某项产品能力能否由 Realtime 模型直接实现、能否通过修改提示词实现，或必须由工程能力实现；测试想法和用例最终写入 `7.10`。

## Research Findings
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

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 当前根目录不是 git 仓库，无法提交设计文档 | 将规划和交付文件直接维护在项目目录；最终说明不做 git 提交 |

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
