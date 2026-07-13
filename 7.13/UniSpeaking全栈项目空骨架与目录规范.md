# UniSpeaking 全栈项目空骨架与目录规范

> 文档状态：开发基线最终版  
> 适用范围：Web、iOS、Android、运营后台、业务 API、Realtime 网关、异步任务与基础设施  
> 上游基线：`UniSpeaking产品-AI-技术总体架构设计基线.md`  
> 目标：开发团队可依据本文直接初始化仓库、分配工作包并持续扩展，不需要重新选择仓库结构和核心技术栈。

## 1. 已锁定的技术与工程决策

| 区域 | 基线选择 | 约束 |
|---|---|---|
| 仓库 | TypeScript Monorepo | 使用 `pnpm workspace` 和 Turborepo；仅维护一个根锁文件 |
| Web | Next.js + React + TypeScript | 面向正式用户；业务按领域组织 |
| 运营后台 | Next.js + React + TypeScript | 与用户 Web 隔离部署，不复用用户路由 |
| iOS / Android | React Native + Expo Prebuild | 共用业务工程；提交 `ios/`、`android/`，允许原生扩展 |
| 客户端数据 | TanStack Query + Zustand | 服务端状态与本地交互状态分离 |
| 表单校验 | React Hook Form + Zod | 客户端不得手写另一套接口校验规则 |
| 业务 API | NestJS + Fastify | 管理长期业务事实，不承载实时媒体流 |
| Realtime | Node.js + TypeScript + Fastify | WebRTC 为目标通道，WebSocket 为诊断和备选通道 |
| 异步任务 | BullMQ + Redis | 场景生成、反馈和报告任务必须幂等 |
| 数据库 | PostgreSQL + Prisma | PostgreSQL 是长期事实唯一来源 |
| API 契约 | OpenAPI + 生成式 SDK | Web、iOS、Android 使用同一 SDK |
| Realtime 契约 | Zod + TypeScript 判别联合 | 客户端不识别供应商原始事件名 |
| AI | Provider Adapter | 首期接 Qwen；预留豆包和 ASR→LLM→TTS 管线 |
| 测试 | Vitest/Testing Library/Playwright/Maestro/Testcontainers | 契约、状态机和 Provider 必须先有测试 |
| 可观测性 | OpenTelemetry + 结构化日志 | 全链路使用 `traceId`、`callId`，不得记录密钥和原始音频 |

版本策略：初始化时选择经过官方支持的稳定版本并写入根 `package.json`、`.nvmrc` 和锁文件；生产构建禁止使用浮动版本。依赖升级通过独立变更完成，不在业务功能提交中顺带升级。

## 2. 仓库顶层结构

标记说明：

- `[M0]`：初始化仓库时必须创建并能通过检查。
- `[M1]`：自由对话首阶段启用。
- `[R]`：最终骨架中预留，启用前允许只有接口、README 和测试占位说明。

```text
unispeaking/
├── apps/                         # 所有客户端应用
│   ├── web/                      # [M1] 用户 Web
│   ├── mobile/                   # [M1] iOS + Android
│   └── admin/                    # [R] 运营与配置后台
├── services/                     # 可独立运行的服务端进程
│   ├── api/                      # [M1] 业务 API
│   ├── realtime-gateway/         # [M1] 实时会话与媒体网关
│   └── worker/                   # [R] 异步任务执行器
├── packages/                     # 无独立部署的共享包
│   ├── contracts/                # [M0] HTTP、Realtime、领域契约
│   ├── api-client/               # [M0] OpenAPI 生成 SDK
│   ├── session-core/             # [M0] 会话状态机与纯逻辑
│   ├── ai-core/                  # [M0] Prompt、策略和 Provider 契约
│   ├── database/                 # [M0] Prisma Schema 与数据库客户端
│   ├── design-tokens/            # [M0] 三端品牌与设计变量
│   ├── observability/            # [M0] 日志、追踪和指标封装
│   ├── config/                   # [M0] TS、Lint、测试公共配置
│   └── test-utils/               # [M0] Fixtures、Mock Provider、Builders
├── tests/                        # 跨应用/跨服务测试
│   ├── e2e-web/
│   ├── e2e-mobile/
│   ├── integration/
│   ├── contract/
│   ├── performance/
│   └── security/
├── infrastructure/               # 本地、云资源、部署和监控
│   ├── docker/
│   ├── compose/
│   ├── kubernetes/
│   ├── terraform/
│   └── observability/
├── docs/                         # 架构、接口、运行和产品规则
├── tooling/                      # 代码生成、检查、迁移和发布脚本
├── .changeset/                   # 内部包版本与变更说明
├── .github/                      # CI、模板、CODEOWNERS
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.mjs
├── prettier.config.mjs
├── vitest.workspace.ts
├── commitlint.config.mjs
├── lint-staged.config.mjs
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .npmrc
├── .nvmrc
├── .env.example
├── docker-compose.yml
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```

