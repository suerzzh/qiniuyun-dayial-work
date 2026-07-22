# IELTS Speaking Scoring MVP 实现说明

## 1. 实现范围

本次实现是进程内、可运行的 Demo。它把批准的 2026 年 1–4 月 JSON 题库转换为运行时题库，并扩展现有 paper assembler 和 exam state machine 以支持固定开场、自我介绍、真实/加速计时和原子化 Part 2/Part 3；不包含身份、账单、数据库、对象存储、消息队列或跨进程恢复。

模型边界固定为：

- Qwen Realtime：考官语音、ASR、VAD；
- Qwen non-Realtime：IELTS 结构化 evidence/Judge，默认 `qwen-plus`；
- iFlytek ISE：Pronunciation Evidence；
- Java：四项合法性校验、等权平均和 Overall 半分取整。

没有引入其他模型供应商。

## 2. 实际调用链

```text
IELTS state machine
  -> POST /api/ielts/attempts (冻结 paper_snapshot)
  -> 一次 getUserMedia
       -> Qwen Realtime WebRTC (/api/realtime)
            -> examiner audio
            -> raw ASR + VAD events
       -> PCM AudioContext
            -> /api/ielts/scoring-stream
            -> shared PcmAudioCapture
               (ring 5s / pre-roll 500ms / post-roll 700ms)
  -> question/turn/chunk/transcript/explicit-complete events
  -> POST attempt/finalize
       -> Qwen language evidence and all ISE calls in parallel
       -> Qwen IELTS Judge with language + ISE/acoustic/quality
       -> validate nullable FC/LR/GRA/P band suggestions
       -> Java IeltsBandCalculator
       -> COMPLETE / PARTIAL / UNSCORABLE report
  -> GET report (考后统一显示)
```

原自由对话仍使用 `/api/sessions`、`/api/realtime` 和 `/api/scoring-stream`。`ScoringStreamHandler` 与 IELTS assembler 都依赖同一个 `PcmAudioCapture`，没有复制第二套 ring/pre/post 实现。

## 3. Attempt 与 turn 数据

`IeltsAttempt` 保存：

- `attemptId`、`mode`、冻结的 `paperSnapshot`；
- `currentPart`、`questionId`、`questionTextSnapshot`；
- `turns`；
- `scoringStatus`、最终 `report`。

`IeltsTurn` 保存：

- `turnId`、Part、question ID 和完整题目快照；
- `part2LongTurn`；
- `rawTranscript`（评分唯一使用的文本）；
- 16 kHz / 16-bit / mono PCM audio segment；
- VAD speech chunks；
- open/complete 时间、完成原因和 audio-ready 状态。

所有数据只在 `IeltsAttemptRegistry` 内存中。REST 查询只返回音频 metadata，不回传 PCM bytes。

## 4. Part 2 long-turn

Part 2 的 `turn.opened` 带 `turn_type=PART2_LONG_TURN`。后端规则为：

- `turn.speech_started` 新建 speech chunk；
- `turn.speech_stopped` 只关闭 chunk；
- 多次 800 ms 或更长 VAD stop 都不会完成 logical turn；
- 只有 `part2.speaking_completed`、显式 `turn.completed` 或考试完成动作请求 finish；
- finish 后继续收 700 ms post-roll，再冻结整段 PCM；
- 浏览器在考生说话时静音 Realtime remote audio，并对 Part 2 自动 `response.created` 做 best-effort `response.cancel`。

下一个 turn 可以在前一个 post-roll 完成前打开；共享 capture 支持短暂重叠，不会丢弃前一段尾音。

## 5. 客观指标

`IeltsAcousticFeatureService` 只根据明确时间戳、raw transcript 和 VAD chunks 计算：

- answer duration；
- speech duration；
- silence ratio；
- English word count；
- speech rate；
- pause count；
- long pause count（当前阈值 2 秒）；
- filler count；
- response latency；
- Part 2 longest continuous speech duration。

