# UniSpeaking 本地统一前后端与 IELTS 五维报告融合设计

**日期：** 2026-07-22  
**状态：** 已完成口头设计确认，待书面审阅  
**目标目录：** `/Users/mac/Documents/七牛云/demo/UniSpeaking_Local_Final`

## 1. 目标与范围

以 `demo/UniSpeaking_React` 为唯一产品前端基础，将 `demo/UniSpeaking_Complete_UI` 中的 IELTS Part 1/2/3 训练流程完整 React 化，并将 `demo/demo_freechat_scoring` 的 Spring Boot 能力整合为唯一业务后端。最终项目仅用于本地运行，不包含部署上线工作。

交付范围包括：

- 保留 UniSpeaking React 的产品外壳、自由对话、场景训练和其他现有页面。
- 在 React 产品路由内增加完整 IELTS 训练入口、设备检查、考试过程和考后报告。
- 统一由本地 Spring Boot 服务承载自由对话、场景训练、IELTS Attempt、Realtime 代理、PCM 评分流和报告接口。
- 保留 IELTS 官方四项 Band 与 Overall 计算，新增“任务完成度/互动回应”产品诊断维度。
- 保留四项详细报告界面，并增加 UniSpeaking 五维训练雷达图。
- 提供本地启动、停止、环境变量示例、测试与操作说明。

不在本次范围内：

- Vercel、Supabase 或其他部署上线工作。
- 登录、计费、数据库、对象存储、消息队列和分布式恢复。
- 进程重启后的会话、音频或报告持久化。
- 删除四个源目录。源目录在用户完成验收后由用户人工删除。

## 2. 最终目录与运行架构

```text
demo/UniSpeaking_Local_Final/
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   ├── components/
│   │   ├── ielts/
│   │   ├── hooks/
│   │   ├── realtime/
│   │   └── services/
│   ├── tests/
│   └── package.json
├── backend/
│   ├── src/main/java/
│   ├── src/main/resources/
│   ├── src/test/java/
│   └── pom.xml
├── scripts/
│   ├── start-local.sh
│   └── stop-local.sh
├── docs/
├── .env.example
└── README.md
```

运行时有两个本地进程：

- React/Vite 前端监听 `127.0.0.1:8080`。
- Spring Boot 后端监听 `127.0.0.1:8000`。

Vite 将 `/api` HTTP 请求及评分 WebSocket 代理到 Spring Boot。浏览器不持有 Supabase URL、publishable key 或任何服务端密钥。Qwen Realtime、Qwen 评分模型和科大讯飞 ISE 仍是外部模型服务，其密钥仅通过本地后端进程的环境变量读取。

Java 内存注册表保存自由对话 Session、IELTS Attempt、PCM、转写、评分证据和报告。Java 进程重启后这些数据全部清空。

## 3. 源项目融合策略

### 3.1 React 主前端

`UniSpeaking_React` 是前端基线。保留其产品外壳、路由模式、视觉样式、自由对话 Realtime 客户端和现有测试习惯。

### 3.2 IELTS 前端

从 `UniSpeaking_Complete_UI` 复用与 UI 无关的纯逻辑：

- IELTS JSON 题库及读取器。
- Part 1 题组和 Part 2/Part 3 原子题组组卷规则。
- 考试状态机及真实时长/加速 Demo 时序。
- Part 2 Cue Card、准备笔记锁定和长回答结束规则。
- 考官提示语目录。
- PCM 采集、16 kHz mono 转换和评分 WebSocket 协议。
- IELTS API 与 Realtime 事件适配逻辑。

旧前端的 HTML 字符串模板、手工 DOM 查询和独立应用入口不进入最终项目。它们将重写为 React 组件和 Hook。

### 3.3 Java 后端

以 `demo_freechat_scoring/backend_java` 为基线，保留自由对话回归契约、场景接口、Realtime SDP 代理、两个评分 WebSocket、IELTS Attempt 和评分编排。后端新增第五维数据模型、校验、提示词契约和雷达图输出映射。

### 3.4 不进入最终项目的内容

- `.git`、`.DS_Store`、`.m2`、`.vite`、`dist`、验收截图和编辑器配置。
- Vercel 配置和 Supabase migration/function 部署目录。
- 旧静态 HTML 应用入口和重复 CSS。
- 已被 React 或 Java 最终实现替代的历史说明、临时数据和旧启动脚本。
- 任何真实密钥或本地 `.env` 文件。

## 4. 前端信息架构与组件

IELTS 用户流程：

```text
场景广场
  → IELTS 雅思口语特训
  → 模式选择
  → 设备与服务检查
  → Part 1 / Part 2 / Part 3
  → 等待评分
  → 官方四项报告 + 五维训练雷达图
```

组件职责：

