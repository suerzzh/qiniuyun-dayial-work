## UniSpeaking框架设计
AI 场景会话架构 DOM 树
│
├── 一、Controller 接口层
│   │
│   ├── FreeChatSessionController
│   │   └── start()
│   │       └── [调用] FreeChatSessionService.start()
│   ├── IeltsAttemptController
│   │   ├── createAttempt()
│   │   │   └── [调用] IeltsAttemptService.createAttempt()
│   │   ├── getAttempt()
│   │   │   └── [调用] IeltsAttemptService.getAttempt()
│   │   ├── finalizeAttempt()
│   │   │   └── [调用] IeltsAttemptService.finalizeAttempt()
│   │   ├── getScoringStatus()
│   │   │   └── [调用] IeltsAttemptService.getScoringStatus()
│   │   └── getReport()
│   │       └── [调用] IeltsAttemptService.getReport()
│   │
│   └── CustomSceneController
│       ├── generateScene()
│       │   └── [调用] CustomSceneFlowService.generateScene()
│       ├── getCurrentLearningStage()
│       │   └── [调用] CustomSceneFlowService.getCurrentStage()
│       ├── advanceLearningStage()
│       │   └── [调用] CustomSceneFlowService.advanceStage()
│       └── startRealtimeSession()
│           └── [调用] CustomSessionService.start()
│
├── 二、WebSocket 接入层
│   │
│   ├── SceneLearningWebSocketHandler
│   │   ├── PLAY_MATERIAL_AUDIO
│   │   │   └── [调用]
│   │   │       CustomSceneFlowService.playLearningMaterialAudio()
│   │   ├── SENTENCE_AUDIO_START
│   │   │   └── [调用]
│   │   │       CustomSceneFlowService.startSentenceReading()
│   │   ├── SENTENCE_AUDIO_CHUNK
│   │   │   └── [调用]
│   │   │       CustomSceneFlowService.appendSentenceAudio()
│   │   └── SENTENCE_AUDIO_END
│   │       └── [调用]
│   │           CustomSceneFlowService.finishSentenceReading()
│   │
│   └── SessionWebSocketHandler
│       ├── 自由聊天事件
│       │   └── [调用] FreeChatSessionService.handleEvent()
│       ├── 雅思考试事件
│       │   └── [调用] IeltsSessionService.handleEvent()
│       ├── 雅思评分音频
│       │   ├── UTTERANCE_AUDIO_START
│       │   │   └── [调用] IeltsEvaluationService.start()
│       │   ├── UTTERANCE_AUDIO_CHUNK
│       │   │   └── [调用] IeltsEvaluationService.setAudio()
│       │   └── UTTERANCE_AUDIO_END
│       │       └── [调用] IeltsEvaluationService.finishAudio()
│       ├── 自定义场景事件
│       │   └── [调用] CustomSessionService.handleEvent()
│       └── 自定义场景评分音频
│           ├── UTTERANCE_AUDIO_START
│           │   └── [调用] CustomSceneEvaluationService.start()
│           ├── UTTERANCE_AUDIO_CHUNK
│           │   └── [调用] CustomSceneEvaluationService.setAudio()
│           └── UTTERANCE_AUDIO_END
│               └── [调用] CustomSceneEvaluationService.finishAudio()
│
├── 三、实时会话体系
│   │
│   ├── SessionService
│   │   ├── 类型：抽象父类
│   │   ├── 作用：复用自由聊天和自定义场景的建连与事件处理
│   │   │
│   │   ├── start()
│   │   │   ├── [调用] AuthService.getCurrentUserId()
│   │   │   ├── [调用] ProfileService.getProfile()
│   │   │   ├── [调用] 子类 createSession()
│   │   │   ├── [调用] 子类 prepareSession()
│   │   │   ├── [调用] UsageQuotaService.validate()
│   │   │   ├── [调用] UsageQuotaService.reserve()
│   │   │   ├── [调用] SessionStateStore.save()
│   │   │   ├── [调用] RealtimeConnectionService.createConnection()
│   │   │   └── [调用] SessionBindingTimeoutService.schedule()
│   │   │
│   │   ├── handleEvent()
│   │   │   ├── 处理模型会话绑定
│   │   │   ├── 处理暂停、恢复、中断和异常
│   │   │   ├── 字幕完成时调用子类 saveTranscript()
│   │   │   └── 会话结束时调用子类 completeSession()
│   │   │
│   │   └── 子类必须实现
│   │       ├── createSession()
│   │       ├── prepareSession()
│   │       ├── saveTranscript()
│   │       └── completeSession()
│   │
│   ├── FreeChatSessionService
│   │   ├── 类型：具体 Service
│   │   ├── [继承] SessionService
│   │   │
│   │   ├── createSession()
│   │   │   └── 创建 FreeChatSceneSession
│   │   │
│   │   ├── prepareSession()
│   │   │   ├── [调用] SceneService.getByType()
│   │   │   ├── [调用] SceneService.validateAccess()
│   │   │   └── [调用] FreeChatPromptService.buildPrompt()
│   │   │
│   │   ├── saveTranscript()
│   │   │   └── [调用] FreeChatConversationService.appendMessage()
│   │   │
│   │   └── completeSession()
│   │       ├── [调用] UsageQuotaService.settle()
│   │       └── [调用] SessionMemoryService.updateMemory()
│   ├── IeltsSessionService
│   │   ├── 类型：具体 Service
│   │   ├── [继承] SessionService
│   │   │
│   │   ├── createSession()
│   │   │   └── 创建 IeltsAttempt
│   │   │
│   │   ├── prepareSession()
│   │   │   ├── [调用]
│   │   │   │   IeltsAttemptService.validateRealtimeSessionStart()
│   │   │   └── [调用] IeltsPromptService.buildPrompt()
│   │   │
│   │   ├── saveTranscript()
│   │   │   ├── [调用] IeltsAttemptService.setTranscript()
│   │   │   ├── [调用] IeltsAttemptService.saveTranscriptAsync()
│   │   │   └── 用户字幕调用
│   │   │       IeltsEvaluationService.setTranscript()
│   │   │
│   │   └── completeSession()
│   │       ├── [调用] IeltsEvaluationService.getFinalReport()
│   │       ├── [调用] IeltsAttemptService.setReport()
│   │       ├── [调用] IeltsAttemptService.saveReportAsync()
│   │       └── [调用] UsageQuotaService.settle()
│   │
│   └── CustomSessionService
│       ├── 类型：具体 Service
│       ├── [继承] SessionService
│       │
│       ├── createSession()
│       │   └── 创建 CustomSceneSession
│       │
│       ├── prepareSession()
│       │   ├── [调用]
│       │   │   CustomSceneFlowService.validateRealtimeSessionStart()
│       │   ├── [调用] SceneContentService.getDialoguePrompt()
│       │   └── [调用] CustomScenePromptService.buildPrompt()
│       │
│       ├── saveTranscript()
│       │   ├── [调用] SessionConversationService.setMessage()
│       │   ├── [调用] SessionConversationService.saveMessageAsync()
│       │   └── 用户字幕调用
│       │       CustomSceneEvaluationService.setTranscript()
│       │
│       └── completeSession()
│           ├── [调用] CustomSceneEvaluationService.getFinalReport()
│           ├── [调用] EvaluationRecordService.setReport()
│           ├── [调用] EvaluationRecordService.saveReportAsync()
│           ├── [调用] SessionConversationService.saveConversationAsync()
│           ├── [调用] CustomSceneFlowService.completeScene()
│           └── [调用] UsageQuotaService.settle()
│
├── 四、自定义场景流程体系
│   │
│   ├── SceneFlowService<S>
│   │   ├── 类型：接口
│   │   ├── 作用：规定训练场景需要具备的基本流程能力
│   │   ├── generateScene()
│   │   ├── getCurrentStage()
│   │   ├── advanceStage()
│   │   ├── validateRealtimeSessionStart()
│   │   └── completeScene()
│   │
│   ├── IeltsExamFlowService
│   │   ├── 类型：具体 Service
│   │   ├── [实现] SceneFlowService<IeltsStage>
│   │   ├── 作用：组装雅思试卷快照并驱动考试状态流转
│   │   │
│   │   ├── generateScene()
│   │   │   ├── [调用] IeltsQuestionBankService.loadAndValidate()
│   │   │   ├── [调用] IeltsPaperAssemblerService.assemble()
│   │   │   ├── [调用] IeltsAttemptService.setPaperSnapshot()
│   │   │   └── [调用] IeltsFlowStateService.set(READY)
│   │   │
│   │   ├── getCurrentStage()
│   │   │   ├── [调用] IeltsFlowStateService.get()
│   │   │   └── [调用] IeltsAttemptService.getPaperSnapshot()
│   │   │
│   │   ├── advanceStage()
│   │   │   ├── [调用] IeltsFlowStateService.get()
│   │   │   ├── 判断 READY → OPENING → INTRODUCTION → PART1_ANSWERING
│   │   │   ├── 判断 PART1_ANSWERING → PART2_PREPARING → PART2_ANSWERING
│   │   │   ├── 判断 PART2_ANSWERING → PART3_ANSWERING → REPORT
│   │   │   ├── [调用] IeltsFlowStateService.transition()
│   │   │   └── [调用] IeltsAttemptService.setCurrentStage()
│   │   │
│   │   ├── validateRealtimeSessionStart()
│   │   │   ├── [调用] IeltsAttemptService.getAttempt()
│   │   │   ├── [调用] IeltsAttemptService.validatePaperSnapshot()
│   │   │   └── [调用] IeltsPromptService.getExaminerPrompt()
│   │   │
│   │   ├── completeScene()
│   │   │   ├── [调用] IeltsFlowStateService.set(REPORT)
│   │   │   └── [调用] IeltsAttemptService.finalizeAttempt()
│   │   │
│   │   ├── 雅思考试独有方法
│   │   │
│   │   ├── startPart2Preparation()
│   │   │   ├── [调用] IeltsFlowStateService.set(PART2_PREPARING)
│   │   │   └── [调用] IeltsExamTimerService.startPreparationTimer()
│   │   │
│   │   ├── retryCurrentQuestion()
│   │   │   └── [调用] IeltsFlowStateService.transition(RETRY)
│   │   │
│   │   ├── skipCurrentQuestion()
│   │   │   └── [调用] IeltsFlowStateService.transition(NEXT)
│   │   │
│   │   └── abandonAttempt()
│   │       ├── [调用] IeltsFlowStateService.set(ABANDONED)
│   │       └── [调用] IeltsAttemptService.abandonAttempt()
│   │
│   └── CustomSceneFlowService
│       ├── 类型：具体 Service
│       ├── [实现] SceneFlowService<CustomStage>
│       │
│       ├── generateScene()
│       │   ├── [调用] SceneService.create()
│       │   ├── [调用] CustomSceneGenerationService.generate()
│       │   ├── [调用] SceneContentService.setLocal()
│       │   ├── [调用] SceneContentService.saveAsync()
│       │   └── [调用] SceneProgressService.set(WORD)
│       │
│       ├── getCurrentStage()
│       │   ├── [调用] SceneProgressService.get()
│       │   └── [调用] SceneContentService.getLocal()
│       │
│       ├── advanceStage()
│       │   ├── [调用] SceneProgressService.get()
│       │   ├── 判断 WORD → PHRASE → SENTENCE
│       │   ├── [调用] SceneProgressService.set()
│       │   └── [调用] SceneContentService.getLocal()
│       │
│       ├── validateRealtimeSessionStart()
│       │   ├── [调用] SceneService.get()
│       │   ├── [调用] SceneProgressService.get()
│       │   └── [调用] SceneContentService.getDialoguePrompt()
│       │
│       ├── completeScene()
│       │   ├── [调用] SceneProgressService.set(REPORT)
│       │   └── [调用] SceneService.setCompletedAsync()
│       │
│       ├── 自定义场景独有方法
│       │
│       ├── playLearningMaterialAudio()
│       │   ├── [调用] SceneContentService.getMaterial()
│       │   ├── [调用] TtsService.getAudio()
│       │   └── [调用] CustomSceneLearningService.setAudio()
│       │
│       ├── startSentenceReading()
│       │   └── [调用] PronunciationService.start()
│       │
│       ├── appendSentenceAudio()
│       │   └── [调用] PronunciationService.setAudio()
│       │
│       └── finishSentenceReading()
│           ├── [调用] PronunciationService.getResult()
│           ├── [调用] SceneContentService.setSentenceScore()
│           ├── [调用] SceneContentService.saveSentenceScoreAsync()
│           ├── [调用] CustomSceneLearningService.setSentenceScore()
│           └── 全部句子通过后：
│               [调用] SceneProgressService.set(DIALOGUE_READY)
│
├── 五、场景生成体系
│   │
│   ├── SceneGenerationService<R>
│   │   ├── 类型：接口
│   │   ├── 作用：定义场景内容生成能力
│   │   └── generate()
│   │
│   ├── IeltsQuestionBankService
│   │   ├── 类型：具体 Service
│   │   ├── 作用：加载并校验原子化雅思题库
│   │   │
│   │   └── loadAndValidate()
│   │       ├── 加载 manifest、Part 1 题组和 Part 2/Part 3 组合题库
│   │       ├── 校验题库版本、Schema 版本和全局 ID 唯一性
│   │       ├── 校验题目状态、eligible 标记和题目顺序
│   │       ├── 校验 Part 1 至少存在一个包含四道可用题目的题组
│   │       ├── 校验 Part 2 卡片与 Part 3 追问题属于同一原子 Topic
│   │       └── 返回已标准化的 IeltsQuestionBank
│   │
│   ├── IeltsPaperAssemblerService
│   │   ├── 类型：具体 Service
│   │   ├── [实现] SceneGenerationService<IeltsPaperSnapshot>
│   │   ├── 作用：确定性组装本次考试使用的不可变 PaperSnapshot
│   │   │
│   │   ├── generate()
│   │   │   ├── [调用] IeltsQuestionBankService.loadAndValidate()
│   │   │   └── [调用] assemble()
│   │   │
│   │   └── assemble()
│   │       ├── 校验 full_mock 或 practice_part 考试模式
│   │       ├── 校验 real_exam 或 accelerated_demo 计时配置
│   │       ├── Part 1 从同一 Topic 选择四至五道不重复题目并保持原顺序
│   │       ├── Part 2 与 Part 3 作为同一 Topic 的原子组合选择
│   │       ├── 优先避开最近已完成考试使用过的题目，候选耗尽时允许放宽
│   │       ├── 注入 bankVersion、schemaVersion、promptVersion 和 timingProfile
│   │       ├── 记录组卷策略、历史避让结果和各 Part 内容
│   │       └── 深度冻结并返回 IeltsPaperSnapshot
│   │   
│   └── CustomSceneGenerationService
│       ├── 类型：具体 Service
│       ├── [实现] SceneGenerationService<CustomSceneContent>
│       │
│       └── generate()
│           ├── 构建自定义场景生成 Prompt
│           ├── [调用] LlmService.generateStructuredContent()
│           └── 返回单词、词组、句子和对话提示词
│
├── 六、Prompt 体系
│   │
│   ├── ScenePromptService<C>
│   │   ├── 类型：接口
│   │   ├── 作用：定义不同会话构建系统 Prompt 的能力
│   │   └── buildPrompt()
│   │
│   ├── FreeChatPromptService
│   │   ├── 类型：具体 Service
│   │   ├── [实现] ScenePromptService<FreeChatPromptContext>
│   │   └── buildPrompt()
│   │       ├── 使用用户画像
│   │       └── 使用自由聊天 SceneConfig
│   │
│   ├── IeltsPromptService
│   │   ├── 类型：具体 Service
│   │   ├── [实现] ScenePromptService<IeltsPromptContext>
│   │   ├── 作用：统一管理版本化的雅思考官与评分 Prompt
│   │   │
│   │   └── buildPrompt()
│   │       ├── [调用] IeltsPromptCatalog.examinerSystem()
│   │       ├── [调用] IeltsAttemptService.getPaperSnapshot()
│   │       ├── 注入固定考官指令或 PaperSnapshot 中的冻结题目
│   │       ├── 约束考官仅使用英语，不教学、不纠错、不评分
│   │       └── 题目顺序、计时和阶段流转由 IeltsExamFlowService 控制
│   │   
│   └── CustomScenePromptService
│       ├── 类型：具体 Service
│       ├── [实现] ScenePromptService<CustomScenePromptContext>
│       └── buildPrompt()
│           ├── [调用] SceneContentService.getDialoguePrompt()
│           └── 注入用户等级、角色、目标、关键词和结束条件
│
├── 七、场景评分体系
│   │
│   ├── SceneEvaluationService
│   │   ├── 类型：接口
│   │   ├── 作用：规定训练场景的评分能力
│   │   ├── start()
│   │   ├── setAudio()
│   │   ├── finishAudio()
│   │   ├── setTranscript()
│   │   ├── getTurnResult()
│   │   └── getFinalReport()
│   │
│   ├── IeltsEvaluationService
│   │   ├── 类型：具体 Service
│   │   ├── [实现] SceneEvaluationService
│   │   ├── 作用：采集雅思考试证据并在考试结束后生成五维训练报告
│   │   │
│   │   ├── start()
│   │   │   ├── [调用] IeltsTurnAssembler.open()
│   │   │   └── 创建包含 Part、冻结题目和 scoringEligible 的评分轮次
│   │   │
│   │   ├── setAudio()
│   │   │   └── [调用] IeltsTurnAssembler.appendPcm()
│   │   │
│   │   ├── finishAudio()
│   │   │   ├── [调用] IeltsTurnAssembler.complete()
│   │   │   └── 仅显式完成或时间上限结束逻辑轮次，VAD 停顿不结束 Part 2
│   │   │
│   │   ├── setTranscript()
│   │   │   ├── [调用] IeltsTurnAssembler.transcript()
│   │   │   └── 只保存 rawTranscript，不生成或保存纠正表达
│   │   │
│   │   ├── getTurnResult()
│   │   │   ├── [调用] IeltsClientEventPolicy.turnScored()
│   │   │   └── 返回 TURN_CAPTURED，考试过程中不暴露单题分数
│   │   │
│   │   └── getFinalReport()
│   │       ├── [调用] IeltsScoringOrchestrator.score()
│   │       ├── 仅保留 Part 1、Part 2、Part 3 已完成且可评分的回答
│   │       ├── [调用] IeltsAcousticFeatureService.calculate()
│   │       ├── [调用] PronunciationEvidenceProvider.evaluate()
│   │       │   └── [实现] XfyunPronunciationEvidenceProvider
│   │       ├── [调用] IeltsTwoStageTextScorer.languageEvidence()
│   │       ├── [调用] IeltsTwoStageTextScorer.holisticJudge()
│   │       │   └── [实现] QwenIeltsTextScorer
│   │       ├── [调用] IeltsBandCalculator.calculate()
│   │       ├── [调用] IeltsRadarMapper.map()
│   │       └── 生成 Overall、五维雷达数据、分项证据、Part 总结和免责声明
│   │
│   └── CustomSceneEvaluationService
│       ├── 类型：具体 Service
│       ├── [实现] SceneEvaluationService
│       │
│       ├── start()
│       │   └── 创建本轮 utteranceId 和评分上下文
│       │
│       ├── setAudio()
│       │   └── [调用] PronunciationService.setAudio()
│       │
│       ├── finishAudio()
│       │   └── [调用] PronunciationService.getResult()
│       │
│       ├── setTranscript()
│       │   ├── [调用] SessionConversationService.getMessages()
│       │   ├── [调用] LlmService.evaluateCustomSceneAnswer()
│       │   └── [调用] LlmService.getRecommendedExpressionAsync()
│       │
│       ├── getTurnResult()
│       │   ├── 汇总发音、流利度、语法、词汇和上下文评分
│       │   ├── [调用] EvaluationRecordService.setTurnResult()
│       │   └── [调用] EvaluationRecordService.saveTurnResultAsync()
│       │
│       └── getFinalReport()
│           ├── [调用] EvaluationRecordService.getTurnResults()
│           ├── [调用] SessionConversationService.getMessages()
│           └── 汇总总分、五维分数、错误和推荐表达
│
├── 八、模型能力 Service
│   │
│   ├── LlmService
│   │   ├── 类型：接口
│   │   ├── generateStructuredContent()
│   │   ├── evaluateCustomSceneAnswer()
│   │   └── getRecommendedExpressionAsync()
│   │
│   ├── LlmServiceImpl
│   │   ├── [实现] LlmService
│   │   └── [调用] LlmProvider.generate()
│   │
│   ├── TtsService
│   │   ├── 类型：接口
│   │   └── getAudio()
│   │
│   ├── TtsServiceImpl
│   │   ├── [实现] TtsService
│   │   └── [调用] TtsProvider.synthesize()
│   │
│   ├── PronunciationService
│   │   ├── 类型：接口
│   │   ├── start()
│   │   ├── setAudio()
│   │   └── getResult()
│   │
│   └── PronunciationServiceImpl
│       ├── [实现] PronunciationService
│       └── [调用] PronunciationProvider
│
├── 九、场景公共 Service
│   │
│   ├── SceneService
│   │   ├── 类型：接口
│   │   ├── create()
│   │   ├── get()
│   │   ├── getByType()
│   │   ├── validateAccess()
│   │   ├── setGenerationFailed()
│   │   └── setCompletedAsync()
│   │
│   ├── SceneServiceImpl
│   │   ├── [实现] SceneService
│   │   └── [调用] SceneRepository
│   │
│   ├── SceneContentService
│   │   ├── 类型：接口
│   │   ├── setLocal()
│   │   ├── getLocal()
│   │   ├── getMaterial()
│   │   ├── saveAsync()
│   │   ├── setSentenceScore()
│   │   ├── saveSentenceScoreAsync()
│   │   ├── getDialoguePrompt()
│   │   └── expireLocal()
│   │
│   ├── SceneContentServiceImpl
│   │   ├── [实现] SceneContentService
│   │   ├── 使用本地 HashMap 保存场景运行时内容
│   │   └── [调用] SceneContentRepository
│   │
│   ├── SceneProgressService
│   │   ├── 类型：接口
│   │   ├── set()
│   │   └── get()
│   │
│   └── SceneProgressServiceImpl
│       ├── [实现] SceneProgressService
│       └── [调用] SceneProgressRepository
│
├── 十、会话与评分数据 Service
│   │
│   ├── FreeChatConversationService
│   │   ├── 类型：接口
│   │   ├── appendMessage()
│   │   └── getMessages()
│   │
│   ├── FreeChatConversationServiceImpl
│   │   ├── [实现] FreeChatConversationService
│   │   └── [调用] FreeChatConversationStore
│   │
│   ├── SessionConversationService
│   │   ├── 类型：接口
│   │   ├── setMessage()
│   │   ├── saveMessageAsync()
│   │   ├── getMessages()
│   │   ├── saveConversationAsync()
│   │   └── clearLocal()
│   │
│   ├── SessionConversationServiceImpl
│   │   ├── [实现] SessionConversationService
│   │   ├── 使用本地 HashMap 保存实时字幕
│   │   └── [调用] SessionConversationRepository
│   │
│   ├── EvaluationRecordService
│   │   ├── 类型：接口
│   │   ├── setTurnResult()
│   │   ├── saveTurnResultAsync()
│   │   ├── getTurnResults()
│   │   ├── setRecommendation()
│   │   ├── saveRecommendationAsync()
│   │   ├── setReport()
│   │   ├── saveReportAsync()
│   │   └── clearLocal()
│   │
│   └── EvaluationRecordServiceImpl
│       ├── [实现] EvaluationRecordService
│       ├── 使用本地 HashMap 保存实时评分
│       └── [调用] EvaluationRepository
│
├── 十一、自定义场景学习阶段的单词、词组、句子及跟读评分管理
│   │
│   ├── CustomSceneLearningService
│   │   ├── 类型：接口
│   │   ├── setMaterials()
│   │   ├── setAudio()
│   │   └── setSentenceScore()
│   │
│   └── CustomSceneLearningServiceImpl
│       └── [实现] CustomSceneLearningService
│
└── 十二、公共会话基础能力
    │
    ├── AuthService
    │   └── getCurrentUserId()
    │
    ├── ProfileService
    │   └── getProfile()
    │
    ├── UsageQuotaService
    │   ├── validate()
    │   ├── reserve()
    │   ├── startMetering()
    │   ├── settle()
    │   └── release()
    │
    ├── RealtimeConnectionService
    │   ├── 类型：接口
    │   └── createConnection()
    │
    ├── RealtimeConnectionServiceImpl
    │   ├── [实现] RealtimeConnectionService
    │   ├── [调用] RealtimeCredentialService.getTemporaryCredential()
    │   └── [调用] RealtimeProvider.exchangeSdp()
    │
    ├── SessionBindingTimeoutService
    │   ├── schedule()
    │   └── cancel()
    │
    ├── SessionStateStore
    │   ├── save()
    │   ├── get()
    │   └── delete()
    │
    └── SessionMemoryService
        └── updateMemory()

## 最终继承与实现关系
SessionService
├── FreeChatSessionService
└── CustomSessionService

SceneFlowService<S>
└── CustomSceneFlowService

SceneGenerationService<R>
└── CustomSceneGenerationService

ScenePromptService<C>
├── FreeChatPromptService
└── CustomScenePromptService

SceneEvaluationService
└── CustomSceneEvaluationService

## 两条核心业务链
### 自由聊天

FreeChatSessionService
├── SceneService
├── FreeChatPromptService
├── FreeChatConversationService
├── RealtimeConnectionService
└── SessionMemoryService

### 自定义场景

CustomSceneFlowService
├── SceneService
├── CustomSceneGenerationService
│   └── LlmService
├── SceneContentService
├── SceneProgressService
├── CustomSceneLearningService
├── TtsService
└── PronunciationService

CustomSessionService
├── CustomSceneFlowService
├── CustomScenePromptService
├── SessionConversationService
└── CustomSceneEvaluationService
    ├── PronunciationService
    ├── LlmService
    └── EvaluationRecordService