#!/usr/bin/env node
/**
 * UPGRADE menu images from SVG placeholders to real stock photos.
 * Uses z-ai-web-dev-sdk web_search to find free stock photos from Pexels,
 * then downloads and processes them with Sharp.
 *
 * No AI image generation quota needed!
 *
 * Usage: node scripts/upgrade-images-stock.mjs [--batch N] [--start N] [--delay MS]
 *   --batch N  : Process N images per run (default: 10)
 *   --start N  : Start from item index N (default: 0)
 *   --delay MS : Delay between downloads in ms (default: 3000)
 *
 * Already-upgraded images (files > 30KB) are skipped.
 */

import { existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import https from 'https';
import http from 'http';
import sharp from 'sharp';
import ZAI from 'z-ai-web-dev-sdk';

const MIN_AI_SIZE = 30000;
const TARGET_W = 400;
const TARGET_H = 500;

const args = process.argv.slice(2);
let BATCH_SIZE = 10;
let START_IDX = 0;
let DELAY_MS = 3000;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch' && args[i+1]) { BATCH_SIZE = parseInt(args[i+1]); i++; }
  if (args[i] === '--start' && args[i+1]) { START_IDX = parseInt(args[i+1]); i++; }
  if (args[i] === '--delay' && args[i+1]) { DELAY_MS = parseInt(args[i+1]); i++; }
}

// ═══════════════════════════════════════════════
// MENU ITEMS WITH SEARCH QUERIES
// ═══════════════════════════════════════════════

