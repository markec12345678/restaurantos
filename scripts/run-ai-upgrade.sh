#!/bin/bash
# Auto-retry AI image upgrade runner
# Runs the upgrade script with intelligent retry on rate limits
# Usage: bash scripts/run-ai-upgrade.sh

cd /home/z/my-project
LOG=/tmp/ai-upgrade-progress.log

echo "=== AI Upgrade Runner started at $(date) ===" >> $LOG

MAX_ATTEMPTS=50
attempt=0

while [ $attempt -lt $MAX_ATTEMPTS ]; do
  attempt=$((attempt + 1))
  echo "Attempt $attempt at $(date)..." >> $LOG
  
  # Try to generate a test image
  result=$(z-ai-generate -p "test wine photo" -o "/tmp/test-rate.png" -s 864x1152 2>&1)
  
  if echo "$result" | grep -q "429"; then
    echo "  Rate limited. Waiting 5 minutes before retry..." >> $LOG
    sleep 300
    continue
  fi
  
  if echo "$result" | grep -q "Error"; then
    echo "  Other error: $(echo $result | head -1). Waiting 2 minutes..." >> $LOG
    sleep 120
    continue
  fi
  
  echo "  API is available! Starting batch processing..." >> $LOG
  
  # Run the upgrade script in batches of 3
  start=0
  while true; do
    echo "  Processing batch starting at $start..." >> $LOG
    output=$(node scripts/upgrade-images-ai.mjs --batch 3 --start $start 2>&1)
    echo "$output" >> $LOG
    
    # Check if all done
    if echo "$output" | grep -q "All items processed"; then
      echo "=== All images processed! ===" >> $LOG
      exit 0
    fi
    
    # Get next start from output
    nextStart=$(echo "$output" | grep -oP '\-\-start \K\d+' | tail -1)
    if [ -z "$nextStart" ] || [ "$nextStart" = "$start" ]; then
      echo "  No more progress. Breaking." >> $LOG
      break
    fi
    
    start=$nextStart
    echo "  Waiting 10s before next batch..." >> $LOG
    sleep 10
  done
  
  echo "=== Batch processing complete at $(date) ===" >> $LOG
  exit 0
done

echo "=== Max attempts reached. Try again later. ===" >> $LOG
