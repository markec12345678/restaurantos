import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/home/z/my-project/public/menu-images';

// Category-based color schemes for visual distinction
const FOOD_COLORS = [
  { bg1: '#8B4513', bg2: '#D2691E', emoji: '🍽️' },  // Brown - main dishes
  { bg1: '#228B22', bg2: '#90EE90', emoji: '🥗' },  // Green - salads
  { bg1: '#FF6347', bg2: '#FFA07A', emoji: '🍕' },  // Red - pizza
  { bg1: '#DAA520', bg2: '#FFD700', emoji: '🍔' },  // Gold - burgers
  { bg1: '#4169E1', bg2: '#87CEEB', emoji: '🐟' },  // Blue - seafood
  { bg1: '#9370DB', bg2: '#DDA0DD', emoji: '🍰' },  // Purple - desserts
  { bg1: '#2E8B57', bg2: '#98FB98', emoji: '🥘' },  // Sea green - soups
  { bg1: '#CD853F', bg2: '#F5DEB3', emoji: '🍝' },  // Peru - pasta
  { bg1: '#B8860B', bg2: '#FAFAD2', emoji: '☕' },  // Dark goldenrod - breakfast
];

const MISSING_IMAGES = [
  { name: 'Ajdova kaša', file: 'ajdova-kasa.png', cat: 7 },
  { name: 'BBQ burger', file: 'bbq-burger.png', cat: 3 },
  { name: 'Burger z jajcem in slanino', file: 'burger-z-jajcem-in-slanino.png', cat: 3 },
  { name: 'Caprese solata', file: 'caprese-solata.png', cat: 1 },
  { name: 'Cezarjeva solata s kozicami', file: 'cezarjeva-solata-s-kozicami.png', cat: 1 },
  { name: 'Chili burger', file: 'chili-burger.png', cat: 3 },
  { name: 'Club sendvič s piščancem', file: 'club-sendvic-s-piscancem.png', cat: 0 },
  { name: 'Domače pečenice s kislim zeljem', file: 'domace-pecenice-s-kislim-zeljem.png', cat: 0 },
  { name: 'Domino kocke', file: 'domino-kocke.png', cat: 5 },
  { name: 'File brancina', file: 'file-brancina.png', cat: 4 },
  { name: 'File lososa z žara', file: 'file-lososa-z-zara.png', cat: 4 },
  { name: 'Francoski toast', file: 'francoski-toast.png', cat: 8 },
  { name: 'Granola z jogurtom', file: 'granola-z-jogurtom.png', cat: 8 },
  { name: 'Havajska pica', file: 'havajska-pica.png', cat: 2 },
  { name: 'Hrenovke na žaru', file: 'hrenovke-na-zaru.png', cat: 0 },
  { name: 'Idrijski žlikrofi', file: 'idrijski-zlikrofi.png', cat: 7 },
  { name: 'Jajčni benedikt', file: 'jajcni-benedikt.png', cat: 8 },
  { name: 'Kava in krof', file: 'kava-in-krof.png', cat: 8 },
  { name: 'Klobase na žaru', file: 'klobase-na-zaru.png', cat: 0 },
  { name: 'Kmečka pica', file: 'kmecka-pica.png', cat: 2 },
  { name: 'Kmečki krožnik', file: 'kmecki-kroznik.png', cat: 0 },
  { name: 'Krofi s pomarančno marmelado', file: 'krofi-s-pomarancno-marmelado.png', cat: 5 },
  { name: 'Krompirjevi kroketi', file: 'krompirjevi-kroketi.png', cat: 0 },
  { name: 'Krvavica s kislim zeljem', file: 'krvavica-s-kislim-zeljem.png', cat: 0 },
  { name: 'Ledeni desert', file: 'ledeni-desert.png', cat: 5 },
  { name: 'Medaljoni iz govedine', file: 'medaljoni-iz-govedine.png', cat: 0 },
  { name: 'Mini burger s pomfri', file: 'mini-burger-s-pomfri.png', cat: 3 },
  { name: 'Mlinci', file: 'mlinci.png', cat: 7 },
  { name: 'Njoki', file: 'njoki.png', cat: 7 },
  { name: 'Obara z ajdovo kašo', file: 'obara-z-ajdovo-kaso.png', cat: 7 },
  { name: 'Ocvrti lignji s tartarsko omako', file: 'ocvrti-lignji-s-tartarsko-omako.png', cat: 4 },
  { name: 'Ocvrtki', file: 'ocvrtki.png', cat: 0 },
  { name: 'Penne s piščancem in curryjem', file: 'penne-s-piscancem-in-curryjem.png', cat: 7 },
  { name: 'Pikantne klobase', file: 'pikantne-klobase.png', cat: 0 },
  { name: 'Piščančji file na žaru', file: 'piscancji-file-na-zaru.png', cat: 0 },
  { name: 'Piščančji file v parmezani', file: 'piscancji-file-v-parmezani.png', cat: 0 },
  { name: 'Piščančji nugeti s pomfri', file: 'piscancji-nugeti-s-pomfri.png', cat: 0 },
  { name: 'Potica', file: 'potica.png', cat: 5 },
  { name: 'Prekmurska gibanica', file: 'prekmurska-gibanica.png', cat: 5 },
  { name: 'Rezanci z gobami', file: 'rezanci-z-gobami.png', cat: 7 },
  { name: 'Rižota s tartufi', file: 'rizota-s-tartufi.png', cat: 7 },
  { name: 'Rižota s šparglji', file: 'rizota-s-sparglji.png', cat: 7 },
  { name: 'Rižota z bučkami in feto', file: 'rizota-z-buckami-in-feto.png', cat: 7 },
  { name: 'Sladoled tri okuse', file: 'sladoled-tri-okuse.png', cat: 5 },
  { name: 'Sladoled za otroke', file: 'sladoled-za-otroke.png', cat: 5 },
  { name: 'Solata z avokadom in kozicami', file: 'solata-z-avokadom-in-kozicami.png', cat: 1 },
  { name: 'Solata z grilanim sirom', file: 'solata-z-grilanim-sirom.png', cat: 1 },
  { name: 'Svinjska rebra z žara', file: 'svinjska-rebra-z-zara.png', cat: 0 },
  { name: 'Tagliatelle s tartufi', file: 'tagliatelle-s-tartufi.png', cat: 7 },
  { name: 'Tunina pica', file: 'tunina-pica.png', cat: 2 },
  { name: 'Šopska solata', file: 'sopska-solata.png', cat: 1 },
  { name: 'Štirje siri', file: 'stirje-siri.png', cat: 2 },
  { name: 'Žar deska za dve', file: 'zar-deska-za-dve.png', cat: 0 },
  { name: 'Žar zelenjava', file: 'zar-zelenjava.png', cat: 1 },
];

