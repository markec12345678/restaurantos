import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const MISSING_IMAGES = [
  { name: 'Ajdova kaša', file: 'ajdova-kasa.png', desc: 'bowl of buckwheat porridge, Slovenian traditional dish' },
  { name: 'BBQ burger', file: 'bbq-burger.png', desc: 'BBQ burger with grilled patty, BBQ sauce, lettuce, tomato, cheese' },
  { name: 'Burger z jajcem in slanino', file: 'burger-z-jajcem-in-slanino.png', desc: 'burger with fried egg and bacon, gourmet presentation' },
  { name: 'Caprese solata', file: 'caprese-solata.png', desc: 'Caprese salad with fresh mozzarella, tomatoes, basil, olive oil' },
  { name: 'Cezarjeva solata s kozicami', file: 'cezarjeva-solata-s-kozicami.png', desc: 'Caesar salad with grilled shrimp, parmesan, croutons' },
  { name: 'Chili burger', file: 'chili-burger.png', desc: 'spicy chili burger with jalapeños, chili sauce, cheese' },
  { name: 'Club sendvič s piščancem', file: 'club-sendvic-s-piscancem.png', desc: 'club sandwich with chicken, bacon, lettuce, tomato, three layers' },
  { name: 'Domače pečenice s kislim zeljem', file: 'domace-pecenice-s-kislim-zeljem.png', desc: 'home-style roasted pork sausages with sauerkraut, Slovenian dish' },
  { name: 'Domino kocke', file: 'domino-kocke.png', desc: 'domino cube dessert, chocolate cube cake, elegant patisserie' },
  { name: 'File brancina', file: 'file-brancina.png', desc: 'pan-seared sea bass fillet, Mediterranean style, white plate' },
  { name: 'File lososa z žara', file: 'file-lososa-z-zara.png', desc: 'grilled salmon fillet, grill marks, lemon garnish' },
  { name: 'Francoski toast', file: 'francoski-toast.png', desc: 'French toast with berries, powdered sugar, maple syrup' },
  { name: 'Granola z jogurtom', file: 'granola-z-jogurtom.png', desc: 'granola bowl with yogurt, fresh berries, honey drizzle' },
  { name: 'Havajska pica', file: 'havajska-pica.png', desc: 'Hawaiian pizza with ham and pineapple, melted cheese' },
  { name: 'Hrenovke na žaru', file: 'hrenovke-na-zaru.png', desc: 'grilled hot dogs with mustard, traditional Slovenian style' },
  { name: 'Idrijski žlikrofi', file: 'idrijski-zlikrofi.png', desc: 'Idrijski žlikrofi, Slovenian filled dumplings, traditional dish' },
  { name: 'Jajčni benedikt', file: 'jajcni-benedikt.png', desc: 'Eggs Benedict with hollandaise sauce, ham, English muffin' },
  { name: 'Kava in krof', file: 'kava-in-krof.png', desc: 'coffee and donut, espresso with glazed doughnut, breakfast' },
  { name: 'Klobase na žaru', file: 'klobase-na-zaru.png', desc: 'grilled sausages with mustard and horseradish, BBQ style' },
  { name: 'Kmečka pica', file: 'kmecka-pica.png', desc: 'rustic farmhouse pizza with various toppings, traditional style' },
  { name: 'Kmečki krožnik', file: 'kmecki-kroznik.png', desc: 'farmhouse platter with meats, cheese, pickles, bread, Slovenian' },
  { name: 'Krofi s pomarančno marmelado', file: 'krofi-s-pomarancno-marmelado.png', desc: 'doughnuts filled with orange marmalade, powdered sugar, Slovenian' },
  { name: 'Krompirjevi kroketi', file: 'krompirjevi-kroketi.png', desc: 'golden potato croquettes, crispy fried, side dish' },
  { name: 'Krvavica s kislim zeljem', file: 'krvavica-s-kislim-zeljem.png', desc: 'blood sausage with sauerkraut, Slovenian traditional dish' },
  { name: 'Ledeni desert', file: 'ledeni-desert.png', desc: 'frozen dessert, ice cream sundae with chocolate sauce, berries' },
  { name: 'Medaljoni iz govedine', file: 'medaljoni-iz-govedine.png', desc: 'beef medallions, tenderloin steak, gourmet restaurant presentation' },
  { name: 'Mini burger s pomfri', file: 'mini-burger-s-pomfri.png', desc: 'mini burger sliders with french fries, casual dining' },
  { name: 'Mlinci', file: 'mlinci.png', desc: 'mlinci, traditional Slovenian flatbread, torn pasta with poultry fat' },
  { name: 'Njoki', file: 'njoki.png', desc: 'potato gnocchi with sauce, Italian-Slovenian dish, white plate' },
  { name: 'Obara z ajdovo kašo', file: 'obara-z-ajdovo-kaso.png', desc: 'Slovenian stew with buckwheat porridge, hearty traditional dish' },
  { name: 'Ocvrti lignji s tartarsko omako', file: 'ocvrti-lignji-s-tartarsko-omako.png', desc: 'fried calamari with tartar sauce, lemon wedge, seafood' },
  { name: 'Ocvrtki', file: 'ocvrtki.png', desc: 'Slovenian fried dough, fritters, golden crispy, traditional' },
  { name: 'Penne s piščancem in curryjem', file: 'penne-s-piscancem-in-curryjem.png', desc: 'penne pasta with chicken and curry sauce, creamy presentation' },
  { name: 'Pikantne klobase', file: 'pikantne-klobase.png', desc: 'spicy sausages grilled with peppers, chili flakes' },
  { name: 'Piščančji file na žaru', file: 'piscancji-file-na-zaru.png', desc: 'grilled chicken breast fillet, grill marks, herbs garnish' },
  { name: 'Piščančji file v parmezani', file: 'piscancji-file-v-parmezani.png', desc: 'chicken parmesan with melted cheese, tomato sauce, pasta side' },
  { name: 'Piščančji nugeti s pomfri', file: 'piscancji-nugeti-s-pomfri.png', desc: 'chicken nuggets with french fries, dipping sauces' },
  { name: 'Potica', file: 'potica.png', desc: 'Slovenian potica, traditional walnut roll cake, sliced, festive' },
  { name: 'Prekmurska gibanica', file: 'prekmurska-gibanica.png', desc: 'Prekmurska gibanica, Slovenian layered cake with poppy seeds, cottage cheese, walnuts, apples' },
  { name: 'Rezanci z gobami', file: 'rezanci-z-gobami.png', desc: 'noodles with wild mushrooms, creamy sauce, herbs garnish' },
  { name: 'Rižota s tartufi', file: 'rizota-s-tartufi.png', desc: 'truffle risotto, black truffle shavings, creamy Italian style' },
  { name: 'Rižota s šparglji', file: 'rizota-s-sparglji.png', desc: 'asparagus risotto, green asparagus tips, parmesan, creamy' },
  { name: 'Rižota z bučkami in feto', file: 'rizota-z-buckami-in-feto.png', desc: 'zucchini and feta risotto, Mediterranean style, fresh herbs' },
  { name: 'Sladoled tri okuse', file: 'sladoled-tri-okuse.png', desc: 'three scoops of ice cream, vanilla chocolate strawberry, waffle cone' },
  { name: 'Sladoled za otroke', file: 'sladoled-za-otroke.png', desc: 'kids ice cream sundae, colorful sprinkles, fun presentation' },
  { name: 'Solata z avokadom in kozicami', file: 'solata-z-avokadom-in-kozicami.png', desc: 'avocado and shrimp salad, fresh greens, citrus dressing' },
  { name: 'Solata z grilanim sirom', file: 'solata-z-grilanim-sirom.png', desc: 'grilled cheese salad, warm halloumi on mixed greens, balsamic' },
  { name: 'Svinjska rebra z žara', file: 'svinjska-rebra-z-zara.png', desc: 'grilled pork ribs, BBQ glaze, smoky grill marks' },
  { name: 'Tagliatelle s tartufi', file: 'tagliatelle-s-tartufi.png', desc: 'tagliatelle pasta with truffles, black truffle shavings, creamy' },
  { name: 'Tunina pica', file: 'tunina-pica.png', desc: 'tuna pizza with onions, capers, olive oil, Mediterranean style' },
  { name: 'Šopska solata', file: 'sopska-solata.png', desc: 'Shopska salad with tomatoes, cucumbers, peppers, feta cheese' },
  { name: 'Štirje siri', file: 'stirje-siri.png', desc: 'four cheese pizza, melted mozzarella, gorgonzola, parmesan, ricotta' },
  { name: 'Žar deska za dve', file: 'zar-deska-za-dve.png', desc: 'grilled meat platter for two, various grilled meats, vegetables' },
  { name: 'Žar zelenjava', file: 'zar-zelenjava.png', desc: 'grilled vegetables, zucchini, peppers, eggplant, asparagus' },
];

