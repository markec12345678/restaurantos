import ZAI from 'z-ai-web-dev-sdk';
import { writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const DELAY_MS = 5000; // 5 seconds between requests
const MAX_RETRIES = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateImage(zai, prompt, outputPath, size = '1152x864') {
  // Skip if already professional quality
  if (existsSync(outputPath)) {
    const size = statSync(outputPath).size;
    if (size > 20000) {
      console.log(`SKIP (already professional): ${outputPath}`);
      return true;
    }
  }
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await zai.images.generations.create({
        prompt,
        size
      });
      
      const imageBase64 = response.data[0].base64;
      const buffer = Buffer.from(imageBase64, 'base64');
      writeFileSync(outputPath, buffer);
      console.log(`OK: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`);
      return true;
    } catch (error) {
      if (error.message?.includes('429')) {
        const waitTime = attempt * 30000; // 30s, 60s, 90s
        console.log(`RATE LIMITED (attempt ${attempt}/${MAX_RETRIES}): waiting ${waitTime/1000}s...`);
        await sleep(waitTime);
      } else {
        console.error(`ERROR (attempt ${attempt}): ${error.message}`);
        if (attempt < MAX_RETRIES) await sleep(5000);
      }
    }
  }
  console.error(`FAILED after ${MAX_RETRIES} retries: ${outputPath}`);
  return false;
}

const items = [
  // GLAVNE JEDI
  { path: 'public/menu-images/glavne-jedi/bbq-rebrca.png', prompt: 'Professional food photography of BBQ baby back ribs with parmesan and roasted potatoes BBQ sauce on dark slate plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/beefsteak-poprova.png', prompt: 'Professional food photography of beefsteak in green peppercorn sauce with roasted vegetables and baked potato on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/beefsteak-zar-rukoli.png', prompt: 'Professional food photography of grilled beefsteak on fresh arugula bed with roasted vegetables baked potato on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/bograc.png', prompt: 'Professional food photography of bograc Hungarian-style stew in cast iron kettle with paprika and meat restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/dunajski-zrezek.png', prompt: 'Professional food photography of Wiener schnitzel golden breaded veal cutlet with lemon wedge and potato salad on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/hawaii-zrezek.png', prompt: 'Professional food photography of Hawaiian steak with pineapple and melted cheese creamy sauce vegetable side on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/hisna-plosca.png', prompt: 'Professional food photography of house platter for two people mixed grilled meats schnitzel french fries potato croquettes on rustic wooden board restaurant quality', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/hisni-zrezek.png', prompt: 'Professional food photography of house steak with cream sauce cheese mushrooms and garlic vegetable side on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/kmecka-plosca.png', prompt: 'Professional food photography of farmhouse platter for two with roasted pork stuffed veal breast ribs potatoes gnocchi vegetables cheese struklji on rustic board', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/kmecka-zimska.png', prompt: 'Professional food photography of winter farmhouse platter with roasted pork sausage blood sausage ribs sauerkraut turnips buckwheat on rustic board restaurant quality', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/kmecki-kroznik.png', prompt: 'Professional food photography of farmhouse bowl with roasted pork gnocchi stuffed veal ribs potatoes vegetables cheese struklji in white bowl restaurant quality', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/kmecki-zimski.png', prompt: 'Professional food photography of winter farmhouse bowl with pork sausage blood sausage ribs sauerkraut turnips buckwheat in white bowl restaurant quality', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/kraski-beefsteak.png', prompt: 'Professional food photography of Karst beefsteak with prosciutto and melted cheese vegetable side on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/kraski-zrezek.png', prompt: 'Professional food photography of Karst schnitzel stuffed with prosciutto cheese and garlic vegetable side on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/krvavica.png', prompt: 'Professional food photography of blood sausage krvavica with sauerkraut matevž and salted potatoes on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/ljubljanski-zrezek.png', prompt: 'Professional food photography of Ljubljana schnitzel stuffed with ham and cheese vegetable side on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/naravni-zrezek.png', prompt: 'Professional food photography of natural steak with vegetable side natural meat juices on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/ocvrt-pisanec.png', prompt: 'Professional food photography of whole roasted fried chicken golden crispy skin on wooden board restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/pariski-zrezek.png', prompt: 'Professional food photography of Paris schnitzel thin breaded fried meat with lemon vegetable side on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/pecena-svinjska-kraca.png', prompt: 'Professional food photography of roasted pork knuckle with french fries ajvar mustard onion rings on dark plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/pecenica.png', prompt: 'Professional food photography of grilled sausage pečenica with sauerkraut matevž and salted potatoes on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/pohancki.png', prompt: 'Professional food photography of breaded cutlets pohančki golden crispy with french fries on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/polnjena-telecja-prsa.png', prompt: 'Professional food photography of stuffed veal breast with vegetable side and salted potatoes on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/rostbeef.png', prompt: 'Professional food photography of roastbeef sliced rare beef with baked potatoes and vegetables on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/rumpsteak.png', prompt: 'Professional food photography of rumpsteak grilled medium-rare with vegetable side ajvar mustard on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/sirov-zrezek.png', prompt: 'Professional food photography of cheese steak with cheese sauce and cheese struklji vegetable side on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/svinjska-pecenka.png', prompt: 'Professional food photography of roasted pork loin with vegetable side and salted potatoes on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/tagliata.png', prompt: 'Professional food photography of tagliata thinly sliced beef on arugula with baked potatoes vegetables on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/telecja-pecenka.png', prompt: 'Professional food photography of roasted veal loin with vegetable side and salted potatoes on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/zar-tris.png', prompt: 'Professional food photography of grill trio pork chicken and roastbeef with baked potatoes onion rings on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/zrezek-curry.png', prompt: 'Professional food photography of steak in golden curry sauce with vegetable side on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/zrezek-gobe.png', prompt: 'Professional food photography of steak with mushrooms and mushroom sauce vegetable side on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/zrezek-gorgonzola.png', prompt: 'Professional food photography of steak in gorgonzola sauce with mushrooms vegetable side on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/zrezek-pehtran.png', prompt: 'Professional food photography of steak in tarragon cream sauce with green tarragon vegetable side on white plate restaurant quality overhead shot', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/zrezek-smetanova.png', prompt: 'Professional food photography of steak in white cream sauce with vegetable side on white plate restaurant quality overhead shot warm lighting', size: '1152x864' },
  { path: 'public/menu-images/glavne-jedi/zrezek-zar-rukoli.png', prompt: 'Professional food photography of grilled steak on arugula with baked potatoes onion rings sauce on white plate restaurant quality overhead shot', size: '1152x864' },
];

async function main() {
  console.log(`Generating ${items.length} professional food images...`);
  const zai = await ZAI.create();
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`[${i+1}/${items.length}] ${item.path}`);
    const ok = await generateImage(zai, item.prompt, item.path, item.size);
    if (ok) success++; else failed++;
    
    // Rate limiting delay
    if (i < items.length - 1) {
      await sleep(DELAY_MS);
    }
  }
  
  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

main();