没有实现可靠 PCM signal-quality 分析，因此 `audioSignalQuality=null`。缺时间戳或 speech chunks 的指标同样为 `null`，不会补零或伪造。

## 6. iFlytek evidence

`XfyunIseService.evaluatePronunciation(byte[], String)` 的旧接口保留，自由对话调用方式不变。成功结果额外保存原始 XML、provider 和实际 mode。

IELTS adapter 输出 `PronunciationEvidence`：provider、mode、confidence、provider result、raw provider result、error。该 record 没有 Band 字段。

当前实现仍调用账户现有 `read_sentence` API。即使配置请求 `topic`，只要实际实现仍是 `read_sentence`，evidence 就标记 `LOW`；不会伪装成自由口语覆盖，也不会把 ISE 0–100 分直接换算成 IELTS Band。ISE 失败只令 Pronunciation 缺失，文本三项仍可返回 PARTIAL。

## 7. Qwen structured Judge

Qwen 采用两阶段，均使用 JSON response format：`QWEN_SCORING_MODEL`（默认 `qwen-plus`）先从 raw transcript 产生 FC/LR/GRA language evidence；它与每轮 ISE future 并行。两者结束后，`QWEN_IELTS_JUDGE_MODEL`（默认 `qwen-plus`）结合 language、acoustic、ISE 和 data quality 产生四项 holistic evidence。输入包括：

- 完整 `paper_snapshot`；
- 每轮 Part、完整题目、question/turn ID；
- 全场 `raw_transcript`；
- audio byte length；
- 本地客观指标；
- 每轮原始 ISE evidence；
- data-quality warnings。

输出 schema 要求四项各自包含：

```json
{
  "band_suggestion": 6.5,
  "confidence": 0.75,
  "positive_evidence": [],
  "limiting_evidence": []
}
```

顶层还包含 `band_range`、`confidence` 和 Part 1/2/3 summaries。Prompt 明确禁止 `overall_band`，也禁止使用 corrected expression。非法 JSON 作为文本 Provider 失败；非法/非半分 band suggestion 被 Java 标为 unavailable。

## 8. Band 与三态

`IeltsBandCalculator` 是无 Provider 依赖的纯 Java 类：

```text
raw average = (FC + LR + GRA + P) / 4
Overall = round-half-up(raw average * 2) / 2
```

四项均等权。每项必须在 0–9 范围且为 0.5 步长。任一项为 `null` 时 raw average 和 Overall 都为 `null`；缺失绝不按 0 处理。

- `COMPLETE`：Qwen Judge 成功、ISE evidence 可用、四项合法且 Java 生成 Overall；
- `PARTIAL`：至少有文本维度或 Pronunciation Evidence，但缺核心维度/Provider；
- `UNSCORABLE`：没有回答，或文本和发音 evidence 均不可用。

文本模型失败但 ISE 成功时只保留 Pronunciation Evidence，不从 ISE 直接生成 P Band。ISE 失败但 Qwen 成功时保留 FC/LR/GRA，P 和 Overall 为 `null`。

## 9. REST API

```text
POST   /api/ielts/attempts
GET    /api/ielts/attempts/{attemptId}
POST   /api/ielts/attempts/{attemptId}/finalize
GET    /api/ielts/attempts/{attemptId}/scoring-status
GET    /api/ielts/attempts/{attemptId}/report
POST   /api/ielts/attempts/{attemptId}/abandon
DELETE /api/ielts/attempts/{attemptId}
```

`finalize` 幂等：正在执行返回 202；报告就绪后返回既有报告。报告未就绪时 `report` 返回 202 和 pipeline status。

## 10. WebSocket 事件

评分 WebSocket：`/api/ielts/scoring-stream?attempt_id=...`。Binary frame 为 PCM；control event 带 `event_id`、`attempt_id`、`sequence`、时间戳。

前端发送：

```text
stream.start
part.started
question.asked
turn.opened
turn.speech_started
turn.speech_stopped
turn.transcript_chunk
turn.transcript_completed
part2.speaking_completed / turn.completed
stream.end
```

