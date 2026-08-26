// Barrel export — Glavne jedi, testenine, rižote, kalamari, ribje jedi

import type { InvItem, RecipeEntry } from '../../types'
import { buildGlavneJedi } from './glavne-jedi'
import { buildTestenine } from './testenine'
import { buildRizoteKalamariRibe } from './rizote-kalamari-ribe'

export function buildGlavneJediRecipes(inv: Record<string, InvItem>): RecipeEntry[] {
  return [
    ...buildGlavneJedi(inv),
    ...buildTestenine(inv),
    ...buildRizoteKalamariRibe(inv),
  ]
}