const ITEMS = [
  // BELA VINA
  { path: '/menu-images/bela-vina/alter.png', query: 'slovenian white wine bottle organic' },
  { path: '/menu-images/bela-vina/angel-belo-2019.png', query: 'white wine magnum bottle premium' },
  { path: '/menu-images/bela-vina/angel-belo-2021.png', query: 'white wine bottle elegant cuvee' },
  { path: '/menu-images/bela-vina/bela-frankinja.png', query: 'golden white wine bottle semi sweet' },
  { path: '/menu-images/bela-vina/burja-bela.png', query: 'biodynamic natural white wine bottle' },
  { path: '/menu-images/bela-vina/chardonnay-dular.png', query: 'chardonnay white wine bottle green glass' },
  { path: '/menu-images/bela-vina/chardonnay-verus.png', query: 'chardonnay white wine bottle modern label' },
  { path: '/menu-images/bela-vina/chardonnay-vicomte.png', query: 'premium chardonnay wine bottle french style' },
  { path: '/menu-images/bela-vina/cuvee-emino.png', query: 'white wine blend bottle contemporary' },
  { path: '/menu-images/bela-vina/laski-rizling.png', query: 'welschriesling white wine bottle traditional' },
  { path: '/menu-images/bela-vina/malvazija-movia.png', query: 'malvazija white wine bottle brda slovenia' },
  { path: '/menu-images/bela-vina/rebula-cru.png', query: 'ribolla gialla premium white wine bottle' },
  { path: '/menu-images/bela-vina/renski-rizling-keltis.png', query: 'riesling white wine bottle organic eco' },
  { path: '/menu-images/bela-vina/renski-rizling-stare.png', query: 'aged riesling white wine bottle vintage' },
  { path: '/menu-images/bela-vina/rumeni-muskat-pozna.png', query: 'late harvest sweet white wine bottle golden' },
  { path: '/menu-images/bela-vina/rumeni-muskat.png', query: 'muscat white wine bottle aromatic semi sweet' },
  { path: '/menu-images/bela-vina/sauvignon-blanc-cru.png', query: 'sauvignon blanc premium white wine bottle' },
  { path: '/menu-images/bela-vina/sipon-verus.png', query: 'furmint sipon white wine bottle styria' },
  { path: '/menu-images/bela-vina/sivi-pinot-jamertal.png', query: 'pinot grigio gris white wine bottle elegant' },
  { path: '/menu-images/bela-vina/traminec.png', query: 'gewurztraminer white wine bottle aromatic' },
  { path: '/menu-images/bela-vina/rebula.png', query: 'ribolla white wine bottle rustic modern' },

  // BREZALK PIVO
  { path: '/menu-images/brezalk-pivo/daura.png', query: 'non alcoholic beer bottle golden lager' },
  { path: '/menu-images/brezalk-pivo/heineken-00.png', query: 'heineken non alcoholic beer green bottle' },

  // CRAFT PIVA
  { path: '/menu-images/craft-piva/bevog-tak.png', query: 'pale ale craft beer bottle artistic label' },
  { path: '/menu-images/craft-piva/pelicon-winter.png', query: 'dark craft beer bottle winter ale' },
  { path: '/menu-images/craft-piva/zeleni-haler.png', query: 'hemp craft beer lager bottle green' },

  // DESTILATI
  { path: '/menu-images/destilati/ararat-6.png', query: 'armenian brandy bottle gold label' },
  { path: '/menu-images/destilati/ararat-15.png', query: 'premium armenian brandy bottle ornate' },
  { path: '/menu-images/destilati/ararat-20.png', query: 'ultra premium brandy decanter bottle luxury' },
  { path: '/menu-images/destilati/brinjevec.png', query: 'juniper brandy clear bottle traditional' },
  { path: '/menu-images/destilati/delamaine-xo.png', query: 'cognac xo crystal decanter bottle premium' },
  { path: '/menu-images/destilati/grappa-sofija.png', query: 'grappa clear spirit bottle elegant' },
  { path: '/menu-images/destilati/hennessy-vs.png', query: 'hennessy vs cognac bottle iconic' },
  { path: '/menu-images/destilati/hennessy-xo.png', query: 'hennessy xo cognac decanter bottle luxury' },
  { path: '/menu-images/destilati/rum-bumbu.png', query: 'bumbu rum bottle caribbean round' },
  { path: '/menu-images/destilati/rum-diplomatico.png', query: 'diplomatico rum bottle dark elegant' },
  { path: '/menu-images/destilati/rum-hechicera.png', query: 'aged rum bottle tall minimalist premium' },
  { path: '/menu-images/destilati/rum-zacapa.png', query: 'zacapa rum bottle round woven band' },
  { path: '/menu-images/destilati/slivovka.png', query: 'plum brandy slivovitz bottle traditional' },
  { path: '/menu-images/destilati/travarica-rossi.png', query: 'herbal brandy clear bottle istrian' },
  { path: '/menu-images/destilati/viljamovka.png', query: 'pear brandy williams bottle clear fruit' },

  // GAZIRANE PIJACE
  { path: '/menu-images/gazirane-pijace/coca-cola-zero.png', query: 'coca cola zero can black red' },
  { path: '/menu-images/gazirane-pijace/cockta.png', query: 'cockta slovenian soda brown bottle retro' },
  { path: '/menu-images/gazirane-pijace/fanta.png', query: 'fanta orange soda can bright' },
  { path: '/menu-images/gazirane-pijace/fever-tree-med.png', query: 'fever tree mediterranean tonic water bottle slim' },
  { path: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', query: 'fever tree rhubarb tonic water bottle pink' },
  { path: '/menu-images/gazirane-pijace/fever-tree-tonic.png', query: 'fever tree indian tonic water bottle premium' },
  { path: '/menu-images/gazirane-pijace/red-bull.png', query: 'red bull energy drink can blue silver' },
  { path: '/menu-images/gazirane-pijace/schweppes-bitter.png', query: 'schweppes bitter lemon glass bottle yellow' },
  { path: '/menu-images/gazirane-pijace/schweppes-tonic.png', query: 'schweppes tonic water glass bottle green' },
  { path: '/menu-images/gazirane-pijace/sprite.png', query: 'sprite lemon lime soda can green' },

  // GIN
  { path: '/menu-images/gin/gin-hendricks.png', query: 'hendricks gin dark apothecary bottle' },
  { path: '/menu-images/gin/gin-kristal.png', query: 'london dry gin clear bottle elegant' },
  { path: '/menu-images/gin/gin-mare.png', query: 'gin mare blue glass bottle mediterranean' },
  { path: '/menu-images/gin/gin-monkey47.png', query: 'monkey 47 gin dark bottle schwarzwald' },
  { path: '/menu-images/gin/gin-monolog.png', query: 'craft gin bottle minimalist modern slovenian' },
  { path: '/menu-images/gin/gin-tanqueray.png', query: 'tanqueray gin green bottle red seal' },

  // GRENCICE
  { path: '/menu-images/grencice/amaro.png', query: 'amaro herbal bitter liqueur brown bottle' },
  { path: '/menu-images/grencice/aperol.png', query: 'aperol orange italian aperitif bottle slim' },
  { path: '/menu-images/grencice/campari.png', query: 'campari red bitter bottle round' },
  { path: '/menu-images/grencice/cynar.png', query: 'cynar artichoke bitter aperitif bottle' },
  { path: '/menu-images/grencice/jagermeister.png', query: 'jagermeister green bottle stag head' },

  // LIKERJI
  { path: '/menu-images/likerji/borovnica-kejzar.png', query: 'blueberry liqueur bottle purple dark' },
  { path: '/menu-images/likerji/bumbu-cream.png', query: 'rum cream liqueur round bottle caribbean' },
  { path: '/menu-images/likerji/canella.png', query: 'prosecco cream liqueur bottle elegant' },
  { path: '/menu-images/likerji/carolans.png', query: 'irish cream liqueur bottle gold label' },
  { path: '/menu-images/likerji/malibu.png', query: 'malibu coconut rum white bottle palm' },
  { path: '/menu-images/likerji/medica-kejzar.png', query: 'honey liqueur bottle golden amber' },

  // LIKERSKO VINO
  { path: '/menu-images/likersko-vino/keros-belo.png', query: 'sweet dessert white wine bottle small' },
  { path: '/menu-images/likersko-vino/keros-rdece.png', query: 'sweet dessert red wine bottle small' },
  { path: '/menu-images/likersko-vino/sladki-refosk.png', query: 'sweet red dessert wine bottle ruby' },
  { path: '/menu-images/likersko-vino/veliko-rdece-2012.png', query: 'large format red wine magnum bottle luxury' },

  // MESANE PIJACE
  { path: '/menu-images/mesane-pijace/cuba-libre.png', query: 'cuba libre cocktail glass rum cola lime' },
  { path: '/menu-images/mesane-pijace/gin-mare-tonic.png', query: 'gin tonic copa glass rosemary mediterranean' },
  { path: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', query: 'gin tonic balloon glass cucumber slice' },
  { path: '/menu-images/mesane-pijace/mango-mojito.png', query: 'mango mojito cocktail glass mint lime' },
  { path: '/menu-images/mesane-pijace/martini-spritz.png', query: 'martini spritz cocktail wine glass prosecco' },
  { path: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', query: 'craft gin tonic glass juniper rosemary' },
  { path: '/menu-images/mesane-pijace/monolog-gin-tonic.png', query: 'gin tonic glass slovenian craft lime' },
  { path: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', query: 'orange ginger gin tonic glass warm' },
  { path: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', query: 'pink gin tonic glass raspberries' },
  { path: '/menu-images/mesane-pijace/strawberry-mojito.png', query: 'strawberry mojito cocktail glass mint rum' },

  // NARAVNI SOKOVI
  { path: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', query: 'homemade iced tea glass amber lemon' },
  { path: '/menu-images/naravni-sokovi/hisni-sok-meta.png', query: 'fresh mint juice glass green ice' },
  { path: '/menu-images/naravni-sokovi/limonada-okus.png', query: 'lemonade glass pink elderflower ginger' },
  { path: '/menu-images/naravni-sokovi/pomarancni-sok.png', query: 'freshly squeezed orange juice glass vibrant' },

  // PENINE
  { path: '/menu-images/penine/bjana-brut.png', query: 'sparkling wine bottle brut slovenian' },
  { path: '/menu-images/penine/boemme-rumeni-muskat.png', query: 'semi dry sparkling wine bottle golden' },
  { path: '/menu-images/penine/gourmet-rose.png', query: 'rose sparkling wine bottle pink elegant' },
  { path: '/menu-images/penine/louis-roederer.png', query: 'champagne bottle louis roederer luxury' },
  { path: '/menu-images/penine/maria-brut.png', query: 'sparkling wine bottle minimalist label' },
  { path: '/menu-images/penine/mufi-pet-nat.png', query: 'natural petillant naturel wine bottle craft' },
  { path: '/menu-images/penine/no1-brut.png', query: 'sparkling wine bottle tall green' },
  { path: '/menu-images/penine/pol-roger.png', query: 'champagne bottle pol roger premium gold' },
  { path: '/menu-images/penine/slapsak-brut-reserve.png', query: 'sparkling wine brut reserve bottle elegant' },
  { path: '/menu-images/penine/slapsak-brut-rose.png', query: 'rose sparkling wine bottle pink hue' },
  { path: '/menu-images/penine/zlata-radgonska.png', query: 'sparkling wine bottle traditional gold label' },

  // PIVO
  { path: '/menu-images/pivo/reset-froggy.png', query: 'ipa craft beer bottle colorful frog label' },
  { path: '/menu-images/pivo/reset-lagerish.png', query: 'cream ale craft beer bottle artistic' },
  { path: '/menu-images/pivo/reset-stout.png', query: 'stout dark beer bottle irish moody' },

  // RDECA VINA
  { path: '/menu-images/rdeca-vina/cabernet-keltis.png', query: 'cabernet sauvignon red wine bottle organic' },
  { path: '/menu-images/rdeca-vina/cabernet-pavo.png', query: 'premium cabernet red wine bottle limited' },
  { path: '/menu-images/rdeca-vina/carolina-rdeca.png', query: 'red wine blend bottle elegant slovenian' },
  { path: '/menu-images/rdeca-vina/duet-edi-simcic.png', query: 'premium red wine bottle blend brda' },
  { path: '/menu-images/rdeca-vina/duet-lex-2018.png', query: 'magnum red wine bottle 1.5L luxury' },
  { path: '/menu-images/rdeca-vina/duet-lex-2020.png', query: 'red wine bottle elegant lex label' },
  { path: '/menu-images/rdeca-vina/guerila-retro.png', query: 'red wine bottle retro artistic label' },
  { path: '/menu-images/rdeca-vina/merlot-keltis.png', query: 'merlot red wine bottle organic eco' },
  { path: '/menu-images/rdeca-vina/merlot-opoka.png', query: 'premium merlot red wine bottle luxury' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-dular.png', query: 'blaufrankisch red wine bottle organic' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-luna.png', query: 'red wine bottle moon themed elegant' },
  { path: '/menu-images/rdeca-vina/modri-pinot-opoka.png', query: 'pinot noir ultra premium red wine bottle' },
  { path: '/menu-images/rdeca-vina/modri-pinot-verus.png', query: 'pinot noir red wine bottle sleek modern' },
  { path: '/menu-images/rdeca-vina/veliko-rdece-movia.png', query: 'legendary red wine bottle minimalist iconic' },

  // ROSE
  { path: '/menu-images/rose-vino/rose-batic.png', query: 'rose wine bottle pink elegant organic' },
  { path: '/menu-images/rose-vino/rose-verstovsek.png', query: 'rose wine bottle modern minimalist' },

  // SOKOVI
  { path: '/menu-images/sokovi/ananasov-sok.png', query: 'pineapple juice glass yellow tropical' },
  { path: '/menu-images/sokovi/bubble-tea.png', query: 'bubble tea boba tapioca pearls glass' },
  { path: '/menu-images/sokovi/cedevita.png', query: 'vitamin drink orange powder glass slovenian' },
  { path: '/menu-images/sokovi/jabolcni-sok.png', query: 'apple juice glass golden natural' },
  { path: '/menu-images/sokovi/jagodni-sok.png', query: 'strawberry juice glass red berries' },
  { path: '/menu-images/sokovi/ledeni-caj.png', query: 'iced tea glass amber cold lemon' },
  { path: '/menu-images/sokovi/marelicni-sok.png', query: 'apricot juice glass orange golden' },
  { path: '/menu-images/sokovi/pomarancni-sok.png', query: 'orange juice glass carton citrus' },
  { path: '/menu-images/sokovi/ribezov-sok.png', query: 'currant juice glass deep red black' },

  // TOCENO PIVO
  { path: '/menu-images/toceno-pivo/haler-nefiltriran.png', query: 'draft beer glass unfiltered golden hazy foam' },
  { path: '/menu-images/toceno-pivo/pelicon-ipa.png', query: 'craft ipa draft beer glass amber foam' },
  { path: '/menu-images/toceno-pivo/radler.png', query: 'radler beer glass grapefruit citrus light' },
  { path: '/menu-images/toceno-pivo/union-lager.png', query: 'lager draft beer glass golden white foam' },

  // TOPLI NAPITKI
  { path: '/menu-images/topli-napitki/babyccino.png', query: 'babyccino small cup frothy milk chocolate' },
  { path: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', query: 'decaf white coffee cup steamed milk' },
  { path: '/menu-images/topli-napitki/bela-kava.png', query: 'white coffee cup milky steamed milk' },
  { path: '/menu-images/topli-napitki/caj-limona-med.png', query: 'hot tea cup lemon honey herbal' },
  { path: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', query: 'decaf cappuccino cup milk foam latte art' },
  { path: '/menu-images/topli-napitki/kakav-smetana.png', query: 'hot cocoa whipped cream mug chocolate dust' },
  { path: '/menu-images/topli-napitki/kakav.png', query: 'hot chocolate cocoa mug rich dark' },
  { path: '/menu-images/topli-napitki/kava-brez-kofeina.png', query: 'decaf espresso small cup coffee shot' },
  { path: '/menu-images/topli-napitki/kava-macchiato.png', query: 'espresso macchiato small cup milk spot' },
  { path: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', query: 'decaf coffee with milk cup steamed' },
  { path: '/menu-images/topli-napitki/kava-rizevo-mleko.png', query: 'coffee rice milk cup plant based' },
  { path: '/menu-images/topli-napitki/kava-s-smetano.png', query: 'coffee whipped cream cup espresso' },
  { path: '/menu-images/topli-napitki/kava-z-mlekom.png', query: 'coffee with milk cup steamed warm' },
  { path: '/menu-images/topli-napitki/ledena-kava-olimia.png', query: 'iced coffee tall glass layered ice cream' },
  { path: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', query: 'decaf macchiato small cup milk spot' },
  { path: '/menu-images/topli-napitki/vroca-cokolada.png', query: 'hot chocolate thick rich whipped cream shavings' },

  // TUJA VINA
  { path: '/menu-images/tuja-vina/andreis-vinasmora.png', query: 'croatian red wine bottle rustic mediterranean' },
  { path: '/menu-images/tuja-vina/jermann-dreams.png', query: 'italian white wine bottle jermann premium' },
  { path: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', query: 'croatian red wine bottle dalmatia' },
  { path: '/menu-images/tuja-vina/posip-terra-madre.png', query: 'croatian white wine bottle dalmatia elegant' },
  { path: '/menu-images/tuja-vina/vintage-tunina.png', query: 'italian premium white wine bottle artistic' },
  { path: '/menu-images/tuja-vina/vranec-instinct.png', query: 'macedonian red wine bottle bold dark' },

  // VISKI
  { path: '/menu-images/viski/chivas-12.png', query: 'chivas regal 12 blended scotch whisky bottle' },
  { path: '/menu-images/viski/glenmorangie-18.png', query: 'glenmorangie 18 single malt whisky bottle tall' },
  { path: '/menu-images/viski/glenmorangie-lasanta.png', query: 'glenmorangie lasanta sherry cask whisky bottle' },
  { path: '/menu-images/viski/jameson.png', query: 'jameson irish whiskey bottle green label' },
  { path: '/menu-images/viski/johnnie-walker-black.png', query: 'johnnie walker black label square bottle' },
  { path: '/menu-images/viski/lagavulin-16.png', query: 'lagavulin 16 islay single malt whisky bottle' },
  { path: '/menu-images/viski/laphroaig-10.png', query: 'laphroaig 10 islay whisky bottle green' },
  { path: '/menu-images/viski/nikka-barrel.png', query: 'nikka from the barrel japanese whisky short' },
  { path: '/menu-images/viski/nikka-miyagikyo.png', query: 'nikka miyagikyo japanese single malt whisky elegant' },

  // VODE
  { path: '/menu-images/vode/mineralna-voda.png', query: 'sparkling mineral water glass bottle carbonated' },
  { path: '/menu-images/vode/naravna-voda.png', query: 'natural still water clear glass bottle pure' },
  { path: '/menu-images/vode/radenska-functionall.png', query: 'functional water bottle modern slovenian' },
  { path: '/menu-images/vode/voda-z-okusom.png', query: 'flavored water bottle fruit essence refreshing' },
];

// ═══════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * Download a file from URL and return as Buffer
 */
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 15000 }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadBuffer(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Extract Pexels photo ID from URL patterns like:
 * - https://www.pexels.com/photo/slug-123456/
 * - https://www.pexels.com/photo/123456/
 */
function extractPexelsId(url) {
  const match = url.match(/pexels\.com\/photo\/[^/]*?(\d{5,})\/?/);
  return match ? match[1] : null;
}

/**
 * Extract Unsplash photo ID from URL patterns like:
 * - https://unsplash.com/photos/slug-abc123
 * - https://unsplash.com/photos/abc123
 */
function extractUnsplashId(url) {
  const match = url.match(/unsplash\.com\/photos\/[^/]*?([a-zA-Z0-9_-]{8,})\/?/);
  return match ? match[1] : null;
}

/**
 * Search for stock photo URLs using web search
 */
async function searchStockPhoto(zai, query) {
  const searchResult = await zai.functions.invoke("web_search", {
    query: `${query} site:pexels.com OR site:unsplash.com`,
    num: 5
  });

  const results = searchResult || [];

  // Try to find Pexels URLs first (easier to download from CDN)
  for (const result of results) {
    const pexelsId = extractPexelsId(result.url);
    if (pexelsId) {
      return { type: 'pexels', id: pexelsId, url: result.url };
    }
  }

  // Try Unsplash URLs
  for (const result of results) {
    const unsplashId = extractUnsplashId(result.url);
    if (unsplashId) {
      return { type: 'unsplash', id: unsplashId, url: result.url };
    }
  }

  // Fallback: broader search for any image source
  const broadSearch = await zai.functions.invoke("web_search", {
    query: `${query} free stock photo`,
    num: 5
  });

  const broadResults = broadSearch || [];
  for (const result of broadResults) {
    const pexelsId = extractPexelsId(result.url);
    if (pexelsId) {
      return { type: 'pexels', id: pexelsId, url: result.url };
    }
  }
  for (const result of broadResults) {
    const unsplashId = extractUnsplashId(result.url);
    if (unsplashId) {
      return { type: 'unsplash', id: unsplashId, url: result.url };
    }
  }

  return null;
}

/**
 * Download image from Pexels CDN using photo ID
 */
async function downloadPexelsImage(photoId) {
  const sizes = [
    `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop`,
    `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=400`,
    `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=600`,
  ];
  
  for (const url of sizes) {
    try {
      const buffer = await downloadBuffer(url);
      if (buffer.length > 5000) return buffer; // Valid image should be > 5KB
    } catch (e) {
      // Try next size variant
    }
  }
  throw new Error('Could not download from Pexels CDN');
}

/**
 * Download image from Unsplash using photo ID
 */
async function downloadUnsplashImage(photoId) {
  const url = `https://images.unsplash.com/photo-${photoId}?w=400&h=500&fit=crop&q=80`;
  try {
    const buffer = await downloadBuffer(url);
    if (buffer.length > 5000) return buffer;
  } catch (e) {
    // Try without the photo- prefix
    try {
      const url2 = `https://images.unsplash.com/${photoId}?w=400&h=500&fit=crop&q=80`;
      const buffer = await downloadBuffer(url2);
      if (buffer.length > 5000) return buffer;
    } catch (e2) {
      throw new Error('Could not download from Unsplash');
    }
  }
  throw new Error('Could not download from Unsplash');
}

/**
 * Process image with Sharp: resize, crop to target dimensions, optimize
 */
async function processImage(buffer) {
  return sharp(buffer)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'center' })
    .png({ quality: 90 })
    .toBuffer();
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log(`\n📸 Upgrading ${ITEMS.length} menu images with free stock photos...`);
  console.log(`   Batch: ${BATCH_SIZE} images | Start: ${START_IDX} | Delay: ${DELAY_MS}ms`);
  console.log(`   Skipping images already > ${MIN_AI_SIZE/1000}KB (already upgraded)\n`);

  const zai = await ZAI.create();
  let upgraded = 0, skipped = 0, failed = 0, processed = 0;

  for (let i = START_IDX; i < ITEMS.length && processed < BATCH_SIZE; i++) {
    const item = ITEMS[i];
    const fullPath = join(process.cwd(), 'public', item.path);

    // Skip already-upgraded images
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      if (stat.size > MIN_AI_SIZE) {
        skipped++;
        continue;
      }
    }

    const label = item.path.split('/').pop().replace('.png', '');
    process.stdout.write(`  [${i+1}/${ITEMS.length}] ${label}... `);

    try {
      // Step 1: Search for stock photo
      const photoInfo = await searchStockPhoto(zai, item.query);

      if (!photoInfo) {
        console.log(`❌ No stock photo found`);
        failed++;
        processed++;
        if (processed < BATCH_SIZE) await sleep(DELAY_MS);
        continue;
      }

      // Step 2: Download the image
      let rawBuffer;
      try {
        if (photoInfo.type === 'pexels') {
          rawBuffer = await downloadPexelsImage(photoInfo.id);
        } else {
          rawBuffer = await downloadUnsplashImage(photoInfo.id);
        }
      } catch (dlErr) {
        console.log(`❌ Download failed: ${dlErr.message}`);
        failed++;
        processed++;
        if (processed < BATCH_SIZE) await sleep(DELAY_MS);
        continue;
      }

      // Step 3: Process with Sharp
      const processedBuffer = await processImage(rawBuffer);

      // Step 4: Ensure directory exists and save
      const dir = dirname(fullPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, processedBuffer);

      console.log(`✅ (${(processedBuffer.length/1024).toFixed(0)}KB, ${photoInfo.type}:${photoInfo.id})`);
      upgraded++;

    } catch (err) {
      console.log(`❌ ${err.message?.slice(0, 100) || 'Unknown error'}`);
      failed++;
    }

    processed++;

    if (processed < BATCH_SIZE) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n📊 Batch complete! Upgraded: ${upgraded}, Skipped: ${skipped}, Failed: ${failed}, Processed: ${processed}`);

  // Find remaining items for next batch
  const remaining = ITEMS.filter((item, idx) => {
    if (idx < START_IDX) return false;
    const fp = join(process.cwd(), 'public', item.path);
    if (existsSync(fp)) return statSync(fp).size <= MIN_AI_SIZE;
    return true;
  }).length;

  if (remaining > 0) {
    console.log(`\n🔄 Run next batch: node scripts/upgrade-images-stock.mjs --start ${START_IDX + processed} --batch ${BATCH_SIZE}`);
  } else {
    console.log(`\n🎉 All images upgraded!`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
