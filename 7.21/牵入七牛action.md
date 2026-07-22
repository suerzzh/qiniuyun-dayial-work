````
# GitHub Actions 沙箱 Runner 迁移接入说明

本文档面向需要从旧自托管 runner 迁移到沙箱 runner 的业务仓库，说明 workflow 要改哪些内容、S3 缓存脚本怎么接、以及迁移时要注意什么。

## Runner 和预装工具

GitHub Actions job 改用沙箱 runner：

```yaml
runs-on: github-runner-ubuntu-24-04
```

当前沙箱 runner template 预装了常见 CI 工具。具体版本以 runner template 的 `e2b.Dockerfile`、`README.md` 或平台维护方发布说明为准；当前可按下面版本理解：

| 工具 | 版本或来源 |
| --- | --- |
| Ubuntu | 24.04, `linux/amd64` |
| GitHub Actions runner | 2.334.0 |
| Go | 1.26.3 |
| Node.js | 22 |
| Go Task | 3.50.0 |
| gofumpt | 0.8.0 |
| staticcheck | 2026.1, 对应 `staticcheck 0.7.0` |
| OpenTofu | 1.11.5 |
| Terraform | 1.14.6 |
| goimports | 来自 apt 包 `golang-golang-x-tools` |
| Docker | 来自 apt 包 `docker.io`, `docker-buildx`, `docker-compose-v2` |
| GitHub CLI | 来自 GitHub CLI apt 源 |
| rclone | 来自 apt 包 `rclone` |
| 其他基础工具 | `git`, `git-lfs`, `jq`, `zstd`, `rsync`, `python3`, `build-essential` 等 |

workflow 中不需要再安装这些工具，也不建议继续依赖旧 runner 本地目录做跨运行缓存。

## 按顺序接入

### 1. 配置 GitHub Secrets

在仓库的 `Settings -> Secrets and variables -> Actions` 中配置：

| Secret | 说明 |
| --- | --- |
| `RUNNER_S3_AK` | 七牛 S3 AK |
| `RUNNER_S3_SK` | 七牛 S3 SK |
| `SSH_KEY` | 可选。访问私有 Go module 时需要，没有私有依赖可以不配 |

私有 Go module 前缀也使用统一固定值，在 workflow `env` 中配置：

```yaml
env:
  GOPRIVATE: github.com/qbox/*
```

### 2. 替换 runner label

把旧 runner label：

```yaml
runs-on: <old-runner-label>
```

替换为：

```yaml
runs-on: github-runner-ubuntu-24-04
```

检查所有 GitHub Actions workflow，尤其是主 CI、通知、PR 自动化、定时任务等 job。

### 3. 放置 Go prep action

创建 `.github/actions/ci-go-prep/action.yml`：

```yaml
name: CI Go prep
description: Prepare Go directories, restore Go module cache, and configure private module access.
inputs:
  ssh-key:
    description: SSH private key for private Go modules.
    required: false
runs:
  using: composite
  steps:
    - name: Prepare Go directories
      shell: bash
      run: |
        set -euo pipefail
        # GOPATH/GOMODCACHE 放在 workspace 内，避免写入 runner template 的 /opt/go。
        mkdir -p "${GOCACHE}" "${GOMODCACHE}" "${GOPATH}/bin"

    - name: Restore Go module cache from S3
      continue-on-error: true
      shell: bash
      run: bash "${GITHUB_WORKSPACE}/.github/scripts/ci/restore-go-cache.sh"

    - name: Setup SSH for private modules
      if: inputs.ssh-key != ''
      shell: bash
      env:
        SSH_KEY: ${{ inputs.ssh-key }}
      run: |
        set -euo pipefail
        # 有私有 Go module 时配置 SSH；没有私有依赖可以删除整个 step。
        mkdir -p "${HOME}/.ssh"
        chmod 700 "${HOME}/.ssh"
        printf '%s\n' "${SSH_KEY}" > "${HOME}/.ssh/id_ed25519"
        chmod 600 "${HOME}/.ssh/id_ed25519"
        ssh-keyscan github.com >> "${HOME}/.ssh/known_hosts"
        # 让 github.com/qbox 下的私有 module 拉取走 SSH key。
        git config --global url."git@github.com:qbox/".insteadOf "https://github.com/qbox/"
        # GOPRIVATE 统一固定为 github.com/qbox/*。
        if [[ -n "${GOPRIVATE:-}" ]]; then
          go env -w "GOPRIVATE=${GOPRIVATE}"
        fi
```

