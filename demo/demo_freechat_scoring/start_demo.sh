#!/bin/zsh
set -eu

ROOT_DIR="${0:A:h}"
RUN_DIR="$ROOT_DIR/.run"
MAVEN="$ROOT_DIR/.m2/wrapper/dists/apache-maven-3.9.11/a2d47e15/bin/mvn"
mkdir -p "$RUN_DIR"

if ! lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  cd "$ROOT_DIR"
  nohup python3 -m http.server 5173 --bind 127.0.0.1 \
    >"$RUN_DIR/frontend.log" 2>&1 &
  echo $! >"$RUN_DIR/frontend.pid"
fi

if ! lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
  if [[ ! -x "$MAVEN" ]]; then
    echo "找不到项目内 Maven：$MAVEN"
    exit 1
  fi
  cd "$ROOT_DIR/backend_java"
  nohup "$MAVEN" -Dmaven.repo.local=../.m2/repository \
    -Dspring-boot.run.main-class=com.example.unispeaking.UnispeakingApplication \
    spring-boot:run >"$RUN_DIR/backend.log" 2>&1 &
  echo $! >"$RUN_DIR/backend.pid"
fi

for _ in {1..30}; do
  if curl --max-time 1 -fsS http://127.0.0.1:5173/webrtc_demo.html >/dev/null 2>&1 && \
     curl --max-time 1 -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "UniSpeaking Demo 已启动："
    echo "http://127.0.0.1:5173/webrtc_demo.html"
    exit 0
  fi
  sleep 1
done

echo "服务未能在 30 秒内启动，请检查："
echo "$RUN_DIR/frontend.log"
echo "$RUN_DIR/backend.log"
exit 1
