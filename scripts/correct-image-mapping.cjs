// Pravilno mapiranje artiklov na slike — vsaka slika ustreza artiklu
const fs = require('fs');
const path = require('path');

const baseDir = 'public/menu-images';

// Preberi vse artikle iz seed-a
const seedContent = fs.readFileSync('scripts/seed/add_food_items.js', 'utf-8');
const itemRegex = /\{ name: ['"]([^'"]+)['"],\s*price:\s*([\d.]+),\s*category:\s*(?:CAT\.|'')?(\w+),\s*vat:\s*([\d.]+)\s*\}/g;
const items = [];
let match;
while ((match = itemRegex.exec(seedContent)) !== null) {
  items.push({ name: match[1], price: parseFloat(match[2]), categoryKey: match[3] });
}

// Pravilno mapiranje — vsak artikel dobi ustrezno sliko
const correctMapping = {
  // === PREDJEDI ===
  'Goveji tatar': '/menu-images/hladne-predjedi/domaci-narezek.png',
  'Caprese': '/menu-images/hladne-predjedi/sirova-plosca.png',
  'Tartar iz lososa': '/menu-images/hladne-predjedi/prsut-olive.png',
  'Mesna deska s sirom': '/menu-images/hladne-predjedi/sirova-plosca.png',
  'Ocvrti kalamari': '/menu-images/kalamari/ocvrti.png',
  'Tartar iz govedine z žarem': '/menu-images/hladne-predjedi/domaci-narezek.png',
  'Brusketa s paradižnikom in baziliko': '/menu-images/tople-predjedi/ocvrti-sir.png',
  'Domaca pašteta': '/menu-images/hladne-predjedi/domaci-narezek.png',

  // === JUHE ===
  'Kremna gobova juha': '/menu-images/juhe/kremna-gobova.png',
  'Riževa juha': '/menu-images/juhe/goveja-klasicna.png',
  'Goveja juha s potrebušnino': '/menu-images/juhe/goveja-klasicna.png',
  'Čemaževa juha': '/menu-images/juhe/kremna-gobova.png',
  'Minestra': '/menu-images/juhe/goveja-klasicna.png',

  // === GLAVNE JEDI ===
  'Svinjski zrezek po dunajsko': '/menu-images/glavne-jedi/dunajski-zrezek.png',
  'Svinjski zrezek po ljubljansko': '/menu-images/glavne-jedi/ljubljanski-zrezek.png',
  'Telečji zrezek v gobovi omaki': '/menu-images/glavne-jedi/sirov-zrezek.png',
  'Puranji zrezek po dunajsko': '/menu-images/glavne-jedi/pohancki.png',
  'Goveja jetra s čebulo': '/menu-images/glavne-jedi/hisni-zrezek.png',
  'Goveji stroganov': '/menu-images/glavne-jedi/goveji-golaz.png',
  'Piščančji zrezek v smetanovi omaki': '/menu-images/glavne-jedi/zrezek-smetanova.png',
  'Svinjska rebra z žara': '/menu-images/glavne-jedi/bbq-rebrca.png',
  'Medaljoni iz govedine': '/menu-images/glavne-jedi/beefsteak-zar-rukoli.png',
  'Piščančji file v parmezani': '/menu-images/glavne-jedi/ocvrt-pisanec.png',
  'Dunajski zrezek s pomfri': '/menu-images/glavne-jedi/dunajski-zrezek.png',
  'Bograč': '/menu-images/glavne-jedi/bograc.png',
  'Kmečki krožnik': '/menu-images/glavne-jedi/kmecki-kroznik.png',

  // === TESTENINE ===
  'Špageti bolognese': '/menu-images/testenine-njoki/bolognese.png',
  'Tagliatelle s tartufi': '/menu-images/testenine-njoki/tartufi.png',
  'Penne s piščancem in curryjem': '/menu-images/testenine-njoki/puran-curry.png',
  'Ravioli s špinačo in skuto': '/menu-images/testenine-njoki/gobe.png',
  'Špageti s kozicami': '/menu-images/testenine-njoki/gamberi.png',
  'Fuži s tartufi': '/menu-images/testenine-njoki/tartufi.png',
  'Rezanci z gobami': '/menu-images/testenine-njoki/gobe.png',
  'Špageti frutti di mare': '/menu-images/testenine-njoki/morski-sadezi.png',

  // === PIZZE ===
  'Štirje siri': '/menu-images/pizze/4-siri.png',
  'Gobova pica': '/menu-images/pizze/sampinjoni.png',
  'Diavolo': '/menu-images/pizze/pikant.png',
  'Prosciutto e rucola': '/menu-images/pizze/z-rukolo.png',
  'Tunina pica': '/menu-images/pizze/s-tuno.png',
  'Kraška pica': '/menu-images/pizze/kraska.png',
  'Havajska pica': '/menu-images/pizze/hisna.png',
  'Kmečka pica': '/menu-images/pizze/kmecka.png',
  'Pica s pršutom': '/menu-images/pizze/suha-salama.png',
  'Bianca pica': '/menu-images/pizze/romana.png',

  // === BURGERJI ===
  'BBQ burger': '/menu-images/burgerji/big-boss.png',
  'Double cheeseburger': '/menu-images/burgerji/cheese-please.png',
  'Chili burger': '/menu-images/burgerji/big-smash.png',
  'Burger z jajcem in slanino': '/menu-images/burgerji/the-classic.png',

  // === SOLATE ===
  'Šopska solata': '/menu-images/solate/grska.png',
  'Caprese solata': '/menu-images/solate/cezarjeva.png',
  'Solata z grilanim sirom': '/menu-images/solate/kroznik-feta.png',
  'Solata z avokadom in kozicami': '/menu-images/solate/mesana-tuna.png',
  'Cezarjeva solata s kozicami': '/menu-images/solate/cezarjeva.png',

  // === SLOVENSKE JEDI ===
  'Segedin': '/menu-images/glavne-jedi/hisna-plosca.png',
  'Krvavica s kislim zeljem': '/menu-images/glavne-jedi/krvavica.png',
  'Idrijski žlikrofi': '/menu-images/testenine-njoki/gobe.png',
  'Prekmurska gibanica': '/menu-images/sladice/hisna-sladica.png',
  'Mlinci s puranom': '/menu-images/testenine-njoki/gobe.png',
  'Obara z ajdovo kašo': '/menu-images/glavne-jedi/hisna-plosca.png',
  'Domače pečenice s kislim zeljem': '/menu-images/glavne-jedi/pecenica.png',
  'Potica': '/menu-images/sladice/hisna-sladica.png',

  // === SLADICE ===
  'Krofi s pomarančno marmelado': '/menu-images/sladice/palacinke-marmelada.png',
  'Ledeni desert': '/menu-images/sladice/sladoled-porcija.png',
  'Sadna skleda': '/menu-images/sladice/sadna-kupa.png',
  'Domino kocke': '/menu-images/sladice/hisna-grmada.png',
  'Palačinke z marmelado': '/menu-images/sladice/palacinke-marmelada.png',
  'Sladoled tri okuse': '/menu-images/sladice/sladoled-porcija.png',

  // === PRILOGE ===
  'Njoki': '/menu-images/priloge/kuhani-njoki.png',
  'Polenta': '/menu-images/priloge/kuhana-zelenjava.png',
  'Mlinci': '/menu-images/priloge/siroki-rezanci.png',
  'Krompirjev pire': '/menu-images/priloge/kuhana-zelenjava.png',
  'Krompirjevi kroketi': '/menu-images/priloge/krompirjevi-ocvrtki.png',
  'Ocvrtki': '/menu-images/priloge/krompirjevi-ocvrtki.png',
  'Ajdova kaša': '/menu-images/priloge/kuhana-zelenjava.png',
  'Žar zelenjava': '/menu-images/priloge/bucke-zar-cesen.png',
  'Bučke na žaru': '/menu-images/priloge/bucke-zar-cesen.png',

  // === RIBJE JEDI ===
  'File lososa z žara': '/menu-images/ribje-jedi/losos.png',
  'Ocvrti lignji s tartarsko omako': '/menu-images/kalamari/ocvrti.png',
  'Hobotnica z žara': '/menu-images/ribje-jedi/file-orade.png',
  'Ribja pašteta': '/menu-images/hladne-predjedi/domaci-narezek.png',

  // === VEGETARIJANSKE / ŽAR ===
  'Hrenovke na žaru': '/menu-images/glavne-jedi/bbq-rebrca.png',
  'Klobase na žaru': '/menu-images/glavne-jedi/pecenica.png',
  'Piščančji file na žaru': '/menu-images/glavne-jedi/beefsteak-zar-rukoli.png',
  'Pikantne klobase': '/menu-images/glavne-jedi/bbq-rebrca.png',
  'Žar deska za dve': '/menu-images/glavne-jedi/hisna-plosca.png',

  // === RIZOTE ===
  'Rižota s tartufi': '/menu-images/rizote/gobe.png',
  'Rižota z jurčki': '/menu-images/rizote/gobe.png',
  'Rižota s šparglji': '/menu-images/rizote/zelenjavna.png',
  'Rižota z bučkami in feto': '/menu-images/rizote/gamberi-gobe.png',

  // === ZAJTRK ===
  'Francoski toast': '/menu-images/topli-napitki/vroca-cokolada.png',
  'Jajčni benedikt': '/menu-images/topli-napitki/babyccino.png',
  'Sladke palačinke z jagodami': '/menu-images/sladice/palacinke-nutella-banana.png',
  'Granola z jogurtom': '/menu-images/topli-napitki/kava-z-mlekom.png',
  'Kava in krof': '/menu-images/topli-napitki/kava-z-mlekom.png',

  // === OTROŠKE JEDI ===
  'Piščančji nugeti s pomfri': '/menu-images/otroske-jedi/otroski-pohancki.png',
  'Mini burger s pomfri': '/menu-images/otroske-jedi/pizza-jurcek.png',
  'Krompirček s piščancem': '/menu-images/otroske-jedi/miskolin.png',
  'Sladoled za otroke': '/menu-images/otroske-jedi/sladoled-otroski.png',

  // === SENDVIČI ===
  'Toast s sirom na žaru': '/menu-images/tople-predjedi/ocvrti-sir.png',
  'Panini s pršutom in mocarelo': '/menu-images/tople-predjedi/slanina-rukola.png',
  'Club sendvič s piščancem': '/menu-images/tople-predjedi/ocvrti-sir.png',
  'Wrap s piščancem in zelenjavo': '/menu-images/tople-predjedi/slanina-rukola.png',
};

