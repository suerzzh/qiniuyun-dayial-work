# 本地 DashScope 临时 API Key 测试设计

## 目标

在 `7.14/UniSpeaking` 本地 Python Demo 中保留永久 DashScope API Key，仅由后端在每次 WebRTC SDP 交换前签发一个有效期 600 秒的临时 Key，并用该临时 Key 调用百炼 Realtime。

## 范围

- 只修改本地 Python Demo，不修改 Vercel、线上 Supabase、完整 UI 或浏览器密钥配置。
- 浏览器继续只请求本地后端 `POST /api/realtime`，不会获得永久 Key 或临时 Key。
- 通过 `DASHSCOPE_USE_TEMP_KEY=true` 开启，通过 `DASHSCOPE_TEMP_KEY_TTL_SECONDS=600` 设置有效期。
- 关闭开关时保留现有永久 Key 直连行为，便于本地回退和对照测试。

## 数据流

1. 浏览器向本地 Python 后端提交 SDP offer。
2. 后端使用 `.env` 中的永久 `DASHSCOPE_API_KEY` 调用 DashScope token 接口。
3. 后端校验响应并取得临时 `st-` Key 和过期时间。
4. 后端使用临时 Key 请求百炼 Realtime WebRTC SDP 接口。
5. 后端只把 SDP answer 返回浏览器；任何 Key 都不进入响应或日志。

## 错误处理与验证

- TTL 必须在 1–1800 秒内；本次固定使用 600 秒。
- token 接口失败、超时、响应格式错误时返回明确的上游错误，不静默回退到永久 Key，确保测试确实覆盖临时 Key。
- 健康接口只显示凭据模式和 TTL，不显示 Key。
- 使用标准库 `unittest` 和本地假 token 服务验证请求头、TTL、成功解析及失败保护。

