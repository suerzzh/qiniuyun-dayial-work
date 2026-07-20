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

Demo 包含 Part 1/2/3 专项练习和完整模考，可演示 JSON 题库、随机组卷、Part 2 完整题卡、准备笔记锁定、字幕开关、麦克风回答和非数字化 AI 练习反馈。

为便于本地验收：

- Demo uses browser speech synthesis and the Web Speech API; it does not call the production Realtime provider. Chrome provides the best compatibility.
- Microphone permission is requested only after the learner clicks “开始说话”. The learner can pause, resume, edit the live transcript and independently end the current turn.
- If microphone permission or speech recognition is unavailable, the same panel falls back to editable text so the exam can continue.
- Raw audio is not uploaded or saved. Transcript-only evidence is never used to guess Pronunciation.
- Part 2 准备倒计在 Demo 中加速为 10 秒，题库和领域规则仍保留正式 60 秒配置。
- “结束本轮回答”代表未来 Realtime VAD 的 `turn.end` 事件，不是跳题；暂停麦克风不会暂停整场考试。
- “保存回答录音”在当前 Demo 中只验证开考前选择和报告边界，不上传音频，也不猜测发音。

## 当前部署提示

网页、数据库、Edge Function 与百炼 Realtime 真实语音链路均已上线并验证。Supabase 已配置必需的 `DASHSCOPE_API_KEY` 与 `BAILIAN_WORKSPACE_ID`；后续轮换或迁移方法见操作说明和 `7.14/UniSpeaking_Vercel与Supabase部署上线完整流程.md`。