后端发送：

```text
stream.ready
stream.started
turn.accepted
scoring.status
stream.warning
stream.error
```

严格模考期间 `IeltsClientEventPolicy` 只发送无分数状态，不发送 evidence、Band、纠错或建议表达。

## 11. 报告

报告包含 nullable Overall、Band range、confidence、FC/LR/GRA/P、positive/limiting evidence、Part summaries、Pronunciation Evidence、data-quality warnings 和固定免责声明。前端支持 COMPLETE、PARTIAL、UNSCORABLE 与 FINALIZING；`null` 显示 unavailable，不显示 0。

免责声明：本报告由 AI 根据本次训练音频和转写生成，仅用于学习参考，不代表 IELTS 官方成绩、认证考官评分或考试结果。

## 12. 配置

```text
DASHSCOPE_API_KEY
BAILIAN_WORKSPACE_ID
BAILIAN_MODEL
QWEN_SCORING_MODEL=qwen-plus
QWEN_IELTS_JUDGE_MODEL=qwen-plus
XFYUN_APPID
XFYUN_APIKEY
XFYUN_APISECRET
XFYUN_IELTS_MODE=read_sentence
IELTS_PROMPT_VERSION=ielts-2026-07-21.1
IELTS_EXAMINER_PROMPT_RESOURCE=classpath:prompts/ielts/examiner-system.txt
IELTS_LANGUAGE_PROMPT_RESOURCE=classpath:prompts/ielts/language-evidence.txt
IELTS_JUDGE_PROMPT_RESOURCE=classpath:prompts/ielts/judge.txt
```

密钥只存在后端环境。浏览器只调用 Java REST/WS 和 SDP proxy。

提示词集中在以下位置，可直接替换并通过配置切换，无需改 Java 业务逻辑：

- 前端固定英文考官台词与姓名：`src/ielts/examiner-prompt-catalog.mjs`；
- Realtime 考官系统约束：`backend_java/src/main/resources/prompts/ielts/examiner-system.txt`；
- FC/LR/GRA 证据：`language-evidence.txt`；
- 四维 Judge 与中文报告证据：`judge.txt`。

模型只负责逐字说出状态机提供的指令或冻结问题，以及返回结构化证据；组卷、题序、计时、Part 切换和最终 Overall 均不由提示词或模型决定。

## 13. 题库转换与完整模考流程

运行时题库由两个批准源文件生成：

```text
data/2026年1-4月P1口语分类2.2.json
data/2026年1-4月P2&P3口语分类2.27.json
```

执行 `python3 scripts/build_ielts_question_bank.py` 后，生成 Web UI 使用的 `manifest.json`、`part1.json` 和 `part2_part3.json`。当前源数据共转换 72 个 Part 1 Topic（60 个满足至少 4 道可用题）和 104 个 Part 2/P3 联合 Topic（93 个可用）。

- Part 1 只选择一个 Topic，随机取 4 或 5 题，再按原始 `order` 提问；
- Part 2 与 Part 3 保持同一个源 `topic.id` 的嵌套对象，不存在独立抽取或 `topic_cluster` 配对；
- Part 2 只展示完整题卡，考官只播报准备和开始指令；
- Part 3 只按顺序使用该 Part 2 对象下的扩展问题；
- 完整模考默认真实时长；考前可显式启用加速 Demo；
- 自我介绍音频/转写留在 Attempt 中，但 `scoring_eligible=false`，不会进入 Provider 或 Band 计算。

完整流程为：固定 `Hello` 开场 → 1 分钟内自我介绍 → Part 1 的 4/5 题 → Part 2 准备与最长 2 分钟回答 → 同 Topic Part 3 的 4–5 分钟讨论 → 固定结束语 → 考后报告。

## 14. 自动测试覆盖

Java 测试覆盖：

