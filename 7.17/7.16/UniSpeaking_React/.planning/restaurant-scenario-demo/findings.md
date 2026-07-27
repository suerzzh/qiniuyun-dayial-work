# 发现与决策

## 需求
- 第二张“餐厅特殊需求”进入按钮直接打开餐厅模拟页面。
- 页面沿用图 2 的训练布局，但文案和角色改为儿童餐厅点餐。
- 进入后自动建立实时会话并由 AI 先说开场白。
- 仅该场景使用 `Clara_评委特供版_儿童餐厅点餐提示词中英对照.md`。
- 仅处理 Web 端，不修改其他场景。

## 视觉/浏览器发现
- 图 1：每日推荐第二项标题为“餐厅特殊需求”，按钮为“进入场景”。
- 图 2：目标页面包含训练标题、说明、对话字幕区、中央语音状态、提示/结束按钮。
- 本地桌面 1280×720：第二张卡片链接唯一指向餐厅 direct simulation，页面无横向溢出，字幕区为纵向滚动容器。
- 本地移动端 390×844：按钮自动单列，无横向溢出，字幕区保持可滚动。
- 点击和直接访问餐厅路由均自动进入“正在请求麦克风权限”状态。
- 自动化浏览器无法代替用户批准麦克风权限，因此真人语音与 AI 音频需在实际浏览器授权后验收。

## 研究发现
- `ScenesView.jsx` 将前三张推荐卡统一硬编码到 `#/training/cafe/words`。
- `TrainingView.jsx` 的 simulation 当前使用静态字幕和本地 `voiceState`，未接真实会话。
- `useRealtimeSession` 独占一个 realtime client，并在卸载时释放麦克风、播放和连接资源。
- `realtime-client.mjs` 已在 `session.updated` 后自动发送 `response.create`，可让 AI 先说开场白。
- realtime session 创建请求已支持 `prompt`，但目前 hook 启动时没有传入场景 prompt。
- 生产网关位于 `../supabase/functions/realtime-gateway`，现有测试要求默认 Clara 提示词保持与审核版一致。
- Supabase 官方文档确认 Edge Functions 使用 Deno TypeScript Runtime，密钥应从服务端环境变量读取。
- 2026 Edge Functions changelog 中与本项目相关的变化是 Deno 2.1 已全区域启用；递归函数限流不影响本函数调用外部百炼 API。
- 网关 `createSession` 当前只读取 `prompt` 与 `conversation_id`，可向后兼容地增加可选 `scenario_id`。
- 网关默认 `buildSessionConfig` 会拼接成人 Clara 提示词和自适应等级提示；餐厅儿童场景必须改为仅选择餐厅专属系统提示词，避免规则冲突。
- 本功能不需要新增表或字段，数据库 schema 和 RLS 均无需修改。

## 技术决策
| 决策 | 理由 |
|------|------|
| 使用现有 simulation 页面壳承载实时会话 | 视觉最接近图 2，改动面最小 |
| 场景参数贯穿前端 session 请求到服务端 | 可精确选择提示词且不影响自由对话 |
| 餐厅场景不拼接成人/等级提示词 | 保证评委版提示词是该场景唯一系统行为来源 |
| 不修改数据库 schema | `scenario_id` 只用于本次 session_config 选择，无持久化必要 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| `https://supabase.com/changelog.md` 被浏览器安全策略拒绝 | 改用官方 changelog 页面搜索，不重复直链打开 |
| 浏览器 Permissions API 在自动化上下文不可用 | 以真实 session UI 状态和单元契约验证请求已发起 |
