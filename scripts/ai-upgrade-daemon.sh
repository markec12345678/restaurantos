#!/bin/bash
# Persistent AI image upgrade daemon
# Runs in background, waits for rate limits, processes images in batches
# Monitor: tail -f /tmp/ai-upgrade-daemon.log

LOG=/tmp/ai-upgrade-daemon.log
cd /home/z/my-project

echo "=== Daemon started at $(date) ===" >> $LOG

# Initial wait for rate limit to reset
echo "Waiting 10 minutes for rate limit to fully reset..." >> $LOG
sleep 600

# Test if API is available
echo "Testing API at $(date)..." >> $LOG
result=$(z-ai-generate -p "wine bottle photo" -o "/tmp/test-api.png" -s 864x1152 2>&1)
if echo "$result" | grep -q "429"; then
  echo "Still rate limited. Waiting another 10 minutes..." >> $LOG
  sleep 600
  result=$(z-ai-generate -p "wine bottle photo" -o "/tmp/test-api.png" -s 864x1152 2>&1)
  if echo "$result" | grep -q "429"; then
    echo "Still rate limited after 20 minutes. Giving up for now." >> $LOG
    echo "Try again later. Rate limit may need hours to reset." >> $LOG
    exit 1
  fi
fi

echo "API is available! Starting batch processing at $(date)..." >> $LOG

# Process 3 images at a time with long delays
node scripts/upgrade-images-ai.mjs --batch 3 --start 0 >> $LOG 2>&1

echo "=== Batch complete at $(date) ===" >> $LOG
echo "Check log for next batch command" >> $LOG
