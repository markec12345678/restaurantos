// =====================================================================
// JEDI Z ŽARA
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedZar(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invCevapci, invKrompir, invLepinja,
    invPleskavica, invKajmak,
    invMozzarella,
    invSvinjskiKare, invSvinjskiVrat, invPaprika, invCebula,
    invPecenaZelenjava, invRozbif, invKlobasa,
    invPiscancjiFile, invBBQOmaka
  } = inv
  const { catZar } = cat

  await createFood('Čevapčiči', 10.00, catZar.id, 'Domovi čevapčiči s pomfrijem in lepinjo', '1', 9.5, [
  { inv: invCevapci, qty: 0.25, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/cevapcici.png')
  await createFood('Pleskavica', 10.00, catZar.id, 'Domova pleskavica s pomfrijem in lepinjo', '1', 9.5, [
  { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/pleskavica.png')
  await createFood('Pleskavica s kajmakom', 11.00, catZar.id, 'Pleskavica s kajmakom, pomfrij in lepinja', '1,2', 9.5, [
  { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invKajmak, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/pleskavica-kajmak.png')
  await createFood('Polnjena pleskavica', 12.00, catZar.id, 'Pleskavica polnjena sirom s pomfrijem', '1,2', 9.5, [
  { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/polnjena-pleskavica.png')
  await createFood('Vešalica - svinjski kare', 10.00, catZar.id, 'Svinjski kare z žara s pomfrijem', '1', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/svinjski-vrat-zar.png')
  await createFood('Ražnjiči', 10.00, catZar.id, 'Svinjski ražnjiči s papriko in čebulo', '1', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.20, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/raznjici.png')
  await createFood('Mešano meso', 15.00, catZar.id, 'Mešano meso z žara s prilogo', '1', 9.5, [
  { inv: invCevapci, qty: 0.10, unit: 'kg' }, { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invSvinjskiKare, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/mesano-meso.png')
  await createFood('Rozbif na žaru', 20.00, catZar.id, 'Goveji rozbif z žara s prilogo', '1', 9.5, [
  { inv: invRozbif, qty: 0.25, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/rozbif-zar.png')
  await createFood('Pikantna klobasa na žaru', 10.00, catZar.id, 'Pikantna klobasa z žara s pomfrijem', '1', 9.5, [
  { inv: invKlobasa, qty: 0.20, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/pikantna-klobasa-zar.png')
  await createFood('Piščančji zrezek na žaru', 10.00, catZar.id, 'Piščančji file z žara s prilogo', '1', 9.5, [
  { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/piscanji-zrezek-zar.png')
  await createFood('BBQ rebrca', 14.50, catZar.id, 'Svinjska rebra z BBQ omako in krompirčki', '1,2', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.30, unit: 'kg' }, { inv: invBBQOmaka, qty: 0.05, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/bbq-rebrca.png')
}
