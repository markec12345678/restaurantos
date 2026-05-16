import fs from 'fs';
import path from 'path';

const OUTPUT_BASE = '/home/z/my-project/public/menu-images';

// Color palettes for different categories
const COLORS = {
  whiteWine: ['#f5e6a3', '#e8d678', '#dcc34f', '#c9b037', '#b89d2a'],
  redWine: ['#722f37', '#8b3a42', '#6b1c23', '#943440', '#5c1a1f'],
  roseWine: ['#e8a0b4', '#d4788f', '#c25a78', '#e6909f', '#d07088'],
  sparkling: ['#f0e68c', '#daa520', '#f5deb3', '#ffd700', '#c9a830'],
  beer: ['#d4a017', '#c8931a', '#e8b830', '#a67c00', '#b8860b'],
  coffee: ['#3e1f0d', '#5c3317', '#704214', '#8b5a2b', '#4a2c0a'],
  juice: ['#ff8c00', '#ffa500', '#ff6347', '#ff4500', '#e87400'],
  cocktail: ['#ff69b4', '#00ced1', '#9370db', '#20b2aa', '#ff6b6b'],
  water: ['#87ceeb', '#add8e6', '#b0e0e6', '#5f9ea0', '#6bb3d9'],
  spirits: ['#d4af37', '#c19a6b', '#b8860b', '#daa520', '#a0522d'],
  liqueur: ['#ff69b4', '#9370db', '#da70d6', '#ff1493', '#ba55d3'],
  bitters: ['#2e4600', '#4a7c00', '#3d5c00', '#556b2f', '#6b8e23'],
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex, amount = 0.3) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * amount));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function lighten(hex, amount = 0.3) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// =============================================
// SVG GENERATION FUNCTIONS
// =============================================

