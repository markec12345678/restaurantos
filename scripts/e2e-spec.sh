#!/bin/bash
# E2E 单 spec 运行器 v2 — 完整清理 + Playwright 全托管（webServer 自管 init+serve+teardown）
# 用法: scripts/e2e-spec.sh <spec-file>
SPEC="$1"
if [ -z "$SPEC" ]; then echo "usage: $0 <spec>"; exit 1; fi
cd /home/z/my-project

# 完整清理 — 进程树 + 端口兜底（僵尸 next-server 不匹配 pkill 模式）
pkill -9 -f 'next dev' 2>/dev/null
pkill -9 -f processChild 2>/dev/null
pkill -9 -f 'next-server' 2>/dev/null
sleep 3
P=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[ -n "$P" ] && kill -9 "$P" 2>/dev/null && sleep 2
if ss -tlnp 2>/dev/null | grep ':3000' > /dev/null; then echo "PORT STILL HELD"; exit 1; fi

# Playwright 全托管（webServer: init-e2e-db + bun run dev, reuse=false 路径在此环境从不触发）
exec bun run test:e2e -- "$SPEC" 2>&1 | tail -6
