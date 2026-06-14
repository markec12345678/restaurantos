import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BASE = '/home/z/my-project/public/menu-images';

// Fix and re-convert the 8 failed SVG files
const FIXES = {
  'gazirane-pijace/fever-tree-rhubarb.png': { old: 'Rhubarb & Raspberry', new: 'Rhubarb &amp; Raspberry' },
  'mesane-pijace/gin-mare-tonic.png': { old: "Gin Mare G&T", new: "Gin Mare G&amp;T" },
  'mesane-pijace/hendricks-gin-tonic.png': { old: "Hendrick's G&T", new: "Hendrick&apos;s G&amp;T" },
  'mesane-pijace/monkey47-gin-tonic.png': { old: "Monkey 47 G&T", new: "Monkey 47 G&amp;T" },
  'mesane-pijace/monolog-gin-tonic.png': { old: "Monolog G&T", new: "Monolog G&amp;T" },
  'mesane-pijace/orange-ginger-gin-tonic.png': { old: "Orange & Ginger G&T", new: "Orange &amp; Ginger G&amp;T" },
  'mesane-pijace/raspberry-pink-gin-tonic.png': { old: "Raspberry Pink G&T", new: "Raspberry Pink G&amp;T" },
  'penine/moet-chandon.png': { old: "Moet & Chandon", new: "Moet &amp; Chandon" },
};

