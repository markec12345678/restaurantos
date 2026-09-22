#!/bin/bash
# E2E 分片运行器 — 每个 spec 重启服务器（4GB 内存环境确定性方案）
cd /home/z/my-project
PASS=0; FAIL=0; FAILED_SPECS=""

kill_all() {
  pkill -9 -f 'next dev' 2>/dev/null
  pkill -9 -f processChild 2>/dev/null
  pkill -9 -f 'next-server' 2>/dev/null
  sleep 4
  # 兜底：按端口找持有者
  P=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$P" ] && kill -9 "$P" 2>/dev/null
  sleep 1
}

start_server() {
  # SIGKILL 后 PGlite 目录脏（WASM crash-recovery abort）— 每次启动前重置种子
  # （确定性 E2E 开始，init-e2e-db 默认 wipe + DDL + seed，同 playwright webServer kanon）
  PGLITE_DATA_DIR=/home/z/my-project/pglite-e2e-data NEXTAUTH_SECRET=e2e-test-secret-only node scripts/init-e2e-db.mjs > /tmp/e2e-init.log 2>&1
  (NODE_OPTIONS=--max-old-space-size=2048 DATABASE_URL='' PGLITE_DATA_DIR=/home/z/my-project/pglite-e2e-data FURS_ENV=test FURS_ALLOW_SIMULATION=true NEXTAUTH_SECRET=e2e-test-secret-only WS_BROADCAST_SECRET=e2e-test-secret-only API_RATE_LIMIT_MAX=600 LOGIN_RATE_LIMIT_MAX=200 WEBAUTHN_ENABLED=true bun run dev > /tmp/e2e-dev.log 2>&1 &)
  ok=0
  for i in $(seq 1 14); do
    sleep 5
    h=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:3000/api/health)
    [ "$h" = "200" ] && ok=1 && break
  done
  [ "$ok" = "1" ]
}

kill_all
for spec in tests/e2e/*.spec.ts; do
  name=$(basename "$spec")
  if ! start_server; then
    echo "[$name] SERVER FAILED — retry once"
    kill_all
    if ! start_server; then
      echo "[$name] SERVER FAILED TO START"; FAIL=$((FAIL+1)); FAILED_SPECS="$FAILED_SPECS $name"; continue
    fi
  fi
  out=$(bun run test:e2e -- "$spec" 2>&1 | tail -25)
  p=$(echo "$out" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
  f=$(echo "$out" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1)
  p=${p:-0}; f=${f:-0}
  if [ "$f" = "0" ]; then
    PASS=$((PASS+1)); echo "[$name] OK ($p passed)"
  else
    FAIL=$((FAIL+1)); FAILED_SPECS="$FAILED_SPECS $name"; echo "[$name] FAILED ($f failed, $p passed)"
    echo "$out" | grep -B1 -A10 'Error:' | head -25
  fi
  kill_all
done
echo "=== CHUNKS: PASS=$PASS FAIL=$FAIL ==="
[ -n "$FAILED_SPECS" ] && echo "FAILED:$FAILED_SPECS"
