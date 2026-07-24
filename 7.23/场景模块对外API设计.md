# 场景 Model 模块设计——三合一版本减法拆解

> 架构选型：Model 驱动的场景业务内核。  
> 本文只基于《Unispeaking框架设计-三合一版》做职责删减和接口收敛，不重新设计一套新的场景体系。

## 架构选型：Model 驱动

场景模块不是 Controller 后面的数据 Service，而是可以脱离界面和交互协议独立运行的业务 Model。

```text
Web / App / 对话界面
        │
        ▼
HTTP Controller / WebSocket / Agent
        │
        ▼
Session 应用编排
        │
        ▼
Scene Model
├── 场景事实
├── 场景内容
├── 场景状态
├── 状态流转规则
└── 场景业务约束
```

界面、Controller 和 Agent 只负责把用户意图转换成 `Scene` 调用。

以下业务判断必须由 Scene Model 完成，不能写在 Controller、WebSocket Handler 或 Agent Prompt 中：

- 当前阶段能否执行某个动作；
- 自定义场景是否完成学习阶段；
- 雅思考试能否进入 Part 2 准备；
- 雅思练习模式能否重试或跳题；
- 模拟面试是否已经准备完成；
- 当前场景能否启动实时会话；
- 场景完成后能否继续修改或流转。

五个模块在该架构中的角色如下：

| 模块          | 架构角色           | 核心职责                 |
| ----------- | -------------- | -------------------- |
| 用户          | Model          | 用户、权限、画像、额度          |
| 场景          | Model          | 场景内容、状态和业务规则         |
| 评分          | Model          | 评分规则、证据和报告           |
| 会话          | Application    | 编排用户、场景、Provider 和评分 |
| AI Provider | Infrastructure | 模型、语音和外部 AI 能力适配     |

判断 Scene Model 是否拆分正确，只看一个标准：

> 不启动网页、不启动 Controller、不创建实时连接，只调用 `Scene`，仍然可以完成场景创建、阶段流转、启动校验和场景结束。

## 1. 拆分目标

UniSpeaking 拆为五个模块：

```text
用户
AI Provider
会话
场景
评分
```

场景模块只保留：

- 场景基础信息；
- 场景内容；
- 场景进度；
- 场景流程；
- 四类场景自己的状态规则；
- 场景自己的数据持久化。

场景模块不调用用户、AI Provider、会话和评分模块。

其他模块需要场景数据或场景流程能力时，只能调用场景模块公开的 `Scene` 接口。

## 2. 从三合一框架中保留的场景职责

三合一版本中真正属于场景模块的职责主要来自以下部分：

```text
SceneService
SceneContentService
SceneProgressService
SceneFlowService
CustomSceneFlowService
IeltsExamFlowService
InterviewSceneFlowService
IeltsQuestionBankService
IeltsPaperAssemblerService
IeltsFlowStateService
IeltsExamTimerService
CustomSceneLearningService
```

做减法后，它们分别负责：

| 原有类或接口 | 场景模块内保留的职责 |
|---|---|
| `SceneService` | 创建、查询和完成场景 |
| `SceneContentService` | 保存和读取场景内容 |
| `SceneProgressService` | 保存和读取当前阶段 |
| `SceneFlowService` | 统一场景流程规则 |
| `CustomSceneFlowService` | 自定义场景学习阶段流转 |
| `IeltsExamFlowService` | 雅思考试 Part 和题目流转 |
| `InterviewSceneFlowService` | 模拟面试准备、开始和完成状态 |
| `IeltsQuestionBankService` | 雅思题库加载和校验 |
| `IeltsPaperAssemblerService` | 无外部依赖的确定性组卷 |
| `IeltsFlowStateService` | 雅思考试阶段状态 |
| `IeltsExamTimerService` | 雅思考试阶段计时 |
| `CustomSceneLearningService` | 自定义场景学习材料状态 |

## 3. 场景模块唯一对外接口

场景模块的唯一对外业务接口名称为 `Scene`。

`Scene.java` 本身不写任何 `import`。接口参数和返回类型与 `Scene` 放在同一个 API 包中，因此接口文件不需要导入它们。
`SceneInfo` 是场景的"身份证+状态页"——知道是谁、什么类型、进行到哪了，但不包含具体题目内容（那是 `SceneContent`）。
`SceneContent` 是场景的"货物清单"——包含考试要用的题目、AI 提示词、VAD 配置等所有实际内容，创建后冻结不变。

