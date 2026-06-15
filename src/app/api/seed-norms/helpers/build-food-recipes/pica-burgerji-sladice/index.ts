// =====================================================================
// GRADNJA RECEPTOV - Hrana: pica, burgerji, sladice, priloge, koktajli
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../../types'
import { buildPicaRecipes } from './pica-recipes'
import { buildBurgerjiRecipes, buildSladiceRecipes } from './burgerji-sladice-recipes'
import { buildPrilogeRecipes, buildKoktajliRecipes } from './priloge-koktajli-recipes'

export function buildPicaBurgerjiSladiceRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  return [
    ...buildPicaRecipes(inv, mi),
    ...buildBurgerjiRecipes(inv, mi),
    ...buildSladiceRecipes(inv, mi),
    ...buildPrilogeRecipes(inv, mi),
    ...buildKoktajliRecipes(inv, mi),
  ]
}
