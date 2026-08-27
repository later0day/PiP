#!/usr/bin/env bash
# pi-web UI 服务管理脚本：一键启动 / 停止 / 查看状态
# 用法: ./pi-web.sh {start|stop|restart|status|logs}
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

RUN_DIR="${TMPDIR:-/tmp}"
SESSIOND_PID="$RUN_DIR/pi-web-sessiond.pid"
GATEWAY_PID="$RUN_DIR/pi-web-gateway.pid"
SESSIOND_LOG="$RUN_DIR/pi-web-sessiond.log"
GATEWAY_LOG="$RUN_DIR/pi-web-gateway.log"

GATEWAY_URL="http://127.0.0.1:8504"
SOCK="$HOME/.pi-web/sessiond.sock"

is_running() { # $1 = pidfile
  [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null
}

wait_for() { # $1 = test cmd, $2 = timeout secs, $3 = label
  local i=0
  until eval "$1" >/dev/null 2>&1; do
    ((i++)); (( i > ${2} )) && { echo "  ✗ $3 超时"; return 1; }
    sleep 1
  done
  echo "  ✓ $3 就绪"
}

start() {
  if is_running "$SESSIOND_PID" && is_running "$GATEWAY_PID"; then
    echo "已在运行中。"; status; return 0
  fi

  if [[ ! -f dist/server/index.js || ! -f dist/server/sessiond.js ]]; then
    echo "未找到构建产物，请先运行: npm install --allow-scripts=node-pty && npm run build && npm run build:react"
    exit 1
  fi

  echo "启动 sessiond（会话守护）..."
  nohup node dist/server/sessiond.js > "$SESSIOND_LOG" 2>&1 &
  echo $! > "$SESSIOND_PID"
  wait_for "test -S '$SOCK'" 30 "sessiond socket"

  echo "启动 gateway（网关）..."
  nohup node dist/server/index.js > "$GATEWAY_LOG" 2>&1 &
  echo $! > "$GATEWAY_PID"
  wait_for "curl -sf -o /dev/null '$GATEWAY_URL/'" 20 "gateway HTTP"

  echo ""
  echo "✅ pi-web 已启动 → $GATEWAY_URL"
}

stop() {
  for pf in "$GATEWAY_PID" "$SESSIOND_PID"; do
    if is_running "$pf"; then
      kill "$(cat "$pf")" 2>/dev/null || true
      echo "已停止 PID $(cat "$pf")"
    fi
    rm -f "$pf"
  done
  echo "✅ 已停止。"
}

status() {
  echo "== pi-web 状态 =="
  if is_running "$SESSIOND_PID"; then echo "  sessiond: 运行中 (PID $(cat "$SESSIOND_PID"))"; else echo "  sessiond: 未运行"; fi
  if is_running "$GATEWAY_PID"; then echo "  gateway : 运行中 (PID $(cat "$GATEWAY_PID"))"; else echo "  gateway : 未运行"; fi
  [[ -S "$SOCK" ]] && echo "  socket  : $SOCK" || echo "  socket  : 缺失"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY_URL/" 2>/dev/null || echo 000)"
  echo "  HTTP    : $code ($GATEWAY_URL)"
}

logs() {
  echo "== sessiond 日志 ($SESSIOND_LOG) =="; tail -n 20 "$SESSIOND_LOG" 2>/dev/null || echo "(无)"
  echo ""
  echo "== gateway 日志 ($GATEWAY_LOG) =="; tail -n 20 "$GATEWAY_LOG" 2>/dev/null || echo "(无)"
}

case "${1:-status}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 1; start ;;
  status)  status ;;
  logs)    logs ;;
  *) echo "用法: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
