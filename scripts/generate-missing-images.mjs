#!/usr/bin/env node
/**
 * Generate UNIQUE images for all duplicate menu items.
 * Uses programmatic SVG generation with unique designs per item,
 * then converts to PNG using Sharp.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';

const PUBLIC_DIR = join(process.cwd(), 'public', 'menu-images');

// Category-specific color palettes and icon styles
const CATEGORY_STYLES = {
  'bela-vina': { bg: '#fef9ef', accent: '#d4a017', icon: '🍷', label: 'BELA VINA' },
  'rdeca-vina': { bg: '#3a0a0a', accent: '#8b0000', icon: '🍷', label: 'RDEČA VINA' },
  'rose-vino': { bg: '#fff0f5', accent: '#e75480', icon: '🌸', label: 'ROSÉ' },
  'penine': { bg: '#fdf5e6', accent: '#c9a227', icon: '🥂', label: 'PENINE' },
  'tuja-vina': { bg: '#1a1a3e', accent: '#6366f1', icon: '🌍', label: 'TUJA VINA' },
  'likersko-vino': { bg: '#2d1b2e', accent: '#a855f7', icon: '🍷', label: 'LIKERSKO VINO' },
  'toceno-pivo': { bg: '#1a1206', accent: '#d97706', icon: '🍺', label: 'TOČENO PIVO' },
  'pivo': { bg: '#1c1206', accent: '#ea580c', icon: '🍻', label: 'PIVO' },
  'craft-piva': { bg: '#0a1a06', accent: '#65a30d', icon: '🍻', label: 'CRAFT PIVA' },
  'brezalk-pivo': { bg: '#0a1a1a', accent: '#14b8a6', icon: '🍺', label: 'BREZALK. PIVO' },
  'viski': { bg: '#1a0e06', accent: '#92400e', icon: '🥃', label: 'VISKI' },
  'gin': { bg: '#0a1520', accent: '#0ea5e9', icon: '🍸', label: 'GIN' },
  'likerji': { bg: '#1a0e20', accent: '#a855f7', icon: '🍹', label: 'LIKERJI' },
  'grencice': { bg: '#0e1a06', accent: '#4d7c0f', icon: '🫒', label: 'GRENČICE' },
  'destilati': { bg: '#1a0a1e', accent: '#6b21a8', icon: '🥃', label: 'DESTILATI' },
  'topli-napitki': { bg: '#1a1006', accent: '#92400e', icon: '☕', label: 'TOPLI NAPITKI' },
  'mesane-pijace': { bg: '#1a0a14', accent: '#ec4899', icon: '🍹', label: 'MEŠANE PIJAČE' },
  'vode': { bg: '#0a1520', accent: '#0ea5e9', icon: '💧', label: 'VODE' },
  'naravni-sokovi': { bg: '#0e1a06', accent: '#84cc16', icon: '🧃', label: 'NARAVNI SOKOVI' },
  'sokovi': { bg: '#061a0e', accent: '#22c55e', icon: '🧃', label: 'SOKOVI' },
  'gazirane-pijace': { bg: '#1a0a0a', accent: '#ef4444', icon: '🥤', label: 'GAZIRANE PIJAČE' },
};

// Item-specific data for each duplicate
const ITEMS = [
  // BELA VINA
  { path: '/menu-images/bela-vina/alter.png', name: 'Alter 2021', subtitle: 'Ekološko', color: '#4a9e4a' },
  { path: '/menu-images/bela-vina/angel-belo-2019.png', name: 'Angel Belo 2019', subtitle: '3.00L', color: '#c9a227' },
  { path: '/menu-images/bela-vina/angel-belo-2021.png', name: 'Angel Belo 2021', subtitle: '0.75L', color: '#d4af37' },
  { path: '/menu-images/bela-vina/bela-frankinja.png', name: 'Bela Frankinja', subtitle: 'Polsladko', color: '#daa520' },
  { path: '/menu-images/bela-vina/burja-bela.png', name: 'Burja Bela', subtitle: 'Demeter', color: '#6b8e23' },
  { path: '/menu-images/bela-vina/chardonnay-dular.png', name: 'Chardonnay Dular', subtitle: 'Ekološko', color: '#b8860b' },
  { path: '/menu-images/bela-vina/chardonnay-verus.png', name: 'Chardonnay Verus', subtitle: 'Štajerska', color: '#f0c040' },
  { path: '/menu-images/bela-vina/chardonnay-vicomte.png', name: 'Chard. Vicomte', subtitle: 'II Cru', color: '#ffd700' },
  { path: '/menu-images/bela-vina/cuvee-emino.png', name: 'Cuvee Emino', subtitle: 'Hiša vin', color: '#e8c84a' },
  { path: '/menu-images/bela-vina/laski-rizling.png', name: 'Laški Rizling', subtitle: 'Dolenjska', color: '#c8b560' },
  { path: '/menu-images/bela-vina/malvazija-movia.png', name: 'Malvazija Movia', subtitle: 'Brda', color: '#dbc682' },
  { path: '/menu-images/bela-vina/rebula-cru.png', name: 'Rebula Cru', subtitle: 'Simčič', color: '#b8960b' },
  { path: '/menu-images/bela-vina/renski-rizling-keltis.png', name: 'Renski Rizling', subtitle: 'Keltis Eko', color: '#a0c060' },
  { path: '/menu-images/bela-vina/renski-rizling-stare.png', name: 'R. Rizling Stare', subtitle: '2015', color: '#8b7d3c' },
  { path: '/menu-images/bela-vina/rumeni-muskat-pozna.png', name: 'R. Muškat Pozna', subtitle: 'Sladko', color: '#d4a030' },
  { path: '/menu-images/bela-vina/rumeni-muskat.png', name: 'Rumeni Muškat', subtitle: 'Polsladko', color: '#e8b830' },
  { path: '/menu-images/bela-vina/sauvignon-blanc-cru.png', name: 'Sauvignon Cru', subtitle: 'Veliki Vrh', color: '#8fbc8f' },
  { path: '/menu-images/bela-vina/sipon-verus.png', name: 'Šipon Verus', subtitle: 'Podravje', color: '#b5d69c' },
  { path: '/menu-images/bela-vina/sivi-pinot-jamertal.png', name: 'Sivi Pinot', subtitle: 'Jamertal', color: '#a89860' },
  { path: '/menu-images/bela-vina/traminec.png', name: 'Traminec', subtitle: 'Keltis', color: '#d8a060' },
  { path: '/menu-images/bela-vina/rebula.png', name: 'Rebula', subtitle: 'Blazic', color: '#c8a840' },

  // BREZALKOHOLNO PIVO
  { path: '/menu-images/brezalk-pivo/daura.png', name: 'Daura', subtitle: 'Brezglutensko', color: '#d4a017' },
  { path: '/menu-images/brezalk-pivo/heineken-00.png', name: 'Heineken 0.0', subtitle: 'Brezalkoholno', color: '#00a651' },

  // CRAFT PIVA
  { path: '/menu-images/craft-piva/bevog-tak.png', name: 'Bevog Tak', subtitle: 'Pale Ale', color: '#d4770a' },
  { path: '/menu-images/craft-piva/pelicon-winter.png', name: 'Pelicon Winter', subtitle: 'Temno', color: '#4a2020' },
  { path: '/menu-images/craft-piva/zeleni-haler.png', name: 'Zeleni Haler', subtitle: 'Konoplja', color: '#2d7a2d' },

  // DESTILATI
  { path: '/menu-images/destilati/ararat-6.png', name: 'Ararat 6yo', subtitle: 'Vinjak', color: '#b8860b' },
  { path: '/menu-images/destilati/ararat-15.png', name: 'Ararat 15yo', subtitle: 'Premium', color: '#8b6914' },
  { path: '/menu-images/destilati/ararat-20.png', name: 'Ararat 20yo', subtitle: 'Ultra Premium', color: '#6b4c14' },
  { path: '/menu-images/destilati/brinjevec.png', name: 'Brinjevec', subtitle: 'Brinovec', color: '#2d5a27' },
  { path: '/menu-images/destilati/delamaine-xo.png', name: 'Delamaine X.O.', subtitle: 'Konjak', color: '#8b4513' },
  { path: '/menu-images/destilati/grappa-sofija.png', name: 'Grappa Sofija', subtitle: 'Rebula', color: '#a0a0c0' },
  { path: '/menu-images/destilati/hennessy-vs.png', name: 'Hennessy V.S.', subtitle: 'Konjak', color: '#c8860b' },
  { path: '/menu-images/destilati/hennessy-xo.png', name: 'Hennessy X.O.', subtitle: 'Premium Konjak', color: '#8b6508' },
  { path: '/menu-images/destilati/rum-bumbu.png', name: 'Rum Bumbu', subtitle: 'Barbados', color: '#d4720a' },
  { path: '/menu-images/destilati/rum-diplomatico.png', name: 'Diplomatico', subtitle: 'Venezuela', color: '#8b3a0a' },
  { path: '/menu-images/destilati/rum-hechicera.png', name: 'Hechicera 21yo', subtitle: 'Kolumbija', color: '#6b2a0a' },
  { path: '/menu-images/destilati/rum-zacapa.png', name: 'Zacapa 23yo', subtitle: 'Guatemala', color: '#4a2a0a' },
  { path: '/menu-images/destilati/slivovka.png', name: 'Slivovka', subtitle: 'Slivovec', color: '#6a2c70' },
  { path: '/menu-images/destilati/travarica-rossi.png', name: 'Travarica', subtitle: 'Istra', color: '#3a6a20' },
  { path: '/menu-images/destilati/viljamovka.png', name: 'Viljamovka', subtitle: 'Hruškovce', color: '#a0c040' },

  // GAZIRANE PIJACE
  { path: '/menu-images/gazirane-pijace/coca-cola-zero.png', name: 'Coca-Cola Zero', subtitle: '0.33L', color: '#1a1a1a' },
  { path: '/menu-images/gazirane-pijace/cockta.png', name: 'Cockta', subtitle: 'Slovenska', color: '#8b4513' },
  { path: '/menu-images/gazirane-pijace/fanta.png', name: 'Fanta', subtitle: 'Pomaranča', color: '#ff8c00' },
  { path: '/menu-images/gazirane-pijace/fever-tree-med.png', name: 'Fever Tree Med', subtitle: 'Tonic', color: '#20b2aa' },
  { path: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', name: 'Fever Tree RRB', subtitle: 'Tonic', color: '#dc143c' },
  { path: '/menu-images/gazirane-pijace/fever-tree-tonic.png', name: 'Fever Tree', subtitle: 'Indian Tonic', color: '#4682b4' },
  { path: '/menu-images/gazirane-pijace/red-bull.png', name: 'Red Bull', subtitle: 'Energy', color: '#1e3a5f' },
  { path: '/menu-images/gazirane-pijace/schweppes-bitter.png', name: 'Schweppes Bitter', subtitle: 'Lemon', color: '#daa520' },
  { path: '/menu-images/gazirane-pijace/schweppes-tonic.png', name: 'Schweppes', subtitle: 'Tonic Water', color: '#2e8b57' },
  { path: '/menu-images/gazirane-pijace/sprite.png', name: 'Sprite', subtitle: 'Lemon-Lime', color: '#32cd32' },

  // GIN
  { path: '/menu-images/gin/gin-hendricks.png', name: "Hendrick's", subtitle: 'Škotska', color: '#2f2f4f' },
  { path: '/menu-images/gin/gin-kristal.png', name: 'Gin Kristal', subtitle: 'London Dry', color: '#4a8ec8' },
  { path: '/menu-images/gin/gin-mare.png', name: 'Gin Mare', subtitle: 'Mediterranean', color: '#5f9ea0' },
  { path: '/menu-images/gin/gin-monkey47.png', name: 'Monkey 47', subtitle: 'Schwarzwald', color: '#3a3a1a' },
  { path: '/menu-images/gin/gin-monolog.png', name: 'Gin Monolog', subtitle: 'Slovenija', color: '#6a8caa' },
  { path: '/menu-images/gin/gin-tanqueray.png', name: 'Tanqueray', subtitle: 'London Dry', color: '#2e6b2e' },

  // GRENCICE
  { path: '/menu-images/grencice/amaro.png', name: 'Amaro', subtitle: 'Zeliščni', color: '#5a3a20' },
  { path: '/menu-images/grencice/aperol.png', name: 'Aperol', subtitle: 'Aperitiv', color: '#ff4500' },
  { path: '/menu-images/grencice/campari.png', name: 'Campari', subtitle: 'Bitter', color: '#cc0000' },
  { path: '/menu-images/grencice/cynar.png', name: 'Cynar', subtitle: 'Artičoka', color: '#6b4226' },
  { path: '/menu-images/grencice/jagermeister.png', name: 'Jägermeister', subtitle: 'Zeliščni', color: '#1a4a1a' },

  // LIKERJI
  { path: '/menu-images/likerji/borovnica-kejzar.png', name: 'Borovnica', subtitle: 'Kejžar', color: '#2a1a6a' },
  { path: '/menu-images/likerji/bumbu-cream.png', name: 'Bumbu Cream', subtitle: 'Rum Liker', color: '#d2b48c' },
  { path: '/menu-images/likerji/canella.png', name: 'Canella', subtitle: 'Prosecco', color: '#daa520' },
  { path: '/menu-images/likerji/carolans.png', name: 'Carolans', subtitle: 'Irish Cream', color: '#8b6914' },
  { path: '/menu-images/likerji/malibu.png', name: 'Malibu', subtitle: 'Rum Kokos', color: '#f5f5dc' },
  { path: '/menu-images/likerji/medica-kejzar.png', name: 'Medica', subtitle: 'Kejžar', color: '#daa520' },

  // LIKERSKO VINO
  { path: '/menu-images/likersko-vino/keros-belo.png', name: 'Keros Belo', subtitle: 'Sladko', color: '#f5deb3' },
  { path: '/menu-images/likersko-vino/keros-rdece.png', name: 'Keros Rdeče', subtitle: 'Sladko', color: '#8b0000' },
  { path: '/menu-images/likersko-vino/sladki-refosk.png', name: 'Sladki Refošk', subtitle: 'Sladko', color: '#722f37' },
  { path: '/menu-images/likersko-vino/veliko-rdece-2012.png', name: 'Veliko Rdeče', subtitle: '3.00L Movia', color: '#4a0a0a' },

  // MESANE PIJACE
  { path: '/menu-images/mesane-pijace/cuba-libre.png', name: 'Cuba Libre', subtitle: 'Rum & Cola', color: '#8b4513' },
  { path: '/menu-images/mesane-pijace/gin-mare-tonic.png', name: 'Gin Mare Tonic', subtitle: 'Mediterranean', color: '#5f9ea0' },
  { path: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', name: "Hendrick's GT", subtitle: 'Kumara', color: '#708090' },
  { path: '/menu-images/mesane-pijace/mango-mojito.png', name: 'Mango Mojito', subtitle: 'Rum & Mango', color: '#ff8c00' },
  { path: '/menu-images/mesane-pijace/martini-spritz.png', name: 'Martini Spritz', subtitle: 'Bianco', color: '#f0e68c' },
  { path: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', name: 'Monkey 47 GT', subtitle: 'Schwarzwald', color: '#556b2f' },
  { path: '/menu-images/mesane-pijace/monolog-gin-tonic.png', name: 'Monolog GT', subtitle: 'Slovenija', color: '#6a8caa' },
  { path: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', name: 'Orange Ginger GT', subtitle: 'Kristal', color: '#ff6347' },
  { path: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', name: 'Raspberry GT', subtitle: 'Pink', color: '#dc143c' },
  { path: '/menu-images/mesane-pijace/strawberry-mojito.png', name: 'Strawberry Mojito', subtitle: 'Rum & Jagoda', color: '#e74c6f' },

  // NARAVNI SOKOVI
  { path: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', name: 'Hišni Led. Čaj', subtitle: 'Domač', color: '#8b4513' },
  { path: '/menu-images/naravni-sokovi/hisni-sok-meta.png', name: 'Hišni Sok Meta', subtitle: 'Domač', color: '#2e8b57' },
  { path: '/menu-images/naravni-sokovi/limonada-okus.png', name: 'Limonada Okus', subtitle: 'Bezeg/Ingver', color: '#ff69b4' },
  { path: '/menu-images/naravni-sokovi/pomarancni-sok.png', name: 'Pomarančni Sok', subtitle: 'Sveže stisnjen', color: '#ff8c00' },

  // PENINE
  { path: '/menu-images/penine/bjana-brut.png', name: 'Bjana Brut', subtitle: 'Brda', color: '#e8d88c' },
  { path: '/menu-images/penine/boemme-rumeni-muskat.png', name: 'Boemme Muškat', subtitle: 'Polsuho', color: '#d4a030' },
  { path: '/menu-images/penine/gourmet-rose.png', name: 'Gourmet Rosé', subtitle: 'Istenič', color: '#e75480' },
  { path: '/menu-images/penine/louis-roederer.png', name: 'Louis Roederer', subtitle: 'Champagne', color: '#c9a227' },
  { path: '/menu-images/penine/maria-brut.png', name: 'Maria Brut', subtitle: 'Kerin', color: '#dbc682' },
  { path: '/menu-images/penine/mufi-pet-nat.png', name: 'Mufi Pet Nat', subtitle: 'Brut Nature', color: '#a0c060' },
  { path: '/menu-images/penine/no1-brut.png', name: 'No.1 Brut', subtitle: 'Istenič', color: '#c8b060' },
  { path: '/menu-images/penine/pol-roger.png', name: 'Pol Roger', subtitle: 'Champagne', color: '#d4af37' },
  { path: '/menu-images/penine/slapsak-brut-reserve.png', name: 'Slapšak Reserve', subtitle: 'Brut', color: '#b8960b' },
  { path: '/menu-images/penine/slapsak-brut-rose.png', name: 'Slapšak Rosé', subtitle: 'Brut', color: '#e07080' },
  { path: '/menu-images/penine/zlata-radgonska.png', name: 'Zl. Radgonska', subtitle: 'Brut Selection', color: '#ffd700' },

  // PIVO
  { path: '/menu-images/pivo/reset-froggy.png', name: 'Reset Froggy', subtitle: 'IPA', color: '#2d8c2d' },
  { path: '/menu-images/pivo/reset-lagerish.png', name: 'Reset Lagerish', subtitle: 'Cream Ale', color: '#d4a017' },
  { path: '/menu-images/pivo/reset-stout.png', name: 'Reset Stout', subtitle: 'Irish Extra', color: '#1a0a0a' },

  // RDECA VINA
  { path: '/menu-images/rdeca-vina/cabernet-keltis.png', name: 'Cabernet Keltis', subtitle: 'Ekološko', color: '#4a0a0a' },
  { path: '/menu-images/rdeca-vina/cabernet-pavo.png', name: 'Cabernet Pavo', subtitle: 'Limited Ed.', color: '#6a1a1a' },
  { path: '/menu-images/rdeca-vina/carolina-rdeca.png', name: 'Carolina Rdeča', subtitle: 'Jakončič', color: '#5a1a1a' },
  { path: '/menu-images/rdeca-vina/duet-edi-simcic.png', name: 'Duet Simčič', subtitle: '2021', color: '#7a2a2a' },
  { path: '/menu-images/rdeca-vina/duet-lex-2018.png', name: 'Duet Lex 2018', subtitle: '1.50L', color: '#3a0a0a' },
  { path: '/menu-images/rdeca-vina/duet-lex-2020.png', name: 'Duet Lex 2020', subtitle: '0.75L', color: '#5a1a1a' },
  { path: '/menu-images/rdeca-vina/guerila-retro.png', name: 'Guerila Retro', subtitle: 'Vipavska', color: '#8b0000' },
  { path: '/menu-images/rdeca-vina/merlot-keltis.png', name: 'Merlot Keltis', subtitle: 'Ekološko', color: '#6a1a2a' },
  { path: '/menu-images/rdeca-vina/merlot-opoka.png', name: 'Merlot Opoka', subtitle: 'Simčič', color: '#3a0a0a' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-dular.png', name: 'M. Frankinja Dular', subtitle: 'Ekološko', color: '#5a1a3a' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-luna.png', name: 'M. Frankinja Luna', subtitle: 'Kobal', color: '#7a1a4a' },
  { path: '/menu-images/rdeca-vina/modri-pinot-opoka.png', name: 'M. Pinot Opoka', subtitle: 'Simčič', color: '#4a0a2a' },
  { path: '/menu-images/rdeca-vina/modri-pinot-verus.png', name: 'M. Pinot Verus', subtitle: 'Ormož', color: '#6a1a2a' },
  { path: '/menu-images/rdeca-vina/veliko-rdece-movia.png', name: 'Veliko Rdeče', subtitle: 'Movia', color: '#3a0a1a' },

  // ROSE VINO
  { path: '/menu-images/rose-vino/rose-batic.png', name: 'Rosé Batič', subtitle: 'Vipavska', color: '#e75480' },
  { path: '/menu-images/rose-vino/rose-verstovsek.png', name: 'Rosé Verstovšek', subtitle: 'Bizeljsko', color: '#f08080' },

  // SOKOVI
  { path: '/menu-images/sokovi/ananasov-sok.png', name: 'Ananasov Sok', subtitle: 'Tropski', color: '#daa520' },
  { path: '/menu-images/sokovi/bubble-tea.png', name: 'Bubble Tea', subtitle: 'Boba', color: '#9370db' },
  { path: '/menu-images/sokovi/cedevita.png', name: 'Cedevita', subtitle: 'Vitamin', color: '#ff6347' },
  { path: '/menu-images/sokovi/jabolcni-sok.png', name: 'Jabolčni Sok', subtitle: '100%', color: '#8fbc8f' },
  { path: '/menu-images/sokovi/jagodni-sok.png', name: 'Jagodni Sok', subtitle: 'Jagode', color: '#dc143c' },
  { path: '/menu-images/sokovi/ledeni-caj.png', name: 'Led. Čaj', subtitle: 'Hladen', color: '#b8860b' },
  { path: '/menu-images/sokovi/marelicni-sok.png', name: 'Marelični Sok', subtitle: 'Marelice', color: '#f4a460' },
  { path: '/menu-images/sokovi/pomarancni-sok.png', name: 'Pomarančni Sok', subtitle: '0.20L', color: '#ff8c00' },
  { path: '/menu-images/sokovi/ribezov-sok.png', name: 'Ribezov Sok', subtitle: 'Rdeči ribez', color: '#8b0000' },

  // TOCENO PIVO
  { path: '/menu-images/toceno-pivo/haler-nefiltriran.png', name: 'Haler Nefiltr.', subtitle: 'Lager', color: '#d4a017' },
  { path: '/menu-images/toceno-pivo/pelicon-ipa.png', name: 'Pelicon IPA', subtitle: '3rd Pill', color: '#b8860b' },
  { path: '/menu-images/toceno-pivo/radler.png', name: 'Radler', subtitle: 'Grenivka', color: '#e8a020' },
  { path: '/menu-images/toceno-pivo/union-lager.png', name: 'Union Lager', subtitle: '0.30/0.50L', color: '#c8a030' },

  // TOPLI NAPITKI
  { path: '/menu-images/topli-napitki/babyccino.png', name: 'Babyccino', subtitle: 'Otroška', color: '#f5deb3' },
  { path: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', name: 'Bela K. Brez Kof.', subtitle: 'Dekof', color: '#d2b48c' },
  { path: '/menu-images/topli-napitki/bela-kava.png', name: 'Bela Kava', subtitle: 'Z mlekom', color: '#deb887' },
  { path: '/menu-images/topli-napitki/caj-limona-med.png', name: 'Čaj Limona Med', subtitle: 'Topel', color: '#daa520' },
  { path: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', name: 'Capp. Brez Kof.', subtitle: 'Dekof', color: '#c8a880' },
  { path: '/menu-images/topli-napitki/kakav-smetana.png', name: 'Kakav Smetana', subtitle: 'S smetano', color: '#6b3a20' },
  { path: '/menu-images/topli-napitki/kakav.png', name: 'Kakav', subtitle: 'Čokoladni', color: '#8b4513' },
  { path: '/menu-images/topli-napitki/kava-brez-kofeina.png', name: 'Espresso Brez Kof.', subtitle: 'Dekof', color: '#3a2010' },
  { path: '/menu-images/topli-napitki/kava-macchiato.png', name: 'Macchiato', subtitle: 'S kapljico', color: '#4a2a10' },
  { path: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', name: 'K. Mleko Brez Kof.', subtitle: 'Dekof', color: '#b89870' },
  { path: '/menu-images/topli-napitki/kava-rizevo-mleko.png', name: 'K. Riževo Mleko', subtitle: 'Brez laktoze', color: '#d2c8a0' },
  { path: '/menu-images/topli-napitki/kava-s-smetano.png', name: 'Kava s Smetano', subtitle: 'S smetano', color: '#6b3a20' },
  { path: '/menu-images/topli-napitki/kava-z-mlekom.png', name: 'Kava z Mlekom', subtitle: 'Klasična', color: '#8b6914' },
  { path: '/menu-images/topli-napitki/ledena-kava-olimia.png', name: 'Ledena Kava', subtitle: 'Olimia', color: '#4a3020' },
  { path: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', name: 'Macch. Brez Kof.', subtitle: 'Dekof', color: '#5a3a20' },
  { path: '/menu-images/topli-napitki/vroca-cokolada.png', name: 'Vroča Čokolada', subtitle: 'Gosta', color: '#3a1a0a' },

  // TUJA VINA
  { path: '/menu-images/tuja-vina/andreis-vinasmora.png', name: 'Andreis', subtitle: 'Hrvaška Rdeče', color: '#5a1a1a' },
  { path: '/menu-images/tuja-vina/jermann-dreams.png', name: 'Jermann Dreams', subtitle: 'Italija Belo', color: '#d4af37' },
  { path: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', name: 'Plavac Mali', subtitle: 'Hrvaška Rdeče', color: '#7a1a1a' },
  { path: '/menu-images/tuja-vina/posip-terra-madre.png', name: 'Pošip', subtitle: 'Hrvaška Belo', color: '#c8b060' },
  { path: '/menu-images/tuja-vina/vintage-tunina.png', name: 'Vintage Tunina', subtitle: 'Italija Belo', color: '#b8960b' },
  { path: '/menu-images/tuja-vina/vranec-instinct.png', name: 'Vranec Instinct', subtitle: 'Makedonija', color: '#3a0a1a' },

  // VISKI
  { path: '/menu-images/viski/chivas-12.png', name: 'Chivas 12yo', subtitle: 'Blended', color: '#b8860b' },
  { path: '/menu-images/viski/glenmorangie-18.png', name: 'Glenmorangie 18', subtitle: 'Highland', color: '#8b6914' },
  { path: '/menu-images/viski/glenmorangie-lasanta.png', name: 'Glenm. Lasanta', subtitle: 'Sherry Cask', color: '#a0522d' },
  { path: '/menu-images/viski/jameson.png', name: 'Jameson', subtitle: 'Irska', color: '#2e4a1a' },
  { path: '/menu-images/viski/johnnie-walker-black.png', name: 'J. Walker Black', subtitle: 'Blended', color: '#1a1a1a' },
  { path: '/menu-images/viski/lagavulin-16.png', name: 'Lagavulin 16', subtitle: 'Islay', color: '#2a1a0a' },
  { path: '/menu-images/viski/laphroaig-10.png', name: 'Laphroaig 10', subtitle: 'Islay', color: '#1a3a1a' },
  { path: '/menu-images/viski/nikka-barrel.png', name: 'Nikka Barrel', subtitle: 'Japonska', color: '#4a2a0a' },
  { path: '/menu-images/viski/nikka-miyagikyo.png', name: 'Nikka Miyagikyo', subtitle: 'Single Malt', color: '#6a3a1a' },

  // VODE
  { path: '/menu-images/vode/mineralna-voda.png', name: 'Mineralna Voda', subtitle: 'Gazirana', color: '#4682b4' },
  { path: '/menu-images/vode/naravna-voda.png', name: 'Naravna Voda', subtitle: 'Mirna', color: '#5f9ea0' },
  { path: '/menu-images/vode/radenska-functionall.png', name: 'Radenska ALL', subtitle: 'Funkcionalna', color: '#20b2aa' },
  { path: '/menu-images/vode/voda-z-okusom.png', name: 'Voda z Okusom', subtitle: 'Okusna', color: '#87ceeb' },
];

function getCategoryFromPath(p) {
  const parts = p.split('/');
  if (parts.length >= 3) return parts[2];
  return 'default';
}

function generateSVG(item) {
  const cat = getCategoryFromPath(item.path);
  const style = CATEGORY_STYLES[cat] || { bg: '#1a1a2e', accent: '#888', icon: '🍽️', label: 'MENI' };
  const name = item.name || 'Artikel';
  const subtitle = item.subtitle || '';
  const itemColor = item.color || style.accent;

  // Create unique pattern based on item name hash
  const hash = createHash('md5').update(name).digest('hex');
  const patternSeed = parseInt(hash.slice(0, 8), 16);

  // Unique decorative elements based on hash
  const circleX1 = 100 + (patternSeed % 200);
  const circleY1 = 80 + ((patternSeed >> 8) % 200);
  const circleR1 = 30 + (patternSeed % 60);
  const circleX2 = 300 + ((patternSeed >> 4) % 200);
  const circleY2 = 200 + ((patternSeed >> 12) % 200);
  const circleR2 = 20 + (patternSeed % 40);
  const lineAngle = (patternSeed % 360);
  const dotCount = 5 + (patternSeed % 10);

  // Generate unique decorative dots
  let dots = '';
  for (let i = 0; i < dotCount; i++) {
    const dx = 50 + ((patternSeed * (i + 1) * 7) % 350);
    const dy = 50 + ((patternSeed * (i + 1) * 13) % 400);
    const dr = 2 + ((patternSeed * (i + 1)) % 6);
    dots += `<circle cx="${dx}" cy="${dy}" r="${dr}" fill="${itemColor}" opacity="0.15"/>`;
  }

  // Unique diagonal lines
  let lines = '';
  for (let i = 0; i < 3; i++) {
    const lx = ((patternSeed * (i + 2) * 17) % 400);
    const ly = ((patternSeed * (i + 2) * 23) % 500);
    lines += `<line x1="${lx}" y1="0" x2="${lx + 100}" y2="500" stroke="${itemColor}" stroke-width="0.5" opacity="0.1"/>`;
  }

  // Bottle/glass silhouette path based on category
  let silhouette = '';
  const catType = cat;
  if (['bela-vina', 'rdeca-vina', 'rose-vino', 'tuja-vina', 'likersko-vino', 'penine'].includes(catType)) {
    // Wine bottle silhouette
    silhouette = `
      <g transform="translate(150, 80) scale(0.8)">
        <path d="M50,0 L70,0 L70,30 Q70,50 85,60 L85,60 Q100,70 100,90 L100,280 Q100,300 80,300 L40,300 Q20,300 20,280 L20,90 Q20,70 35,60 L35,60 Q50,50 50,30 Z" 
              fill="${itemColor}" opacity="0.3" stroke="${itemColor}" stroke-width="1"/>
        <rect x="55" y="5" width="10" height="35" rx="3" fill="${itemColor}" opacity="0.5"/>
        <rect x="30" y="140" width="60" height="80" rx="4" fill="${style.bg}" stroke="${itemColor}" stroke-width="1.5" opacity="0.9"/>
        <text x="60" y="175" text-anchor="middle" fill="${itemColor}" font-size="9" font-weight="bold" font-family="serif">${name.slice(0, 10)}</text>
        <text x="60" y="195" text-anchor="middle" fill="${itemColor}" font-size="7" font-family="serif" opacity="0.8">${subtitle}</text>
      </g>`;
  } else if (['toceno-pivo', 'pivo', 'craft-piva', 'brezalk-pivo'].includes(catType)) {
    // Beer glass silhouette
    silhouette = `
      <g transform="translate(140, 70) scale(0.8)">
        <path d="M30,40 L30,260 Q30,280 50,280 L130,280 Q150,280 150,260 L150,40 Z" 
              fill="${itemColor}" opacity="0.25" stroke="${itemColor}" stroke-width="1.5"/>
        <ellipse cx="90" cy="40" rx="60" ry="15" fill="${itemColor}" opacity="0.15"/>
        <!-- Foam -->
        <ellipse cx="90" cy="55" rx="55" ry="18" fill="#fff" opacity="0.4"/>
        <ellipse cx="70" cy="50" rx="20" ry="12" fill="#fff" opacity="0.5"/>
        <ellipse cx="110" cy="48" rx="18" ry="14" fill="#fff" opacity="0.5"/>
        <!-- Handle -->
        <path d="M150,100 Q190,100 190,150 L190,200 Q190,250 150,250" fill="none" stroke="${itemColor}" stroke-width="4" opacity="0.3"/>
        <text x="90" y="170" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold" font-family="sans-serif" opacity="0.9">${name.slice(0, 12)}</text>
        <text x="90" y="195" text-anchor="middle" fill="#fff" font-size="9" font-family="sans-serif" opacity="0.7">${subtitle}</text>
      </g>`;
  } else if (['viski', 'gin', 'destilati', 'likerji', 'grencice'].includes(catType)) {
    // Spirits bottle/glass
    silhouette = `
      <g transform="translate(145, 60) scale(0.8)">
        <path d="M55,0 L75,0 L75,40 Q75,50 90,55 L90,55 Q105,60 105,80 L105,290 Q105,310 80,310 L50,310 Q25,310 25,290 L25,80 Q25,60 40,55 L40,55 Q55,50 55,40 Z"
              fill="${itemColor}" opacity="0.25" stroke="${itemColor}" stroke-width="1.5"/>
        <rect x="60" y="2" width="10" height="40" rx="3" fill="${itemColor}" opacity="0.4"/>
        <rect x="35" y="130" width="60" height="100" rx="3" fill="${style.bg}" stroke="${itemColor}" stroke-width="1.5" opacity="0.9"/>
        <text x="65" y="170" text-anchor="middle" fill="${itemColor}" font-size="10" font-weight="bold" font-family="serif">${name.slice(0, 10)}</text>
        <text x="65" y="195" text-anchor="middle" fill="${itemColor}" font-size="8" font-family="serif" opacity="0.8">${subtitle}</text>
        <!-- Liquid level indicator -->
        <rect x="30" y="230" width="70" height="60" rx="2" fill="${itemColor}" opacity="0.15"/>
      </g>`;
  } else if (catType === 'topli-napitki') {
    // Coffee cup silhouette
    silhouette = `
      <g transform="translate(120, 80) scale(0.9)">
        <!-- Saucer -->
        <ellipse cx="100" cy="280" rx="90" ry="15" fill="${itemColor}" opacity="0.15"/>
        <!-- Cup body -->
        <path d="M30,100 L30,240 Q30,270 60,270 L140,270 Q170,270 170,240 L170,100 Z"
              fill="${itemColor}" opacity="0.25" stroke="${itemColor}" stroke-width="1.5"/>
        <!-- Handle -->
        <path d="M170,130 Q220,130 220,180 L220,200 Q220,250 170,250" fill="none" stroke="${itemColor}" stroke-width="5" opacity="0.3"/>
        <!-- Steam -->
        <path d="M80,90 Q75,60 85,30" fill="none" stroke="#fff" stroke-width="2" opacity="0.3"/>
        <path d="M100,85 Q95,50 105,20" fill="none" stroke="#fff" stroke-width="2" opacity="0.25"/>
        <path d="M120,90 Q115,55 125,25" fill="none" stroke="#fff" stroke-width="2" opacity="0.2"/>
        <text x="100" y="180" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="sans-serif" opacity="0.9">${name.slice(0, 12)}</text>
        <text x="100" y="210" text-anchor="middle" fill="#fff" font-size="9" font-family="sans-serif" opacity="0.7">${subtitle}</text>
      </g>`;
  } else if (catType === 'mesane-pijace') {
    // Cocktail glass silhouette
    silhouette = `
      <g transform="translate(120, 50) scale(0.9)">
        <!-- Glass bowl -->
        <path d="M10,10 L100,180 L190,10 Z" fill="${itemColor}" opacity="0.2" stroke="${itemColor}" stroke-width="1.5"/>
        <!-- Stem -->
        <rect x="92" y="180" width="16" height="80" fill="${itemColor}" opacity="0.2"/>
        <!-- Base -->
        <ellipse cx="100" cy="265" rx="50" ry="10" fill="${itemColor}" opacity="0.15"/>
        <!-- Garnish -->
        <circle cx="70" cy="50" r="8" fill="#ff6347" opacity="0.5"/>
        <line x1="78" y1="50" x2="60" y2="20" stroke="#228b22" stroke-width="2" opacity="0.5"/>
        <text x="100" y="120" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold" font-family="sans-serif" opacity="0.9">${name.slice(0, 12)}</text>
        <text x="100" y="145" text-anchor="middle" fill="#fff" font-size="9" font-family="sans-serif" opacity="0.7">${subtitle}</text>
      </g>`;
  } else if (['vode', 'sokovi', 'naravni-sokovi', 'gazirane-pijace'].includes(catType)) {
    // Glass/bottle silhouette
    silhouette = `
      <g transform="translate(140, 60) scale(0.8)">
        <path d="M60,0 L80,0 L80,30 L95,50 L95,280 Q95,300 75,300 L55,300 Q35,300 35,280 L35,50 L50,30 L50,0 Z"
              fill="${itemColor}" opacity="0.25" stroke="${itemColor}" stroke-width="1.5"/>
        <rect x="65" y="2" width="10" height="30" rx="2" fill="${itemColor}" opacity="0.4"/>
        <!-- Cap -->
        <rect x="58" y="-8" width="24" height="12" rx="3" fill="${itemColor}" opacity="0.4"/>
        <text x="65" y="170" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="sans-serif" opacity="0.9">${name.slice(0, 12)}</text>
        <text x="65" y="195" text-anchor="middle" fill="#fff" font-size="8" font-family="sans-serif" opacity="0.7">${subtitle}</text>
      </g>`;
  } else {
    // Generic bottle
    silhouette = `
      <g transform="translate(150, 60) scale(0.8)">
        <path d="M50,0 L70,0 L70,40 Q70,55 85,60 L85,60 Q100,70 100,90 L100,280 Q100,300 80,300 L40,300 Q20,300 20,280 L20,90 Q20,70 35,60 Q50,55 50,40 Z"
              fill="${itemColor}" opacity="0.25" stroke="${itemColor}" stroke-width="1.5"/>
        <text x="60" y="180" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="sans-serif" opacity="0.9">${name.slice(0, 12)}</text>
        <text x="60" y="205" text-anchor="middle" fill="#fff" font-size="8" font-family="sans-serif" opacity="0.7">${subtitle}</text>
      </g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs>
    <linearGradient id="bg-${hash.slice(0,8)}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${style.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${itemColor};stop-opacity:0.3"/>
    </linearGradient>
    <radialGradient id="glow-${hash.slice(0,8)}" cx="50%" cy="40%" r="60%">
      <stop offset="0%" style="stop-color:${itemColor};stop-opacity:0.15"/>
      <stop offset="100%" style="stop-color:${itemColor};stop-opacity:0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="400" height="500" fill="url(#bg-${hash.slice(0,8)})"/>
  <rect width="400" height="500" fill="url(#glow-${hash.slice(0,8)})"/>

  <!-- Unique decorative elements -->
  <circle cx="${circleX1}" cy="${circleY1}" r="${circleR1}" fill="${itemColor}" opacity="0.08"/>
  <circle cx="${circleX2}" cy="${circleY2}" r="${circleR2}" fill="${itemColor}" opacity="0.06"/>
  ${dots}
  ${lines}

  <!-- Top category badge -->
  <rect x="10" y="10" width="90" height="28" rx="14" fill="${itemColor}" opacity="0.2"/>
  <text x="55" y="29" text-anchor="middle" fill="${itemColor}" font-size="10" font-weight="bold" font-family="sans-serif" opacity="0.9">${style.label}</text>

  <!-- Main silhouette -->
  ${silhouette}

  <!-- Bottom name bar -->
  <rect x="0" y="420" width="400" height="80" fill="${style.bg}" opacity="0.9"/>
  <rect x="0" y="420" width="400" height="2" fill="${itemColor}" opacity="0.5"/>
  <text x="200" y="455" text-anchor="middle" fill="${itemColor}" font-size="18" font-weight="bold" font-family="sans-serif">${name}</text>
  <text x="200" y="480" text-anchor="middle" fill="#888" font-size="12" font-family="sans-serif">${subtitle}</text>

  <!-- Corner accent -->
  <path d="M0,0 L40,0 L0,40 Z" fill="${itemColor}" opacity="0.15"/>
  <path d="M400,500 L360,500 L400,460 Z" fill="${itemColor}" opacity="0.15"/>
</svg>`;

  return svg;
}

async function main() {
  console.log(`\n🎨 Generating ${ITEMS.length} unique menu images using SVG + Sharp...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const fullPath = join(process.cwd(), 'public', item.path);
    const dir = dirname(fullPath);

    try {
      // Ensure directory exists
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Generate SVG
      const svg = generateSVG(item);

      // Convert SVG to PNG using Sharp
      await sharp(Buffer.from(svg))
        .resize(400, 500)
        .png()
        .toFile(fullPath);

      successCount++;
      if ((i + 1) % 10 === 0 || i === ITEMS.length - 1) {
        console.log(`  ✓ ${i + 1}/${ITEMS.length} processed (${successCount} success, ${failCount} fail)`);
      }
    } catch (err) {
      console.log(`  ✗ Error: ${item.path} - ${err.message.slice(0, 80)}`);
      failCount++;
    }
  }

  console.log(`\n✅ Complete! Success: ${successCount}, Failed: ${failCount}, Total: ${ITEMS.length}`);
}

main().catch(console.error);
