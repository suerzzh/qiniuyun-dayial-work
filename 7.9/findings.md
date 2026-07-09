# 国内端到端 Realtime 语音 Demo 研究记录

## 项目上下文

- 产品定位：面向成人英语学习者的低压力 AI 口语陪练。
- MS1 优先验证自由语音对话主链路，类似电话聊天。
- 自由对话不默认评分、不纠错、不生成结构化训练报告。
- AI 回复应短、自然、学习者友好，目标是让用户多说。

## 待核对

- 豆包端到端实时语音大模型的实时接口形态、音频输入输出、鉴权与可用区域。
- Qwen-Omni-Realtime 的接口形态、音频输入输出、WebSocket/WebRTC 支持情况。
- 国内链路中 WebSocket 与 WebRTC 的现实取舍。

## 供应商资料核对

### Qwen-Omni-Realtime

- 阿里云百炼官方文档存在独立页面 `Qwen-Omni-Realtime`。
- 官方说明其为实时音视频聊天模型，可理解流式音频与图像输入，并实时输出文本与音频。
- 支持地域：北京、新加坡，需使用对应地域 API Key。
- 支持 WebSocket 与 WebRTC 两种协议：
  - WebSocket 适合服务端集成和快速接入。
  - WebRTC 适合浏览器端、低延迟语音场景，音频通过 UDP 传输，并内置回声消除和降噪。
- WebSocket 调用示例模型名包含 `qwen3.5-omni-plus-realtime`。
- 会话配置支持 `modalities: ["text", "audio"]`、音色、输入 PCM 16 kHz、输出 PCM 24 kHz、系统提示词、服务端 VAD/语义 VAD。
- 文本响应可通过 `response.text.delta` / `response.audio_transcript.delta` 接收；音频可通过 WebSocket 的 `response.audio.delta` 或 WebRTC RTP 轨道接收。
- 单次会话最长 120 分钟；文档列出 qwen3.5-omni-plus-realtime 音频最大轮次 100 轮、音频上下文最大 600 秒。
- 参考来源：
  - https://help.aliyun.com/zh/model-studio/realtime
  - https://help.aliyun.com/zh/model-studio/qwen-omni
  - https://github.com/QwenLM/Qwen2.5-Omni

### 豆包端到端实时语音

- 已搜索火山引擎、火山方舟、豆包实时语音相关公开资料，未找到与 Qwen-Omni-Realtime 同等明确的公开实时语音 API 文档。
- 可确认豆包产品具备语音通话/音视频能力，但面向开发者的端到端实时语音模型协议、模型名、地域、音频事件、浏览器接入方式、限流和价格仍需要通过火山引擎控制台、商务/技术支持或实际账号权限确认。
- 因此在本 Demo 文档中，豆包方案应标注为“需要实测/需要权限确认”，不应作为默认主方案。

### 初步方案判断

- 若目标是尽快做 Web 端 Demo，优先选择 Qwen-Omni-Realtime，因为公开文档可直接指导 WebSocket/WebRTC 接入。
- 若团队已有火山引擎资源或需要豆包生态，可把豆包作为备选，在拿到接口文档后做同一套前后端抽象适配。