没有私有 Go module 的仓库可以删除 `Setup SSH for private modules` 这一步。

### 4. 放置缓存脚本

把本文档后面的 5 个脚本放到 `.github/scripts/ci/`：

- `s3-cache-common.sh`
- `restore-go-cache.sh`
- `save-go-cache.sh`
- `restore-docker-image-cache.sh`
- `save-docker-image-cache.sh`

如果仓库不需要 Docker image cache，可以不接入两个 Docker cache 脚本。

### 5. 修改 workflow

下面是一个可以直接套用的最小完整例子。Go 项目复制后，只需要替换实际检查、测试命令；S3 bucket、endpoint、region 都使用统一固定值，仓库只需要配置 AK/SK secrets。

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

env:
  # Go 目录放在 workspace 内，避免写入 runner template 内置 GOPATH。
  GOPATH: ${{ github.workspace }}/.cache/go
  GOMODCACHE: ${{ github.workspace }}/.cache/go/pkg/mod
  GOCACHE: /tmp/go-build-cache
  # 私有 Go module 前缀统一固定。
  GOPRIVATE: github.com/qbox/*

  # 七牛 S3 cache 配置。bucket、endpoint、region 统一固定，仓库只需要配置 AK/SK secrets。
  RUNNER_S3_BUCKET: las-github-runner-dal
  RUNNER_S3_ENDPOINT: s3.us-north-1.qiniucs.com
  RUNNER_S3_REGION: us-north-1
  RUNNER_S3_AK: ${{ secrets.RUNNER_S3_AK }}
  RUNNER_S3_SK: ${{ secrets.RUNNER_S3_SK }}

jobs:
  prepare:
    runs-on: github-runner-ubuntu-24-04
    outputs:
      ci_go_mod_hash: ${{ steps.context.outputs.ci_go_mod_hash }}
    steps:
      - uses: actions/checkout@v6

      - name: Calculate Go module cache key
        id: context
        shell: bash
        run: |
          set -euo pipefail
          # 只要 go.mod/go.sum 内容不变，重试和后续 job 都会使用同一个缓存 key。
          ci_go_mod_hash="$(sha256sum go.mod go.sum | sha256sum | awk '{print $1}')"
          echo "ci_go_mod_hash=${ci_go_mod_hash}" >> "${GITHUB_OUTPUT}"

  go-mod-cache:
    needs: prepare
    runs-on: github-runner-ubuntu-24-04
    env:
      CI_GO_MOD_HASH: ${{ needs.prepare.outputs.ci_go_mod_hash }}
    steps:
      - uses: actions/checkout@v6

      - uses: ./.github/actions/ci-go-prep
        with:
          # 没有私有 Go module 时可以删掉 with 这一段。
          ssh-key: ${{ secrets.SSH_KEY }}

      - name: Download Go modules
        shell: bash
        run: |
          set -euo pipefail
          go mod download
          go mod tidy
          # 避免 go mod tidy 在 CI 中悄悄改动 go.mod/go.sum。
          git diff --exit-code go.mod go.sum

      - name: Save Go module cache to S3
        if: success()
        continue-on-error: true
        shell: bash
        run: bash "${GITHUB_WORKSPACE}/.github/scripts/ci/save-go-cache.sh"

  check:
    needs:
      - prepare
      - go-mod-cache
    runs-on: github-runner-ubuntu-24-04
    env:
      CI_GO_MOD_HASH: ${{ needs.prepare.outputs.ci_go_mod_hash }}
    steps:
      - uses: actions/checkout@v6

      - uses: ./.github/actions/ci-go-prep
        with:
          ssh-key: ${{ secrets.SSH_KEY }}

      - name: Run checks
        shell: bash
        run: |
          set -euo pipefail
          # 替换成仓库自己的检查命令。
          task check

  test:
    needs:
      - prepare
      - go-mod-cache
    runs-on: github-runner-ubuntu-24-04
    env:
      CI_GO_MOD_HASH: ${{ needs.prepare.outputs.ci_go_mod_hash }}
    steps:
      - uses: actions/checkout@v6

      - uses: ./.github/actions/ci-go-prep
        with:
          ssh-key: ${{ secrets.SSH_KEY }}

      # 需要复用测试镜像时打开 Docker image cache。
      - name: Restore Docker image cache from S3
        continue-on-error: true
        shell: bash
        run: bash "${GITHUB_WORKSPACE}/.github/scripts/ci/restore-docker-image-cache.sh"

      - name: Prepare Docker images
        shell: bash
        run: |
          set -euo pipefail
          # 替换成仓库自己的镜像准备逻辑。
          # 约定把 docker save 后的镜像文件放到 .cache/docker-images，save-docker-image-cache.sh 会打包这个目录。
          mkdir -p "${GITHUB_WORKSPACE}/.cache/docker-images"
          # 示例：
          # docker pull postgres:16
          # docker save postgres:16 -o "${GITHUB_WORKSPACE}/.cache/docker-images/postgres-16.tar"

      - name: Save Docker image cache to S3
        if: success()
        continue-on-error: true
        shell: bash
        run: bash "${GITHUB_WORKSPACE}/.github/scripts/ci/save-docker-image-cache.sh"

      - name: Run tests
        shell: bash
        run: |
          set -euo pipefail
          # 替换成仓库自己的测试命令。
          task test
```

### 6. 清理旧逻辑

接入后可以删除或停止使用：

- `actions/setup-go` cache。
- `actions/setup-node` cache。
- 旧 runner 本地 `/cache` 或类似共享目录的 restore/save。
- 旧缓存目录权限修复脚本。
- workflow 内安装 OpenTofu、Terraform、GitHub CLI、Task、gofumpt、staticcheck 的脚本。
- 自研 S3 上传下载脚本。runner 已预装 `rclone`，S3 上传下载交给 rclone。

## 配置说明

### Go 工作目录

Go 项目建议在 workflow 顶层配置：

```yaml
env:
  GOPATH: ${{ github.workspace }}/.cache/go
  GOMODCACHE: ${{ github.workspace }}/.cache/go/pkg/mod
  GOCACHE: /tmp/go-build-cache
```

`GOPATH` 和 `GOMODCACHE` 放在 workspace 内，是为了避免写入 runner template 内的只读或共享目录。这里不是跨 workflow run 的缓存目录，跨 run 缓存由 S3 负责。

### 七牛 S3 cache 环境变量

各组统一使用七牛 S3 兼容存储做 CI cache。在 workflow 顶层加上 S3 cache 参数：

```yaml
env:
  RUNNER_S3_BUCKET: las-github-runner-dal
  RUNNER_S3_ENDPOINT: s3.us-north-1.qiniucs.com
  RUNNER_S3_REGION: us-north-1
  RUNNER_S3_AK: ${{ secrets.RUNNER_S3_AK }}
  RUNNER_S3_SK: ${{ secrets.RUNNER_S3_SK }}
```

推荐 cache prefix 带上仓库名：

```bash
RUNNER_S3_PREFIX=ci-cache/${GITHUB_REPOSITORY}
```

例如仓库是 `example-org/example-service`，默认写到：

```text
ci-cache/example-org/example-service/
```

这样同一个 bucket 可以按组织和仓库隔离缓存，避免不同仓库之间 key 冲突。

### Go module hash

Go module cache 建议按 `go.mod` 和 `go.sum` 内容做 key。`prepare` job 中计算 hash：

```bash
ci_go_mod_hash="$(sha256sum go.mod go.sum | sha256sum | awk '{print $1}')"
echo "ci_go_mod_hash=${ci_go_mod_hash}" >> "${GITHUB_OUTPUT}"
```

后续 Go 相关 job 都通过 output 使用同一个 key：

```yaml
CI_GO_MOD_HASH: ${{ needs.prepare.outputs.ci_go_mod_hash }}
```

## 缓存脚本

建议把缓存脚本放在：

```text
.github/scripts/ci/
```

### `.github/scripts/ci/s3-cache-common.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_S3_BUCKET:=las-github-runner-dal}"
: "${RUNNER_S3_ENDPOINT:=s3.us-north-1.qiniucs.com}"
: "${RUNNER_S3_REGION:=us-north-1}"
: "${RUNNER_S3_PREFIX:=ci-cache/${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}}"

raw_job_name="${GITHUB_JOB:-unknown-job}"
RUNNER_S3_JOB_SCOPE="$(printf '%s' "${raw_job_name}" | sed 's/[^[:alnum:]._-]/-/g')"
export RUNNER_S3_JOB_SCOPE

RUNNER_S3_RCLONE_CONFIG=""

s3_cache_enabled() {
  [[ -n "${RUNNER_S3_AK:-}" && -n "${RUNNER_S3_SK:-}" ]] && command -v rclone >/dev/null 2>&1
}

s3_cache_configure_rclone() {
  if [[ -n "${RUNNER_S3_RCLONE_CONFIG}" ]]; then
    return 0
  fi

  local endpoint="${RUNNER_S3_ENDPOINT}"

  if [[ ! "${endpoint}" =~ ^https?:// ]]; then
    endpoint="https://${endpoint}"
  fi

  RUNNER_S3_RCLONE_CONFIG="$(mktemp)"
  chmod 600 "${RUNNER_S3_RCLONE_CONFIG}"
  cat > "${RUNNER_S3_RCLONE_CONFIG}" <<EOF
[cis3]
type = s3
provider = Qiniu
access_key_id = ${RUNNER_S3_AK}
secret_access_key = ${RUNNER_S3_SK}
region = ${RUNNER_S3_REGION}
endpoint = ${endpoint}
force_path_style = false
no_check_bucket = true
EOF
  export RUNNER_S3_RCLONE_CONFIG
}

s3_cache_remote_path() {
  printf 'cis3:%s/%s' "${RUNNER_S3_BUCKET}" "${1#/}"
}

s3_cache_rclone() {
  s3_cache_configure_rclone
  rclone --config "${RUNNER_S3_RCLONE_CONFIG}" --stats=0 --retries "${RUNNER_S3_RCLONE_RETRIES:-4}" "$@"
}

s3_cache_get() {
  local output_path="$2"

  rm -f "${output_path}"
  s3_cache_rclone copyto "$(s3_cache_remote_path "$1")" "${output_path}"
  [[ -s "${output_path}" ]]
}

s3_cache_put() {
  s3_cache_rclone copyto "$2" "$(s3_cache_remote_path "$1")"
}

s3_cache_upload_if_changed() {
  local object_key="$1"
  local archive_path="$2"
  local tmp_dir
  local hash_path
  local remote_hash_path
  local local_hash
  local remote_hash

  tmp_dir="$(mktemp -d)"
  hash_path="${tmp_dir}/local.sha256"
  remote_hash_path="${tmp_dir}/remote.sha256"
  local_hash="$(sha256sum "${archive_path}" | awk '{print $1}')"
  printf '%s\n' "${local_hash}" > "${hash_path}"

  if s3_cache_get "${object_key}.sha256" "${remote_hash_path}"; then
    remote_hash="$(tr -d '[:space:]' < "${remote_hash_path}")"
    if [[ "${remote_hash}" == "${local_hash}" ]]; then
      echo "S3 cache unchanged: ${object_key}"
      rm -rf "${tmp_dir}"
      return 0
    fi
    echo "S3 cache changed: ${object_key} remote_sha256=${remote_hash} local_sha256=${local_hash}"
  else
    echo "No existing S3 cache hash for ${object_key}; uploading"
  fi

  s3_cache_put "${object_key}" "${archive_path}"
  s3_cache_put "${object_key}.sha256" "${hash_path}"
  echo "Uploaded S3 cache: ${object_key} sha256=${local_hash}"
  rm -rf "${tmp_dir}"
}

s3_cache_upload_if_missing() {
  local object_key="$1"
  local archive_path="$2"

  echo "Uploading S3 cache if missing: ${object_key}"
  s3_cache_rclone copyto --ignore-existing "${archive_path}" "$(s3_cache_remote_path "${object_key}")"
}
```

七牛 S3 需要保留下面几个 rclone 配置：

```ini
provider = Qiniu
force_path_style = false
no_check_bucket = true
```

`RUNNER_S3_ENDPOINT` 统一使用 `s3.us-north-1.qiniucs.com`；脚本会在缺少协议头时自动补成 `https://`。

### `.github/scripts/ci/restore-go-cache.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

source "${GITHUB_WORKSPACE}/.github/scripts/ci/s3-cache-common.sh"

mkdir -p "${GOMODCACHE}/cache/download" "${GOPATH}/bin" "${GOCACHE}" "${GITHUB_WORKSPACE}/.cache"
rm -rf "${GITHUB_WORKSPACE}/.cache/go/build-cache"

if ! s3_cache_enabled; then
  echo "S3 Go module cache restore skipped: missing RUNNER_S3_AK/RUNNER_S3_SK or rclone"
  exit 0
fi

if [[ -z "${CI_GO_MOD_HASH:-}" ]]; then
  echo "S3 Go module cache restore skipped: CI_GO_MOD_HASH is empty"
  exit 0
fi

cache_key="${RUNNER_S3_PREFIX}/go-download/hash/${RUNNER_OS:-Linux}/${CI_GO_MOD_HASH}.tar.zst"
archive_path="$(mktemp)"
trap 'rm -f "${archive_path}"' EXIT

if s3_cache_get "${cache_key}" "${archive_path}"; then
  zstd -dc "${archive_path}" | tar -C "${GITHUB_WORKSPACE}/.cache" -xf -
  echo "Restored S3 Go module download cache: ${cache_key}"
else
  echo "S3 Go module download cache not found: ${cache_key}"
fi
```

### `.github/scripts/ci/save-go-cache.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

source "${GITHUB_WORKSPACE}/.github/scripts/ci/s3-cache-common.sh"

if ! s3_cache_enabled; then
  echo "S3 Go module cache save skipped: missing RUNNER_S3_AK/RUNNER_S3_SK or rclone"
  exit 0
fi

if [[ -z "${CI_GO_MOD_HASH:-}" ]]; then
  echo "S3 Go module cache save skipped: CI_GO_MOD_HASH is empty"
  exit 0
fi

download_cache="${GOMODCACHE}/cache/download"
if [[ ! -d "${download_cache}" ]]; then
  echo "S3 Go module download cache save skipped: ${download_cache} does not exist"
  exit 0
fi

rm -rf "${GITHUB_WORKSPACE}/.cache/go/build-cache"
find "${download_cache}" -type f -name '*.lock' -delete

tmp_root="$(mktemp -d)"
tmp_tar="${tmp_root}/go-cache.tar"
tmp_archive="${tmp_tar}.zst"
trap 'rm -rf "${tmp_root}"' EXIT

mkdir -p "${GITHUB_WORKSPACE}/.cache/go/pkg/mod/cache/download"
tar \
  --sort=name \
  --mtime='UTC 1970-01-01' \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -C "${GITHUB_WORKSPACE}/.cache" \
  -cf "${tmp_tar}" \
  go/pkg/mod/cache/download
zstd -T0 -3 -q "${tmp_tar}" -o "${tmp_archive}"

cache_key="${RUNNER_S3_PREFIX}/go-download/hash/${RUNNER_OS:-Linux}/${CI_GO_MOD_HASH}.tar.zst"
s3_cache_upload_if_missing "${cache_key}" "${tmp_archive}"
```

### `.github/scripts/ci/restore-docker-image-cache.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

source "${GITHUB_WORKSPACE}/.github/scripts/ci/s3-cache-common.sh"

mkdir -p "${GITHUB_WORKSPACE}/.cache"

if ! s3_cache_enabled; then
  echo "S3 Docker image cache restore skipped: missing RUNNER_S3_AK/RUNNER_S3_SK or rclone"
  exit 0
fi

cache_key="${RUNNER_S3_PREFIX}/jobs/${RUNNER_S3_JOB_SCOPE}/docker/${RUNNER_OS:-Linux}/images.tar.zst"
archive_path="$(mktemp)"
trap 'rm -f "${archive_path}"' EXIT

if s3_cache_get "${cache_key}" "${archive_path}"; then
  zstd -dc "${archive_path}" | tar -C "${GITHUB_WORKSPACE}/.cache" -xf -
  echo "Restored S3 Docker image cache: ${cache_key}"
else
  echo "S3 Docker image cache not found: ${cache_key}"
fi
```

### `.github/scripts/ci/save-docker-image-cache.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

source "${GITHUB_WORKSPACE}/.github/scripts/ci/s3-cache-common.sh"

docker_cache_dir="${GITHUB_WORKSPACE}/.cache/docker-images"
if [[ ! -d "${docker_cache_dir}" ]]; then
  echo "S3 Docker image cache save skipped: ${docker_cache_dir} does not exist"
  exit 0
fi

if ! s3_cache_enabled; then
  echo "S3 Docker image cache save skipped: missing RUNNER_S3_AK/RUNNER_S3_SK or rclone"
  exit 0
fi

tmp_root="$(mktemp -d)"
tmp_tar="${tmp_root}/docker-images.tar"
tmp_archive="${tmp_tar}.zst"
trap 'rm -rf "${tmp_root}"' EXIT

tar -C "${GITHUB_WORKSPACE}/.cache" -cf "${tmp_tar}" docker-images
zstd -T0 -3 -q "${tmp_tar}" -o "${tmp_archive}"

cache_key="${RUNNER_S3_PREFIX}/jobs/${RUNNER_S3_JOB_SCOPE}/docker/${RUNNER_OS:-Linux}/images.tar.zst"
s3_cache_upload_if_changed "${cache_key}" "${tmp_archive}"
```

## 缓存 key 规则

### Go module cache

Go module cache 只缓存：

```text
${GOMODCACHE}/cache/download
```

不缓存 Go build cache。

key 使用 `go.mod` 和 `go.sum` 内容哈希：

```text
${RUNNER_S3_PREFIX}/go-download/hash/${RUNNER_OS}/${CI_GO_MOD_HASH}.tar.zst
```

示例：

```text
ci-cache/example-org/example-service/go-download/hash/Linux/<go-mod-hash>.tar.zst
```

同一个 `go.mod` 和 `go.sum` 内容会得到同一个 key。PR 重试、同分支后续 run、不同 Go job 都会复用这个对象。

保存时用：

```bash
rclone copyto --ignore-existing
```

同名对象已经存在时会跳过上传，不覆盖已有缓存。

### Docker image cache

Docker image cache key：

```text
${RUNNER_S3_PREFIX}/jobs/${RUNNER_S3_JOB_SCOPE}/docker/${RUNNER_OS}/images.tar.zst
```

示例：

```text
ci-cache/example-org/example-service/jobs/test/docker/Linux/images.tar.zst
```

Docker cache 是固定 job key，不是内容寻址 key，所以额外维护：

```text
${object_key}.sha256
```

保存时先比较远端 `.sha256` 和本地 archive sha256：

- 一致：输出 `S3 cache unchanged`，跳过上传。
- 不一致：上传新的 `images.tar.zst` 和新的 `.sha256`。

## 失败处理

缓存步骤保持 best-effort：

```yaml
continue-on-error: true
```

建议使用在：

- Restore Go module cache from S3
- Save Go module cache to S3
- Restore Docker image cache from S3
- Save Docker image cache to S3

缓存不可用时的行为：

- 缺少 `RUNNER_S3_AK`、`RUNNER_S3_SK` 或 `rclone` 时，脚本输出 skipped 并退出成功。
- Go module cache miss：后续 `go mod download` 重新下载。
- Docker image cache miss：后续镜像准备脚本重新拉取或构建镜像。
- S3 权限或网络失败：缓存步骤不应直接让主检查失败。

真正应该让 CI 失败的是代码检查、测试、`go mod tidy` 结果不一致等主流程问题。

## 验证方式

本地先做脚本语法检查：

```bash
bash -n .github/scripts/ci/s3-cache-common.sh \
  .github/scripts/ci/restore-go-cache.sh \
  .github/scripts/ci/save-go-cache.sh \
  .github/scripts/ci/restore-docker-image-cache.sh \
  .github/scripts/ci/save-docker-image-cache.sh
```

如果本机有 `shellcheck`：

```bash
shellcheck .github/scripts/ci/s3-cache-common.sh \
  .github/scripts/ci/restore-go-cache.sh \
  .github/scripts/ci/save-go-cache.sh \
  .github/scripts/ci/restore-docker-image-cache.sh \
  .github/scripts/ci/save-docker-image-cache.sh
```

workflow YAML 做基本解析：

```bash
ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f); puts f }' \
  .github/workflows/*.yml \
  .github/actions/ci-go-prep/action.yml
```

GitHub Actions 上看这些点：

- Go module cache 预热 job 通过。
- 代码检查 job 通过。
- 测试 job 通过。
- 日志里有 `CI_GO_MOD_HASH`。
- Go module restore 命中时有 `Restored S3 Go module download cache`。
- Go module save 时同名对象存在会走 `Uploading S3 cache if missing`，但不会覆盖远端对象。
- Docker restore 命中时有 `Restored S3 Docker image cache`。
- Docker 内容不变时有 `S3 cache unchanged`。

查看日志示例：

```bash
gh run view <run-id> --repo <owner/repo> --job <job-id> --log |
  rg "CI_GO_MOD_HASH|Restored S3 Go module|Uploading S3 cache if missing|Restored S3 Docker image cache|S3 cache unchanged|AccessDenied|Failed to copy"
```

## 注意事项

- 这份文档只覆盖 GitHub Actions 沙箱 runner，Prow 或其他 CI 系统要单独处理。
- 不要再引入自研 S3 客户端。runner template 已预装 `rclone`，S3 上传下载交给 rclone。
- 不要把 Go build cache 放进 S3。建议只缓存 module download cache，收益明确，污染风险小。
- 不要把 cache prefix 写成所有仓库共享的固定值。推荐带上 `${GITHUB_REPOSITORY}`。
- 不要依赖 rclone 默认配置文件。日志里出现 `Config file ".../rclone.conf" not found - using defaults` 说明没有走显式配置。
- Go module cache 是内容寻址，同名对象存在时跳过上传；Docker image cache 是固定 key，用 `.sha256` 判断是否需要上传。
- `RUNNER_S3_BUCKET=las-github-runner-dal`、`RUNNER_S3_ENDPOINT=s3.us-north-1.qiniucs.com`、`RUNNER_S3_REGION=us-north-1` 是统一固定配置。仓库接入时只需要在 GitHub Actions secrets 中配置 `RUNNER_S3_AK` 和 `RUNNER_S3_SK`。
- 如果 S3 报 `AccessDeniedByIAMPolicy`，优先检查实际访问路径是否包含预期的 `${GITHUB_REPOSITORY}` 前缀，以及 rclone config 是否包含 `provider = Qiniu`、`force_path_style = false`、`no_check_bucket = true`。
````