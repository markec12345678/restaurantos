// =====================================================================
// PICE
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedPice(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invPicaTesto, invPelati, invMozzarella, invCesen,
    invSunka, invGobe, invArtičoke, invOlive,
    invSalama, invFeferoni,
    invPrsut, invGorgonzola, invBrie, invParmezan,
    invMorskiSadezi, invTrzaskaOmaka,
    invTunaKonzerva, invCebula,
    invBucke, invPaprika,
    invTartufata, invTartufnoOlje, invRukola,
    invSlanina, invPiscancjiFile, invBBQOmaka,
    invFeta, invGovejaPecjenka, invPanceta
  } = inv
  const { catPice } = cat

  const picaBase = () => [
  { inv: invPicaTesto, qty: 0.33, unit: 'kg' }, { inv: invPelati, qty: 0.10, unit: 'kg' }, { inv: invMozzarella, qty: 0.08, unit: 'kg' }
]
  await createFood('Margerita', 9.50, catPice.id, 'Pelati, mozzarella', '1,2', 9.5, picaBase())
  await createFood('Česnova', 10.00, catPice.id, 'Pelati, mozzarella, česen', '1,2', 9.5, [...picaBase(), { inv: invCesen, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/cesnova-pica.png')
  await createFood('Siciliana', 10.50, catPice.id, 'Pelati, mozzarella, šunka, gobe', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.05, unit: 'kg' }, { inv: invGobe, qty: 0.04, unit: 'kg' }],
  '/menu-images/hrana/siciliana-pica.png')
  await createFood('Capricioza', 11.00, catPice.id, 'Pelati, mozzarella, šunka, gobe, artičoke, olive', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }, { inv: invArtičoke, qty: 0.03, unit: 'kg' }, { inv: invOlive, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/capricioza-pica.png')
  await createFood('Mafiozo', 11.00, catPice.id, 'Pelati, mozzarella, pikantna salama, feferoni', '1,2', 9.5, [...picaBase(), { inv: invSalama, qty: 0.05, unit: 'kg' }, { inv: invFeferoni, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/mafiozo-pica.png')
  await createFood('Kraška', 13.00, catPice.id, 'Pelati, mozzarella, olive, pršut', '1,2', 9.5, [...picaBase(), { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invOlive, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/kraska-pica.png')
  await createFood('4 siri', 11.00, catPice.id, 'Pelati, mozzarella, gorgonzola, brie, parmezan', '1,2', 9.5, [...picaBase(), { inv: invGorgonzola, qty: 0.04, unit: 'kg' }, { inv: invBrie, qty: 0.04, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/4-siri-pica.png')
  await createFood('Morska', 13.40, catPice.id, 'Pelati, mozzarella, morske dobrote, tržaška omaka', '1,2,4', 9.5, [...picaBase(), { inv: invMorskiSadezi, qty: 0.08, unit: 'kg' }, { inv: invTrzaskaOmaka, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/morska-pica.png')
  await createFood('Tuna', 11.50, catPice.id, 'Pelati, mozzarella, tuna, čebula', '1,2,4', 9.5, [...picaBase(), { inv: invTunaKonzerva, qty: 1, unit: 'kos' }, { inv: invCebula, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/tuna-zrezek.png')
  await createFood('Zelenjavna', 12.20, catPice.id, 'Pelati, mozzarella, bučke, paprika, gobe', '1,2', 9.5, [...picaBase(), { inv: invBucke, qty: 0.04, unit: 'kg' }, { inv: invPaprika, qty: 0.03, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/zelenjavna-pica.png')
  await createFood('Tartuf', 15.90, catPice.id, 'Tartufno olje, tartufata, mozzarella, rukola, bufala', '1,2', 9.5, [...picaBase(), { inv: invTartufata, qty: 0.02, unit: 'kg' }, { inv: invTartufnoOlje, qty: 0.005, unit: 'L' }, { inv: invRukola, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/rizot-gobe-tartufi.png')
  await createFood('BBQ pizza', 11.90, catPice.id, 'Pelati, sir, slanina, piščančji trakci, rdeča čebula, BBQ omaka', '1,2', 9.5, [...picaBase(), { inv: invSlanina, qty: 0.04, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.03, unit: 'kg' }, { inv: invBBQOmaka, qty: 0.03, unit: 'L' }],
  '/menu-images/hrana/bbq-pica.png')
  await createFood('Rustika', 12.90, catPice.id, 'Pelati, mozzarella, feta, pršut, rukola, bazilično olje', '1,2', 9.5, [...picaBase(), { inv: invFeta, qty: 0.04, unit: 'kg' }, { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invRukola, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/rustika-pica.png')
  await createFood('Carpaccio', 15.00, catPice.id, 'Pelati, mozzarella, goveji carpaccio, rukola, parmezan', '1,2', 9.5, [...picaBase(), { inv: invGovejaPecjenka, qty: 0.05, unit: 'kg' }, { inv: invRukola, qty: 0.02, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/carpaccio-pica.png')
  await createFood('Domača', 12.50, catPice.id, 'Pelati, sir, domača šunka, suha salama, panceta, hren, gobe', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invSalama, qty: 0.03, unit: 'kg' }, { inv: invPanceta, qty: 0.03, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/domaca-pica.png')
}
