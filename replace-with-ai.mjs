/**
 * AI Image Replacement Script for RestaurantOS
 * 
 * Replaces 54 placeholder images with real AI-generated food photography.
 * Features:
 *   - Exponential backoff on 429 (rate limit) errors
 *   - Progress tracking with resume capability
 *   - Skips already-replaced images (non-placeholder detection)
 *   - Batch processing with configurable delays
 * 
 * Usage:
 *   node replace-with-ai.mjs                    # Generate all 54
 *   node replace-with-ai.mjs --batch 5          # Generate only 5 images
 *   node replace-with-ai.mjs --delay 10000      # 10s between requests
 *   node replace-with-ai.mjs --test             # Test API connection only
 */

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/home/z/my-project/public/menu-images';
const PROGRESS_FILE = '/home/z/my-project/ai-image-progress.json';

// Parse CLI args
const args = process.argv.slice(2);
const batchArg = args.indexOf('--batch');
const batchSize = batchArg !== -1 ? parseInt(args[batchArg + 1]) : 999;
const delayArg = args.indexOf('--delay');
const delayMs = delayArg !== -1 ? parseInt(args[delayArg + 1]) : 5000;
const isTest = args.includes('--test');

const MISSING_ITEMS = [
  { name: 'Ajdova kaša', file: 'ajdova-kasa.png', prompt: 'bowl of buckwheat porridge, Slovenian traditional dish' },
  { name: 'BBQ burger', file: 'bbq-burger.png', prompt: 'BBQ burger with grilled patty, BBQ sauce, lettuce, tomato, cheese' },
  { name: 'Burger z jajcem in slanino', file: 'burger-z-jajcem-in-slanino.png', prompt: 'burger with fried egg and bacon, gourmet presentation' },
  { name: 'Caprese solata', file: 'caprese-solata.png', prompt: 'Caprese salad with fresh mozzarella, tomatoes, basil, olive oil' },
  { name: 'Cezarjeva solata s kozicami', file: 'cezarjeva-solata-s-kozicami.png', prompt: 'Caesar salad with grilled shrimp, parmesan, croutons' },
  { name: 'Chili burger', file: 'chili-burger.png', prompt: 'spicy chili burger with jalapenos, chili sauce, cheese' },
  { name: 'Club sendvič s piščancem', file: 'club-sendvic-s-piscancem.png', prompt: 'club sandwich with chicken, bacon, lettuce, tomato, three layers' },
  { name: 'Domače pečenice s kislim zeljem', file: 'domace-pecenice-s-kislim-zeljem.png', prompt: 'home-style roasted pork sausages with sauerkraut, Slovenian dish' },
  { name: 'Domino kocke', file: 'domino-kocke.png', prompt: 'domino cube chocolate dessert, elegant patisserie' },
  { name: 'File brancina', file: 'file-brancina.png', prompt: 'pan-seared sea bass fillet, Mediterranean style, white plate' },
  { name: 'File lososa z žara', file: 'file-lososa-z-zara.png', prompt: 'grilled salmon fillet, grill marks, lemon garnish' },
  { name: 'Francoski toast', file: 'francoski-toast.png', prompt: 'French toast with berries, powdered sugar, maple syrup' },
  { name: 'Granola z jogurtom', file: 'granola-z-jogurtom.png', prompt: 'granola bowl with yogurt, fresh berries, honey drizzle' },
  { name: 'Havajska pica', file: 'havajska-pica.png', prompt: 'Hawaiian pizza with ham and pineapple, melted cheese' },
  { name: 'Hrenovke na žaru', file: 'hrenovke-na-zaru.png', prompt: 'grilled hot dogs with mustard, traditional Slovenian style' },
  { name: 'Idrijski žlikrofi', file: 'idrijski-zlikrofi.png', prompt: 'Idrijski žlikrofi, Slovenian filled dumplings, traditional dish' },
  { name: 'Jajčni benedikt', file: 'jajcni-benedikt.png', prompt: 'Eggs Benedict with hollandaise sauce, ham, English muffin' },
  { name: 'Kava in krof', file: 'kava-in-krof.png', prompt: 'coffee and donut, espresso with glazed doughnut, breakfast' },
  { name: 'Klobase na žaru', file: 'klobase-na-zaru.png', prompt: 'grilled sausages with mustard and horseradish, BBQ style' },
  { name: 'Kmečka pica', file: 'kmecka-pica.png', prompt: 'rustic farmhouse pizza with various toppings, traditional style' },
  { name: 'Kmečki krožnik', file: 'kmecki-kroznik.png', prompt: 'farmhouse platter with meats, cheese, pickles, bread, Slovenian' },
  { name: 'Krofi s pomarančno marmelado', file: 'krofi-s-pomarancno-marmelado.png', prompt: 'doughnuts filled with orange marmalade, powdered sugar, Slovenian' },
  { name: 'Krompirjevi kroketi', file: 'krompirjevi-kroketi.png', prompt: 'golden potato croquettes, crispy fried, side dish' },
  { name: 'Krvavica s kislim zeljem', file: 'krvavica-s-kislim-zeljem.png', prompt: 'blood sausage with sauerkraut, Slovenian traditional dish' },
  { name: 'Ledeni desert', file: 'ledeni-desert.png', prompt: 'frozen dessert, ice cream sundae with chocolate sauce, berries' },
  { name: 'Medaljoni iz govedine', file: 'medaljoni-iz-govedine.png', prompt: 'beef medallions, tenderloin steak, gourmet restaurant presentation' },
  { name: 'Mini burger s pomfri', file: 'mini-burger-s-pomfri.png', prompt: 'mini burger sliders with french fries, casual dining' },
  { name: 'Mlinci', file: 'mlinci.png', prompt: 'mlinci, traditional Slovenian flatbread torn pasta with poultry fat' },
  { name: 'Njoki', file: 'njoki.png', prompt: 'potato gnocchi with sauce, Italian-Slovenian dish, white plate' },
  { name: 'Obara z ajdovo kašo', file: 'obara-z-ajdovo-kaso.png', prompt: 'Slovenian stew with buckwheat porridge, hearty traditional dish' },
  { name: 'Ocvrti lignji s tartarsko omako', file: 'ocvrti-lignji-s-tartarsko-omako.png', prompt: 'fried calamari with tartar sauce, lemon wedge, seafood' },
  { name: 'Ocvrtki', file: 'ocvrtki.png', prompt: 'Slovenian fried dough fritters, golden crispy, traditional' },
  { name: 'Penne s piščancem in curryjem', file: 'penne-s-piscancem-in-curryjem.png', prompt: 'penne pasta with chicken and curry sauce, creamy presentation' },
  { name: 'Pikantne klobase', file: 'pikantne-klobase.png', prompt: 'spicy sausages grilled with peppers, chili flakes' },
  { name: 'Piščančji file na žaru', file: 'piscancji-file-na-zaru.png', prompt: 'grilled chicken breast fillet, grill marks, herbs garnish' },
  { name: 'Piščančji file v parmezani', file: 'piscancji-file-v-parmezani.png', prompt: 'chicken parmesan with melted cheese, tomato sauce, pasta side' },
  { name: 'Piščančji nugeti s pomfri', file: 'piscancji-nugeti-s-pomfri.png', prompt: 'chicken nuggets with french fries, dipping sauces' },
  { name: 'Potica', file: 'potica.png', prompt: 'Slovenian potica, traditional walnut roll cake, sliced, festive' },
  { name: 'Prekmurska gibanica', file: 'prekmurska-gibanica.png', prompt: 'Prekmurska gibanica, Slovenian layered cake with poppy seeds, cottage cheese, walnuts, apples' },
  { name: 'Rezanci z gobami', file: 'rezanci-z-gobami.png', prompt: 'noodles with wild mushrooms, creamy sauce, herbs garnish' },
  { name: 'Rižota s tartufi', file: 'rizota-s-tartufi.png', prompt: 'truffle risotto, black truffle shavings, creamy Italian style' },
  { name: 'Rižota s šparglji', file: 'rizota-s-sparglji.png', prompt: 'asparagus risotto, green asparagus tips, parmesan, creamy' },
  { name: 'Rižota z bučkami in feto', file: 'rizota-z-buckami-in-feto.png', prompt: 'zucchini and feta risotto, Mediterranean style, fresh herbs' },
  { name: 'Sladoled tri okuse', file: 'sladoled-tri-okuse.png', prompt: 'three scoops of ice cream, vanilla chocolate strawberry, waffle cone' },
  { name: 'Sladoled za otroke', file: 'sladoled-za-otroke.png', prompt: 'kids ice cream sundae, colorful sprinkles, fun presentation' },
  { name: 'Solata z avokadom in kozicami', file: 'solata-z-avokadom-in-kozicami.png', prompt: 'avocado and shrimp salad, fresh greens, citrus dressing' },
  { name: 'Solata z grilanim sirom', file: 'solata-z-grilanim-sirom.png', prompt: 'grilled cheese salad, warm halloumi on mixed greens, balsamic' },
  { name: 'Svinjska rebra z žara', file: 'svinjska-rebra-z-zara.png', prompt: 'grilled pork ribs, BBQ glaze, smoky grill marks' },
  { name: 'Tagliatelle s tartufi', file: 'tagliatelle-s-tartufi.png', prompt: 'tagliatelle pasta with truffles, black truffle shavings, creamy' },
  { name: 'Tunina pica', file: 'tunina-pica.png', prompt: 'tuna pizza with onions, capers, olive oil, Mediterranean style' },
  { name: 'Šopska solata', file: 'sopska-solata.png', prompt: 'Shopska salad with tomatoes, cucumbers, peppers, feta cheese' },
  { name: 'Štirje siri', file: 'stirje-siri.png', prompt: 'four cheese pizza, melted mozzarella, gorgonzola, parmesan, ricotta' },
  { name: 'Žar deska za dve', file: 'zar-deska-za-dve.png', prompt: 'grilled meat platter for two, various grilled meats, vegetables' },
  { name: 'Žar zelenjava', file: 'zar-zelenjava.png', prompt: 'grilled vegetables, zucchini, peppers, eggplant, asparagus' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPlaceholder(filePath) {
  // Placeholder images created by generate-placeholders.mjs are typically ~5-15KB
  // Real AI-generated images are typically 200KB-2MB
  try {
    const stats = fs.statSync(filePath);
    return stats.size < 50000; // <50KB = likely placeholder
  } catch {
    return true; // File doesn't exist
  }
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completed: [], failed: [], lastRun: null };
}

function saveProgress(progress) {
  progress.lastRun = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function generateWithRetry(zai, item, maxRetries = 5) {
  const outputPath = path.join(OUTPUT_DIR, item.file);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `Professional food photography of ${item.prompt}, restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k`;
      
      const response = await zai.images.generations.create({
        prompt,
        size: '864x1152'
      });
      
      const base64Data = response.data[0].base64;
      fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
      return { success: true };
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('429')) {
        const backoffMs = Math.min(30000 * Math.pow(2, attempt), 600000); // Max 10min
        console.log(`    ⏳ Rate limited. Waiting ${backoffMs/1000}s (attempt ${attempt+1}/${maxRetries})...`);
        await sleep(backoffMs);
        continue;
      } else if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        console.log(`    ⚠ Server error. Retrying in 10s...`);
        await sleep(10000);
        continue;
      } else {
        return { success: false, error: msg };
      }
    }
  }
  return { success: false, error: 'Max retries exceeded (429)' };
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  RestaurantOS AI Image Replacement');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total items: ${MISSING_ITEMS.length}`);
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Delay: ${delayMs/1000}s between requests`);
  console.log(`  Test mode: ${isTest}`);
  console.log('');
  
  // Test mode - just check API
  if (isTest) {
    console.log('Testing API connection...');
    try {
      const zai = await ZAI.create();
      const response = await zai.images.generations.create({
        prompt: 'a simple red apple on white background, food photography',
        size: '864x1152'
      });
      const testPath = path.join(OUTPUT_DIR, '_test_api.png');
      fs.writeFileSync(testPath, Buffer.from(response.data[0].base64, 'base64'));
      const size = fs.statSync(testPath).size;
      fs.unlinkSync(testPath);
      console.log(`✅ API is working! Test image: ${(size/1024).toFixed(0)}KB`);
    } catch (error) {
      console.log(`❌ API error: ${error.message}`);
      process.exit(1);
    }
    return;
  }
  
  // Filter items that need replacement
  const needsReplacement = MISSING_ITEMS.filter(item => {
    const fullPath = path.join(OUTPUT_DIR, item.file);
    return isPlaceholder(fullPath);
  });
  
  console.log(`  Need replacement (placeholder): ${needsReplacement.length}`);
  console.log(`  Already AI-generated: ${MISSING_ITEMS.length - needsReplacement.length}`);
  console.log('');
  
  if (needsReplacement.length === 0) {
    console.log('🎉 All images are already AI-generated!');
    return;
  }
  
  // Apply batch limit
  const toProcess = needsReplacement.slice(0, batchSize);
  console.log(`  Processing: ${toProcess.length} images`);
  console.log('');
  
  const progress = loadProgress();
  const zai = await ZAI.create();
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const idx = i + 1;
    const fullPath = path.join(OUTPUT_DIR, item.file);
    
    // Double-check it's still a placeholder
    if (!isPlaceholder(fullPath)) {
      console.log(`  [${idx}/${toProcess.length}] SKIP (already AI): ${item.name}`);
      skipped++;
      continue;
    }
    
    console.log(`  [${idx}/${toProcess.length}] Generating: ${item.name}`);
    
    const result = await generateWithRetry(zai, item);
    
    if (result.success) {
      const newSize = fs.statSync(fullPath).size;
      console.log(`    ✅ Saved: ${item.file} (${(newSize/1024).toFixed(0)}KB)`);
      success++;
      progress.completed.push({ name: item.name, file: item.file, timestamp: new Date().toISOString() });
    } else {
      console.log(`    ❌ Failed: ${item.name} - ${result.error}`);
      failed++;
      progress.failed.push({ name: item.name, file: item.file, error: result.error, timestamp: new Date().toISOString() });
    }
    
    saveProgress(progress);
    
    // Delay between requests
    if (i < toProcess.length - 1) {
      await sleep(delayMs);
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Results');
  console.log('═══════════════════════════════════════════════');
  console.log(`  ✅ Success: ${success}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  📊 Total processed: ${success + failed + skipped}`);
  console.log(`  📁 Remaining placeholders: ${needsReplacement.length - success - failed - skipped}`);
  
  if (failed > 0) {
    console.log('');
    console.log('  ⚠️  Some images failed. Possible reasons:');
    console.log('     - API rate limit (429) - run again later');
    console.log('     - Server error (5xx) - temporary issue');
    console.log('     - Run "node replace-with-ai.mjs" again to retry failed ones');
  }
}

main().catch(console.error);
