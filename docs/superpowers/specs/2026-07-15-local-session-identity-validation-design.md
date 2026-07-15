# 本地会话标识归因验证设计

## 目标

在 `7.14/UniSpeaking` 本地 Demo 中，以固定测试用户运行一次真实会话；浏览器收到百炼 `session.created` 后，把 `session.id` 绑定到本地会话，结束时由后端生成一份文本记录，供人工与千问云推理日志的 `task_uuid` 比对。

## 最小链路

1. 后端创建本地会话时绑定 `DEMO_USER_ID`，默认 `demo-user-001`。
2. 浏览器从 `session.created.session.id` 提取 `sess_...`，立即调用后端绑定接口。
3. 绑定请求幂等：重复提交同一 ID 成功，尝试改绑为另一 ID 被拒绝。
4. 结束会话前等待绑定请求完成；后端关闭会话时写入 `data/last_session_identity.txt`。
5. 文本包含测试用户、本地会话 ID、百炼会话 ID、开始/结束时间，以及“与 `task_uuid` 比较”的提示。

## 边界

- 本轮不查询千问云日志、不采集 usage、不做登录鉴权和多用户 UI。
- 若未捕获 `session.created`，仍生成文本并明确标记 `NOT_CAPTURED`，便于判断链路失败位置。
- `task_uuid == session.id` 目前由实测截图支持；本轮目标正是再次人工验证这一对应关系。

