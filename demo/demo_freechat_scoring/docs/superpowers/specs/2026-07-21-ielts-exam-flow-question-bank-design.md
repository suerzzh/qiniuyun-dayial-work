# IELTS 完整模考流程、题库与提示词设计

**日期：** 2026-07-21  
**状态：** 已完成对话设计确认，等待书面复核  
**范围：** UniSpeaking IELTS Speaking Demo，不扩展为生产级身份、账单或复杂持久化系统

## 1. 目标

将 IELTS Demo 调整为确定性的完整口语模拟流程，并使用以下两份源题库：

- Part 1：`data/2026年1-4月P1口语分类2.2.json`
- Part 2/3：`data/2026年1-4月P2&P3口语分类2.27.json`

系统必须保证 Part 2 与其源对象内部的 Part 3 问题不可拆分。Qwen Realtime 只负责考官语音、ASR 和 VAD；抽题、顺序、计时、状态推进和考试结束均由确定性代码控制。

## 2. 已确认的产品规则

### 2.1 开场与自我介绍

固定英文开场为：

> Hello. My name is Alex, and I’ll be your examiner for this IELTS Speaking practice test. Welcome. Before we begin, please introduce yourself. You have up to one minute.

- 不使用 `Good morning` 或 `Good afternoon`。
- 默认考官姓名为 `Alex`，姓名和整段固定脚本集中配置。
- 自我介绍最长 60 秒，可由考生提前结束。
- 自我介绍保存原始音频、转写和持续时间，Turn 类型为 `INTRODUCTION`。
- 自我介绍标记 `scoring_eligible=false`，不进入 IELTS 四维 Band 判断。

### 2.2 Part 1

- 每场完整模考随机确定题量为 4 或 5。
- 只选择一个拥有足够可用问题的 Topic。
- 在该 Topic 内随机选择目标题量的问题。
- 抽中问题必须按源题库 `order` 升序提问，例如 `1 → 2 → 5`。
- Part 1 全程不切换 Topic，不根据回答质量跨 Topic。
- 每道题回答最长 60 秒，也可由考生提前结束。

### 2.3 Part 2

- Part 2 题卡完整显示在页面。
- 考官不朗读题目或 cue points，只读准备说明：

> Now, I’m going to give you a topic. You have one minute to think and prepare. You may make notes.

- 准备时间为 60 秒，允许记录笔记。
- 准备结束后考官只读：

> Your preparation time is over. You may begin speaking now.

- 回答最长 120 秒，可由考生明确提前结束。
- 普通短暂停顿和 800ms VAD 不能结束整个 Part 2。
- 不设置 Part 2 rounding-off question；长回答结束后直接进入 Part 3。

### 2.4 Part 3

- Part 3 只能使用本场 Part 2 所属同一个源 `topic.id` 对象内的问题。
- 严格按照 `order` 升序提问，不从其他题组补题或混题。
- 每道题的回答上限与 Part 1 相同：真实模式 60 秒，加速 Demo 20 秒。
- 第一题考官语音结束后启动 Part 3 总计时。
- 达到 4 分钟后进入软结束：当前回答完成后结束，不再开启下一题。
- 达到 5 分钟后强制结束当前回答并完成考试。
- 若该原子题组的问题已经全部问完，允许提前结束。

### 2.5 时间模式

完整模考默认使用真实考试时间，同时在预检页保留“加速完整模考（仅用于 Demo 测试）”开关。

| 阶段 | 真实模式 | 加速 Demo |
|---|---:|---:|
| 自我介绍 | 60 秒 | 15 秒 |
| Part 1 单题 | 60 秒 | 20 秒 |
| Part 2 准备 | 60 秒 | 10 秒 |
| Part 2 回答 | 120 秒 | 45 秒 |
| Part 3 单题 | 60 秒 | 20 秒 |
| Part 3 软结束 | 240 秒 | 60 秒 |
| Part 3 硬结束 | 300 秒 | 75 秒 |

Attempt 和 Paper Snapshot 必须保存 `timing_profile`，取值为 `real_exam` 或 `accelerated_demo`。

## 3. 当前实现审计

### 3.1 当前提示词位置

- IELTS Realtime 基础约束目前硬编码在 Java `IeltsAttemptController.realtimeConfig()`。
- 每题的 `response.create` 指令目前硬编码在前端 `ielts-session-runtime.mjs`。
- IELTS 语言分析和 Judge 提示词目前是 `QwenScoringService.java` 中的字符串常量。
- 自由对话系统提示词位于 `ScoringController.java`，与 IELTS 链路独立，必须保持兼容。

现有 IELTS Realtime 提示词只约束“扮演考官”和“Part 2 等待明确结束”，没有完整定义开场、自我介绍、Part 1 题量、Part 2 不朗读题卡、Part 3 时间边界和结束语。因此完整流程不能只依赖现有提示词。

### 3.2 当前题库来源

源 PDF 的抽取工具位于：