async function fixAndConvert() {
  let success = 0;
  let failed = 0;

  for (const [file, fix] of Object.entries(FIXES)) {
    const filePath = path.join(BASE, file);
    
    // Since the file was already converted to PNG (or partially), we need to regenerate from SVG
    // First, let's regenerate the SVG with proper XML escaping
    let svgContent = '';
    
    // Determine the type and regenerate
    if (file.includes('gazirane-pijace/fever-tree-rhubarb')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8b8b8"/><stop offset="100%" stop-color="#d89898"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-35,-70 L-30,55 Q0,65 30,55 L35,-70 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <path d="M-33,-40 L-29,52 Q0,62 29,52 L33,-40 Z" fill="url(#liquid)" opacity="0.5"/>
    <ellipse cx="0" cy="-70" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
    <circle cx="-8" cy="-25" r="1.5" fill="rgba(255,255,255,0.25)"/><circle cx="5" cy="-15" r="1" fill="rgba(255,255,255,0.2)"/><circle cx="12" cy="-35" r="1.5" fill="rgba(255,255,255,0.15)"/>
    <circle cx="-5" cy="10" r="1" fill="rgba(255,255,255,0.2)"/><circle cx="15" cy="25" r="1.5" fill="rgba(255,255,255,0.15)"/>
    <path d="M-24,-60 Q-26,-5 -20,45" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="16" font-weight="600" fill="rgba(255,255,255,0.9)">Fever Tree Rhubarb</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Premium tonic</text>
</svg>`;
    } else if (file.includes('gin-mare-tonic')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e0ecc0"/><stop offset="100%" stop-color="#c8d8b0"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-55,-40 Q-60,20 0,50 Q60,20 55,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-50,-25 Q-55,15 0,42 Q55,15 50,-25 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-2.5" y="50" width="5" height="45" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="97" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <rect x="-18" y="-48" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)"/><rect x="5" y="-38" width="7" height="7" rx="2" fill="rgba(255,255,255,0.1)"/><rect x="-10" y="-28" width="6" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
    <rect x="15" y="-55" width="3" height="20" rx="1" fill="#3a5830" opacity="0.6"/><circle cx="16" cy="-58" r="3" fill="#3a5830" opacity="0.5"/><circle cx="25" cy="-48" r="2" fill="#606020" opacity="0.4"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="17" font-weight="600" fill="rgba(255,255,255,0.9)">Gin Mare G&amp;T</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Sredozemski gin</text>
</svg>`;
    } else if (file.includes('hendricks')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d8ecd4"/><stop offset="100%" stop-color="#c0d8bc"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-55,-40 Q-60,20 0,50 Q60,20 55,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-50,-25 Q-55,15 0,42 Q55,15 50,-25 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-2.5" y="50" width="5" height="45" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="97" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <rect x="-18" y="-48" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)"/><rect x="5" y="-38" width="7" height="7" rx="2" fill="rgba(255,255,255,0.1)"/>
    <rect x="-2" y="-90" width="4" height="30" rx="1" fill="#3a6830" opacity="0.6"/><circle cx="0" cy="-93" r="3" fill="#3a6830" opacity="0.5"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="16" font-weight="600" fill="rgba(255,255,255,0.9)">Hendrick&apos;s G&amp;T</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Premium koktajl</text>
</svg>`;
    } else if (file.includes('monkey47')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c8d8c0"/><stop offset="100%" stop-color="#a8c0a0"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-55,-40 Q-60,20 0,50 Q60,20 55,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-50,-25 Q-55,15 0,42 Q55,15 50,-25 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-2.5" y="50" width="5" height="45" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="97" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <rect x="-12" y="-48" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)"/><rect x="6" y="-38" width="7" height="7" rx="2" fill="rgba(255,255,255,0.1)"/>
    <circle cx="-3" cy="-50" r="2.5" fill="#503828" opacity="0.4"/><circle cx="5" cy="-48" r="2" fill="#403020" opacity="0.3"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="16" font-weight="600" fill="rgba(255,255,255,0.9)">Monkey 47 G&amp;T</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Crn gozdni gin</text>
</svg>`;
    } else if (file.includes('monolog')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d0e0d8"/><stop offset="100%" stop-color="#b0d0c0"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-55,-40 Q-60,20 0,50 Q60,20 55,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-50,-25 Q-55,15 0,42 Q55,15 50,-25 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-2.5" y="50" width="5" height="45" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="97" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <rect x="-18" y="-48" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)"/><rect x="5" y="-38" width="7" height="7" rx="2" fill="rgba(255,255,255,0.1)"/>
    <circle cx="5" cy="-48" r="3" fill="#8b5a2b" opacity="0.6"/><circle cx="-5" cy="-45" r="2" fill="#8b5a2b" opacity="0.4"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="16" font-weight="600" fill="rgba(255,255,255,0.9)">Monolog G&amp;T</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Slovenski craft gin</text>
</svg>`;
    } else if (file.includes('orange-ginger')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8c880"/><stop offset="100%" stop-color="#d0a860"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-55,-40 Q-60,20 0,50 Q60,20 55,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-50,-25 Q-55,15 0,42 Q55,15 50,-25 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-2.5" y="50" width="5" height="45" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="97" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <rect x="-18" y="-48" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)"/><rect x="5" y="-38" width="7" height="7" rx="2" fill="rgba(255,255,255,0.1)"/><rect x="-10" y="-28" width="6" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
    <circle cx="10" cy="-48" r="5" fill="#ff8c00" opacity="0.5"/><rect x="-2" y="-60" width="4" height="12" rx="1" fill="#c88040" opacity="0.5"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="14" font-weight="600" fill="rgba(255,255,255,0.9)">Orange &amp; Ginger G&amp;T</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Koktajl</text>
</svg>`;
    } else if (file.includes('raspberry-pink')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d890a0"/><stop offset="100%" stop-color="#c07080"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,180)">
    <path d="M-55,-40 Q-60,20 0,50 Q60,20 55,-40 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M-50,-25 Q-55,15 0,42 Q55,15 50,-25 Z" fill="url(#liquid)" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="55" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <rect x="-2.5" y="50" width="5" height="45" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="97" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <rect x="-18" y="-48" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)"/><rect x="5" y="-38" width="7" height="7" rx="2" fill="rgba(255,255,255,0.1)"/>
    <circle cx="-5" cy="-50" r="3" fill="#c83050" opacity="0.6"/><circle cx="3" cy="-48" r="2.5" fill="#b82848" opacity="0.5"/><circle cx="-2" cy="-53" r="2" fill="#d03858" opacity="0.4"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="14" font-weight="600" fill="rgba(255,255,255,0.9)">Raspberry Pink G&amp;T</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Koktajl</text>
</svg>`;
    } else if (file.includes('moet')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f0e080"/><stop offset="100%" stop-color="#d8c860"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,170)">
    <path d="M-28,-100 Q-32,20 0,60 Q32,20 28,-100 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <path d="M-26,-70 Q-30,20 0,55 Q30,20 26,-70 Z" fill="url(#liquid)" opacity="0.8"/>
    <circle cx="-10" cy="-50" r="1.5" fill="rgba(255,255,255,0.4)"/><circle cx="5" cy="-30" r="1" fill="rgba(255,255,255,0.3)"/><circle cx="12" cy="-55" r="1.5" fill="rgba(255,255,255,0.25)"/>
    <circle cx="-5" cy="-10" r="1" fill="rgba(255,255,255,0.3)"/><circle cx="15" cy="-40" r="1.5" fill="rgba(255,255,255,0.2)"/>
    <ellipse cx="0" cy="-100" rx="28" ry="6" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <rect x="-2.5" y="60" width="5" height="50" fill="rgba(255,255,255,0.1)" rx="2"/>
    <ellipse cx="0" cy="112" rx="35" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <path d="M-18,-85 Q-20,-10 -8,35" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="16" font-weight="600" fill="rgba(255,255,255,0.9)">Moet &amp; Chandon</text>
  <text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">Sampovanjec</text>
</svg>`;
    }

    try {
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(1024, 1024)
        .png()
        .toBuffer();
      
      fs.writeFileSync(filePath, pngBuffer);
      console.log(`OK: ${file}`);
      success++;
    } catch (error) {
      console.error(`FAILED: ${file} - ${error.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`=== Fix Complete ===`);
  console.log(`Success: ${success}, Failed: ${failed}`);
}

fixAndConvert().catch(console.error);
