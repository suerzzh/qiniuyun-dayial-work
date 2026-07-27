# UniSpeaking Realtime Scenario Engine Demo

这是一个独立的 Java 21 + Spring Boot demo。浏览器通过 WebRTC 与 Qwen
Omni-Realtime 进行真实语音对话；后端同时用 Qwen 生成动态场景，并从用户转写中
抽取结构化事件来驱动状态机。

当前工程不再依赖其他 UniSpeaking 后端。API Key 只保存在本地后端的 `.env` 中，
浏览器不会直接读取密钥。

## 配置是否完整

代码和项目结构已达到“本地功能 demo 可运行”的完整度，但启动前必须提供两项账号配置：

| 配置 | 是否必填 | 放置位置 | 用途 |
|---|---:|---|---|
| `DASHSCOPE_API_KEY` | 是 | `.env` | 场景生成、事件抽取、Realtime 鉴权 |
| `BAILIAN_WORKSPACE_ID` | 是 | `.env` | 拼接百炼 WebRTC 地址 |
| `BAILIAN_MODEL` | 否 | `.env` | Realtime 模型，默认 `qwen3.5-omni-plus-realtime` |
| `QWEN_REALTIME_REGION` | 否 | `.env` | `cn-beijing` 或 `ap-southeast-1` |
| `QWEN_REALTIME_VOICE` | 否 | `.env` | 全局音色覆盖；留空时按教练自动映射 |
| `SCENARIO_GENERATOR_MODEL` | 否 | `.env` | 动态场景生成，默认 `qwen-plus` |
| `SCENARIO_EXTRACTOR_MODEL` | 否 | `.env` | 旁路状态抽取，默认 `qwen3.5-flash` |

完整模板见 [`.env.example`](.env.example)，Spring 配置映射见
[`src/main/resources/application.yaml`](src/main/resources/application.yaml)。

这仍然不是生产配置：会话只保存在内存中，重启即清空；没有登录鉴权、持久化、限流、
监控和多实例状态共享。作为本机演示工程这些不是阻塞项，上线前需要补齐。

## 分层提示词已接入的位置

原文档中的英文运行提示词被拆成以下资源：

| 层 | 文件 |
|---|---|
| L1 基础职责 | `src/main/resources/prompts/base.txt` |
| L2 六名教练 | `src/main/resources/prompts/coaches.properties` |
| L3 难度 | `src/main/resources/prompts/difficulties.properties` |
| L3 语速 | `src/main/resources/prompts/speeds.properties` |
| L3 纠错偏好 | `src/main/resources/prompts/corrections.properties` |
| L4 长期记忆模板 | `src/main/resources/prompts/memory.txt` |
| L5 自定义场景 | `src/main/resources/prompts/scenes/custom.txt` |
| L5 其他预留场景 | `src/main/resources/prompts/scenes/free-chat.txt`、`ielts.txt`、`interview.txt` |

运行时由
`src/main/java/com/unispeaking/scenariodemo/prompt/LayeredPromptComposer.java`
按 L1 → L2 → L3 → L4（非空才加入）→ L5 的顺序组装，再补上当前动态场景的必达事项。
最终 Prompt 先保存在 `definition.realtimeInstruction`，随后由
`RealtimeSessionConfigFactory.java` 映射为完整的后端会话配置。页面请求
`GET /api/realtime/config/{sessionId}` 后，只会把响应中的 `session` 对象原样放入
`session.update`，不再自行拼装 Prompt。

后端配置响应同时包含 `promptLength` 和 `promptSha256`。Qwen 返回 `session.updated`
后，页面会核对回执中的 `instructions` 和 `voice`；只有两者与后端配置完全一致才会显示
“Qwen 已确认 Prompt 注入”。页面还可展开查看本次实际发送的完整 Prompt。

教练默认音色映射：

| 教练 | 默认 voice |
|---|---|
| Clara | `Serena` |
| James | `Raymond` |
| Leo | `Ryan` |
| David | `Andre` |
| Emily | `Mione` |
| Arthur | `Harvey` |

这些映射位于 `application.yaml` 的 `demo.realtime.coach-voices`，可通过
`QWEN_VOICE_CLARA` 等环境变量修改。设置非空的 `QWEN_REALTIME_VOICE` 会强制所有教练
使用同一个音色。

难度、纠错和记忆会进入 `instructions`。Qwen Realtime 没有独立的 `speed` 数值字段，
因此语速同样通过明确的 `instructions` 控制。

页面可以逐次选择教练、难度、语速和纠错方式，也可以填写本次会话相关记忆。

### 以后怎么修改

1. 改提示词正文：直接编辑上表对应的 `.txt` 或 `.properties` 文件，重启 demo。
2. 改页面和 API 的默认组合：编辑 `application.yaml` 的 `demo.prompts.defaults`，或在 `.env` 中设置
   `PROMPT_DEFAULT_COACH`、`PROMPT_DEFAULT_DIFFICULTY`、
   `PROMPT_DEFAULT_SPEED`、`PROMPT_DEFAULT_CORRECTION`。
3. 增加新教练或新档位：除了在提示词资源中增加键，还要同步修改
   `PromptProfile.java` 的允许值和 `static/index.html` 的下拉选项。
4. 改“如何把用户话题生成场景”：编辑 `QwenScenarioGenerator.java` 的
   `SYSTEM_PROMPT`。它是场景结构生成提示词，不是最终语音教练提示词。
5. 改教练音色：编辑 `.env` 中的 `QWEN_VOICE_CLARA`、`QWEN_VOICE_JAMES` 等。
   如果希望恢复按教练映射，必须保持 `QWEN_REALTIME_VOICE=` 为空。

中文提示词是英文 Prompt 的说明性对照，没有重复注入模型，以免中英文规则重复和浪费上下文。

## 启动方法

要求：macOS/Linux、JDK 21、可访问阿里云百炼。工程自带 Maven Wrapper，
本机不需要预装 Maven；第一次执行会下载 Maven 3.9.11。

```bash
cd "/Users/mac/Documents/七牛云/7.27/自定义/scenario-engine-demo"
cp .env.example .env
```

打开 `.env`，至少填入：

```properties
DASHSCOPE_API_KEY=你的百炼API-Key
BAILIAN_WORKSPACE_ID=你的百炼业务空间ID
```

然后启动：

```bash
./mvnw spring-boot:run
```

浏览器打开 <http://localhost:8081>，选择提示词组合，点击“生成场景并开始通话”，
并允许麦克风权限。

如果需要使用其他 `.env` 文件：

```bash
UNISPEAKING_ENV_FILE=/绝对路径/your.env ./mvnw spring-boot:run
```

运行测试和构建：

```bash
./mvnw test
./mvnw package
```

测试不会请求模型，不消耗模型额度；只有页面真实通话和手动调用场景接口才会请求 Qwen。

## 真实链路

```text
浏览器麦克风 ─WebRTC─> Qwen Omni-Realtime ─音频─> 浏览器
      │                       │
      │                       └─用户/AI 转写事件
      │                                  │
      └─Demo 后端 <─异步语义抽取 Qwen───┘
              │
              ├─动态场景生成
              ├─分层 Prompt 组装
              ├─按会话生成完整 Realtime 后端配置
              └─Qwen session.updated 回执校验
```

状态流：

```text
GREETING → COLLECTING_INFORMATION → CONFIRMATION → COMPLETED → CLOSING
```
