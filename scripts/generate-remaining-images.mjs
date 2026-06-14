import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Images that need to be generated to fix duplicate/wrong image assignments
const ITEMS_TO_GENERATE = [
  { 
    name: 'Tartuf', 
    prompt: 'Fresh black truffles on a rustic wooden board with a truffle shaver, gourmet ingredient, restaurant style, moody dark lighting, top-down food photography',
    output: 'public/menu-images/hrana/tartufi-svezi.png',
    size: '864x1152'
  },
  { 
    name: 'Polenta', 
    prompt: 'Creamy polenta served on a white plate with a dollop of butter and grated parmesan cheese, restaurant side dish, top-down food photography, warm lighting',
    output: 'public/menu-images/hrana/polenta-solo.png',
    size: '864x1152'
  },
  { 
    name: 'Bovški krafi', 
    prompt: 'Bovški krafi traditional Slovenian sweet dumplings on a plate, boiled pasta pockets with sweet filling, sprinkled with breadcrumbs, restaurant food photography',
    output: 'public/menu-images/hrana/bovski-krafi.png',
    size: '864x1152'
  },
  { 
    name: 'Pulled pork burger', 
    prompt: 'Pulled pork burger with coleslaw and BBQ sauce on a brioche bun, restaurant food photography, top-down view, appetizing, warm lighting',
    output: 'public/menu-images/hrana/pulled-pork-burger.png',
    size: '864x1152'
  },
  { 
    name: 'Jabolčni zavitek', 
    prompt: 'Apple strudel slice on a white plate with powdered sugar and vanilla sauce, Austrian style pastry, restaurant dessert photography, warm lighting',
    output: 'public/menu-images/hrana/jabolcni-zavitek.png',
    size: '864x1152'
  },
];

async function main() {
  const zai = await ZAI.create();
  let generated = 0;
  let failed = 0;

  for (const item of ITEMS_TO_GENERATE) {
    console.log(`Generating: ${item.name}...`);
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await zai.images.generations.create({
          prompt: item.prompt,
          size: item.size,
        });
        
        const base64 = response.data[0].base64;
        const buffer = Buffer.from(base64, 'base64');
        
        // Ensure directory exists
        const dir = path.dirname(item.output);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(item.output, buffer);
        console.log(`  ✓ Saved to ${item.output}`);
        generated++;
        break;
      } catch (e) {
        if (attempt < 2) {
          console.log(`  Attempt ${attempt + 1} failed, retrying in 10s...`);
          await new Promise(r => setTimeout(r, 10000));
        } else {
          console.log(`  ✗ All attempts failed: ${e.message}`);
          failed++;
        }
      }
    }

    // Wait between items to avoid rate limiting
    if (generated + failed < ITEMS_TO_GENERATE.length) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\nGenerated: ${generated}, Failed: ${failed}`);

  // Update database for successfully generated images
  if (generated > 0) {
    const db = new Database('./db/custom.db');
    const updateStmt = db.prepare('UPDATE MenuItem SET image = ? WHERE name = ?');
    
    const dbUpdates = [
      { name: 'Tartuf', newImage: '/menu-images/hrana/tartufi-svezi.png' },
      { name: 'Polenta', newImage: '/menu-images/hrana/polenta-solo.png' },
      { name: 'Bovški krafi', newImage: '/menu-images/hrana/bovski-krafi.png' },
      { name: 'Pulled pork burger', newImage: '/menu-images/hrana/pulled-pork-burger.png' },
      { name: 'Jabolčni zavitek', newImage: '/menu-images/hrana/jabolcni-zavitek.png' },
    ];
    
    for (const update of dbUpdates) {
      if (fs.existsSync('public' + update.newImage)) {
        updateStmt.run(update.newImage, update.name);
        console.log(`  Updated DB: ${update.name} -> ${update.newImage}`);
      }
    }
    
    db.close();
  }
}

main().catch(console.error);
