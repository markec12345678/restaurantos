// =====================================================================
// SLADICE
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedSladice(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invJabolka, invMoka, invSladkaSmetana, invJagode,
    invMascarpone, invJajca,
    invZlikrofi, invKislaSmetana,
    invMladiSir, invKoruznaMoka, invKrompir, invTartarskaOmaka
  } = inv
  const { catSladice } = cat

  await createFood('Jabolčni zavitek', 4.00, catSladice.id, 'Hrustljav jabolčni zavitek s cimetom', '1,2', 9.5, [
  { inv: invJabolka, qty: 0.15, unit: 'kg' }, { inv: invMoka, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/cesnov-kruh.png')
  await createFood('Panna cotta', 4.00, catSladice.id, 'Kremna panna cotta z jagodnim prelivom', '1,2', 9.5, [
  { inv: invSladkaSmetana, qty: 0.10, unit: 'L' }, { inv: invJagode, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/cokoladna-torta.png')
  await createFood('Tiramisu', 4.50, catSladice.id, 'Klasik tiramisu z mascarpone kremo in kavo', '1,2', 9.5, [
  { inv: invMascarpone, qty: 0.08, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/panna-cotta.png')
  await createFood('Lava cake', 5.00, catSladice.id, 'Topla čokoladna tortica s tekočim sredinskim delom', '1,2', 9.5, [
  { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invMoka, qty: 0.02, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }
],
  '/menu-images/hrana/tiramisu.png')
  await createFood('Limonin creme brulee', 5.90, catSladice.id, 'Kremast limonin creme brulee s hrustljavo skorjico', '1,2', 9.5, [
  { inv: invSladkaSmetana, qty: 0.10, unit: 'L' }, { inv: invJajca, qty: 2, unit: 'kos' }
],
  '/menu-images/hrana/cokoladni-lava-cake.png')
  await createFood('Bovški krafi', 6.00, catSladice.id, 'Bovški krafi - sladki štruklji s tepkami', '1,2', 9.5, [
  { inv: invZlikrofi, qty: 0.15, unit: 'kg' }, { inv: invKislaSmetana, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/creme-brulee.png')
  await createFood('Ocvrti sir s steak krompirčki', 10.00, catSladice.id, 'Ocvrti sir s steak krompirčki in domačo tatarsko omako', '1,2,3', 9.5, [
  { inv: invMladiSir, qty: 1, unit: 'kos' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/ocvrti-sir-krompircki.png')
}