function wineGlassSvg(liquidColor, label, subtitle = '', decorations = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.2)}"/>
      <stop offset="100%" stop-color="${darken(liquidColor, 0.15)}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="30%" stop-color="rgba(255,255,255,0.15)"/>
      <stop offset="70%" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.1)"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  ${decorations}
  <g filter="url(#shadow)" transform="translate(200,180)">
    <!-- Glass bowl -->
    <path d="M-55,-70 Q-60,10 0,50 Q60,10 55,-70 Z" fill="url(#glass)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M-50,-50 Q-55,10 0,45 Q55,10 50,-50 Z" fill="url(#liquid)" opacity="0.85"/>
    <!-- Liquid surface highlight -->
    <ellipse cx="0" cy="-48" rx="48" ry="8" fill="${lighten(liquidColor, 0.3)}" opacity="0.4"/>
    <!-- Glass rim -->
    <ellipse cx="0" cy="-70" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <!-- Stem -->
    <rect x="-3" y="50" width="6" height="60" fill="rgba(255,255,255,0.12)" rx="2"/>
    <!-- Base -->
    <ellipse cx="0" cy="112" rx="40" ry="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <!-- Glass reflection -->
    <path d="M-40,-60 Q-45,0 -20,30" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function champagneFluteSvg(liquidColor, label, subtitle = '', bubbles = true) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.25)}"/>
      <stop offset="100%" stop-color="${darken(liquidColor, 0.1)}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,170)">
    <!-- Glass body (tall narrow) -->
    <path d="M-28,-100 Q-32,20 0,60 Q32,20 28,-100 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M-26,-70 Q-30,20 0,55 Q30,20 26,-70 Z" fill="url(#liquid)" opacity="0.8"/>
    <!-- Bubbles -->
    ${bubbles ? Array.from({length: 12}, (_, i) => {
      const x = -15 + Math.random() * 30;
      const y = -60 + Math.random() * 100;
      const r = 1 + Math.random() * 2;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.4)"/>`;
    }).join('\n    ') : ''}
    <!-- Rim -->
    <ellipse cx="0" cy="-100" rx="28" ry="6" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <!-- Stem -->
    <rect x="-2.5" y="60" width="5" height="50" fill="rgba(255,255,255,0.1)" rx="2"/>
    <!-- Base -->
    <ellipse cx="0" cy="112" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <!-- Reflection -->
    <path d="M-18,-85 Q-20,-10 -8,35" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function coffeeCupSvg(liquidColor, hasMilk = false, hasCream = false, label = '', subtitle = '') {
  const milkLayer = hasMilk ? `<ellipse cx="0" cy="-40" rx="40" ry="12" fill="rgba(255,248,220,0.6)"/>` : '';
  const creamTop = hasCream ? `<ellipse cx="0" cy="-45" rx="38" ry="10" fill="rgba(255,255,255,0.8)"/>
    <ellipse cx="5" cy="-47" rx="20" ry="6" fill="rgba(255,255,255,0.4)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.15)}"/>
      <stop offset="100%" stop-color="${darken(liquidColor, 0.2)}"/>
    </linearGradient>
    <linearGradient id="cup" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8e0d0"/>
      <stop offset="100%" stop-color="#c4b8a4"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(185,190)">
    <!-- Saucer -->
    <ellipse cx="0" cy="75" rx="60" ry="12" fill="#d4c8b0" opacity="0.7"/>
    <!-- Cup body -->
    <path d="M-42,-50 L-38,60 Q0,75 38,60 L42,-50 Z" fill="url(#cup)" opacity="0.9"/>
    <!-- Cup rim -->
    <ellipse cx="0" cy="-50" rx="42" ry="12" fill="#e8e0d0" stroke="#c4b8a4" stroke-width="1"/>
    <!-- Liquid -->
    <ellipse cx="0" cy="-45" rx="38" ry="10" fill="url(#liquid)"/>
    ${milkLayer}
    ${creamTop}
    <!-- Handle -->
    <path d="M42,-30 Q70,-25 70,10 Q70,40 42,45" fill="none" stroke="#c4b8a4" stroke-width="6" stroke-linecap="round"/>
    <!-- Steam -->
    <path d="M-10,-65 Q-15,-85 -5,-100" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>
    <path d="M5,-62 Q10,-80 0,-95" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linecap="round"/>
    <path d="M15,-60 Q20,-78 12,-92" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function beerGlassSvg(liquidColor, foamColor, label, subtitle = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.15)}"/>
      <stop offset="100%" stop-color="${darken(liquidColor, 0.2)}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(185,175)">
    <!-- Glass body -->
    <path d="M-45,-80 L-40,70 Q0,85 40,70 L45,-80 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M-43,-30 L-39,68 Q0,82 39,68 L43,-30 Z" fill="url(#liquid)" opacity="0.85"/>
    <!-- Foam -->
    <path d="M-43,-30 Q-43,-55 0,-55 Q43,-55 43,-30 Q0,-25 -43,-30 Z" fill="${foamColor}" opacity="0.9"/>
    <!-- Foam bubbles -->
    ${Array.from({length: 8}, () => {
      const x = -30 + Math.random() * 60;
      const y = -55 + Math.random() * 25;
      const r = 3 + Math.random() * 6;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${foamColor}" opacity="0.7"/>`;
    }).join('\n    ')}
    <!-- Rim -->
    <ellipse cx="0" cy="-80" rx="45" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <!-- Handle -->
    <path d="M45,-50 Q80,-45 80,10 Q80,55 45,60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8" stroke-linecap="round"/>
    <!-- Reflection -->
    <path d="M-30,-70 Q-33,-10 -25,50" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function cocktailSvg(liquidColor, garnish, glassType, label, subtitle = '') {
  const isHighball = glassType === 'highball';
  const isCoupe = glassType === 'coupe';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.2)}"/>
      <stop offset="100%" stop-color="${darken(liquidColor, 0.15)}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,175)">
    ${isHighball ? `
    <!-- Highball glass -->
    <path d="M-30,-80 L-27,65 Q0,75 27,65 L30,-80 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-28,-50 L-26,62 Q0,72 26,62 L28,-50 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-80" rx="30" ry="7" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    ` : isCoupe ? `
    <!-- Coupe glass -->
    <path d="M-55,-40 Q-60,20 0,50 Q60,20 55,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-50,-25 Q-55,15 0,42 Q55,15 50,-25 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-2.5" y="50" width="5" height="45" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="97" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    ` : `
    <!-- Rocks glass -->
    <path d="M-40,-40 L-35,50 Q0,60 35,50 L40,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-38,-20 L-34,47 Q0,57 34,47 L38,-20 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="40" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    `}
    <!-- Ice cubes -->
    ${Array.from({length: 3}, (_, i) => {
      const x = -12 + i * 12;
      const y = isHighball ? -30 + i * 10 : -15 + i * 5;
      return `<rect x="${x}" y="${y}" width="10" height="10" rx="2" fill="rgba(255,255,255,0.15)" transform="rotate(${i*15},${x+5},${y+5})"/>`;
    }).join('\n    ')}
    <!-- Garnish -->
    ${garnish}
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function juiceGlassSvg(liquidColor, fruitGarnish, label, subtitle = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.2)}"/>
      <stop offset="100%" stop-color="${darken(liquidColor, 0.15)}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <!-- Glass -->
    <path d="M-32,-70 L-28,55 Q0,65 28,55 L32,-70 Z" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M-30,-40 L-27,52 Q0,62 27,52 L30,-40 Z" fill="url(#liquid)" opacity="0.85"/>
    <!-- Rim -->
    <ellipse cx="0" cy="-70" rx="32" ry="8" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
    <!-- Fruit garnish -->
    ${fruitGarnish}
    <!-- Reflection -->
    <path d="M-22,-60 Q-24,-5 -18,45" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function spiritGlassSvg(liquidColor, label, subtitle = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.15)}"/>
      <stop offset="100%" stop-color="${darken(liquidColor, 0.2)}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <!-- Snifter/tumbler -->
    <path d="M-35,-50 Q-45,10 -30,50 Q0,65 30,50 Q45,10 35,-50 Z" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M-33,-20 Q-42,10 -28,46 Q0,60 28,46 Q42,10 33,-20 Z" fill="url(#liquid)" opacity="0.8"/>
    <!-- Rim -->
    <ellipse cx="0" cy="-50" rx="35" ry="9" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <!-- Reflection -->
    <path d="M-25,-45 Q-30,0 -20,40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function waterGlassSvg(liquidColor, label, subtitle = '', bubbles = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(liquidColor, 0.3)}"/>
      <stop offset="100%" stop-color="${liquidColor}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <!-- Glass -->
    <path d="M-35,-70 L-30,55 Q0,65 30,55 L35,-70 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <!-- Liquid -->
    <path d="M-33,-40 L-29,52 Q0,62 29,52 L33,-40 Z" fill="url(#liquid)" opacity="0.5"/>
    <!-- Rim -->
    <ellipse cx="0" cy="-70" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
    ${bubbles ? Array.from({length: 8}, () => {
      const x = -15 + Math.random() * 30;
      const y = -30 + Math.random() * 70;
      const r = 1 + Math.random() * 2;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.3)"/>`;
    }).join('\n    ') : ''}
    <!-- Reflection -->
    <path d="M-24,-60 Q-26,-5 -20,45" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

// =============================================
// ITEM DEFINITIONS
// =============================================

