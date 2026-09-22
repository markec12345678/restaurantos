#!/bin/bash
# E2E 单 spec 运行器 — 前台调用，彻底清理 + 重新种子 + 启动 + 运行
# 用法: scripts/e2e-one.sh <spec-file>
SPEC="$1"
if [ -z "$SPEC" ]; then echo "usage: $0 <spec>"; exit 1; fi
cd /home/z/my-project

# 1) 彻底清理（按端口兜底 — 僵尸 next-server 不匹配 pkill 模式）
pkill -9 -f 'next dev' 2>/dev/null
pkill -9 -f processChild 2>/dev/null
pkill -9 -f 'next-server' 2>/dev/null
sleep 3
P=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[ -n "$P" ] && kill -9 "$P" 2>/dev/null && sleep 2
ss -tlnp 2>/dev/null | grep ':3000' > /dev/null && { echo "PORT STILL HELD"; exit 1; }

# 2) 重新种子（干净 PGlite 目录 — SIGKILL 后目录脏）
PGLITE_DATA_DIR=/home/z/my-project/pglite-e2e-data NEXTAUTH_SECRET=e2e-test-secret-only node scripts/init-e2e-db.mjs > /tmp/e2e-init.log 2>&1 || { echo "INIT FAILED"; tail -3 /tmp/e2e-init.log; exit 1; }

# 3) 启动服务器（E2E env）
(NODE_OPTIONS=--max-old-space-size=2048 DATABASE_URL='' PGLITE_DATA_DIR=/home/z/my-project/pglite-e2e-data FURS_ENV=test FURS_ALLOW_SIMULATION=true NEXTAUTH_SECRET=e2e-test-secret-only WS_BROADCAST_SECRET=e2e-test-secret-only API_RATE_LIMIT_MAX=600 LOGIN_RATE_LIMIT_MAX=200 WEBAUTHN_ENABLED=true bun run dev > /tmp/e2e-dev.log 2>&1 &)
up=0
for i in $(seq 1 16); do
  sleep 5
  h=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:3000/api/health)
  [ "$h" = "200" ] && up=1 && break
done
if [ "$up" != "1" ]; then echo "SERVER FAILED (health=$h)"; tail -5 /tmp/e2e-dev.log; exit 1; fi
echo "[server up, running $SPEC]"

# 4) 运行 spec（复用已启动服务器 — Playwright reuseExistingServer）
bun run test:e2e -- "$SPEC" 2>&1 | tail -8