- `IeltsView`：IELTS 路由入口和顶层页面阶段切换。
- `IeltsModeSelector`：选择完整模考或单 Part 练习。
- `IeltsPreflight`：检查 Java 健康状态、模型配置和麦克风权限，选择真实时长或加速 Demo。
- `IeltsExamStage`：显示考官、当前题目、录音/聆听状态、计时及 Part 进度。
- `IeltsPart2Card`：显示但不朗读 Cue Card，管理准备笔记和长回答显式结束。
- `IeltsReportView`：展示 Overall、区间、置信度、四项详细证据、Part 总结和免责声明。
- `FiveDimensionRadar`：展示五维归一化训练诊断，不将第五维描述为官方评分标准。
- `useIeltsSession`：拥有 Attempt、Realtime、单一麦克风流、PCM WebSocket、评分轮询和资源清理。

页面只申请一次麦克风 `MediaStream`。同一流同时进入 Qwen WebRTC 和 PCM 评分处理。`useIeltsSession` 在考试完成、主动退出、异常退出和组件卸载时幂等关闭媒体轨道、PeerConnection、DataChannel、AudioContext、WebSocket 和后端 Attempt。

## 5. IELTS 考试规则

- Part 1 仅从同一个 Topic 中随机抽取 4 或 5 题，并按源题库顺序提问。
- Part 2 和 Part 3 必须来自同一个原子联合题组。
- Part 2 Cue Card 只展示，不由考官朗读。
- Part 2 普通 VAD speech stop 只结束内部语音 chunk；只有用户显式结束或状态机转换才能完成整个长回答。
- 考试中不展示逐题分数、语法纠错或建议表达。
- 原始 ASR 转写只读保存，评分不得使用改写后的表达替代原始转写。
- 完整报告在考试结束后异步生成；前端轮询同一个评分任务，不重复触发评分。

## 6. 四项官方报告与第五维

### 6.1 官方四项

官方风格训练报告保留以下四项：

1. Fluency and Coherence（FC）
2. Lexical Resource（LR）
3. Grammatical Range and Accuracy（GRA）
4. Pronunciation（P）

每项 Band 必须位于 `0–9`，步长为 `0.5`。Overall 继续只由四项等权平均并取最近的 `0.5`：

```text
Overall = roundToNearestHalf((FC + LR + GRA + P) / 4)
```

任一官方维度不可用时不生成 Overall，不以零分替代缺失项。

### 6.2 第五维

新增 `Task Achievement / Interaction Response`，中文展示为“任务完成度/互动回应”。它衡量：

- 回答是否切题。
- 是否覆盖问题或 Cue Card 的核心要求。
- 观点是否得到充分展开。
- 是否能对考官追问作出相关回应。

第五维为 `0–100` 整数，包含置信度、正向证据、限制因素和不可用原因。它是 UniSpeaking 产品训练诊断，不参与 IELTS Overall，也不对外称为 IELTS 官方第五项。

### 6.3 雷达图归一化

五维雷达图统一使用 `0–100`：

- FC、LR、GRA、P：`round(band / 9 × 100)`。
- TA：直接使用 Java 校验后的 `0–100` 分数。

缺失值保持为 `null`，不得映射为零。五项完整时绘制完整雷达多边形；数据不完整时显示可用轴、缺失标签和“部分诊断”状态，避免误导。

### 6.4 报告契约

Java 报告在保留现有字段兼容性的同时增加以下规范化字段：

```json
{
  "overallBand": 6.5,
  "scoringStatus": "COMPLETE",
  "officialDimensions": {
    "fluencyCoherence": { "band": 6.5 },
    "lexicalResource": { "band": 6.0 },
    "grammaticalRangeAccuracy": { "band": 6.5 },
    "pronunciation": { "band": 7.0 }
  },
  "taskAchievement": {
    "score": 82,
    "confidence": 0.78,
    "positiveEvidence": ["回答覆盖题目要求，并能对追问作出展开"],
    "limitingEvidence": ["部分观点缺少具体例子"],
    "unavailableReason": null
  },
  "radarDimensions": [
    { "code": "FC", "label": "流利度与连贯性", "score": 72 },
    { "code": "LR", "label": "词汇资源", "score": 67 },
    { "code": "GRA", "label": "语法多样性与准确性", "score": 72 },
    { "code": "P", "label": "发音", "score": 78 },
    { "code": "TA", "label": "任务完成度/互动回应", "score": 82 }
  ]
}
```

`scoringStatus` 描述整份报告状态；第五维缺失但官方四项完整时，Overall 仍然有效，报告界面把五维图单独标记为部分诊断。

## 7. 后端职责与数据流

### 7.1 自由对话

自由对话继续使用 Java 的 Session、SDP 代理、事件记录、质量记录、评分流和报告接口。React 的 Realtime API 适配器只指向本地 Java，不再发送 Supabase `apikey`。

