#!/bin/bash
exec > /tmp/start-status.txt 2>&1
echo "=== Codespace Status Report ==="
echo "Date: $(date)"
echo "Node: $(node -v)"
echo "Dir: $(pwd)"

cd /workspaces/restaurantos

# Start dev server
echo ""
echo "=== Starting npm run dev ==="
nohup npm run dev > /tmp/dev.log 2>&1 &
echo "PID: $!"

# Wait for compile
echo "Waiting 45s..."
sleep 45

# Check
echo ""
echo "=== Server check ==="
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>&1)
echo "HTTP: $HTTP"

echo ""
echo "=== Dev log (last 10 lines) ==="
tail -10 /tmp/dev.log

# Post status as PR comment using gh CLI (pre-authenticated in codespace)
echo ""
echo "=== Posting to PR #68 ==="
gh pr comment 68 --body "$(cat /tmp/start-status.txt)" 2>&1 || echo "PR comment failed"

# Also make port public
echo ""
echo "=== Making port public ==="
gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>&1 || echo "Port visibility failed"
