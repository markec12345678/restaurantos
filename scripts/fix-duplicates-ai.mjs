#!/usr/bin/env node
/**
 * Fix duplicate menu images by generating unique AI images.
 * Run this script when the image generation API is available.
 * 
 * Usage: node scripts/fix-duplicates-ai.mjs [--start-from N] [--delay MS]
 * 
 * Default delay: 30 seconds between API calls to avoid rate limiting.
 */

import ZAI from 'z-ai-web-dev-sdk';
import * as fs from 'fs';
import * as path from 'path';

const MENU_DIR = '/home/z/my-project/public/menu-images';
const DEFAULT_DELAY = 30000;

const duplicates = [
  // === HRANA ===
  { path: 'hrana/frito-misto.png', prompt: 'Professional food photography of crispy fried calamari rings with golden batter, tartar sauce and lemon wedge, dark slate plate, moody dark background, studio lighting, shallow depth of field, 85mm lens' },
  { path: 'hrana/frito-misto-2.png', prompt: 'Professional food photography of Italian fritto misto seafood platter, crispy battered shrimp squid and zucchini, paper cone, lemon, dark wooden board, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/goveja-juha-rezanci-2.png', prompt: 'Professional food photography of Slovenian beef noodle soup, clear golden broth with thin egg noodles and shredded beef, fresh parsley, white ceramic bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/goveja-juha-rezanci-3.png', prompt: 'Professional food photography of traditional beef soup with handmade noodles, rich amber broth, root vegetables, served in rustic pottery bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/gobova-juha-2.png', prompt: 'Professional food photography of creamy wild mushroom soup, smooth velvety porcini texture, served in bread bowl, truffle oil drizzle, fresh thyme, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/gobova-juha-3.png', prompt: 'Professional food photography of chunky forest mushroom cream soup with chanterelles and button mushrooms, sour cream swirl, chives, dark ceramic bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/hobotnica-2.png', prompt: 'Professional food photography of grilled octopus tentacles with charred crispy edges, tender pink flesh, olive oil drizzle, cherry tomatoes, wooden board, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/hobotnica-zar-3.png', prompt: 'Professional food photography of charcoal grilled baby octopus, smoky grill marks, served with lemon halves and roasted potatoes, dark slate plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/hobotnica-solata-2.png', prompt: 'Professional food photography of grilled octopus salad on mixed greens, cherry tomatoes, capers, lemon vinaigrette, white plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/hobotnica-solata-3.png', prompt: 'Professional food photography of Mediterranean octopus salad with arugula, purple olives, red onion rings, lemon dressing, rustic ceramic bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/losos-zar-2.png', prompt: 'Professional food photography of grilled salmon fillet with crispy skin, pink juicy flesh, asparagus, lemon butter sauce, dark slate plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/losos-zar-3.png', prompt: 'Professional food photography of cedar plank grilled salmon, honey mustard glaze, fresh dill, microgreens, roasted vegetables, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/spageti-bolonjske-2.png', prompt: 'Professional food photography of spaghetti bolognese with rich meat ragu, freshly grated parmesan, basil leaf, white ceramic bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/spageti-bolonjske-3.png', prompt: 'Professional food photography of classic Italian bolognese pasta, thick slow-cooked beef tomato sauce, parmesan shavings, terracotta bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/goveja-juha-jajce-2.png', prompt: 'Professional food photography of Slovenian beef soup with soft boiled egg, golden broth, egg halves, fresh chives, traditional pottery bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/goveja-juha-jajce.png', prompt: 'Professional food photography of hearty beef broth with poached egg, root vegetables, fresh parsley, rustic ceramic bowl on linen, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/golaz-polenta-2.png', prompt: 'Professional food photography of beef goulash with creamy polenta, tender beef in paprika sauce, polenta mound, cast iron pot, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/golaz-polenta-3.png', prompt: 'Professional food photography of Slovenian goveji golaž, dark beef stew with smooth polenta, red pepper, fresh thyme, clay bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/ocvrti-sir-3.png', prompt: 'Professional food photography of deep fried cheese, golden crispy breadcrumb coating, melted cheese oozing, tartar sauce, fresh salad, dark plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/ocvrti-sir.png', prompt: 'Professional food photography of Slovenian fried cheese, thick golden battered slice with tartar sauce and lettuce, white plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/mladi-sir-2.png', prompt: 'Professional food photography of grilled young cheese with charred golden crust, roasted peppers, olive oil, dark slate plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/mladi-sir-3.png', prompt: 'Professional food photography of pan-seared fresh cheese with herbs, golden brown crust, cherry tomatoes, arugula, balsamic glaze, dark ceramic plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/zelenjavna-juha-2.png', prompt: 'Professional food photography of creamy vegetable soup, vibrant orange carrot pumpkin blend, pumpkin seeds, cream swirl, rustic bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/zelenjavna-juha-3.png', prompt: 'Professional food photography of garden vegetable soup, chunky zucchini peppers potato, fresh basil, white tureen, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/lignji-ocvrti-2.png', prompt: 'Professional food photography of crispy fried squid rings in light tempura batter, aioli, lime wedges, dark slate plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/lignji-ocvrti.png', prompt: 'Professional food photography of fried calamari, beer-battered squid rings with marinara sauce and lemon, rustic paper liner, wooden board, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/cevapcici-2.png', prompt: 'Professional food photography of Balkan cevapi grilled meat sausages with flatbread, raw onion, kajmak cream, dark wooden board, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/cevapcici-3.png', prompt: 'Professional food photography of cevapcici with chopped onion and ajvar pepper spread, somun bread, fresh parsley, dark slate plate, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/classic-burger-2.png', prompt: 'Professional food photography of classic hamburger, juicy beef patty with cheddar, lettuce tomato pickle, sesame bun, hand-cut fries, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/classic-burger-3.png', prompt: 'Professional food photography of gourmet smash burger, thick smashed patty, melted American cheese, special sauce, brioche bun, crinkle fries, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/mesana-solata-2.png', prompt: 'Professional food photography of mixed green salad, variety lettuces and radicchio, cherry tomatoes, cucumber, light vinaigrette, wooden bowl, moody dark background, studio lighting, 85mm' },
  { path: 'hrana/mesana-solata-3.png', prompt: 'Professional food photography of seasonal mixed salad, arugula, lamb lettuce, radish, edible flowers, balsamic dressing, white ceramic bowl, moody dark background, studio lighting, 85mm' },

  // === PRILOGE / VEGETARIJANSKE ===
  { path: 'priloge/ocvrte-bucke.png', prompt: 'Professional food photography of fried zucchini slices side dish, golden crispy breadcrumb coating, tartar sauce, small plate, moody dark background, studio lighting, 85mm' },
  { path: 'vegetarijanske-jedi/ocvrte-bucke.png', prompt: 'Professional food photography of Italian fried zucchini fritti, thin crispy battered zucchini chips, garlic aioli dip, dark slate plate, moody dark background, studio lighting, 85mm' },
  { path: 'priloge/pecena-zelenjava.png', prompt: 'Professional food photography of roasted mixed vegetables side dish, charred bell peppers zucchini eggplant, olive oil drizzle, moody dark background, studio lighting, 85mm' },
  { path: 'vegetarijanske-jedi/pecena-zelenjava-rukola.png', prompt: 'Professional food photography of roasted seasonal vegetables on fresh arugula bed, balsamic glaze, shaved parmesan, white plate, moody dark background, studio lighting, 85mm' },

  // === TOPLI NAPITKI ===
  { path: 'topli-napitki/icon.png', prompt: 'Professional drink photography flat lay of hot beverages, espresso cup, cappuccino, tea pot, hot chocolate, coffee beans, warm tones, moody dark background, studio lighting, 85mm' },
  { path: 'topli-napitki/kava-s-smetano.png', prompt: 'Professional drink photography of coffee with cream, espresso in white cup with whipped cream on top, saucer with sugar, moody dark background, studio lighting, 85mm' },

  // === DESTILATI ===
  { path: 'destilati/icon.png', prompt: 'Professional drink photography of premium spirits collection, aged brandy rum and grappa in elegant glasses, wooden barrel, moody dark background, studio lighting, 85mm' },
  { path: 'destilati/rum-hechicera.png', prompt: 'Professional drink photography of La Hechicera Colombian rum, amber liquid in crystal tumbler, dried orange peel, dark wooden table, moody dark background, studio lighting, 85mm' },

  // === VISKI ===
  { path: 'viski/icon.png', prompt: 'Professional drink photography of whisky tasting flight, three glasses with varying amber colors, oak barrel staves, moody dark background, studio lighting, 85mm' },
  { path: 'viski/nikka-barrel.png', prompt: 'Professional drink photography of Nikka From the Barrel Japanese whisky, amber liquid in crystal glass, bottle in background, moody dark background, studio lighting, 85mm' },

  // === BREZALKOHOLNO PIVO ===
  { path: 'brezalk-pivo/icon.png', prompt: 'Professional drink photography of alcohol-free beer selection, three bottles, frosted glasses, hop cones, moody dark background, studio lighting, 85mm' },
  { path: 'brezalk-pivo/daura.png', prompt: 'Professional drink photography of Estrella Daura alcohol-free beer, golden liquid in tall glass with white foam, green bottle, moody dark background, studio lighting, 85mm' },
  { path: 'brezalk-pivo/heineken-00.png', prompt: 'Professional drink photography of Heineken 0.0 alcohol-free beer, clear golden beer in branded glass, green bottle, moody dark background, studio lighting, 85mm' },

  // === SOKOVI ===
  { path: 'sokovi/icon.png', prompt: 'Professional drink photography of fresh juice selection, orange apple and berry juices in glass bottles, fruit, moody dark background, studio lighting, 85mm' },
  { path: 'sokovi/jabolcni-sok.png', prompt: 'Professional drink photography of fresh apple juice, golden clear liquid in tall glass, apple slices, cinnamon stick, moody dark background, studio lighting, 85mm' },

  // === ROSE VINO ===
  { path: 'rose-vino/icon.png', prompt: 'Professional drink photography of rose wine selection, multiple pink wines in glasses with bottle, floral arrangement, moody dark background, studio lighting, 85mm' },
  { path: 'rose-vino/rose-verstovsek.png', prompt: 'Professional drink photography of Verstovsek Slovenian rose wine, pale pink wine in crystal glass, bottle, rose petals, moody dark background, studio lighting, 85mm' },

  // === GRENCICE ===
  { path: 'grencice/icon.png', prompt: 'Professional drink photography of bitter liqueurs selection, Aperol Campari Jagermeister bottles, tasting glasses, moody dark background, studio lighting, 85mm' },
  { path: 'grencice/aperol.png', prompt: 'Professional drink photography of Aperol aperitif, bright orange liqueur in glass with ice, Aperol bottle, orange slice, moody dark background, studio lighting, 85mm' },
  { path: 'grencice/campari.png', prompt: 'Professional drink photography of Campari bitter, deep red liqueur in rocks glass with ice, Campari bottle, orange peel, moody dark background, studio lighting, 85mm' },

  // === PIVO ===
  { path: 'pivo/icon.png', prompt: 'Professional drink photography of craft beer selection, various bottles and glasses, hop cones, moody dark background, studio lighting, 85mm' },
  { path: 'pivo/reset-froggy.png', prompt: 'Professional drink photography of Froggy IPA craft beer, hazy golden IPA in craft glass with thick foam, green can, moody dark background, studio lighting, 85mm' },
  { path: 'pivo/reset-stout.png', prompt: 'Professional drink photography of Irish Stout craft beer, dark black stout with creamy tan head in pint glass, dark can, moody dark background, studio lighting, 85mm' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const startFrom = parseInt(process.argv.find(a => a.startsWith('--start-from'))?.split('=')[1] || '0');
  const delay = parseInt(process.argv.find(a => a.startsWith('--delay'))?.split('=')[1] || String(DEFAULT_DELAY));
  
  const items = duplicates.slice(startFrom);
  
  console.log(`\n🖼️  Generating ${items.length} unique AI images (starting from index ${startFrom})`);
  console.log(`⏱️  Delay between calls: ${delay/1000}s\n`);
  
  const zai = await ZAI.create();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fullPath = path.join(MENU_DIR, item.path);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log(`[${startFrom + i + 1}/${duplicates.length}] ${item.path}`);
    
    try {
      const response = await zai.images.generations.create({
        prompt: item.prompt,
        size: '864x1152',
      });
      
      const base64 = response.data[0].base64;
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(fullPath, buffer);
      
      success++;
      console.log(`  ✓ Generated (${(buffer.length / 1024).toFixed(0)}KB)`);
    } catch (error) {
      failed++;
      const msg = error.message || String(error);
      if (msg.includes('429') || msg.includes('Too many')) {
        console.log(`  ⏳ Rate limited! Waiting ${delay * 2 / 1000}s...`);
        await sleep(delay * 2);
        // Retry once
        try {
          const response = await zai.images.generations.create({
            prompt: item.prompt,
            size: '864x1152',
          });
          const base64 = response.data[0].base64;
          const buffer = Buffer.from(base64, 'base64');
          fs.writeFileSync(fullPath, buffer);
          success++;
          failed--;
          console.log(`  ✓ Retry succeeded (${(buffer.length / 1024).toFixed(0)}KB)`);
        } catch (retryError) {
          console.error(`  ✗ Retry also failed: ${retryError.message?.substring(0, 80)}`);
        }
      } else {
        console.error(`  ✗ Failed: ${msg.substring(0, 100)}`);
      }
    }

    if (i < items.length - 1) {
      const progress = ((startFrom + i + 1) / duplicates.length * 100).toFixed(1);
      console.log(`  ⏳ Waiting ${delay/1000}s... (${progress}% done)\n`);
      await sleep(delay);
    }
  }

  console.log(`\n📊 Results: ${success} succeeded, ${failed} failed out of ${items.length}`);
}

main().catch(console.error);