```java
package com.unispeaking.scene;

public interface Scene {

    SceneInfo createScene(
        String sceneType,
        SceneContent content
    );场景模块提供一个“创建场景”的业务操作

    SceneInfo getScene(
        String sceneId
    );根据场景 ID，查询这个场景的基础信息。

    SceneInfo getSceneByType(
        String sceneType
    );根据场景类型查询该类型对应的默认场景。

    SceneContent getSceneContent(
        String sceneId
    );查询这个场景的完整业务内容

    SceneProgress getCurrentStage(
        String sceneId
    );查询场景当前进行到哪个业务阶段。

    SceneProgress advanceStage(
        String sceneId,
        String action
    );对指定场景执行一个业务动作，并由场景模块判断应该进入哪个阶段。

    boolean validateRealtimeSessionStart(
        String sceneId
    );校验指定场景当前是否允许启动实时会话。

    SceneInfo completeScene(
        String sceneId
    );结束指定场景，并返回结束后的场景信息。
}
```

`Scene` 是业务能力接口，不是 HTTP 接口，也不是 Controller 接口：

- 方法中不出现 `HttpServletRequest`、WebSocket Session 或页面参数；
- 方法中不出现用户、Provider、会话或评分模块的类型；
- 方法返回业务结果，不返回 HTTP 状态码；
- Agent 和 Controller 使用同一套 `Scene` 方法；
- Controller 被替换、界面被删除或交互改成自然语言时，Scene Model 不需要修改。

这八个方法不是新业务能力，而是从三合一版本已有接口中收敛而来：

| `Scene` 对外方法 | 三合一版本来源 |
|---|---|
| `createScene()` | `SceneService.create()`、各流程的 `generateScene()` |
| `getScene()` | `SceneService.get()` |
| `getSceneByType()` | `SceneService.getByType()` |
| `getSceneContent()` | `SceneContentService.getLocal()`、`getMaterial()`、`getDialoguePrompt()` |
| `getCurrentStage()` | `SceneFlowService.getCurrentStage()`、`SceneProgressService.get()` |
| `advanceStage()` | `SceneFlowService.advanceStage()` 和雅思场景独有流转方法 |
| `validateRealtimeSessionStart()` | `SceneFlowService.validateRealtimeSessionStart()` |
| `completeScene()` | `SceneFlowService.completeScene()`、`SceneService.setCompletedAsync()` |

## 4. 每个对外接口的职责

### 4.1 `createScene`

```java
SceneInfo createScene(
    String sceneType,
    SceneContent content
);
```

负责：

- 创建场景 ID；
- 保存场景类型；
- 保存调用方已经准备好的场景内容；
- 设置该类型场景的初始阶段；
- 返回场景基础信息。

不负责：

- 查询用户；
- 校验用户额度；
- 调用 AI 生成内容；
- 创建实时会话；
- 执行评分。

调用方式：

```text
调用方先准备内容
        │
        └── Scene.createScene(sceneType, content)
```

自定义场景和模拟面试所需的 AI 内容由外部模块准备好以后再传入。

雅思场景可以在场景模块内部使用 `IeltsQuestionBankService` 和 `IeltsPaperAssemblerService` 完成确定性组卷。组卷需要的模式、计时配置、近期题目 ID 和 Prompt 版本全部由调用方传入，场景模块不反向查询其他模块。

### 4.2 `getScene`

```java
SceneInfo getScene(String sceneId);
```

负责返回：

- 场景 ID；
- 场景类型；
- 场景状态；
- 当前阶段；
- 创建时间；
- 完成时间。

不返回会话信息和评分信息。

### 4.3 `getSceneByType`

```java
SceneInfo getSceneByType(String sceneType);
```

保留三合一版本中自由聊天场景按类型读取配置的能力。

如果同一类型允许存在多个场景，该接口应按模块现有规则返回默认场景；场景列表查询不在当前精简接口范围内。

### 4.4 `getSceneContent`

```java
SceneContent getSceneContent(String sceneId);
```

负责返回完整的场景内容。

不同场景类型对应不同内容：

| 场景类型 | 场景内容 |
|---|---|
| 自由聊天 | `SceneConfig` |
| 自定义场景 | `CustomSceneContent` |
| 雅思考试 | `IeltsPaperSnapshot` |
| 模拟面试 | `SpeakingInterviewContext` |

