// Inteligentno mapiranje artiklov na slike
const fs = require('fs');
const path = require('path');

const baseDir = 'public/menu-images';

// 1. Pridobi vse slike po kategorijah
const categories = fs.readdirSync(baseDir).filter(f => 
  fs.statSync(path.join(baseDir, f)).isDirectory()
);

const imagesByCategory = {};
categories.forEach(cat => {
  imagesByCategory[cat] = fs.readdirSync(path.join(baseDir, cat))
    .filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'))
    .map(f => f.replace(/\.(png|webp|jpg)$/i, ''));
});

// 2. Preberi vse artikle iz seed-a
const seedContent = fs.readFileSync('scripts/seed/add_food_items.js', 'utf-8');
const itemRegex = /\{ name: ['"]([^'"]+)['"],\s*price:\s*([\d.]+),\s*category:\s*(?:CAT\.|'')?(\w+),\s*vat:\s*([\d.]+)\s*\}/g;

const catMap = {
  Predjedi: 'hladne-predjedi',
  Pica: 'pizze',
  Burgerji: 'burgerji',
  Sladice: 'sladice',
  Priloge: 'priloge',
  GlavneJedi: 'glavne-jedi',
  Juhe: 'juhe',
  Testenine: 'testenine-njoki',
  Solate: 'solate',
  Sendvici: 'sendvici',
  Djecji: 'otroske-jedi',
  Zajtrk: 'zajtrk',
  Morski: 'ribje-jedi',
  Slovenske: 'slovenske-jedi',
  Rizote: 'rizote',
  Zara: 'vegetarijanske-jedi',
};

const items = [];
let match;
while ((match = itemRegex.exec(seedContent)) !== null) {
  items.push({
    name: match[1],
    price: parseFloat(match[2]),
    categoryKey: match[3],
    categoryDir: catMap[match[3]] || match[3].toLowerCase(),
  });
}