function createPlaceholderSVG(name, colorScheme) {
  const width = 432;
  const height = 576;
  
  // Wrap text into multiple lines
  const maxCharsPerLine = 16;
  const words = name.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + ' ' + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  
  const lineHeight = 36;
  const startY = height / 2 - (lines.length * lineHeight) / 2 + 20;
  
  const textElements = lines.map((line, i) => 
    `<text x="${width/2}" y="${startY + i * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${escapeXml(line)}</text>`
  ).join('\n');
  
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colorScheme.bg1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colorScheme.bg2};stop-opacity:1" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    <!-- Decorative circle -->
    <circle cx="${width/2}" cy="${height/2 - 60}" r="70" fill="white" opacity="0.12" />
    <circle cx="${width/2}" cy="${height/2 - 60}" r="50" fill="white" opacity="0.08" />
    <!-- Food icon -->
    <text x="${width/2}" y="${height/2 - 45}" font-size="56" text-anchor="middle" filter="url(#shadow)">${colorScheme.emoji}</text>
    <!-- Dish name -->
    ${textElements}
    <!-- Bottom decorative line -->
    <rect x="${width * 0.2}" y="${height - 80}" width="${width * 0.6}" height="2" rx="1" fill="white" opacity="0.3" />
    <!-- Subtle branding -->
    <text x="${width/2}" y="${height - 55}" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="white" text-anchor="middle" opacity="0.4">RestaurantOS</text>
  </svg>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
            .replace(/č/g, '&#269;')
            .replace(/š/g, '&#353;')
            .replace(/ž/g, '&#382;')
            .replace(/ć/g, '&#263;')
            .replace(/đ/g, '&#273;')
            .replace(/Č/g, '&#268;')
            .replace(/Š/g, '&#352;')
            .replace(/Ž/g, '&#381;')
            .replace(/Ć/g, '&#262;')
            .replace(/Đ/g, '&#270;');
}

async function generatePlaceholders() {
  let generated = 0;
  let skipped = 0;
  
  for (const item of MISSING_IMAGES) {
    const outputPath = path.join(OUTPUT_DIR, item.file);
    
    if (fs.existsSync(outputPath)) {
      console.log(`  SKIP (exists): ${item.file}`);
      skipped++;
      continue;
    }
    
    const colorScheme = FOOD_COLORS[item.cat % FOOD_COLORS.length];
    const svg = createPlaceholderSVG(item.name, colorScheme);
    
    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
      console.log(`  ✓ Generated: ${item.file}`);
      generated++;
    } catch (err) {
      console.error(`  ✗ Error: ${item.file}: ${err.message}`);
    }
  }
  
  console.log(`\n=== DONE ===`);
  console.log(`Generated: ${generated}`);
  console.log(`Skipped (already exist): ${skipped}`);
}

generatePlaceholders().catch(console.error);
