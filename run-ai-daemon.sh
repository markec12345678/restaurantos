#!/bin/bash
# Auto-restart wrapper for AI image daemon
# Runs the daemon, restarts it if it crashes
# Kills existing instances first

cd /home/z/my-project

# Kill any existing instances
pkill -f "ai-image-daemon.mjs" 2>/dev/null || true
sleep 2

while true; do
  echo "[$(date)] Starting AI image daemon..."
  node ai-image-daemon.mjs >> /home/z/my-project/ai-daemon.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Daemon exited with code $EXIT_CODE"
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] All images replaced! Exiting."
    break
  fi
  
  echo "[$(date)] Restarting in 30 seconds..."
  sleep 30
done
