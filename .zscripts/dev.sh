#!/bin/bash
# RestaurantOS POS - Custom dev script
# This is run by the entrypoint.sh and should persist

cd /home/z/my-project

echo "[DEV] Installing dependencies..."
bun install 2>&1 || true

echo "[DEV] Setting up database..."
bun run db:push 2>&1 || true

echo "[DEV] Starting Next.js dev server on port 3000..."

# Start next dev directly (no tee pipe that can break)
exec npx next dev -p 3000
