#!/usr/bin/env node
/**
 * Generate unique professional SVG menu images for all duplicate items.
 * Each image gets a unique visual design with distinct colors, shapes, and labels.
 */
import * as fs from 'fs';
import * as path from 'path';

const MENU_DIR = '/home/z/my-project/public/menu-images';

// Ensure directories exist
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Color palettes for different food types
const PALETTES = {
  meat: { bg: '#1a0a0a', accent: '#c0392b', secondary: '#e74c3c', highlight: '#f5b7b1' },
  fish: { bg: '#0a1a2a', accent: '#2980b9', secondary: '#3498db', highlight: '#aed6f1' },
  pasta: { bg: '#1a1508', accent: '#d4a017', secondary: '#f1c40f', highlight: '#f9e79f' },
  salad: { bg: '#0a1a0a', accent: '#27ae60', secondary: '#2ecc71', highlight: '#abebc6' },
  soup: { bg: '#1a1208', accent: '#e67e22', secondary: '#f39c12', highlight: '#fad7a0' },
  dessert: { bg: '#1a0a18', accent: '#c0392b', secondary: '#e74c3c', highlight: '#f5b7b1' },
  pizza: { bg: '#1a0f08', accent: '#d35400', secondary: '#e67e22', highlight: '#fad7a0' },
  burger: { bg: '#1a1208', accent: '#b8860b', secondary: '#daa520', highlight: '#f0e68c' },
  drink: { bg: '#0a0a1a', accent: '#8e44ad', secondary: '#9b59b6', highlight: '#d7bde2' },
  hot: { bg: '#1a0f0a', accent: '#a0522d', secondary: '#cd853f', highlight: '#deb887' },
  cold: { bg: '#0a1520', accent: '#5dade2', secondary: '#85c1e9', highlight: '#d4e6f1' },
  wine: { bg: '#1a0a10', accent: '#7b241c', secondary: '#a93226', highlight: '#d98880' },
  beer: { bg: '#1a1508', accent: '#d4a017', secondary: '#f1c40f', highlight: '#f9e79f' },
  spirit: { bg: '#120a1a', accent: '#6c3483', secondary: '#8e44ad', highlight: '#d2b4de' },
  kids: { bg: '#0a1a1a', accent: '#1abc9c', secondary: '#48c9b0', highlight: '#a3e4d7' },
  veggie: { bg: '#0a1508', accent: '#229954', secondary: '#27ae60', highlight: '#82e0aa' },
  crepe: { bg: '#1a100a', accent: '#af601a', secondary: '#dc7633', highlight: '#f0b27a' },
  generic: { bg: '#0f0f1a', accent: '#5b2c6f', secondary: '#7d3c98', highlight: '#d2b4de' },
};

