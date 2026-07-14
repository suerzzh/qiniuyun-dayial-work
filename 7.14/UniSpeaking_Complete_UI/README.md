# UniSpeaking Web

UniSpeaking 完整 Web UI，已接入百炼 Realtime WebRTC 会话运行时，并使用 Supabase Edge Function/Postgres 作为服务端网关与持久化层。

- 生产站点：<https://unispeaking-web.vercel.app>
- 前端托管：Vercel 项目 `unispeaking-web`
- 后端：Supabase 项目 `ropgifqbblzktgxllupi`，函数 `realtime-gateway`
- 完整操作说明：[`UniSpeaking_UI与Demo链接及部署操作说明.md`](./UniSpeaking_UI与Demo链接及部署操作说明.md)

## 本地运行

```bash
npm test
npm run dev
```

打开 <http://localhost:8080>。浏览器只持有 Supabase Publishable Key；百炼密钥必须配置为 Supabase Edge Function Secret，绝不能写入本仓库。

## 当前部署提示

网页、数据库、Edge Function 与百炼 Realtime 真实语音链路均已上线并验证。Supabase 已配置必需的 `DASHSCOPE_API_KEY` 与 `BAILIAN_WORKSPACE_ID`；后续轮换或迁移方法见操作说明和 `7.14/UniSpeaking_Vercel与Supabase部署上线完整流程.md`。
