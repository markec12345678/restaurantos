// Barrel export za pice-drugo/ — solate, pizze, burgerji, vegetarijanske, palačinke, otroci, malice

import type { InvItem, RecipeEntry } from '../../types'
import { buildSalateAndPizzeRecipes } from './salate-pizze'
import { buildBurgerAndVegRecipes } from './burger-veg'
import { buildPalacinkeOtrociMaliceRecipes } from './palacinke-otroci-malice'

export function buildPiceDrugoRecipes(inv: Record<string, InvItem>): RecipeEntry[] {
  return [
    ...buildSalateAndPizzeRecipes(inv),
    ...buildBurgerAndVegRecipes(inv),
    ...buildPalacinkeOtrociMaliceRecipes(inv),
  ]
}