## 3. 根目录文件职责

| 文件 | 必须包含 |
|---|---|
| `README.md` | 产品一句话定位、架构图、快速启动、常用命令、目录入口、密钥安全提示 |
| `package.json` | `packageManager`、Node 版本约束、所有根脚本；根包设为 `private` |
| `pnpm-workspace.yaml` | 仅包含 `apps/*`、`services/*`、`packages/*`、`tests/*`、`tooling/*` |
| `turbo.json` | `dev`、`build`、`typecheck`、`lint`、`test`、`contract:test` 任务依赖和缓存规则 |
| `tsconfig.base.json` | 严格模式、统一模块解析和路径策略；不得声明跨层深层别名 |
| `vitest.workspace.ts` | 聚合 packages、services 与 Web 单元测试；移动端使用自己的 Jest 配置 |
| `.env.example` | 只写变量名、用途和示例占位，不写真实 Key、Workspace 或证书 |
| `docker-compose.yml` | 引用 `infrastructure/compose`，本地启动 PostgreSQL、Redis 和观测组件 |
| `CONTRIBUTING.md` | 分支、提交、测试、生成文件、迁移、Prompt 发布和 Review 规则 |
| `SECURITY.md` | 漏洞报告、密钥处理、音频/文本隐私和日志脱敏规范 |
| `CHANGELOG.md` | 面向应用和内部包的可追踪变更 |

根脚本必须统一提供：

```text
pnpm dev                 启动 Web、API、Realtime 和必要本地依赖
pnpm dev:web             只启动用户 Web
pnpm dev:mobile          启动 React Native 开发服务
pnpm dev:ios             启动 iOS
pnpm dev:android         启动 Android
pnpm dev:admin           启动运营后台
pnpm build               构建所有可构建项目
pnpm check               format + lint + typecheck + test + contract:test
pnpm test                运行单元测试
pnpm test:integration    运行跨服务集成测试
pnpm e2e:web             运行 Web 关键旅程
pnpm e2e:mobile          运行 iOS/Android Maestro 流程
pnpm db:migrate          执行开发数据库迁移
pnpm db:seed             写入非敏感本地种子数据
pnpm contracts:generate  生成 OpenAPI 和三端 SDK
pnpm mobile:prebuild     更新 ios/android 原生工程
```

## 4. Web 客户端骨架

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── (public)/              # 首页、隐私、服务条款
│   │   ├── (auth)/                # 登录与账号恢复 [R]
│   │   ├── (product)/
│   │   │   ├── free-talk/         # 自由对话 [M1]
│   │   │   ├── scenes/            # 场景广场 [R]
│   │   │   ├── professional/      # IELTS/面试 [R]
│   │   │   ├── practice/          # 记录与反馈 [R]
│   │   │   ├── profile/           # 个人主页 [R]
│   │   │   └── billing/           # 会员与专项包 [R]
│   │   ├── api/health/route.ts
│   │   ├── error.tsx
│   │   ├── global-error.tsx
│   │   ├── loading.tsx
│   │   ├── not-found.tsx
│   │   ├── layout.tsx
│   │   └── providers.tsx
│   ├── features/
│   │   ├── auth/
│   │   ├── free-talk/
│   │   ├── scene-learning/
│   │   ├── professional/
│   │   ├── practice-history/
│   │   ├── profile/
│   │   └── billing/
│   ├── realtime/
│   │   ├── audio-capture.ts
│   │   ├── audio-player.ts
│   │   ├── media-permissions.ts
│   │   ├── realtime-client.ts
│   │   ├── session-controller.ts
│   │   └── __tests__/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── env.ts
│   │   ├── feature-flags.ts
│   │   └── telemetry.ts
│   └── styles/
├── public/
├── e2e/
├── instrumentation.ts
├── middleware.ts
├── next.config.ts
├── playwright.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

