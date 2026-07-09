# AI 英语口语陪练 - 自由对话 Realtime 语音 Demo

本 Demo 用于验证自由对话实时语音链路是否可行：用户像打电话一样和 AI 进行低压力、连续、自然的英语语音对话。

## 链路

```text
浏览器麦克风输入
  -> Demo 后端 WebSocket
  -> Qwen-Omni-Realtime WebSocket
  -> Demo 后端
  -> 浏览器对话文本展示与音频播放
  -> 用户结束通话
```

## 固定技术栈

- Runtime：Node.js 20+
- 包管理：npm
- 前端：Vite + React + TypeScript（http://localhost:5173）
- 后端：Express + `ws` + TypeScript（http://localhost:8787）
- 浏览器到后端 WebSocket：`ws://localhost:8787/api/realtime/client`
- 供应商：Qwen-Omni-Realtime（WebSocket，本期不做 WebRTC、豆包、ASR+LLM+TTS 串联）

## 安装与启动

### 1. 安装依赖

```bash
cd 7.9/realtime-voice-demo
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入真实值：

```bash
cp .env.example .env
```

必填项：

- `DASHSCOPE_API_KEY`：阿里云百炼 API Key
- `DASHSCOPE_WORKSPACE_ID`：百炼业务空间 ID
- `REALTIME_MODEL_NAME`：模型名（默认 `qwen3.5-omni-plus-realtime`）

> 所有 API Key 只在后端环境变量中读取，浏览器不会接触 `DASHSCOPE_API_KEY`。

### 3. 启动 Demo

```bash
npm run dev
```

该命令同时启动：

- 后端：http://localhost:8787
- 前端：http://localhost:5173

### 4. 访问页面

浏览器打开 http://localhost:5173 ，点击「开始对话」，授权麦克风后即可与 AI 进行英语语音对话。

## 本期明确不做

- 不做 WebRTC。
- 不做豆包适配。
- 不做 ASR + LLM + TTS 串联兜底。
- 不做登录、会员、评分、纠错、CEFR、发音评测、错题本、学习报告。
- 不保存用户录音。

## 调试

页面默认展开调试面板，可查看 `call_id`、provider、model、状态、首包延迟、最后事件和错误码。后端控制台同步输出调试日志。

## 验收要点

- 成功启动 Demo，可打开自由对话页面。
- 点击开始、授权麦克风后进入 `connected`。
- 用户说英语后，页面展示用户转写文本。
- AI 返回英语文本回复和语音回复。
- 点击结束通话，页面进入 `ended`，麦克风与 AI 音频停止，连接关闭。
- 移除 `DASHSCOPE_API_KEY` 后启动通话，展示配置缺失提示。
- 后端未运行时点击开始，展示「无法连接本地实时语音服务」。
- 通话结束后项目目录无用户录音文件，日志无完整音频 Base64，无 API Key 暴露到浏览器。

## 供应商接入说明

后端使用以下 Qwen WebSocket 地址（来自阿里云百炼 Qwen-Omni-Realtime 文档）：

```text
wss://{DASHSCOPE_WORKSPACE_ID}.{DASHSCOPE_REGION}.maas.aliyuncs.com/api-ws/v1/realtime?model={REALTIME_MODEL_NAME}
```

连接时携带 `Authorization: Bearer {DASHSCOPE_API_KEY}`。若供应商文档更新，另起 OpenSpec change 修改，不在本期实现中临时改协议。
