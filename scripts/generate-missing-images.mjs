import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const ITEMS = [
  { name: 'Hišna pašteta z medom in tartufi', prompt: 'Homemade meat pate with honey and black truffles, served with toasted bread, on a dark rustic plate, restaurant presentation, top-down food photography, warm lighting', output: 'public/menu-images/hrana/hisna-pasteta-med-tartufi.png' },
  { name: 'Pulled pork burger', prompt: 'Pulled pork burger with coleslaw on brioche bun, melted BBQ sauce, restaurant food photography, top-down view, appetizing', output: 'public/menu-images/hrana/pulled-pork-burger.png' },
  { name: '4 siri', prompt: 'Four cheese plate with different artisan cheeses, honey, walnuts, grapes, on a wooden board, restaurant style food photography, top-down view', output: 'public/menu-images/hrana/stiri-siri.png' },
  { name: 'Tartuf', prompt: 'Fresh black truffles on a wooden cutting board with truffle shaver, restaurant style, gourmet food photography, dark moody lighting', output: 'public/menu-images/hrana/tartufi-svezi.png' },
  { name: 'Polenta', prompt: 'Creamy polenta served on a plate with butter and parmesan, restaurant style food photography, top-down view, warm lighting', output: 'public/menu-images/hrana/polenta.png' },
  { name: 'Jabolčni zavitek', prompt: 'Apple strudel slice on a plate with powdered sugar and vanilla sauce, Austrian style, restaurant food photography, warm lighting', output: 'public/menu-images/hrana/jabolcni-zavitek.png' },
  { name: 'Panna cotta', prompt: 'Panna cotta dessert in a glass with berry coulis and fresh berries, restaurant style dessert photography, elegant presentation', output: 'public/menu-images/hrana/panna-cotta-2.png' },
  { name: 'Lava cake', prompt: 'Chocolate lava cake with molten center on a plate with ice cream, restaurant dessert photography, dark moody lighting', output: 'public/menu-images/hrana/lava-cake.png' },
  { name: 'Limonin creme brulee', prompt: 'Lemon creme brulee in ramekin with caramelized sugar top, restaurant dessert photography, elegant presentation', output: 'public/menu-images/hrana/limonin-creme-brulee.png' },
  { name: 'Bovški krafi', prompt: 'Bovški krafi traditional Slovenian dumplings on a plate, boiled pasta dumplings with filling, restaurant style food photography', output: 'public/menu-images/hrana/bovski-krafi.png' },
  { name: 'Divjačinski golaž', prompt: 'Wild game goulash in a bowl with dark rich sauce, served with bread, restaurant style food photography, warm lighting', output: 'public/menu-images/hrana/divjacinski-golaz.png' },
];

async function main() {
  const zai = await ZAI.create();
  let generated = 0;
  let failed = 0;
  
  for (const item of ITEMS) {
    console.log(`Generating: ${item.name}...`);
    try {
      const response = await zai.images.generations.create({
        prompt: item.prompt,
        size: '864x1152',
      });
      
      const base64 = response.data[0].base64;
      const buffer = Buffer.from(base64, 'base64');
      
      // Ensure directory exists
      const dir = path.dirname(item.output);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      fs.writeFileSync(item.output, buffer);
      console.log(`  ✓ Saved to ${item.output}`);
      generated++;
    } catch (e) {
      console.log(`  ✗ Failed: ${e.message}`);
      failed++;
    }
    
    // Wait 5 seconds between requests
    if (generated + failed < ITEMS.length) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log(`\nGenerated: ${generated}, Failed: ${failed}`);
}

main().catch(console.error);
