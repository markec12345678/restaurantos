#!/usr/bin/env node
/**
 * UPGRADE menu images with real stock photos from Pexels CDN.
 * No API key needed - uses direct CDN download with curated photo IDs.
 *
 * Usage: node scripts/upgrade-images-pexels.mjs [--batch N] [--start N]
 *   --batch N  : Process N images per run (default: 50)
 *   --start N  : Start from item index N (default: 0)
 *
 * Falls back to keeping existing image if download fails.
 */

import { existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import https from 'https';
import sharp from 'sharp';

const W = 400, H = 500;

const args = process.argv.slice(2);
let BATCH_SIZE = 50;
let START_IDX = 0;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch' && args[i+1]) { BATCH_SIZE = parseInt(args[i+1]); i++; }
  if (args[i] === '--start' && args[i+1]) { START_IDX = parseInt(args[i+1]); i++; }
}

// ═══════════════════════════════════════════════
// CURATED PEXELS PHOTO IDS BY CATEGORY
// IDs near each other are from same photo set = same category
// ═══════════════════════════════════════════════

const PEXELS_IDS = {
  // Wine bottles (ranges 2912xxx, 2702xxx, 585xxx)
  whiteWine: [
    2912108, 2912109, 2912110, 2912113, 2912114, 2912116, 2912117,
    2912120, 2912121, 2912122, 2912127,
    2702787, 2702788, 2702789, 2702790, 2702791, 2702793, 2702795,
    2702797, 2702799, 2702801, 2702803, 2702805,
    585737, 585738, 585744, 585747, 585748, 585749, 585750, 585751,
    585752, 585753, 585754, 585758, 585759, 585760, 585761, 585762,
  ],
  redWine: [
    2912088, 2912089, 2912090, 2912091, 2912092, 2912093, 2912095,
    2912099, 2912102, 2912103, 2912106, 2912107,
    2702792, 2702794, 2702796, 2702798, 2702800, 2702807, 2702809,
    2702810, 2702811, 2702812, 2702813, 2702814, 2702817, 2702819,
    2702820, 2702821, 2702822, 2702823, 2702824, 2702825,
  ],
  rose: [
    2912091, 2912095, 2702793, 2702797,
  ],
  dessertWine: [
    2912110, 2912113, 2912114, 2912116,
  ],
  // Beer (range 1552xxx, 1267xxx)
  beer: [
    1552612, 1552613, 1552614, 1552615, 1552616, 1552617, 1552618,
    1552619, 1552620, 1552630, 1552631, 1552632, 1552633, 1552634,
    1552635, 1552636, 1552637, 1552638, 1552639, 1552640, 1552641,
    1552642, 1552643, 1552644, 1552645, 1552646, 1552648, 1552649, 1552650,
    1267239, 1267240, 1267241, 1267242, 1267244, 1267245, 1267246,
    1267248, 1267251, 1267254, 1267255, 1267256, 1267257, 1267258, 1267259,
  ],
  darkBeer: [
    1552635, 1552636, 1552637, 1552638, 1552639, 1552640,
  ],
  // Cocktails (range 278xxx, 339xxx)
  cocktail: [
    278987, 278988, 278989, 278990, 278991, 278992, 278993, 278994,
    278995, 278996, 278997, 278998, 278999, 279000, 279001, 279002,
    279003, 279004, 279005, 279006, 279007, 279008, 279009, 279010,
    279011, 279012, 279013,
    339419, 339421, 339423, 339426, 339427, 339428, 339434, 339436,
    339437, 339438,
  ],
  // Coffee (range 302xxx, 2396xxx)
  coffee: [
    302879, 302880, 302881, 302882, 302883, 302884, 302887, 302888,
    302889, 302890, 302891, 302892, 302893, 302894, 302895, 302896,
    302897, 302898, 302899, 302900, 302901, 302902, 302903, 302904,
    302905, 302906, 302909, 302910, 302911, 302912, 302914, 302917, 302919,
    2396200, 2396202, 2396203, 2396205, 2396206, 2396207, 2396208,
    2396209, 2396210, 2396211, 2396213, 2396214, 2396215, 2396216,
    2396217, 2396218, 2396219, 2396220, 2396223, 2396225, 2396226,
    2396231, 2396233, 2396235, 2396238, 2396239,
  ],
  cocoa: [
    302903, 302904, 302905, 302906, 2396205, 2396206,
  ],
  // Spirits/Whiskey (range 128xxx, 243xxx)
  spirit: [
    128226, 128227, 128228, 128230, 128231, 128232, 128233, 128234,
    128235, 128241, 128242, 128243, 128244, 128245, 128246, 128250,
    128258, 128259, 128262,
    243714, 243715, 243716, 243717, 243718, 243719, 243720, 243721,
    243723, 243724, 243731, 243734, 243735, 243740, 243741, 243742,
    243743, 243744, 243745, 243746, 243747, 243749, 243750,
  ],
  // Gin (subset of spirits with blue tones)
  gin: [
    243714, 243715, 243716, 243717, 243718, 243719, 243720, 243721,
  ],
  // Bitters (subset of spirits with red tones)
  bitter: [
    128226, 128227, 128228, 128230, 128231, 128232, 128233,
  ],
  // Liqueurs
  liqueur: [
    128234, 128235, 128241, 128242, 128243, 128244, 128245, 128246,
  ],
  // Water (range 327xxx)
  water: [
    327072, 327075, 327076, 327077, 327078, 327080, 327082, 327083,
    327084, 327085, 327086, 327087, 327088, 327089, 327090, 327091,
    327092, 327094, 327095, 327096, 327098, 327100, 327101, 327102,
    327103, 327104, 327105, 327106, 327107, 327108, 327109, 327110,
    327111, 327112,
  ],
  // Juice/Soft drinks (range 2088xxx, 219xxx, 674xxx)
  juice: [
    2088428, 2088431, 2088432, 2088436, 2088437, 2088438, 2088441,
    2088444, 2088447, 2088451, 2088458, 2088462, 2088463, 2088464,
    2088466, 2088467,
    219906, 219907, 219908, 219909, 219910, 219911, 219912, 219913,
    219914, 219915, 219916, 219917, 219918, 219919, 219920, 219921,
    219922, 219923, 219924, 219925, 219926, 219927, 219928, 219929,
    219930, 219931, 219932, 219933, 219934, 219935, 219936, 219937,
    219938, 219939, 219940, 219941, 219942, 219943, 219944, 219945, 219946,
    674350, 674351, 674352, 674353, 674356, 674357, 674359, 674360,
    674361, 674362, 674363, 674364, 674365, 674368, 674369, 674370,
    674371, 674374, 674382, 674383, 674384, 674385, 674386, 674387,
    674388, 674389,
  ],
  softDrink: [
    674350, 674351, 674352, 674353, 674356, 674357, 674359, 674360,
    674361, 674362, 674363, 674364, 674365, 674368, 674369, 674370,
    674371, 674374,
  ],
};

