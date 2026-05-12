#!/bin/bash
# AI Image Upgrade Runner
# Waits for rate limit to clear, then runs the daemon
# Usage: bash scripts/run-ai-upgrade.sh

echo "[$(date)] Starting AI upgrade runner..."
echo "[$(date)] Waiting 10 minutes for rate limits to clear..."

sleep 600

echo "[$(date)] Wait complete. Starting daemon..."
cd "$(dirname "$0")/.."
node scripts/ai-upgrade-daemon.mjs --wait 0 --delay 45 2>&1 | tee -a /tmp/ai-upgrade.log

echo "[$(date)] Daemon finished."
