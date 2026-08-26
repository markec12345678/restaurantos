// =====================================================================
// RIBJE JEDI (part 2)
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedRibjeJediPart2(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invLignji, invKoruznaMoka, invTartarskaOmaka,
    invCesen, invOlivnoOlje,
    invMozzarella, invSunka,
    invHobotnica, invPecenaZelenjava,
    invTuna,
    invKalamari, invKrompir, invKuhanaZelenjava
  } = inv
  const { catRibjeJedi } = cat

  await createFood('Lignji ocvrti', 12.00, catRibjeJedi.id, 'Hrustljavi ocvrti lignji s tartarsko omako', '1,2,4', 9.5, [
  { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/lignji-ocvrti-2.png')
  await createFood('Lignji na žaru', 12.00, catRibjeJedi.id, 'Lignji na žaru s česnom in peteršiljem', '1,4', 9.5, [
  { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/lignji-zar-2.png')
  await createFood('Lignji polnjeni', 13.50, catRibjeJedi.id, 'Polnjeni lignji s sirom in šunko', '1,2,4', 9.5, [
  { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invSunka, qty: 0.04, unit: 'kg' }
],
  '/menu-images/hrana/lignji-polnjeni.png')
  await createFood('Hobotnica na žaru', 15.00, catRibjeJedi.id, 'Hobotnica na žaru s pečeno zelenjavo', '1,4', 9.5, [
  { inv: invHobotnica, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/hobotnica-zar-3.png')
  await createFood('Tunin steak', 22.50, catRibjeJedi.id, 'Tunin steak z mediteransko zelenjavo in baziličnim oljem', '1,4', 9.5, [
  { inv: invTuna, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/tunin-steak.png')
  await createFood('File bele ribe z blitva', 14.80, catRibjeJedi.id, 'File bele ribe z blitva krompirjem', '1,2,4', 9.5, [
  { inv: invKalamari, qty: 0.15, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }, { inv: invKuhanaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/file-bele-ribe.png')
}