场景模块只保存和返回内容，不负责把这些内容转换成模型 Prompt。

### 4.5 `getCurrentStage`

```java
SceneProgress getCurrentStage(String sceneId);
```

负责返回：

- 当前场景阶段；
- 当前材料或题目位置；
- 场景是否允许进入实时会话；
- 场景是否已经结束。

### 4.6 `advanceStage`

```java
SceneProgress advanceStage(
    String sceneId,
    String action
);
```

负责：

- 根据场景类型选择对应的流程类；
- 校验当前阶段是否允许执行 `action`；
- 更新阶段或当前题目位置；
- 返回更新后的进度。

`action` 来自三合一版本已有动作：

```text
通用：
NEXT
COMPLETE

雅思：
START_PART2_PREPARATION
RETRY
SKIP
ABANDON

自定义场景：
NEXT_MATERIAL
START_DIALOGUE

模拟面试：
MARK_READY
START_INTERVIEW
```

`advanceStage()` 只更新场景流程，不处理会话事件和评分音频。

### 4.7 `validateRealtimeSessionStart`

```java
boolean validateRealtimeSessionStart(
    String sceneId
);
```

负责：

- 查询场景；
- 查询场景内容；
- 查询当前进度；
- 校验当前阶段是否允许开始实时会话；
- 返回当前场景是否允许启动实时会话。

它不负责创建实时连接，也不组装会话对象。会话模块校验通过后，分别调用 `getScene()`、`getSceneContent()` 和 `getCurrentStage()` 读取所需数据。

### 4.8 `completeScene`

```java
SceneInfo completeScene(String sceneId);
```

负责：

- 把场景设置为完成状态；
- 保存完成时间；
- 阻止后续阶段继续流转；
- 返回完成后的场景信息。

场景完成与评分报告完成是两个独立状态。场景模块不保存评分报告。

## 5. 模块中的类

### 5.1 对外类

```text
com.unispeaking.scene
├── Scene
├── SceneInfo
├── SceneContent
└── SceneProgress
```

| 类 | 类型 | 来源 | 作用 |
|---|---|---|---|
| `Scene` | 接口 | 原场景 Service 的必要方法 | 场景模块唯一业务入口 |
| `SceneInfo` | 数据结构 | `SceneService` 返回数据 | 场景基础信息 |
| `SceneContent` | 数据结构 | `SceneContentService` 返回数据 | 场景内容统一载体 |
| `SceneProgress` | 数据结构 | `SceneProgressService` 返回数据 | 场景阶段和位置 |

这些类型都位于 `com.unispeaking.scene` 包中，所以 `Scene.java` 不需要 `import`。

### 5.2 内部基础类

```text
SceneServiceImpl
SceneContentServiceImpl
SceneProgressServiceImpl
```

| 类                          | 对应的 `Scene` 接口方法                                                  | 内部职责        |
| -------------------------- | ----------------------------------------------------------------- | ----------- |
| `SceneServiceImpl`         | `createScene()`、`getScene()`、`getSceneByType()`、`completeScene()` | 场景基础信息和生命周期 |
| `SceneContentServiceImpl`  | `getSceneContent()`                                               | 场景内容保存和读取   |
| `SceneProgressServiceImpl` | `getCurrentStage()`                                               | 场景阶段保存和读取   |

`SceneServiceImpl` 作为 `Scene` 的实现入口，内部调用场景模块自己的内容、进度和流程类。

### 5.3 内部流程类

三合一版本中的 `SceneFlowService<S>` 做减法后删除 `generateScene()`，因为自定义场景和模拟面试的内容生成会调用 AI Provider。

内部流程接口只保留：

```text
SceneFlowService
├── getCurrentStage()
├── advanceStage()
├── validateRealtimeSessionStart()
└── completeScene()
```

```text
SceneFlowService
├── CustomSceneFlowService
├── IeltsExamFlowService
└── InterviewSceneFlowService
```

| 类                           | 对应的 `Scene` 接口方法                                                                        | 保留职责                                  |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| `SceneFlowService`          | `getCurrentStage()`、`advanceStage()`、`validateRealtimeSessionStart()`、`completeScene()` | 统一流程约束                                |
| `CustomSceneFlowService`    | `advanceStage()`、`validateRealtimeSessionStart()`                                       | `WORD → PHRASE → SENTENCE → DIALOGUE` |
| `IeltsExamFlowService`      | `advanceStage()`、`validateRealtimeSessionStart()`                                       | 雅思 Part、题目、准备和跳题流程                    |
| `InterviewSceneFlowService` | `advanceStage()`、`validateRealtimeSessionStart()`                                       | 面试准备、就绪、进行和完成流程                       |

