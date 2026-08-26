// =====================================================================
// OTROŠKI MENI + VEGETARIJANSKE JEDI
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedOtroški(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invPiscancjiFile, invMoka, invJajca, invDrobtine, invKrompir,
    invLignji, invKoruznaMoka,
    invCevapci
  } = inv
  const { catOtroški } = cat

  await createFood('Scooby Doo', 8.00, catOtroški.id, 'Piščančji dunajski in pomfrit', '1,2,3', 9.5, [
  { inv: invPiscancjiFile, qty: 0.12, unit: 'kg' }, { inv: invMoka, qty: 0.02, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/scooby-doo.png')
  await createFood('Duffy Duck', 8.00, catOtroški.id, 'Ocvrti lignji in pomfrit', '1,2,4', 9.5, [
  { inv: invLignji, qty: 0.12, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/duffy-duck-burger.png')
  await createFood('Aladin', 8.00, catOtroški.id, 'Čevapčiči in pomfrit', '1', 9.5, [
  { inv: invCevapci, qty: 0.15, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/aladin-mesano.png')
}

export async function seedVegetarijanske(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invPecenaZelenjava, invRiz, invSolata,
    invMladiSir, invKoruznaMoka, invKrompir, invTartarskaOmaka,
    invDivjaci, invCebula,
    invAjdovaKasa, invJurcki, invBucke, invParmezan,
    invLepinja, invParadiznik
  } = inv
  const { catMesneJedi } = cat

  await createFood('Vegetarijanski krožnik', 11.00, catMesneJedi.id, 'Sezonska zelenjava, riž, solata', '1', 9.5, [
  { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }, { inv: invRiz, qty: 0.10, unit: 'kg' }, { inv: invSolata, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/vegetarijanski-kroznik.png')
  await createFood('Ocvrti sir', 10.00, catMesneJedi.id, 'Ocvrti sir s pomfrijem in tatarsko omako', '1,2,3', 9.5, [
  { inv: invMladiSir, qty: 1, unit: 'kos' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/ocvrti-sir-3.png')
  await createFood('Divjačinski golaž', 12.00, catMesneJedi.id, 'Divjačinski golaž s kruhom ali prilogo', '1', 9.5, [
  { inv: invDivjaci, qty: 0.20, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/golaz-polenta.png')
  await createFood('Ajdrova kaša z jurčki', 11.90, catMesneJedi.id, 'Ajdrova kaša z jurčki, pečenimi bučkami in parmezanom', '1', 9.5, [
  { inv: invAjdovaKasa, qty: 0.15, unit: 'kg' }, { inv: invJurcki, qty: 0.04, unit: 'kg' }, { inv: invBucke, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/ajdova-kasa-jurcki.png')
  await createFood('Falafel wrap', 11.20, catMesneJedi.id, 'Hrustljavi falafel v lepinji z zelenjavo in tahini omako', '1,2', 9.5, [
  { inv: invLepinja, qty: 1, unit: 'kos' }, { inv: invSolata, qty: 0.05, unit: 'kg' }, { inv: invParadiznik, qty: 0.04, unit: 'kg' }
],
  '/menu-images/hrana/falafel-wrap.png')
}
