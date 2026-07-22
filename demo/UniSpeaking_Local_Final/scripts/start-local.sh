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

for required_command in lsof curl npm; do
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

mkdir -p -- "$RUN_DIR"
umask 077

launch_detached() {
  local working_dir="$1"
  local log_file="$2"
  shift 2

  node - "$working_dir" "$log_file" "$@" <<'NODE'
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const [workingDirectory, logPath, command, ...args] = process.argv.slice(2);
const logFd = fs.openSync(logPath, "w", 0o600);
const child = spawn(command, args, {
  cwd: workingDirectory,
  detached: true,
  stdio: ["ignore", logFd, logFd],
});

child.once("error", (error) => {
  fs.closeSync(logFd);
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.once("spawn", () => {
  child.unref();
  fs.closeSync(logFd);
  process.stdout.write(`${child.pid}\n`);
});
NODE
}

if ! frontend_pid="$(launch_detached "$FRONTEND_DIR" "$FRONTEND_LOG" npm run dev -- --host 127.0.0.1 --port 8080)"; then
  print -u2 -- "无法启动前端进程，请查看 $FRONTEND_LOG"
  exit 1
fi
printf '%s\n' "$frontend_pid" >"$FRONTEND_PID_FILE"

if ! backend_pid="$(launch_detached "$BACKEND_DIR" "$BACKEND_LOG" ./mvnw spring-boot:run)"; then
  print -u2 -- "无法启动后端进程，请查看 $BACKEND_LOG"
  "$SCRIPT_DIR/stop-local.sh" || true
  exit 1
fi
printf '%s\n' "$backend_pid" >"$BACKEND_PID_FILE"

stop_started_services() {
  "$SCRIPT_DIR/stop-local.sh" || true
}

handle_interrupt() {
  print -u2 -- "启动被中断，正在停止本次启动的服务。"
  stop_started_services
  exit 130
}

trap handle_interrupt INT TERM HUP

deadline=$((SECONDS + 45))
while (( SECONDS < deadline )); do
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

  if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1 \
      && curl -fsS --max-time 2 http://127.0.0.1:8080/ >/dev/null 2>&1; then
    trap - INT TERM HUP
    print -- "UniSpeaking 已启动：http://127.0.0.1:8080/#/ielts"
    print -- "前端日志：$FRONTEND_LOG"
    print -- "后端日志：$BACKEND_LOG"
    exit 0
  fi
  sleep 1
done

print -u2 -- "服务未能在 45 秒内就绪，正在停止本次启动的进程。"
stop_started_services
exit 1
