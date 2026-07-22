#!/bin/zsh

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_PID_FILE="$PROJECT_ROOT/.run/frontend.pid"
BACKEND_PID_FILE="$PROJECT_ROOT/.run/backend.pid"

trim_command() {
  sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

expected_command_matches() {
  local service="$1"
  local command_line="$2"
  local npm_path
  npm_path="$(command -v npm 2>/dev/null || true)"
  if [[ "$service" == "frontend" ]]; then
    [[ "$command_line" == "npm run dev -- --host 127.0.0.1 --port 8080" \
      || "$command_line" == "npm run dev --host 127.0.0.1 --port 8080" \
      || "$command_line" == "/bin/zsh $npm_path run dev -- --host 127.0.0.1 --port 8080" \
      || "$command_line" == "/bin/sh $npm_path run dev -- --host 127.0.0.1 --port 8080" \
      || "$command_line" == *"/node $npm_path run dev -- --host 127.0.0.1 --port 8080" ]]
    return
  fi
  [[ "$command_line" == "/bin/zsh ./mvnw spring-boot:run" \
    || "$command_line" == "/bin/sh ./mvnw spring-boot:run" \
    || "$command_line" == "/bin/zsh $PROJECT_ROOT/backend/mvnw spring-boot:run" \
    || "$command_line" == "/bin/sh $PROJECT_ROOT/backend/mvnw spring-boot:run" \
    || "$command_line" == */bin/java*" org.codehaus.plexus.classworlds.launcher.Launcher spring-boot:run" \
    || "$command_line" == */bin/java*" org.apache.maven.cli.MavenCli spring-boot:run" ]]
}

project_process_matches() {
  local service="$1"
  local pid="$2"
  local command_line
  local process_cwd
  local pgid
  command_line="$(ps -p "$pid" -o command= 2>/dev/null | trim_command)" || return 1
  process_cwd="$(LC_ALL=en_US.UTF-8 lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
  pgid="$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d '[:space:]')" || return 1
  [[ "$pgid" == "$pid" ]] || return 1
  if [[ "$service" == "frontend" ]]; then
    [[ "$process_cwd" == "$PROJECT_ROOT/frontend" ]] || return 1
  else
    [[ "$process_cwd" == "$PROJECT_ROOT/backend" ]] || return 1
  fi
  expected_command_matches "$service" "$command_line"
}

group_alive() {
  kill -0 -- "-$1" 2>/dev/null
}

group_has_service_listener() {
  local group_id="$1"
  local port="$2"
  local owners
  local owner
  local owner_group
  owners="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  while IFS= read -r owner; do
    [[ -n "$owner" ]] || continue
    owner_group="$(ps -p "$owner" -o pgid= 2>/dev/null | tr -d '[:space:]')"
    [[ "$owner_group" == "$group_id" ]] && return 0
  done <<< "$owners"
  return 1
}

stop_service() {
  local service="$1"
  local pid_file="$2"
  local pid
  local port
  if [[ -L "$pid_file" ]]; then
    print -u2 -- "拒绝使用符号链接 PID 文件：$pid_file"
    return 1
  fi
  [[ -e "$pid_file" ]] || return 0
  if [[ ! -f "$pid_file" ]]; then
    print -u2 -- "拒绝使用非普通 PID 文件：$pid_file"
    return 1
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
    print -u2 -- "PID $pid 的 cwd、argv 或 PGID 不属于本项目 $service，拒绝终止。"
    return 1
  fi
  [[ "$service" == "frontend" ]] && port=8080 || port=8000
  kill -TERM -- "-$pid"
  zmodload zsh/datetime
  local deadline=$((EPOCHREALTIME + 10.0))
  while group_alive "$pid" && (( EPOCHREALTIME < deadline )); do
    sleep 0.05
  done
  if group_alive "$pid" || group_has_service_listener "$pid" "$port"; then
    print -u2 -- "$service 进程组 $pid 或其监听后代未在 10 秒内退出。"
    return 1
  fi
  rm -f -- "$pid_file"
  print -- "已停止 $service（PGID $pid）。"
}

exit_code=0
stop_service frontend "$FRONTEND_PID_FILE" || exit_code=1
stop_service backend "$BACKEND_PID_FILE" || exit_code=1
exit "$exit_code"
