// Celovit audit artiklov in njihovih slik
const fs = require('fs');
const path = require('path');

const baseDir = 'public/menu-images';

// 1. Pridobi vse slike na disku, organizirane po kategorijah
const categories = fs.readdirSync(baseDir).filter(f => 
  fs.statSync(path.join(baseDir, f)).isDirectory()
);

const imagesByCategory = {};
const allImages = [];

categories.forEach(cat => {
  const files = fs.readdirSync(path.join(baseDir, cat));
  imagesByCategory[cat] = files.map(f => ({
    path: `/menu-images/${cat}/${f}`,
    category: cat,
    filename: f,
    name: f.replace(/\.(png|webp|jpg)$/i, ''),
  }));
  allImages.push(...imagesByCategory[cat]);
});

// 2. Pridobi vse artikle iz add_food_items.js
const seedContent = fs.readFileSync('scripts/seed/add_food_items.js', 'utf-8');
const itemRegex = /\{ name: ['"]([^'"]+)['"],\s*price:\s*([\d.]+),\s*category:\s*(?:CAT\.|'')?(\w+),\s*vat:\s*([\d.]+)\s*\}/g;

const items = [];
let match;
while ((match = itemRegex.exec(seedContent)) !== null) {
  // Map CAT.* to category name
  const catMap = {
    Predjedi: 'hladne-predjedi',
    Pica: 'mesane-pijace',
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
  
  items.push({
    name: match[1],
    price: parseFloat(match[2]),
    categoryKey: match[3],
    vat: parseFloat(match[4]),
    categoryDir: catMap[match[3]] || match[3].toLowerCase(),
  });
}

// 3. Slugify (isti kot v seed skripti)
function slugify(name) {
  return name.toLowerCase()
    .replace(/[čć]/g, 'c').replace(/[š]/g, 's').replace(/[ž]/g, 'z')
    .replace(/[ñ]/g, 'n').replace(/[đ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// 4. Preveri vsak artikel
let found = 0, missing = 0, wrongCategory = 0;
const missingItems = [];
const wrongCategoryItems = [];

items.forEach(item => {
  const slug = slugify(item.name);
  const expectedFlat = path.join(baseDir, slug + '.png');
  const expectedCategorized = path.join(baseDir, item.categoryDir, slug + '.png');
  
  // Preveri flat path (kot seed generira)
  if (fs.existsSync(expectedFlat)) {
    found++;
    return;
  }
  
  // Preveri v pravi kategoriji
  if (fs.existsSync(expectedCategorized)) {
    found++;
    return;
  }
  
  // Preveri v vseh kategorijah
  let foundAnywhere = false;
  let foundInCategory = '';
  for (const cat of categories) {
    if (fs.existsSync(path.join(baseDir, cat, slug + '.png'))) {
      foundAnywhere = true;
      foundInCategory = cat;
      break;
    }
  }
  
  if (foundAnywhere) {
    wrongCategory++;
    wrongCategoryItems.push({
      name: item.name,
      expectedCategory: item.categoryDir,
      actualCategory: foundInCategory,
      slug,
    });
  } else {
    missing++;
    missingItems.push({
      name: item.name,
      slug,
      expectedPath: `/menu-images/${item.categoryDir}/${slug}.png`,
    });
  }
});

// 5. Preveri podvojene slike (isti file hash za različne artikle)
const fileSizeMap = {};
allImages.forEach(img => {
  const fullPath = path.join(baseDir, img.category, img.filename);
  const stat = fs.statSync(fullPath);
  const key = stat.size + '_' + img.filename;
  if (!fileSizeMap[key]) fileSizeMap[key] = [];
  fileSizeMap[key].push(img);
});

const exactDuplicates = Object.entries(fileSizeMap)
  .filter(([k, v]) => v.length > 1)
  .filter(([k]) => !k.includes('undefined'));

// 6. Izpiši rezultate
console.log('═══════════════════════════════════════════════');
console.log('  AUDIT SLIK ARTIKLOV');
console.log('═══════════════════════════════════════════════');
console.log('');
console.log(`Skupno artiklov v seed-u: ${items.length}`);
console.log(`Skupno slik na disku: ${allImages.length}`);
console.log(`Slike najdene: ${found}`);
console.log(`Slike v napačni kategoriji: ${wrongCategory}`);
console.log(`Slike manjkajo: ${missing}`);
console.log('');

console.log('─── MANJKAJOČE SLIKE ───');
if (missingItems.length === 0) {
  console.log('  ✅ Vsi artikli imajo slike');
} else {
  missingItems.forEach(i => console.log(`  ❌ ${i.name} → ${i.expectedPath}`));
}
console.log('');

console.log('─── SLIKE V NAPAČNI KATEGORIJI ───');
if (wrongCategoryItems.length === 0) {
  console.log('  ✅ Vse slike so v pravi kategoriji');
} else {
  wrongCategoryItems.forEach(i => console.log(`  ⚠️  ${i.name} → pričakovano: ${i.expectedCategory}, najdeno: ${i.actualCategory}`));
}
console.log('');

console.log('─── PODOVOJENE SLIKE (po velikosti) ───');
if (exactDuplicates.length === 0) {
  console.log('  ✅ Ni podvojenih slik');
} else {
  exactDuplicates.forEach(([key, imgs]) => {
    console.log(`  ${imgs[0].filename} (${imgs.length}x):`);
    imgs.forEach(i => console.log(`    ${i.category}/`));
  });
}
console.log('');

// 7. Preveri kakšne slike so na disku za znane artikle
console.log('─── VIZUALNA PREVERBA (prvih 20 artiklov) ───');
const sampleItems = items.slice(0, 20);
sampleItems.forEach(item => {
  const slug = slugify(item.name);
  let imgPath = null;
  let imgCategory = null;
  
  // Poišči sliko
  for (const cat of categories) {
    const p = path.join(baseDir, cat, slug + '.png');
    if (fs.existsSync(p)) {
      imgPath = `/menu-images/${cat}/${slug}.png`;
      imgCategory = cat;
      break;
    }
  }
  
  if (imgPath) {
    console.log(`  ✅ ${item.name} → ${imgPath}`);
  } else {
    console.log(`  ❌ ${item.name} → MANJKA`);
  }
});