Web 约束：页面只编排功能模块；`features` 不直接访问 `fetch`；所有业务请求经过 `@unispeaking/api-client`；Realtime 只消费统一事件；麦克风拒绝、无设备和非安全上下文必须有独立界面状态。

## 5. iOS 与 Android 客户端骨架

```text
apps/mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/                     # [R]
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── free-talk.tsx           # [M1]
│       ├── scenes.tsx              # [R]
│       ├── practice.tsx            # [R]
│       └── profile.tsx             # [R]
├── src/
│   ├── features/                   # 与 Web 领域名称保持一致
│   ├── realtime/
│   │   ├── call-runtime.ts
│   │   ├── realtime-client.ts
│   │   ├── playback-queue.ts
│   │   ├── interruption.ts
│   │   └── __tests__/
│   ├── native/
│   │   ├── audio-session.ts        # TS 侧统一原生接口
│   │   ├── audio-focus.ts
│   │   ├── permissions.ts
│   │   └── lifecycle.ts
│   ├── permissions/
│   ├── lifecycle/
│   ├── components/
│   ├── providers/
│   ├── hooks/
│   └── lib/
├── ios/
│   ├── UniSpeaking/
│   │   ├── AppDelegate.swift
│   │   ├── Info.plist
│   │   ├── AudioSessionModule.swift
│   │   ├── AudioSessionModule.m
│   │   └── PrivacyInfo.xcprivacy
│   ├── UniSpeakingTests/
│   ├── Podfile
│   └── UniSpeaking.xcworkspace/
├── android/
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/.../MainActivity.kt
│   │   ├── java/.../MainApplication.kt
│   │   ├── java/.../AudioFocusModule.kt
│   │   ├── java/.../AudioFocusPackage.kt
│   │   └── res/
│   ├── app/src/androidTest/
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradle.properties
├── maestro/
│   ├── free-talk.yaml
│   ├── microphone-denied.yaml
│   └── session-cleanup.yaml
├── assets/
├── app.config.ts
├── babel.config.js
├── metro.config.js
├── jest.config.js
├── eas.json
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

移动端约束：

1. iOS 和 Android 共享 API、领域逻辑、状态机和大部分页面逻辑，但不强行共享系统音频实现。
2. iOS 负责 `AVAudioSession`、麦克风权限、音频路由、蓝牙/听筒/扬声器和中断恢复。
3. Android 负责 `AudioFocus`、运行时权限、音频路由、前后台和设备差异。
4. 原生桥接只暴露稳定、最小的 TypeScript 接口，不将平台对象泄漏到业务功能。
5. `expo prebuild` 生成内容与人工原生代码要有清晰边界；升级后必须进行双端 Diff Review 和实机冒烟。

## 6. 运营后台骨架

```text
apps/admin/src/
├── app/
│   ├── prompts/
│   ├── providers/
│   ├── experiments/
│   ├── scenes/
│   ├── model-tests/
│   ├── feature-flags/
│   ├── audit-logs/
│   └── system-health/
├── features/
├── components/
├── lib/api.ts
├── lib/auth.ts
└── lib/telemetry.ts
```

后台初期为 `[R]`。正式启用前必须具备独立管理员鉴权、角色权限、变更审计、发布审批和回滚；不得通过后台展示用户原始音频或长期密钥。

## 7. 业务 API 服务骨架

```text
services/api/src/
├── main.ts
├── app.module.ts
├── bootstrap/
│   ├── config.ts
│   ├── openapi.ts
│   ├── telemetry.ts
│   └── validation.ts
├── common/
│   ├── auth/
│   ├── errors/
│   ├── idempotency/
│   ├── pagination/
│   ├── audit/
│   └── health/
└── modules/
    ├── auth/                        # [R]
    ├── users/                       # [R]
    ├── scenes/                      # [R]
    ├── practices/                   # [M1] 先存元数据
    ├── feedback/                    # [R]
    ├── professional/                # [R]
    ├── subscriptions/               # [R]
    ├── entitlements/                # [R]
    ├── experiments/                 # [M1] Prompt/策略版本
    ├── privacy/                      # [M1] 授权与删除
    └── realtime-sessions/           # [M1] 创建短期会话凭证
