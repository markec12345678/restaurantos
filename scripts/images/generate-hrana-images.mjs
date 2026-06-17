import { chromium } from 'playwright';
import { writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { readdirSync } from 'fs';

const MIN_SIZE = 20000;
const WIDTH = 600;
const HEIGHT = 600;

const categoryColors = {
  'zrezek': { bg: '#8B0000', accent: '#FFD700', icon: '🥩' },
  'pica': { bg: '#BF360C', accent: '#FFCCBC', icon: '🍕' },
  'burger': { bg: '#D84315', accent: '#FFCCBC', icon: '🍔' },
  'testenine': { bg: '#F57F17', accent: '#FFF9C4', icon: '🍝' },
  'njoki': { bg: '#F57F17', accent: '#FFF9C4', icon: '🍝' },
  'rizot': { bg: '#558B2F', accent: '#DCEDC8', icon: '🍚' },
  'solata': { bg: '#1B5E20', accent: '#A5D6A7', icon: '🥬' },
  'juha': { bg: '#4A148C', accent: '#E1BEE7', icon: '🥣' },
  'sladica': { bg: '#880E4F', accent: '#F8BBD0', icon: '🍰' },
  'predjed': { bg: '#E65100', accent: '#FFE0B2', icon: '🍲' },
  'riba': { bg: '#006064', accent: '#B2EBF2', icon: '🐟' },
  'kalamari': { bg: '#1A237E', accent: '#C5CAE9', icon: '🦑' },
  'lignj': { bg: '#1A237E', accent: '#C5CAE9', icon: '🦑' },
  'krompir': { bg: '#795548', accent: '#D7CCC8', icon: '🥔' },
  'meso': { bg: '#8B0000', accent: '#FFD700', icon: '🥩' },
  'priloga': { bg: '#795548', accent: '#D7CCC8', icon: '🍟' },
  'sir': { bg: '#F9A825', accent: '#FFF9C4', icon: '🧀' },
  'vino': { bg: '#4A148C', accent: '#E1BEE7', icon: '🍷' },
  'kava': { bg: '#3E2723', accent: '#D7CCC8', icon: '☕' },
  'default': { bg: '#37474F', accent: '#CFD8DC', icon: '🍽️' },
};

function detectCategory(filename) {
  const f = filename.toLowerCase();
  if (f.includes('zrezek') || f.includes('beefsteak') || f.includes('rumpsteak') || f.includes('rostbeef') || f.includes('tagliata') || f.includes('ribeye') || f.includes('tbone') || f.includes('file-mignon')) return 'zrezek';
  if (f.includes('pica') || f.includes('pizza')) return 'pica';
  if (f.includes('burger')) return 'burger';
  if (f.includes('testenine') || f.includes('spageti') || f.includes('peresniki') || f.includes('penne') || f.includes('lasanja') || f.includes('fuzi') || f.includes('zlikrofi') || f.includes('padthai')) return 'testenine';
  if (f.includes('njoki')) return 'njoki';
  if (f.includes('rizot') || f.includes('rizota')) return 'rizot';
  if (f.includes('solata') || f.includes('rukola') || f.includes('motovilec') || f.includes('kumare') || f.includes('fizol') || f.includes('koruzn') || f.includes('zeljn') || f.includes('zelena') || f.includes('paradiznikov') || f.includes('grsk') || f.includes('sopsk') || f.includes('italijansk') || f.includes('cezar') || f.includes('caesar')) return 'solata';
  if (f.includes('juha') || f.includes('jota') || f.includes('golaz') || f.includes('bograc')) return 'juha';
  if (f.includes('tiramisu') || f.includes('panna') || f.includes('cokolad') || f.includes('creme') || f.includes('struklji') || f.includes('sladk') || f.includes('torta') || f.includes('lava') || f.includes('cheesecake')) return 'sladica';
  if (f.includes('predjed') || f.includes('narezek') || f.includes('prsut') || f.includes('proscutto') || f.includes('carpaccio') || f.includes('bruschetta') || f.includes('burrata') || f.includes('camembert') || f.includes('pasteta') || f.includes('dila') || f.includes('hobotnica-solata') || f.includes('frito') || f.includes('rozbif-rukoli') || f.includes('ovcja') || f.includes('mladi-sir') || f.includes('ocvrti-sir') || f.includes('ocvrti-sampinjoni') || f.includes('sampinjoni') || f.includes('sir-') || f.includes('slanina')) return 'predjed';
  if (f.includes('losos') || f.includes('pstrv') || f.includes('oslic') || f.includes('ribj') || f.includes('file-orad') || f.includes('file-brancin') || f.includes('file-bel') || f.includes('gamberi') || f.includes('tuna') || f.includes('tunin')) return 'riba';
  if (f.includes('kalamari')) return 'kalamari';
  if (f.includes('lignj')) return 'lignj';
  if (f.includes('krompir') || f.includes('pomfri') || f.includes('prazen') || f.includes('kuhan-')) return 'krompir';
  if (f.includes('cevapcici') || f.includes('pleskavic') || f.includes('raznjici') || f.includes('piskanec') || f.includes('piscan') || f.includes('puran') || f.includes('pecenka') || f.includes('jagenjc') || f.includes('svinjsk') || f.includes('pecenica') || f.includes('krvavic') || f.includes('pohanck') || f.includes('mesan') || f.includes('pečen') || f.includes('pecen') || f.includes('rozbif') || f.includes('roastbeef') || f.includes('kare') || f.includes('vrat')) return 'meso';
  if (f.includes('vino')) return 'vino';
  if (f.includes('kava') || f.includes('kakav') || f.includes('cokolada-')) return 'kava';
  return 'default';
}

function generateHTML(filename, cat, c) {
  // Derive display name from filename
  let name = filename
    .replace(/-/g, ' ')
    .replace(/\b\d+\b/g, '') // Remove standalone numbers like "2", "3"
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, l => l.toUpperCase());
  
  // Map Slovenian food names to better display names
  const nameMap = {
    'Ajdova Kasa Jurcki': 'Ajdova Kaša z Jurčki',
    'Aladin Mesano': 'Aladin Mešano',
    'Bacon Cheeseburger': 'Bacon Cheeseburger',
    'Bbq Chicken Pica': 'BBQ Chicken Pica',
    'Bbq Pica': 'BBQ Pica',
    'Bbq Rebrca': 'BBQ Rebrca',
    'Beefsteak Poprova Omaka': 'Beefsteak Poprova Omaka',
    'Beefsteak Zar Rukoli': 'Beefsteak Žar na Rukoli',
    'Black Angus Burger': 'Black Angus Burger',
    'Bograc Kotlicek': 'Bograč v Kotličku',
    'Burger Losos': 'Burger z Lososom',
    'Burrata': 'Burrata s Paradižnikom',
    'Caesar Salata': 'Caesar Salata',
    'Camembert': 'Zapečen Camembert',
    'Capricioza Pica': 'Capricciosa Pica',
    'Carpaccio Pica': 'Carpaccio Pica',
    'Cesnov Kruh': 'Česnov Kruh',
    'Cesnova Pica': 'Česnova Pica',
    'Cevapcici': 'Čevapčiči',
    'Cevapcici Piskanec': 'Čevapčiči Piščanec',
    'Classic Burger': 'Classic Burger',
    'Cokoladna Torta': 'Čokoladna Torta',
    'Cokoladni Lava Cake': 'Čokoladni Lava Cake',
    'Creme Brulee': 'Crème Brûlée',
    'Dnevna Juha': 'Dnevna Juha',
    'Domaca Pica': 'Domača Pica',
    'Domaci Narezek': 'Domači Narezek',
    'Duffy Duck Burger': 'Duffy Duck Burger',
    'Duvec Riz': 'Duvec Riž',
    'Falafel Wrap': 'Falafel Wrap',
    'Fettuccine Alfredo': 'Fettuccine Alfredo',
    'File Bele Ribe': 'File Bele Ribe',
    'File Brancina Zar': 'File Brancina na Žaru',
    'File Mignon Polenta': 'Filet Mignon s Polento',
    'File Orade': 'File Orade',
    'File Postrvi': 'File Postrvi',
    'Fizolova Solata': 'Fižolova Solata',
    'Francek': 'Francek',
    'Frito Misto': 'Frito Misto',
    'Fuzi Gamberi': 'Fuži z Gamberi',
    'Fuzi Tartufi': 'Fuži s Tartufi',
    'Gamberi Parisko': 'Gamberi po Pariško',
    'Gamberi Testenine': 'Testenine z Gamberi',
    'Gobova Juha': 'Gobova Juha',
    'Golaz Polenta': 'Golaž s Polento',
    'Goveja Juha Jajce': 'Goveja Juha z Jajcem',
    'Goveja Juha Klasicna': 'Goveja Juha Klasična',
    'Goveja Juha Rezanci': 'Goveja Juha z Rezanci',
    'Goveji Carpaccio': 'Goveji Carpaccio',
    'Goveji Golaz Kotlicek': 'Goveji Golaž v Kotličku',
    'Grska Solata': 'Grška Solata',
    'Hawaii Zrezek': 'Hawaii Zrezek',
    'Hisna Pasteta': 'Hišna Pašteta',
    'Hisna Pica': 'Hišna Pica',
    'Hisna Plosca': 'Hišna Plošča',
    'Hisni Zrezek': 'Hišni Zrezek',
    'Hladna Dila': 'Hladne Dila',
    'Hladni Rozbif Rukoli': 'Hladni Rozbif na Rukoli',
    'Hobotnica': 'Hobotnica na Žaru',
    'Hobotnica Solata': 'Hobotnica v Solati',
    'Hobotnica Zar': 'Hobotnica na Žaru',
    'Italijanska Solata': 'Italijanska Solata',
    'Jota': 'Jota',
    'Jurcki Zar': 'Jurčki na Žaru',
    'Kalamari Mornarsko': 'Kalamari po Mornarsko',
    'Kalamari Zar': 'Kalamari na Žaru',
    'Kalamari Zar Rukoli': 'Kalamari Žar na Rukoli',
    'Kmecka Plosca': 'Kmečka Plošča',
    'Kmecka Plosca Zimska': 'Kmečka Plošča Zimska',
    'Kmecki Kroznik': 'Kmečki Krožnik',
    'Kmecki Kroznik Zimski': 'Kmečki Krožnik Zimski',
    'Koruzna Solata': 'Koruzna Solata',
    'Kraski Beefsteak': 'Kraški Beefsteak',
    'Kremna Gobova Juha': 'Kremna Gobova Juha',
    'Kremna Zelenjavna Juha': 'Kremna Zelenjavna Juha',
    'Krvavica Prilogo': 'Krvavica s Prilogo',
    'Kuhan Krompir': 'Kuhan Krompir',
    'Kuhana Zelenjava': 'Kuhana Zelenjava',
    'Kumare Solata': 'Kumare Solata',
    'Lasanja': 'Lašanja',
    'Lepinja': 'Lepinja',
    'Lignji Ocvrti': 'Ocvrti Lignji',
    'Lignji Polnjeni': 'Polnjeni Lignji',
    'Lignji Zar': 'Lignji na Žaru',
    'Losos File': 'Losos File',
    'Losos Zar': 'Losos na Žaru',
    'Mafiozo Pica': 'Mafiozo Pica',
    'Margherita Pica': 'Margherita Pica',
    'Mesana Solata': 'Mešana Solata',
    'Mesana Solata Tuna': 'Mešana Solata s Tuno',
    'Mesani Kalamari': 'Mešani Kalamari',
    'Mesani Zar': 'Mešani Žar',
    'Mesano Meso': 'Mešano Meso',
    'Mladi Sir': 'Mladi Sir na Žaru',
    'Morska Rizota': 'Morska Rižota',
    'Motovilec': 'Motovilec',
    'Njoki Bucke Panceta': 'Njoki Bučke Panceta',
    'Njoki Gorgonzola': 'Njoki v Gorgonzoli',
    'Njoki Losos': 'Njoki z Lososom',
    'Njoki Preprosti': 'Njoki Preprosti',
    'Ocvrt Oslic': 'Ocvrt Oslič',
    'Ocvrt Pisanec': 'Ocvrt Pišanec',
    'Ocvrti Sampinjoni': 'Ocvrti Šampinjoni',
    'Ocvrti Sir': 'Ocvrti Sir',
    'Ocvrti Sir Krompircki': 'Ocvrti Sir s Krompirčki',
    'Ovcja Skuta': 'Ovčja Skuta s Krompirjem',
    'Padthai Piscanec': 'Pad Thai s Piščancem',
    'Padthai Zelenjava': 'Pad Thai z Zelenjavo',
    'Panna Cotta': 'Panna Cotta',
    'Paradiznikova Solata': 'Paradižnikova Solata',
    'Pariski Zrezek': 'Pariški Zrezek',
    'Pecena Paprika': 'Pečena Paprika',
    'Pecena Svinjska Kraca': 'Pečena Svinjska Krača',
    'Pecena Zelenjava': 'Pečena Zelenjava',
    'Pecenica Prilogo': 'Pečenica s Prilogo',
    'Penne Arrabbiata': 'Penne Arrabbiata',
    'Pepperoni Pica': 'Pepperoni Pica',
    'Peresniki Pesto': 'Peresniki s Pestom',
    'Peresniki Piscanec Jurcki': 'Peresniki Piščanec Jurčki',
    'Pikantna Klobasa Zar': 'Pikantna Klobasa na Žaru',
    'Piscancja Solata': 'Piščančja Solata',
    'Piscancji Parmezan': 'Piščančji Parmezan',
    'Piscanec Testenine': 'Piščanec Testenine',
    'Piscanji Zrezek Gobe': 'Piščanji Zrezek z Gobami',
    'Piscanji Zrezek Sir': 'Piščanji Zrezek s Sirom',
    'Piscanji Zrezek Zar': 'Piščanji Zrezek na Žaru',
    'Pleskavica': 'Pleskavica',
    'Pleskavica Kajmak': 'Pleskavica s Kajmakom',
    'Pohancki': 'Pohančki',
    'Polnjena Pleskavica': 'Polnjena Pleskavica',
    'Polnjena Telecja Prsa': 'Polnjena Telečja Prsa',
    'Polnjeni Kalamari Dunajsko': 'Polnjeni Kalamari po Dunajsko',
    'Polnjeni Kalamari Zar': 'Polnjeni Kalamari na Žaru',
    'Pomfri': 'Pommes Frites',
    'Prazen Krompir': 'Pražen Krompir',
    'Prsut Olive': 'Pršut z Olivami',
    'Pstrv Trzaska': 'Pstrv po Tržaško',
    'Pstrv Zar': 'Pstrv na Žaru',
    'Puran Smetanova Testenine': 'Puran Smetanova Testenine',
    'Raznjici': 'Ražnjiči',
    'Rezanci Losos': 'Rezanci z Lososom',
    'Ribeye g': 'Ribeye Steak',
    'Ribeye Zrezek': 'Ribeye Zrezek',
    'Ribja Plosca': 'Ribja Plošča',
    'Risot Gobe': 'Rižot z Gobami',
    'Risot Gobe Tartufi': 'Rižot z Gobami in Tartufi',
    'Risot Morski Sadezi': 'Rižot z Morskimi Sadeži',
    'Rizota Gamberi Gobe': 'Rižota z Gamberi in Gobami',
    'Rizota Gobe': 'Rižota z Gobami',
    'Rizota Piscanec Zelenjava': 'Rižota s Piščancem',
    'Rizota Puran Paprika': 'Rižota s Puranom in Papriko',
    'Roastbeef Solata': 'Roastbeef Solata',
    'Rostbeef': 'Rostbeef',
    'Rozbif Jurcki': 'Rozbif z Jurčki',
    'Rozbif Zar': 'Rozbif na Žaru',
    'Rukola Parmezan': 'Rukola s Parmezanom',
    'Rukola Solata': 'Rukola Solata',
    'Rumpsteak': 'Rumpsteak',
    'Rustika Pica': 'Rustika Pica',
    'Sampinjoni Gorgonzolna': 'Šampinjoni Gorgonzolna',
    'Sampinjoni Zar Gorgonzola': 'Šampinjoni Žar Gorgonzola',
    'Sampinjoni Zar Trzaska': 'Šampinjoni Žar Tržaška',
    'Scooby Doo': 'Scooby Doo Burger',
    'Siciliana Pica': 'Siciliana Pica',
    'Sicilijana Testenine': 'Sicilijana Testenine',
    'Sirova Plosca': 'Sirova Plošča',
    'Sirovi Struklji': 'Sirovi Štruklji',
    'Slanina Rukola': 'Slanina na Rukoli',
    'Smetanova Testenine': 'Smetanova Testenine',
    'Solata Losos': 'Solata z Lososom',
    'Solata Ocvrti Piscanec': 'Solata z Ocvrtim Piščancem',
    'Solata S Tuno': 'Solata s Tuno',
    'Sopska Solata': 'Šopska Solata',
    'Spageti Bolonjske': 'Špageti Bolognese',
    'Spageti Carbonara': 'Špageti Carbonara',
    'Spageti Morski': 'Špageti z Morskimi Sadeži',
    'Spageti Paradiznik': 'Špageti s Paradižnikom',
    'Struklji': 'Štruklji',
    'Struklji Sladki': 'Sladki Štruklji',
    'Svinjska Pecenka': 'Svinjska Pečenka',
    'Svinjski Kare': 'Svinjski Kare',
    'Svinjski Vrat Zar': 'Svinjski Vrat na Žaru',
    'Tagliata Rukoli': 'Tagliata na Rukoli',
    'Tartufi Testenine': 'Tartufi Testenine',
    'Tbone g': 'T-Bone Steak',
    'Telecja Pecenka': 'Telečja Pečenka',
    'Testenine Morski': 'Testenine z Morskimi Sadeži',
    'Tiramisu': 'Tiramisu',
    'Tuna Zrezek': 'Tuna Zrezek',
    'Tunin Steak': 'Tunin Steak',
    'Vegetarijanska Pica': 'Vegetarijanska Pica',
    'Vegetarijanski Kroznik': 'Vegetarijanski Krožnik',
    'Zar Tris': 'Žar Tris',
    'Zelena Solata': 'Zelena Solata',
    'Zelenjavna Juha': 'Zelenjavna Juha',
    'Zelenjavna Pica': 'Zelenjavna Pica',
    'Zelenjavna Rizota': 'Zelenjavna Rižota',
    'Zeljnata Solata': 'Zeljnata Solata',
    'Zlikrofi': 'Žlikrofi',
    'Zlikrofi Tepke': 'Žlikrofi Tepke',
    'Zrezek Curry Omaka': 'Zrezek v Curry Omaki',
    'Zrezek Gorgonzola Gobe': 'Zrezek Gorgonzola Gobe',
    'Zrezek Smetanovi Omaki': 'Zrezek v Smetanovi Omaki',
    'Zrezek Smetanovi Pehtranom': 'Zrezek s Pehtranom',
    'Zrezek Z Gobami': 'Zrezek z Gobami',
    'Zrezek Zar Rukoli': 'Zrezek Žar na Rukoli',
  };
  
  // Clean up the name
  name = name.replace(/\d+/g, '').trim();
  
  // Check the map first
  const key = name.trim();
  if (nameMap[key]) name = nameMap[key];
  
  return `<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; font-family: 'Inter', sans-serif; overflow: hidden; }
  .card {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    background: linear-gradient(145deg, ${c.bg} 0%, ${c.bg}dd 40%, ${c.bg}aa 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .card::before {
    content: ''; position: absolute; top: -50%; right: -30%;
    width: 80%; height: 80%;
    background: radial-gradient(circle, ${c.accent}33 0%, transparent 70%); border-radius: 50%;
  }
  .card::after {
    content: ''; position: absolute; bottom: -40%; left: -20%;
    width: 70%; height: 70%;
    background: radial-gradient(circle, ${c.accent}22 0%, transparent 70%); border-radius: 50%;
  }
  .icon { font-size: 90px; margin-bottom: 14px; z-index: 1; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); }
  .name {
    font-size: 24px; font-weight: 800; color: #FFFFFF; text-align: center;
    padding: 0 24px; z-index: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    line-height: 1.2; letter-spacing: -0.5px;
  }
  .line { width: 50px; height: 3px; background: ${c.accent}; margin: 10px 0; border-radius: 2px; z-index: 1; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">${c.icon}</div>
  <div class="name">${name}</div>
  <div class="line"></div>
</div>
</body>
</html>`;
}

async function main() {
  const hranaDir = 'public/menu-images/hrana';
  const files = readdirSync(hranaDir).filter(f => f.endsWith('.png'));
  
  console.log(`Found ${files.length} total hrana images`);
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  
  let ok = 0, skip = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = join(hranaDir, file);
    const baseName = file.replace('.png', '');
    
    // Skip if already professional
    if (statSync(fullPath).size > MIN_SIZE) {
      console.log(`[${i+1}/${files.length}] SKIP: ${baseName}`);
      skip++;
      continue;
    }
    
    const cat = detectCategory(baseName);
    const c = categoryColors[cat] || categoryColors['default'];
    const html = generateHTML(baseName, cat, c);
    
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: fullPath, type: 'png' });
    
    console.log(`[${i+1}/${files.length}] OK: ${baseName} (${cat})`);
    ok++;
  }
  
  await browser.close();
  console.log(`\nDone! Generated: ${ok}, Skipped: ${skip}`);
}

main().catch(console.error);