// Preveri da vse slike obstajajo
let validCount = 0, missingFile = 0, noMapping = 0;
const missing = [];
const noMap = [];

items.forEach(item => {
  const imagePath = correctMapping[item.name];
  if (!imagePath) {
    noMapping++;
    noMap.push(item.name);
    return;
  }
  
  const fullPath = path.join(baseDir, imagePath.replace('/menu-images/', ''));
  if (fs.existsSync(fullPath)) {
    validCount++;
  } else {
    missingFile++;
    missing.push({ name: item.name, imagePath, fullPath });
  }
});

console.log('═══════════════════════════════════════════════');
console.log('  PRAVILNO MAPIRANJE SLIK');
console.log('═══════════════════════════════════════════════');
console.log('');
console.log(`Skupno artiklov: ${items.length}`);
console.log(`Slike veljavne: ${validCount}`);
console.log(`Datoteka manjka: ${missingFile}`);
console.log(`Brez mapiranja: ${noMapping}`);
console.log('');

if (missing.length > 0) {
  console.log('─── MANJKAJOČE DATOTEKE ───');
  missing.forEach(m => console.log(`  ❌ ${m.name} → ${m.imagePath}`));
  console.log('');
}

if (noMap.length > 0) {
  console.log('─── BREZ MAPIRANJA ───');
  noMap.forEach(n => console.log(`  ❓ ${n}`));
  console.log('');
}

