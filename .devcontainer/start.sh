#!/bin/bash
echo "START $(date)" > /tmp/start-status.txt
cd /workspaces/restaurantos

# Start dev server
echo "Starting dev server..." >> /tmp/start-status.txt
nohup npm run dev > /tmp/dev.log 2>&1 &
DEV_PID=$!
echo "Dev PID: $DEV_PID" >> /tmp/start-status.txt

# Wait for compile
sleep 40
echo "Wait done" >> /tmp/start-status.txt

# Check if server is up
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>&1)
echo "HTTP: $HTTP" >> /tmp/start-status.txt

# Copy status to repo so we can read it via API
cp /tmp/start-status.txt /workspaces/restaurantos/.devcontainer/start-status.txt
cp /tmp/dev.log /workspaces/restaurantos/.devcontainer/dev.log

# Auto-commit (uses codespace's GITHUB_TOKEN)
cd /workspaces/restaurantos
git config user.email "codespace@restaurantos.local"
git config user.name "Codespace Bot"
git add .devcontainer/start-status.txt .devcontainer/dev.log
git commit -m "chore: codespace status update" 2>/dev/null || true
git push origin HEAD 2>/dev/null || true

echo "DONE" >> /tmp/start-status.txt
