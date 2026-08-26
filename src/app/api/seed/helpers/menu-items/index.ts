// =====================================================================
// MENU ARTIKLI - Barrel file
// Re-exports types and assembles getMenuItemsData from sub-modules
// =====================================================================

export type { CategoryRef, ModifierRef } from './types'
export type { MenuItemSeed } from './types'

import type { CategoryRef, ModifierRef, MenuItemSeed } from './types'
import { getFoodStartersSoups } from './food-starters-soups'
import { getFoodMains } from './food-mains'
import { getFoodSeafoodSalads } from './food-seafood-salads'
import { getFoodPizzaBurgerVeg } from './food-pizza-burger-veg'
import { getFoodPancakesDessertsKids } from './food-pancakes-desserts'
import { getFoodLunchesSides } from './food-lunches-sides'
import { getDrinksWine } from './drinks-wine'
import { getDrinksBeer } from './drinks-beer'
import { getDrinksSpirits } from './drinks-spirits'
import { getDrinksHotSoft } from './drinks-hot-soft'

export function getMenuItemsData(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    ...getFoodStartersSoups(cats, mods),
    ...getFoodMains(cats, mods),
    ...getFoodSeafoodSalads(cats, mods),
    ...getFoodPizzaBurgerVeg(cats, mods),
    ...getFoodPancakesDessertsKids(cats, mods),
    ...getFoodLunchesSides(cats, mods),
    ...getDrinksWine(cats),
    ...getDrinksBeer(cats),
    ...getDrinksSpirits(cats, mods),
    ...getDrinksHotSoft(cats, mods),
  ]
}
