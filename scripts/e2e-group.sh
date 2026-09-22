#!/bin/bash
# E2E 分组运行器 — 组内 spec 共享服务器与 DB（保留套件内依赖），组间完全重置
# 用法: scripts/e2e-group.sh "spec1 spec2 ..."
cd /home/z/my-project

SPECS="$1"
if [ -z "$SPECS" ]; then echo "usage: $0 \"spec1 spec2\""; exit 1; fi

# 完整清理 — 进程树 + 端口兜底
pkill -9 -f 'next dev' 2>/dev/null
pkill -9 -f processChild 2>/dev/null
pkill -9 -f 'next-server' 2>/dev/null
sleep 3
P=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[ -n "$P" ] && kill -9 "$P" 2>/dev/null && sleep 2
if ss -tlnp 2>/dev/null | grep ':3000' > /dev/null; then echo "PORT STILL HELD"; exit 1; fi

# Playwright 全托管（webServer init+serve 一次，组内所有 spec 共享）
ARGS=""
for s in $SPECS; do ARGS="$ARGS tests/e2e/$s"; done
exec bun run test:e2e -- $ARGS 2>&1 | tail -8
