// =====================================================================
// GRADNJA RECEPTOV - Kava, žgane pijače, koktajli, gin tonics (barrel export)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'
import { buildKavaRecipes } from './kava'
import { buildZganePijaceRecipes } from './zgane-pijace'
import { buildKoktajliRecipes } from './koktajli'

export function buildSpiritsRecipes(inv: Record<string, InvItem>, mi: MiFn): RecipeEntry[] {
  return [
    ...buildKavaRecipes(inv, mi),
    ...buildZganePijaceRecipes(inv, mi),
    ...buildKoktajliRecipes(inv, mi),
  ]
}
