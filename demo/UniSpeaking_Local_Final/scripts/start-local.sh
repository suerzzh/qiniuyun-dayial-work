#!/bin/zsh

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
RUN_DIR="$PROJECT_ROOT/.run"
FRONTEND_PID_FILE="$PROJECT_ROOT/.run/frontend.pid"
BACKEND_PID_FILE="$PROJECT_ROOT/.run/backend.pid"
FRONTEND_LOG="$PROJECT_ROOT/.run/frontend.log"
BACKEND_LOG="$PROJECT_ROOT/.run/backend.log"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

for required_command in lsof curl node npm; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    print -u2 -- "缺少启动所需命令：$required_command"
    exit 1
  fi
done

if [[ ! -x "$BACKEND_DIR/mvnw" ]]; then
  print -u2 -- "后端 Maven wrapper 不可执行：$BACKEND_DIR/mvnw"
  exit 1
fi

assert_port_available() {
  local port="$1"
  local owners
  owners="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -z "$owners" ]]; then
    return 0
  fi

  print -u2 -- "端口 $port 已被占用，拒绝启动。请先确认并停止对应进程："
  local owner
  while IFS= read -r owner; do
    [[ -n "$owner" ]] || continue
    ps -p "$owner" -o pid=,command= 2>/dev/null >&2 || print -u2 -- "PID $owner"
  done <<< "$owners"
  return 1
}

assert_port_available 8000 || exit 1
assert_port_available 8080 || exit 1

if [[ -L "$RUN_DIR" ]]; then
  print -u2 -- "运行目录不能是符号链接：$RUN_DIR"
  exit 1
fi
mkdir -p -- "$RUN_DIR"
if [[ ! -d "$RUN_DIR" ]]; then
  print -u2 -- "无法创建安全运行目录：$RUN_DIR"
  exit 1
fi
umask 077

launch_detached() {
  local working_dir="$1"
  local log_file="$2"
  local pid_file="$3"
  shift 3

  node - "$working_dir" "$log_file" "$pid_file" "$@" <<'NODE'
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const [workingDirectory, logPath, pidPath, command, ...args] = process.argv.slice(2);
const noFollow = fs.constants.O_NOFOLLOW || 0;
const temporaryPidPath = `${pidPath}.${process.pid}.${Date.now()}.tmp`;

function groupAlive(pid) {
  try { process.kill(-pid, 0); return true; } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function terminateGroup(pid) {
  try { process.kill(-pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  for (let index = 0; index < 40 && groupAlive(pid); index += 1) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  if (groupAlive(pid)) {
    try { process.kill(-pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  }
  for (let index = 0; index < 40 && groupAlive(pid); index += 1) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  if (groupAlive(pid)) throw new Error(`process group ${pid} survived cleanup`);
}

async function main() {
  for (const target of [logPath, pidPath]) {
    try {
      if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`unsafe symbolic-link target: ${target}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const logFd = fs.openSync(logPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | noFollow, 0o600);
  const child = spawn(command, args, {
    cwd: workingDirectory,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  await new Promise((resolvePromise, rejectPromise) => {
    child.once("spawn", resolvePromise);
    child.once("error", rejectPromise);
  });
  let pidIdentity;
  let published = false;
  const syncRunDirectory = () => {
    const directoryFd = fs.openSync(path.dirname(pidPath), fs.constants.O_RDONLY);
    try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
  };
  const unlinkIfOwned = (target) => {
    if (!pidIdentity) return;
    try {
      const observed = fs.lstatSync(target);
      if (observed.dev === pidIdentity.dev && observed.ino === pidIdentity.ino) fs.unlinkSync(target);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  };
  try {
    const payload = Buffer.from(`${child.pid}\n`);
    const pidFd = fs.openSync(temporaryPidPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollow, 0o600);
    try {
      pidIdentity = fs.fstatSync(pidFd);
      if (fs.writeSync(pidFd, payload) !== payload.length) throw new Error("incomplete PID write");
      fs.fsyncSync(pidFd);
    } finally {
      fs.closeSync(pidFd);
    }
    fs.linkSync(temporaryPidPath, pidPath);
    published = true;
    syncRunDirectory();
    fs.unlinkSync(temporaryPidPath);
    syncRunDirectory();
  } catch (error) {
    await terminateGroup(child.pid);
    if (published) unlinkIfOwned(pidPath);
    unlinkIfOwned(temporaryPidPath);
    try { syncRunDirectory(); } catch {}
    throw error;
  } finally {
    fs.closeSync(logFd);
  }
  child.unref();
  process.stdout.write(`${child.pid}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
NODE
}

zmodload zsh/datetime
startup_deadline=$((EPOCHREALTIME + 45.0))

if ! frontend_pid="$(launch_detached "$FRONTEND_DIR" "$FRONTEND_LOG" "$FRONTEND_PID_FILE" npm run dev -- --host 127.0.0.1 --port 8080)"; then
  print -u2 -- "无法启动前端进程，请查看 $FRONTEND_LOG"
  exit 1
fi

if ! backend_pid="$(launch_detached "$BACKEND_DIR" "$BACKEND_LOG" "$BACKEND_PID_FILE" ./mvnw spring-boot:run)"; then
  print -u2 -- "无法启动后端进程，请查看 $BACKEND_LOG"
  "$SCRIPT_DIR/stop-local.sh" || true
  exit 1
fi

stop_started_services() {
  "$SCRIPT_DIR/stop-local.sh" || true
}

handle_interrupt() {
  print -u2 -- "启动被中断，正在停止本次启动的服务。"
  stop_started_services
  exit 130
}

trap handle_interrupt INT TERM HUP

while (( EPOCHREALTIME < startup_deadline )); do
  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    print -u2 -- "前端进程启动失败，请查看 $FRONTEND_LOG"
    stop_started_services
    exit 1
  fi
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    print -u2 -- "后端进程启动失败，请查看 $BACKEND_LOG"
    stop_started_services
    exit 1
  fi

  remaining=$((startup_deadline - EPOCHREALTIME))
  (( remaining > 0.0 )) || break
  curl_timeout=$(( remaining < 1.0 ? remaining : 1.0 ))
  backend_ready=false
  curl -fsS --max-time "$curl_timeout" http://127.0.0.1:8000/health >/dev/null 2>&1 && backend_ready=true
  remaining=$((startup_deadline - EPOCHREALTIME))
  (( remaining > 0.0 )) || break
  curl_timeout=$(( remaining < 1.0 ? remaining : 1.0 ))
  if [[ "$backend_ready" == true ]] \
      && curl -fsS --max-time "$curl_timeout" http://127.0.0.1:8080/ >/dev/null 2>&1; then
    trap - INT TERM HUP
    print -- "UniSpeaking 已启动：http://127.0.0.1:8080/#/ielts"
    print -- "前端日志：$FRONTEND_LOG"
    print -- "后端日志：$BACKEND_LOG"
    exit 0
  fi
  remaining=$((startup_deadline - EPOCHREALTIME))
  (( remaining > 0.0 )) || break
  sleep_for=$(( remaining < 1.0 ? remaining : 1.0 ))
  sleep "$sleep_for"
done

print -u2 -- "服务未能在 45 秒内就绪，正在停止本次启动的进程。"
stop_started_services
exit 1