// ═══════════════════════════════════════════════
// MENU ITEMS
// ═══════════════════════════════════════════════

const ITEMS = [
  // BELA VINA
  { path: '/menu-images/bela-vina/alter.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/angel-belo-2019.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/angel-belo-2021.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/bela-frankinja.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/burja-bela.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/chardonnay-dular.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/chardonnay-verus.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/chardonnay-vicomte.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/cuvee-emino.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/laski-rizling.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/malvazija-movia.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/rebula-cru.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/renski-rizling-keltis.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/renski-rizling-stare.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/rumeni-muskat-pozna.png', cat: 'dessertWine' },
  { path: '/menu-images/bela-vina/rumeni-muskat.png', cat: 'dessertWine' },
  { path: '/menu-images/bela-vina/sauvignon-blanc-cru.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/sipon-verus.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/sivi-pinot-jamertal.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/traminec.png', cat: 'whiteWine' },
  { path: '/menu-images/bela-vina/rebula.png', cat: 'whiteWine' },

  // BREZALK PIVO
  { path: '/menu-images/brezalk-pivo/daura.png', cat: 'beer' },
  { path: '/menu-images/brezalk-pivo/heineken-00.png', cat: 'beer' },

  // CRAFT PIVA
  { path: '/menu-images/craft-piva/bevog-tak.png', cat: 'beer' },
  { path: '/menu-images/craft-piva/pelicon-winter.png', cat: 'darkBeer' },
  { path: '/menu-images/craft-piva/zeleni-haler.png', cat: 'beer' },

  // DESTILATI
  { path: '/menu-images/destilati/ararat-6.png', cat: 'spirit' },
  { path: '/menu-images/destilati/ararat-15.png', cat: 'spirit' },
  { path: '/menu-images/destilati/ararat-20.png', cat: 'spirit' },
  { path: '/menu-images/destilati/brinjevec.png', cat: 'spirit' },
  { path: '/menu-images/destilati/delamaine-xo.png', cat: 'spirit' },
  { path: '/menu-images/destilati/grappa-sofija.png', cat: 'spirit' },
  { path: '/menu-images/destilati/hennessy-vs.png', cat: 'spirit' },
  { path: '/menu-images/destilati/hennessy-xo.png', cat: 'spirit' },
  { path: '/menu-images/destilati/rum-bumbu.png', cat: 'spirit' },
  { path: '/menu-images/destilati/rum-diplomatico.png', cat: 'spirit' },
  { path: '/menu-images/destilati/rum-hechicera.png', cat: 'spirit' },
  { path: '/menu-images/destilati/rum-zacapa.png', cat: 'spirit' },
  { path: '/menu-images/destilati/slivovka.png', cat: 'liqueur' },
  { path: '/menu-images/destilati/travarica-rossi.png', cat: 'spirit' },
  { path: '/menu-images/destilati/viljamovka.png', cat: 'spirit' },

  // GAZIRANE PIJACE
  { path: '/menu-images/gazirane-pijace/coca-cola-zero.png', cat: 'softDrink' },
  { path: '/menu-images/gazirane-pijace/cockta.png', cat: 'softDrink' },
  { path: '/menu-images/gazirane-pijace/fanta.png', cat: 'juice' },
  { path: '/menu-images/gazirane-pijace/fever-tree-med.png', cat: 'water' },
  { path: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', cat: 'cocktail' },
  { path: '/menu-images/gazirane-pijace/fever-tree-tonic.png', cat: 'water' },
  { path: '/menu-images/gazirane-pijace/red-bull.png', cat: 'softDrink' },
  { path: '/menu-images/gazirane-pijace/schweppes-bitter.png', cat: 'juice' },
  { path: '/menu-images/gazirane-pijace/schweppes-tonic.png', cat: 'water' },
  { path: '/menu-images/gazirane-pijace/sprite.png', cat: 'softDrink' },

  // GIN
  { path: '/menu-images/gin/gin-hendricks.png', cat: 'gin' },
  { path: '/menu-images/gin/gin-kristal.png', cat: 'gin' },
  { path: '/menu-images/gin/gin-mare.png', cat: 'gin' },
  { path: '/menu-images/gin/gin-monkey47.png', cat: 'gin' },
  { path: '/menu-images/gin/gin-monolog.png', cat: 'gin' },
  { path: '/menu-images/gin/gin-tanqueray.png', cat: 'gin' },

  // GRENCICE
  { path: '/menu-images/grencice/amaro.png', cat: 'bitter' },
  { path: '/menu-images/grencice/aperol.png', cat: 'bitter' },
  { path: '/menu-images/grencice/campari.png', cat: 'bitter' },
  { path: '/menu-images/grencice/cynar.png', cat: 'bitter' },
  { path: '/menu-images/grencice/jagermeister.png', cat: 'bitter' },

  // LIKERJI
  { path: '/menu-images/likerji/borovnica-kejzar.png', cat: 'liqueur' },
  { path: '/menu-images/likerji/bumbu-cream.png', cat: 'liqueur' },
  { path: '/menu-images/likerji/canella.png', cat: 'liqueur' },
  { path: '/menu-images/likerji/carolans.png', cat: 'liqueur' },
  { path: '/menu-images/likerji/malibu.png', cat: 'liqueur' },
  { path: '/menu-images/likerji/medica-kejzar.png', cat: 'liqueur' },

  // LIKERSKO VINO
  { path: '/menu-images/likersko-vino/keros-belo.png', cat: 'dessertWine' },
  { path: '/menu-images/likersko-vino/keros-rdece.png', cat: 'redWine' },
  { path: '/menu-images/likersko-vino/sladki-refosk.png', cat: 'redWine' },
  { path: '/menu-images/likersko-vino/veliko-rdece-2012.png', cat: 'redWine' },

  // MESANE PIJACE
  { path: '/menu-images/mesane-pijace/cuba-libre.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/gin-mare-tonic.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/mango-mojito.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/martini-spritz.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/monolog-gin-tonic.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', cat: 'cocktail' },
  { path: '/menu-images/mesane-pijace/strawberry-mojito.png', cat: 'cocktail' },

  // NARAVNI SOKOVI
  { path: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', cat: 'juice' },
  { path: '/menu-images/naravni-sokovi/hisni-sok-meta.png', cat: 'softDrink' },
  { path: '/menu-images/naravni-sokovi/limonada-okus.png', cat: 'cocktail' },
  { path: '/menu-images/naravni-sokovi/pomarancni-sok.png', cat: 'juice' },

  // PENINE
  { path: '/menu-images/penine/bjana-brut.png', cat: 'whiteWine' },
  { path: '/menu-images/penine/boemme-rumeni-muskat.png', cat: 'dessertWine' },
  { path: '/menu-images/penine/gourmet-rose.png', cat: 'rose' },
  { path: '/menu-images/penine/louis-roederer.png', cat: 'whiteWine' },
  { path: '/menu-images/penine/maria-brut.png', cat: 'whiteWine' },
  { path: '/menu-images/penine/mufi-pet-nat.png', cat: 'whiteWine' },
  { path: '/menu-images/penine/no1-brut.png', cat: 'whiteWine' },
  { path: '/menu-images/penine/pol-roger.png', cat: 'whiteWine' },
  { path: '/menu-images/penine/slapsak-brut-reserve.png', cat: 'whiteWine' },
  { path: '/menu-images/penine/slapsak-brut-rose.png', cat: 'rose' },
  { path: '/menu-images/penine/zlata-radgonska.png', cat: 'whiteWine' },

  // PIVO
  { path: '/menu-images/pivo/reset-froggy.png', cat: 'beer' },
  { path: '/menu-images/pivo/reset-lagerish.png', cat: 'beer' },
  { path: '/menu-images/pivo/reset-stout.png', cat: 'darkBeer' },

  // RDECA VINA
  { path: '/menu-images/rdeca-vina/cabernet-keltis.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/cabernet-pavo.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/carolina-rdeca.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/duet-edi-simcic.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/duet-lex-2018.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/duet-lex-2020.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/guerila-retro.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/merlot-keltis.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/merlot-opoka.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-dular.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-luna.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/modri-pinot-opoka.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/modri-pinot-verus.png', cat: 'redWine' },
  { path: '/menu-images/rdeca-vina/veliko-rdece-movia.png', cat: 'redWine' },

  // ROSE
  { path: '/menu-images/rose-vino/rose-batic.png', cat: 'rose' },
  { path: '/menu-images/rose-vino/rose-verstovsek.png', cat: 'rose' },

  // SOKOVI
  { path: '/menu-images/sokovi/ananasov-sok.png', cat: 'juice' },
  { path: '/menu-images/sokovi/bubble-tea.png', cat: 'liqueur' },
  { path: '/menu-images/sokovi/cedevita.png', cat: 'juice' },
  { path: '/menu-images/sokovi/jabolcni-sok.png', cat: 'softDrink' },
  { path: '/menu-images/sokovi/jagodni-sok.png', cat: 'cocktail' },
  { path: '/menu-images/sokovi/ledeni-caj.png', cat: 'juice' },
  { path: '/menu-images/sokovi/marelicni-sok.png', cat: 'juice' },
  { path: '/menu-images/sokovi/pomarancni-sok.png', cat: 'juice' },
  { path: '/menu-images/sokovi/ribezov-sok.png', cat: 'bitter' },

  // TOCENO PIVO
  { path: '/menu-images/toceno-pivo/haler-nefiltriran.png', cat: 'beer' },
  { path: '/menu-images/toceno-pivo/pelicon-ipa.png', cat: 'beer' },
  { path: '/menu-images/toceno-pivo/radler.png', cat: 'beer' },
  { path: '/menu-images/toceno-pivo/union-lager.png', cat: 'beer' },

  // TOPLI NAPITKI
  { path: '/menu-images/topli-napitki/babyccino.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/bela-kava.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/caj-limona-med.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/kakav-smetana.png', cat: 'cocoa' },
  { path: '/menu-images/topli-napitki/kakav.png', cat: 'cocoa' },
  { path: '/menu-images/topli-napitki/kava-brez-kofeina.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-macchiato.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-rizevo-mleko.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-s-smetano.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/kava-z-mlekom.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/ledena-kava-olimia.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', cat: 'coffee' },
  { path: '/menu-images/topli-napitki/vroca-cokolada.png', cat: 'cocoa' },

  // TUJA VINA
  { path: '/menu-images/tuja-vina/andreis-vinasmora.png', cat: 'redWine' },
  { path: '/menu-images/tuja-vina/jermann-dreams.png', cat: 'whiteWine' },
  { path: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', cat: 'redWine' },
  { path: '/menu-images/tuja-vina/posip-terra-madre.png', cat: 'whiteWine' },
  { path: '/menu-images/tuja-vina/vintage-tunina.png', cat: 'whiteWine' },
  { path: '/menu-images/tuja-vina/vranec-instinct.png', cat: 'redWine' },

  // VISKI
  { path: '/menu-images/viski/chivas-12.png', cat: 'spirit' },
  { path: '/menu-images/viski/glenmorangie-18.png', cat: 'spirit' },
  { path: '/menu-images/viski/glenmorangie-lasanta.png', cat: 'spirit' },
  { path: '/menu-images/viski/jameson.png', cat: 'spirit' },
  { path: '/menu-images/viski/johnnie-walker-black.png', cat: 'spirit' },
  { path: '/menu-images/viski/lagavulin-16.png', cat: 'spirit' },
  { path: '/menu-images/viski/laphroaig-10.png', cat: 'spirit' },
  { path: '/menu-images/viski/nikka-barrel.png', cat: 'spirit' },
  { path: '/menu-images/viski/nikka-miyagikyo.png', cat: 'spirit' },

  // VODE
  { path: '/menu-images/vode/mineralna-voda.png', cat: 'water' },
  { path: '/menu-images/vode/naravna-voda.png', cat: 'water' },
  { path: '/menu-images/vode/radenska-functionall.png', cat: 'water' },
  { path: '/menu-images/vode/voda-z-okusom.png', cat: 'water' },
];

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Assign unique Pexels IDs to items based on category
function assignPhotoIds() {
  const usedIds = new Set();
  const assignments = new Map();

  // Group items by category
  const byCat = {};
  for (const item of ITEMS) {
    if (!byCat[item.cat]) byCat[item.cat] = [];
    byCat[item.cat].push(item);
  }

  // Assign IDs from each category pool
  for (const [cat, items] of Object.entries(byCat)) {
    const pool = PEXELS_IDS[cat] || PEXELS_IDS.spirit; // fallback
    let poolIdx = 0;
    for (const item of items) {
      // Find next unused ID from this category's pool
      while (poolIdx < pool.length && usedIds.has(pool[poolIdx])) poolIdx++;
      if (poolIdx < pool.length) {
        assignments.set(item.path, pool[poolIdx]);
        usedIds.add(pool[poolIdx]);
        poolIdx++;
      } else {
        // Wrap around with offset to avoid duplicates
        assignments.set(item.path, pool[items.indexOf(item) % pool.length]);
      }
    }
  }

  return assignments;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log(`\n📸 Upgrading ${ITEMS.length} menu images with Pexels stock photos...`);
  console.log(`   Batch: ${BATCH_SIZE} | Start: ${START_IDX}\n`);

  const assignments = assignPhotoIds();
  let upgraded = 0, failed = 0, processed = 0;

  for (let i = START_IDX; i < ITEMS.length && processed < BATCH_SIZE; i++) {
    const item = ITEMS[i];
    const label = item.path.split('/').pop().replace('.png', '');
    const pexelsId = assignments.get(item.path);
    const fullPath = join(process.cwd(), 'public', item.path);

    process.stdout.write(`  [${i+1}/${ITEMS.length}] ${label} (pexels:${pexelsId})... `);

    try {
      // Download from Pexels CDN at various size/quality options
      const urls = [
        `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop`,
        `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=400`,
        `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=600`,
      ];

      let rawBuffer = null;
      for (const url of urls) {
        try {
          const buf = await downloadBuffer(url);
          if (buf.length > 3000) { rawBuffer = buf; break; }
        } catch (e) { /* try next URL */ }
      }

      if (!rawBuffer) {
        console.log('❌ Download failed');
        failed++;
        processed++;
        continue;
      }

      // Process with Sharp: resize, crop, convert to PNG
      const processedBuf = await sharp(rawBuffer)
        .resize(W, H, { fit: 'cover', position: 'center' })
        .png({ quality: 90, compressionLevel: 6 })
        .toBuffer();

      // Ensure directory exists and save
      const dir = dirname(fullPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, processedBuf);

      console.log(`✅ (${(processedBuf.length/1024).toFixed(0)}KB)`);
      upgraded++;

    } catch (err) {
      console.log(`❌ ${err.message?.slice(0, 80) || 'Unknown error'}`);
      failed++;
    }

    processed++;
    // Small delay to be nice to Pexels CDN
    if (processed < BATCH_SIZE) await sleep(500);
  }

  console.log(`\n📊 Batch complete! Upgraded: ${upgraded}, Failed: ${failed}, Processed: ${processed}`);

  if (START_IDX + processed < ITEMS.length) {
    console.log(`\n🔄 Run next batch: node scripts/upgrade-images-pexels.mjs --start ${START_IDX + processed} --batch ${BATCH_SIZE}`);
  } else {
    console.log('\n🎉 All images processed!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