### 5.4 雅思场景内部类

```text
IeltsQuestionBankService
IeltsPaperAssemblerService
IeltsFlowStateService
IeltsExamTimerService
```

这两个类可以留在场景模块，因为它们只处理题库和试卷内容。

保留职责：

- 加载和校验题库；
- 校验题目 ID、版本和可用状态；
- 组装 Part 1、Part 2 和 Part 3；
- 冻结本次考试使用的 `IeltsPaperSnapshot`；
- 保存考试阶段和阶段计时；
- 不调用用户模块查询历史；
- 如需历史避让，由调用方把已使用题目 ID 一起传入。

### 5.5 自定义场景内部类

```text
CustomSceneLearningServiceImpl
```

只保留：

- 学习材料；
- 当前材料位置；
- 单词、词组、句子完成状态。

删除：

- 音频保存；
- TTS 调用；
- 发音评分；
- 句子评分结果。

音频属于会话或 AI Provider，评分结果属于评分模块。

## 6. 场景模块可能的数据结构

以下数据结构直接对应三合一版本已经出现的数据和流程。

其中 `SceneInfo`、`SceneContent` 和 `SceneProgress` 只是把原 `SceneService`、`SceneContentService`、`SceneProgressService` 的返回数据整理为跨模块传输结构，不代表新增业务能力或新增业务 Service。

### 6.1 `SceneInfo`

```text
SceneInfo
├── sceneId: String
├── sceneType: String
├── status: String
├── currentStage: String
├── createdAt: long
├── completedAt: long
└── version: long
```

说明：

- `status` 只表示场景生命周期；
- `currentStage` 表示具体业务阶段；
- 不包含 `userId`、`sessionId` 和 `reportId`。

### 6.2 `SceneContent`

```text
SceneContent
├── sceneId: String
├── contentType: String
├── contentVersion: String
└── content: String
```

`content` 可以使用 JSON 字符串保存四种具体内容，避免公共接口依赖某个场景的内部实体。

### 6.3 `SceneProgress`

```text
SceneProgress
├── sceneId: String
├── currentStage: String
├── currentItemId: String
├── currentIndex: int
├── realtimeReady: boolean
├── completed: boolean
└── version: long
```

不同场景可以使用：

```text
自定义场景：
currentStage = WORD / PHRASE / SENTENCE / DIALOGUE
currentItemId = 当前单词、词组或句子 ID

雅思考试：
currentStage = PART1_ANSWERING / PART2_PREPARING /
               PART2_ANSWERING / PART3_ANSWERING
currentItemId = 当前题目 ID

模拟面试：
currentStage = PREPARING / INTERVIEW_READY / INTERVIEWING
```

### 6.4 `SceneConfig`

来源：三合一版本中的自由聊天 `SceneConfig`。

```text
SceneConfig
├── topic
├── role
├── goal
└── constraints
```

用户画像不放入这个结构，由会话模块或用户模块在调用 AI Provider 时自行补充。

### 6.5 `CustomSceneContent`

来源：三合一版本中的 `CustomSceneContent`。

```text
CustomSceneContent
├── words
├── phrases
├── sentences
├── learningMaterial
├── dialogueRole
├── dialogueGoal
├── keywords
└── completionCondition
```

场景模块保存这些材料，但不生成它们，也不对它们进行评分。

### 6.6 `IeltsPaperAssemblyOptions`

来源：雅思场景伪代码中的 `IeltsPaperAssemblyOptions`。

```text
IeltsPaperAssemblyOptions
├── mode
├── selectedPart
├── timingProfile
├── recentQuestionIds
└── promptVersion
```

这些字段由调用方传入。场景模块不查询用户考试历史，也不调用 `IeltsPromptService` 获取 Prompt 版本。

### 6.7 `IeltsPaperSnapshot`

来源：三合一版本中的 `IeltsPaperSnapshot`。

```text
IeltsPaperSnapshot
├── bankVersion
├── schemaVersion
├── promptVersion
├── timingProfile
├── examMode
├── part1Questions
├── part2Card
├── part3Questions
├── assemblyStrategy
└── frozen
```

