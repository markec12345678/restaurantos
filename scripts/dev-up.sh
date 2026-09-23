#!/bin/bash
# R114 QA helper: start dev server if not healthy, wait until ready.
# Sandbox pobije background procese med tool-call-i — vsak klic, ki rabi
# strežnik, mora najprej poklicati ta skript.
set -u
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo 000)
if [ "$code" = "200" ]; then echo "[dev-up] already healthy"; exit 0; fi
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; pkill -f next-server 2>/dev/null; sleep 1
setsid env PGLITE_DATA_DIR=/tmp/pglite-data NEXTAUTH_SECRET=dev-secret-32-hex-chars-min LOGIN_RATE_LIMIT_MAX=30 bun run dev > dev.log 2>&1 < /dev/null &
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then echo "[dev-up] healthy (try $i)"; exit 0; fi
  sleep 3
done
echo "[dev-up] FAILED to become healthy (last=$code)"; tail -20 dev.log; exit 1
