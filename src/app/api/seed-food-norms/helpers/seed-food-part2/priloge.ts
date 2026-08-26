// =====================================================================
// PRILOGE
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedPriloge(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invKrompir, invCebula, invPecenaZelenjava, invKuhanaZelenjava,
    invNjoki, invZlikrofi, invPolenta, invRiz, invLepinja
  } = inv
  const { catPriloge } = cat

  await createFood('Pomfrit', 3.50, catPriloge.id, 'Hrustljav ocvrt krompir', '1', 9.5, [
  { inv: invKrompir, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/pomfri-2.png')
  await createFood('Kuhan krompir', 3.50, catPriloge.id, 'Kuhan krompir z maslom in drobnjakom', '1', 9.5, [
  { inv: invKrompir, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/kuhan-krompir.png')
  await createFood('Pražen krompir', 3.50, catPriloge.id, 'Pražen krompir s čebulo', '1', 9.5, [
  { inv: invKrompir, qty: 0.20, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/prazen-krompir.png')
  await createFood('Pečena zelenjava', 4.00, catPriloge.id, 'Pečena sezonska zelenjava', '1', 9.5, [
  { inv: invPecenaZelenjava, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/pecena-zelenjava-2.png')
  await createFood('Kuhana zelenjava', 4.00, catPriloge.id, 'Kuhana zelenjava z maslom', '1', 9.5, [
  { inv: invKuhanaZelenjava, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/kuhana-zelenjava-3.png')
  await createFood('Njoki', 3.20, catPriloge.id, 'Krompirjevi njoki kot priloga', '1', 9.5, [
  { inv: invNjoki, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/njoki-preprosti.png')
  await createFood('Žlikrofi', 5.00, catPriloge.id, 'Žlikrofi kot priloga', '1', 9.5, [
  { inv: invZlikrofi, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/zlikrofi-2.png')
  await createFood('Polenta', 3.50, catPriloge.id, 'Kremna polenta', '1', 9.5, [
  { inv: invPolenta, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/zlikrofi.png')
  await createFood('Đuveč riž', 4.00, catPriloge.id, 'Đuveč riž z zelenjavo', '1', 9.5, [
  { inv: invRiz, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/duvec-riz.png')
  await createFood('Lepinja', 2.00, catPriloge.id, 'Sveža lepinja', '1', 9.5, [
  { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/lepinja-2.png')
}