- `7.20/ielts-question-extractor/extract_ielts_pdf_to_json.py`
- `7.20/ielts-question-extractor/extract_ielts_p2_p3_to_json.py`

它们使用 PyMuPDF 按 PDF 布局、标题、题号和 Part 标记抽取，并只进行机械性的 Unicode、空格和标点归一化，不应改写题意。

当前 IELTS 前端并没有直接使用这次指定的完整源 JSON，而是读取：

- `backend/ielts/question_bank/manifest.json`
- `backend/ielts/question_bank/part1.json`
- `backend/ielts/question_bank/part2.json`
- `backend/ielts/question_bank/part3.json`

这些是小规模 Demo 数据。当前组卷器还会把 Part 2 与独立 Part 3 池通过 `topic_cluster` 匹配；新源 JSON 的 104 个 `topic_cluster` 全部为 `null`，因此该机制不能满足本次关联要求。

## 4. 目标题库架构

### 4.1 构建时转换

新增 `scripts/build_ielts_question_bank.py`，读取两份指定源 JSON，并生成前端运行时题库。源 JSON 保持不变，不修改现有抽取格式。

运行时只使用：

```text
backend/ielts/question_bank/
├── manifest.json
├── part1.json
└── part2_part3.json
```

旧的独立 `part2.json` 和 `part3.json` 不再由 manifest 加载，也不作为组卷候选源。

### 4.2 Part 1 目标结构

每个 Topic 保留：

- 源 Topic ID、名称、sequence 和来源信息；
- 问题 ID、`order`、原文、来源页码；
- warnings、`needs_review` 和运行时 eligibility。

组卷时先随机确定 4 或 5，再从拥有足够可用问题的 Topic 中选一个；在该 Topic 内随机选子集，最后按 `order` 排序。

### 4.3 Part 2/3 原子题组

转换后的每个元素以源 `topic.id` 为唯一关联键：

```json
{
  "topic_id": "p23_2026_01_04_001",
  "title": "想见的名人",
  "sequence": 1,
  "part2": {
    "card_id": "p23_2026_01_04_001",
    "prompt": "Describe a famous person you would like to meet",
    "cue_points": []
  },
  "part3": {
    "questions": []
  }
}
```

组卷器只能一次抽取整个对象。以 `p23_2026_01_04_001` 为例，Part 3 候选必须且只能是该对象内部的六道 `p23_2026_01_04_001_p3_q01` 至 `q06`。`category` 和 `topic_cluster` 均不得用于跨对象匹配。

Paper Snapshot 同时冻结 `part2_part3_topic_id`、Part 2 题卡和同源 Part 3 问题，评分阶段不得重新抽取或匹配。

### 4.4 数据质量

- 源数据全部写入生成题库，不静默修正文案。
- `needs_review=false` 的问题或原子题组可参与随机模考。
- `needs_review=true` 的内容保留并输出 warnings，但默认不参与随机模考。
- Part 1 Topic 至少有 4 道可用问题才可参与完整模考。
- Part 2 prompt、cue points 或 Part 3 问题缺失时，整个原子题组不可参与随机模考。
- 构建脚本必须输出总数、可用数、review 数、重复 ID 和关联校验结果，并在结构性错误时非零退出。

## 5. 提示词架构

### 5.1 Realtime 考官

新增集中式 Examiner Prompt Catalog，保存版本、默认姓名、固定口播和每题严格朗读模板。Realtime 系统提示词明确：

- 全程只说英文；
- 只扮演 IELTS 模拟考官；
- 不教学、不纠错、不评价；
- 不生成、改写或补充题目；
- 一次只朗读 Paper Snapshot 指定的一道题；
- 朗读后保持安静；
- 不根据 VAD 自行结束 Part 2；
- 不自行跳题、换 Topic、追问或结束考试；
- 状态推进完全服从客户端状态机和明确完成事件。

固定口播和姓名可在 Catalog 中替换，不需要修改考试状态机。

### 5.2 非 Realtime 评分

IELTS 评分提示词移动到：

```text
backend_java/src/main/resources/prompts/ielts/
├── language-evidence.txt
└── judge.txt
```

`QwenScoringService` 从资源文件加载。资源路径通过应用配置提供默认值，以便替换提示词后重启服务生效。

提示词必须约束：

- 只使用 Part 1–3 的 `raw_transcript`；
- 排除 `INTRODUCTION`；
- 不使用 corrected expression；
- 使用完整问题、Part、回答时长、完整考试上下文、本地客观流利度指标、讯飞证据和数据质量；
- 讯飞只作为 Pronunciation Evidence；
- 缺失证据返回 `null`，不得填零或伪造；
- 不计算 Overall Band；
- 用户可见证据、总结和警告均使用简体中文；
- 严格输出约定 JSON Schema。

每个 Attempt 保存 `prompt_version`。模型名称仍由 `QWEN_SCORING_MODEL` 和 `QWEN_IELTS_JUDGE_MODEL` 配置。

## 6. 状态机与计时

目标状态序列：

