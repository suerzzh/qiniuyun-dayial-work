# 国内端到端 Realtime 语音 Demo 开发设计文档计划

## Goal

在 `/Users/mac/Documents/七牛云/7.9` 输出一份中文开发设计文档，指导后续 Web 端自由对话 Realtime 语音 Demo 开发。文档只覆盖链路验证，不进入代码实现。

## Constraints

- 不写代码，不搭建项目。
- 不做评分、纠错、CEFR、发音评测、错题本、登录、会员、录音保存、完整个人主页、复杂学习报告。
- 必须比较豆包端到端实时语音大模型与 Qwen-Omni-Realtime。
- 不确定能力标注“需要实测”。
- 文档要能指导后续开发。

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| 1. 读取项目上下文与 skills | complete | 已读取 planning-with-files 与 superpowers brainstorming，已查看 7.8 产品资料。 |
| 2. 核对供应商公开资料 | complete | Qwen 资料明确；豆包公开 API 文档不足，需权限确认。 |
| 3. 形成方案取舍与文档结构 | complete | 主方案为 Qwen-Omni-Realtime，豆包作为需权限实测的备选。 |
| 4. 写入开发设计文档 | complete | 已输出到 `7.9/国内端到端Realtime语音Demo开发设计文档.md`。 |
| 5. 自检与补齐 planning 记录 | complete | 已检查需求项、风险、验收标准和占位词。 |

## Key Decisions

- 采用文字设计文档，不做高保真页面设计。
- 页面设计只列 UI 状态，不展开视觉稿。
- 后端代理 API Key，前端不直连供应商鉴权。
- 主方案选择 Qwen-Omni-Realtime，原因是公开文档可直接指导开发。
- 豆包方案不写死能力，标注为需要权限确认和技术实测。

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| 当前目录不是 Git 仓库 | 运行 `git status --short` | 不执行提交，仅输出文档文件。 |
