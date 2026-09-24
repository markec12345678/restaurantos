#!/bin/bash
# RestaurantOS POS - Keep-alive script
# Keeps the server running by restarting if it dies

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while true; do
  echo "[$(date)] Starting RestaurantOS POS server..."
  NODE_ENV=development node server.js 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