// SVG icon shapes for different food types
function getFoodIcon(type, accent, secondary) {
  const icons = {
    meat: `<ellipse cx="150" cy="180" rx="80" ry="30" fill="${accent}" opacity="0.3"/>
      <path d="M80 170 Q150 120 220 170 Q220 200 150 210 Q80 200 80 170Z" fill="${accent}" opacity="0.6"/>
      <line x1="110" y1="170" x2="110" y2="195" stroke="${secondary}" stroke-width="2" opacity="0.5"/>
      <line x1="150" y1="165" x2="150" y2="200" stroke="${secondary}" stroke-width="2" opacity="0.5"/>
      <line x1="190" y1="170" x2="190" y2="195" stroke="${secondary}" stroke-width="2" opacity="0.5"/>`,
    fish: `<path d="M80 180 Q150 140 220 180 Q150 220 80 180Z" fill="${accent}" opacity="0.5"/>
      <path d="M220 180 L260 160 L260 200 Z" fill="${secondary}" opacity="0.4"/>
      <circle cx="110" cy="175" r="5" fill="white" opacity="0.7"/>`,
    pasta: `<path d="M100 160 Q120 200 100 220" stroke="${accent}" stroke-width="4" fill="none" opacity="0.6"/>
      <path d="M130 155 Q150 195 130 215" stroke="${secondary}" stroke-width="4" fill="none" opacity="0.6"/>
      <path d="M160 160 Q180 200 160 220" stroke="${accent}" stroke-width="4" fill="none" opacity="0.6"/>
      <path d="M190 155 Q210 195 190 215" stroke="${secondary}" stroke-width="4" fill="none" opacity="0.6"/>`,
    salad: `<ellipse cx="150" cy="185" rx="75" ry="35" fill="${accent}" opacity="0.25"/>
      <path d="M90 175 Q150 145 210 175 Q200 195 150 200 Q100 195 90 175Z" fill="${secondary}" opacity="0.3"/>
      <circle cx="130" cy="175" r="6" fill="${accent}" opacity="0.5"/>
      <circle cx="170" cy="178" r="5" fill="#e74c3c" opacity="0.4"/>`,
    soup: `<ellipse cx="150" cy="190" rx="70" ry="25" fill="${accent}" opacity="0.3"/>
      <path d="M90 175 Q90 195 150 200 Q210 195 210 175" fill="${secondary}" opacity="0.4"/>
      <path d="M130 155 Q128 145 130 135" stroke="white" stroke-width="1.5" fill="none" opacity="0.3"/>
      <path d="M150 150 Q148 140 150 130" stroke="white" stroke-width="1.5" fill="none" opacity="0.3"/>
      <path d="M170 155 Q168 145 170 135" stroke="white" stroke-width="1.5" fill="none" opacity="0.3"/>`,
    dessert: `<path d="M120 190 L150 140 L180 190 Z" fill="${accent}" opacity="0.4"/>
      <circle cx="150" cy="140" r="8" fill="${secondary}" opacity="0.6"/>
      <rect x="140" y="190" width="20" height="10" rx="2" fill="${accent}" opacity="0.3"/>`,
    pizza: `<path d="M150 120 L220 210 L80 210 Z" fill="${accent}" opacity="0.35"/>
      <circle cx="140" cy="180" r="8" fill="#e74c3c" opacity="0.5"/>
      <circle cx="165" cy="195" r="6" fill="#27ae60" opacity="0.4"/>
      <circle cx="125" cy="200" r="5" fill="#f39c12" opacity="0.5"/>`,
    burger: `<ellipse cx="150" cy="155" rx="65" ry="15" fill="#daa520" opacity="0.5"/>
      <rect x="85" y="165" width="130" height="12" rx="4" fill="#6b3a1f" opacity="0.5"/>
      <rect x="85" y="177" width="130" height="8" rx="2" fill="#27ae60" opacity="0.4"/>
      <rect x="85" y="185" width="130" height="8" rx="2" fill="#e74c3c" opacity="0.4"/>
      <ellipse cx="150" cy="198" rx="65" ry="15" fill="#daa520" opacity="0.5"/>`,
    drink: `<rect x="125" y="130" width="50" height="80" rx="5" fill="${accent}" opacity="0.25"/>
      <rect x="130" y="135" width="40" height="50" rx="3" fill="${secondary}" opacity="0.2"/>
      <path d="M175 150 L195 145 L195 165 L175 160" fill="${accent}" opacity="0.15"/>`,
    hot: `<path d="M110 180 L190 180 Q200 180 200 190 L200 200 Q200 210 190 210 L110 210 Q100 210 100 200 L100 190 Q100 180 110 180Z" fill="${accent}" opacity="0.4"/>
      <path d="M125 170 Q123 158 125 148" stroke="white" stroke-width="1.5" fill="none" opacity="0.25"/>
      <path d="M150 165 Q148 153 150 143" stroke="white" stroke-width="1.5" fill="none" opacity="0.25"/>
      <path d="M175 170 Q173 158 175 148" stroke="white" stroke-width="1.5" fill="none" opacity="0.25"/>`,
    wine: `<path d="M130 130 L130 175 Q130 195 150 200 Q170 195 170 175 L170 130Z" fill="${accent}" opacity="0.3"/>
      <ellipse cx="150" cy="128" rx="22" ry="5" fill="${secondary}" opacity="0.3"/>
      <rect x="145" y="115" width="10" height="18" rx="3" fill="${accent}" opacity="0.2"/>`,
    beer: `<rect x="120" y="135" width="60" height="80" rx="5" fill="${accent}" opacity="0.25"/>
      <rect x="125" y="155" width="50" height="55" rx="3" fill="${secondary}" opacity="0.3"/>
      <ellipse cx="150" cy="155" rx="25" ry="8" fill="white" opacity="0.15"/>
      <path d="M180 150 L200 145 L200 175 L180 170" fill="${accent}" opacity="0.15"/>`,
    spirit: `<path d="M135 125 L135 155 Q135 175 150 180 Q165 175 165 155 L165 125Z" fill="${accent}" opacity="0.3"/>
      <rect x="143" y="110" width="14" height="20" rx="3" fill="${secondary}" opacity="0.25"/>`,
    kids: `<circle cx="150" cy="170" r="40" fill="${accent}" opacity="0.2"/>
      <circle cx="138" cy="162" r="4" fill="${secondary}" opacity="0.5"/>
      <circle cx="162" cy="162" r="4" fill="${secondary}" opacity="0.5"/>
      <path d="M138 178 Q150 188 162 178" stroke="${secondary}" stroke-width="2" fill="none" opacity="0.5"/>`,
    veggie: `<path d="M150 140 Q180 160 150 200 Q120 160 150 140Z" fill="${accent}" opacity="0.3"/>
      <path d="M150 135 L150 145" stroke="${secondary}" stroke-width="2" opacity="0.5"/>
      <path d="M150 140 Q140 135 135 140" stroke="${secondary}" stroke-width="1.5" fill="none" opacity="0.4"/>`,
    crepe: `<ellipse cx="150" cy="175" rx="70" ry="30" fill="${accent}" opacity="0.3"/>
      <ellipse cx="150" cy="175" rx="55" ry="22" fill="${secondary}" opacity="0.2"/>
      <path d="M100 175 Q150 155 200 175" stroke="${accent}" stroke-width="1" fill="none" opacity="0.3"/>`,
    generic: `<circle cx="150" cy="175" r="40" fill="${accent}" opacity="0.2"/>
      <circle cx="150" cy="175" r="25" fill="${secondary}" opacity="0.15"/>`,
  };
  return icons[type] || icons.generic;
}