它属于场景事实，创建后不可修改。

字幕、音频、单题评分和最终报告不属于 `IeltsPaperSnapshot`。

### 6.8 `SpeakingInterviewContext`

来源：三合一版本中的 `SpeakingInterviewContext`。

```text
SpeakingInterviewContext
├── minimalResumeFacts
├── jobDescriptionSummary
├── interviewDuration
├── questionConstraints
└── factBoundaries
```

简历文本提取和 AI 生成在场景模块外完成。

场景模块只保存最终的最小化面试上下文，不保存用户模块实体。

## 7. 从场景模块中删除或移出的类

### 7.1 移到 AI Provider 或外部编排

```text
SceneGenerationService
CustomSceneGenerationService
InterviewContextGenerationService

ScenePromptService
FreeChatPromptService
CustomScenePromptService
IeltsPromptService
InterviewPromptService

LlmService
TtsService
```

原因：

- 这些类负责 AI 内容生成、Prompt 构建或模型调用；
- 场景模块只接收生成完成的数据；
- 场景模块不调用 AI Provider。

### 7.2 移到会话模块

```text
FreeChatSessionService
CustomSessionService
IeltsSessionService
InterviewSessionService

SessionWebSocketHandler
SceneLearningWebSocketHandler

SessionConversationService
RealtimeConnectionService
SessionStateStore
SessionBindingTimeoutService
```

原因：

- 这些类负责建连、实时事件、字幕和会话状态；
- 场景模块只通过 `Scene` 接口提供场景数据。

### 7.3 移到评分模块

```text
SceneEvaluationService
CustomSceneEvaluationService
IeltsEvaluationService
InterviewEvaluationService

EvaluationRecordService
PronunciationService
IeltsScoringOrchestrator
IeltsBandCalculator
IeltsRadarMapper
```

原因：

- 场景模块不处理音频；
- 场景模块不计算分数；
- 场景模块不保存评分报告。

### 7.4 移到用户模块

```text
AuthService
ProfileService
UsageQuotaService
SessionMemoryService
```

原因：

- 场景模块不识别当前登录用户；
- 场景模块不查询用户画像；
- 场景模块不校验或结算用户额度。

### 7.5 拆掉的混合职责

#### `InterviewPreparationService`

三合一版本中同时调用：

- `InterviewContextGenerationService`；
- `InterviewPromptService`；
- 面试状态存储。

拆分后：

- 文本提取、AI 生成和 Prompt 构建移出场景模块；
- 调用方把最终 `SpeakingInterviewContext` 传给 `Scene.createScene()`；
- 面试阶段由 `InterviewSceneFlowService` 保存。

因此场景模块不再需要独立的 `InterviewPreparationService`。

#### `IeltsAttemptService`

三合一版本中同时包含：

- 试卷；
- 考试阶段；
- 字幕；
- 评分状态；
- 报告。

拆分后：

```text
试卷、Part、题目位置
└── 场景模块

字幕和实时事件
└── 会话模块

评分状态和报告
└── 评分模块
```

场景模块不保留包含全部职责的 `IeltsAttemptService`。

## 8. 场景模块内部关系

```text
Scene
└── SceneServiceImpl
    ├── SceneContentServiceImpl
    ├── SceneProgressServiceImpl
    │
    ├── CustomSceneFlowService
    │   └── CustomSceneLearningServiceImpl
    │
    ├── IeltsExamFlowService
    │   ├── IeltsQuestionBankService
    │   ├── IeltsPaperAssemblerService
    │   ├── IeltsFlowStateService
    │   └── IeltsExamTimerService
    │
    └── InterviewSceneFlowService
```

场景模块内部只允许依赖自己的 Repository：

```text
SceneServiceImpl
└── SceneRepository

SceneContentServiceImpl
└── SceneContentRepository

SceneProgressServiceImpl
└── SceneProgressRepository
```

## 9. 四类场景通过 `Scene` 的使用方式

### 9.1 自由聊天

```text
会话模块
├── Scene.getSceneByType(FREE_CHAT)
├── Scene.getSceneContent(sceneId)
└── Scene.validateRealtimeSessionStart(sceneId)
```

### 9.2 自定义场景

