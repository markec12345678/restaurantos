// =====================================================================
// BURGERJI + RIBJE JEDI (part 1)
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedBurgerji(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invMletoGoveje, invBurgerBun, invMozzarella, invKrompir,
    invSvinjskiVrat, invColeslaw,
    invLosos, invRukola
  } = inv
  const { catBurgerji } = cat

  await createFood('Black Angus burger', 9.50, catBurgerji.id, 'Black Angus burger z domačo omako in krompirčki', '1,2', 9.5, [
  { inv: invMletoGoveje, qty: 0.20, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/black-angus-burger.png')
  await createFood('Pulled pork burger', 9.00, catBurgerji.id, 'Pulled pork burger sirom, coleslaw in krompirčki', '1,2', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.20, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.03, unit: 'kg' }, { inv: invColeslaw, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/bacon-cheeseburger.png')
  await createFood('Burger z lososom', 11.50, catBurgerji.id, 'Burger z lososom, kaviarjem, rukolo in krompirčki', '1,2,4', 9.5, [
  { inv: invLosos, qty: 0.15, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invRukola, qty: 0.02, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/burger-losos.png')
}

export async function seedRibjeJedi(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invPstrv, invTrzaskaOmaka, invKrompir,
    invLosos, invSparglji
  } = inv
  const { catRibjeJedi } = cat

  await createFood('Postrv s tržaško omako', 16.00, catRibjeJedi.id, 'Celà postrv s tržaško omako in krompirjem', '1,2,4', 9.5, [
  { inv: invPstrv, qty: 1, unit: 'kos' }, { inv: invTrzaskaOmaka, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/pstrv-trzaska-3.png')
  await createFood('Lososov file na žaru', 17.00, catRibjeJedi.id, 'Lososov file z žara s šparglji in pire krompirjem', '1,2,4', 9.5, [
  { inv: invLosos, qty: 0.20, unit: 'kg' }, { inv: invSparglji, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/losos-zar-3.png')
}
