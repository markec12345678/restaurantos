#!/bin/bash
# Resumable E2E chunked runner — state persisted in /tmp/e2e-state.txt
# Each invocation runs specs until SIGTERM/timeout; already-passed specs are skipped.
cd /home/z/my-project
STATE=/tmp/e2e-state.txt
touch "$STATE"

kill_all() {
  pkill -9 -f 'next dev' 2>/dev/null
  pkill -9 -f processChild 2>/dev/null
  pkill -9 -f 'next-server' 2>/dev/null
  sleep 4
  P=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$P" ] && kill -9 "$P" 2>/dev/null
  sleep 1
}

start_server() {
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
  grep -q "^OK:$name$" "$STATE" && { echo "[skip] $name (already passed)"; continue; }
  grep -q "^FAILED:$name$" "$STATE" && { echo "[skip] $name (already failed)"; continue; }
  if ! start_server; then
    echo "[$name] SERVER FAILED — retry once"
    kill_all
    if ! start_server; then
      echo "[$name] SERVER FAILED TO START"; echo "FAILED:$name" >> "$STATE"; continue
    fi
  fi
  out=$(bun run test:e2e -- "$spec" 2>&1 | tail -25)
  p=$(echo "$out" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
  f=$(echo "$out" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1)
  p=${p:-0}; f=${f:-0}
  if [ "$f" = "0" ]; then
    echo "OK:$name" >> "$STATE"; echo "[$name] OK ($p passed)"
  else
    echo "FAILED:$name" >> "$STATE"; echo "[$name] FAILED ($f failed, $p passed)"
    echo "$out" | grep -B1 -A10 'Error:' | head -25
  fi
  kill_all
done
echo "=== STATE: $(grep -c '^OK:' "$STATE") passed, $(grep -c '^FAILED:' "$STATE") failed ==="
[ "$(grep -c '^FAILED:' "$STATE")" = "0" ] && grep -c '^OK:' "$STATE" | grep -q '16' && echo "ALL_GREEN"