const items = [
  // BELA VINA
  { file: 'bela-vina/cuvee-emino.png', fn: () => wineGlassSvg('#e8d44d', 'Cuvee Emino', 'Belo vino', '<circle cx="70" cy="80" r="25" fill="rgba(232,212,77,0.08)"/>') },
  { file: 'bela-vina/chardonnay-verus.png', fn: () => wineGlassSvg('#f0d860', 'Chardonnay Verus', 'Belo vino') },
  { file: 'bela-vina/sauvignon-blanc-cru.png', fn: () => wineGlassSvg('#e8d870', 'Sauvignon Blanc Cru', 'Belo vino', '<circle cx="320" cy="100" r="30" fill="rgba(232,216,112,0.06)"/>') },
  { file: 'bela-vina/laski-rizling.png', fn: () => wineGlassSvg('#f5e070', 'Laski Rizling', 'Belo vino') },
  { file: 'bela-vina/traminec.png', fn: () => wineGlassSvg('#e8c848', 'Traminec', 'Belo vino', '<circle cx="80" cy="100" r="20" fill="rgba(232,200,72,0.08)"/><circle cx="330" cy="70" r="15" fill="rgba(232,200,72,0.05)"/>') },
  { file: 'bela-vina/rebula.png', fn: () => wineGlassSvg('#e0c838', 'Rebula', 'Belo vino') },
  { file: 'bela-vina/chardonnay-dular.png', fn: () => wineGlassSvg('#d4b830', 'Chardonnay Dular', 'Belo vino', '<circle cx="330" cy="85" r="28" fill="rgba(212,184,48,0.06)"/>') },
  { file: 'bela-vina/chardonnay-vicomte.png', fn: () => wineGlassSvg('#f0e090', 'Chardonnay Vicomte', 'Belo vino') },
  { file: 'bela-vina/sipon-verus.png', fn: () => wineGlassSvg('#e8d860', 'Sipon Verus', 'Belo vino', '<circle cx="75" cy="90" r="22" fill="rgba(232,216,96,0.07)"/>') },
  { file: 'bela-vina/sivi-pinot-jamertal.png', fn: () => wineGlassSvg('#d8b828', 'Sivi Pinot Jamertal', 'Belo vino') },
  { file: 'bela-vina/renski-rizling-stare.png', fn: () => wineGlassSvg('#f0e878', 'Renski Rizling Stare', 'Belo vino') },
  { file: 'bela-vina/renski-rizling-keltis.png', fn: () => wineGlassSvg('#e0d050', 'Renski Rizling Keltis', 'Belo vino', '<circle cx="325" cy="95" r="25" fill="rgba(224,208,80,0.06)"/>') },
  { file: 'bela-vina/alter.png', fn: () => wineGlassSvg('#d8c048', 'Alter', 'Belo vino') },
  { file: 'bela-vina/malvazija-movia.png', fn: () => wineGlassSvg('#c8a820', 'Malvazija Movia', 'Belo vino', '<circle cx="70" cy="80" r="30" fill="rgba(200,168,32,0.06)"/>') },
  { file: 'bela-vina/rebula-cru.png', fn: () => wineGlassSvg('#c4a018', 'Rebula Cru', 'Belo vino') },
  { file: 'bela-vina/burja-bela.png', fn: () => wineGlassSvg('#e8e098', 'Burja Bela', 'Belo vino') },
  { file: 'bela-vina/angel-belo-2021.png', fn: () => wineGlassSvg('#f0e880', 'Angel Belo 2021', 'Belo vino') },
  { file: 'bela-vina/angel-belo-2019.png', fn: () => wineGlassSvg('#c8a020', 'Angel Belo 2019', 'Belo vino', '<circle cx="330" cy="80" r="25" fill="rgba(200,160,32,0.06)"/>') },
  { file: 'bela-vina/rumeni-muskat.png', fn: () => wineGlassSvg('#e8b830', 'Rumeni Muskat', 'Belo vino') },
  { file: 'bela-vina/rumeni-muskat-pozna.png', fn: () => wineGlassSvg('#c89018', 'Rumeni Muskat Pozna', 'Pozna trgatve') },
  { file: 'bela-vina/bela-frankinja.png', fn: () => wineGlassSvg('#e0d068', 'Bela Frankinja', 'Belo vino') },

  // RDECA VINA
  { file: 'rdeca-vina/modra-frankinja-dular.png', fn: () => wineGlassSvg('#722f37', 'Modra Frankinja Dular', 'Rdece vino') },
  { file: 'rdeca-vina/modra-frankinja-luna.png', fn: () => wineGlassSvg('#8b3a42', 'Modra Frankinja Luna', 'Rdece vino', '<circle cx="330" cy="90" r="28" fill="rgba(139,58,66,0.08)"/>') },
  { file: 'rdeca-vina/modri-pinot-verus.png', fn: () => wineGlassSvg('#943440', 'Modri Pinot Verus', 'Rdece vino') },
  { file: 'rdeca-vina/modri-pinot-opoka.png', fn: () => wineGlassSvg('#6b1c23', 'Modri Pinot Opoka', 'Rdece vino', '<circle cx="70" cy="85" r="25" fill="rgba(107,28,35,0.08)"/>') },
  { file: 'rdeca-vina/merlot-keltis.png', fn: () => wineGlassSvg('#5c1a1f', 'Merlot Keltis', 'Rdece vino') },
  { file: 'rdeca-vina/merlot-opoka.png', fn: () => wineGlassSvg('#7c2028', 'Merlot Opoka', 'Rdece vino') },
  { file: 'rdeca-vina/cabernet-keltis.png', fn: () => wineGlassSvg('#4a1218', 'Cabernet Keltis', 'Rdece vino', '<circle cx="325" cy="80" r="22" fill="rgba(74,18,24,0.1)"/>') },
  { file: 'rdeca-vina/cabernet-pavo.png', fn: () => wineGlassSvg('#6b1822', 'Cabernet Pavo', 'Rdece vino') },
  { file: 'rdeca-vina/guerila-retro.png', fn: () => wineGlassSvg('#5a1520', 'Guerila Retro', 'Rdece vino', '<circle cx="80" cy="75" r="30" fill="rgba(90,21,32,0.08)"/>') },
  { file: 'rdeca-vina/duet-edi-simcic.png', fn: () => wineGlassSvg('#3e0e14', 'Duet Edi Simcic', 'Rdece vino premium') },
  { file: 'rdeca-vina/duet-lex-2018.png', fn: () => wineGlassSvg('#4a1218', 'Duet Lex 2018', 'Rdece vino premium') },
  { file: 'rdeca-vina/duet-lex-2020.png', fn: () => wineGlassSvg('#5c1a1f', 'Duet Lex 2020', 'Rdece vino premium') },
  { file: 'rdeca-vina/carolina-rdeca.png', fn: () => wineGlassSvg('#6b1c23', 'Carolina Rdeca', 'Rdece vino') },
  { file: 'rdeca-vina/veliko-rdece-movia.png', fn: () => wineGlassSvg('#2e080c', 'Veliko Rdece Movia', 'Rdece vino premium') },

  // PENINE
  { file: 'penine/no1-brut.png', fn: () => champagneFluteSvg('#f0e68c', 'No.1 Brut', 'Penine') },
  { file: 'penine/slapsak-brut-reserve.png', fn: () => champagneFluteSvg('#e8d860', 'Slapsak Brut Reserve', 'Penine') },
  { file: 'penine/slapsak-brut-rose.png', fn: () => champagneFluteSvg('#e8a0b4', 'Slapsak Brut Rose', 'Penine') },
  { file: 'penine/gourmet-rose.png', fn: () => champagneFluteSvg('#d4788f', 'Gourmet Rose', 'Penine') },
  { file: 'penine/zlata-radgonska.png', fn: () => champagneFluteSvg('#daa520', 'Zlata Radgonska', 'Penine') },
  { file: 'penine/maria-brut.png', fn: () => champagneFluteSvg('#f5deb3', 'Maria Brut 2020', 'Penine') },
  { file: 'penine/boemme-rumeni-muskat.png', fn: () => champagneFluteSvg('#e8b830', 'Boemme Rumeni Muskat', 'Penine') },
  { file: 'penine/bjana-brut.png', fn: () => champagneFluteSvg('#f0e070', 'Bjana Brut', 'Penine') },
  { file: 'penine/mufi-pet-nat.png', fn: () => champagneFluteSvg('#d8c848', 'Mufi Pet Nat', 'Naravna penina') },
  { file: 'penine/louis-roederer.png', fn: () => champagneFluteSvg('#f0d848', 'Louis Roederer', 'Sampovanjec') },
  { file: 'penine/pol-roger.png', fn: () => champagneFluteSvg('#e8d050', 'Pol Roger', 'Sampovanjec') },
  { file: 'penine/moet-chandon.png', fn: () => champagneFluteSvg('#f0e080', 'Moet & Chandon', 'Sampovanjec') },
  { file: 'penine/dom-perignon.png', fn: () => champagneFluteSvg('#c9a830', 'Dom Perignon', 'Prestizni sampovanjec') },

  // TOPLI NAPITKI
  { file: 'topli-napitki/kava-macchiato.png', fn: () => coffeeCupSvg('#3e1f0d', false, false, 'Macchiato', 'Kava') },
  { file: 'topli-napitki/bela-kava.png', fn: () => coffeeCupSvg('#d4b896', true, false, 'Bela Kava', 'Kava z mlekom') },
  { file: 'topli-napitki/kava-z-mlekom.png', fn: () => coffeeCupSvg('#8b6a4f', true, false, 'Kava z Mlekom', 'Kava') },
  { file: 'topli-napitki/kava-s-smethano.png', fn: () => coffeeCupSvg('#5c3317', false, true, 'Kava s Smetano', 'Kava') },
  { file: 'topli-napitki/bela-kava-brez-kofeina.png', fn: () => coffeeCupSvg('#c8a880', true, false, 'Bela Kava Brezkofeinska', 'Brez kofeina') },
  { file: 'topli-napitki/cappuccino-brez-kofeina.png', fn: () => coffeeCupSvg('#6b4423', true, false, 'Cappuccino Brezkofeinski', 'Brez kofeina') },
  { file: 'topli-napitki/kava-brez-kofeina.png', fn: () => coffeeCupSvg('#2e1505', false, false, 'Kava Brezkofeinska', 'Espresso brez kofeina') },
  { file: 'topli-napitki/kava-mleko-brez-kofeina.png', fn: () => coffeeCupSvg('#a08060', true, false, 'Kava z Mlekom Brezkofeinska', 'Brez kofeina') },
  { file: 'topli-napitki/macchiato-brez-kofeina.png', fn: () => coffeeCupSvg('#4a2c0a', false, false, 'Macchiato Brezkofeinski', 'Brez kofeina') },
  { file: 'topli-napitki/kava-rizevo-mleko.png', fn: () => coffeeCupSvg('#c8b898', true, false, 'Kava z Rizevim Mlekom', 'Rastlinsko mleko') },
  { file: 'topli-napitki/kakav.png', fn: () => coffeeCupSvg('#3e1a08', false, false, 'Kakav', 'Vroc kakav') },
  { file: 'topli-napitki/kakav-smetana.png', fn: () => coffeeCupSvg('#2e1205', false, true, 'Kakav s Smetano', 'Vroc kakav') },
  { file: 'topli-napitki/babyccino.png', fn: () => coffeeCupSvg('#f0e8d8', true, false, 'Babyccino', 'Za najmlajse') },
  { file: 'topli-napitki/vroca-cokolada.png', fn: () => coffeeCupSvg('#1a0a02', false, true, 'Vroca Cokolada', 'Gosta cokolada') },
  { file: 'topli-napitki/caj-limona-med.png', fn: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-32,-70 L-28,55 Q0,65 28,55 L32,-70 Z" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <path d="M-30,-40 L-27,52 Q0,62 27,52 L30,-40 Z" fill="#c8a848" opacity="0.6"/>
    <ellipse cx="0" cy="-70" rx="32" ry="8" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
    <circle cx="10" cy="-78" r="6" fill="#f0e060" opacity="0.7"/>
    <path d="M8,-72 L12,-78 L8,-84" fill="none" stroke="#e8d040" stroke-width="1.5"/>
    <circle cx="-8" cy="-76" r="4" fill="#f5d030" opacity="0.6"/>
    <path d="M-10,-65 Q-15,-85 -5,-100" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">Caj z Limono in Medom</text>
  <text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Topli napitek</text>
</svg>` },
  { file: 'topli-napitki/ledena-kava-olimia.png', fn: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,175)">
    <rect x="-30" y="-85" width="60" height="150" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <rect x="-27" y="-60" width="54" height="100" rx="3" fill="#6b4423" opacity="0.7"/>
    <rect x="-27" y="-82" width="54" height="25" rx="3" fill="#d4b896" opacity="0.5"/>
    <ellipse cx="0" cy="-85" rx="30" ry="6" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-5" y="-95" width="10" height="8" rx="3" fill="rgba(255,255,255,0.1)"/>
    <rect x="-18" y="-45" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)" transform="rotate(10,-14,-41)"/>
    <rect x="8" y="-30" width="7" height="7" rx="2" fill="rgba(255,255,255,0.1)" transform="rotate(-5,11,-26)"/>
    <rect x="-10" y="-20" width="6" height="6" rx="2" fill="rgba(255,255,255,0.08)" transform="rotate(15,-7,-17)"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">Ledena Kava Olimia</text>
  <text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Hladna kava</text>
</svg>` },

  // GAZIRANE PIJACE
  { file: 'gazirane-pijace/coca-cola-zero.png', fn: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,175)">
    <path d="M-30,-75 L-27,60 Q0,70 27,60 L30,-75 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-28,-50 L-26,57 Q0,67 26,57 L28,-50 Z" fill="#1a0a00" opacity="0.85"/>
    <ellipse cx="0" cy="-75" rx="30" ry="7" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <circle cx="-10" cy="-30" r="1.5" fill="rgba(255,255,255,0.25)"/><circle cx="5" cy="-15" r="1" fill="rgba(255,255,255,0.2)"/><circle cx="12" cy="-40" r="1.5" fill="rgba(255,255,255,0.15)"/>
    <circle cx="-5" cy="10" r="1" fill="rgba(255,255,255,0.2)"/><circle cx="15" cy="25" r="1.5" fill="rgba(255,255,255,0.15)"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">Coca Cola Zero</text>
  <text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Gazirana pijaca</text>
</svg>` },
  { file: 'gazirane-pijace/cockta.png', fn: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,175)">
    <path d="M-30,-75 L-27,60 Q0,70 27,60 L30,-75 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-28,-50 L-26,57 Q0,67 26,57 L28,-50 Z" fill="#5c2010" opacity="0.85"/>
    <ellipse cx="0" cy="-75" rx="30" ry="7" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <circle cx="-8" cy="-20" r="1.5" fill="rgba(255,255,255,0.2)"/><circle cx="10" cy="-35" r="1" fill="rgba(255,255,255,0.15)"/><circle cx="3" cy="5" r="1.5" fill="rgba(255,255,255,0.2)"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">Cockta</text>
  <text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Slovenska gazirana pijaca</text>
</svg>` },
  { file: 'gazirane-pijace/fanta.png', fn: () => juiceGlassSvg('#ff8c00', '<circle cx="12" cy="-80" r="8" fill="#ff8c00" opacity="0.6"/>', 'Fanta', 'Gazirana pijaca') },
  { file: 'gazirane-pijace/fever-tree-tonic.png', fn: () => waterGlassSvg('#b0e0e6', 'Fever Tree Tonic', 'Premium tonic', true) },
  { file: 'gazirane-pijace/fever-tree-med.png', fn: () => waterGlassSvg('#d4c898', 'Fever Tree Mediterranean', 'Premium tonic', true) },
  { file: 'gazirane-pijace/fever-tree-rhubarb.png', fn: () => waterGlassSvg('#d89898', 'Fever Tree Rhubarb & Raspberry', 'Premium tonic', true) },
  { file: 'gazirane-pijace/red-bull.png', fn: () => juiceGlassSvg('#c8a020', '<rect x="-3" y="-88" width="6" height="8" rx="2" fill="rgba(200,160,32,0.6)"/>', 'Red Bull', 'Energijska pijaca') },
  { file: 'gazirane-pijace/schweppes-tonic.png', fn: () => waterGlassSvg('#add8e6', 'Schweppes Tonic', 'Tonic water', true) },
  { file: 'gazirane-pijace/schweppes-bitter.png', fn: () => juiceGlassSvg('#d8d080', '<circle cx="5" cy="-82" r="6" fill="#e8e040" opacity="0.5"/>', 'Schweppes Bitter Lemon', 'Gazirana pijaca') },
  { file: 'gazirane-pijace/sprite.png', fn: () => juiceGlassSvg('#90d840', '<circle cx="8" cy="-80" r="5" fill="#a0e848" opacity="0.5"/><circle cx="-5" cy="-82" r="4" fill="#80c830" opacity="0.4"/>', 'Sprite', 'Gazirana pijaca') },

  // MESANE PIJACE (Cocktails)
  { file: 'mesane-pijace/cuba-libre.png', fn: () => cocktailSvg('#3e1a08', '<rect x="8" y="-85" width="4" height="15" rx="2" fill="#4a8020"/><circle cx="10" cy="-88" r="3" fill="#4a8020"/>', 'highball', 'Cuba Libre', 'Rum in cola') },
  { file: 'mesane-pijace/martini-spritz.png', fn: () => cocktailSvg('#e8c860', '<circle cx="12" cy="-45" r="5" fill="#ff8c00" opacity="0.7"/>', 'coupe', 'Martini Spritz', 'Aperitiv') },
  { file: 'mesane-pijace/mango-mojito.png', fn: () => cocktailSvg('#e8a030', '<circle cx="-5" cy="-88" r="4" fill="#4a8020" opacity="0.7"/><circle cx="5" cy="-90" r="3" fill="#4a8020" opacity="0.6"/>', 'highball', 'Mango Mojito', 'Koktajl') },
  { file: 'mesane-pijace/strawberry-mojito.png', fn: () => cocktailSvg('#d05060', '<circle cx="-8" cy="-88" r="4" fill="#4a8020" opacity="0.7"/><circle cx="3" cy="-90" r="3.5" fill="#ff3040" opacity="0.5"/>', 'highball', 'Strawberry Mojito', 'Koktajl') },
  { file: 'mesane-pijace/hendricks-gin-tonic.png', fn: () => cocktailSvg('#d0e8d8', '<rect x="-2" y="-95" width="4" height="30" rx="1" fill="#3a6830" opacity="0.6"/><circle cx="0" cy="-98" r="3" fill="#3a6830" opacity="0.5"/>', 'coupe', "Hendrick's G&T", 'Premium koktajl') },
  { file: 'mesane-pijace/monolog-gin-tonic.png', fn: () => cocktailSvg('#c8e0d0', '<circle cx="5" cy="-48" r="3" fill="#8b5a2b" opacity="0.6"/><circle cx="-5" cy="-45" r="2" fill="#8b5a2b" opacity="0.4"/>', 'coupe', 'Monolog G&T', 'Slovenski craft gin') },
  { file: 'mesane-pijace/gin-mare-tonic.png', fn: () => cocktailSvg('#d8e8c0', '<rect x="15" y="-60" width="3" height="20" rx="1" fill="#3a5830" opacity="0.6"/><circle cx="16" cy="-62" r="3" fill="#3a5830" opacity="0.5"/><circle cx="25" cy="-55" r="2" fill="#606020" opacity="0.4"/>', 'coupe', 'Gin Mare G&T', 'Sredozemski gin') },
  { file: 'mesane-pijace/monkey47-gin-tonic.png', fn: () => cocktailSvg('#c8d8c0', '<circle cx="-5" cy="-48" r="3" fill="#4a3020" opacity="0.5"/><circle cx="5" cy="-46" r="2" fill="#604030" opacity="0.4"/><circle cx="0" cy="-50" r="2.5" fill="#503828" opacity="0.3"/>', 'coupe', 'Monkey 47 G&T', 'Crn gozdni gin') },
  { file: 'mesane-pijace/orange-ginger-gin-tonic.png', fn: () => cocktailSvg('#e8c080', '<circle cx="10" cy="-48" r="5" fill="#ff8c00" opacity="0.5"/><rect x="-2" y="-60" width="4" height="12" rx="1" fill="#c88040" opacity="0.5"/>', 'coupe', 'Orange & Ginger G&T', 'Koktajl') },
  { file: 'mesane-pijace/raspberry-pink-gin-tonic.png', fn: () => cocktailSvg('#d880a0', '<circle cx="-5" cy="-50" r="3" fill="#c83050" opacity="0.6"/><circle cx="3" cy="-48" r="2.5" fill="#b82848" opacity="0.5"/><circle cx="-2" cy="-53" r="2" fill="#d03858" opacity="0.4"/>', 'coupe', 'Raspberry Pink G&T', 'Koktajl') },

  // SOKOVI
  { file: 'sokovi/marelicni-sok.png', fn: () => juiceGlassSvg('#ff8c00', '<circle cx="12" cy="-82" r="5" fill="#ff8c00" opacity="0.6"/>', 'Marelicni Sok', 'Naravni sok') },
  { file: 'sokovi/jablocni-sok.png', fn: () => juiceGlassSvg('#c8a020', '<circle cx="10" cy="-82" r="6" fill="#c8a020" opacity="0.5"/>', 'Jabolcni Sok', 'Naravni sok') },
  { file: 'sokovi/ribezov-sok.png', fn: () => juiceGlassSvg('#6b1838', '<circle cx="8" cy="-82" r="4" fill="#6b1838" opacity="0.6"/>', 'Ribezov Sok', 'Naravni sok') },
  { file: 'sokovi/ananasov-sok.png', fn: () => juiceGlassSvg('#e8c020', '<circle cx="10" cy="-84" r="5" fill="#e8c020" opacity="0.6"/>', 'Ananasov Sok', 'Naravni sok') },
  { file: 'sokovi/pomarancni-sok.png', fn: () => juiceGlassSvg('#ff6a00', '<circle cx="8" cy="-82" r="6" fill="#ff6a00" opacity="0.5"/>', 'Pomarancni Sok', 'Naravni sok') },
  { file: 'sokovi/jagodni-sok.png', fn: () => juiceGlassSvg('#d83030', '<circle cx="10" cy="-82" r="4" fill="#d83030" opacity="0.6"/>', 'Jagodni Sok', 'Naravni sok') },
  { file: 'sokovi/ledeni-caj.png', fn: () => juiceGlassSvg('#a07828', '<circle cx="5" cy="-82" r="4" fill="#e8d040" opacity="0.5"/>', 'Ledeni Caj', 'Hladen napitek') },
  { file: 'sokovi/cedevita.png', fn: () => juiceGlassSvg('#ff8c00', '<circle cx="0" cy="-82" r="3" fill="rgba(255,255,255,0.3)"/>', 'Cedevita', 'Vitaminski napitek') },
  { file: 'sokovi/bubble-tea.png', fn: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,170)">
    <path d="M-30,-80 L-27,60 Q0,70 27,60 L30,-80 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-28,-55 L-26,57 Q0,67 26,57 L28,-55 Z" fill="#c8a878" opacity="0.7"/>
    <ellipse cx="0" cy="-80" rx="30" ry="7" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <circle cx="-10" cy="40" r="4" fill="#2e1505" opacity="0.7"/><circle cx="0" cy="48" r="4" fill="#2e1505" opacity="0.7"/><circle cx="10" cy="42" r="4" fill="#2e1505" opacity="0.7"/>
    <circle cx="-5" cy="30" r="3.5" fill="#2e1505" opacity="0.6"/><circle cx="8" cy="28" r="3.5" fill="#2e1505" opacity="0.6"/>
    <rect x="-3" y="-90" width="6" height="25" rx="3" fill="rgba(255,255,255,0.1)"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.9)">Bubble Tea</text>
  <text x="200" y="362" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Z tapioka perli</text>
