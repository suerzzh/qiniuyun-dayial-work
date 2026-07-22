# UniSpeaking 本地统一版

本目录是 UniSpeaking 的本地单机运行版本：React 18 前端由 Vite 8 提供开发服务，Spring Boot 后端使用 Java 21。项目使用 npm 与已提交的 `package-lock.json` 管理前端依赖；支持的 Node.js 版本范围是 `^20.19.0 || ^22.13.0 || >=24.0.0`。

## 运行要求

- Java 21
- Node.js `^20.19.0 || ^22.13.0 || >=24.0.0`
- npm
- `curl` 与 `lsof`
- 可访问外部模型服务的网络

真实语音对话与评分需要阿里云百炼/DashScope 的 API Key、百炼 Workspace ID，以及科大讯飞语音评测（ISE）的 App ID、API Key 和 API Secret。浏览器还需要麦克风权限。未配置外部服务时，本地页面和测试仍可运行，但对应真实能力会在设备检查中显示为未配置。

## 环境配置

在本目录创建本地 `.env`，不要提交真实密钥：

```bash
cp .env.example .env
```

填写 `DASHSCOPE_API_KEY`、`BAILIAN_WORKSPACE_ID`、`XFYUN_APPID`、`XFYUN_APIKEY` 与 `XFYUN_APISECRET`。示例中的三个模型变量可保留默认值。

## 一键启动与停止

首次运行先安装前端依赖：

```bash
cd frontend
npm ci
cd ..
```

从本目录启动前端和后端：

```bash
./scripts/start-local.sh
```

启动完成后打开 <http://127.0.0.1:8080/#/ielts>。脚本只在 `.run/` 中保存两个子进程的 PID 和对应日志，并在端口被其他进程占用或服务未能在 45 秒内就绪时安全停止本次启动的进程。

停止本项目启动的服务：

```bash
./scripts/stop-local.sh
```

停止脚本会同时校验 PID、命令行和工作目录，不会按端口批量终止进程。

## 数据与报告说明

自由对话 Session、IELTS Attempt、PCM、转写、评分证据和报告只保存在 Java 进程内存中；停止或重启后端后会全部清空。本项目不提供数据库持久化或分布式恢复。

IELTS 评分与报告由自动化模型生成，仅供英语学习和训练参考，属于非官方结果，不代表 IELTS 官方成绩，也不应作为升学、签证或其他正式决定的唯一依据。

## 测试

后端完整测试：

```bash
cd backend
./mvnw test
```

前端完整测试：

```bash
cd frontend
npm test
```

脚本语法检查：

```bash
zsh -n scripts/start-local.sh scripts/stop-local.sh
```

## 源目录保护

仓库中用于融合的四个源目录仍是只读参考，必须保持原样；本地统一版的运行、测试和修改仅在 `demo/UniSpeaking_Local_Final` 下进行。不要删除、移动、覆盖或版本回退这些源目录，待验收完成后再由用户人工处理。
