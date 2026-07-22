#!/bin/zsh
set -u

ROOT_DIR="${0:A:h}"
RUN_DIR="$ROOT_DIR/.run"

for service in frontend backend; do
  pid_file="$RUN_DIR/$service.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(<"$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid"
    fi
    rm -f "$pid_file"
  fi
done

echo "UniSpeaking Demo 已停止。"
