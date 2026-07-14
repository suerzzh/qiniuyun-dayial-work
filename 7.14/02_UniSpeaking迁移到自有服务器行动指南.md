# UniSpeaking 后续迁移到自有服务器行动指南

> **执行者说明：** 本文用于路演阶段之后的服务器迁移。每个阶段都有进入条件和验证条件；不得跳过 Staging、HTTPS、备案、备份或回滚准备直接切换生产 DNS。

**目标：** 将 UniSpeaking Web/API/Worker 从 Vercel 逐步迁移到自有服务器，同时保持 `https://app.unispeaking.cn` 不变，并在迁移失败时能够快速切回 Vercel。

**架构：** 第一阶段只把 Web/API/Worker 迁到自有服务器，继续使用托管 Supabase；第二阶段只有在明确需要时才单独自托管 Supabase。GitHub Actions 构建不可变 Docker 镜像，服务器只负责拉取和运行；Nginx 终止 HTTPS 并反向代理。

**技术栈：** Ubuntu LTS、Docker Engine、Docker Compose、Nginx、Certbot/Let's Encrypt、GitHub Actions、GitHub Container Registry、Supabase、阿里云 DNS/ECS。

## 全局约束

- `app.unispeaking.cn` 从现在开始就是长期产品 URL，迁移服务器不改变用户入口。
- `api.unispeaking.cn` 作为自有服务器 API 域名。
- 第一阶段继续使用托管 Supabase，不在首次迁移同时更换数据库/Auth/Storage。
- 生产服务器不从源码临时编译；只运行 GitHub Actions 构建并带 commit SHA 的镜像。
- 所有 Secret 只存在于 GitHub Environment Secrets、服务器权限为 600 的环境文件或受控 Secret Manager。
- 数据库端口、Docker API、Supabase Studio 和内部管理端口不暴露公网。
- 中国内地服务器必须在正式 DNS 切换前完成接入商要求的 ICP 备案。
- Vercel 生产 deployment 至少保留 14 天，作为 DNS 回滚目标。
- 数据库 schema 变更始终通过 migration；不在生产数据库手工改表。

---

## 0. 推荐迁移路线

### 0.1 第一阶段：自有服务器 + 托管 Supabase（推荐）

```text
GitHub main
   │
   ├─ GitHub Actions → GHCR Docker Images
   │                         │
   │                         ▼
   │                 自有服务器
   │                 ├─ Nginx / HTTPS
   │                 ├─ Web Container
   │                 ├─ API Container
   │                 └─ Worker Container（需要时）
   │
   └─ Supabase GitHub Integration
                             │
                             ▼
                   托管 Supabase
                   ├─ Postgres
                   ├─ Auth
                   ├─ Storage
                   └─ Edge Functions
```

优点：迁移范围小，数据库/Auth/Realtime 不变，最容易回滚。

### 0.2 第二阶段：评估是否自托管 Supabase

只有出现以下明确原因才进入：

- 合规要求数据必须部署在特定环境。
- 托管成本显著高于有能力维护的自建成本。
- 必须控制 Postgres/Storage/Auth 的底层网络和版本。
- 已有 7×24 值班、备份恢复、监控、升级和安全能力。

“已经有一台服务器”不是自托管 Supabase 的充分理由。

---

## 1. 先决定服务器地域和备案路线

### 1.1 中国内地节点

适合主要用户和团队在中国内地、需要较稳定境内访问的场景。

必须完成：

- 域名实名认证。
- 服务器所属接入商 ICP 备案。
- 备案成功后展示 ICP 备案号并链接工信部系统。
- 完成 ICP 后 30 日内提交公安联网备案申请。
- 公安备案通过后在网站底部展示公安备案信息。

阿里云当前规则明确：使用中国内地服务器必须在服务器所属接入商平台完成备案。若通过阿里云备案，服务器是否满足备案条件以备案控制台为准；常见条件包括中国内地节点、包年包月 3 个月以上和公网带宽。

### 1.2 中国香港/境外节点

阿里云官方说明，中国香港、海外等节点无需走中国内地 ICP 备案流程；但可能存在跨境网络延迟、线路波动和后续迁回内地仍需备案的问题。

