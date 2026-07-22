#!/bin/zsh

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_PID_FILE="$PROJECT_ROOT/.run/frontend.pid"
BACKEND_PID_FILE="$PROJECT_ROOT/.run/backend.pid"

project_process_matches() {
  local service="$1"
  local pid="$2"
  local command_line
  local process_cwd

  command_line="$(ps -p "$pid" -o command= 2>/dev/null)" || return 1
  process_cwd="$(LC_ALL=en_US.UTF-8 lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"

  if [[ "$service" == "frontend" ]]; then
    [[ "$process_cwd" == "$PROJECT_ROOT/frontend" ]] || return 1
    [[ "$command_line" == *npm*"run dev"* || "$command_line" == *vite*"--port 8080"* ]]
    return
  fi

  [[ "$process_cwd" == "$PROJECT_ROOT/backend" ]] || return 1
  [[ "$command_line" == *mvn*"spring-boot:run"* \
    || "$command_line" == *MavenCli*"spring-boot:run"* \
    || "$command_line" == *classworlds.launcher.Launcher*"spring-boot:run"* ]]
}

stop_service() {
  local service="$1"
  local pid_file="$2"
  local pid

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  pid="$(<"$pid_file")"
  case "$pid" in
    ''|*[!0-9]*)
      print -u2 -- "拒绝使用无效 PID 文件：$pid_file"
      return 1
      ;;
  esac

  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f -- "$pid_file"
    return 0
  fi

  if ! project_process_matches "$service" "$pid"; then
    print -u2 -- "PID $pid 不属于本项目的 $service 服务，拒绝终止。"
    return 1
  fi

  kill -TERM "$pid"
  local waited=0
  while kill -0 "$pid" 2>/dev/null && (( waited < 10 )); do
    sleep 1
    waited=$((waited + 1))
  done

  if kill -0 "$pid" 2>/dev/null; then
    print -u2 -- "$service 进程 $pid 未在 10 秒内退出。"
    return 1
  fi

  rm -f -- "$pid_file"
  print -- "已停止 $service（PID $pid）。"
}

exit_code=0
stop_service frontend "$FRONTEND_PID_FILE" || exit_code=1
stop_service backend "$BACKEND_PID_FILE" || exit_code=1
exit "$exit_code"
