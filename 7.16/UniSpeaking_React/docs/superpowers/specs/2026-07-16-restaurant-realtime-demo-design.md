# 餐厅特殊需求实时对话 Demo 设计

## 目标与范围

只改 Web 端每日推荐第二项“餐厅特殊需求”。点击后直接进入 `#/training/restaurant/simulation?direct=true`，页面沿用现有训练 simulation 视觉框架，但字幕、麦克风、AI 音频和状态全部来自真实 realtime 链路。咖啡店及其他场景保持现状。

## 方案选择

1. 整页嵌入 `ConversationView`：实现快，但视觉与训练页面不一致。
2. 复制自由对话逻辑：视觉可控，但会产生第二套麦克风、AudioContext 和 WebRTC 生命周期。
3. 新建场景 UI、复用 `useRealtimeSession`：保持图 2 的训练布局，同时复用唯一的真实会话资源。采用此方案。

## 前端结构

- `ScenesView` 根据 `scene.id` 只为 `restaurant` 生成直接 simulation 链接。
- `TrainingView` 通过 `scene === "restaurant" && stage === "simulation"` 选择餐厅标题、说明、退出路径和专用实时组件。
- `RestaurantSimulationSession` 挂载后自动调用 `start()`，显示实时字幕、连接/说话/思考/播放/暂停/错误状态，提供暂停恢复、静音、重试、提示和结束操作。卸载时沿用 hook 的统一 teardown。
- `useRealtimeSession({ scenarioId })` 为场景使用独立 conversation storage key，并把场景参数传给 realtime client。
- realtime API 的 session body 新增可选 `scenario_id`，不包含系统提示词正文。

## 服务端结构

- Edge Function 只接受白名单场景 ID `child-restaurant-ordering`。
- 默认请求继续使用成人 Clara 提示词和自适应等级规则。
- 餐厅场景仅使用评委特供儿童餐厅英文系统提示词，不拼接成人提示词或自适应等级提示，避免行为冲突。提示词作为 Supabase `static_files` 审核资产随函数部署，由服务端读取。
- 不修改数据库 schema，不新增表，不把服务端密钥或系统提示词放入 Vite 客户端构建。

## 错误与资源处理

- 自动启动失败时页面显示现有安全错误文案和“重试连接”。
- 页面离开、结束训练或网络断开继续通过现有 client teardown 释放麦克风、WebRTC、远端音频和 AudioContext。
- 未知 `scenario_id` 降级为默认自由对话，而不是允许客户端指定任意系统提示词。

## 验收

- 第二张推荐卡跳转到餐厅 simulation；其他卡片入口不变。
- 页面标题和提示均为儿童餐厅点餐，不出现咖啡、拿铁等内容。
- 进入后请求麦克风、建立会话并由 Clara 先说欢迎语。
- 双方实时字幕持续更新，AI 音频播放，结束/离开释放资源。
- 默认自由对话提示词契约测试继续通过，餐厅专属提示词有独立精确匹配测试。
