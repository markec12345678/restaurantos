// =====================================================================
// GRADNJA RECEPTOV - Vode, sokovi, pivo, vina (barrel export)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'
import { buildVodeSokoviRecipes } from './vode-sokovi'
import { buildPivoRecipes } from './pivo'
import { buildVinaRecipes } from './vina/index'

export function buildWineBeerRecipes(inv: Record<string, InvItem>, mi: MiFn): RecipeEntry[] {
  return [
    ...buildVodeSokoviRecipes(inv, mi),
    ...buildPivoRecipes(inv, mi),
    ...buildVinaRecipes(inv, mi),
  ]
}
