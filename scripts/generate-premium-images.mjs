#!/usr/bin/env node
/**
 * Generate PREMIUM professional menu item images.
 * Each image is a beautiful, modern product card with:
 *   - Rich gradient backgrounds with subtle texture
 *   - Detailed SVG product illustrations per category
 *   - Professional typography with item name & subtitle
 *   - Category-specific color themes and decorative elements
 *   - Glass reflections, shadows, and depth effects
 *
 * No external API needed! Uses only Sharp + SVG.
 *
 * Usage: node scripts/generate-premium-images.mjs [--force]
 *   --force : Overwrite all images, even already-upgraded ones (>30KB)
 */

import { writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';

const W = 400, H = 500;
const FORCE = process.argv.includes('--force');
const MIN_AI_SIZE = 30000;

// ═══════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════

function hashStr(s) {
  return createHash('md5').update(s).digest('hex');
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function lighten(hex, amt = 0.3) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

function darken(hex, amt = 0.3) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

function withAlpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ═══════════════════════════════════════════════
// CATEGORY COLOR PALETTES
// ═══════════════════════════════════════════════

const PALETTES = {
  wine: {
    bg1: '#1a0a1e', bg2: '#2d1028',
    accent: '#8b2252', liquid: '#722f37',
    highlight: '#d4a574', glow: '#c97070'
  },
  redWine: {
    bg1: '#1a0508', bg2: '#2d0810',
    accent: '#8b0000', liquid: '#722f37',
    highlight: '#d4a574', glow: '#c94040'
  },
  whiteWine: {
    bg1: '#1a1505', bg2: '#2d2208',
    accent: '#c9a227', liquid: '#e8d870',
    highlight: '#f0e68c', glow: '#d4b040'
  },
  rose: {
    bg1: '#1e0815', bg2: '#2d1020',
    accent: '#e75480', liquid: '#f0a0b0',
    highlight: '#f5c0d0', glow: '#e08090'
  },
  beer: {
    bg1: '#1a1005', bg2: '#2d1a08',
    accent: '#d4a017', liquid: '#d8a830',
    highlight: '#f0d870', glow: '#c89020'
  },
  darkBeer: {
    bg1: '#0d0805', bg2: '#1a0f08',
    accent: '#6b3a20', liquid: '#3a1a10',
    highlight: '#b08060', glow: '#804020'
  },
  spirit: {
    bg1: '#0d0d10', bg2: '#1a1a22',
    accent: '#6a5acd', liquid: '#9090c0',
    highlight: '#c0b0e0', glow: '#8070b0'
  },
  whiskey: {
    bg1: '#120805', bg2: '#221008',
    accent: '#b8860b', liquid: '#a06020',
    highlight: '#e0c080', glow: '#c08030'
  },
  gin: {
    bg1: '#050d10', bg2: '#081a1e',
    accent: '#4682b4', liquid: '#a0c8d8',
    highlight: '#d0e8f0', glow: '#6090b0'
  },
  cocktail: {
    bg1: '#10050d', bg2: '#1e0a18',
    accent: '#dc143c', liquid: '#e04060',
    highlight: '#f0b0c0', glow: '#d03050'
  },
  coffee: {
    bg1: '#120a05', bg2: '#221408',
    accent: '#8b4513', liquid: '#6b3a20',
    highlight: '#d2b48c', glow: '#a07040'
  },
  cocoa: {
    bg1: '#0d0505', bg2: '#1a0a08',
    accent: '#3a1a0a', liquid: '#503018',
    highlight: '#b08060', glow: '#804020'
  },
  softDrink: {
    bg1: '#050d08', bg2: '#081a10',
    accent: '#32cd32', liquid: '#a0d040',
    highlight: '#c0e8a0', glow: '#60b040'
  },
  water: {
    bg1: '#050a10', bg2: '#081520',
    accent: '#4682b4', liquid: '#a0d0e0',
    highlight: '#d0e8f0', glow: '#60a0c0'
  },
  juice: {
    bg1: '#100a05', bg2: '#1e1508',
    accent: '#ff8c00', liquid: '#e0a030',
    highlight: '#f0d080', glow: '#d08020'
  },
  bitter: {
    bg1: '#0d0805', bg2: '#1a1008',
    accent: '#cc0000', liquid: '#a01010',
    highlight: '#e0a060', glow: '#c03030'
  },
  liqueur: {
    bg1: '#0d0508', bg2: '#1a0810',
    accent: '#9370db', liquid: '#c090d0',
    highlight: '#e0c0f0', glow: '#a070c0'
  },
  dessertWine: {
    bg1: '#1a0d05', bg2: '#2d1a08',
    accent: '#daa520', liquid: '#d0a040',
    highlight: '#f0d880', glow: '#c09030'
  }
};

// ═══════════════════════════════════════════════
// DETAILED PRODUCT ILLUSTRATIONS
// ═══════════════════════════════════════════════

function wineBottleDetailed(palette, label, seed) {
  const offX = 0; const offY = 0;
  const uniqueAngle = (seed % 3) - 1; // -1, 0, 1

  return `
  <g transform="translate(${offX}, ${offY})">
    <!-- Surface reflection -->
    <ellipse cx="200" cy="435" rx="80" ry="6" fill="${palette.glow}" opacity="0.06"/>

    <!-- Shadow on surface -->
    <ellipse cx="200" cy="430" rx="45" ry="7" fill="rgba(0,0,0,0.35)"/>

    <!-- Bottle body -->
    <path d="M172,155 L172,400 Q172,418 185,418 L215,418 Q228,418 228,400 L228,155 Q228,138 218,128 L218,95 Q218,80 212,75 L212,58 Q212,48 207,45 L193,45 Q188,48 188,58 L188,75 Q182,80 182,95 L182,128 Q172,138 172,155 Z"
          fill="url(#bottleGrad-${seed})" stroke="${darken(palette.accent, 0.5)}" stroke-width="0.8"/>

    <!-- Liquid visible through glass -->
    <path d="M175,165 L175,397 Q175,415 187,415 L213,415 Q225,415 225,397 L225,165 Q225,148 215,138 L215,98 Q215,84 209,79 L191,79 Q185,84 185,98 L185,138 Q175,148 175,165 Z"
          fill="${palette.liquid}" opacity="0.35"/>

    <!-- Glass highlight - left side -->
    <path d="M177,160 L177,395 Q177,405 180,408 L180,165 Q177,155 177,160 Z"
          fill="rgba(255,255,255,0.14)"/>

    <!-- Glass highlight - thin line -->
    <rect x="196" y="50" width="3" height="110" rx="1.5" fill="rgba(255,255,255,0.08)"/>

    <!-- Cork -->
    <rect x="191" y="38" width="18" height="10" rx="3" fill="#c4a67a" stroke="#8b6914" stroke-width="0.5"/>
    <line x1="195" y1="40" x2="195" y2="46" stroke="#a08050" stroke-width="0.4"/>
    <line x1="200" y1="39" x2="200" y2="47" stroke="#a08050" stroke-width="0.4"/>
    <line x1="205" y1="40" x2="205" y2="46" stroke="#a08050" stroke-width="0.4"/>

    <!-- Foil capsule -->
    <rect x="187" y="44" width="26" height="8" rx="2" fill="${darken(palette.accent, 0.2)}" stroke="${darken(palette.accent, 0.4)}" stroke-width="0.4"/>
    <line x1="190" y1="46" x2="210" y2="46" stroke="${lighten(palette.accent, 0.3)}" stroke-width="0.3"/>

    <!-- Main label -->
    <rect x="178" y="210" width="44" height="100" rx="4" fill="rgba(255,255,255,0.92)" stroke="${darken(palette.accent, 0.3)}" stroke-width="0.6"/>

    <!-- Label decorative border -->
    <rect x="181" y="213" width="38" height="94" rx="3" fill="none" stroke="${palette.accent}" stroke-width="0.4" opacity="0.3"/>

    <!-- Label top emblem -->
    <circle cx="200" cy="228" r="8" fill="none" stroke="${palette.accent}" stroke-width="0.6" opacity="0.5"/>
    <text x="200" y="232" text-anchor="middle" fill="${palette.accent}" font-size="7" font-weight="bold" font-family="Georgia,serif" opacity="0.6">${label.slice(0, 2).toUpperCase()}</text>

    <!-- Label text - name -->
    <text x="200" y="252" text-anchor="middle" fill="${darken(palette.accent, 0.5)}" font-size="7" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 8)}</text>
    <text x="200" y="264" text-anchor="middle" fill="${darken(palette.accent, 0.3)}" font-size="5.5" font-family="Georgia,serif">${label.slice(9, 20)}</text>

    <!-- Label decorative line -->
    <line x1="185" y1="272" x2="215" y2="272" stroke="${palette.accent}" stroke-width="0.5" opacity="0.4"/>

    <!-- Label vintage -->
    <text x="200" y="284" text-anchor="middle" fill="${darken(palette.accent, 0.25)}" font-size="5" font-family="Georgia,serif">VINTAGE</text>

    <!-- Label bottom detail -->
    <text x="200" y="298" text-anchor="middle" fill="${darken(palette.accent, 0.2)}" font-size="4" font-family="Georgia,serif">SLOVENIJA</text>

    <!-- Back label (partially visible) -->
    <rect x="182" y="330" width="36" height="30" rx="2" fill="rgba(255,255,255,0.15)"/>

    <!-- Bottle base ring -->
    <ellipse cx="200" cy="418" rx="21" ry="3" fill="${darken(palette.accent, 0.4)}" opacity="0.5"/>
  </g>`;
}

function beerGlassDetailed(palette, label, seed) {
  return `
  <g>
    <!-- Surface reflection -->
    <ellipse cx="200" cy="435" rx="80" ry="6" fill="${palette.glow}" opacity="0.06"/>

    <!-- Shadow -->
    <ellipse cx="205" cy="430" rx="55" ry="7" fill="rgba(0,0,0,0.3)"/>

    <!-- Glass body -->
    <path d="M155,120 L155,390 Q155,410 175,410 L225,410 Q245,410 245,390 L245,120 Z"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>

    <!-- Liquid -->
    <path d="M158,160 L158,387 Q158,407 177,407 L223,407 Q242,407 242,387 L242,160 Z"
          fill="${palette.liquid}" opacity="0.5"/>

    <!-- Foam head - layered bubbles -->
    <ellipse cx="200" cy="155" rx="42" ry="16" fill="#f5f0e0" opacity="0.88"/>
    <ellipse cx="183" cy="149" rx="17" ry="12" fill="#faf5e5" opacity="0.92"/>
    <ellipse cx="217" cy="147" rx="15" ry="13" fill="#faf5e5" opacity="0.92"/>
    <ellipse cx="200" cy="143" rx="13" ry="9" fill="#fdf8f0" opacity="0.9"/>
    <ellipse cx="170" cy="153" rx="10" ry="8" fill="#f8f3e8" opacity="0.85"/>
    <ellipse cx="230" cy="151" rx="11" ry="9" fill="#f8f3e8" opacity="0.85"/>

    <!-- Carbonation bubbles -->
    ${Array.from({length: 12}, (_, i) => {
      const bx = 170 + ((seed * (i+1) * 7 + i * 37) % 60);
      const by = 200 + ((seed * (i+1) * 13 + i * 23) % 180);
      const br = 0.8 + ((seed * (i+1)) % 3);
      return `<circle cx="${bx}" cy="${by}" r="${br}" fill="rgba(255,255,255,0.35)"/>`;
    }).join('\n    ')}

    <!-- Glass highlight - left -->
    <path d="M160,160 L160,385 Q160,395 165,398 L165,165 Z" fill="rgba(255,255,255,0.12)"/>

    <!-- Handle -->
    <path d="M245,175 Q285,175 285,230 L285,310 Q285,370 245,370"
          fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="6" stroke-linecap="round"/>
    <path d="M245,180 Q280,180 280,230 L280,305 Q280,365 245,365"
          fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3" stroke-linecap="round"/>

    <!-- Condensation drops on glass -->
    ${Array.from({length: 5}, (_, i) => {
      const dx = 165 + ((seed * (i+2) * 11) % 70);
      const dy = 180 + ((seed * (i+2) * 17) % 200);
      return `<ellipse cx="${dx}" cy="${dy}" rx="2" ry="3" fill="rgba(255,255,255,0.12)"/>`;
    }).join('\n    ')}

    <!-- Label on glass -->
    <text x="200" y="270" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-size="11" font-weight="bold" font-family="Arial,sans-serif">${label.slice(0, 11)}</text>
    <text x="200" y="288" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="7" font-family="Arial,sans-serif">${label.slice(12, 24)}</text>
  </g>`;
}

function spiritBottleDetailed(palette, label, seed) {
  return `
  <g>
    <!-- Surface glow -->
    <ellipse cx="200" cy="435" rx="70" ry="6" fill="${palette.glow}" opacity="0.06"/>

    <!-- Shadow -->
    <ellipse cx="200" cy="430" rx="38" ry="6" fill="rgba(0,0,0,0.3)"/>

    <!-- Bottle body - elegant slim shape -->
    <path d="M180,140 L180,400 Q180,418 190,418 L210,418 Q220,418 220,400 L220,140 Q220,123 213,113 L213,85 Q213,73 208,68 L208,52 Q208,42 203,40 L197,40 Q192,42 192,52 L192,68 Q187,73 187,85 L187,113 Q180,123 180,140 Z"
          fill="url(#bottleGrad-${seed})" stroke="${darken(palette.accent, 0.5)}" stroke-width="0.8"/>

    <!-- Liquid -->
    <path d="M182,145 L182,397 Q182,415 191,415 L209,415 Q218,415 218,397 L218,145 Q218,128 211,118 L211,88 Q211,77 206,72 L194,72 Q189,77 189,88 L189,118 Q182,128 182,145 Z"
          fill="${palette.liquid}" opacity="0.4"/>

    <!-- Glass highlight -->
    <path d="M185,145 L185,393 Q185,403 188,406 L188,150 Q185,140 185,145 Z"
          fill="rgba(255,255,255,0.12)"/>
    <rect x="197" y="45" width="3" height="70" rx="1.5" fill="rgba(255,255,255,0.08)"/>

    <!-- Cap -->
    <rect x="193" y="34" width="14" height="9" rx="2" fill="${darken(palette.accent, 0.15)}" stroke="${darken(palette.accent, 0.3)}" stroke-width="0.5"/>

    <!-- Label -->
    <rect x="184" y="215" width="32" height="80" rx="3" fill="rgba(255,255,255,0.9)" stroke="${darken(palette.accent, 0.2)}" stroke-width="0.5"/>

    <!-- Label detail -->
    <rect x="186" y="217" width="28" height="76" rx="2" fill="none" stroke="${palette.accent}" stroke-width="0.3" opacity="0.3"/>

    <!-- Label text -->
    <text x="200" y="238" text-anchor="middle" fill="${darken(palette.accent, 0.5)}" font-size="6.5" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 7)}</text>
    <text x="200" y="250" text-anchor="middle" fill="${darken(palette.accent, 0.3)}" font-size="5" font-family="Georgia,serif">${label.slice(8, 18)}</text>
    <line x1="189" y1="258" x2="211" y2="258" stroke="${palette.accent}" stroke-width="0.3" opacity="0.4"/>
    <text x="200" y="270" text-anchor="middle" fill="${darken(palette.accent, 0.25)}" font-size="4" font-family="Georgia,serif">PREMIUM</text>
    <text x="200" y="282" text-anchor="middle" fill="${darken(palette.accent, 0.2)}" font-size="3.5" font-family="Georgia,serif">0.03L</text>

    <!-- Small back label -->
    <rect x="188" y="320" width="24" height="20" rx="2" fill="rgba(255,255,255,0.15)"/>
  </g>`;
}

function coffeeCupDetailed(palette, label, seed) {
  return `
  <g>
    <!-- Surface glow -->
    <ellipse cx="195" cy="435" rx="80" ry="6" fill="${palette.glow}" opacity="0.06"/>

    <!-- Shadow -->
    <ellipse cx="195" cy="430" rx="65" ry="8" fill="rgba(0,0,0,0.25)"/>

    <!-- Saucer -->
    <ellipse cx="195" cy="415" rx="72" ry="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <ellipse cx="195" cy="412" rx="55" ry="6" fill="rgba(255,255,255,0.04)"/>

    <!-- Cup body -->
    <path d="M135,200 L135,385 Q135,405 160,405 L230,405 Q255,405 255,385 L255,200 Z"
          fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>

    <!-- Coffee liquid surface -->
    <ellipse cx="195" cy="205" rx="55" ry="10" fill="${palette.liquid}" opacity="0.55"/>

    <!-- Latte art / crema pattern -->
    <ellipse cx="195" cy="203" rx="35" ry="6" fill="${lighten(palette.liquid, 0.35)}" opacity="0.35"/>
    ${seed % 3 === 0 ? `
    <!-- Heart latte art -->
    <path d="M185,200 Q190,193 195,198 Q200,193 205,200 Q205,207 195,212 Q185,207 185,200 Z"
          fill="${lighten(palette.liquid, 0.5)}" opacity="0.25"/>
    ` : seed % 3 === 1 ? `
    <!-- Rosetta latte art -->
    <path d="M195,196 L188,200 L195,198 L202,200 Z M195,200 L185,204 L195,202 L205,204 Z M195,204 L183,208 L195,206 L207,208 Z"
          fill="${lighten(palette.liquid, 0.5)}" opacity="0.2"/>
    ` : `
    <!-- Simple latte art -->
    <circle cx="195" cy="201" r="8" fill="${lighten(palette.liquid, 0.5)}" opacity="0.2"/>
    `}

    <!-- Handle -->
    <path d="M255,225 Q295,225 295,280 L295,330 Q295,385 255,385"
          fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="6" stroke-linecap="round"/>
    <path d="M255,230 Q290,230 290,280 L290,325 Q290,380 255,380"
          fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3" stroke-linecap="round"/>

    <!-- Steam wisps -->
    <path d="M180,188 Q174,158 184,128 Q190,108 180,85"
          fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M198,183 Q192,148 202,118 Q208,98 198,75"
          fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2" stroke-linecap="round"/>
    <path d="M216,188 Q210,155 220,125 Q226,105 216,82"
          fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2" stroke-linecap="round"/>

    <!-- Cup highlight -->
    <path d="M140,205 L140,380 Q140,390 145,393 L145,210 Z" fill="rgba(255,255,255,0.1)"/>

    <!-- Label on cup -->
    <text x="195" y="300" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="11" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 11)}</text>
    <text x="195" y="318" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="7" font-family="Georgia,serif">${label.slice(12, 24)}</text>
  </g>`;
}

function cocktailGlassDetailed(palette, label, seed) {
  return `
  <g>
    <!-- Surface glow -->
    <ellipse cx="200" cy="435" rx="80" ry="6" fill="${palette.glow}" opacity="0.06"/>

    <!-- Shadow -->
    <ellipse cx="200" cy="430" rx="55" ry="7" fill="rgba(0,0,0,0.25)"/>

    <!-- V-shaped bowl -->
    <path d="M95,130 L200,320 L305,130 Z" fill="${palette.liquid}" opacity="0.3" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/>

    <!-- Glass rim highlight -->
    <line x1="95" y1="130" x2="305" y2="130" stroke="rgba(255,255,255,0.35)" stroke-width="1.8"/>
    <line x1="100" y1="132" x2="300" y2="132" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/>

    <!-- Inner liquid -->
    <path d="M110,152 L200,308 L290,152 Z" fill="${palette.liquid}" opacity="0.45"/>

    <!-- Glass reflections -->
    <path d="M115,148 L200,300 L200,300 Z" fill="rgba(255,255,255,0.07)"/>
    <path d="M285,148 L200,300 L200,300 Z" fill="rgba(255,255,255,0.03)"/>

    <!-- Stem -->
    <rect x="196" y="320" width="8" height="70" rx="1" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/>

    <!-- Base -->
    <ellipse cx="200" cy="395" rx="42" ry="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>

    <!-- Garnish - category specific -->
    ${seed % 4 === 0 ? `
    <!-- Orange slice garnish -->
    <circle cx="140" cy="132" r="10" fill="#ff8c00" opacity="0.7"/>
    <path d="M140,122 L140,142 M130,132 L150,132" stroke="#ffa500" stroke-width="0.5" opacity="0.5"/>
    ` : seed % 4 === 1 ? `
    <!-- Cherry garnish -->
    <circle cx="155" cy="134" r="6" fill="#dc143c" opacity="0.75"/>
    <path d="M161,134 Q170,118 165,108" fill="none" stroke="#228b22" stroke-width="1.5" opacity="0.6"/>
    ` : seed % 4 === 2 ? `
    <!-- Lime garnish -->
    <ellipse cx="145" cy="134" rx="8" ry="5" fill="#32cd32" opacity="0.6" transform="rotate(-20 145 134)"/>
    ` : `
    <!-- Berry garnish -->
    <circle cx="150" cy="133" r="4" fill="#8b0000" opacity="0.7"/>
    <circle cx="158" cy="131" r="3.5" fill="#8b0000" opacity="0.6"/>
    <path d="M154,127 Q156,120 160,118" fill="none" stroke="#228b22" stroke-width="1" opacity="0.5"/>
    `}

    <!-- Bubbles in cocktail -->
    ${Array.from({length: 6}, (_, i) => {
      const bx = 150 + ((seed * (i+1) * 7) % 100);
      const by = 180 + ((seed * (i+1) * 13) % 100);
      return `<circle cx="${bx}" cy="${by}" r="1.2" fill="rgba(255,255,255,0.3)"/>`;
    }).join('\n    ')}

    <!-- Label -->
    <text x="200" y="220" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="12" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 12)}</text>
    <text x="200" y="238" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="7.5" font-family="Georgia,serif">${label.slice(13, 26)}</text>
  </g>`;
}

function softDrinkBottleDetailed(palette, label, seed) {
  return `
  <g>
    <!-- Surface glow -->
    <ellipse cx="200" cy="435" rx="75" ry="6" fill="${palette.glow}" opacity="0.06"/>

    <!-- Shadow -->
    <ellipse cx="200" cy="430" rx="45" ry="7" fill="rgba(0,0,0,0.25)"/>

    <!-- Bottle body -->
    <path d="M168,115 L168,400 Q168,418 180,418 L220,418 Q232,418 232,400 L232,115 Q232,100 224,90 L224,65 Q224,52 218,48 L218,38 Q214,32 208,32 L192,32 Q186,32 182,38 L182,48 Q176,52 176,65 L176,90 Q168,100 168,115 Z"
          fill="url(#bottleGrad-${seed})" stroke="${darken(palette.accent, 0.3)}" stroke-width="0.8"/>

    <!-- Liquid -->
    <path d="M171,120 L171,397 Q171,415 182,415 L218,415 Q229,415 229,397 L229,120 Q229,105 221,95 L221,68 Q221,56 216,52 L184,52 Q179,56 179,68 L179,95 Q171,105 171,120 Z"
          fill="${palette.liquid}" opacity="0.45"/>

    <!-- Glass highlight -->
    <path d="M173,120 L173,393 Q173,403 176,406 L176,125 Q173,115 173,120 Z"
          fill="rgba(255,255,255,0.12)"/>
    <rect x="196" y="35" width="3" height="80" rx="1.5" fill="rgba(255,255,255,0.07)"/>

    <!-- Cap -->
    <rect x="186" y="26" width="28" height="10" rx="3" fill="${palette.accent}" stroke="${darken(palette.accent, 0.2)}" stroke-width="0.5"/>

    <!-- Condensation drops -->
    ${Array.from({length: 6}, (_, i) => {
      const dx = 175 + ((seed * (i+2) * 11) % 50);
      const dy = 140 + ((seed * (i+2) * 17) % 250);
      return `<ellipse cx="${dx}" cy="${dy}" rx="2.5" ry="3.5" fill="rgba(255,255,255,0.1)"/>`;
    }).join('\n    ')}

    <!-- Main label -->
    <rect x="173" y="220" width="54" height="75" rx="3" fill="rgba(255,255,255,0.88)" stroke="${darken(palette.accent, 0.15)}" stroke-width="0.5"/>

    <!-- Label detail border -->
    <rect x="176" y="223" width="48" height="69" rx="2" fill="none" stroke="${palette.accent}" stroke-width="0.3" opacity="0.25"/>

    <!-- Label text -->
    <text x="200" y="248" text-anchor="middle" fill="${darken(palette.accent, 0.4)}" font-size="8" font-weight="bold" font-family="Arial,sans-serif">${label.slice(0, 9)}</text>
    <text x="200" y="261" text-anchor="middle" fill="${darken(palette.accent, 0.25)}" font-size="5.5" font-family="Arial,sans-serif">${label.slice(10, 22)}</text>
    <line x1="180" y1="270" x2="220" y2="270" stroke="${palette.accent}" stroke-width="0.3" opacity="0.3"/>
    <text x="200" y="282" text-anchor="middle" fill="${darken(palette.accent, 0.2)}" font-size="4.5" font-family="Arial,sans-serif">0.33L</text>
  </g>`;
}

// ═══════════════════════════════════════════════
// ALL ITEMS DATA
// ═══════════════════════════════════════════════

const ITEMS = [
  // BELA VINA
  { path: '/menu-images/bela-vina/alter.png', name: 'Alter 2021', sub: 'Ekološko Cuvee', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/angel-belo-2019.png', name: 'Angel Belo', sub: '2019 Grande 3L', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/angel-belo-2021.png', name: 'Angel Belo', sub: '2021 Grande', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/bela-frankinja.png', name: 'Bela Frankinja', sub: 'Polsladko', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/burja-bela.png', name: 'Burja Bela', sub: 'Demeter Eko', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/chardonnay-dular.png', name: 'Chard. Dular', sub: 'Ekološko', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/chardonnay-verus.png', name: 'Chard. Verus', sub: 'Štajerska', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/chardonnay-vicomte.png', name: 'Chard. Vicomte', sub: 'II Cru Brda', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/cuvee-emino.png', name: 'Cuvee Emino', sub: 'Hiša vin', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/laski-rizling.png', name: 'Laški Rizling', sub: 'Dolenjska', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/malvazija-movia.png', name: 'Malvazija', sub: 'Movia Brda', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/rebula-cru.png', name: 'Rebula Cru', sub: 'Simčič Brda', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/renski-rizling-keltis.png', name: 'R. Rizling', sub: 'Keltis Eko', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/renski-rizling-stare.png', name: 'R. Rizling', sub: 'Stare Trte 2015', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/rumeni-muskat-pozna.png', name: 'R. Muškat', sub: 'Pozna Trgatev', palette: 'dessertWine', type: 'wine' },
  { path: '/menu-images/bela-vina/rumeni-muskat.png', name: 'Rumeni Muškat', sub: 'Polsladko', palette: 'dessertWine', type: 'wine' },
  { path: '/menu-images/bela-vina/sauvignon-blanc-cru.png', name: 'Sauvignon', sub: 'Cru Veliki Vrh', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/sipon-verus.png', name: 'Šipon Verus', sub: 'Podravje', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/sivi-pinot-jamertal.png', name: 'Sivi Pinot', sub: 'Jamertal', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/traminec.png', name: 'Traminec', sub: 'Keltis', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/bela-vina/rebula.png', name: 'Rebula', sub: 'Blazic Brda', palette: 'whiteWine', type: 'wine' },

  // BREZALK PIVO
  { path: '/menu-images/brezalk-pivo/daura.png', name: 'Daura', sub: 'Brezglutensko', palette: 'beer', type: 'beer' },
  { path: '/menu-images/brezalk-pivo/heineken-00.png', name: 'Heineken 0.0', sub: 'Brezalkoholno', palette: 'beer', type: 'beer' },

  // CRAFT PIVA
  { path: '/menu-images/craft-piva/bevog-tak.png', name: 'Bevog Tak', sub: 'Pale Ale', palette: 'beer', type: 'beer' },
  { path: '/menu-images/craft-piva/pelicon-winter.png', name: 'Pelicon Winter', sub: 'Temno Ale', palette: 'darkBeer', type: 'beer' },
  { path: '/menu-images/craft-piva/zeleni-haler.png', name: 'Zeleni Haler', sub: 'Konoplja Lager', palette: 'beer', type: 'beer' },

  // DESTILATI
  { path: '/menu-images/destilati/ararat-6.png', name: 'Ararat 6yo', sub: 'Vinjak', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/ararat-15.png', name: 'Ararat 15yo', sub: 'Premium', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/ararat-20.png', name: 'Ararat 20yo', sub: 'Ultra Premium', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/brinjevec.png', name: 'Brinjevec', sub: 'Brinovec', palette: 'spirit', type: 'spirit' },
  { path: '/menu-images/destilati/delamaine-xo.png', name: 'Delamaine', sub: 'X.O. Konjak', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/grappa-sofija.png', name: 'Grappa Sofija', sub: 'Rebula', palette: 'spirit', type: 'spirit' },
  { path: '/menu-images/destilati/hennessy-vs.png', name: 'Hennessy V.S.', sub: 'Konjak', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/hennessy-xo.png', name: 'Hennessy X.O.', sub: 'Premium', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/rum-bumbu.png', name: 'Rum Bumbu', sub: 'Barbados', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/rum-diplomatico.png', name: 'Diplomatico', sub: 'Venezuela', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/rum-hechicera.png', name: 'Hechicera', sub: '21yo Kolumbija', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/rum-zacapa.png', name: 'Zacapa 23yo', sub: 'Guatemala', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/destilati/slivovka.png', name: 'Slivovka', sub: 'Slivovec', palette: 'liqueur', type: 'spirit' },
  { path: '/menu-images/destilati/travarica-rossi.png', name: 'Travarica', sub: 'Istra', palette: 'spirit', type: 'spirit' },
  { path: '/menu-images/destilati/viljamovka.png', name: 'Viljamovka', sub: 'Hruškovce', palette: 'spirit', type: 'spirit' },

  // GAZIRANE PIJACE
  { path: '/menu-images/gazirane-pijace/coca-cola-zero.png', name: 'Cola Zero', sub: '0.33L', palette: 'softDrink', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/cockta.png', name: 'Cockta', sub: 'Slovenska', palette: 'softDrink', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fanta.png', name: 'Fanta', sub: 'Pomaranča', palette: 'juice', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fever-tree-med.png', name: 'Fever Tree', sub: 'Mediterranean', palette: 'water', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', name: 'Fever Tree', sub: 'Rhubarb', palette: 'cocktail', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fever-tree-tonic.png', name: 'Fever Tree', sub: 'Indian Tonic', palette: 'water', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/red-bull.png', name: 'Red Bull', sub: 'Energy', palette: 'softDrink', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/schweppes-bitter.png', name: 'Schweppes', sub: 'Bitter Lemon', palette: 'juice', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/schweppes-tonic.png', name: 'Schweppes', sub: 'Tonic Water', palette: 'water', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/sprite.png', name: 'Sprite', sub: 'Lemon-Lime', palette: 'softDrink', type: 'drink' },

  // GIN
  { path: '/menu-images/gin/gin-hendricks.png', name: "Hendrick's", sub: 'Škotska', palette: 'gin', type: 'spirit' },
  { path: '/menu-images/gin/gin-kristal.png', name: 'Gin Kristal', sub: 'London Dry', palette: 'gin', type: 'spirit' },
  { path: '/menu-images/gin/gin-mare.png', name: 'Gin Mare', sub: 'Mediterranean', palette: 'gin', type: 'spirit' },
  { path: '/menu-images/gin/gin-monkey47.png', name: 'Monkey 47', sub: 'Schwarzwald', palette: 'gin', type: 'spirit' },
  { path: '/menu-images/gin/gin-monolog.png', name: 'Gin Monolog', sub: 'Slovenija', palette: 'gin', type: 'spirit' },
  { path: '/menu-images/gin/gin-tanqueray.png', name: 'Tanqueray', sub: 'London Dry', palette: 'gin', type: 'spirit' },

  // GRENCICE
  { path: '/menu-images/grencice/amaro.png', name: 'Amaro', sub: 'Zeliščni', palette: 'bitter', type: 'spirit' },
  { path: '/menu-images/grencice/aperol.png', name: 'Aperol', sub: 'Aperitiv', palette: 'bitter', type: 'spirit' },
  { path: '/menu-images/grencice/campari.png', name: 'Campari', sub: 'Bitter', palette: 'bitter', type: 'spirit' },
  { path: '/menu-images/grencice/cynar.png', name: 'Cynar', sub: 'Artičoka', palette: 'bitter', type: 'spirit' },
  { path: '/menu-images/grencice/jagermeister.png', name: 'Jägermeister', sub: 'Zeliščni', palette: 'bitter', type: 'spirit' },

  // LIKERJI
  { path: '/menu-images/likerji/borovnica-kejzar.png', name: 'Borovnica', sub: 'Kejžar', palette: 'liqueur', type: 'spirit' },
  { path: '/menu-images/likerji/bumbu-cream.png', name: 'Bumbu Cream', sub: 'Rum Liker', palette: 'liqueur', type: 'spirit' },
  { path: '/menu-images/likerji/canella.png', name: 'Canella', sub: 'Prosecco', palette: 'liqueur', type: 'spirit' },
  { path: '/menu-images/likerji/carolans.png', name: 'Carolans', sub: 'Irish Cream', palette: 'liqueur', type: 'spirit' },
  { path: '/menu-images/likerji/malibu.png', name: 'Malibu', sub: 'Kokos Rum', palette: 'liqueur', type: 'spirit' },
  { path: '/menu-images/likerji/medica-kejzar.png', name: 'Medica', sub: 'Kejžar', palette: 'dessertWine', type: 'spirit' },

  // LIKERSKO VINO
  { path: '/menu-images/likersko-vino/keros-belo.png', name: 'Keros Belo', sub: 'Sladko 2020', palette: 'dessertWine', type: 'wine' },
  { path: '/menu-images/likersko-vino/keros-rdece.png', name: 'Keros Rdeče', sub: 'Sladko 2018', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/likersko-vino/sladki-refosk.png', name: 'Sl. Refošk', sub: 'Sladko', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/likersko-vino/veliko-rdece-2012.png', name: 'Veliko Rdeče', sub: 'Movia 3L', palette: 'redWine', type: 'wine' },

  // MESANE PIJACE
  { path: '/menu-images/mesane-pijace/cuba-libre.png', name: 'Cuba Libre', sub: 'Rum in Cola', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/gin-mare-tonic.png', name: 'Gin Mare GT', sub: 'Mediterranean', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', name: "Hendrick's GT", sub: 'Kumara', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/mango-mojito.png', name: 'Mango Mojito', sub: 'Rum in Mango', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/martini-spritz.png', name: 'Martini Spritz', sub: 'Bianco', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', name: 'Monkey 47 GT', sub: 'Schwarzwald', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/monolog-gin-tonic.png', name: 'Monolog GT', sub: 'Slovenija', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', name: 'Orange Ginger', sub: 'Gin Tonic', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', name: 'Raspberry GT', sub: 'Pink Gin', palette: 'cocktail', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/strawberry-mojito.png', name: 'Straw. Mojito', sub: 'Rum in Jagoda', palette: 'cocktail', type: 'cocktail' },

  // NARAVNI SOKOVI
  { path: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', name: 'Led. Čaj', sub: 'Hišni Domač', palette: 'juice', type: 'drink' },
  { path: '/menu-images/naravni-sokovi/hisni-sok-meta.png', name: 'Sok Meta', sub: 'Hišni Domač', palette: 'softDrink', type: 'drink' },
  { path: '/menu-images/naravni-sokovi/limonada-okus.png', name: 'Limonada', sub: 'Bezeg in Ingver', palette: 'cocktail', type: 'drink' },
  { path: '/menu-images/naravni-sokovi/pomarancni-sok.png', name: 'Pom. Sok', sub: 'Sveže Stisnjen', palette: 'juice', type: 'drink' },

  // PENINE
  { path: '/menu-images/penine/bjana-brut.png', name: 'Bjana Brut', sub: 'Brda', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/penine/boemme-rumeni-muskat.png', name: 'Boemme', sub: 'R. Muškat', palette: 'dessertWine', type: 'wine' },
  { path: '/menu-images/penine/gourmet-rose.png', name: 'Gourmet', sub: 'Rosé Istenič', palette: 'rose', type: 'wine' },
  { path: '/menu-images/penine/louis-roederer.png', name: 'L. Roederer', sub: 'Champagne', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/penine/maria-brut.png', name: 'Maria Brut', sub: 'Kerin', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/penine/mufi-pet-nat.png', name: 'Mufi Pet Nat', sub: 'Brut Nature', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/penine/no1-brut.png', name: 'No.1 Brut', sub: 'Istenič', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/penine/pol-roger.png', name: 'Pol Roger', sub: 'Champagne', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/penine/slapsak-brut-reserve.png', name: 'Slapšak', sub: 'Brut Reserve', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/penine/slapsak-brut-rose.png', name: 'Slapšak', sub: 'Brut Rosé', palette: 'rose', type: 'wine' },
  { path: '/menu-images/penine/zlata-radgonska.png', name: 'Zl. Radgonska', sub: 'Brut Selection', palette: 'whiteWine', type: 'wine' },

  // PIVO
  { path: '/menu-images/pivo/reset-froggy.png', name: 'Reset Froggy', sub: 'IPA', palette: 'beer', type: 'beer' },
  { path: '/menu-images/pivo/reset-lagerish.png', name: 'Reset Lager.', sub: 'Cream Ale', palette: 'beer', type: 'beer' },
  { path: '/menu-images/pivo/reset-stout.png', name: 'Reset Stout', sub: 'Irish Extra', palette: 'darkBeer', type: 'beer' },

  // RDECA VINA
  { path: '/menu-images/rdeca-vina/cabernet-keltis.png', name: 'Cabernet', sub: 'Keltis Eko', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/cabernet-pavo.png', name: 'Cabernet', sub: 'Pavo Limited', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/carolina-rdeca.png', name: 'Carolina', sub: 'Rdeča Jakončič', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/duet-edi-simcic.png', name: 'Duet Simčič', sub: '2021 Brda', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/duet-lex-2018.png', name: 'Duet Lex', sub: '2018 Magnum', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/duet-lex-2020.png', name: 'Duet Lex', sub: '2020 Brda', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/guerila-retro.png', name: 'Guerila Retro', sub: 'Vipavska', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/merlot-keltis.png', name: 'Merlot', sub: 'Keltis Eko', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/merlot-opoka.png', name: 'Merlot Opoka', sub: 'Simčič Brda', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-dular.png', name: 'M. Frankinja', sub: 'Dular Eko', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-luna.png', name: 'M. Frankinja', sub: 'Luna Kobal', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modri-pinot-opoka.png', name: 'M. Pinot', sub: 'Opoka Simčič', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modri-pinot-verus.png', name: 'M. Pinot', sub: 'Verus Ormož', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/rdeca-vina/veliko-rdece-movia.png', name: 'Veliko Rdeče', sub: 'Movia Brda', palette: 'redWine', type: 'wine' },

  // ROSE
  { path: '/menu-images/rose-vino/rose-batic.png', name: 'Rosé Batič', sub: 'Vipavska', palette: 'rose', type: 'wine' },
  { path: '/menu-images/rose-vino/rose-verstovsek.png', name: 'Rosé', sub: 'Verstovšek', palette: 'rose', type: 'wine' },

  // SOKOVI
  { path: '/menu-images/sokovi/ananasov-sok.png', name: 'Ananasov Sok', sub: 'Tropski', palette: 'juice', type: 'drink' },
  { path: '/menu-images/sokovi/bubble-tea.png', name: 'Bubble Tea', sub: 'Boba', palette: 'liqueur', type: 'drink' },
  { path: '/menu-images/sokovi/cedevita.png', name: 'Cedevita', sub: 'Vitamin', palette: 'juice', type: 'drink' },
  { path: '/menu-images/sokovi/jabolcni-sok.png', name: 'Jabolčni Sok', sub: '100% Naravni', palette: 'softDrink', type: 'drink' },
  { path: '/menu-images/sokovi/jagodni-sok.png', name: 'Jagodni Sok', sub: 'Jagode', palette: 'cocktail', type: 'drink' },
  { path: '/menu-images/sokovi/ledeni-caj.png', name: 'Led. Čaj', sub: 'Hladen', palette: 'juice', type: 'drink' },
  { path: '/menu-images/sokovi/marelicni-sok.png', name: 'Marelični Sok', sub: 'Marelice', palette: 'juice', type: 'drink' },
  { path: '/menu-images/sokovi/pomarancni-sok.png', name: 'Pom. Sok', sub: '0.20L', palette: 'juice', type: 'drink' },
  { path: '/menu-images/sokovi/ribezov-sok.png', name: 'Ribezov Sok', sub: 'Rdeči Ribez', palette: 'bitter', type: 'drink' },

  // TOCENO PIVO
  { path: '/menu-images/toceno-pivo/haler-nefiltriran.png', name: 'Haler', sub: 'Nefiltriran', palette: 'beer', type: 'beer' },
  { path: '/menu-images/toceno-pivo/pelicon-ipa.png', name: 'Pelicon IPA', sub: '3rd Pill', palette: 'beer', type: 'beer' },
  { path: '/menu-images/toceno-pivo/radler.png', name: 'Radler', sub: 'Grenivka', palette: 'beer', type: 'beer' },
  { path: '/menu-images/toceno-pivo/union-lager.png', name: 'Union Lager', sub: '0.30/0.50L', palette: 'beer', type: 'beer' },

  // TOPLI NAPITKI
  { path: '/menu-images/topli-napitki/babyccino.png', name: 'Babyccino', sub: 'Otroška', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', name: 'Bela Kava', sub: 'Brez Kofeina', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/bela-kava.png', name: 'Bela Kava', sub: 'Z Mlekom', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/caj-limona-med.png', name: 'Čaj', sub: 'Limona in Med', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', name: 'Cappuccino', sub: 'Brez Kofeina', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kakav-smetana.png', name: 'Kakav', sub: 'S Smetano', palette: 'cocoa', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kakav.png', name: 'Kakav', sub: 'Čokoladni', palette: 'cocoa', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-brez-kofeina.png', name: 'Espresso', sub: 'Brez Kofeina', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-macchiato.png', name: 'Macchiato', sub: 'S Kapljico', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', name: 'Kava Mleko', sub: 'Brez Kofeina', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-rizevo-mleko.png', name: 'Kava', sub: 'Riževo Mleko', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-s-smetano.png', name: 'Kava', sub: 'S Smetano', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-z-mlekom.png', name: 'Kava', sub: 'Z Mlekom', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/ledena-kava-olimia.png', name: 'Ledena Kava', sub: 'Olimia', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', name: 'Macchiato', sub: 'Brez Kofeina', palette: 'coffee', type: 'coffee' },
  { path: '/menu-images/topli-napitki/vroca-cokolada.png', name: 'Vr. Čokolada', sub: 'Gosta', palette: 'cocoa', type: 'coffee' },

  // TUJA VINA
  { path: '/menu-images/tuja-vina/andreis-vinasmora.png', name: 'Andreis', sub: 'Hrvaška Rdeče', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/tuja-vina/jermann-dreams.png', name: 'Jermann', sub: 'Dreams Italija', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', name: 'Plavac Mali', sub: 'Hrvaška', palette: 'redWine', type: 'wine' },
  { path: '/menu-images/tuja-vina/posip-terra-madre.png', name: 'Pošip', sub: 'Hrvaška Belo', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/tuja-vina/vintage-tunina.png', name: 'Vintage', sub: 'Tunina Italija', palette: 'whiteWine', type: 'wine' },
  { path: '/menu-images/tuja-vina/vranec-instinct.png', name: 'Vranec', sub: 'Makedonija', palette: 'redWine', type: 'wine' },

  // VISKI
  { path: '/menu-images/viski/chivas-12.png', name: 'Chivas 12yo', sub: 'Blended', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/glenmorangie-18.png', name: 'Glenm. 18', sub: 'Highland', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/glenmorangie-lasanta.png', name: 'Glenm.', sub: 'Lasanta 12', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/jameson.png', name: 'Jameson', sub: 'Irska', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/johnnie-walker-black.png', name: 'J. Walker', sub: 'Black Label', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/lagavulin-16.png', name: 'Lagavulin 16', sub: 'Islay', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/laphroaig-10.png', name: 'Laphroaig 10', sub: 'Islay', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/nikka-barrel.png', name: 'Nikka Barrel', sub: 'Japonska', palette: 'whiskey', type: 'spirit' },
  { path: '/menu-images/viski/nikka-miyagikyo.png', name: 'Nikka', sub: 'Miyagikyo', palette: 'whiskey', type: 'spirit' },

  // VODE
  { path: '/menu-images/vode/mineralna-voda.png', name: 'Mineralna', sub: 'Gazirana', palette: 'water', type: 'drink' },
  { path: '/menu-images/vode/naravna-voda.png', name: 'Naravna', sub: 'Mirna', palette: 'water', type: 'drink' },
  { path: '/menu-images/vode/radenska-functionall.png', name: 'Radenska', sub: 'FunctionALL', palette: 'water', type: 'drink' },
  { path: '/menu-images/vode/voda-z-okusom.png', name: 'Voda Okus', sub: 'Okusna', palette: 'water', type: 'drink' },
];

// ═══════════════════════════════════════════════
// SVG BUILDER
// ═══════════════════════════════════════════════

function buildPremiumSVG(item, idx) {
  const h = hashStr(item.name + item.sub + idx);
  const seed = parseInt(h.slice(0, 8), 16);
  const palette = PALETTES[item.palette] || PALETTES.wine;
  const label = (item.name + ' ' + item.sub).trim();

  // Unique floating particles based on hash
  let particles = '';
  for (let i = 0; i < 15; i++) {
    const px = 10 + ((seed * (i + 1) * 7) % (W - 20));
    const py = 10 + ((seed * (i + 1) * 13) % (H - 120));
    const pr = 0.8 + ((seed * (i + 1)) % 3);
    const po = 0.03 + ((seed * (i + 3)) % 8) * 0.01;
    particles += `<circle cx="${px}" cy="${py}" r="${pr}" fill="${palette.highlight}" opacity="${po}"/>`;
  }

  // Category-specific bokeh circles for depth
  let bokeh = '';
  for (let i = 0; i < 4; i++) {
    const bx = 20 + ((seed * (i + 5) * 11) % (W - 40));
    const by = 20 + ((seed * (i + 5) * 17) % (H - 140));
    const br = 15 + ((seed * (i + 5)) % 30);
    bokeh += `<circle cx="${bx}" cy="${by}" r="${br}" fill="${palette.glow}" opacity="0.04"/>`;
  }

  // Select product illustration
  let illustration;
  switch (item.type) {
    case 'wine': illustration = wineBottleDetailed(palette, label, seed); break;
    case 'beer': illustration = beerGlassDetailed(palette, label, seed); break;
    case 'spirit': illustration = spiritBottleDetailed(palette, label, seed); break;
    case 'coffee': illustration = coffeeCupDetailed(palette, label, seed); break;
    case 'cocktail': illustration = cocktailGlassDetailed(palette, label, seed); break;
    case 'drink': illustration = softDrinkBottleDetailed(palette, label, seed); break;
    default: illustration = wineBottleDetailed(palette, label, seed); break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <!-- Main background gradient -->
    <linearGradient id="bg-${h.slice(0,8)}" x1="0%" y1="0%" x2="70%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.bg1}"/>
      <stop offset="100%" style="stop-color:${palette.bg2}"/>
    </linearGradient>

    <!-- Spotlight radial gradient -->
    <radialGradient id="spot-${h.slice(0,8)}" cx="50%" cy="40%" r="55%">
      <stop offset="0%" style="stop-color:${palette.accent};stop-opacity:0.1"/>
      <stop offset="70%" style="stop-color:${palette.accent};stop-opacity:0.02"/>
      <stop offset="100%" style="stop-color:${palette.accent};stop-opacity:0"/>
    </radialGradient>

    <!-- Surface gradient -->
    <linearGradient id="surface-${h.slice(0,8)}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.bg2};stop-opacity:0"/>
      <stop offset="100%" style="stop-color:rgba(0,0,0,0.35)"/>
    </linearGradient>

    <!-- Bottle gradient -->
    <linearGradient id="bottleGrad-${seed}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${darken(palette.accent, 0.35)}"/>
      <stop offset="40%" style="stop-color:${darken(palette.accent, 0.45)}"/>
      <stop offset="100%" style="stop-color:${darken(palette.accent, 0.6)}"/>
    </linearGradient>

    <!-- Top vignette -->
    <radialGradient id="vignette-${h.slice(0,8)}" cx="50%" cy="50%" r="70%">
      <stop offset="0%" style="stop-color:rgba(0,0,0,0)"/>
      <stop offset="100%" style="stop-color:rgba(0,0,0,0.3)"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg-${h.slice(0,8)})"/>
  <rect width="${W}" height="${H}" fill="url(#spot-${h.slice(0,8)})"/>

  <!-- Bokeh depth circles -->
  ${bokeh}

  <!-- Unique particles -->
  ${particles}

  <!-- Surface gradient -->
  <rect y="400" width="${W}" height="100" fill="url(#surface-${h.slice(0,8)})" opacity="0.6"/>

  <!-- Main product illustration -->
  ${illustration}

  <!-- Bottom info bar -->
  <rect x="0" y="440" width="${W}" height="60" fill="rgba(0,0,0,0.55)"/>
  <line x1="15" y1="441" x2="${W - 15}" y2="441" stroke="${palette.accent}" stroke-width="1.5" opacity="0.5"/>

  <!-- Category dot -->
  <circle cx="22" cy="462" r="4" fill="${palette.accent}" opacity="0.7"/>

  <!-- Item name -->
  <text x="34" y="466" fill="${lighten(palette.accent, 0.6)}" font-size="15" font-weight="bold" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.5">${item.name}</text>

  <!-- Subtitle -->
  <text x="${W/2}" y="488" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.3">${item.sub}</text>

  <!-- Corner accents -->
  <path d="M0,0 L25,0 L0,25 Z" fill="${palette.accent}" opacity="0.08"/>
  <path d="M${W},0 L${W-25},0 L${W},25 Z" fill="${palette.accent}" opacity="0.06"/>

  <!-- Vignette overlay -->
  <rect width="${W}" height="${H}" fill="url(#vignette-${h.slice(0,8)})"/>
</svg>`;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log(`\n✨ Generating ${ITEMS.length} PREMIUM menu images...`);
  console.log(`   Force overwrite: ${FORCE}`);
  if (!FORCE) console.log(`   Skipping images already > ${MIN_AI_SIZE/1000}KB\n`);
  else console.log('');

  let generated = 0, skipped = 0, failed = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const fullPath = join(process.cwd(), 'public', item.path);

    // Skip already-upgraded images unless force
    if (!FORCE && existsSync(fullPath)) {
      const stat = statSync(fullPath);
      if (stat.size > MIN_AI_SIZE) {
        skipped++;
        continue;
      }
    }

    const label = item.path.split('/').pop().replace('.png', '');
    process.stdout.write(`  [${i+1}/${ITEMS.length}] ${label}... `);

    try {
      // Build premium SVG
      const svg = buildPremiumSVG(item, i);

      // Convert SVG to PNG using Sharp
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(W, H)
        .png({ quality: 95, compressionLevel: 6 })
        .toBuffer();

      // Ensure directory exists
      const dir = dirname(fullPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      // Write file
      writeFileSync(fullPath, pngBuffer);

      console.log(`✅ (${(pngBuffer.length/1024).toFixed(0)}KB)`);
      generated++;
    } catch (err) {
      console.log(`❌ ${err.message?.slice(0, 100) || 'Unknown error'}`);
      failed++;
    }
  }

  console.log(`\n📊 Done! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`);
  if (failed > 0) console.log(`   ⚠️  ${failed} images failed to generate.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
