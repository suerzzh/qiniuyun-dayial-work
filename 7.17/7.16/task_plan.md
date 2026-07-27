# UniSpeaking Free Chat Integration Plan

## Goal

以完整 UI 产品原型为主应用，将新版自由对话 Demo 的真实麦克风、实时连接、音频播放、字幕和会话控制能力模块化接入，并完成本地验证；不部署 Preview 或 Production，不修改生产数据。

## Constraints

- 保护父仓库和相邻目录的现有未提交改动。
- 仅在 `codex/integrate-free-chat-v2` 分支工作。
- API Key 和服务端密钥不得进入浏览器构建、日志或提交文件。
- 使用仓库现有包管理器，不全量升级依赖。
- 不使用 iframe、双 React 根应用跳转、假对话或前端密钥。
- 不修改生产 Supabase，不部署 Vercel。

## Phases

1. **工作区保护与项目审计 — complete**
   - 识别 UI、Demo、前后端入口、实时链路、环境变量、Vercel/Supabase 结构。
   - 输出 `docs/free-chat-integration-audit.md`。
2. **融合设计与实施计划 — complete**
   - 比较融合方案并确定模块边界、状态机、数据流、错误与清理策略。
   - 输出设计说明和精确实施计划。
3. **TDD 实施 — complete**
   - 先为关键纯逻辑/状态映射/协议处理编写失败测试，再实现模块化融合。
4. **安全与资源生命周期复核 — complete**
   - 检查客户端密钥、单例资源、卸载清理、暂停/重连/结束路径。
5. **自动化验证 — complete**
   - 安装依赖；检查 env 名称和缺失状态；运行 lint、typecheck、test、build。
6. **本地运行与浏览器验收 — complete**
   - 启动前后端；检查 UI、路由刷新、控制台、网络、麦克风与真实链路可验证部分。
7. **文档与最终复核 — complete**
   - 更新 README、`.env.example`；创建 `docs/free-chat-integration-result.md`。

## Decisions

- `7.16` 是父仓库 `/Users/mac/Documents/七牛云` 中的未跟踪目录；所有业务修改限定在 `7.16`。
- 用户已提供详细架构和验收约束，并明确要求审计后直接实施，因此不设置额外设计确认停顿。
- 采用当前目录专用分支而非新增 worktree：`7.16` 整体未被 Git 跟踪，新 worktree 不会包含待融合代码。
- 采用本地 Python 后端适配方案；历史 Supabase Edge Function 只做部署现状参考。
- 使用显式重试而非无限自动重连，满足产品“自动重连或提示重试”并避免重复 session。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 对 `/Users/mac` 的全盘 `find` 返回非零，导致后续技能读取命令未执行 | 1 | 改用限定范围的 `rg --files`，不重复全盘扫描 |
| UI 旧 Node 测试 9/13 失败 | 1 | 根因是测试与 React 重构后的源码路径不一致；实施阶段按当前结构重写关键测试 |
| UI Vite build 缺少 Rollup macOS optional dependency | 1 | 根因是复制的 `node_modules` 与当前环境不匹配；使用现有 npm lockfile 执行 `npm ci` |
| Task 1 首次大补丁因 npm 已调整 `package.json` 排序而上下文不匹配 | 1 | 拆成小补丁并基于最新文件内容应用，未产生部分业务修改 |
| React Hook 首次按设计名接线后 typecheck/build 发现底层实际导出名不同 | 1 | 读取真实模块签名后适配 `applyRealtimeEvent`、`audioPlayback`、`setPaused` 等接口，build 恢复通过 |
| 浏览器首张截图只显示头部 | 1 | DOM 边界正常；等待浏览器完成合成帧后移动/桌面视觉均正常，无 CSS 修改需要 |
| 文字框 Enter 在应用内浏览器未触发表单提交 | 1 | 使用表单内唯一 submit 按钮复测，用户气泡和第二轮 AI 回复通过 |
