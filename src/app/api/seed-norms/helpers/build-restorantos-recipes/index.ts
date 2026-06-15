// =====================================================================
// RECEPTI ZA HRANO - RestorantOS (barrel export)
// =====================================================================

import type { InvItem, RecipeEntry } from '../types'
import { buildPredjediRecipes } from './predjedi'
import { buildGlavneJediRecipes } from './glavne-jedi'
import { buildPiceDrugoRecipes } from './pice-drugo'

export function buildRestorantosRecipes(inv: Record<string, InvItem>): RecipeEntry[] {
  return [
    ...buildPredjediRecipes(inv),
    ...buildGlavneJediRecipes(inv),
    ...buildPiceDrugoRecipes(inv),
  ]
}