```

每个 API 领域模块统一采用：

```text
module-name/
├── module.ts
├── controller.ts
├── service.ts
├── repository.ts
├── dto.ts
├── mapper.ts
├── policy.ts
├── errors.ts
├── events.ts
├── index.ts
└── __tests__/
```

`controller` 只处理协议；`service` 编排用例；`repository` 隔离持久化；`policy` 处理授权和业务规则。其他模块只能从 `index.ts` 导入，禁止跨模块读取内部 Repository。

## 8. Realtime 网关骨架

```text
services/realtime-gateway/src/
├── main.ts
├── config.ts
├── health.ts
├── session/
│   ├── session-manager.ts
│   ├── session-state-machine.ts
│   ├── session-context.ts
│   ├── heartbeat.ts
│   ├── cleanup.ts
│   └── __tests__/
├── transport/
│   ├── websocket/
│   │   ├── ws-server.ts
│   │   └── ws-session.ts
│   └── webrtc/
│       ├── signaling.ts
│       ├── peer-session.ts
│       └── temporary-credential.ts
├── audio/
│   ├── formats.ts
│   ├── buffer.ts
│   ├── transcoder.ts
│   └── timing.ts
├── interruption/
│   ├── interruption-controller.ts
│   ├── late-event-guard.ts
│   └── playback-cancel.ts
├── orchestration/
│   ├── conversation-orchestrator.ts
│   ├── turn-controller.ts
│   └── recovery-policy.ts
├── providers/
│   ├── provider.ts
│   ├── provider-registry.ts
│   ├── qwen/
│   ├── doubao/                      # [R]
│   └── pipeline/                    # [R]
├── strategy/
│   ├── strategy-client.ts
│   ├── prompt-resolver.ts
│   └── policy-guard.ts
├── events/
│   ├── event-normalizer.ts
│   ├── event-sequencer.ts
│   └── business-event-publisher.ts
├── security/
│   ├── connection-auth.ts
│   ├── rate-limit.ts
│   └── secret-redaction.ts
└── observability/
    ├── call-logger.ts
    ├── metrics.ts
    └── tracing.ts
```

网关不得保存原始音频，不得直接写用户长期业务表，不得把 Provider 原始事件发给客户端。任何连接退出路径都必须释放麦克风关联、播放队列、Provider 会话、计时器和临时路由。

## 9. Worker 与异步任务骨架

```text
services/worker/src/
├── main.ts
├── queues.ts
├── jobs/
│   ├── scene-generation/
│   ├── feedback-generation/
│   ├── practice-summary/
│   ├── report-generation/
│   ├── data-deletion/
│   └── analytics-rollup/
├── retry-policy.ts
├── dead-letter.ts
├── idempotency.ts
└── observability.ts
```

每种 Job 包含 `payload.schema.ts`、`processor.ts`、`result.ts`、`errors.ts` 和测试。任务 ID 必须可幂等重放；重试有次数和退避上限；永久失败进入死信记录，不无限循环。

## 10. 共享包骨架与依赖边界

### 10.1 contracts

```text
packages/contracts/src/
├── http/
│   ├── auth.ts
│   ├── users.ts
│   ├── scenes.ts
│   ├── practices.ts
│   ├── feedback.ts
│   ├── billing.ts
│   └── realtime-session.ts
├── realtime/
│   ├── envelope.ts
│   ├── states.ts
│   ├── client-events.ts
│   ├── server-events.ts
│   ├── errors.ts
│   └── capabilities.ts
├── domain/
│   ├── user.ts
│   ├── scene.ts
│   ├── practice.ts
│   ├── feedback.ts
│   └── entitlement.ts
├── common/
│   ├── ids.ts
│   ├── pagination.ts
│   └── timestamps.ts
└── index.ts
```

`contracts` 不依赖 React、React Native、NestJS、Prisma或任何供应商 SDK。

### 10.2 其他共享包

| 包 | 内容 | 禁止内容 |
|---|---|---|
| `api-client` | 生成 SDK、鉴权注入、错误转换 | 页面状态和 UI |
| `session-core` | 纯状态机、消息合并、迟到事件、恢复决策 | DOM、原生模块、网络连接 |
| `ai-core` | Prompt Schema、策略类型、Provider capability、评测类型 | 供应商密钥和具体网络 SDK |
| `database` | Prisma Client、Schema、迁移、Seed | Controller 和业务页面 |
| `design-tokens` | JSON/TS 颜色、字号、间距、圆角、动效变量 | 跨 Web/RN 强制共享组件 |
| `observability` | 日志字段、脱敏、Trace、Metric 名称 | 产品业务判断 |
| `config` | TS、ESLint、测试、构建公共配置 | 应用运行时配置 |
| `test-utils` | Builders、Fixtures、Mock Provider、Fake Clock | 生产依赖 |

依赖方向必须满足：

```text
apps ───────┐
services ───┼──→ packages
tests ──────┘

