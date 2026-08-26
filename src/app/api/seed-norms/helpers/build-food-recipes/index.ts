// =====================================================================
// GRADNJA RECEPTOV - Hrana (barrel export)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'
import { buildPredjediGlavneRecipes } from './predjedi-glavne'
import { buildPicaBurgerjiSladiceRecipes } from './pica-burgerji-sladice'

export function buildFoodRecipes(inv: Record<string, InvItem>, mi: MiFn): RecipeEntry[] {
  return [
    ...buildPredjediGlavneRecipes(inv, mi),
    ...buildPicaBurgerjiSladiceRecipes(inv, mi),
  ]
}