```text
READY
→ OPENING
→ INTRODUCTION
→ PART1_ANSWERING
→ PART2_PREPARING
→ PART2_ANSWERING
→ PART3_ANSWERING
→ COMPLETED
→ FINALIZING
→ REPORT
```

- 删除 `PART2_ROUNDING_OFF`。
- 回答计时必须从对应考官 `response.done` 后开始，而不是从发送 `response.create` 时开始。
- 自我介绍、Part 1、Part 2 回答达到硬上限时，状态机以 `TIME_LIMIT` 原因完成 Turn。
- Part 2 准备倒计时在准备说明播放结束后开始。
- Part 3 记录部分级别开始时间、软截止时间和硬截止时间。
- Part 3 单题达到对应时间配置时以 `TIME_LIMIT` 完成当前 Turn；若尚未达到软截止且仍有同源问题，则进入下一题。
- 软截止到达后只允许当前回答完成；硬截止到达后强制提交当前原始转写并结束考试。
- Realtime delta/completed ASR、PCM WebSocket、环形缓冲、pre-roll、post-roll 和 turn_id 对齐继续复用现有实现。

## 7. 数据与事件

Introduction Turn 至少保存：

```json
{
  "turn_type": "INTRODUCTION",
  "part": 0,
  "question_id": "introduction",
  "question_text_snapshot": "Please introduce yourself.",
  "raw_transcript": "...",
  "scoring_eligible": false,
  "completion_reason": "USER_DONE"
}
```

题目 Turn 继续保存题目快照、原始转写、音频、speech chunks 和完成原因。新增或扩展事件包括：

- `exam.opening_started`
- `turn.opened`，支持 `turn_type=INTRODUCTION`
- `examiner.response_completed`
- `turn.completed`，`reason=USER_DONE|TIME_LIMIT`
- `part2.preparation_completed`
- `part2.speaking_completed`
- `part3.soft_limit_reached`
- `part3.hard_limit_reached`
- `exam.completed`

服务端评分输入构建时必须按 `scoring_eligible` 和 Part 号过滤 Introduction。

## 8. 文件范围

### 8.1 新增

- `7.21/demo_freechat_scoring/scripts/build_ielts_question_bank.py`
- `7.21/demo_freechat_scoring/tests/test_build_ielts_question_bank.py`
- `7.21/demo_freechat_scoring/backend_java/src/main/resources/prompts/ielts/examiner-system.txt`
- `7.21/demo_freechat_scoring/backend_java/src/main/resources/prompts/ielts/language-evidence.txt`
- `7.21/demo_freechat_scoring/backend_java/src/main/resources/prompts/ielts/judge.txt`
- `7.14/UniSpeaking_Complete_UI/src/ielts/examiner-prompt-catalog.mjs`
- `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/part2_part3.json`

### 8.2 修改

- 前端题库 manifest、Part 1 生成数据和题库加载器；
- `question-bank.mjs`、`paper-assembler.mjs`；
- `exam-state-machine.mjs`、`demo-controller.mjs`；
- `ielts-session-runtime.mjs`、`views/ielts.mjs`、`app.mjs`；
- `QwenScoringService.java`、`IeltsScoringOrchestrator.java`；
- `IeltsAttemptController.java` 和必要的 Attempt/Turn 数据结构；
- `.env.example`、README 和 IELTS 实现说明。

旧的独立 Part 2/3 题库不再由 manifest 引用。

## 9. 测试与验收

自动化测试至少覆盖：

1. 两份指定 JSON 可成功转换；
2. 输出包含 72 个 Part 1 Topic；
3. 输出包含 104 个 Part 2/3 原子题组；
4. `p23_2026_01_04_001` 只能关联其自身六道 Part 3 问题；
5. 所有原子题组均无跨 Topic 问题；
6. Part 1 每场只使用一个 Topic，抽 4–5 题并按 `order` 排序；
7. Introduction 是第一个考生 Turn，保存但不参与 Band；
8. Part 2 题卡展示但不会被考官朗读；
9. 普通 VAD 停顿不结束 Part 2；
10. Part 3 软截止后不再开题，硬截止强制结束；
11. 真实时间为 Full Mock 默认值；
12. 加速开关使用确认的加速时间并写入快照；
13. 固定口播和 Prompt 资源可加载并记录版本；
14. IELTS 评价继续输出中文；
15. 严格模考不显示中间评分；
16. Java 全量测试和编译；
17. 前端全量测试；
18. 原有自由对话评分回归；
19. 浏览器完整流程：开场、自我介绍、单 Topic Part 1、Part 2 准备和长回答、同源 Part 3、结束报告。

## 10. 明确不做

- 不让 Qwen 决定抽题、换 Topic、计时或考试结束；
- 不修改两份源抽取 JSON 的格式；
- 不引入其他模型供应商；
- 不将自我介绍计入 IELTS Band；
- 不实现生产级用户身份、账单、跨设备恢复或复杂持久化；
- 不修改现有自由对话功能的行为边界。