packages 不得反向依赖 apps 或 services
contracts 不得依赖其他业务包
客户端不得依赖 database 或服务端框架
```

## 11. 数据库目录与首批模型

```text
packages/database/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── client.ts
│   ├── transaction.ts
│   └── index.ts
└── __tests__/
```

正式模型按阶段启用，但名称提前锁定：`User`、`UserPreference`、`Consent`、`RealtimeSession`、`PracticeRecord`、`SceneDefinition`、`SceneAttempt`、`FeedbackRecord`、`PromptVersion`、`ExperimentAssignment`、`ProviderUsage`、`Subscription`、`Entitlement`、`AuditLog`、`DeletionRequest`。

边界：`RealtimeSession` 只保存会话元数据、状态、耗时、Provider 和版本信息；不得将原始音频设为必填或默认持久化字段。迁移文件只允许追加，不得修改已进入共享环境的历史迁移。

## 12. AI、Prompt 与模型评测资产

```text
packages/ai-core/
├── src/
│   ├── prompts/
│   │   ├── free-talk/
│   │   ├── scene-roleplay/
│   │   ├── ielts/                  # [R]
│   │   └── interview/              # [R]
│   ├── strategy/
│   ├── policies/
│   ├── providers/
│   ├── experiments/
│   └── evaluation/
├── evals/
│   ├── datasets/
│   ├── rubrics/
│   ├── runners/
│   └── reports/
└── README.md
```

每个 Prompt 资产必须包含稳定 ID、语义版本、适用模式、输入 Schema、输出约束、变更理由和回归用例。正式环境不得通过直接修改字符串发布 Prompt；必须经过版本、测试、灰度和回滚流程。

## 13. 测试目录与门禁

| 层级 | 目录 | 必测内容 |
|---|---|---|
| 单元 | 各模块 `__tests__` | 状态机、映射、规则、幂等、错误转换 |
| 契约 | `tests/contract` | OpenAPI兼容、Realtime Schema、Provider Adapter |
| 集成 | `tests/integration` | API+PostgreSQL、Worker+Redis、网关+Mock Provider |
| Web E2E | `tests/e2e-web` | 权限、开始、对话、打断、结束、失败恢复 |
| Mobile E2E | `tests/e2e-mobile` | iOS/Android同一关键旅程与生命周期 |
| 性能 | `tests/performance` | 首包、打断、并发连接、长会话、资源清理 |
| 安全/隐私 | `tests/security` | 鉴权、限流、密钥、日志脱敏、音频不落盘、删除 |

合并门禁为：格式、Lint、类型、单元测试、契约测试、受影响项目构建全部通过。发布门禁额外要求集成测试、三端冒烟、Realtime 实机验证、数据库迁移检查和安全扫描。

## 14. 环境变量分组

`.env.example` 只预留以下分组，不提供真实值：

```text
APP_ENV
PUBLIC_WEB_URL
PUBLIC_API_URL
PUBLIC_REALTIME_URL
DATABASE_URL
REDIS_URL
JWT_ISSUER
JWT_AUDIENCE
SESSION_SIGNING_SECRET
QWEN_API_KEY
QWEN_WORKSPACE_ID
QWEN_REGION
QWEN_REALTIME_MODEL
DOUBAO_APP_ID
DOUBAO_ACCESS_TOKEN
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
OTEL_EXPORTER_OTLP_ENDPOINT
LOG_LEVEL
SENTRY_DSN
FEATURE_FREE_TALK
FEATURE_SCENE_LEARNING
FEATURE_PROFESSIONAL
FEATURE_BILLING
```

客户端仅允许暴露明确的公共 URL、公共发布标识和非敏感功能开关。任何 Provider Key、数据库连接、签名密钥、对象存储凭据都只能存在于服务端 Secret 管理系统。

## 15. 基础设施与 CI/CD 文件

```text
infrastructure/
├── compose/
│   ├── postgres.yml
│   ├── redis.yml
│   └── observability.yml
├── docker/
│   ├── web.Dockerfile
│   ├── admin.Dockerfile
│   ├── api.Dockerfile
│   ├── realtime-gateway.Dockerfile
│   └── worker.Dockerfile
├── kubernetes/
│   ├── base/
│   └── overlays/{test,staging,production}/
├── terraform/
│   ├── modules/
│   └── environments/{staging,production}/
└── observability/
    ├── dashboards/
    ├── alerts/
    └── otel-collector.yaml

