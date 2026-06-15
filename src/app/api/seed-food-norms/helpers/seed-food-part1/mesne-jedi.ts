// =====================================================================
// MESNE JEDI - ZREZKI
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedMesneJedi(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invSvinjskiKare, invMoka, invJajca, invDrobtine, invKrompir,
    invSunka, invMozzarella,
    invPiscancjiFile, invGobe, invSladkaSmetana,
    invRozbif, invJurcki,
    invSvinjskiVrat, invPecenaZelenjava,
    invNjoki, invGovejiFile, invPolenta, invOvcjaSkuta,
    invGovejaPecjenka
  } = inv
  const { catMesneJedi } = cat

  await createFood('Dunajski zrezek', 11.00, catMesneJedi.id, 'Klasik - paniran svinjski zrezek s pomfrijem in limono', '1,2,3', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/dunajski-zrezek.png')
  await createFood('Ljubljanski zrezek', 13.00, catMesneJedi.id, 'Paniran svinjski zrezek s šunko in sirom, pekovski krompirček', '1,2,3', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/ljubljanski-zrezek.png')
  await createFood('Piščančji zrezek s sirom', 11.00, catMesneJedi.id, 'Paniran piščančji file s sirom in pomfrijem', '1,2,3', 9.5, [
  { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/piscanji-zrezek-sir.png')
  await createFood('Piščančji zrezek z gobami', 12.00, catMesneJedi.id, 'Piščančji file z gobovo omako in pire krompirjem', '1,2', 9.5, [
  { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invGobe, qty: 0.08, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/piscanji-zrezek-gobe.png')
  await createFood('Rozbif z jurčki', 20.00, catMesneJedi.id, 'Goveji rozbif z jurčki in ocvrtim krompirjem', '1,2', 9.5, [
  { inv: invRozbif, qty: 0.25, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/rozbif-jurcki.png')
  await createFood('Hišni zrezek', 17.00, catMesneJedi.id, 'Specialni hišni zrezek z žara s prilogo', '1,2', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.25, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/ribeye-zrezek.png')
  await createFood('Svinjski medaljoni v jurčkovi omaki', 12.20, catMesneJedi.id, 'Svinjski medaljoni v kremni jurčkovi omaki z njoki', '1,2', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invNjoki, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/svinjski-kare-2.png')
  await createFood('File mignon na polenti', 26.00, catMesneJedi.id, 'Goveji file mignon na dimljeni polenti s kozjim sirom', '1,2', 9.5, [
  { inv: invGovejiFile, qty: 0.25, unit: 'kg' }, { inv: invPolenta, qty: 0.10, unit: 'kg' }, { inv: invOvcjaSkuta, qty: 0.04, unit: 'kg' }
],
  '/menu-images/hrana/file-mignon-polenta.png')
  await createFood('Rib-eye steak 300g', 26.00, catMesneJedi.id, 'Rib-eye z žara z ocvrtim krompirjem in pečeno zelenjavo', '1', 9.5, [
  { inv: invGovejaPecjenka, qty: 0.30, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/ribeye-300g.png')
  await createFood('T-bone 1000g', 36.00, catMesneJedi.id, 'T-bone za dva z ocvrtim krompirjem in pečeno zelenjavo', '1', 9.5, [
  { inv: invGovejaPecjenka, qty: 0.50, unit: 'kg' }, { inv: invSvinjskiKare, qty: 0.50, unit: 'kg' }, { inv: invKrompir, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/tbone-1000g.png')
}
