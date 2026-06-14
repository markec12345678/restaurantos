#!/bin/bash
# RestaurantOS POS - Strežniški zagon
# Uporaba: ./start.sh [dev|prod]

cd /home/z/my-project

MODE=${1:-dev}

case $MODE in
  prod)
    # Produkcijski način - zahteva build
    if [ ! -d ".next/standalone" ]; then
      echo "Building production..."
      npx next build
      cp -r .next/static .next/standalone/.next/
      cp -r public .next/standalone/
    fi
    echo "Starting production server on 0.0.0.0:3000..."
    PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
    ;;
  dev|*)
    # Razvojni način
    echo "Starting dev server on 0.0.0.0:3000..."
    npx next dev -p 3000 -H 0.0.0.0
    ;;
esac