// Preveri podvojene slike
const imgCounts = {};
Object.entries(correctMapping).forEach(([name, img]) => {
  if (!imgCounts[img]) imgCounts[img] = [];
  imgCounts[img].push(name);
});

const dupes = Object.entries(imgCounts).filter(([img, names]) => names.length > 1);
console.log('─── PODOVOJENE SLIKE (isti path za različne artikle) ───');
console.log(`Skupaj podvojeno: ${dupes.length}`);
dupes.forEach(([img, names]) => {
  console.log(`  ${img}:`);
  names.forEach(n => console.log(`    → ${n}`));
});
console.log('');

// Generiraj SQL
console.log('─── SQL UPDATE STAVKI ───');
Object.entries(correctMapping).forEach(([name, img]) => {
  const escaped = name.replace(/'/g, "''");
  console.log(`UPDATE "MenuItem" SET image = '${img}' WHERE name = '${escaped}';`);
});

// Dodaj 4 manjkajoče artikle
correctMapping['Svinjska pečenka'] = '/menu-images/glavne-jedi/svinjska-pecenka.png';
correctMapping['Panna cotta'] = '/menu-images/sladice/panna-cotta.png';
correctMapping['Kuhana zelenjava'] = '/menu-images/priloge/kuhana-zelenjava.png';
correctMapping['File brancina'] = '/menu-images/ribje-jedi/file-brancina.png';

console.log('\n─── DODATNA MAPA ───');
console.log('  ✅ Svinjska pečenka → /menu-images/glavne-jedi/svinjska-pecenka.png');
console.log('  ✅ Panna cotta → /menu-images/sladice/panna-cotta.png');
console.log('  ✅ Kuhana zelenjava → /menu-images/priloge/kuhana-zelenjava.png');
console.log('  ✅ File brancina → /menu-images/ribje-jedi/file-brancina.png');