### 7.2 IELTS

1. React 组卷并创建 IELTS Attempt，将不可变题目快照发送给 Java。
2. Java 返回 Attempt ID、评分 WebSocket URL和 Realtime 会话配置。
3. 浏览器使用一个麦克风流连接 Qwen WebRTC，同时把 16 kHz mono PCM 发给 Java。
4. Qwen ASR/VAD 事件与 PCM 音频通过 `turn_id` 对齐。
5. 考试结束时 React 调用 finalize；Java 幂等启动一次评分任务。
6. Java 并行获取发音证据和语言证据，再进行整体 Judge。
7. 确定性计算器校验官方四项并计算 Overall；第五维单独校验和映射。
8. React 轮询状态并渲染四项报告和五维训练雷达图。

### 7.3 模型边界

- Qwen Realtime：考官语音、ASR、VAD 和实时交互。
- Qwen 非 Realtime：语言证据、整体 IELTS Judge 和第五维证据建议。
- 科大讯飞 ISE：发音证据，不直接换算 IELTS Band。
- Java：输入校验、评分任务编排、缺失状态、官方 Overall 和雷达数据确定性映射。

## 8. 异常与降级

- `/health` 分别报告 Java、Qwen Realtime、Qwen 评分和科大讯飞配置状态，不返回密钥。
- 设备检查页在开考前验证后端可达性和麦克风权限。
- Realtime 连接失败时保留当前阶段，允许重新连接或退出，不自动无限创建 Session。
- PCM WebSocket 失败时考试可以继续，但报告标记音频证据缺失。
- Qwen 文本评分失败时返回 `PARTIAL` 或 `UNSCORABLE`，不生成模拟 Band。
- 科大讯飞失败时 Pronunciation 不可用，因此不生成 Overall；其余维度和第五维仍按可用证据展示。
- 第五维失败不影响官方四项和 Overall，只使五维图进入部分诊断状态。
- 评分轮询超时后保留 Attempt，并提供“重新获取报告”，不得重复创建评分任务。
- 所有用户提示使用简体中文；控制台和后端日志保留稳定错误代码及原始技术上下文。

## 9. 测试策略

所有新增或改变的行为遵循测试先行。

### 9.1 前端

- IELTS 路由、场景入口和刷新行为。
- 题库读取、Part 1 同 Topic、Part 2/3 原子关系。
- 考试状态机、真实/加速时序、Part 2 长回答结束。
- Attempt、SDP、评分 WebSocket、finalize、轮询和删除 API 契约。
- 四项 Band 到雷达分数的归一化以及第五维不参与 Overall。
- 完整、部分可用和不可评分报告渲染。
- Hook 对媒体轨道、WebRTC、音频上下文和 WebSocket 的幂等释放。
- 桌面及移动视口的 IELTS 核心流程浏览器验收。

### 9.2 后端

- 四项 Band 校验、等权平均和 `0.5` 取整回归。
- 第五维 `0–100` 整数校验及其不参与 Overall 的回归。
- 完整报告 JSON、兼容字段和雷达映射。
- Qwen、科大讯飞、转写或音频缺失时的降级状态。
- IELTS Attempt、Turn 对齐、Part 2 长回答和 finalize 幂等性。
- 自由对话 Session、Realtime SDP、评分 WebSocket 和报告接口回归。

### 9.3 验证命令

```bash
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build

cd ../backend
./mvnw test
```

## 10. 验收标准

1. `scripts/start-local.sh` 能启动前端和 Java，`scripts/stop-local.sh` 只停止本项目启动的进程。
2. 自由对话能通过本地 Java 创建会话、交换 SDP、进行交互并正常清理。
3. IELTS 加速 Demo 能走完 Part 1、Part 2 和 Part 3，并生成报告。
4. 报告保留官方四项详情、Overall、区间、置信度、证据和免责声明。
5. 报告同时展示五维雷达图和第五维证据，并明确其产品训练诊断属性。
6. 自动化测试证明第五维不会影响 Overall。
7. 完整和降级报告均不使用零分冒充不可用数据。
8. 桌面和移动视口不存在阻断考试操作的布局问题。
9. README 说明 Java 21、Node、环境变量、本地启动、数据易失性和验证方式。
10. 最终目录不包含部署文件、真实密钥、缓存、构建产物、验收截图或重复的旧前端入口。

## 11. 安全与清理边界

- `.env.example` 只含变量名和占位值；真实 `.env` 被 `.gitignore` 排除。
- 服务端密钥不得出现在 `VITE_` 环境变量、前端源码、测试夹具或构建产物中。
- 清理只发生在 `UniSpeaking_Local_Final` 内。
- 四个源目录在本次工作中保持原样；不运行针对它们的删除、覆盖或版本回退命令。