// 3. Fuzzy matching funkcija
function findBestImage(item) {
  const slug = item.name.toLowerCase()
    .replace(/[čć]/g, 'c').replace(/[š]/g, 's').replace(/[ž]/g, 'z')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const catImages = imagesByCategory[item.categoryDir] || [];
  
  // 1. Poskusi exact slug match
  if (catImages.includes(slug)) {
    return { path: `/menu-images/${item.categoryDir}/${slug}.png`, method: 'exact' };
  }
  
  // 2. Poskusi v vseh kategorijah
  for (const [cat, imgs] of Object.entries(imagesByCategory)) {
    if (imgs.includes(slug)) {
      return { path: `/menu-images/${cat}/${slug}.png`, method: 'cross-category' };
    }
  }
  
  // 3. Keyword matching — izlušči ključne besede iz imena
  const keywords = item.name.toLowerCase()
    .replace(/[čć]/g, 'c').replace(/[š]/g, 's').replace(/[ž]/g, 'z')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['po', 'dunajsko', 'ljubljansko', 's', 'z', 'in', 'na', 'za', 'iz'].includes(w));
  
  // Poskusi najti sliko ki vsebuje ključno besedo
  for (const keyword of keywords) {
    // Najprej v pravi kategoriji
    const match = catImages.find(img => img.includes(keyword) || keyword.includes(img.split('-')[0]));
    if (match) {
      return { path: `/menu-images/${item.categoryDir}/${match}.png`, method: 'keyword' };
    }
    // Potem v vseh kategorijah
    for (const [cat, imgs] of Object.entries(imagesByCategory)) {
      const m = imgs.find(img => img.includes(keyword));
      if (m) {
        return { path: `/menu-images/${cat}/${m}.png`, method: 'keyword-cross' };
      }
    }
  }
  
  // 4. Manual mapping za znane primere
  const manualMap = {
    'Svinjski zrezek po dunajsko': 'glavne-jedi/dunajski-zrezek',
    'Svinjski zrezek po ljubljansko': 'glavne-jedi/ljubljanski-zrezek',
    'Telečji zrezek v gobovi omaki': 'glavne-jedi/sirov-zrezek',
    'Puranji zrezek po dunajsko': 'glavne-jedi/dunajski-zrezek',
    'Dunajski zrezek s pomfri': 'glavne-jedi/dunajski-zrezek',
    'Špageti bolognese': 'testenine-njoki/bolognese',
    'Tagliatelle s tartufi': 'testenine-njoki/tartufi',
    'Penne s piščancem in curryjem': 'testenine-njoki/puran-curry',
    'Ravioli s špinačo in skuto': 'testenine-njoki/gobe',
    'Špageti s kozicami': 'testenine-njoki/gamberi',
    'Fuži s tartufi': 'testenine-njoki/tartufi',
    'Rezanci z gobami': 'testenine-njoki/gobe',
    'Špageti frutti di mare': 'testenine-njoki/morski-sadezi',
    'Štirje siri': 'pizze/4-siri',
    'Gobova pica': 'pizze/sampinjoni',
    'Diavolo': 'pizze/pikant',
    'Prosciutto e rucola': 'pizze/z-rukolo',
    'Tunina pica': 'pizze/s-tuno',
    'Kraška pica': 'pizze/kraska',
    'Havajska pica': 'pizze/hawaii',
    'Kmečka pica': 'pizze/kmecka',
    'Pica s pršutom': 'pizze/suha-salama',
    'Bianca pica': 'pizze/romana',
    'BBQ burger': 'burgerji/bbq-rebrca',
    'Double cheeseburger': 'burgerji/bbq-rebrca',
    'Chili burger': 'burgerji/bbq-rebrca',
    'Burger z jajcem in slanino': 'burgerji/bbq-rebrca',
    'Šopska solata': 'solate/grska',
    'Caprese solata': 'solate/cezarjeva',
    'Solata z grilanim sirom': 'solate/sirova-plosca',
    'Solata z avokadom in kozicami': 'solate/mesana-tuna',
    'Cezarjeva solata s kozicami': 'solate/cezarjeva',
    'Segedin': 'glavne-jedi/hisna-plosca',
    'Krvavica s kislim zeljem': 'glavne-jedi/krvavica',
    'Idrijski žlikrofi': 'testenine-njoki/gobe',
    'Prekmurska gibanica': 'sladice/hisna-sladica',
    'Mlinci s puranom': 'testenine-njoki/gobe',
    'Obara z ajdovo kašo': 'glavne-jedi/hisna-plosca',
    'Domače pečenice s kislim zeljem': 'glavne-jedi/pecenica',
    'Potica': 'sladice/hisna-sladica',
    'Krofi s pomarančno marmelado': 'sladice/palacinke-marmelada',
    'Ledeni desert': 'sladice/sladoled-porcija',
    'Sadna skleda': 'sladice/sadna-kupa',
    'Domino kocke': 'sladice/hisna-grmada',
    'Palačinke z marmelado': 'sladice/palacinke-marmelada',
    'Sladoled tri okuse': 'sladice/sladoled-porcija',
    'Njoki': 'priloge/kuhani-njoki',
    'Polenta': 'priloge/kuhani-njoki',
    'Mlinci': 'priloge/kuhani-njoki',
    'Krompirjev pire': 'priloge/kuhana-zelenjava',
    'Krompirjevi kroketi': 'priloge/krompirjevi-ocvrtki',
    'Ocvrtki': 'priloge/krompirjevi-ocvrtki',
    'Ajdova kaša': 'priloge/kuhana-zelenjava',
    'Žar zelenjava': 'priloge/bucke-zar-cesen',
    'File lososa z žara': 'ribje-jedi/losos',
    'Ocvrti lignji s tartarsko omako': 'kalamari/ocvrti',
    'Hobotnica z žara': 'ribje-jedi/file-orade',
    'Ribja pašteta': 'hladne-predjedi/domaci-narezek',
    'Hrenovke na žaru': 'glavne-jedi/bbq-rebrca',
    'Klobase na žaru': 'glavne-jedi/bbq-rebrca',
    'Piščančji file na žaru': 'glavne-jedi/beefsteak-zar-rukoli',
    'Pikantne klobase': 'glavne-jedi/bbq-rebrca',
    'Žar deska za dve': 'glavne-jedi/hisna-plosca',
    'Rižota s tartufi': 'rizote/gobe',
    'Rižota z jurčki': 'rizote/gobe',
    'Rižota s šparglji': 'rizote/zelenjavna',
    'Rižota z bučkami in feto': 'rizote/gamberi-gobe',
    'Francoski toast': 'zajtrk/vroca-cokolada',
    'Jajčni benedikt': 'zajtrk/babyccino',
    'Sladke palačinke z jagodami': 'sladice/palacinke-nutella-banana',
    'Granola z jogurtom': 'zajtrk/kava-z-mlekom',
    'Kava in krof': 'zajtrk/kava-z-mlekom',
    'Piščančji nugeti s pomfri': 'otroske-jedi/otroski-pohancki',
    'Mini burger s pomfri': 'otroske-jedi/pizza-jurcek',
    'Krompirček s piščancem': 'otroske-jedi/miskolin',
    'Sladoled za otroke': 'otroske-jedi/sladoled-otroski',
    'Toast s sirom na žaru': 'sendvici/ocvrti-sir',
    'Panini s pršutom in mocarelo': 'sendvici/slanina-rukola',
    'Club sendvič s piščancem': 'sendvici/ocvrti-sir',
    'Wrap s piščancem in zelenjavo': 'sendvici/ocvrti-sir',
    'Goveji tatar': 'hladne-predjedi/domaci-narezek',
    'Caprese': 'hladne-predjedi/sirova-plosca',
    'Tartar iz lososa': 'hladne-predjedi/prsut-olive',
    'Mesna deska s sirom': 'hladne-predjedi/sirova-plosca',
    'Ocvrti kalamari': 'kalamari/ocvrti',
    'Tartar iz govedine z žarem': 'hladne-predjedi/domaci-narezek',
    'Brusketa s paradižnikom in baziliko': 'tople-predjedi/ocvrti-sir',
    'Domaca pašteta': 'hladne-predjedi/domaci-narezek',
    'Kremna gobova juha': 'juhe/juha-palacinke',
    'Riževa juha': 'juhe/juha-palacinke',
    'Goveja juha s potrebušnino': 'juhe/juha-palacinke',
    'Čemaževa juha': 'juhe/juha-palacinke',
    'Minestra': 'juhe/juha-palacinke',
    'Goveja jetra s čebulo': 'glavne-jedi/hisni-zrezek',
    'Goveji stroganov': 'glavne-jedi/goveji-golaz',
    'Piščančji zrezek v smetanovi omaki': 'glavne-jedi/zrezek-smetanova',
    'Svinjska rebra z žara': 'glavne-jedi/bbq-rebrca',
    'Medaljoni iz govedine': 'glavne-jedi/beefsteak-zar-rukoli',
    'Piščančji file v parmezani': 'glavne-jedi/ocvrt-pisanec',
    'Bograč': 'glavne-jedi/bograc',
    'Kmečki krožnik': 'glavne-jedi/kmecki-kroznik',
    'Bučke na žaru': 'priloge/bucke-zar-cesen',
  };
  
  if (manualMap[item.name]) {
    const mapped = manualMap[item.name];
    const [cat, name] = mapped.split('/');
    if (imagesByCategory[cat]?.includes(name)) {
      return { path: `/menu-images/${cat}/${name}.png`, method: 'manual' };
    }
  }
  
  return null;
}

