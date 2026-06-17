/**
 * AI Image Replacement Script for RestaurantOS
 * Replaces 54 placeholder images with real AI-generated food photography.
 * 
 * Usage:
 *   node replace-with-ai.mjs                # Generate all 54
 *   node replace-with-ai.mjs --batch 5      # Only 5 images
 *   node replace-with-ai.mjs --delay 10000  # 10s between requests
 *   node replace-with-ai.mjs --test         # Test API only
 */

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/home/z/my-project/public/menu-images';
const args = process.argv.slice(2);
const batchArg = args.indexOf('--batch');
const batchSize = batchArg !== -1 ? parseInt(args[batchArg + 1]) : 999;
const delayArg = args.indexOf('--delay');
const delayMs = delayArg !== -1 ? parseInt(args[delayArg + 1]) : 5000;
const isTest = args.includes('--test');

const ITEMS = [
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
  { name: 'Idrijski žlikrofi', file: 'idrijski-zlikrofi.png', prompt: 'Idrijski zlikrofi, Slovenian filled dumplings, traditional dish' },
  { name: 'Jajčni benedikt', file: 'jajcni-benedikt.png', prompt: 'Eggs Benedict with hollandaise sauce, ham, English muffin' },
  { name: 'Kava in krof', file: 'kava-in-krof.png', prompt: 'coffee and donut, espresso with glazed doughnut, breakfast' },
  { name: 'Klobase na žaru', file: 'klobase-na-zaru.png', prompt: 'grilled sausages with mustard and horseradish, BBQ style' },
  { name: 'Kmečka pica', file: 'kmecka-pica.png', prompt: 'rustic farmhouse pizza with various toppings, traditional style' },
  { name: 'Kmečki krožnik', file: 'kmecki-kroznik.png', prompt: 'farmhouse platter with meats, cheese, pickles, bread, Slovenian' },
  { name: 'Krofi s pomarančno marmelado', file: 'krofi-s-pomarancno-marmelado.png', prompt: 'doughnuts filled with orange marmalade, powdered sugar' },
  { name: 'Krompirjevi kroketi', file: 'krompirjevi-kroketi.png', prompt: 'golden potato croquettes, crispy fried, side dish' },
  { name: 'Krvavica s kislim zeljem', file: 'krvavica-s-kislim-zeljem.png', prompt: 'blood sausage with sauerkraut, Slovenian traditional dish' },
  { name: 'Ledeni desert', file: 'ledeni-desert.png', prompt: 'frozen dessert, ice cream sundae with chocolate sauce, berries' },
  { name: 'Medaljoni iz govedine', file: 'medaljoni-iz-govedine.png', prompt: 'beef medallions, tenderloin steak, gourmet restaurant presentation' },
  { name: 'Mini burger s pomfri', file: 'mini-burger-s-pomfri.png', prompt: 'mini burger sliders with french fries, casual dining' },
  { name: 'Mlinci', file: 'mlinci.png', prompt: 'mlinci, traditional Slovenian flatbread torn pasta' },
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isPlaceholder(filePath) {
  try { return fs.statSync(filePath).size < 50000; }
  catch { return true; }
}

async function generateWithRetry(zai, item, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await zai.images.generations.create({
        prompt: `Professional food photography of ${item.prompt}, restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k`,
        size: '864x1152'
      });
      const outputPath = path.join(OUTPUT_DIR, item.file);
      fs.writeFileSync(outputPath, Buffer.from(response.data[0].base64, 'base64'));
      return { success: true };
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('429')) {
        const backoffMs = Math.min(30000 * Math.pow(2, attempt), 600000);
        console.log(`    Rate limited. Waiting ${backoffMs/1000}s (attempt ${attempt+1}/${maxRetries})...`);
        await sleep(backoffMs);
        continue;
      }
      return { success: false, error: msg };
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}

async function main() {
  if (isTest) {
    console.log('Testing API...');
    try {
      const zai = await ZAI.create();
      const r = await zai.images.generations.create({
        prompt: 'a red apple on white background, food photography',
        size: '864x1152'
      });
      const p = path.join(OUTPUT_DIR, '_test.png');
      fs.writeFileSync(p, Buffer.from(r.data[0].base64, 'base64'));
      const sz = fs.statSync(p).size;
      fs.unlinkSync(p);
      console.log(`✅ API WORKS! Test image: ${(sz/1024).toFixed(0)}KB`);
    } catch (e) {
      console.log(`❌ API error: ${e.message?.substring(0, 100)}`);
    }
    return;
  }

  const needsReplacement = ITEMS.filter(item => isPlaceholder(path.join(OUTPUT_DIR, item.file)));
  const toProcess = needsReplacement.slice(0, batchSize);
  console.log(`Placeholders remaining: ${needsReplacement.length}/${ITEMS.length}`);
  console.log(`Processing: ${toProcess.length} images\n`);

  if (toProcess.length === 0) {
    console.log('🎉 All images are AI-generated!');
    return;
  }

  const zai = await ZAI.create();
  let success = 0, failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    console.log(`[${i+1}/${toProcess.length}] ${item.name}`);
    const result = await generateWithRetry(zai, item);
    if (result.success) {
      const sz = fs.statSync(path.join(OUTPUT_DIR, item.file)).size;
      console.log(`  ✅ ${item.file} (${(sz/1024).toFixed(0)}KB)`);
      success++;
    } else {
      console.log(`  ❌ ${item.name}: ${result.error?.substring(0, 60)}`);
      failed++;
    }
    if (i < toProcess.length - 1) await sleep(delayMs);
  }

  console.log(`\n✅ ${success} | ❌ ${failed} | Remaining: ${needsReplacement.length - success - failed}`);
}

main().catch(console.error);