- 6.25/6.75 半分取整、四项等权、维度缺失和非法 band；
- Part 2 多 chunk/多停顿仍保持单 logical turn；
- shared capture 重叠 post-roll；
- 客观指标及 unavailable signal metric；
- COMPLETE/PARTIAL/UNSCORABLE；
- ISE 失败但文本成功；
- 文本失败但 Pronunciation Evidence 成功；
- Qwen 非法 JSON；
- 严格模考事件不泄漏中间评分；
- Attempt REST contract；
- 现有 free-chat session contract。

Node 测试覆盖：

- IELTS API path；
- PCM Int16 发送/资源释放；
- 单 MediaStream 同时进入 peer 和 PCM；
- strict raw transcript 只读、无中间评分；
- nullable report rendering；
- 单 Topic Part 1、随机 4/5 题后保持原序；
- Part 2/Part 3 原子 Topic ID、无 rounding-off；
- 固定开场、自我介绍排除、真实/加速时序和 Part 3 总时限；
- 原有 question bank、paper、state machine、controller 和全站回归。

Python 转换测试覆盖源字段保真、Part 1 eligibility、P2/P3 原子嵌套、manifest 与重复 ID 拒绝。

## 15. 当前限制与未完成的真实环境验证

- 已用当前配置账户完成一次静默生成音频的 Qwen/ISE 真实链路；这只能证明当前凭据和 Demo 路径可用，不能替代真人、多口音、噪声和长时考试验收。
- Qwen WebRTC 的 Part 2 `response.cancel` 是 best-effort；部署凭据下必须手工验证 2 秒/5 秒停顿无可听抢话。
- iFlytek `topic` entitlement、最大音频时长和实际字段未验证；当前只诚实使用 `read_sentence` 低置信 evidence。
- `ScriptProcessorNode` 适合 Demo，生产实现应迁移到 AudioWorklet。
- Attempt 没有 TTL；可用 DELETE 手动释放，或重启进程清空。

## 16. 本轮验证结果

2026-07-21 在本机 OpenJDK 21 工具链上实际执行：

```text
backend_java ./mvnw test: 23 passed, 0 failed, BUILD SUCCESS
7.14/UniSpeaking_Complete_UI npm test: 108 passed, 0 failed
python3 -m unittest discover -s tests: 5 passed, 0 failed
git diff --check (本次两个实现目录): passed
```

此外执行了一次真实 Qwen/ISE 付费调用，结果为 PARTIAL；详细边界见下一节。

## 17. 真实链路问题修复（2026-07-21）

本轮使用已配置账户完成了一次静默生成音频的真实 Provider 链路，并通过浏览器走通完整模考的开场 → 自我介绍 → Part 1 → Part 2 准备 → Part 2 长回答 → 同源 Part 3 → 考后报告。修复内容如下：

- `paper_snapshot` 允许合法 JSON `null`，完整模考不再因 `Map.copyOf` 抛出 500；快照仍递归只读。
- Realtime 改用 800 ms `server_vad`，`create_response=false`；VAD 只划分 speech chunks，考试推进仍由显式完成事件控制。
- 首个考官问题等待 `session.updated` 后发送，避免默认会话配置与显式问题竞态。
- 考官 `response.done` 偶发缺失时，30 秒后按 response ID 安全降级继续；迟到事件不会误触发下一轮回调。
- 前端消费 `conversation.item.input_audio_transcription.delta` / `text` 的 `text + stash`，边说边展示；结束时保留最后的 interim，减少句尾丢失。
- 实时转写和计时只更新语音面板字段，不再对整页重复执行入场动画或替换全部 DOM。
- Attempt 创建失败会回到 preflight 并显示错误，不再进入“假正在聆听”状态。
- 评分报告轮询由 15 秒延长到最多 120 秒。
- IELTS 两阶段千问 Prompt 强制用户可见证据与 Part 摘要使用简体中文；前端评价标签同步中文化。
- 报告固定渲染 FC、LR、GRA、Pronunciation 四张卡。当前 `read_sentence` ISE 成功时仍标记 LOW；若 Judge 判断证据不足，Pronunciation Band 保持 `null`，但卡片、中文限制证据和不可用原因必须显示。
- ASR 为空时保持空字符串，不再写入伪造的 Demo 回答参与评分。
- 全场没有有效 `raw_transcript` 时直接生成 `UNSCORABLE`，跳过 Qwen/ISE；重复 Provider 警告去重，嵌套 Part 摘要只展示中文 `summary` 文本。