### 1.3 决策门禁

- [ ] 记录目标用户地域。
- [ ] 记录服务器地域。
- [ ] 若选择中国内地，备案主体、域名持有者和服务器接入商已确定。
- [ ] 若选择中国内地，备案尚未完成前不切换正式 DNS。
- [ ] 若选择香港/境外，已在目标用户网络实测延迟和稳定性。

---

## 2. 购买和初始化服务器

### 2.1 初始规格

第一阶段只运行 Web/API/Worker、继续使用托管 Supabase：

| 环境 | 建议起步规格 |
|---|---|
| Staging | 2 vCPU、4 GB RAM、50–80 GB SSD |
| 小规模 Production | 4 vCPU、8 GB RAM、80 GB+ SSD |
| 有转码/报告/高并发 Worker | Web/API 与 Worker 分机或增加 CPU/RAM |

如果计划同机自托管完整 Supabase，官方最低约 2 核/4 GB/40 GB SSD，推荐 4 核/8 GB+/80 GB+；生产环境还要为日志、备份、连接数和增长留余量。不要把完整 Supabase 与业务服务塞进最低配置单机。

购买时选择：

- Ubuntu 24.04 LTS 或团队统一的受支持 LTS。
- 固定公网 IPv4/EIP。
- 系统盘自动快照。
- 云监控。
- 中国内地节点时选择满足备案条件的付费方式和公网带宽。

### 2.2 安全组

入方向仅开放：

| 端口 | 来源 | 用途 |
|---|---|---|
| 22 | 团队固定办公 IP/VPN 出口 | SSH |
| 80 | `0.0.0.0/0`、`::/0` | HTTP/证书跳转 |
| 443 | `0.0.0.0/0`、`::/0` | HTTPS |

不要开放：

- Postgres 5432。
- Redis 6379。
- Docker daemon 2375/2376。
- 应用内部端口 3000/8000。
- Supabase Studio/Kong 内部端口（如未来自托管）。

### 2.3 首次登录和创建部署用户

使用云厂商提供的 SSH Key 登录：

```bash
ssh root@<SERVER_PUBLIC_IP>
```

创建部署用户：

```bash
adduser deploy
usermod -aG sudo deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

新开终端验证：

```bash
ssh deploy@<SERVER_PUBLIC_IP>
sudo -v
```

只有 deploy Key 登录成功后，才禁用 root/password 登录。新建：

```text
/etc/ssh/sshd_config.d/99-unispeaking-hardening.conf
```

内容：

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

验证并重载：

```bash
sudo sshd -t
sudo systemctl reload ssh
```

不要关闭当前 SSH 会话，先用第二个终端再次登录确认。

### 2.4 基础系统配置

```bash
sudo apt update
sudo apt full-upgrade -y
sudo timedatectl set-timezone Asia/Shanghai
sudo apt install -y ca-certificates curl gnupg git jq ufw nginx certbot python3-certbot-nginx
```

配置主机防火墙；将 `<ADMIN_PUBLIC_IP>` 替换为团队当前固定公网 IP：

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from <ADMIN_PUBLIC_IP>/32 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

预期只显示 22（受限来源）、80、443。

---

## 3. 安装 Docker Engine 和 Compose

先阅读并使用 Docker 官方 Ubuntu 安装页的当前命令：

<https://docs.docker.com/engine/install/ubuntu/>

安装后执行：

```bash
sudo usermod -aG docker deploy
newgrp docker
docker version
docker compose version
docker run --rm hello-world
```

预期：Engine、Compose 均输出版本，`hello-world` 正常退出。

创建生产目录：

```bash
sudo mkdir -p /opt/unispeaking
sudo chown deploy:deploy /opt/unispeaking
chmod 750 /opt/unispeaking
cd /opt/unispeaking
```

建议结构：

```text
/opt/unispeaking/
├── compose.yaml
├── .env.production
├── releases/
├── backups/
└── deploy.sh
```

---

## 4. 代码仓库必须提供的部署产物

完整迁移项目进入服务器阶段前，GitHub `main` 至少应有：

```text
apps/web/Dockerfile
apps/api/Dockerfile
docker/compose.production.yaml
docker/nginx/app.conf.example
.github/workflows/deploy-production.yaml
.dockerignore
.env.example
```

如果没有独立 API，删除 API 镜像和 `api.unispeaking.cn` 步骤，不要保留空容器。

### 4.1 容器硬性要求

Web/API 镜像必须：

- 使用固定基础镜像版本。
- 使用 lockfile 安装依赖。
- 以非 root 用户运行。
- 不把 `.env`/Git/测试产物复制进镜像。
- 提供 `/health`。
- 将日志写到 stdout/stderr。
- 正确处理 SIGTERM，停止接受新请求并释放连接。
- 镜像标签包含完整或短 commit SHA。

### 4.2 生产 Compose 基线

服务器 `/opt/unispeaking/compose.yaml`：

```yaml
services:
  web:
    image: ghcr.io/suerzzh/unispeaking-web:${IMAGE_TAG}
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "127.0.0.1:3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

  api:
    image: ghcr.io/suerzzh/unispeaking-api:${IMAGE_TAG}
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "127.0.0.1:8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

