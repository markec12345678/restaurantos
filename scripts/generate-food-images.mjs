import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BASE = '/home/z/my-project/public/menu-images';

function plateSvg(color, label, subtitle = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,185)">
    <ellipse cx="0" cy="0" rx="95" ry="30" fill="${color}" opacity="0.3"/>
    <ellipse cx="0" cy="-10" rx="90" ry="25" fill="${color}" opacity="0.15"/>
    <ellipse cx="0" cy="-20" rx="85" ry="20" fill="${color}" opacity="0.1"/>
    <ellipse cx="0" cy="0" rx="95" ry="30" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <ellipse cx="0" cy="0" rx="65" ry="20" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="17" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

function sauceBowlSvg(color, label, subtitle = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/></filter></defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(200,190)">
    <path d="M-45,-20 Q-50,20 0,30 Q50,20 45,-20 Z" fill="${color}" opacity="0.7"/>
    <path d="M-45,-20 Q-50,20 0,30 Q50,20 45,-20 Z" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <ellipse cx="0" cy="-20" rx="45" ry="12" fill="${color}" opacity="0.5"/>
    <ellipse cx="0" cy="-20" rx="45" ry="12" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  </g>
  <text x="200" y="340" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="17" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
  ${subtitle ? `<text x="200" y="362" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.5)">${subtitle}</text>` : ''}
</svg>`;
}

const items = [
  // VEGETARIJANSKE JEDI
  { file: 'vegetarijanske-jedi/zelenjavni-zrezki.png', color: '#4a8c3f', label: 'Zelenjavni Zrezki' },
  { file: 'vegetarijanske-jedi/zelenjavni-kroznik.png', color: '#5ca048', label: 'Zelenjavni Kroznik' },
  { file: 'vegetarijanske-jedi/sojini-polpeti.png', color: '#7a6830', label: 'Sojini Polpeti' },
  { file: 'vegetarijanske-jedi/vegetarijanska-plosca.png', color: '#3d7a32', label: 'Vegetarijanska Plosca' },
  { file: 'vegetarijanske-jedi/bucke-na-zaru.png', color: '#6b8c28', label: 'Bucke na Zaru' },
  { file: 'vegetarijanske-jedi/ocvrte-bucke.png', color: '#8a7c20', label: 'Ocvrte Bucke' },
  { file: 'vegetarijanske-jedi/ocvrti-melancani.png', color: '#5a3828', label: 'Ocvrti Melancani' },
  { file: 'vegetarijanske-jedi/pecena-zelenjava-rukola.png', color: '#4a7c28', label: 'Pecena Zelenjava' },

  // PALACINKE
  { file: 'palacinke/jurmacinka.png', color: '#c84070', label: 'Jurmacinka' },
  { file: 'palacinke/raffaello.png', color: '#f0e8d0', label: 'Raffaello' },
  { file: 'palacinke/babicina-poslastica.png', color: '#c88030', label: 'Babicina Poslastica' },
  { file: 'palacinke/cheesecake-oreo-jagoda.png', color: '#d84060', label: 'Cheesecake Oreo Jagoda' },
  { file: 'palacinke/cheesecake-masleni-banana.png', color: '#c8a030', label: 'Cheesecake Masleni Banana' },
  { file: 'palacinke/kinder-bueno.png', color: '#8b5a2b', label: 'Kinder Bueno' },
  { file: 'palacinke/pink-dreams.png', color: '#d87090', label: 'Pink Dreams' },
  { file: 'palacinke/white-pistachio.png', color: '#90b860', label: 'White Pistachio' },
  { file: 'palacinke/snickers.png', color: '#7a5020', label: 'Snickers' },
  { file: 'palacinke/ferrero-rocher.png', color: '#6b3a10', label: 'Ferrero Rocher' },
  { file: 'palacinke/fruty-njam.png', color: '#c84050', label: 'Fruty Njam' },
  { file: 'palacinke/sweet-strawberry.png', color: '#d03050', label: 'Sweet Strawberry' },
  { file: 'palacinke/mms.png', color: '#c83030', label: "M&amp;M's" },

  // SLADICE
  { file: 'sladice/hisna-sladica.png', color: '#c88040', label: 'Hisna Sladica' },
  { file: 'sladice/panna-cotta.png', color: '#f0e0c8', label: 'Panna Cotta' },
  { file: 'sladice/palacinke-cokolada.png', color: '#5c3018', label: 'Palacinke s Cokolado' },
  { file: 'sladice/palacinke-orehi.png', color: '#8b6830', label: 'Palacinke z Orehi' },
  { file: 'sladice/palacinke-marmelada.png', color: '#c84030', label: 'Palacinke z Marmelado' },
  { file: 'sladice/palacinke-brusnice.png', color: '#a02028', label: 'Palacinke z Brusnicami' },
  { file: 'sladice/palacinke-nutella.png', color: '#4a2010', label: 'Palacinke z Nutello' },
  { file: 'sladice/palacinke-nutella-banana.png', color: '#6b4018', label: 'Palacinke Nutella Banana' },
  { file: 'sladice/palacinke-nutella-orehi.png', color: '#5a3010', label: 'Palacinke Nutello Orehi' },
  { file: 'sladice/palacinke-pehtran.png', color: '#70a040', label: 'Pehtranove Palacinke' },
  { file: 'sladice/palacinke-skuta.png', color: '#e0d8c0', label: 'Skutine Palacinke' },
  { file: 'sladice/hisna-grmada.png', color: '#b87030', label: 'Hisna Grmada' },
  { file: 'sladice/sladoled-kepica.png', color: '#f0e8d8', label: 'Sladoled Kepica' },
  { file: 'sladice/sladoled-porcija.png', color: '#e8d0b0', label: 'Sladoled Porcija' },
  { file: 'sladice/sadna-kupa.png', color: '#e84050', label: 'Sadna Kupa' },
  { file: 'sladice/banana-split.png', color: '#e8d040', label: 'Banana Split' },
  { file: 'sladice/vroce-visnje.png', color: '#8b1a28', label: 'Vroce Visnje' },
  { file: 'sladice/vroci-gozdni-sadezi.png', color: '#5a1830', label: 'Vroci Gozdni Sadezi' },
  { file: 'sladice/nutelina-torta.png', color: '#3a1808', label: 'Nutelina Torta' },
  { file: 'sladice/torte-hana.png', color: '#c8a060', label: 'Torte Hana' },
  { file: 'sladice/linolada-torta.png', color: '#a08040', label: 'Linolada Torta' },
  { file: 'sladice/cokoladni-souffle.png', color: '#2e0e04', label: 'Cokoladni Souffle' },
  { file: 'sladice/tiramisu.png', color: '#8b6830', label: 'Tiramisu' },
  { file: 'sladice/sirovi-strukelj.png', color: '#e0d8b0', label: 'Sirovi Strukelj' },

  // OTROSKE JEDI
  { file: 'otroske-jedi/juha-palacinke.png', color: '#a08040', label: 'Juha s Palacinke' },
  { file: 'otroske-jedi/miskolin.png', color: '#c8a030', label: 'Kroznik Miskolin' },
  { file: 'otroske-jedi/gusar-berto.png', color: '#4080a0', label: 'Kroznik Gusar Berto' },
  { file: 'otroske-jedi/otroski-pohancki.png', color: '#a07020', label: 'Otroški Pohancki' },
  { file: 'otroske-jedi/pingvincek.png', color: '#3070a0', label: 'Kroznik Pingvincek' },
  { file: 'otroske-jedi/korenjak.png', color: '#70a030', label: 'Kroznnik Korenjak' },
  { file: 'otroske-jedi/spagetek.png', color: '#c83020', label: 'Kroznik Spagetek' },
  { file: 'otroske-jedi/pizza-malcek.png', color: '#d04030', label: 'Pizza Malcek' },
  { file: 'otroske-jedi/pizza-jurcek.png', color: '#8b5a2b', label: 'Pizza Jurcek' },
  { file: 'otroske-jedi/metuljcek.png', color: '#a060a0', label: 'Palacinke Metuljcek' },
  { file: 'otroske-jedi/sladoled-otroski.png', color: '#e0d0c0', label: 'Sladoled' },
  { file: 'otroske-jedi/sadna-kupa-otroski.png', color: '#d04060', label: 'Sadna Kupa' },

  // MALICE
  { file: 'malice/malica-dunajski.png', color: '#a07020', label: 'Malica Dunajski Zrezek' },
  { file: 'malice/malica-pariski.png', color: '#b88030', label: 'Malica Pariski Zrezek' },
  { file: 'malice/malica-pecena-rebra.png', color: '#8b3a42', label: 'Malica Pecena Rebra' },
  { file: 'malice/malica-bbq-perutnicke.png', color: '#a04020', label: 'Malica BBQ Perutnicke' },
  { file: 'malice/malica-svinjska-pecenka.png', color: '#905030', label: 'Malica Svinjska Pecenka' },
  { file: 'malice/malica-ocvrti-oslic.png', color: '#a0a0b0', label: 'Malica Ocvrti Oslic' },
  { file: 'malice/malica-oslic-pomfri.png', color: '#909098', label: 'Malica Oslic s Pomfrijem' },
  { file: 'malice/malica-ocvrti-sir.png', color: '#c8a030', label: 'Malica Ocvrti Sir' },
  { file: 'malice/malica-spageti-bolognese.png', color: '#c83020', label: 'Malica Spageti Bolognese' },
  { file: 'malice/malica-mesni-sir.png', color: '#a08030', label: 'Malica Mesni Sir' },
  { file: 'malice/malica-bograc.png', color: '#7a3020', label: 'Malica Bograc' },
  { file: 'malice/malica-goveji-golaz.png', color: '#6b2818', label: 'Malica Goveji Golaz' },

  // PRILOGE
  { file: 'priloge/krompirjev-cips.png', color: '#c8a030', label: 'Krompirjev Cips' },
  { file: 'priloge/pommes-frites.png', color: '#d4a017', label: 'Pommes Frites' },
  { file: 'priloge/zlebasti-krompircek.png', color: '#c89018', label: 'Zlebasti Krompircek' },
  { file: 'priloge/krompirjevi-ocvrtki.png', color: '#b88020', label: 'Krompirjevi Ocvrtki' },
  { file: 'priloge/slan-krompir.png', color: '#e0d0b0', label: 'Slan Krompir' },
  { file: 'priloge/prazen-krompir.png', color: '#c8a040', label: 'Prazen Krompir' },
  { file: 'priloge/pecen-krompir.png', color: '#b89030', label: 'Pecen Krompir' },
  { file: 'priloge/kuhan-popecen-krompir.png', color: '#d0b860', label: 'Kuhan Popecen Krompir' },
  { file: 'priloge/riz.png', color: '#f0e8d0', label: 'Riz' },
  { file: 'priloge/kuhana-zelenjava.png', color: '#5a9a40', label: 'Kuhana Zelenjava' },
  { file: 'priloge/ocvrti-njoki.png', color: '#d4a017', label: 'Ocvrti Njoki' },
  { file: 'priloge/kuhani-njoki.png', color: '#f0e8d0', label: 'Kuhani Njoki' },
  { file: 'priloge/sirov-strukelj.png', color: '#e0d8b0', label: 'Sirov Strukelj' },
  { file: 'priloge/siroki-rezanci.png', color: '#e8d060', label: 'Siroki Rezanci' },
  { file: 'priloge/bucke-zar-cesen.png', color: '#6b8c28', label: 'Bucke na Zaru s Cesnom' },
  { file: 'priloge/ocvrte-bucke.png', color: '#8a7c20', label: 'Ocvrte Bucke' },
  { file: 'priloge/pecena-zelenjava.png', color: '#4a7c28', label: 'Pecena Zelenjava' },
  { file: 'priloge/grana-padano.png', color: '#d8c060', label: 'Grana Padano' },

  // OMAKE
  { file: 'omake/poprova-omaka.png', color: '#2e2e2e', label: 'Poprova Omaka' },
  { file: 'omake/gobova-omaka.png', color: '#5a4030', label: 'Gobova Omaka' },
  { file: 'omake/smetanova-omaka.png', color: '#f0e8d0', label: 'Smetanova Omaka' },
  { file: 'omake/orehova-omaka.png', color: '#6b4820', label: 'Orehova Omaka' },
  { file: 'omake/gorgonzolna-omaka.png', color: '#b8c8d0', label: 'Gorgonzolna Omaka' },
  { file: 'omake/gozdarska-omaka.png', color: '#4a3020', label: 'Gozdarska Omaka' },
  { file: 'omake/sirova-omaka.png', color: '#e8d860', label: 'Sirova Omaka' },
  { file: 'omake/curry-omaka.png', color: '#c88020', label: 'Curry Omaka' },
  { file: 'omake/gorcicna-omaka.png', color: '#a09020', label: 'Gorcicna Omaka' },
];

async function main() {
  console.log(`Generating ${items.length} food category images...`);
  let success = 0;

  for (const item of items) {
    const outputPath = path.join(BASE, item.file);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const isSauce = item.file.includes('omake/');
    const svg = isSauce ? sauceBowlSvg(item.color, item.label) : plateSvg(item.color, item.label);

    try {
      const pngBuffer = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer();
      fs.writeFileSync(outputPath, pngBuffer);
      console.log(`OK: ${item.file}`);
      success++;
    } catch (e) {
      console.error(`FAILED: ${item.file} - ${e.message}`);
    }
  }

  console.log(`\nDone: ${success}/${items.length} images generated`);
}

main().catch(console.error);
