#!/usr/bin/env node
/**
 * Generate PROFESSIONAL unique menu images using advanced SVG + Sharp.
 * Each image has: realistic product silhouettes, gradient backgrounds,
 * shadow effects, glass reflections, label details, and unique color theming.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';

const W = 400, H = 500;

// ═══════════════════════════════════════════════
// HELPER FUNCTIONS
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

function lighten(hex, amount = 0.3) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darken(hex, amount = 0.3) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════
// SILHOUETTE BUILDERS
// ═══════════════════════════════════════════════

function wineBottle(label, color, liquidColor) {
  return `
    <!-- Shadow -->
    <ellipse cx="200" cy="410" rx="50" ry="8" fill="rgba(0,0,0,0.3)"/>
    <!-- Bottle body -->
    <path d="M175,160 L175,390 Q175,405 185,405 L215,405 Q225,405 225,390 L225,160 Q225,145 215,135 L215,105 Q215,90 210,85 L210,70 Q210,60 205,58 L205,55 Q200,50 195,55 L195,58 Q190,60 190,70 L190,85 Q185,90 185,105 L185,135 Q175,145 175,160 Z"
          fill="${darken(color, 0.4)}" stroke="${darken(color, 0.6)}" stroke-width="1"/>
    <!-- Liquid fill -->
    <path d="M177,165 L177,388 Q177,403 187,403 L213,403 Q223,403 223,388 L223,165 Q223,150 213,140 L213,108 Q213,93 208,88 L208,73 Q208,65 203,60 L197,60 Q192,65 192,73 L192,88 Q187,93 187,108 L187,140 Q177,150 177,165 Z"
          fill="${liquidColor}" opacity="0.4"/>
    <!-- Glass highlight -->
    <path d="M182,165 L182,385 Q182,395 188,398 L188,165 Q182,155 182,165 Z"
          fill="rgba(255,255,255,0.12)"/>
    <!-- Bottle neck highlight -->
    <rect x="195" y="58" width="4" height="30" rx="2" fill="rgba(255,255,255,0.15)"/>
    <!-- Cork -->
    <rect x="193" y="48" width="14" height="10" rx="2" fill="#b5885a" stroke="#8b6914" stroke-width="0.5"/>
    <!-- Label background -->
    <rect x="180" y="220" width="40" height="80" rx="3" fill="rgba(255,255,255,0.9)" stroke="${darken(color, 0.3)}" stroke-width="0.8"/>
    <!-- Label text -->
    <text x="200" y="248" text-anchor="middle" fill="${darken(color, 0.5)}" font-size="7" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 7)}</text>
    <text x="200" y="262" text-anchor="middle" fill="${darken(color, 0.3)}" font-size="5.5" font-family="Georgia,serif">${label.slice(8, 18)}</text>
    <!-- Label decorative line -->
    <line x1="185" y1="272" x2="215" y2="272" stroke="${darken(color, 0.2)}" stroke-width="0.5"/>
    <text x="200" y="285" text-anchor="middle" fill="${darken(color, 0.3)}" font-size="4.5" font-family="Georgia,serif">SLOVENIJA</text>
    <!-- Reflection on surface -->
    <ellipse cx="200" cy="420" rx="35" ry="4" fill="${liquidColor}" opacity="0.08"/>
  `;
}

function beerGlass(label, color, liquidColor) {
  return `
    <!-- Shadow -->
    <ellipse cx="205" cy="410" rx="55" ry="8" fill="rgba(0,0,0,0.3)"/>
    <!-- Glass body -->
    <path d="M155,120 L155,380 Q155,400 175,400 L225,400 Q245,400 245,380 L245,120 Z"
          fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <!-- Liquid -->
    <path d="M158,150 L158,377 Q158,397 177,397 L223,397 Q242,397 242,377 L242,150 Z"
          fill="${liquidColor}" opacity="0.55"/>
    <!-- Foam head -->
    <ellipse cx="200" cy="148" rx="42" ry="14" fill="#f5f0e0" opacity="0.85"/>
    <ellipse cx="185" cy="143" rx="16" ry="10" fill="#faf5e5" opacity="0.9"/>
    <ellipse cx="215" cy="141" rx="14" ry="11" fill="#faf5e5" opacity="0.9"/>
    <ellipse cx="200" cy="138" rx="12" ry="8" fill="#fdf8f0" opacity="0.85"/>
    <!-- Carbonation bubbles -->
    <circle cx="180" cy="200" r="1.5" fill="rgba(255,255,255,0.4)"/>
    <circle cx="210" cy="180" r="1" fill="rgba(255,255,255,0.3)"/>
    <circle cx="195" cy="250" r="1.2" fill="rgba(255,255,255,0.35)"/>
    <circle cx="220" cy="300" r="1" fill="rgba(255,255,255,0.3)"/>
    <circle cx="175" cy="320" r="1.3" fill="rgba(255,255,255,0.3)"/>
    <!-- Glass highlight -->
    <path d="M160,150 L160,375 Q160,385 165,388 L165,155 Z"
          fill="rgba(255,255,255,0.12)"/>
    <!-- Handle -->
    <path d="M245,170 Q280,170 280,220 L280,300 Q280,360 245,360" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="5" stroke-linecap="round"/>
    <path d="M245,170 Q275,170 275,220 L275,300 Q275,355 245,355" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round"/>
    <!-- Label on glass -->
    <text x="200" y="260" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="10" font-weight="bold" font-family="Arial,sans-serif">${label.slice(0, 10)}</text>
    <text x="200" y="280" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="7" font-family="Arial,sans-serif">${label.slice(11, 22)}</text>
  `;
}

function spiritBottle(label, color, liquidColor) {
  return `
    <!-- Shadow -->
    <ellipse cx="200" cy="410" rx="40" ry="6" fill="rgba(0,0,0,0.3)"/>
    <!-- Bottle body - slim elegant shape -->
    <path d="M178,140 L178,390 Q178,405 188,405 L212,405 Q222,405 222,390 L222,140 Q222,125 215,115 L215,90 Q215,78 210,73 L210,60 Q210,50 205,48 L195,48 Q190,50 190,60 L190,73 Q185,78 185,90 L185,115 Q178,125 178,140 Z"
          fill="${darken(color, 0.3)}" stroke="${darken(color, 0.5)}" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M180,145 L180,387 Q180,402 189,402 L211,402 Q220,402 220,387 L220,145 Q220,130 213,120 L213,93 Q213,82 208,77 L192,77 Q187,82 187,93 L187,120 Q180,130 180,145 Z"
          fill="${liquidColor}" opacity="0.45"/>
    <!-- Glass highlight -->
    <path d="M183,145 L183,383 Q183,393 186,395 L186,148 Q183,138 183,145 Z"
          fill="rgba(255,255,255,0.12)"/>
    <!-- Cap -->
    <rect x="192" y="42" width="16" height="8" rx="2" fill="${darken(color, 0.2)}"/>
    <!-- Label -->
    <rect x="183" y="210" width="34" height="70" rx="2" fill="rgba(255,255,255,0.88)" stroke="${darken(color, 0.2)}" stroke-width="0.6"/>
    <text x="200" y="235" text-anchor="middle" fill="${darken(color, 0.5)}" font-size="6.5" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 7)}</text>
    <text x="200" y="248" text-anchor="middle" fill="${darken(color, 0.3)}" font-size="5" font-family="Georgia,serif">${label.slice(8, 18)}</text>
    <line x1="188" y1="258" x2="212" y2="258" stroke="${darken(color, 0.2)}" stroke-width="0.4"/>
    <text x="200" y="268" text-anchor="middle" fill="${darken(color, 0.3)}" font-size="4" font-family="Georgia,serif">0.03L</text>
  `;
}

function coffeeCup(label, color, liquidColor) {
  return `
    <!-- Shadow -->
    <ellipse cx="195" cy="405" rx="65" ry="8" fill="rgba(0,0,0,0.25)"/>
    <!-- Saucer -->
    <ellipse cx="195" cy="395" rx="70" ry="12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <!-- Cup body -->
    <path d="M140,200 L140,370 Q140,390 165,390 L225,390 Q250,390 250,370 L250,200 Z"
          fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <!-- Liquid surface -->
    <ellipse cx="195" cy="205" rx="52" ry="8" fill="${liquidColor}" opacity="0.6"/>
    <!-- Latte art / crema -->
    <ellipse cx="195" cy="203" rx="30" ry="5" fill="${lighten(liquidColor, 0.3)}" opacity="0.4"/>
    <!-- Handle -->
    <path d="M250,230 Q290,230 290,280 L290,320 Q290,370 250,370" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="5" stroke-linecap="round"/>
    <path d="M250,235 Q285,235 285,280 L285,315 Q285,365 250,365" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round"/>
    <!-- Steam -->
    <path d="M180,185 Q175,160 185,135 Q190,120 182,100" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linecap="round"/>
    <path d="M200,180 Q195,150 205,125 Q210,110 202,90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" stroke-linecap="round"/>
    <path d="M220,185 Q215,155 225,130 Q230,115 222,95" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2" stroke-linecap="round"/>
    <!-- Cup highlight -->
    <path d="M145,205 L145,365 Q145,375 150,378 L150,210 Z"
          fill="rgba(255,255,255,0.1)"/>
    <!-- Label on cup -->
    <text x="195" y="300" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="10" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 10)}</text>
    <text x="195" y="318" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="7" font-family="Georgia,serif">${label.slice(11, 22)}</text>
  `;
}

function cocktailGlass(label, color, liquidColor) {
  return `
    <!-- Shadow -->
    <ellipse cx="200" cy="415" rx="55" ry="7" fill="rgba(0,0,0,0.25)"/>
    <!-- V-shaped bowl -->
    <path d="M100,130 L200,310 L300,130 Z" fill="${liquidColor}" opacity="0.35" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    <!-- Glass rim highlight -->
    <line x1="100" y1="130" x2="300" y2="130" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <!-- Glass fill -->
    <path d="M115,150 L200,300 L285,150 Z" fill="${liquidColor}" opacity="0.5"/>
    <!-- Stem -->
    <rect x="196" y="310" width="8" height="70" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
    <!-- Base -->
    <ellipse cx="200" cy="385" rx="40" ry="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <!-- Glass highlights -->
    <path d="M120,145 L200,295 L200,295 Z" fill="rgba(255,255,255,0.08)"/>
    <!-- Garnish -->
    <circle cx="155" cy="135" r="6" fill="#ff6347" opacity="0.7"/>
    <path d="M161,135 Q170,120 165,110" fill="none" stroke="#228b22" stroke-width="1.5" opacity="0.6"/>
    <!-- Label area -->
    <text x="200" y="200" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="11" font-weight="bold" font-family="Georgia,serif">${label.slice(0, 11)}</text>
    <text x="200" y="220" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="7.5" font-family="Georgia,serif">${label.slice(12, 24)}</text>
  `;
}

function softDrinkBottle(label, color, liquidColor) {
  return `
    <!-- Shadow -->
    <ellipse cx="200" cy="410" rx="45" ry="7" fill="rgba(0,0,0,0.25)"/>
    <!-- Bottle body -->
    <path d="M170,120 L170,390 Q170,405 182,405 L218,405 Q230,405 230,390 L230,120 Q230,108 222,98 L222,75 Q222,62 215,58 L215,48 Q210,42 205,42 L195,42 Q190,42 185,48 L185,58 Q178,62 178,75 L178,98 Q170,108 170,120 Z"
          fill="${darken(color, 0.15)}" stroke="${darken(color, 0.3)}" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M173,125 L173,387 Q173,402 184,402 L216,402 Q227,402 227,387 L227,125 Q227,113 220,103 L220,78 Q220,67 214,63 L186,63 Q180,67 180,78 L180,103 Q173,113 173,125 Z"
          fill="${liquidColor}" opacity="0.5"/>
    <!-- Glass highlight -->
    <path d="M175,125 L175,383 Q175,393 178,395 L178,130 Q175,120 175,125 Z"
          fill="rgba(255,255,255,0.12)"/>
    <!-- Cap -->
    <rect x="188" y="36" width="24" height="10" rx="3" fill="${color}" stroke="${darken(color, 0.2)}" stroke-width="0.5"/>
    <!-- Label band -->
    <rect x="175" y="220" width="50" height="65" rx="2" fill="rgba(255,255,255,0.85)" stroke="${darken(color, 0.15)}" stroke-width="0.5"/>
    <text x="200" y="245" text-anchor="middle" fill="${darken(color, 0.4)}" font-size="7" font-weight="bold" font-family="Arial,sans-serif">${label.slice(0, 8)}</text>
    <text x="200" y="258" text-anchor="middle" fill="${darken(color, 0.25)}" font-size="5" font-family="Arial,sans-serif">${label.slice(9, 20)}</text>
    <line x1="180" y1="268" x2="220" y2="268" stroke="${darken(color, 0.15)}" stroke-width="0.4"/>
  `;
}

// ═══════════════════════════════════════════════
// ALL ITEMS DATA
// ═══════════════════════════════════════════════

const ITEMS = [
  // BELA VINA
  { path: '/menu-images/bela-vina/alter.png', name: 'Alter 2021', sub: 'Ekološko Cuvee', color: '#4a9e4a', liquid: '#e8d870', type: 'wine' },
  { path: '/menu-images/bela-vina/angel-belo-2019.png', name: 'Angel Belo', sub: '2019 Grande 3L', color: '#c9a227', liquid: '#dbc860', type: 'wine' },
  { path: '/menu-images/bela-vina/angel-belo-2021.png', name: 'Angel Belo', sub: '2021 Grande', color: '#d4af37', liquid: '#e8d870', type: 'wine' },
  { path: '/menu-images/bela-vina/bela-frankinja.png', name: 'Bela Frankinja', sub: 'Polsladko', color: '#daa520', liquid: '#f0d858', type: 'wine' },
  { path: '/menu-images/bela-vina/burja-bela.png', name: 'Burja Bela', sub: 'Demeter Eko', color: '#6b8e23', liquid: '#c8d870', type: 'wine' },
  { path: '/menu-images/bela-vina/chardonnay-dular.png', name: 'Chard. Dular', sub: 'Ekološko', color: '#b8860b', liquid: '#e0c850', type: 'wine' },
  { path: '/menu-images/bela-vina/chardonnay-verus.png', name: 'Chard. Verus', sub: 'Štajerska', color: '#e8c040', liquid: '#f0d860', type: 'wine' },
  { path: '/menu-images/bela-vina/chardonnay-vicomte.png', name: 'Chard. Vicomte', sub: 'II Cru Brda', color: '#ffd700', liquid: '#e8d060', type: 'wine' },
  { path: '/menu-images/bela-vina/cuvee-emino.png', name: 'Cuvee Emino', sub: 'Hiša vin', color: '#e8c84a', liquid: '#d8c060', type: 'wine' },
  { path: '/menu-images/bela-vina/laski-rizling.png', name: 'Laški Rizling', sub: 'Dolenjska', color: '#c8b560', liquid: '#e0d068', type: 'wine' },
  { path: '/menu-images/bela-vina/malvazija-movia.png', name: 'Malvazija', sub: 'Movia Brda', color: '#dbc682', liquid: '#d8c870', type: 'wine' },
  { path: '/menu-images/bela-vina/rebula-cru.png', name: 'Rebula Cru', sub: 'Simčič Brda', color: '#b8960b', liquid: '#d0c060', type: 'wine' },
  { path: '/menu-images/bela-vina/renski-rizling-keltis.png', name: 'R. Rizling', sub: 'Keltis Eko', color: '#a0c060', liquid: '#c8d868', type: 'wine' },
  { path: '/menu-images/bela-vina/renski-rizling-stare.png', name: 'R. Rizling', sub: 'Stare Trte 2015', color: '#8b7d3c', liquid: '#c0b058', type: 'wine' },
  { path: '/menu-images/bela-vina/rumeni-muskat-pozna.png', name: 'R. Muškat', sub: 'Pozna Trgatev', color: '#d4a030', liquid: '#e0b840', type: 'wine' },
  { path: '/menu-images/bela-vina/rumeni-muskat.png', name: 'Rumeni Muškat', sub: 'Polsladko', color: '#e8b830', liquid: '#e8c848', type: 'wine' },
  { path: '/menu-images/bela-vina/sauvignon-blanc-cru.png', name: 'Sauvignon', sub: 'Cru Veliki Vrh', color: '#8fbc8f', liquid: '#c0d870', type: 'wine' },
  { path: '/menu-images/bela-vina/sipon-verus.png', name: 'Šipon Verus', sub: 'Podravje', color: '#b5d69c', liquid: '#c8d060', type: 'wine' },
  { path: '/menu-images/bela-vina/sivi-pinot-jamertal.png', name: 'Sivi Pinot', sub: 'Jamertal', color: '#a89860', liquid: '#c8b860', type: 'wine' },
  { path: '/menu-images/bela-vina/traminec.png', name: 'Traminec', sub: 'Keltis', color: '#d8a060', liquid: '#d8b050', type: 'wine' },
  { path: '/menu-images/bela-vina/rebula.png', name: 'Rebula', sub: 'Blazic Brda', color: '#c8a840', liquid: '#d0c058', type: 'wine' },

  // BREZALK PIVO
  { path: '/menu-images/brezalk-pivo/daura.png', name: 'Daura', sub: 'Brezglutensko', color: '#d4a017', liquid: '#d8b030', type: 'beer' },
  { path: '/menu-images/brezalk-pivo/heineken-00.png', name: 'Heineken 0.0', sub: 'Brezalkoholno', color: '#00a651', liquid: '#c8a830', type: 'beer' },

  // CRAFT PIVA
  { path: '/menu-images/craft-piva/bevog-tak.png', name: 'Bevog Tak', sub: 'Pale Ale', color: '#d4770a', liquid: '#b07020', type: 'beer' },
  { path: '/menu-images/craft-piva/pelicon-winter.png', name: 'Pelicon Winter', sub: 'Temno Ale', color: '#4a2020', liquid: '#3a1a10', type: 'beer' },
  { path: '/menu-images/craft-piva/zeleni-haler.png', name: 'Zeleni Haler', sub: 'Konoplja Lager', color: '#2d7a2d', liquid: '#a0a030', type: 'beer' },

  // DESTILATI
  { path: '/menu-images/destilati/ararat-6.png', name: 'Ararat 6yo', sub: 'Vinjak', color: '#b8860b', liquid: '#a06020', type: 'spirit' },
  { path: '/menu-images/destilati/ararat-15.png', name: 'Ararat 15yo', sub: 'Premium', color: '#8b6914', liquid: '#804818', type: 'spirit' },
  { path: '/menu-images/destilati/ararat-20.png', name: 'Ararat 20yo', sub: 'Ultra Premium', color: '#6b4c14', liquid: '#603010', type: 'spirit' },
  { path: '/menu-images/destilati/brinjevec.png', name: 'Brinjevec', sub: 'Brinovec', color: '#2d5a27', liquid: '#a0b880', type: 'spirit' },
  { path: '/menu-images/destilati/delamaine-xo.png', name: 'Delamaine', sub: 'X.O. Konjak', color: '#8b4513', liquid: '#703810', type: 'spirit' },
  { path: '/menu-images/destilati/grappa-sofija.png', name: 'Grappa Sofija', sub: 'Rebula', color: '#a0a0c0', liquid: '#c0c0d0', type: 'spirit' },
  { path: '/menu-images/destilati/hennessy-vs.png', name: 'Hennessy V.S.', sub: 'Konjak', color: '#c8860b', liquid: '#a06020', type: 'spirit' },
  { path: '/menu-images/destilati/hennessy-xo.png', name: 'Hennessy X.O.', sub: 'Premium', color: '#8b6508', liquid: '#683808', type: 'spirit' },
  { path: '/menu-images/destilati/rum-bumbu.png', name: 'Rum Bumbu', sub: 'Barbados', color: '#d4720a', liquid: '#904818', type: 'spirit' },
  { path: '/menu-images/destilati/rum-diplomatico.png', name: 'Diplomatico', sub: 'Venezuela', color: '#8b3a0a', liquid: '#703010', type: 'spirit' },
  { path: '/menu-images/destilati/rum-hechicera.png', name: 'Hechicera', sub: '21yo Kolumbija', color: '#6b2a0a', liquid: '#582808', type: 'spirit' },
  { path: '/menu-images/destilati/rum-zacapa.png', name: 'Zacapa 23yo', sub: 'Guatemala', color: '#4a2a0a', liquid: '#502808', type: 'spirit' },
  { path: '/menu-images/destilati/slivovka.png', name: 'Slivovka', sub: 'Slivovec', color: '#6a2c70', liquid: '#a070a0', type: 'spirit' },
  { path: '/menu-images/destilati/travarica-rossi.png', name: 'Travarica', sub: 'Istra', color: '#3a6a20', liquid: '#90a860', type: 'spirit' },
  { path: '/menu-images/destilati/viljamovka.png', name: 'Viljamovka', sub: 'Hruškovce', color: '#a0c040', liquid: '#b8d060', type: 'spirit' },

  // GAZIRANE PIJACE
  { path: '/menu-images/gazirane-pijace/coca-cola-zero.png', name: 'Cola Zero', sub: '0.33L', color: '#1a1a1a', liquid: '#2a1515', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/cockta.png', name: 'Cockta', sub: 'Slovenska', color: '#8b4513', liquid: '#4a2010', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fanta.png', name: 'Fanta', sub: 'Pomaranča', color: '#ff8c00', liquid: '#e08000', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fever-tree-med.png', name: 'Fever Tree', sub: 'Mediterranean', color: '#20b2aa', liquid: '#a0d0c0', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', name: 'Fever Tree', sub: 'Rhubarb', color: '#dc143c', liquid: '#c03050', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/fever-tree-tonic.png', name: 'Fever Tree', sub: 'Indian Tonic', color: '#4682b4', liquid: '#b0c8d0', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/red-bull.png', name: 'Red Bull', sub: 'Energy', color: '#1e3a5f', liquid: '#a0a8b0', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/schweppes-bitter.png', name: 'Schweppes', sub: 'Bitter Lemon', color: '#daa520', liquid: '#c0a030', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/schweppes-tonic.png', name: 'Schweppes', sub: 'Tonic Water', color: '#2e8b57', liquid: '#a0c8b0', type: 'drink' },
  { path: '/menu-images/gazirane-pijace/sprite.png', name: 'Sprite', sub: 'Lemon-Lime', color: '#32cd32', liquid: '#a0d040', type: 'drink' },

  // GIN
  { path: '/menu-images/gin/gin-hendricks.png', name: "Hendrick's", sub: 'Škotska', color: '#2f2f4f', liquid: '#9098b0', type: 'spirit' },
  { path: '/menu-images/gin/gin-kristal.png', name: 'Gin Kristal', sub: 'London Dry', color: '#4a8ec8', liquid: '#a0c0d8', type: 'spirit' },
  { path: '/menu-images/gin/gin-mare.png', name: 'Gin Mare', sub: 'Mediterranean', color: '#5f9ea0', liquid: '#a0c8c8', type: 'spirit' },
  { path: '/menu-images/gin/gin-monkey47.png', name: 'Monkey 47', sub: 'Schwarzwald', color: '#3a3a1a', liquid: '#909070', type: 'spirit' },
  { path: '/menu-images/gin/gin-monolog.png', name: 'Gin Monolog', sub: 'Slovenija', color: '#6a8caa', liquid: '#a0b8c8', type: 'spirit' },
  { path: '/menu-images/gin/gin-tanqueray.png', name: 'Tanqueray', sub: 'London Dry', color: '#2e6b2e', liquid: '#90b890', type: 'spirit' },

  // GRENCICE
  { path: '/menu-images/grencice/amaro.png', name: 'Amaro', sub: 'Zeliščni', color: '#5a3a20', liquid: '#604020', type: 'spirit' },
  { path: '/menu-images/grencice/aperol.png', name: 'Aperol', sub: 'Aperitiv', color: '#ff4500', liquid: '#d04020', type: 'spirit' },
  { path: '/menu-images/grencice/campari.png', name: 'Campari', sub: 'Bitter', color: '#cc0000', liquid: '#a01010', type: 'spirit' },
  { path: '/menu-images/grencice/cynar.png', name: 'Cynar', sub: 'Artičoka', color: '#6b4226', liquid: '#504020', type: 'spirit' },
  { path: '/menu-images/grencice/jagermeister.png', name: 'Jägermeister', sub: 'Zeliščni', color: '#1a4a1a', liquid: '#304020', type: 'spirit' },

  // LIKERJI
  { path: '/menu-images/likerji/borovnica-kejzar.png', name: 'Borovnica', sub: 'Kejžar', color: '#2a1a6a', liquid: '#4030a0', type: 'spirit' },
  { path: '/menu-images/likerji/bumbu-cream.png', name: 'Bumbu Cream', sub: 'Rum Liker', color: '#d2b48c', liquid: '#c0a070', type: 'spirit' },
  { path: '/menu-images/likerji/canella.png', name: 'Canella', sub: 'Prosecco', color: '#daa520', liquid: '#c09030', type: 'spirit' },
  { path: '/menu-images/likerji/carolans.png', name: 'Carolans', sub: 'Irish Cream', color: '#8b6914', liquid: '#a08040', type: 'spirit' },
  { path: '/menu-images/likerji/malibu.png', name: 'Malibu', sub: 'Kokos Rum', color: '#f5f5dc', liquid: '#d0d0b0', type: 'spirit' },
  { path: '/menu-images/likerji/medica-kejzar.png', name: 'Medica', sub: 'Kejžar', color: '#daa520', liquid: '#c09030', type: 'spirit' },

  // LIKERSKO VINO
  { path: '/menu-images/likersko-vino/keros-belo.png', name: 'Keros Belo', sub: 'Sladko 2020', color: '#f5deb3', liquid: '#d8c060', type: 'wine' },
  { path: '/menu-images/likersko-vino/keros-rdece.png', name: 'Keros Rdeče', sub: 'Sladko 2018', color: '#8b0000', liquid: '#801818', type: 'wine' },
  { path: '/menu-images/likersko-vino/sladki-refosk.png', name: 'Sl. Refošk', sub: 'Sladko', color: '#722f37', liquid: '#702020', type: 'wine' },
  { path: '/menu-images/likersko-vino/veliko-rdece-2012.png', name: 'Veliko Rdeče', sub: 'Movia 3L', color: '#4a0a0a', liquid: '#501818', type: 'wine' },

  // MESANE PIJACE
  { path: '/menu-images/mesane-pijace/cuba-libre.png', name: 'Cuba Libre', sub: 'Rum in Cola', color: '#8b4513', liquid: '#804020', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/gin-mare-tonic.png', name: 'Gin Mare GT', sub: 'Mediterranean', color: '#5f9ea0', liquid: '#a0c8c0', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', name: "Hendrick's GT", sub: 'Kumara', color: '#708090', liquid: '#a0b0b8', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/mango-mojito.png', name: 'Mango Mojito', sub: 'Rum in Mango', color: '#ff8c00', liquid: '#d08020', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/martini-spritz.png', name: 'Martini Spritz', sub: 'Bianco', color: '#f0e68c', liquid: '#d0c060', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', name: 'Monkey 47 GT', sub: 'Schwarzwald', color: '#556b2f', liquid: '#90a060', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/monolog-gin-tonic.png', name: 'Monolog GT', sub: 'Slovenija', color: '#6a8caa', liquid: '#a0b8c8', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', name: 'Orange Ginger', sub: 'Gin Tonic', color: '#ff6347', liquid: '#d06030', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', name: 'Raspberry GT', sub: 'Pink Gin', color: '#dc143c', liquid: '#c03050', type: 'cocktail' },
  { path: '/menu-images/mesane-pijace/strawberry-mojito.png', name: 'Straw. Mojito', sub: 'Rum in Jagoda', color: '#e74c6f', liquid: '#d04060', type: 'cocktail' },

  // NARAVNI SOKOVI
  { path: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', name: 'Led. Čaj', sub: 'Hišni Domač', color: '#8b4513', liquid: '#a07030', type: 'drink' },
  { path: '/menu-images/naravni-sokovi/hisni-sok-meta.png', name: 'Sok Meta', sub: 'Hišni Domač', color: '#2e8b57', liquid: '#70b870', type: 'drink' },
  { path: '/menu-images/naravni-sokovi/limonada-okus.png', name: 'Limonada', sub: 'Bezeg in Ingver', color: '#ff69b4', liquid: '#d07080', type: 'drink' },
  { path: '/menu-images/naravni-sokovi/pomarancni-sok.png', name: 'Pom. Sok', sub: 'Sveže Stisnjen', color: '#ff8c00', liquid: '#d08020', type: 'drink' },

  // PENINE
  { path: '/menu-images/penine/bjana-brut.png', name: 'Bjana Brut', sub: 'Brda', color: '#e8d88c', liquid: '#d8c860', type: 'wine' },
  { path: '/menu-images/penine/boemme-rumeni-muskat.png', name: 'Boemme', sub: 'R. Muškat', color: '#d4a030', liquid: '#d0b040', type: 'wine' },
  { path: '/menu-images/penine/gourmet-rose.png', name: 'Gourmet', sub: 'Rosé Istenič', color: '#e75480', liquid: '#d06070', type: 'wine' },
  { path: '/menu-images/penine/louis-roederer.png', name: 'L. Roederer', sub: 'Champagne', color: '#c9a227', liquid: '#c8a830', type: 'wine' },
  { path: '/menu-images/penine/maria-brut.png', name: 'Maria Brut', sub: 'Kerin', color: '#dbc682', liquid: '#d0c060', type: 'wine' },
  { path: '/menu-images/penine/mufi-pet-nat.png', name: 'Mufi Pet Nat', sub: 'Brut Nature', color: '#a0c060', liquid: '#b8c850', type: 'wine' },
  { path: '/menu-images/penine/no1-brut.png', name: 'No.1 Brut', sub: 'Istenič', color: '#c8b060', liquid: '#c0a848', type: 'wine' },
  { path: '/menu-images/penine/pol-roger.png', name: 'Pol Roger', sub: 'Champagne', color: '#d4af37', liquid: '#c8a030', type: 'wine' },
  { path: '/menu-images/penine/slapsak-brut-reserve.png', name: 'Slapšak', sub: 'Brut Reserve', color: '#b8960b', liquid: '#b09028', type: 'wine' },
  { path: '/menu-images/penine/slapsak-brut-rose.png', name: 'Slapšak', sub: 'Brut Rosé', color: '#e07080', liquid: '#c86070', type: 'wine' },
  { path: '/menu-images/penine/zlata-radgonska.png', name: 'Zl. Radgonska', sub: 'Brut Selection', color: '#ffd700', liquid: '#c8a830', type: 'wine' },

  // PIVO
  { path: '/menu-images/pivo/reset-froggy.png', name: 'Reset Froggy', sub: 'IPA', color: '#2d8c2d', liquid: '#a08830', type: 'beer' },
  { path: '/menu-images/pivo/reset-lagerish.png', name: 'Reset Lager.', sub: 'Cream Ale', color: '#d4a017', liquid: '#c8a830', type: 'beer' },
  { path: '/menu-images/pivo/reset-stout.png', name: 'Reset Stout', sub: 'Irish Extra', color: '#1a0a0a', liquid: '#201810', type: 'beer' },

  // RDECA VINA
  { path: '/menu-images/rdeca-vina/cabernet-keltis.png', name: 'Cabernet', sub: 'Keltis Eko', color: '#4a0a0a', liquid: '#601818', type: 'wine' },
  { path: '/menu-images/rdeca-vina/cabernet-pavo.png', name: 'Cabernet', sub: 'Pavo Limited', color: '#6a1a1a', liquid: '#702020', type: 'wine' },
  { path: '/menu-images/rdeca-vina/carolina-rdeca.png', name: 'Carolina', sub: 'Rdeča Jakončič', color: '#5a1a1a', liquid: '#682020', type: 'wine' },
  { path: '/menu-images/rdeca-vina/duet-edi-simcic.png', name: 'Duet Simčič', sub: '2021 Brda', color: '#7a2a2a', liquid: '#702828', type: 'wine' },
  { path: '/menu-images/rdeca-vina/duet-lex-2018.png', name: 'Duet Lex', sub: '2018 Magnum', color: '#3a0a0a', liquid: '#501818', type: 'wine' },
  { path: '/menu-images/rdeca-vina/duet-lex-2020.png', name: 'Duet Lex', sub: '2020 Brda', color: '#5a1a1a', liquid: '#682020', type: 'wine' },
  { path: '/menu-images/rdeca-vina/guerila-retro.png', name: 'Guerila Retro', sub: 'Vipavska', color: '#8b0000', liquid: '#801818', type: 'wine' },
  { path: '/menu-images/rdeca-vina/merlot-keltis.png', name: 'Merlot', sub: 'Keltis Eko', color: '#6a1a2a', liquid: '#682028', type: 'wine' },
  { path: '/menu-images/rdeca-vina/merlot-opoka.png', name: 'Merlot Opoka', sub: 'Simčič Brda', color: '#3a0a0a', liquid: '#501818', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-dular.png', name: 'M. Frankinja', sub: 'Dular Eko', color: '#5a1a3a', liquid: '#682040', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-luna.png', name: 'M. Frankinja', sub: 'Luna Kobal', color: '#7a1a4a', liquid: '#702848', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modri-pinot-opoka.png', name: 'M. Pinot', sub: 'Opoka Simčič', color: '#4a0a2a', liquid: '#581838', type: 'wine' },
  { path: '/menu-images/rdeca-vina/modri-pinot-verus.png', name: 'M. Pinot', sub: 'Verus Ormož', color: '#6a1a2a', liquid: '#682028', type: 'wine' },
  { path: '/menu-images/rdeca-vina/veliko-rdece-movia.png', name: 'Veliko Rdeče', sub: 'Movia Brda', color: '#3a0a1a', liquid: '#501820', type: 'wine' },

  // ROSE
  { path: '/menu-images/rose-vino/rose-batic.png', name: 'Rosé Batič', sub: 'Vipavska', color: '#e75480', liquid: '#d06070', type: 'wine' },
  { path: '/menu-images/rose-vino/rose-verstovsek.png', name: 'Rosé', sub: 'Verstovšek', color: '#f08080', liquid: '#d07070', type: 'wine' },

  // SOKOVI
  { path: '/menu-images/sokovi/ananasov-sok.png', name: 'Ananasov Sok', sub: 'Tropski', color: '#daa520', liquid: '#c09020', type: 'drink' },
  { path: '/menu-images/sokovi/bubble-tea.png', name: 'Bubble Tea', sub: 'Boba', color: '#9370db', liquid: '#a080c0', type: 'drink' },
  { path: '/menu-images/sokovi/cedevita.png', name: 'Cedevita', sub: 'Vitamin', color: '#ff6347', liquid: '#d06030', type: 'drink' },
  { path: '/menu-images/sokovi/jabolcni-sok.png', name: 'Jabolčni Sok', sub: '100% Naravni', color: '#8fbc8f', liquid: '#a0b860', type: 'drink' },
  { path: '/menu-images/sokovi/jagodni-sok.png', name: 'Jagodni Sok', sub: 'Jagode', color: '#dc143c', liquid: '#c03040', type: 'drink' },
  { path: '/menu-images/sokovi/ledeni-caj.png', name: 'Led. Čaj', sub: 'Hladen', color: '#b8860b', liquid: '#a07030', type: 'drink' },
  { path: '/menu-images/sokovi/marelicni-sok.png', name: 'Marelični Sok', sub: 'Marelice', color: '#f4a460', liquid: '#c08040', type: 'drink' },
  { path: '/menu-images/sokovi/pomarancni-sok.png', name: 'Pom. Sok', sub: '0.20L', color: '#ff8c00', liquid: '#d08020', type: 'drink' },
  { path: '/menu-images/sokovi/ribezov-sok.png', name: 'Ribezov Sok', sub: 'Rdeči Ribez', color: '#8b0000', liquid: '#701818', type: 'drink' },

  // TOCENO PIVO
  { path: '/menu-images/toceno-pivo/haler-nefiltriran.png', name: 'Haler', sub: 'Nefiltriran', color: '#d4a017', liquid: '#c8a030', type: 'beer' },
  { path: '/menu-images/toceno-pivo/pelicon-ipa.png', name: 'Pelicon IPA', sub: '3rd Pill', color: '#b8860b', liquid: '#a07828', type: 'beer' },
  { path: '/menu-images/toceno-pivo/radler.png', name: 'Radler', sub: 'Grenivka', color: '#e8a020', liquid: '#c89030', type: 'beer' },
  { path: '/menu-images/toceno-pivo/union-lager.png', name: 'Union Lager', sub: '0.30/0.50L', color: '#c8a030', liquid: '#c09828', type: 'beer' },

  // TOPLI NAPITKI
  { path: '/menu-images/topli-napitki/babyccino.png', name: 'Babyccino', sub: 'Otroška', color: '#f5deb3', liquid: '#c8a870', type: 'coffee' },
  { path: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', name: 'Bela Kava', sub: 'Brez Kofeina', color: '#d2b48c', liquid: '#b89870', type: 'coffee' },
  { path: '/menu-images/topli-napitki/bela-kava.png', name: 'Bela Kava', sub: 'Z Mlekom', color: '#deb887', liquid: '#c0a070', type: 'coffee' },
  { path: '/menu-images/topli-napitki/caj-limona-med.png', name: 'Čaj', sub: 'Limona in Med', color: '#daa520', liquid: '#a08830', type: 'coffee' },
  { path: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', name: 'Cappuccino', sub: 'Brez Kofeina', color: '#c8a880', liquid: '#a08060', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kakav-smetana.png', name: 'Kakav', sub: 'S Smetano', color: '#6b3a20', liquid: '#503018', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kakav.png', name: 'Kakav', sub: 'Čokoladni', color: '#8b4513', liquid: '#583020', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-brez-kofeina.png', name: 'Espresso', sub: 'Brez Kofeina', color: '#3a2010', liquid: '#302010', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-macchiato.png', name: 'Macchiato', sub: 'S Kapljico', color: '#4a2a10', liquid: '#402818', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', name: 'Kava Mleko', sub: 'Brez Kofeina', color: '#b89870', liquid: '#a08860', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-rizevo-mleko.png', name: 'Kava', sub: 'Riževo Mleko', color: '#d2c8a0', liquid: '#b0a880', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-s-smetano.png', name: 'Kava', sub: 'S Smetano', color: '#6b3a20', liquid: '#503018', type: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-z-mlekom.png', name: 'Kava', sub: 'Z Mlekom', color: '#8b6914', liquid: '#705830', type: 'coffee' },
  { path: '/menu-images/topli-napitki/ledena-kava-olimia.png', name: 'Ledena Kava', sub: 'Olimia', color: '#4a3020', liquid: '#382818', type: 'coffee' },
  { path: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', name: 'Macchiato', sub: 'Brez Kofeina', color: '#5a3a20', liquid: '#483018', type: 'coffee' },
  { path: '/menu-images/topli-napitki/vroca-cokolada.png', name: 'Vr. Čokolada', sub: 'Gosta', color: '#3a1a0a', liquid: '#301810', type: 'coffee' },

  // TUJA VINA
  { path: '/menu-images/tuja-vina/andreis-vinasmora.png', name: 'Andreis', sub: 'Hrvaška Rdeče', color: '#5a1a1a', liquid: '#682020', type: 'wine' },
  { path: '/menu-images/tuja-vina/jermann-dreams.png', name: 'Jermann', sub: 'Dreams Italija', color: '#d4af37', liquid: '#d0b840', type: 'wine' },
  { path: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', name: 'Plavac Mali', sub: 'Hrvaška', color: '#7a1a1a', liquid: '#702020', type: 'wine' },
  { path: '/menu-images/tuja-vina/posip-terra-madre.png', name: 'Pošip', sub: 'Hrvaška Belo', color: '#c8b060', liquid: '#d0c058', type: 'wine' },
  { path: '/menu-images/tuja-vina/vintage-tunina.png', name: 'Vintage', sub: 'Tunina Italija', color: '#b8960b', liquid: '#c0a040', type: 'wine' },
  { path: '/menu-images/tuja-vina/vranec-instinct.png', name: 'Vranec', sub: 'Makedonija', color: '#3a0a1a', liquid: '#501828', type: 'wine' },

  // VISKI
  { path: '/menu-images/viski/chivas-12.png', name: 'Chivas 12yo', sub: 'Blended', color: '#b8860b', liquid: '#906020', type: 'spirit' },
  { path: '/menu-images/viski/glenmorangie-18.png', name: 'Glenm. 18', sub: 'Highland', color: '#8b6914', liquid: '#804820', type: 'spirit' },
  { path: '/menu-images/viski/glenmorangie-lasanta.png', name: 'Glenm.', sub: 'Lasanta 12', color: '#a0522d', liquid: '#804020', type: 'spirit' },
  { path: '/menu-images/viski/jameson.png', name: 'Jameson', sub: 'Irska', color: '#2e4a1a', liquid: '#806830', type: 'spirit' },
  { path: '/menu-images/viski/johnnie-walker-black.png', name: 'J. Walker', sub: 'Black Label', color: '#1a1a1a', liquid: '#604020', type: 'spirit' },
  { path: '/menu-images/viski/lagavulin-16.png', name: 'Lagavulin 16', sub: 'Islay', color: '#2a1a0a', liquid: '#503820', type: 'spirit' },
  { path: '/menu-images/viski/laphroaig-10.png', name: 'Laphroaig 10', sub: 'Islay', color: '#1a3a1a', liquid: '#505830', type: 'spirit' },
  { path: '/menu-images/viski/nikka-barrel.png', name: 'Nikka Barrel', sub: 'Japonska', color: '#4a2a0a', liquid: '#705020', type: 'spirit' },
  { path: '/menu-images/viski/nikka-miyagikyo.png', name: 'Nikka', sub: 'Miyagikyo', color: '#6a3a1a', liquid: '#805828', type: 'spirit' },

  // VODE
  { path: '/menu-images/vode/mineralna-voda.png', name: 'Mineralna', sub: 'Gazirana', color: '#4682b4', liquid: '#a0c8d8', type: 'drink' },
  { path: '/menu-images/vode/naravna-voda.png', name: 'Naravna', sub: 'Mirna', color: '#5f9ea0', liquid: '#a0d0d0', type: 'drink' },
  { path: '/menu-images/vode/radenska-functionall.png', name: 'Radenska', sub: 'FunctionALL', color: '#20b2aa', liquid: '#a0d0c0', type: 'drink' },
  { path: '/menu-images/vode/voda-z-okusom.png', name: 'Voda Okus', sub: 'Okusna', color: '#87ceeb', liquid: '#b0d8e8', type: 'drink' },
];

function buildSVG(item) {
  const h = hashStr(item.name + item.sub);
  const c = item.color;
  const bg1 = darken(c, 0.7);
  const bg2 = darken(c, 0.85);

  // Unique decorative particles based on hash
  let particles = '';
  const seed = parseInt(h.slice(0, 8), 16);
  for (let i = 0; i < 8; i++) {
    const px = 30 + ((seed * (i + 1) * 7) % 340);
    const py = 30 + ((seed * (i + 1) * 13) % 440);
    const pr = 1.5 + ((seed * (i + 1)) % 4);
    particles += `<circle cx="${px}" cy="${py}" r="${pr}" fill="${lighten(c, 0.4)}" opacity="0.08"/>`;
  }

  // Select silhouette based on type
  let silhouette;
  const label = (item.name + ' ' + item.sub).trim();
  switch (item.type) {
    case 'wine': silhouette = wineBottle(label, c, item.liquid); break;
    case 'beer': silhouette = beerGlass(label, c, item.liquid); break;
    case 'spirit': silhouette = spiritBottle(label, c, item.liquid); break;
    case 'coffee': silhouette = coffeeCup(label, c, item.liquid); break;
    case 'cocktail': silhouette = cocktailGlass(label, c, item.liquid); break;
    case 'drink': silhouette = softDrinkBottle(label, c, item.liquid); break;
    default: silhouette = wineBottle(label, c, item.liquid); break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg-${h.slice(0,8)}" x1="0%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" style="stop-color:${bg1}"/>
      <stop offset="100%" style="stop-color:${bg2}"/>
    </linearGradient>
    <radialGradient id="spot-${h.slice(0,8)}" cx="50%" cy="45%" r="55%">
      <stop offset="0%" style="stop-color:${c};stop-opacity:0.12"/>
      <stop offset="100%" style="stop-color:${c};stop-opacity:0"/>
    </radialGradient>
    <linearGradient id="surface-${h.slice(0,8)}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${darken(c, 0.7)};stop-opacity:0"/>
      <stop offset="100%" style="stop-color:rgba(0,0,0,0.3)"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg-${h.slice(0,8)})"/>
  <rect width="${W}" height="${H}" fill="url(#spot-${h.slice(0,8)})"/>

  <!-- Unique particles -->
  ${particles}

  <!-- Surface gradient -->
  <rect y="400" width="${W}" height="100" fill="url(#surface-${h.slice(0,8)})" opacity="0.5"/>

  <!-- Main product silhouette -->
  ${silhouette}

  <!-- Bottom info bar -->
  <rect x="0" y="435" width="${W}" height="65" fill="rgba(0,0,0,0.5)"/>
  <line x1="20" y1="436" x2="${W - 20}" y2="436" stroke="${c}" stroke-width="1" opacity="0.6"/>
  <text x="${W/2}" y="460" text-anchor="middle" fill="${lighten(c, 0.5)}" font-size="16" font-weight="bold" font-family="Arial,Helvetica,sans-serif" letter-spacing="1">${item.name}</text>
  <text x="${W/2}" y="480" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="10" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.5">${item.sub}</text>

  <!-- Corner accents -->
  <path d="M0,0 L30,0 L0,30 Z" fill="${c}" opacity="0.1"/>
  <path d="M${W},${H} L${W-30},${H} L${W},${H-30} Z" fill="${c}" opacity="0.1"/>
</svg>`;
}

async function main() {
  console.log(`\n🎨 Generating ${ITEMS.length} PROFESSIONAL menu images...\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const fp = join(process.cwd(), 'public', item.path);
    const dir = dirname(fp);
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const svg = buildSVG(item);
      await sharp(Buffer.from(svg)).resize(W, H, { fit: 'fill' }).png({ quality: 90 }).toFile(fp);
      ok++;
      if ((i + 1) % 20 === 0 || i === ITEMS.length - 1) {
        console.log(`  ✓ ${i+1}/${ITEMS.length} (${ok} ok, ${fail} fail)`);
      }
    } catch (err) {
      console.error(`  ✗ ${item.path}: ${err.message.slice(0, 80)}`);
      fail++;
    }
  }
  console.log(`\n✅ Done! ${ok} generated, ${fail} failed out of ${ITEMS.length}`);
}

main().catch(console.error);
