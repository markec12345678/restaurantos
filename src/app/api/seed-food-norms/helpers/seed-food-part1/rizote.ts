// =====================================================================
// RIŽOTE
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedRizote(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invRiz, invJurcki, invParmezan, invSladkaSmetana, invOlivnoOlje,
    invMorskiSadezi, invPelati,
    invPiscancjiFile, invPecenaZelenjava
  } = inv
  const { catRizote } = cat

  await createFood('Rižota z jurčki', 10.00, catRizote.id, 'Kremna rižota z jurčki in parmezanom', '1', 9.5, [
  { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/rizot-gobe-3.png')
  await createFood('Rižota z morskimi sadeži', 14.00, catRizote.id, 'Rižota z mešanimi morskimi sadeži', '1,4', 9.5, [
  { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invMorskiSadezi, qty: 0.12, unit: 'kg' }, { inv: invPelati, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }
],
  '/menu-images/hrana/rizot-morski-sadezi-2.png')
  await createFood('Rižota s piščancem in zelenjavo', 11.00, catRizote.id, 'Rižota s piščančjim mesom in sezonsko zelenjavo', '1', 9.5, [
  { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.08, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
],
  '/menu-images/hrana/rizota-piscanec-zelenjava.png')
}