真实 Provider 验证结果为 `PARTIAL`：FC/LR/GRA 正常返回中文证据；讯飞原始 XML 与词级结果保存成功；由于账户实际模式为 `read_sentence` 且置信度为 LOW，Pronunciation Band 未生成，符合“不把朗读分直接换算 IELTS Band”的约束。

## 18. IELTS MVP 本地改动清单

评分工程修改：`.env.example`、`README.md`、`application.properties`、`ScoringWebSocketConfig.java`、`QwenScoringService.java`、`ScoringStreamHandler.java`、`XfyunIseService.java`。

评分工程新增：

- `controller/IeltsAttemptController.java`；
- `model/ielts/IeltsAttempt.java`、`IeltsDimensionResult.java`、`IeltsReport.java`、`IeltsScoringStatus.java`；
- `service/audio/PcmAudioCapture.java`；
- `service/ielts/` 下的 `IeltsAcousticFeatureService.java`、`IeltsAcousticMetrics.java`、`IeltsAttemptRegistry.java`、`IeltsBandCalculator.java`、`IeltsClientEventPolicy.java`、`IeltsPromptCatalog.java`、`IeltsScoringOrchestrator.java`、`IeltsScoringStreamHandler.java`、`IeltsTextScorer.java`、`IeltsTurn.java`、`IeltsTurnAssembler.java`、`IeltsTwoStageTextScorer.java`、`PronunciationEvidence.java`、`PronunciationEvidenceProvider.java`、`QwenIeltsTextScorer.java`、`XfyunPronunciationEvidenceProvider.java`；
- `resources/prompts/ielts/examiner-system.txt`、`language-evidence.txt`、`judge.txt`；
- `scripts/build_ielts_question_bank.py`、`tests/test_build_ielts_question_bank.py`；
- Java 测试：`FreeChatRegressionTest.java`、`FreeChatScoringStreamRegressionTest.java`、`IeltsAttemptControllerTest.java`、`QwenScoringServiceInvalidJsonTest.java`、`QwenScoringServicePromptLanguageTest.java`、`PcmAudioCaptureTest.java`、`IeltsAcousticFeatureServiceTest.java`、`IeltsBandCalculatorTest.java`、`IeltsScoringOrchestratorTest.java`、`IeltsTurnAssemblerTest.java`、`StrictMockPolicyTest.java`；
- 本实现说明、批准计划以及 `docs/superpowers/` 下的设计与执行计划。

Web UI 修改：`README.md`、`styles.css`、`src/app.mjs`、`src/runtime-config.mjs`、`src/realtime/realtime-client.mjs`、`src/views/ielts.mjs`、`src/ielts/demo-controller.mjs`、`exam-state-machine.mjs`、`paper-assembler.mjs`、`question-bank.mjs`、`voice-answer-controller.mjs`。

Web UI 新增：`src/services/ielts-api.mjs`、`src/ielts/examiner-prompt-catalog.mjs`、`ielts-session-runtime.mjs`、`pcm-scoring-streamer.mjs`、`backend/ielts/question_bank/part2_part3.json`，以及对应的 `ielts-api`、prompt catalog、PCM streamer、session runtime 测试。其余 IELTS controller、paper、question bank、state machine、view、voice 和 static UI 测试均已更新。

题库生成结果修改 `manifest.json` 和 `part1.json`，并删除旧的独立 `part2.json`、`part3.json`。输入的两份 `data/*.json` 是用户提供的源数据，不计为生成文件；现有 `.DS_Store` 变化也不属于本实现。
