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

## IELTS Speaking Demo

运行 `npm run dev`，然后打开 <http://localhost:8080/#/ielts>。也可以从“场景广场 → 专业级口语特训 → IELTS 雅思口语特训”进入。

Demo 包含 Part 1/2/3 专项练习和完整模考，可演示 JSON 题库、随机组卷、Part 2 完整题卡、准备笔记锁定、Qwen Realtime 考官/ASR、共享 PCM 评分流和考后 IELTS 四项报告。启动页面前还需按 `7.21/demo_freechat_scoring/README.md` 启动本地 Java 后端（默认 `http://127.0.0.1:8000`）。

为便于本地验收：

- IELTS 路径使用本地 Java 后端代理 Qwen Realtime；自由对话路径继续使用现有 Supabase Realtime 网关。
- 开考时只申请一次麦克风 MediaStream；同一 stream 同时进入 Qwen WebRTC 和 16 kHz mono PCM scoring WebSocket。
- 完整模考的 Qwen 原始转写只读，考试中不显示逐轮分数、语法纠错或建议表达，结束后才轮询统一报告。
- PCM、raw transcript、ISE evidence 和报告只保存在本地 Java 进程内，后端重启即丢失。
- 完整模考默认使用真实时长；考前页可明确开启“加速 Demo”用于本地验收（Part 2 准备 10 秒），题库关系和评分规则不变。
- Part 1 从一个 Topic 内随机抽取 4 或 5 题，再按原题库顺序提问；不会跨 Topic。
- Part 2 题卡只展示、不朗读；Part 3 只能使用同一个 Part 2/P3 联合 Topic 下的顺序问题。
- Part 2 中 Qwen VAD 的普通 speech stop 只产生内部 chunk；只有明确“结束本轮回答”或考试状态转换才结束完整 long turn。
- iFlytek ISE 当前 `read_sentence` 能力只作为低置信 Pronunciation Evidence，不直接生成 IELTS Band。

## 当前部署提示

网页、数据库、Edge Function 与百炼 Realtime 真实语音链路均已上线并验证。Supabase 已配置必需的 `DASHSCOPE_API_KEY` 与 `BAILIAN_WORKSPACE_ID`；后续轮换或迁移方法见操作说明和 `7.14/UniSpeaking_Vercel与Supabase部署上线完整流程.md`。
