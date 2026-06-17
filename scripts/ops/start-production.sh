#!/bin/bash
# RestaurantOS POS - Production startup script
# Usage: ./start-production.sh

cd /home/z/my-project

# Kill any existing process on port 3000
fuser -k 3000/tcp 2>/dev/null
sleep 1

# Check if build exists
if [ ! -d ".next/standalone" ]; then
  echo "❌ Build not found. Run: npm run build"
  exit 1
fi

# Ensure static files are copied
cp -r .next/static .next/standalone/.next/ 2>/dev/null
cp -r public .next/standalone/ 2>/dev/null

# Start with pm2
npx pm2 start ecosystem.config.js 2>/dev/null || npx pm2 reload restaurantos 2>/dev/null

echo ""
echo "✅ RestaurantOS POS is running!"
echo "   URL: http://0.0.0.0:3000"
echo "   PM2 status:"
npx pm2 status