如果镜像中没有 `curl`，healthcheck 改成镜像实际提供的 Node/Python 健康命令；不能保留一个永远失败的检查。

`.env.production` 示例变量名：

```dotenv
NODE_ENV=production
PUBLIC_SITE_URL=https://app.unispeaking.cn
PUBLIC_API_URL=https://api.unispeaking.cn
SUPABASE_URL=https://ropgifqbblzktgxllupi.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

真实值写入后：

```bash
chmod 600 /opt/unispeaking/.env.production
```

百炼 Key 若继续由 Supabase Edge Function 使用，就不要复制到自有服务器。

---

## 5. 配置 GitHub Container Registry

### 5.1 GitHub Packages 权限

GitHub 仓库：

```text
Settings → Actions → General → Workflow permissions
```

选择：

- Read and write permissions。
- 仍要求 PR approval，不允许任意 fork 读取 Production Secrets。

### 5.2 GitHub Production Environment

路径：

```text
GitHub Repository → Settings → Environments → New environment → production
```

配置：

- [ ] Required reviewers 至少 1 人。
- [ ] Deployment branches 仅允许 `main`。
- [ ] 防止 self-review（如果团队设置支持）。

Environment Secrets：

| Secret | 内容 |
|---|---|
| `SERVER_HOST` | 服务器公网 IP 或管理域名 |
| `SERVER_USER` | `deploy` |
| `SERVER_SSH_KEY` | 专用于 GitHub Actions 的部署私钥 |
| `SERVER_KNOWN_HOSTS` | `ssh-keyscan` 后人工核验的主机公钥行 |

Environment Variables：

| Variable | 内容 |
|---|---|
| `WEB_IMAGE` | `ghcr.io/suerzzh/unispeaking-web` |
| `API_IMAGE` | `ghcr.io/suerzzh/unispeaking-api` |

服务器部署私钥只允许登录 `deploy`，建议使用单独 Key，不与个人管理员 Key 共用。

### 5.3 服务器登录 GHCR

为服务器创建最小 `read:packages` GitHub Token。在服务器执行：

```bash
echo '<GHCR_READ_TOKEN>' | docker login ghcr.io -u '<GITHUB_USERNAME>' --password-stdin
```

Token 只输入终端，不写入脚本或 Git；Docker credential 文件权限仅允许 deploy 用户读取。

---

## 6. GitHub Actions 自动构建和部署

在仓库创建：

```text
.github/workflows/deploy-production.yaml
```

基线内容：

```yaml
name: Deploy production server

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