```text
外部编排准备 CustomSceneContent
└── Scene.createScene(CUSTOM_SCENE, content)
    ├── Scene.getCurrentStage(sceneId)
    ├── Scene.advanceStage(sceneId, NEXT_MATERIAL)
    ├── Scene.validateRealtimeSessionStart(sceneId)
    └── Scene.completeScene(sceneId)
```

### 9.3 雅思考试

```text
Scene.createScene(IELTS, paperInput)
├── IeltsQuestionBankService
├── IeltsPaperAssemblerService
├── Scene.advanceStage(sceneId, NEXT)
├── Scene.advanceStage(sceneId, START_PART2_PREPARATION)
├── Scene.advanceStage(sceneId, RETRY / SKIP)
└── Scene.completeScene(sceneId)
```

### 9.4 模拟面试

```text
外部编排准备 SpeakingInterviewContext
└── Scene.createScene(INTERVIEW, content)
    ├── Scene.advanceStage(sceneId, MARK_READY)
    ├── Scene.validateRealtimeSessionStart(sceneId)
    └── Scene.completeScene(sceneId)
```

## 10. Agent 直接调用 Scene Model

Agent 不接管场景业务规则，只负责把自然语言映射成 `Scene` 方法。

| 用户表达 | Agent 调用 |
|---|---|
| “创建一个餐厅点餐练习场景” | 准备 `CustomSceneContent` 后调用 `createScene()` |
| “我学完当前单词了” | 调用 `advanceStage(sceneId, NEXT_MATERIAL)` |
| “开始对话练习” | 先调用 `validateRealtimeSessionStart()`，再调用 `advanceStage()` |
| “开始雅思 Part 2 准备” | 调用 `advanceStage(sceneId, START_PART2_PREPARATION)` |
| “这道题跳过” | 调用 `advanceStage(sceneId, SKIP)` |
| “结束本次练习” | 调用 `completeScene()` |

Agent 不能自行决定：

- 跳过不允许跳过的阶段；
- 在正式雅思模式中执行练习模式动作；
- 绕过学习阶段直接开始自定义场景对话；
- 在场景完成后继续修改进度；
- 把评分完成当成场景完成。

这些限制由 `CustomSceneFlowService`、`IeltsExamFlowService` 和 `InterviewSceneFlowService` 执行。

## 11. 无界面验证标准

Scene Model 不依赖页面和 Controller，因此可以直接通过单元测试、命令行或 Agent 工具调用验证。

### 11.1 自定义场景

```text
给定：
一份已经准备好的 CustomSceneContent

执行：
createScene()
→ getCurrentStage()
→ advanceStage(NEXT_MATERIAL)
→ advanceStage(START_DIALOGUE)
→ completeScene()

验证：
阶段只能按照 CustomSceneFlowService 的规则流转
```

### 11.2 雅思考试

```text
给定：
IeltsPaperAssemblyOptions

执行：
createScene()
→ 生成并冻结 IeltsPaperSnapshot
→ advanceStage(NEXT)
→ advanceStage(START_PART2_PREPARATION)
→ advanceStage(NEXT)
→ completeScene()

验证：
Part 顺序、题目位置、准备阶段和考试模式限制正确
```

### 11.3 模拟面试

```text
给定：
一份已经准备好的 SpeakingInterviewContext

执行：
createScene()
→ validateRealtimeSessionStart() = false
→ advanceStage(MARK_READY)
→ validateRealtimeSessionStart() = true
→ completeScene()

验证：
没有准备完成时不能启动会话
```

### 11.4 独立性门禁

场景模块通过以下条件才算真正独立：

- 测试不启动 HTTP Server；
- 测试不创建 WebSocket；
- 测试不调用 LLM、TTS 或语音评分；
- 测试不创建用户、会话或评分模块对象；
- 删除 Controller 后场景测试仍然通过；
- 替换 Agent 或 View 后场景代码不需要修改。

## 12. 最终模块边界

```text
场景模块拥有
├── 场景基础信息
├── 场景内容
├── 场景进度
├── 场景流程
├── 场景题库
├── 确定性组卷
└── 场景数据持久化

场景模块不拥有
├── 用户和鉴权
├── 用户额度
├── AI 内容生成
├── Prompt 执行
├── TTS
├── 实时连接
├── 会话消息
├── 音频
├── 评分
└── 报告
```

场景模块对外只保留一句话：

> `Scene` 接收已经准备好的场景内容，保存场景事实和进度，并向其他模块提供场景查询、阶段流转和会话启动校验能力。
