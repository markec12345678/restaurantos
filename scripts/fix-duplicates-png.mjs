#!/usr/bin/env node
/**
 * Generate unique professional PNG menu images for all duplicate items using Sharp.
 * Each image gets a unique visual design with distinct colors, shapes, and labels.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MENU_DIR = '/home/z/my-project/public/menu-images';

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Color palettes for different food types
const PALETTES = {
  meat:    { bg: [26, 10, 10],    accent: [192, 57, 43],  secondary: [231, 76, 60],   highlight: [245, 183, 177] },
  fish:    { bg: [10, 26, 42],    accent: [41, 128, 185],  secondary: [52, 152, 219],  highlight: [174, 214, 241] },
  pasta:   { bg: [26, 21, 8],     accent: [212, 160, 23],  secondary: [241, 196, 15],  highlight: [249, 231, 159] },
  salad:   { bg: [10, 26, 10],    accent: [39, 174, 96],   secondary: [46, 204, 113],  highlight: [171, 235, 198] },
  soup:    { bg: [26, 18, 8],     accent: [230, 126, 34],  secondary: [243, 156, 18],  highlight: [250, 215, 160] },
  dessert: { bg: [26, 10, 24],    accent: [192, 57, 43],   secondary: [231, 76, 60],   highlight: [245, 183, 177] },
  pizza:   { bg: [26, 15, 8],     accent: [211, 84, 0],    secondary: [230, 126, 34],  highlight: [250, 215, 160] },
  burger:  { bg: [26, 18, 8],     accent: [184, 134, 11],  secondary: [218, 165, 32],  highlight: [240, 230, 140] },
  drink:   { bg: [10, 10, 26],    accent: [142, 68, 173],  secondary: [155, 89, 182],  highlight: [215, 189, 226] },
  hot:     { bg: [26, 15, 10],    accent: [160, 82, 45],   secondary: [205, 133, 63],  highlight: [222, 184, 135] },
  cold:    { bg: [10, 21, 32],    accent: [93, 173, 226],  secondary: [133, 193, 233], highlight: [212, 230, 241] },
  wine:    { bg: [26, 10, 16],    accent: [123, 36, 28],   secondary: [169, 50, 38],   highlight: [217, 136, 128] },
  beer:    { bg: [26, 21, 8],     accent: [212, 160, 23],  secondary: [241, 196, 15],  highlight: [249, 231, 159] },
  spirit:  { bg: [18, 10, 26],    accent: [108, 52, 131],  secondary: [142, 68, 173],  highlight: [210, 180, 222] },
  kids:    { bg: [10, 26, 26],    accent: [26, 188, 156],  secondary: [72, 201, 176],  highlight: [163, 228, 215] },
  veggie:  { bg: [10, 21, 8],     accent: [34, 153, 84],   secondary: [39, 174, 96],   highlight: [130, 224, 170] },
  crepe:   { bg: [26, 16, 10],    accent: [175, 96, 26],   secondary: [220, 118, 51],  highlight: [240, 178, 122] },
  generic: { bg: [15, 15, 26],    accent: [91, 44, 111],   secondary: [125, 60, 152],  highlight: [210, 180, 222] },
};

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
  return Math.abs(hash);
}

async function generateImage(name, category, label, subtitle) {
  const W = 300, H = 280;
  const palette = PALETTES[category] || PALETTES.generic;
  const h = hashStr(name);
  const hueShift = (h % 30) - 15;

  // Adjust palette with unique hue shift
  const shift = (c, s) => Math.max(0, Math.min(255, c + s));
  const bg = palette.bg.map((c, i) => shift(c, hueShift));
  const accent = palette.accent.map((c, i) => shift(c, hueShift));
  const secondary = palette.secondary.map((c, i) => shift(c, hueShift));
  const highlight = palette.highlight.map((c, i) => shift(c, hueShift));

  // Build SVG with unique elements based on hash
  const seed1 = h % 360;
  const seed2 = (h >> 8) % 360;
  const seed3 = (h >> 16) % 100;
  
  // Generate unique decorative circles
  let decorations = '';
  for (let i = 0; i < 3; i++) {
    const cx = 50 + ((h * (i + 1) * 7) % 200);
    const cy = 40 + ((h * (i + 1) * 13) % 180);
    const r = 15 + ((h * (i + 1) * 3) % 35);
    const opacity = 0.05 + ((h * (i + 1)) % 10) / 100;
    decorations += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgb(${accent.join(',')})" opacity="${opacity}"/>`;
  }
  
  // Unique diagonal lines
  for (let i = 0; i < 4; i++) {
    const y = 30 + i * 60 + (h % 30);
    decorations += `<line x1="0" y1="${y}" x2="${W}" y2="${y - 20}" stroke="rgb(${accent.join(',')})" stroke-width="0.5" opacity="0.06"/>`;
  }

  // Category-specific icon
  let icon = '';
  const ac = `rgb(${accent.join(',')})`;
  const sc = `rgb(${secondary.join(',')})`;
  const hc = `rgb(${highlight.join(',')})`;
  
  switch (category) {
    case 'meat':
      icon = `<ellipse cx="150" cy="130" rx="70" ry="25" fill="${ac}" opacity="0.25"/>
        <path d="M90 125 Q150 85 210 125 Q210 150 150 160 Q90 150 90 125Z" fill="${sc}" opacity="0.35"/>
        <line x1="120" y1="120" x2="120" y2="148" stroke="${hc}" stroke-width="2" opacity="0.3"/>
        <line x1="150" y1="115" x2="150" y2="152" stroke="${hc}" stroke-width="2" opacity="0.3"/>
        <line x1="180" y1="120" x2="180" y2="148" stroke="${hc}" stroke-width="2" opacity="0.3"/>`;
      break;
    case 'fish':
      icon = `<path d="M80 130 Q150 90 220 130 Q150 170 80 130Z" fill="${ac}" opacity="0.4"/>
        <path d="M220 130 L260 110 L260 150 Z" fill="${sc}" opacity="0.3"/>
        <circle cx="110" cy="125" r="6" fill="white" opacity="0.6"/>`;
      break;
    case 'soup':
      icon = `<ellipse cx="150" cy="140" rx="65" ry="20" fill="${ac}" opacity="0.25"/>
        <path d="M90 125 Q90 150 150 155 Q210 150 210 125" fill="${sc}" opacity="0.35"/>
        <path d="M130 105 Q128 90 130 80" stroke="white" stroke-width="2" fill="none" opacity="0.25"/>
        <path d="M150 100 Q148 85 150 75" stroke="white" stroke-width="2" fill="none" opacity="0.25"/>
        <path d="M170 105 Q168 90 170 80" stroke="white" stroke-width="2" fill="none" opacity="0.25"/>`;
      break;
    case 'salad':
      icon = `<ellipse cx="150" cy="135" rx="70" ry="30" fill="${ac}" opacity="0.25"/>
        <path d="M90 125 Q150 100 210 125 Q200 145 150 150 Q100 145 90 125Z" fill="${sc}" opacity="0.3"/>
        <circle cx="130" cy="125" r="7" fill="#e74c3c" opacity="0.4"/>
        <circle cx="170" cy="128" r="6" fill="#f39c12" opacity="0.4"/>`;
      break;
    case 'pasta':
      icon = `<path d="M100 110 Q120 150 100 170" stroke="${ac}" stroke-width="5" fill="none" opacity="0.5"/>
        <path d="M130 105 Q150 145 130 165" stroke="${sc}" stroke-width="5" fill="none" opacity="0.5"/>
        <path d="M160 110 Q180 150 160 170" stroke="${ac}" stroke-width="5" fill="none" opacity="0.5"/>
        <path d="M190 105 Q210 145 190 165" stroke="${sc}" stroke-width="5" fill="none" opacity="0.5"/>`;
      break;
    case 'pizza':
      icon = `<path d="M150 80 L230 170 L70 170 Z" fill="${ac}" opacity="0.3"/>
        <circle cx="140" cy="145" r="9" fill="#e74c3c" opacity="0.5"/>
        <circle cx="165" cy="155" r="7" fill="#27ae60" opacity="0.4"/>
        <circle cx="125" cy="160" r="6" fill="#f39c12" opacity="0.5"/>`;
      break;
    case 'burger':
      icon = `<ellipse cx="150" cy="105" rx="60" ry="14" fill="#daa520" opacity="0.5"/>
        <rect x="90" y="115" width="120" height="10" rx="4" fill="#6b3a1f" opacity="0.5"/>
        <rect x="90" y="125" width="120" height="7" rx="2" fill="#27ae60" opacity="0.4"/>
        <rect x="90" y="132" width="120" height="7" rx="2" fill="#e74c3c" opacity="0.4"/>
        <ellipse cx="150" cy="144" rx="60" ry="14" fill="#daa520" opacity="0.5"/>`;
      break;
    case 'wine':
      icon = `<path d="M130 85 L130 125 Q130 145 150 150 Q170 145 170 125 L170 85Z" fill="${ac}" opacity="0.35"/>
        <ellipse cx="150" cy="83" rx="22" ry="5" fill="${sc}" opacity="0.3"/>
        <rect x="145" y="70" width="10" height="18" rx="3" fill="${ac}" opacity="0.2"/>`;
      break;
    case 'beer':
      icon = `<rect x="120" y="90" width="60" height="75" rx="5" fill="${ac}" opacity="0.25"/>
        <rect x="125" y="108" width="50" height="52" rx="3" fill="${sc}" opacity="0.3"/>
        <ellipse cx="150" cy="108" rx="25" ry="8" fill="white" opacity="0.15"/>
        <path d="M180 105 L200 100 L200 130 L180 125" fill="${ac}" opacity="0.15"/>`;
      break;
    case 'spirit':
      icon = `<path d="M135 80 L135 110 Q135 130 150 135 Q165 130 165 110 L165 80Z" fill="${ac}" opacity="0.35"/>
        <rect x="143" y="65" width="14" height="20" rx="3" fill="${sc}" opacity="0.25"/>`;
      break;
    case 'hot':
      icon = `<path d="M110 120 L190 120 Q200 120 200 130 L200 145 Q200 155 190 155 L110 155 Q100 155 100 145 L100 130 Q100 120 110 120Z" fill="${ac}" opacity="0.4"/>
        <path d="M125 110 Q123 95 125 85" stroke="white" stroke-width="2" fill="none" opacity="0.2"/>
        <path d="M150 105 Q148 90 150 80" stroke="white" stroke-width="2" fill="none" opacity="0.2"/>
        <path d="M175 110 Q173 95 175 85" stroke="white" stroke-width="2" fill="none" opacity="0.2"/>`;
      break;
    case 'cold':
      icon = `<rect x="120" y="85" width="60" height="80" rx="5" fill="${ac}" opacity="0.25"/>
        <rect x="126" y="90" width="48" height="45" rx="3" fill="${sc}" opacity="0.2"/>
        <ellipse cx="150" cy="130" rx="15" ry="10" fill="white" opacity="0.1"/>`;
      break;
    case 'drink':
      icon = `<rect x="125" y="80" width="50" height="80" rx="5" fill="${ac}" opacity="0.25"/>
        <rect x="130" y="85" width="40" height="50" rx="3" fill="${sc}" opacity="0.2"/>
        <path d="M175 100 L195 95 L195 115 L175 110" fill="${ac}" opacity="0.15"/>`;
      break;
    case 'veggie':
      icon = `<path d="M150 85 Q185 105 150 150 Q115 105 150 85Z" fill="${ac}" opacity="0.3"/>
        <path d="M150 80 L150 95" stroke="${sc}" stroke-width="2" opacity="0.5"/>
        <path d="M150 85 Q140 80 135 85" stroke="${sc}" stroke-width="1.5" fill="none" opacity="0.4"/>`;
      break;
    case 'dessert':
    case 'crepe':
      icon = `<ellipse cx="150" cy="120" rx="65" ry="25" fill="${ac}" opacity="0.3"/>
        <ellipse cx="150" cy="120" rx="50" ry="18" fill="${sc}" opacity="0.2"/>
        <path d="M110 120 Q150 100 190 120" stroke="${hc}" stroke-width="1.5" fill="none" opacity="0.3"/>`;
      break;
    case 'kids':
      icon = `<circle cx="150" cy="120" r="35" fill="${ac}" opacity="0.2"/>
        <circle cx="138" cy="112" r="5" fill="${sc}" opacity="0.5"/>
        <circle cx="162" cy="112" r="5" fill="${sc}" opacity="0.5"/>
        <path d="M138 128 Q150 138 162 128" stroke="${sc}" stroke-width="2.5" fill="none" opacity="0.5"/>`;
      break;
    default:
      icon = `<circle cx="150" cy="125" r="35" fill="${ac}" opacity="0.2"/>
        <circle cx="150" cy="125" r="22" fill="${sc}" opacity="0.15"/>`;
  }

  // Build SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <radialGradient id="glow" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="rgb(${accent.join(',')})" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="rgb(${bg.join(',')})" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="rgb(${bg.join(',')})"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    ${decorations}
    <rect x="4" y="4" width="${W-8}" height="${H-8}" rx="12" fill="none" stroke="rgb(${accent.join(',')})" stroke-width="1" opacity="0.15"/>
    ${icon}
    <text x="${W/2}" y="${H-35}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="600" fill="rgb(${highlight.join(',')})" opacity="0.9">${escapeXml(label)}</text>
    ${subtitle ? `<text x="${W/2}" y="${H-18}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="10" fill="rgb(${highlight.join(',')})" opacity="0.5">${escapeXml(subtitle)}</text>` : ''}
    <line x1="90" y1="${H-28}" x2="210" y2="${H-28}" stroke="rgb(${accent.join(',')})" stroke-width="0.5" opacity="0.25"/>
  </svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return buffer;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// All duplicate items
const items = [
  { path: 'hrana/frito-misto.png', cat: 'fish', label: 'Frito misto', sub: 'Ocvrte morske dobrote' },
  { path: 'hrana/frito-misto-2.png', cat: 'fish', label: 'Frito misto', sub: 'Mešani ocvrti sadeži' },
  { path: 'hrana/goveja-juha-rezanci-2.png', cat: 'soup', label: 'Goveja juha', sub: 'Z rezanci' },
  { path: 'hrana/goveja-juha-rezanci-3.png', cat: 'soup', label: 'Goveja juha', sub: 'S tankimi rezanci' },
  { path: 'hrana/gobova-juha-2.png', cat: 'soup', label: 'Gobova juha', sub: 'Kremna' },
  { path: 'hrana/gobova-juha-3.png', cat: 'soup', label: 'Gobova juha', sub: 'Z jurčki' },
  { path: 'hrana/hobotnica-2.png', cat: 'fish', label: 'Hobotnica', sub: 'Na žaru' },
  { path: 'hrana/hobotnica-zar-3.png', cat: 'fish', label: 'Hobotnica', sub: 'Žar s česnom' },
  { path: 'hrana/hobotnica-solata-2.png', cat: 'salad', label: 'Hobotnica solata', sub: 'Z limono' },
  { path: 'hrana/hobotnica-solata-3.png', cat: 'salad', label: 'Hobotnica solata', sub: 'Mediterranska' },
  { path: 'hrana/losos-zar-2.png', cat: 'fish', label: 'Losos', sub: 'Na žaru' },
  { path: 'hrana/losos-zar-3.png', cat: 'fish', label: 'Losos', sub: 'Cedar plank' },
  { path: 'hrana/spageti-bolonjske-2.png', cat: 'pasta', label: 'Špageti', sub: 'Bolognese' },
  { path: 'hrana/spageti-bolonjske-3.png', cat: 'pasta', label: 'Bolognese', sub: 'Z mletim mesom' },
  { path: 'hrana/goveja-juha-jajce-2.png', cat: 'soup', label: 'Goveja juha', sub: 'Z jajcem' },
  { path: 'hrana/goveja-juha-jajce.png', cat: 'soup', label: 'Goveja juha', sub: 'S kuhanim jajcem' },
  { path: 'hrana/golaz-polenta-2.png', cat: 'meat', label: 'Golaž', sub: 'S polento' },
  { path: 'hrana/golaz-polenta-3.png', cat: 'meat', label: 'Goveji golaž', sub: 'S polento' },
  { path: 'hrana/ocvrti-sir-3.png', cat: 'veggie', label: 'Ocvrti sir', sub: 'S tatarsko omako' },
  { path: 'hrana/ocvrti-sir.png', cat: 'veggie', label: 'Ocvrti sir', sub: 'Paniran' },
  { path: 'hrana/mladi-sir-2.png', cat: 'veggie', label: 'Mladi sir', sub: 'Na žaru' },
  { path: 'hrana/mladi-sir-3.png', cat: 'veggie', label: 'Mladi sir', sub: 'Pečen' },
  { path: 'hrana/zelenjavna-juha-2.png', cat: 'soup', label: 'Zelenjavna juha', sub: 'Kremna' },
  { path: 'hrana/zelenjavna-juha-3.png', cat: 'soup', label: 'Zelenjavna juha', sub: 'S sezono' },
  { path: 'hrana/lignji-ocvrti-2.png', cat: 'fish', label: 'Ocvrti lignji', sub: 'Tempura' },
  { path: 'hrana/lignji-ocvrti.png', cat: 'fish', label: 'Lignji', sub: 'Ocvrti' },
  { path: 'hrana/cevapcici-2.png', cat: 'meat', label: 'Čevapčiči', sub: 'Z lepinjo' },
  { path: 'hrana/cevapcici-3.png', cat: 'meat', label: 'Čevapčiči', sub: 'S kajmakom' },
  { path: 'hrana/classic-burger-2.png', cat: 'burger', label: 'Classic burger', sub: 'Cheddar' },
  { path: 'hrana/classic-burger-3.png', cat: 'burger', label: 'Smash burger', sub: 'Brioche' },
  { path: 'hrana/mesana-solata-2.png', cat: 'salad', label: 'Mešana solata', sub: 'Zelenjavna' },
  { path: 'hrana/mesana-solata-3.png', cat: 'salad', label: 'Mešana solata', sub: 'Sezonska' },
  { path: 'priloge/ocvrte-bucke.png', cat: 'veggie', label: 'Ocvrte bučke', sub: 'Priloga' },
  { path: 'vegetarijanske-jedi/ocvrte-bucke.png', cat: 'veggie', label: 'Ocvrte bučke', sub: 'Fritti' },
  { path: 'priloge/pecena-zelenjava.png', cat: 'veggie', label: 'Pečena zelenjava', sub: 'Priloga' },
  { path: 'vegetarijanske-jedi/pecena-zelenjava-rukola.png', cat: 'veggie', label: 'Pečena zelenjava', sub: 'Na rukoli' },
  { path: 'topli-napitki/icon.png', cat: 'hot', label: 'Topli napitki', sub: 'Izbira' },
  { path: 'topli-napitki/kava-s-smetano.png', cat: 'hot', label: 'Kava s smetano', sub: 'Kava' },
  { path: 'destilati/icon.png', cat: 'spirit', label: 'Destilati', sub: 'Konjak & Rum' },
  { path: 'destilati/rum-hechicera.png', cat: 'spirit', label: 'La Hechicera', sub: 'Rum' },
  { path: 'viski/icon.png', cat: 'spirit', label: 'Viski', sub: 'Izbira' },
  { path: 'viski/nikka-barrel.png', cat: 'spirit', label: 'Nikka Barrel', sub: 'Japonski viski' },
  { path: 'brezalk-pivo/icon.png', cat: 'beer', label: 'Brezalk. pivo', sub: 'Izbira' },
  { path: 'brezalk-pivo/daura.png', cat: 'beer', label: 'Daura', sub: 'Brezalkoholno' },
  { path: 'brezalk-pivo/heineken-00.png', cat: 'beer', label: 'Heineken 0.0', sub: 'Brezalkoholno' },
  { path: 'sokovi/icon.png', cat: 'cold', label: 'Sokovi', sub: 'Izbira' },
  { path: 'sokovi/jabolcni-sok.png', cat: 'cold', label: 'Jabolčni sok', sub: 'Naravni' },
  { path: 'rose-vino/icon.png', cat: 'wine', label: 'Rosé vino', sub: 'Izbira' },
  { path: 'rose-vino/rose-verstovsek.png', cat: 'wine', label: 'Verstovšek', sub: 'Rosé' },
  { path: 'grencice/icon.png', cat: 'spirit', label: 'Grenčice', sub: 'Izbira' },
  { path: 'grencice/aperol.png', cat: 'drink', label: 'Aperol', sub: 'Aperitiv' },
  { path: 'grencice/campari.png', cat: 'drink', label: 'Campari', sub: 'Bitter' },
  { path: 'pivo/icon.png', cat: 'beer', label: 'Pivo', sub: 'Izbira' },
  { path: 'pivo/reset-froggy.png', cat: 'beer', label: 'Froggy IPA', sub: 'Craft' },
  { path: 'pivo/reset-stout.png', cat: 'beer', label: 'Irish Stout', sub: 'Craft' },
];

async function main() {
  let generated = 0;
  let failed = 0;

  console.log(`\n🖼️  Generating ${items.length} unique PNG images for duplicates\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fullPath = path.join(MENU_DIR, item.path);
    ensureDir(fullPath);

    try {
      const buffer = await generateImage(item.path, item.cat, item.label, item.sub);
      fs.writeFileSync(fullPath, buffer);
      generated++;
      console.log(`✓ [${i+1}/${items.length}] ${item.path} (${(buffer.length/1024).toFixed(1)}KB)`);
    } catch (err) {
      failed++;
      console.error(`✗ [${i+1}/${items.length}] ${item.path}: ${err.message}`);
    }
  }

  console.log(`\n📊 Done: ${generated} generated, ${failed} failed`);
  
  // Verify no more duplicates
  console.log('\n🔍 Verifying duplicates...');
  const result = execSync(`cd ${MENU_DIR} && find . -name "*.png" -type f -exec md5sum {} \\; 2>/dev/null | sort -k1,1 | awk '{hash=$1; count[hash]++} END {dups=0; for (h in count) if (count[h] > 1) dups+=count[h]; print "Duplicate files remaining: " dups}'`);
  console.log(result.toString().trim());
}

main().catch(console.error);
