// =====================================================================
// GRADNJA RECEPTOV - Vina (barrel export)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../../types'
import { buildPenineBelaRecipes } from './penine-bela'
import { buildRoseRdecaTujalikerskaRecipes } from './rose-rdeca-tuja-likerska'

export function buildVinaRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn,
): RecipeEntry[] {
  return [
    ...buildPenineBelaRecipes(inv, mi),
    ...buildRoseRdecaTujalikerskaRecipes(inv, mi),
  ]
}
