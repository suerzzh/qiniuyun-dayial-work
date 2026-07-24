## UniSpeaking框架设计
AI 场景会话架构 DOM 树
│
├── 一、Controller 接口层
│   │
│   ├── FreeChatSessionController
│   │   └── start()
│   │       └── [调用] FreeChatSessionService.start()
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
│   │   ├── setSentenceScore()
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