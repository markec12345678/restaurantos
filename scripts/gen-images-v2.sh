#!/bin/bash
LOG="/home/z/my-project/download/gen-images-log.txt"
BASE="/home/z/my-project/public/menu-images"

gen() {
  local prompt="$1"
  local output="$2"
  if [ -f "$output" ]; then
    return 0
  fi
  echo "GEN: $(basename $output) - $(date +%H:%M:%S)" >> $LOG
  timeout 90 z-ai-generate -p "$prompt" -o "$output" -s 864x1152 >> $LOG 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    echo "FAIL/Timeout: $(basename $output)" >> $LOG
    # Remove partial file if exists
    rm -f "$output" 2>/dev/null
    sleep 5
  else
    echo "OK: $(basename $output) - $(date +%H:%M:%S)" >> $LOG
  fi
  sleep 3
}

# Generate remaining images - check what's missing
cd /home/z/my-project && npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.menuItem.findMany({ select: { name: true, image: true, category: { select: { name: true } } } });
  const missing = items.filter(i => i.image && !fs.existsSync('/home/z/my-project/public' + i.image));
  console.log(missing.map(i => i.name + '|' + i.image + '|' + i.category.name).join('\\n'));
}
main().catch(console.error).finally(() => prisma.\$disconnect());
" > /tmp/missing-images.txt 2>/dev/null

echo "=== Starting generation at $(date) ===" >> $LOG
echo "Missing images: $(wc -l < /tmp/missing-images.txt)" >> $LOG

# Generate each missing image with proper prompt based on category
while IFS='|' read -r name imgpath category; do
  [ -z "$name" ] && continue
  slug="\$(basename "$imgpath" .png)"
  dir="\$(dirname "$imgpath")"
  full="$BASE/$dir/$slug.png"
  
  if [ -f "/home/z/my-project/public$dir/$slug.png" ]; then
    continue
  fi
  
  mkdir -p "/home/z/my-project/public$dir"
  
  # Generate with a generic but category-appropriate prompt
  gen "Professional commercial photography of $name $category dish, studio lighting, food photography" "/home/z/my-project/public$dir/$slug.png"
  
done < /tmp/missing-images.txt

echo "=== DONE at $(date) ===" >> $LOG
