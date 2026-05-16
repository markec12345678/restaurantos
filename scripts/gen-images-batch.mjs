import { PrismaClient } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function slugify(str) {
  return str.toLowerCase()
    .replace(/[čć]/g, 'c').replace(/[š]/g, 's').replace(/[ž]/g, 'z')
    .replace(/[đ]/g, 'dj').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Precise prompt mapping - each item gets a unique visual prompt
const ITEM_PROMPTS = {
  // === TOČENO PIVO - CRITICAL: 0.3L vs 0.5L must look different ===
  'Haler Lager Nefiltriran (0.30L)': 'Professional product photo of a small 0.3L glass of unfiltered hazy lager beer with white foam, small glass size clearly visible, wooden pub table, commercial beer photography',
  'Haler Lager Nefiltriran (0.50L)': 'Professional product photo of a large 0.5L mug of unfiltered hazy lager beer with thick white foam, large glass size clearly visible, wooden pub table, commercial beer photography',
  'Laško Lager (0.30L)': 'Professional product photo of a small 0.3L glass of Laško lager golden beer with white foam head, small glass, Slovenian beer, commercial beer photography',
  'Laško Lager (0.50L)': 'Professional product photo of a large 0.5L mug of Laško lager golden beer with thick foam, large beer mug, Slovenian beer, commercial beer photography',
  'Union Lager (0.30L)': 'Professional product photo of a small 0.3L glass of Union lager beer, golden color with white foam, small glass size, Slovenian beer, commercial beer photography',
  'Union Lager (0.50L)': 'Professional product photo of a large 0.5L mug of Union lager beer, golden with thick foam head, large beer mug, Slovenian beer, commercial beer photography',
  'Pelicon 3rd Pill IPA (0.30L)': 'Professional product photo of a small 0.3L glass of craft IPA beer with amber color and hoppy foam, small glass, commercial beer photography',
  'Pelicon 3rd Pill IPA (0.50L)': 'Professional product photo of a large 0.5L mug of craft IPA beer with amber color and thick foam, large glass, commercial beer photography',
  'Radler Grenivka (0.30L)': 'Professional product photo of a small 0.3L glass of grapefruit radler beer, light yellow with pink tint, small glass, commercial beer photography',
  'Radler Grenivka (0.50L)': 'Professional product photo of a large 0.5L glass of grapefruit radler beer, light yellow with pink tint, large glass, commercial beer photography',
  
  // === VODE - 3 sizes must look different ===
  'Mineralna Voda (0.25L)': 'Professional product photo of a small 0.25L mineral water glass bottle with bubbles, small size clearly visible, commercial beverage photography',
  'Mineralna Voda (0.50L)': 'Professional product photo of a medium 0.5L mineral water glass bottle with bubbles, medium size, commercial beverage photography',
  'Mineralna Voda (1.00L)': 'Professional product photo of a large 1.0L mineral water glass bottle with bubbles, large size clearly visible, commercial beverage photography',
  'Naravna Voda (0.25L)': 'Professional product photo of a small 0.25L natural still water glass bottle, small size, commercial beverage photography',
  'Naravna Voda (0.50L)': 'Professional product photo of a medium 0.5L natural still water glass bottle, medium size, commercial beverage photography',
  'Naravna Voda (1.00L)': 'Professional product photo of a large 1.0L natural still water glass bottle, large size clearly visible, commercial beverage photography',
  
  // === TOPLI NAPITKI - must match description ===
  'Espresso': 'Professional product photo of a small espresso coffee cup with thick dark crema on top, white ceramic cup and saucer, Italian coffee, commercial coffee photography',
  'Dvojni espresso': 'Professional product photo of a double espresso in slightly larger cup with dark crema, white ceramic cup, commercial coffee photography',
  'Cappuccino': 'Professional product photo of a cappuccino with perfect milk foam art heart, wide ceramic cup, commercial coffee photography',
  'Bela kava': 'Professional product photo of a latte with steamed milk in tall glass, layered milk and coffee, commercial coffee photography',
  'Macchiato': 'Professional product photo of a macchiato espresso with dash of milk foam, small cup, commercial coffee photography',
  'Kava z mlekom': 'Professional product photo of a coffee with milk in white mug, commercial coffee photography',
  'Turška kava': 'Professional product photo of Turkish coffee in traditional copper cezve pot and small cup, commercial coffee photography',
  'Ledena kava': 'Professional product photo of iced coffee in tall glass with ice cubes and cream, commercial coffee photography',
  'Čaj - črni': 'Professional product photo of a hot cup of black tea in ceramic teacup with steam, tea bag on side, commercial tea photography',
  'Čaj - zeleni': 'Professional product photo of a hot cup of green tea in ceramic teacup, light green color, commercial tea photography',
  'Čaj - sadni': 'Professional product photo of a hot cup of fruit tea in glass teacup, red color, commercial tea photography',
  'Čaj - kamilica': 'Professional product photo of a hot cup of chamomile tea in ceramic teacup, yellow color, commercial tea photography',
  'Topla čokolada': 'Professional product photo of hot chocolate in mug with whipped cream and cocoa dust, commercial beverage photography',
  'Kakav': 'Professional product photo of hot cocoa in mug with marshmallows, commercial beverage photography',
  'Vroči napitek z medom': 'Professional product photo of hot honey drink in glass mug with lemon and honey, commercial beverage photography',
  
  // === GAZIRANE PIJAČE - 0.33L vs 0.5L ===
  'Coca Cola (0.33L)': 'Professional product photo of a small 0.33L Coca Cola red can, small size, commercial beverage photography',
  'Coca Cola (0.50L)': 'Professional product photo of a large 0.5L Coca Cola red bottle, large size clearly visible, commercial beverage photography',
  'Fanta (0.33L)': 'Professional product photo of a small 0.33L Fanta orange can, small size, commercial beverage photography',
  'Sprite (0.33L)': 'Professional product photo of a small 0.33L Sprite green can, small size, commercial beverage photography',
  'Schweppes Tonic (0.33L)': 'Professional product photo of a small 0.33L Schweppes tonic water can, commercial beverage photography',
  'Schweppes Bitter Lemon (0.33L)': 'Professional product photo of a small 0.33L Schweppes bitter lemon can, commercial beverage photography',
  'Coca Cola Zero (0.33L)': 'Professional product photo of a small 0.33L Coca Cola Zero black can, commercial beverage photography',
  'Pipi (0.33L)': 'Professional product photo of a small 0.33L Pipi orange juice drink, Slovenian drink, commercial beverage photography',
  'Oranžade (0.33L)': 'Professional product photo of a small 0.33L orangeade bottle, commercial beverage photography',
  'Ledena embalaža': 'Professional product photo of ice bucket for drinks, commercial photography',
  
  // === LIKERSKO VINO - 0.05L vs 0.50L ===
  'Keros Belo 2020 (0.05L)': 'Professional product photo of a tiny 0.05L small tasting glass of white dessert wine Keros, small glass clearly visible, commercial wine photography',
  'Keros Belo 2020 (0.50L)': 'Professional product photo of a full 0.5L bottle of white dessert wine Keros, full bottle, commercial wine photography',
  'Keros Rdeče 2018 (0.05L)': 'Professional product photo of a tiny 0.05L small tasting glass of red dessert wine Keros, small glass clearly visible, commercial wine photography',
  'Keros Rdeče 2018 (0.50L)': 'Professional product photo of a full 0.5L bottle of red dessert wine Keros, full bottle, commercial wine photography',
  'Sladki Refošk (kozarec)': 'Professional product photo of a glass of sweet Refošk red wine, wine glass, commercial wine photography',
  'Sladki Refošk (0.50L)': 'Professional product photo of a 0.5L bottle of sweet Refošk red wine, full bottle, commercial wine photography',
  
  // === BELA VINA - kozarec vs steklenica ===
  'Bela Frankinja 2023 (kozarec)': 'Professional product photo of a wine glass of Bela Frankinja white wine, single glass pour, commercial wine photography',
  'Bela Frankinja 2023 (steklenica)': 'Professional product photo of a full bottle of Bela Frankinja 2023 white wine, green glass bottle, commercial wine photography',
  'Cuvee Emino 2022 (kozarec)': 'Professional product photo of a wine glass of Cuvee Emino white wine, single glass pour, commercial wine photography',
  'Cuvee Emino 2022 (steklenica)': 'Professional product photo of a full bottle of Cuvee Emino 2022 white wine, commercial wine photography',
  'Rumeni Muškat 2023 (kozarec)': 'Professional product photo of a wine glass of Rumeni Muškat sweet white wine, single glass, commercial wine photography',
  'Rumeni Muškat 2023 (steklenica)': 'Professional product photo of a full bottle of Rumeni Muškat 2023 white wine, commercial wine photography',
  'Rumeni Muškat Pozna Trgatev 2019 (kozarec)': 'Professional product photo of a wine glass of aged Rumeni Muškat late harvest, single glass, commercial wine photography',
  'Rumeni Muškat Pozna Trgatev 2019 (steklenica)': 'Professional product photo of a full bottle of Rumeni Muškat late harvest 2019, commercial wine photography',
  'Modra Frankinja Emino 2023 (kozarec)': 'Professional product photo of a wine glass of Modra Frankinja red wine, single glass pour, commercial wine photography',
  'Modra Frankinja Emino 2023 (steklenica)': 'Professional product photo of a full bottle of Modra Frankinja Emino 2023 red wine, commercial wine photography',
  'Rosé Verstovšek Estate 2024 (kozarec)': 'Professional product photo of a wine glass of Rosé Verstovšek, pink color, single glass, commercial wine photography',
  'Rosé Verstovšek Estate 2024 (steklenica)': 'Professional product photo of a full bottle of Rosé Verstovšek 2024, pink wine bottle, commercial wine photography',
};

// Generic prompt fallback per category
const CATEGORY_PROMPTS = {
  'Penine in Šampanjci': (n) => `Professional product photo of ${n} sparkling wine champagne bottle with golden label, elegant, commercial wine photography`,
  'Bela Vina': (n) => `Professional product photo of ${n} white wine bottle with green glass, elegant label, commercial wine photography`,
  'Rosé Vino': (n) => `Professional product photo of ${n} rosé wine bottle with pink tint, commercial wine photography`,
  'Rdeča Vina': (n) => `Professional product photo of ${n} red wine bottle dark green glass, elegant label, commercial wine photography`,
  'Tuja Vina': (n) => `Professional product photo of ${n} imported wine bottle, commercial wine photography`,
  'Pivo': (n) => `Professional product photo of ${n} beer bottle, commercial beer photography`,
  'Craft Piva': (n) => `Professional product photo of ${n} craft beer in distinctive bottle, commercial beer photography`,
  'Brezalkoholno Pivo': (n) => `Professional product photo of ${n} non-alcoholic beer bottle, commercial beverage photography`,
  'Viski': (n) => `Professional product photo of ${n} whisky bottle with amber liquid, crystal glass, commercial spirits photography`,
  'Gin': (n) => `Professional product photo of ${n} gin bottle, botanicals, crystal glass, commercial spirits photography`,
  'Likerji': (n) => `Professional product photo of ${n} liqueur bottle with colorful liquid, commercial spirits photography`,
  'Grenčice': (n) => `Professional product photo of ${n} bitter herbal liqueur bottle, commercial spirits photography`,
  'Destilati, Konjak in Rum': (n) => `Professional product photo of ${n} premium spirit bottle with glass, commercial spirits photography`,
  'Naravni Sokovi': (n) => `Professional product photo of ${n} fresh juice in glass with fruit, commercial beverage photography`,
  'Sokovi': (n) => `Professional product photo of ${n} juice in glass, commercial beverage photography`,
  'Hladne predjedi': (n) => `Professional food photography of ${n} cold appetizer on elegant plate, commercial food photography`,
  'Tople predjedi': (n) => `Professional food photography of ${n} hot appetizer, steaming, commercial food photography`,
  'Juhe': (n) => `Professional food photography of ${n} soup in bowl, steaming, commercial food photography`,
  'Testenine': (n) => `Professional food photography of ${n} pasta dish on plate, commercial food photography`,
  'Testenine, njoki': (n) => `Professional food photography of ${n} pasta dish, Italian style, commercial food photography`,
  'Rižote': (n) => `Professional food photography of ${n} risotto in shallow bowl, commercial food photography`,
  'Glavne jedi': (n) => `Professional food photography of ${n} main course on plate, commercial food photography`,
  'Jedi z žara': (n) => `Professional food photography of ${n} grilled meat with grill marks, commercial food photography`,
  'Burgerji': (n) => `Professional food photography of ${n} tall juicy burger, commercial food photography`,
  'Ribje jedi': (n) => `Professional food photography of ${n} fish dish on plate, commercial food photography`,
  'Kalamari': (n) => `Professional food photography of ${n} calamari dish, commercial food photography`,
  'Pice': (n) => `Professional food photography of ${n} pizza on wooden board, commercial food photography`,
  'Pizze': (n) => `Professional food photography of ${n} pizza with fresh toppings, commercial food photography`,
  'Solate': (n) => `Professional food photography of ${n} salad in bowl, fresh colorful, commercial food photography`,
  'Priloge': (n) => `Professional food photography of ${n} side dish on small plate, commercial food photography`,
  'Sladice': (n) => `Professional food photography of ${n} dessert on plate, sweet elegant, commercial food photography`,
  'Otroški meni': (n) => `Professional food photography of ${n} kids meal fun plate, commercial food photography`,
  'Otroške jedi': (n) => `Professional food photography of ${n} kids meal colorful, commercial food photography`,
  'Palačinke': (n) => `Professional food photography of ${n} crepe pancake with toppings, commercial food photography`,
  'Vegetarijanske jedi': (n) => `Professional food photography of ${n} vegetarian dish colorful fresh, commercial food photography`,
  'Malice': (n) => `Professional food photography of ${n} daily lunch special hearty portion, commercial food photography`,
  'Omake': (n) => `Professional food photography of ${n} sauce in small bowl, commercial food photography`,
  'Predjedi': (n) => `Professional food photography of ${n} appetizer on plate, commercial food photography`,
};

async function main() {
  const items = await prisma.menuItem.findMany({ 
    select: { id: true, name: true, image: true, category: { select: { name: true } } }, 
    orderBy: { name: 'asc' } 
  });
  
  const byImage = {};
  for (const item of items) {
    const img = item.image || '';
    if (!byImage[img]) byImage[img] = [];
    byImage[img].push(item);
  }
  
  const needNew = [];
  for (const [img, itemList] of Object.entries(byImage)) {
    if (!img || itemList.length > 1) {
      for (const item of itemList) {
        const catSlug = slugify(item.category.name);
        const itemSlug = slugify(item.name);
        const dir = img ? img.substring(0, img.lastIndexOf('/')) : '/menu-images/' + catSlug;
        const newPath = dir + '/' + itemSlug + '.png';
        needNew.push({ ...item, newPath });
      }
    }
  }
  
  console.log(`Total items needing new images: ${needNew.length}`);
  
  const zai = await ZAI.create();
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < needNew.length; i++) {
    const item = needNew[i];
    const fullPath = '/home/z/my-project/public' + item.newPath;
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(fullPath)) {
      skipped++;
      continue;
    }
    
    // Get prompt
    let prompt = ITEM_PROMPTS[item.name];
    if (!prompt) {
      const catTemplate = CATEGORY_PROMPTS[item.category.name];
      prompt = catTemplate ? catTemplate(item.name) : `Professional product photo of ${item.name}, commercial photography`;
    }
    
    try {
      const response = await zai.images.generations.create({
        prompt: prompt.substring(0, 500),
        size: '864x1152'
      });
      
      const base64 = response.data[0].base64;
      fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
      generated++;
      console.log(`[${generated + skipped + failed}/${needNew.length}] OK: ${item.name} -> ${item.newPath}`);
      
      // Update DB immediately
      await prisma.menuItem.update({ where: { id: item.id }, data: { image: item.newPath } });
      
      // Rate limit pause - 2 seconds between requests
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      failed++;
      console.log(`[${generated + skipped + failed}/${needNew.length}] FAIL: ${item.name} - ${err.message?.substring(0, 100)}`);
      
      // If rate limited, wait longer
      if (err.message?.includes('429')) {
        console.log('Rate limited, waiting 30 seconds...');
        await new Promise(r => setTimeout(r, 30000));
        // Retry once
        try {
          const response = await zai.images.generations.create({
            prompt: prompt.substring(0, 500),
            size: '864x1152'
          });
          const base64 = response.data[0].base64;
          fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
          generated++;
          failed--;
          await prisma.menuItem.update({ where: { id: item.id }, data: { image: item.newPath } });
          console.log(`  RETRY OK: ${item.name}`);
        } catch (retryErr) {
          console.log(`  RETRY FAIL: ${item.name}`);
        }
      }
    }
  }
  
  console.log(`\n=== DONE: ${generated} generated, ${skipped} skipped (existed), ${failed} failed ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