</svg>` },

  // VISKI
  { file: 'viski/chivas-12.png', fn: () => spiritGlassSvg('#b8860b', 'Chivas Regal 12', 'Viski') },
  { file: 'viski/johnnie-walker-black.png', fn: () => spiritGlassSvg('#8b6914', 'Johnnie Walker Black', 'Viski') },
  { file: 'viski/jack-daniels.png', fn: () => spiritGlassSvg('#a07010', 'Jack Daniels', 'Tennessee viski') },
  { file: 'viski/jameson.png', fn: () => spiritGlassSvg('#c8a030', 'Jameson', 'Irski viski') },
  { file: 'viski/lagavulin-16.png', fn: () => spiritGlassSvg('#6b4400', 'Lagavulin 16', 'Islay single malt') },
  { file: 'viski/laphroaig-10.png', fn: () => spiritGlassSvg('#5c3a08', 'Laphroaig 10', 'Islay single malt') },
  { file: 'viski/glenmorangie-lasanta.png', fn: () => spiritGlassSvg('#a06818', 'Glenmorangie Lasanta', 'Highland single malt') },
  { file: 'viski/glenmorangie-18.png', fn: () => spiritGlassSvg('#8b5810', 'Glenmorangie 18', 'Highland single malt') },
  { file: 'viski/nikka-miyagikyo.png', fn: () => spiritGlassSvg('#c89830', 'Nikka Miyagikyo', 'Japonski single malt') },
  { file: 'viski/nikka-from-the-barrel.png', fn: () => spiritGlassSvg('#946818', 'Nikka From the Barrel', 'Japonski viski') },

  // GIN
  { file: 'gin/gin-kristal.png', fn: () => cocktailSvg('#e0e8e4', '<circle cx="-8" cy="-48" r="3" fill="#4a7c50" opacity="0.5"/><circle cx="5" cy="-50" r="2" fill="#e8d840" opacity="0.4"/>', 'coupe', 'Gin Kristal', 'London Dry') },
  { file: 'gin/gin-monolog.png', fn: () => cocktailSvg('#d0e0d8', '<circle cx="0" cy="-48" r="4" fill="#708060" opacity="0.4"/>', 'coupe', 'Gin Monolog', 'Slovenski craft') },
  { file: 'gin/gin-hendricks.png', fn: () => cocktailSvg('#d8e8d4', '<circle cx="-5" cy="-48" r="3" fill="#d870a0" opacity="0.4"/><circle cx="5" cy="-46" r="2.5" fill="#d870a0" opacity="0.3"/>', 'coupe', "Hendrick's Gin", 'Premium gin') },
  { file: 'gin/gin-mare.png', fn: () => cocktailSvg('#c8d8c0', '<rect x="15" y="-55" width="2" height="15" rx="1" fill="#3a5830" opacity="0.6"/><circle cx="25" cy="-50" r="3" fill="#606020" opacity="0.4"/>', 'coupe', 'Gin Mare', 'Sredozemski gin') },
  { file: 'gin/gin-tanqueray.png', fn: () => cocktailSvg('#d8e0d8', '<circle cx="0" cy="-48" r="3" fill="#4a7828" opacity="0.5"/>', 'coupe', 'Tanqueray', 'London Dry') },
  { file: 'gin/gin-monkey47.png', fn: () => cocktailSvg('#c0d0b8', '<circle cx="-3" cy="-50" r="2.5" fill="#503828" opacity="0.4"/><circle cx="5" cy="-48" r="2" fill="#403020" opacity="0.3"/>', 'coupe', 'Monkey 47', 'Schwarzwald gin') },

  // DESTILATI
  { file: 'destilati/viljamovka.png', fn: () => spiritGlassSvg('#f0e8d0', 'Viljamovka', 'Hruskov zalozek') },
  { file: 'destilati/slivovka.png', fn: () => spiritGlassSvg('#d4a030', 'Slivovka', 'Slivov zalozek') },
  { file: 'destilati/brinjevec.png', fn: () => spiritGlassSvg('#e8e0c8', 'Brinjevec', 'Brinjev zalozek') },
  { file: 'destilati/grappa-sofija.png', fn: () => spiritGlassSvg('#f0e8d8', 'Grappa Sofija', 'Grozdni zalozek') },
  { file: 'destilati/travarica-rossi.png', fn: () => spiritGlassSvg('#a08020', 'Travarica Rossi', 'Zelišcni zalozek') },
  { file: 'destilati/hennessy-vs.png', fn: () => spiritGlassSvg('#a06818', 'Hennessy V.S.', 'Konjak') },
  { file: 'destilati/hennessy-xo.png', fn: () => spiritGlassSvg('#6b3a08', 'Hennessy X.O.', 'Premium konjak') },
  { file: 'destilati/delamaine-xo.png', fn: () => spiritGlassSvg('#5c3008', 'Delamaine X.O.', 'Premium konjak') },
  { file: 'destilati/ararat-6.png', fn: () => spiritGlassSvg('#b88030', 'Ararat 6 let', 'Armenski žganjek') },
  { file: 'destilati/ararat-15.png', fn: () => spiritGlassSvg('#8b5818', 'Ararat 15 let', 'Premium žganjek') },
  { file: 'destilati/ararat-20.png', fn: () => spiritGlassSvg('#6b4010', 'Ararat 20 let', 'Prestizni žganjek') },
  { file: 'destilati/rum-bumbu.png', fn: () => spiritGlassSvg('#a07020', 'Bumbu Rum', 'Karibski rum') },
  { file: 'destilati/rum-zacapa.png', fn: () => spiritGlassSvg('#6b3a10', 'Zacapa Centenario', 'Premium rum') },
  { file: 'destilati/rum-diplomatico.png', fn: () => spiritGlassSvg('#8b5018', 'Diplomatico', 'Venezuelski rum') },
  { file: 'destilati/rum-la-hechicera.png', fn: () => spiritGlassSvg('#7b4810', 'La Hechicera', 'Kolumbijski rum') },
  { file: 'destilati/rum-havana-club.png', fn: () => spiritGlassSvg('#b89030', 'Havana Club', 'Kubanski rum') },

  // LIKERJI
  { file: 'likerji/malibu.png', fn: () => spiritGlassSvg('#f0f0f0', 'Malibu', 'Kokosov liker') },
  { file: 'likerji/canella.png', fn: () => spiritGlassSvg('#f0d830', 'Canella Limoncello', 'Limonin liker') },
  { file: 'likerji/bumbu-cream.png', fn: () => spiritGlassSvg('#c8a870', 'Bumbu Cream', 'Kremni liker') },
  { file: 'likerji/carolans.png', fn: () => spiritGlassSvg('#d4b878', 'Carolans', 'Irski kremni liker') },
  { file: 'likerji/medica-kejzar.png', fn: () => spiritGlassSvg('#d4a020', 'Medica Kejzar', 'Medeni liker') },
  { file: 'likerji/borovnica-kejzar.png', fn: () => spiritGlassSvg('#4a1860', 'Borovnica Kejzar', 'Borovnicov liker') },

  // GRENCICE
  { file: 'grencice/pelinkovec-badel.png', fn: () => spiritGlassSvg('#3a2800', 'Pelinkovec Badel', 'Grencica') },
  { file: 'grencice/cynar.png', fn: () => spiritGlassSvg('#4a3010', 'Cynar', 'Zelimšna grencica') },
  { file: 'grencice/jagermeister.png', fn: () => spiritGlassSvg('#1a3008', 'Jagermeister', 'Zelišna grencica') },
  { file: 'grencice/amaro.png', fn: () => spiritGlassSvg('#3a2008', 'Amaro', 'Italijanska grencica') },
  { file: 'grencice/campari-bitter.png', fn: () => spiritGlassSvg('#c82020', 'Campari Bitter', 'Aperitiv') },

  // TOCENO PIVO
  { file: 'toceno-pivo/haler-nefiltriran.png', fn: () => beerGlassSvg('#d4a017', '#f5f0e0', 'Haler Nefiltriran', 'Nefiltrirano toceno pivo') },
  { file: 'toceno-pivo/union-lager.png', fn: () => beerGlassSvg('#d4a017', '#f0e8d0', 'Union Lager', 'Toceno pivo') },
  { file: 'toceno-pivo/pelicon-ipa.png', fn: () => beerGlassSvg('#c89818', '#e8e0c8', 'Pelicon IPA', 'Craft toceno pivo') },
  { file: 'toceno-pivo/radler.png', fn: () => beerGlassSvg('#e8c830', '#f0e8d0', 'Radler Grenivka', 'Radler') },

  // CRAFT PIVA
  { file: 'craft-piva/pelicon-winter.png', fn: () => beerGlassSvg('#8b5a2b', '#e8d8c0', 'Pelicon Winter', 'Zimsko craft pivo') },
  { file: 'craft-piva/zeleni-haler.png', fn: () => beerGlassSvg('#a0b830', '#e8e8d0', 'Zeleni Haler', 'Zeleno craft pivo') },
  { file: 'craft-piva/bevog-tak.png', fn: () => beerGlassSvg('#a07018', '#e0d0b8', 'Bevog Tak', 'Craft pivo') },

  // PIVO
  { file: 'pivo/reset-lagerish.png', fn: () => beerGlassSvg('#d4a017', '#f0e8d0', 'Reset Lagerish', 'Craft lager') },
  { file: 'pivo/reset-froggy-ipa.png', fn: () => beerGlassSvg('#c89818', '#e8e0c8', 'Reset Froggy IPA', 'Craft IPA') },
  { file: 'pivo/reset-irish-stout.png', fn: () => beerGlassSvg('#1a0e05', '#c8b898', 'Reset Irish Stout', 'Craft stout') },

  // BREZALK PIVO
  { file: 'brezalk-pivo/heineken-0.png', fn: () => beerGlassSvg('#d4a017', '#f0e8d0', 'Heineken 0.0', 'Brezalkoholno pivo') },
  { file: 'brezalk-pivo/daura-lager.png', fn: () => beerGlassSvg('#c89818', '#e8e0c8', 'Daura Lager', 'Brezalkoholno pivo') },

  // TUJA VINA
  { file: 'tuja-vina/posip-terra-madre.png', fn: () => wineGlassSvg('#e8d860', 'Posip Premium', 'Hrvasko belo vino') },
  { file: 'tuja-vina/andreis-vinasmora.png', fn: () => wineGlassSvg('#d8c048', 'Andreis Vinasmora', 'Belo vino') },
  { file: 'tuja-vina/plavac-mali-terra-madre.png', fn: () => wineGlassSvg('#5c1a1f', 'Plavac Mali Premium', 'Hrvasko rdece vino') },
  { file: 'tuja-vina/vranec-instinct.png', fn: () => wineGlassSvg('#3e0e18', 'Vranec Instinct', 'Makedonsko rdece vino') },
  { file: 'tuja-vina/jermann-dreams.png', fn: () => wineGlassSvg('#e0d068', 'Jermann Dreams', 'Italijansko belo vino') },
  { file: 'tuja-vina/vintage-tunina.png', fn: () => wineGlassSvg('#c8a820', 'Vintage Tunina', 'Italijansko belo vino') },

  // LIKERSKO VINO
  { file: 'likersko-vino/keros-belo.png', fn: () => wineGlassSvg('#c8a020', 'Keros Belo', 'Likersko vino') },
  { file: 'likersko-vino/keros-rdece.png', fn: () => wineGlassSvg('#5c1a1f', 'Keros Rdece', 'Likersko vino') },
  { file: 'likersko-vino/veliko-rdece-2012.png', fn: () => wineGlassSvg('#2e080c', 'Veliko Rdece Movia 2012', 'Arhivsko vino') },
  { file: 'likersko-vino/sladki-refosk.png', fn: () => wineGlassSvg('#4a1218', 'Sladki Refosk', 'Sladko rdece vino') },

  // NARAVNI SOKOVI
  { file: 'naravni-sokovi/limonada-okus.png', fn: () => juiceGlassSvg('#f0e060', '<circle cx="5" cy="-82" r="5" fill="#4a8020" opacity="0.5"/>', 'Limonada z Okusom', 'Osvezilna limonada') },
  { file: 'naravni-sokovi/hisni-sok-meta.png', fn: () => juiceGlassSvg('#80c840', '<circle cx="-5" cy="-82" r="4" fill="#4a8020" opacity="0.6"/>', 'Hisni Sok Meta', 'Mentini sok') },
  { file: 'naravni-sokovi/hisni-ledeni-caj.png', fn: () => juiceGlassSvg('#a07828', '<circle cx="0" cy="-82" r="4" fill="#e8d040" opacity="0.5"/>', 'Hisni Ledeni Caj', 'Hladen napitek') },
  { file: 'naravni-sokovi/pomarancni-sok.png', fn: () => juiceGlassSvg('#ff6a00', '<circle cx="8" cy="-82" r="6" fill="#ff6a00" opacity="0.5"/>', 'Naravni Pomarancni Sok', 'Svez stisnjen') },

  // VODE
  { file: 'vode/voda-z-okusom.png', fn: () => waterGlassSvg('#a0d8b0', 'Voda z Okusom', 'Aromatizirana voda', false) },
  { file: 'vode/radenska-functionall.png', fn: () => waterGlassSvg('#b0d8e0', 'Radenska FunctionALL', 'Funkcionalna voda', true) },
  { file: 'vode/naravna-voda.png', fn: () => waterGlassSvg('#87ceeb', 'Naravna Voda', 'Mirna voda', false) },
  { file: 'vode/mineralna-voda.png', fn: () => waterGlassSvg('#add8e6', 'Mineralna Voda', 'Mehurčkasta voda', true) },

  // ROSE VINO
  { file: 'rose-vino/rose-batic.png', fn: () => wineGlassSvg('#e8a0b4', 'Rose Batic', 'Rose vino') },
  { file: 'rose-vino/rose-verstovsek-steklenica.png', fn: () => wineGlassSvg('#d4788f', 'Rose Verstovsek', 'Rose vino') },
];

// Generate all images
console.log(`=== RestaurantOS SVG Menu Image Generator ===`);
console.log(`Total items to generate: ${items.length}`);
console.log('');

let success = 0;
let failed = 0;

for (const item of items) {
  const outputPath = path.join(OUTPUT_BASE, item.file);
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const svg = item.fn();
    fs.writeFileSync(outputPath, svg);
    console.log(`OK: ${item.file}`);
    success++;
  } catch (error) {
    console.error(`FAILED: ${item.file} - ${error.message}`);
    failed++;
  }
}

console.log('');
console.log(`=== Generation Complete ===`);
console.log(`Success: ${success}, Failed: ${failed}, Total: ${items.length}`);
