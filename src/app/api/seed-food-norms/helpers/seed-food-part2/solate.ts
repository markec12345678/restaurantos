// =====================================================================
// SOLATE
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedSolate(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invSolata, invParadiznik, invOlivnoOlje,
    invPaprika, invCebula, invFeta,
    invRukola, invMozzarella, invOlive,
    invTunaKonzerva, invPiscancjiFile, invKoruznaMoka,
    invLosos, invRozbif, invJajca, invParmezan, invKruh
  } = inv
  const { catSolate } = cat

  await createFood('Mešana solata', 3.50, catSolate.id, 'Zelena solata, zelje, korenje, paradižnik', '1', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.005, unit: 'L' }
],
  '/menu-images/hrana/mesana-solata.png')
  await createFood('Šopska solata', 4.00, catSolate.id, 'Paradižnik, paprika, kumarice, čebula, feta sir', '1,2', 9.5, [
  { inv: invParadiznik, qty: 0.08, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.03, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/sopska-solata.png')
  await createFood('Grška solata', 4.50, catSolate.id, 'Paprika, paradižnik, kumarice, olive, čebula, feta sir', '1,2', 9.5, [
  { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invOlive, qty: 0.03, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/grska-solata.png')
  await createFood('Italijanska solata', 8.00, catSolate.id, 'Rukola, paradižnik, mozzarella, olive, bazilika, olivno olje', '1,2', 9.5, [
  { inv: invRukola, qty: 0.04, unit: 'kg' }, { inv: invParadiznik, qty: 0.06, unit: 'kg' }, { inv: invMozzarella, qty: 0.06, unit: 'kg' }, { inv: invOlive, qty: 0.02, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/italijanska-solata.png')
  await createFood('Solata s tuno', 10.00, catSolate.id, 'Mešana solata s tuno, sončnična semena, gorčični preliv', '1,2,4', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invTunaKonzerva, qty: 1, unit: 'kos' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/solata-s-tuno-2.png')
  await createFood('Piščančja solata', 10.00, catSolate.id, 'Mešana solata z orehi, piščancem, gorčični preliv', '1,2', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/piscancja-solata.png')
  await createFood('Solata z ocvrtim piščancem', 11.00, catSolate.id, 'Solata s hrustljavim ocvrtim piščancem in jogurtovim prelivom', '1,2,3', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.12, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/solata-ocvrti-piscanec.png')
  await createFood('Solata z dimljenim lososom', 12.00, catSolate.id, 'Rukola, paradižnik, feta, dimljen losos, jogurtov preliv', '1,2,4', 9.5, [
  { inv: invRukola, qty: 0.04, unit: 'kg' }, { inv: invLosos, qty: 0.08, unit: 'kg' }, { inv: invFeta, qty: 0.04, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/solata-losos.png')
  await createFood('Roastbeef solata', 13.50, catSolate.id, 'Listnata solata, paradižnik, roastbeef, jajce, grana padano', '1,2,3', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invRozbif, qty: 0.10, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/roastbeef-solata.png')
  await createFood('Cezar solata', 12.00, catSolate.id, 'Rukola, piščanec, parmezan, krutoni, cezar preliv', '1,2,3', 9.5, [
  { inv: invRukola, qty: 0.05, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invKruh, qty: 0.15, unit: 'kos' }
],
  '/menu-images/hrana/cezar-solata-2.png')
}