.github/
├── workflows/
│   ├── ci.yml
│   ├── contract.yml
│   ├── web-deploy.yml
│   ├── services-deploy.yml
│   ├── mobile-ios.yml
│   ├── mobile-android.yml
│   ├── database-migration.yml
│   └── dependency-review.yml
├── ISSUE_TEMPLATE/
├── PULL_REQUEST_TEMPLATE.md
└── CODEOWNERS
```

第一阶段可以使用 Docker Compose 和单实例服务；Kubernetes/Terraform 目录作为 `[R]` 保留。预留不等于立即采用微服务或复杂集群。

## 16. 文档目录

```text
docs/
├── architecture/
│   ├── system-overview.md
│   ├── realtime-flow.md
│   ├── data-boundaries.md
│   └── dependency-rules.md
├── adr/
│   ├── 0001-typescript-monorepo.md
│   ├── 0002-react-native-prebuild.md
│   ├── 0003-realtime-provider-adapter.md
│   ├── 0004-webrtc-target-websocket-diagnostic.md
│   └── 0005-no-audio-persistence-by-default.md
├── api/
│   ├── openapi.json
│   └── realtime-events.md
├── product-rules/
│   ├── free-talk.md
│   ├── scene-learning.md
│   └── professional-boundaries.md
├── security/
│   ├── threat-model.md
│   ├── data-retention.md
│   └── secret-management.md
├── runbooks/
│   ├── local-development.md
│   ├── provider-handshake-failure.md
│   ├── realtime-latency.md
│   ├── incident-response.md
│   └── rollback.md
└── release/
    ├── web.md
    ├── ios.md
    ├── android.md
    └── services.md