const OUTPUT_DIR = '/home/z/my-project/public/menu-images';
const MAX_RETRIES = 5;
const BASE_DELAY = 30000; // 30 seconds base delay for 429 errors

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithRetry(zai, item, retryCount = 0) {
  try {
    const prompt = `Professional food photography of ${item.desc}, restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k`;
    const outputPath = path.join(OUTPUT_DIR, item.file);
    
    console.log(`[${new Date().toISOString()}] Generating (${MISSING_IMAGES.indexOf(item) + 1}/${MISSING_IMAGES.length}): ${item.name}`);
    
    const response = await zai.images.generations.create({
      prompt,
      size: '864x1152'
    });
    
    const base64Data = response.data[0].base64;
    fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
    console.log(`  ✓ Saved: ${outputPath}`);
    return true;
  } catch (error) {
    if (error.message && error.message.includes('429')) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`  ⚠ Rate limited (429). Retry ${retryCount + 1}/${MAX_RETRIES}. Waiting ${delay/1000}s...`);
      if (retryCount < MAX_RETRIES) {
        await sleep(delay);
        return generateWithRetry(zai, item, retryCount + 1);
      } else {
        console.log(`  ✗ FAILED after ${MAX_RETRIES} retries: ${item.name}`);
        return false;
      }
    } else {
      console.log(`  ✗ Error: ${error.message}`);
      return false;
    }
  }
}

async function main() {
  // Check which images already exist
  const toGenerate = MISSING_IMAGES.filter(item => {
    const fullPath = path.join(OUTPUT_DIR, item.file);
    return !fs.existsSync(fullPath);
  });
  
  console.log(`Total missing: ${toGenerate.length} / ${MISSING_IMAGES.length}`);
  
  if (toGenerate.length === 0) {
    console.log('All images already exist!');
    return;
  }
  
  const zai = await ZAI.create();
  let success = 0;
  let failed = 0;
  
  for (const item of toGenerate) {
    const result = await generateWithRetry(zai, item);
    if (result) {
      success++;
    } else {
      failed++;
    }
    // Small delay between successful generations to avoid rate limiting
    if (success % 3 === 0 && success > 0) {
      console.log(`  ... pausing 10s to avoid rate limit ...`);
      await sleep(10000);
    }
  }
  
  console.log(`\n=== DONE ===`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${toGenerate.length}`);
}

main().catch(console.error);
