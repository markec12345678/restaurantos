import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();
const publicDir = 'public';

// Food photography prompts for different categories
const PROMPTS = {
  'Vegetarijanske jedi': 'Vegetarian dish, professional food photography, restaurant menu, warm lighting, top-down view',
  'Priloge': 'Side dish served on a white plate, professional food photography, restaurant menu, warm lighting',
  'Pivo': 'Craft beer in a glass, professional product photography, restaurant bar, condensation droplets',
  'Brezalkoholno Pivo': 'Non-alcoholic beer in a glass, professional product photography, refreshing, cold',
  'Viski': 'Whiskey in a crystal glass, professional product photography, warm amber color, elegant bar setting',
  'Grenčice': 'Aperitif bitter liqueur in a glass, professional product photography, vibrant red/orange color, bar setting',
  'Destilati, Konjak in Rum': 'Premium rum in a crystal glass, professional product photography, dark amber, elegant',
  'Topli Napitki': 'Coffee with cream, professional food photography, latte art, warm cafe atmosphere',
  'Sokovi': 'Fresh natural apple juice in a glass, professional product photography, bright and refreshing',
  'Predjedi': 'Appetizer seafood platter, professional food photography, restaurant menu, elegant presentation',
  'Juhe': 'Traditional soup in a rustic bowl, professional food photography, steam rising, restaurant menu',
  'Testenine': 'Spaghetti bolognese on a plate, professional food photography, Italian restaurant, fresh parmesan',
  'Ribje jedi': 'Grilled fish fillet, professional food photography, restaurant menu, lemon garnish, elegant plating',
  'Glavne jedi': 'Traditional main course dish, professional food photography, restaurant menu, elegant plating',
};

function getPrompt(name, category) {
  const base = PROMPTS[category] || 'Professional food photography, restaurant menu style, warm lighting, elegant presentation';
  return `${name}, ${base}, high quality, photorealistic`;
}

async function main() {
  const items = await prisma.menuItem.findMany({
    select: { id: true, name: true, image: true, category: true }
  });

  const placeholders = [];

  for (const item of items) {
    if (!item.image) continue;
    const imgPath = path.join(publicDir, item.image);
    if (!fs.existsSync(imgPath)) continue;

    const buf = fs.readFileSync(imgPath);
    if (buf.length > 24 && buf[0] === 0x89) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width === 300 && height === 280) {
        placeholders.push(item);
      }
    }
  }

  console.log(`\n🎨 Found ${placeholders.length} placeholder images to replace\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < placeholders.length; i++) {
    const item = placeholders[i];
    const catName = item.category?.name || 'Food';
    const prompt = getPrompt(item.name, catName);
    const imgPath = path.join(publicDir, item.image);

    console.log(`[${i + 1}/${placeholders.length}] ${item.name} (${catName})`);

    try {
      execSync(
        `z-ai-generate -p "${prompt.replace(/"/g, '\\"')}" -o "${imgPath}" -s 864x1152`,
        { timeout: 60000, stdio: 'pipe' }
      );
      success++;
      console.log(`  ✅ Replaced`);
    } catch (err) {
      failed++;
      console.log(`  ❌ Failed: ${err.message?.substring(0, 80) || 'unknown error'}`);
    }

    // Small delay to avoid rate limiting
    if (i < placeholders.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n📊 Done: ${success} replaced, ${failed} failed`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