concurrency:
  group: production-server
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        run: echo "tag=${GITHUB_SHA}" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: ghcr.io/suerzzh/unispeaking-web:${{ github.sha }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: ghcr.io/suerzzh/unispeaking-api:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Configure SSH
        env:
          SERVER_SSH_KEY: ${{ secrets.SERVER_SSH_KEY }}
          SERVER_KNOWN_HOSTS: ${{ secrets.SERVER_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$SERVER_SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$SERVER_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 600 ~/.ssh/known_hosts

      - name: Deploy exact commit image
        env:
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          ssh "$SERVER_USER@$SERVER_HOST" \
            "cd /opt/unispeaking && IMAGE_TAG=$IMAGE_TAG docker compose pull && IMAGE_TAG=$IMAGE_TAG docker compose up -d --remove-orphans && IMAGE_TAG=$IMAGE_TAG docker compose ps"
```

根据实际仓库调整：

- 使用 pnpm/yarn 时替换 npm 缓存和命令。
- 没有 API 服务时删除 API build 和 compose service。
- Node 版本与项目 `engines` 保持一致。
- Monorepo 构建上下文和 Dockerfile 路径必须与真实文件一致。

首次不要直接让 `main` 自动切生产流量。先使用 `workflow_dispatch` 和 Staging 域名验证。

---

## 7. 首次服务器部署

### 7.1 写入 Compose 和环境变量

在服务器：

```bash
cd /opt/unispeaking
nano compose.yaml
nano .env.production
chmod 600 .env.production
```

先用一个已经构建成功的 commit SHA：

```bash
export IMAGE_TAG='<VERIFIED_COMMIT_SHA>'
docker compose pull
docker compose up -d
docker compose ps
```

预期：所有服务为 Up/healthy。

检查日志：

```bash
docker compose logs --tail=200 web
docker compose logs --tail=200 api
```

本机回环验证：

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:8000/health
```

### 7.2 创建预发布 DNS

正式切换前使用：

```text
next-app.unispeaking.cn
next-api.unispeaking.cn
```

在阿里云 DNS 添加：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | `next-app` | 服务器公网 IP | 600 |
| A | `next-api` | 服务器公网 IP | 600 |

如果服务器在中国内地，必须先确认这些公网服务符合备案/接入要求再开放。

---

## 8. 配置 Nginx 和 HTTPS

### 8.1 Web 预发布站点

创建：

```text
/etc/nginx/sites-available/unispeaking-web
```

内容：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name next-app.unispeaking.cn app.unispeaking.cn;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
```

### 8.2 API 预发布站点

创建：

```text
/etc/nginx/sites-available/unispeaking-api
```

内容：

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name next-api.unispeaking.cn api.unispeaking.cn;

    client_max_body_size 10m;

    location / {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 10s;
        proxy_read_timeout 300s;
    }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/unispeaking-web /etc/nginx/sites-enabled/unispeaking-web
sudo ln -s /etc/nginx/sites-available/unispeaking-api /etc/nginx/sites-enabled/unispeaking-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 8.3 申请预发布证书

DNS 已指向服务器后：

```bash
sudo certbot --nginx -d next-app.unispeaking.cn -d next-api.unispeaking.cn
sudo certbot renew --dry-run
```

正式域名切到服务器并解析生效后，再把正式域名加入证书：

```bash
sudo certbot --nginx -d app.unispeaking.cn -d api.unispeaking.cn
sudo certbot renew --dry-run
```

检查：

```bash
curl -I https://next-app.unispeaking.cn
curl -fsS https://next-api.unispeaking.cn/health
```

---

## 9. 预发布验收

在 `next-app.unispeaking.cn` 完成：

- [ ] 首页和深层路由。
- [ ] 登录、退出、邮箱确认、找回密码。
- [ ] 麦克风权限。
- [ ] AI 开场、用户转写、AI 文本和音频。
- [ ] 静音、文字输入、结束会话。
- [ ] 数据写入托管 Supabase。
- [ ] 不保存原始音频。
- [ ] API 401/403/429/5xx 行为正确。
- [ ] 服务器重启后数据不丢失。
- [ ] `docker compose restart` 后服务自动恢复。
- [ ] GitHub Actions 可以部署一个新 SHA。
- [ ] GitHub Environment approval 生效。
- [ ] Vercel 旧站仍保持正常。

负载与稳定性：

- [ ] 使用 Staging 数据执行并发测试。
- [ ] CPU、内存、磁盘、连接数无持续饱和。
- [ ] Nginx 与容器日志没有 Secret。
- [ ] 上游百炼超时不会拖垮 API 线程/事件循环。

---

## 10. 中国内地服务器备案行动

如果服务器位于中国内地，在正式 `app`/`api` DNS 切换前完成。

### 10.1 ICP 前置检查

- [ ] `unispeaking.cn` 域名实名认证完成。
- [ ] 域名注册信息与备案主体满足所在管局要求。
- [ ] 服务器满足阿里云备案条件或在实际接入商处具备备案资格。
- [ ] 准备主体证件、负责人证件、联系方式和网站信息。
- [ ] 在阿里云备案控制台执行基础校验。

入口：<https://beian.aliyun.com/>

### 10.2 ICP 流程

按控制台依次完成：

1. 基础信息校验。
2. 填写主办者信息。
3. 填写网站/互联网信息服务信息。
4. 上传资料和真实性核验。
5. 阿里云初审。
6. 工信部短信核验。
7. 管局审核。
8. 取得 ICP 备案号。

备案完成后在网站页脚展示备案编号，并链接：

```text
https://beian.miit.gov.cn/
```

### 10.3 公安联网备案

完成 ICP 后 30 日内进入：

<https://beian.mps.gov.cn/>

提交公安联网备案。审核通过后，在网站底部加入公安备案号、图标和平台提供的 HTML 信息。

---

## 11. 正式 DNS 切换

### 11.1 切换前 24–48 小时

- [ ] ICP/公安备案前置要求满足（中国内地服务器）。
- [ ] `next-app`/`next-api` 完整验收通过。
- [ ] 记录 Vercel 为 `app` 显示的原 CNAME 值，保存在发布记录。
- [ ] Vercel 最近稳定 deployment ID/commit SHA 已记录。
- [ ] 服务器当前镜像 SHA 已记录。
- [ ] DNS TTL 已降至 600 秒。
- [ ] Supabase Auth 新旧 Redirect URLs 同时保留。
- [ ] 团队已确定切换负责人、验证人和回滚负责人。

### 11.2 配置正式 API

阿里云 DNS 添加：

| 类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | `api` | 自有服务器公网 IP | 600 |

验证：

```bash
dig +short A api.unispeaking.cn
curl -fsS https://api.unispeaking.cn/health
```

### 11.3 把 Web 从 Vercel 切到服务器

`app` 当前是 CNAME，不能与同名 A 记录共存。

在阿里云 DNS：

1. 找到 `app` CNAME。
2. 截图并记录原 Vercel CNAME 值。
3. 删除或暂停该 CNAME。
4. 新增：

| 类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | `app` | 自有服务器公网 IP | 600 |

5. 保存。

根域和 `www` 可暂时继续由 Vercel 重定向到 `app`；它们最终会把用户引导到已经位于自有服务器的 `app`。

### 11.4 同步应用配置

服务器 `.env.production`：

```dotenv
PUBLIC_SITE_URL=https://app.unispeaking.cn
PUBLIC_API_URL=https://api.unispeaking.cn
```

Supabase：

- Auth Site URL：`https://app.unispeaking.cn`。
- Redirect URLs：保留正式站点和必要本地地址。
- Edge Function `ALLOWED_WEB_ORIGINS`：保留 `https://app.unispeaking.cn`。
- OAuth Provider Web Origin：`https://app.unispeaking.cn`。

由于正式 Web URL 没有改变，用户书签和 Auth 主地址不需要再次迁移；只有 API URL 从 Supabase/Vercel接口逐步切到 `api` 时需要调整客户端。

### 11.5 切换后验证

```bash
dig +short A app.unispeaking.cn
dig +short A api.unispeaking.cn
curl -I https://app.unispeaking.cn
curl -fsS https://api.unispeaking.cn/health
```

然后完成完整生产 E2E、日志检查和资源监控。

至少观察 60 分钟：

- HTTP 5xx。
- Nginx 499/502/504。
- API 延迟。
- CPU/内存/磁盘。
- 容器重启次数。
- Supabase 连接/函数错误。
- 百炼上游失败率。

---

## 12. 回滚方案

### 12.1 DNS 回滚到 Vercel

触发条件：持续 5xx、语音链路失败、资源饱和、证书/网络异常且 15 分钟内不能修复。

在阿里云 DNS：

1. 删除/暂停 `app` A 记录。
2. 恢复切换前记录的 Vercel `app` CNAME。
3. TTL 维持 600。
4. 验证：

```bash
dig +short CNAME app.unispeaking.cn
curl -I https://app.unispeaking.cn
```

5. 在 Vercel 确认自定义域名仍绑定 `unispeaking-web` Production。

### 12.2 服务器镜像回滚

找到上一条稳定 commit SHA：

```bash
cd /opt/unispeaking
export IMAGE_TAG='<PREVIOUS_STABLE_SHA>'
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
```

### 12.3 数据库回滚

- 不删除生产表。
- 不修改已执行 migration。
- 用新的前向修复 migration。
- 只有灾难恢复才使用备份/PITR，并明确恢复点之后的数据损失。

---

## 13. 日常发布和运维

### 13.1 发布流程

```text
分支开发
→ PR
→ 测试/安全检查
→ 构建 commit SHA 镜像
→ Staging 验收
→ 合并 main
→ GitHub Production Environment 人工批准
→ 服务器拉取同一 SHA
→ 健康检查
→ 冒烟测试
→ 观察指标
```

### 13.2 每日/每周检查

每日：

- 容器状态和重启次数。
- 5xx/502/504。
- CPU、内存、磁盘。
- TLS 到期时间。
- Supabase/百炼错误与费用。

每周：

- 验证备份任务成功。
- 抽样恢复一次非生产备份。
- 查看系统安全更新。
- 清理无引用旧镜像，但保留稳定回滚版本。
- 审核 GitHub/服务器管理员权限。

### 13.3 备份

第一阶段托管 Supabase 数据仍按 Supabase 备份/PITR策略；自有服务器备份：

- `/opt/unispeaking` 配置（不明文外泄 Secret）。
- Nginx 配置。
- 证书由 Certbot 自动管理，仍需记录恢复方法。
- 本地业务持久化卷（若有）。
- 云盘快照。

备份必须加密、异地保存，并定期执行恢复演练。

---

## 14. 可选：第二阶段自托管 Supabase

这不是第一阶段的附带步骤，而是独立迁移项目。

### 14.1 进入条件

- [ ] 有独立 Staging 服务器。
- [ ] 至少 4 vCPU、8 GB RAM、80 GB SSD；生产容量按数据和并发扩展。
- [ ] 有自动 Postgres 备份和异地恢复。
- [ ] 有 SMTP、对象存储、日志、监控和告警方案。
- [ ] 有明确升级窗口和版本锁定策略。
- [ ] 有数据库/Auth/Storage 迁移演练。
- [ ] 有值班和故障负责人。

### 14.2 官方 Docker 基线

使用 Supabase 当前官方自托管 Docker 文档：

<https://supabase.com/docs/guides/self-hosting/docker>

官方 Linux 快速安装入口当前为：

```bash
curl -fsSL https://supabase.link/setup.sh | sh
```

执行前必须先下载并审查脚本，不在生产服务器盲目执行远程脚本。

自托管域名建议独立使用：

```text
data.unispeaking.cn
```

不要与业务 API `api.unispeaking.cn` 混用。

必须重新生成并保护：

- Postgres 密码。
- Publishable/Secret keys。
- JWT signing keys。
- Dashboard 账号密码。
- SMTP credentials。
- Storage credentials。

### 14.3 数据迁移顺序

1. 盘点托管项目的 extensions、schema、RLS、Auth providers、Storage buckets、Functions 和 Secrets。
2. 在 Staging 自托管 Supabase 执行全部 migration。
3. 验证 RLS、Data API、Auth、Realtime、Storage、Functions。
4. 导出并导入业务表数据。
5. 单独验证 Auth 用户和 session 迁移策略。
6. 同步 Storage 对象和 metadata。
7. 为自托管 Functions 配置全新 Secrets。
8. 使用测试域名运行完整 E2E。
9. 做至少一次从备份恢复的演练。
10. 制定只读/停写窗口，执行最终增量迁移。
11. 先切内部/测试客户端，再切正式 Web。
12. 保留托管 Supabase 只读回退窗口。

不要在没有演练的情况下直接 `pg_dump/pg_restore` 整个托管 Supabase 并期望 Auth、Storage 和平台权限自动完全一致。

### 14.4 自托管责任

自托管后团队负责：

- 数据库高可用、备份、PITR、恢复。
- Supabase 各组件升级与兼容性。
- TLS、域名、DDoS/WAF。
- SMTP 送达率。
- Storage 容量和对象备份。
- 日志、监控、告警和事故响应。
- Key 轮换和安全补丁。

因此默认建议长期保留托管 Supabase，除非上述责任已经有人承担。

---

## 15. 最终检查表

### 服务器

- [ ] 只开放 22/80/443。
- [ ] SSH 仅 Key，root/password 登录关闭。
- [ ] Docker/Compose/Nginx/Certbot 正常。
- [ ] Web/API 只监听 `127.0.0.1` 内部端口。
- [ ] 所有容器有健康检查和 restart policy。
- [ ] Secret 文件权限为 600。

### GitHub/CD

- [ ] `main` 受保护。
- [ ] Actions 测试通过后才构建镜像。
- [ ] 镜像使用 commit SHA。
- [ ] Production Environment 需要审批。
- [ ] SSH Key 为专用最小权限 Key。
- [ ] 上一稳定 SHA 已记录。

### 域名/合规

- [ ] 中国内地服务器已完成 ICP。
- [ ] 网站页脚展示 ICP 号和链接。
- [ ] 30 日内完成公安联网备案申请。
- [ ] `app`、`api` DNS 正确。
- [ ] HTTPS 和自动续期通过。
- [ ] Vercel 原 CNAME 已记录用于回滚。

### 产品

- [ ] 登录/Auth 回调。
- [ ] 自由对话完整链路。
- [ ] 数据权限/RLS。
- [ ] 异常、限流、超时。
- [ ] 监控、告警、备份、恢复演练。
- [ ] Vercel 回退入口仍可用。

---

## 16. 官方资料

- [Docker Engine 安装（Ubuntu）](https://docs.docker.com/engine/install/ubuntu/)
- [GitHub Actions 发布 Docker 镜像](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [Nginx Reverse Proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Certbot 使用说明](https://eff-certbot.readthedocs.io/en/stable/using.html)
- [Supabase Docker 自托管](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase 自托管总览](https://supabase.com/docs/guides/self-hosting)
- [阿里云 DNS 添加解析记录](https://help.aliyun.com/zh/dns/add-a-dns-record)
- [阿里云 ICP 备案介绍](https://help.aliyun.com/zh/icp-filing/product-overview/what-is-an-icp-filing)
- [阿里云备案域名检查](https://help.aliyun.com/zh/icp-filing/user-guide/prepare-and-check-the-domain-name)
- [阿里云备案服务器检查](https://help.aliyun.com/zh/icp-filing/user-guide/prepare-and-check-the-instance-and-access-information)
- [阿里云 ICP 备案后处理](https://help.aliyun.com/zh/icp-filing/user-guide/the-icp-record-post-processing-1)
- [公安联网备案平台](https://beian.mps.gov.cn/)
- [工信部 ICP 备案系统](https://beian.miit.gov.cn/)

---

## 17. 完成判定

第一阶段只有在以下条件同时成立时才完成：

- GitHub Actions 能从 `main` 构建、审批并部署同一 commit SHA。
- `app.unispeaking.cn` 在不改用户 URL 的情况下切到自有服务器。
- `api.unispeaking.cn` HTTPS、健康检查和限流正常。
- 托管 Supabase 的 Auth、数据库、Storage、Functions 没有同时迁移造成额外风险。
- 完整语音 E2E、权限、异常和负载验收通过。
- 能在 10–15 分钟内把 `app` DNS 恢复为已记录的 Vercel CNAME。
- 备案、公安备案、页脚展示和安全要求满足实际服务器地域规则。
- 备份、监控、告警、值班和恢复演练已经落地。