// 4. Pridobi rezultate
let matched = 0, unmatched = 0;
const results = [];
const unmatchedItems = [];

items.forEach(item => {
  const result = findBestImage(item);
  if (result) {
    matched++;
    results.push({ name: item.name, image: result.path, method: result.method, category: item.categoryDir });
  } else {
    unmatched++;
    unmatchedItems.push(item.name);
  }
});

console.log('═══════════════════════════════════════════════');
console.log('  INTELIGENTNO MAPIRANJE SLIK');
console.log('═══════════════════════════════════════════════');
console.log('');
console.log(`Skupno artiklov: ${items.length}`);
console.log(`Uspešno mapiranih: ${matched}`);
console.log(`Nemapiranih: ${unmatched}`);
console.log('');

// 5. Generiraj SQL UPDATE stavke
console.log('─── SQL UPDATE STAVKI ───');
results.forEach(r => {
  const escapedName = r.name.replace(/'/g, "''");
  console.log(`UPDATE "MenuItem" SET image = '${r.image}' WHERE name = '${escapedName}';`);
});

console.log('');
console.log('─── NEMAPIRANI ARTIKLI ───');
unmatchedItems.forEach(name => console.log(`  ❌ ${name}`));

console.log('');
console.log('─── STATISTIKA PO METODI ───');
const byMethod = {};
results.forEach(r => {
  byMethod[r.method] = (byMethod[r.method] || 0) + 1;
});
Object.entries(byMethod).forEach(([method, count]) => {
  console.log(`  ${method}: ${count}`);
});