```

## 17. 功能模块启用顺序

| 阶段 | 启用应用/模块 | 保持关闭 |
|---|---|---|
| M0 工程底座 | contracts、SDK、database、session-core、CI、本地环境 | 全部用户功能 |
| M1 自由对话 | Web、iOS、Android自由对话；API元数据；Realtime；Qwen；隐私清理 | 登录、评分、会员、专业模块 |
| M2 场景闭环 | scenes、scene-learning、worker、feedback、practice-history | IELTS/面试专业评分、付费 |
| M3 专业训练 | professional、IELTS、面试、专用资料与评价 | 通用场景替代专业规则 |
| M4 商业化 | auth、subscriptions、entitlements、billing、admin | 与口语训练无关的扩张 |

功能开关只控制是否启用，不允许用开关绕过鉴权、隐私、数据迁移或契约兼容要求。

## 18. 新增功能的固定改动路径

新增一个跨三端功能时，开发者依次检查：

1. `packages/contracts`：定义或复用领域、HTTP、Realtime 契约。
2. `services/api` 或 `services/realtime-gateway`：实现服务端用例，不把协议逻辑放进客户端。
3. `packages/api-client`：重新生成并校验 SDK。
4. `apps/web/src/features`：实现 Web 功能。
5. `apps/mobile/src/features`：实现移动共享功能。
6. `apps/mobile/ios`、`apps/mobile/android`：仅在系统能力不一致时增加原生实现。
7. `apps/admin`：只有功能需要运营配置时才增加后台页面。
8. 测试：至少补齐契约、服务端和对应客户端测试。
9. 文档：更新 ADR、接口或运行手册。
10. 观测：定义日志、指标、错误码与发布后的验证面板。

## 19. 空模块的创建规则

禁止批量创建没有意义的空文件。预留模块至少包含：

```text
module-name/
├── README.md              # 职责、状态、启用条件、明确不做
├── index.ts               # 唯一公共出口；未启用时不导出实现
├── contracts.ts           # 已确认的最小接口；没有接口则不创建
└── __tests__/             # 启用模块时随首个行为测试创建
```

`README.md` 必须回答：模块做什么、谁调用、依赖什么、输出什么、当前阶段是否启用、未来启用需要哪些前置证据。

## 20. 首批开发工作包

| 工作包 | 主要目录 | 可独立验收的结果 |
|---|---|---|
| A0 仓库底座 | 根目录、config、CI、compose | 安装、检查和空构建通过 |
| A1 统一契约 | contracts、api-client | HTTP/Realtime Schema和生成 SDK 通过契约测试 |
| A2 数据底座 | database、API health | PostgreSQL迁移、Seed、健康检查通过 |
| A3 Realtime 核心 | session-core、gateway、Mock Provider | 状态机、事件归一、清理和合约测试通过 |
| A4 Qwen 适配 | providers/qwen | 握手、文本、音频、错误和关闭事件映射通过 |
| A5 Web 自由对话 | apps/web | 权限→开始→对话→打断→结束 E2E 通过 |
| A6 iOS 自由对话 | mobile + ios | 实机完成同一旅程，AudioSession和清理通过 |
| A7 Android 自由对话 | mobile + android | 实机完成同一旅程，AudioFocus和清理通过 |
| A8 可观测与发布 | observability、infrastructure | callId串联、脱敏、Staging三端冒烟通过 |

A0-A4 是三个客户端共同前置；A5、A6、A7 可在统一契约稳定后并行开发。M2-M4 不应阻塞第一阶段链路验证。

## 21. 骨架验收标准

1. 新成员仅依据根 `README.md` 可以完成安装、启动依赖并运行检查。
2. 根目录只有一个包管理器和一个锁文件，Workspace 无循环依赖。
3. Web、iOS、Android 均能导入同一 `contracts`、`api-client` 和 `session-core`。
4. `contracts` 不依赖任何客户端、服务端框架或 Provider SDK。
5. API、Realtime、Worker 可分别启动、健康检查和部署。
6. Mock Provider 下三端可以开发，不要求每次使用真实模型和真实费用。
7. Qwen Adapter 可以替换为其他 Adapter，客户端状态机不修改。
8. 麦克风拒绝、Provider失败、断网、无回复和主动结束都进入明确状态并释放资源。
9. 原始音频默认不落盘，日志和错误均不包含长期密钥。
10. CI 能检查格式、类型、单元、契约和构建；Staging 能执行三端冒烟。
11. 场景、专业训练、个人主页和商业化已有清晰模块位置，但未启用代码不会进入首阶段运行链路。
12. 每个预留模块都有职责和启用条件，不存在无法解释的空目录。

## 22. 明确不做

- 不在骨架阶段提前拆成大量微服务。
- 不建立 Web、iOS、Android 三套重复接口和状态机。
- 不让客户端直接持有长期 Provider Key。
- 不把供应商事件名扩散到客户端和业务领域。
- 不默认保存原始音频。
- 不在自由对话中加入评分、逐句纠错或考试报告依赖。
- 不用普通场景目录替代 IELTS、面试等专业领域。
- 不为“未来可能需要”创建没有职责说明的空文件。

## 23. 初始化完成后的仓库状态

骨架初始化并不等于一次性实现所有业务。正确的初始状态是：M0 工程底座完整可运行；M1 的契约和模块入口明确；M2-M4 以 README、接口边界和功能开关预留。开发从 A0 开始，按 A1-A8 获得可验证结果，再进入场景、专业训练和商业化阶段。

本文是项目结构和责任边界的唯一基线。若后续改变 Monorepo、React Native Prebuild、Provider Adapter、WebRTC/WS 双通道、原始音频不落盘等关键决策，必须新增 ADR，并同步更新本文件和总体架构基线。
