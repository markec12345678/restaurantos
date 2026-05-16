#!/usr/bin/env node
/**
 * Script to regenerate duplicate menu images with unique AI-generated ones.
 * Adds a 15-second delay between API calls to avoid rate limiting.
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const MENU_DIR = '/home/z/my-project/public/menu-images';

// All duplicate images that need to be regenerated with unique prompts
const duplicates = [
  // HRANA duplicates
  { path: 'hrana/frito-misto.png', prompt: 'Professional food photography of crispy fried calamari rings, golden batter, served with tartar sauce and lemon wedge, dark slate plate, dark moody background, studio lighting, shallow depth of field, high-end restaurant presentation, 85mm lens' },
  { path: 'hrana/frito-misto-2.png', prompt: 'Professional food photography of Italian fritto misto, mixed fried seafood platter with crispy battered shrimp calamari and vegetables, served in paper cone with lemon, dark wooden board, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/goveja-juha-rezanci-2.png', prompt: 'Professional food photography of Slovenian beef soup with thin noodles in deep white bowl, clear golden broth, fresh parsley garnish, rustic bread on side, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/goveja-juha-rezanci-3.png', prompt: 'Professional food photography of traditional beef noodle soup, rich amber broth with shredded beef and thin egg noodles, served in ceramic tureen, herbs on top, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/gobova-juha-2.png', prompt: 'Professional food photography of creamy wild mushroom soup, smooth velvety texture, served in rustic bread bowl, fresh thyme and truffle oil drizzle, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/gobova-juha-3.png', prompt: 'Professional food photography of forest mushroom cream soup, chunky porcini and chanterelle pieces, sour cream swirl, chives garnish, dark ceramic bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/hobotnica-2.png', prompt: 'Professional food photography of grilled octopus tentacles, charred crispy edges, tender pink meat, served on wooden board with olive oil and cherry tomatoes, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/hobotnica-zar-3.png', prompt: 'Professional food photography of charcoal grilled whole baby octopus, smoky char marks, served with lemon halves and roasted potatoes, dark slate plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/hobotnica-solata-2.png', prompt: 'Professional food photography of octopus salad, tender sliced grilled octopus on bed of mixed greens, cherry tomatoes, capers, olive oil dressing, white plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/hobotnica-solata-3.png', prompt: 'Professional food photography of Mediterranean octopus salad with arugula, sliced purple olives, red onion, lemon vinaigrette, rustic ceramic bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/losos-zar-2.png', prompt: 'Professional food photography of grilled salmon fillet, crispy skin, pink juicy flesh, served with asparagus and lemon butter sauce, dark slate plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/losos-zar-3.png', prompt: 'Professional food photography of cedar plank grilled salmon, glazed with honey mustard, garnished with dill and microgreens, roasted vegetables on side, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/spageti-bolonjske-2.png', prompt: 'Professional food photography of spaghetti bolognese, rich meat ragu sauce over al dente pasta, freshly grated parmesan on top, basil leaf garnish, white ceramic bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/spageti-bolonjske-3.png', prompt: 'Professional food photography of classic Italian bolognese pasta, thick slow-cooked beef and tomato sauce coating spaghetti, parmesan shavings, rustic terracotta bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/goveja-juha-jajce-2.png', prompt: 'Professional food photography of Slovenian beef soup with soft boiled egg, clear golden broth, sliced egg halves, fresh chives, served in traditional pottery bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/goveja-juha-jajce.png', prompt: 'Professional food photography of hearty beef broth with poached egg, root vegetables, fresh parsley, rustic ceramic bowl on linen napkin, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/golaz-polenta-2.png', prompt: 'Professional food photography of Hungarian-style beef goulash with creamy polenta, tender beef chunks in paprika sauce, polenta mound on side, dark cast iron pot, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/golaz-polenta-3.png', prompt: 'Professional food photography of Slovenian goveji golaž, rich dark beef stew with smooth polenta, red pepper flakes, fresh thyme, served in rustic clay bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/ocvrti-sir-3.png', prompt: 'Professional food photography of deep fried cheese, golden crispy breadcrumb coating, melted cheese oozing, tartar sauce on side, fresh salad garnish, dark plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/ocvrti-sir.png', prompt: 'Professional food photography of Slovenian fried cheese sir ocvrti, thick golden battered cheese slice with tartar sauce and tartar, lettuce garnish, white plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/mladi-sir-2.png', prompt: 'Professional food photography of grilled young cheese, charred golden crust, served with roasted peppers and olive oil, dark slate plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/mladi-sir-3.png', prompt: 'Professional food photography of pan-seared fresh cheese with herbs, golden brown crust, cherry tomatoes and arugula, balsamic glaze drizzle, dark ceramic plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/zelenjavna-juha-2.png', prompt: 'Professional food photography of creamy vegetable soup, vibrant orange carrot and pumpkin blend, pumpkin seeds and cream swirl on top, rustic bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/zelenjavna-juha-3.png', prompt: 'Professional food photography of garden vegetable soup, chunky zucchini peppers and potato pieces, fresh basil, served in white tureen, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/lignji-ocvrti-2.png', prompt: 'Professional food photography of crispy fried squid rings, light golden tempura batter, served with aioli and lime wedges, dark slate plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/lignji-ocvrti.png', prompt: 'Professional food photography of fried calamari, crispy beer-battered squid rings with marinara sauce and lemon, rustic paper liner, dark wooden board, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/cevapcici-2.png', prompt: 'Professional food photography of Balkan cevapi grilled meat sausages, served with flatbread lepinja, raw onion, kajmak cream, dark wooden board, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/cevapcici-3.png', prompt: 'Professional food photography of cevapcici with chopped onion and ajvar pepper spread, soft somun bread, fresh parsley, dark slate plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/classic-burger-2.png', prompt: 'Professional food photography of classic hamburger, juicy beef patty with cheddar cheese, lettuce tomato pickle, sesame bun, hand-cut fries, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/classic-burger-3.png', prompt: 'Professional food photography of gourmet classic burger, thick smashed patty, melted American cheese, special sauce, brioche bun, crinkle cut fries, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/mesana-solata-2.png', prompt: 'Professional food photography of mixed green salad, variety of lettuces and radicchio, cherry tomatoes, cucumber slices, light vinaigrette, wooden bowl, dark moody background, studio lighting, 85mm lens' },
  { path: 'hrana/mesana-solata-3.png', prompt: 'Professional food photography of seasonal mixed salad with arugula, lamb lettuce, radish, edible flowers, balsamic dressing, white ceramic bowl, dark moody background, studio lighting, 85mm lens' },

  // PRILOGE/VEGETARIJANSKE duplicates
  { path: 'priloge/ocvrte-bucke.png', prompt: 'Professional food photography of fried zucchini slices, golden crispy breadcrumb coating, served as side dish on small plate, tartar sauce, dark moody background, studio lighting, 85mm lens' },
  { path: 'vegetarijanske-jedi/ocvrte-bucke.png', prompt: 'Professional food photography of Italian fried zucchini fritti, thin crispy battered zucchini chips with garlic aioli dip, dark slate plate, dark moody background, studio lighting, 85mm lens' },
  { path: 'priloge/pecena-zelenjava.png', prompt: 'Professional food photography of roasted mixed vegetables, charred bell peppers zucchini and eggplant, olive oil drizzle, as side dish, dark moody background, studio lighting, 85mm lens' },
  { path: 'vegetarijanske-jedi/pecena-zelenjava-rukola.png', prompt: 'Professional food photography of roasted seasonal vegetables on bed of fresh arugula, balsamic glaze, shaved parmesan, white plate, dark moody background, studio lighting, 85mm lens' },

  // TOPLI NAPITKI - icon is same as kava-s-smetano
  { path: 'topli-napitki/icon.png', prompt: 'Professional drink photography of hot beverages flat lay, espresso cup, cappuccino, tea pot, hot chocolate, coffee beans scattered, warm tones, dark moody background, studio lighting, 85mm lens' },
  { path: 'topli-napitki/kava-s-smetano.png', prompt: 'Professional drink photography of coffee with cream, espresso in white cup with whipped cream on top, saucer with sugar, dark moody background, studio lighting, 85mm lens' },

  // DESTILATI - icon same as rum-hechicera
  { path: 'destilati/icon.png', prompt: 'Professional drink photography of premium spirits collection, aged brandy, rum, and grappa in elegant glasses, wooden barrel background, dark moody background, studio lighting, 85mm lens' },
  { path: 'destilati/rum-hechicera.png', prompt: 'Professional drink photography of La Hechicera Colombian rum, amber liquid in crystal tumbler glass, dried orange peel, dark wooden table, dark moody background, studio lighting, 85mm lens' },

  // VISKI - icon same as nikka-barrel
  { path: 'viski/icon.png', prompt: 'Professional drink photography of whisky tasting flight, three different whisky glasses with varying amber colors, oak barrel staves, dark moody background, studio lighting, 85mm lens' },
  { path: 'viski/nikka-barrel.png', prompt: 'Professional drink photography of Nikka From the Barrel Japanese whisky, amber liquid in crystal glass, Japanese whisky bottle in background, dark moody background, studio lighting, 85mm lens' },

  // BREZALKOHOLNO PIVO - 3 identical files!
  { path: 'brezalk-pivo/icon.png', prompt: 'Professional drink photography of alcohol-free beer selection, three different bottles, frosted glasses, hop cones scattered, dark moody background, studio lighting, 85mm lens' },
  { path: 'brezalk-pivo/daura.png', prompt: 'Professional drink photography of Estrella Daura Damm alcohol-free beer, golden liquid in tall glass with white foam head, green bottle, dark moody background, studio lighting, 85mm lens' },
  { path: 'brezalk-pivo/heineken-00.png', prompt: 'Professional drink photography of Heineken 0.0 alcohol-free beer, clear golden beer in branded glass with foam, green Heineken bottle, dark moody background, studio lighting, 85mm lens' },

  // SOKOVI - icon same as jabolcni-sok
  { path: 'sokovi/icon.png', prompt: 'Professional drink photography of fresh juice selection, orange apple and berry juices in glass bottles with fruit, dark moody background, studio lighting, 85mm lens' },
  { path: 'sokovi/jabolcni-sok.png', prompt: 'Professional drink photography of fresh apple juice, golden clear liquid in tall glass with apple slices and cinnamon stick, dark moody background, studio lighting, 85mm lens' },

  // ROSE VINO - icon same as rose-verstovsek
  { path: 'rose-vino/icon.png', prompt: 'Professional drink photography of rose wine selection, multiple pink rose wines in glasses with bottle, floral arrangement, dark moody background, studio lighting, 85mm lens' },
  { path: 'rose-vino/rose-verstovsek.png', prompt: 'Professional drink photography of Verstovsek Slovenian rose wine, pale pink wine in crystal glass, bottle in background, rose petals, dark moody background, studio lighting, 85mm lens' },

  // GRENCICE - 3 identical files!
  { path: 'grencice/icon.png', prompt: 'Professional drink photography of bitter liqueurs and amaro selection, Aperol Campari Jagermeister bottles, small tasting glasses, dark moody background, studio lighting, 85mm lens' },
  { path: 'grencice/aperol.png', prompt: 'Professional drink photography of Aperol aperitif, bright orange liqueur in glass with ice, Aperol bottle, orange slice garnish, dark moody background, studio lighting, 85mm lens' },
  { path: 'grencice/campari.png', prompt: 'Professional drink photography of Campari bitter, deep red liqueur in rocks glass with ice, Campari bottle, orange peel twist, dark moody background, studio lighting, 85mm lens' },

  // PIVO - 3 identical files!
  { path: 'pivo/icon.png', prompt: 'Professional drink photography of craft beer selection, various beer bottles and glasses with different colors, hop cones, dark moody background, studio lighting, 85mm lens' },
  { path: 'pivo/reset-froggy.png', prompt: 'Professional drink photography of Reservoir Dogs Froggy IPA beer, hazy golden IPA in craft beer glass with thick foam, green can, dark moody background, studio lighting, 85mm lens' },
  { path: 'pivo/reset-stout.png', prompt: 'Professional drink photography of Reservoir Dogs Irish Stout beer, dark black stout with creamy tan head in pint glass, dark can, dark moody background, studio lighting, 85mm lens' },
];

const DELAY_MS = 20000; // 20 seconds between calls to avoid rate limiting
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateImage(item, retryCount = 0) {
  const fullPath = join(MENU_DIR, item.path);
  const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
  
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const cmd = `z-ai-generate -p "${item.prompt.replace(/"/g, '\\"')}" -o "${fullPath}" -s 864x1152`;
  
  try {
    console.log(`Generating: ${item.path}`);
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });
    console.log(`✓ Generated: ${item.path}`);
    return true;
  } catch (error) {
    const stderr = error.stderr?.toString() || '';
    if (stderr.includes('429') || stderr.includes('Too many requests')) {
      if (retryCount < MAX_RETRIES) {
        const waitTime = DELAY_MS * (retryCount + 2);
        console.log(`⏳ Rate limited, waiting ${waitTime/1000}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await sleep(waitTime);
        return generateImage(item, retryCount + 1);
      }
    }
    console.error(`✗ Failed: ${item.path} - ${stderr.substring(0, 100)}`);
    return false;
  }
}

async function main() {
  const startFrom = parseInt(process.argv[2] || '0');
  const items = duplicates.slice(startFrom);
  
  console.log(`\n🖼️  Generating ${items.length} unique images (starting from index ${startFrom})\n`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`[${startFrom + i + 1}/${duplicates.length}] Processing: ${item.path}`);
    
    const result = await generateImage(item);
    if (result) {
      success++;
    } else {
      failed++;
    }
    
    // Wait between calls to avoid rate limiting
    if (i < items.length - 1) {
      const progress = ((startFrom + i + 1) / duplicates.length * 100).toFixed(1);
      console.log(`⏳ Waiting ${DELAY_MS/1000}s... (Progress: ${progress}%)`);
      await sleep(DELAY_MS);
    }
  }
  
  console.log(`\n📊 Results: ${success} succeeded, ${failed} failed out of ${items.length} images`);
}

main().catch(console.error);