function generateSVG(name, category, label, subtitle) {
  const palette = PALETTES[category] || PALETTES.generic;
  const icon = getFoodIcon(category, palette.accent, palette.secondary);
  
  // Create unique hue shift based on name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  const hueShift = (hash % 40) - 20;
  
  // Unique pattern based on name
  const patternId = `pat-${name.replace(/[^a-z0-9]/gi, '')}`;
  const patternLines = [];
  for (let i = 0; i < 6; i++) {
    const y = 50 + i * 40 + (hash % 20);
    patternLines.push(`<line x1="0" y1="${y}" x2="300" y2="${y - 15}" stroke="${palette.accent}" stroke-width="0.5" opacity="0.08"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 280" width="300" height="280">
  <defs>
    <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="300" height="280">
      <rect width="300" height="280" fill="${palette.bg}"/>
      ${patternLines.join('\n      ')}
    </pattern>
    <radialGradient id="glow-${name.replace(/[^a-z0-9]/gi, '')}" cx="50%" cy="55%" r="50%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${palette.bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  
  <!-- Background -->
  <rect width="300" height="280" fill="url(#${patternId})"/>
  <rect width="300" height="280" fill="url(#glow-${name.replace(/[^a-z0-9]/gi, '')})"/>
  
  <!-- Decorative border -->
  <rect x="4" y="4" width="292" height="272" rx="12" fill="none" stroke="${palette.accent}" stroke-width="1" opacity="0.2"/>
  
  <!-- Food icon -->
  ${icon}
  
  <!-- Label -->
  <text x="150" y="240" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="${palette.highlight}" opacity="0.9">${escapeXml(label)}</text>
  ${subtitle ? `<text x="150" y="258" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${palette.highlight}" opacity="0.5">${escapeXml(subtitle)}</text>` : ''}
  
  <!-- Accent line -->
  <line x1="100" y1="248" x2="200" y2="248" stroke="${palette.accent}" stroke-width="0.5" opacity="0.3"/>
</svg>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// All duplicate items that need regeneration
const items = [
  // HRANA duplicates
  { path: 'hrana/frito-misto.png', cat: 'fish', label: 'Frito misto', sub: 'Ocvrte morske dobrote' },
  { path: 'hrana/frito-misto-2.png', cat: 'fish', label: 'Frito misto', sub: 'Mešani ocvrti morski sadeži' },
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
  { path: 'hrana/golaz-polenta-3.png', cat: 'meat', label: 'Goveji golaž', sub: 'Polenta' },
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

  // PRILOGE/VEGETARIJANSKE duplicates
  { path: 'priloge/ocvrte-bucke.png', cat: 'veggie', label: 'Ocvrte bučke', sub: 'Priloga' },
  { path: 'vegetarijanske-jedi/ocvrte-bucke.png', cat: 'veggie', label: 'Ocvrte bučke', sub: 'Fritti' },
  { path: 'priloge/pecena-zelenjava.png', cat: 'veggie', label: 'Pečena zelenjava', sub: 'Priloga' },
  { path: 'vegetarijanske-jedi/pecena-zelenjava-rukola.png', cat: 'veggie', label: 'Pečena zelenjava', sub: 'Na rukoli' },

  // TOPLI NAPITKI
  { path: 'topli-napitki/icon.png', cat: 'hot', label: 'Topli napitki', sub: 'Izbira' },
  { path: 'topli-napitki/kava-s-smetano.png', cat: 'hot', label: 'Kava s smetano', sub: 'Kava' },

  // DESTILATI
  { path: 'destilati/icon.png', cat: 'spirit', label: 'Destilati', sub: 'Konjak & Rum' },
  { path: 'destilati/rum-hechicera.png', cat: 'spirit', label: 'La Hechicera', sub: 'Rum' },

  // VISKI
  { path: 'viski/icon.png', cat: 'spirit', label: 'Viski', sub: 'Izbira' },
  { path: 'viski/nikka-barrel.png', cat: 'spirit', label: 'Nikka Barrel', sub: 'Japonski viski' },

  // BREZALKOHOLNO PIVO - 3 identical!
  { path: 'brezalk-pivo/icon.png', cat: 'beer', label: 'Brezalk. pivo', sub: 'Izbira' },
  { path: 'brezalk-pivo/daura.png', cat: 'beer', label: 'Daura', sub: 'Brezalkoholno' },
  { path: 'brezalk-pivo/heineken-00.png', cat: 'beer', label: 'Heineken 0.0', sub: 'Brezalkoholno' },

  // SOKOVI
  { path: 'sokovi/icon.png', cat: 'cold', label: 'Sokovi', sub: 'Izbira' },
  { path: 'sokovi/jabolcni-sok.png', cat: 'cold', label: 'Jabolčni sok', sub: 'Naravni' },

  // ROSE VINO
  { path: 'rose-vino/icon.png', cat: 'wine', label: 'Rosé vino', sub: 'Izbira' },
  { path: 'rose-vino/rose-verstovsek.png', cat: 'wine', label: 'Verstovšek', sub: 'Rosé' },

  // GRENCICE - 3 identical!
  { path: 'grencice/icon.png', cat: 'spirit', label: 'Grenčice', sub: 'Izbira' },
  { path: 'grencice/aperol.png', cat: 'drink', label: 'Aperol', sub: 'Aperitiv' },
  { path: 'grencice/campari.png', cat: 'drink', label: 'Campari', sub: 'Bitter' },

  // PIVO - 3 identical!
  { path: 'pivo/icon.png', cat: 'beer', label: 'Pivo', sub: 'Izbira' },
  { path: 'pivo/reset-froggy.png', cat: 'beer', label: 'Froggy IPA', sub: 'Craft' },
  { path: 'pivo/reset-stout.png', cat: 'beer', label: 'Irish Stout', sub: 'Craft' },
];

async function main() {
  let generated = 0;
  let failed = 0;

  console.log(`\n🖼️  Generating ${items.length} unique SVG images for duplicates\n`);

  for (const item of items) {
    const fullPath = path.join(MENU_DIR, item.path);
    ensureDir(fullPath);

    try {
      const svg = generateSVG(
        item.path.replace(/\//g, '-').replace('.png', ''),
        item.cat,
        item.label,
        item.sub
      );
      fs.writeFileSync(fullPath, svg);
      generated++;
      console.log(`✓ ${item.path}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${item.path}: ${err.message}`);
    }
  }

  console.log(`\n📊 Done: ${generated} generated, ${failed} failed`);
}

main().catch(console.error);
