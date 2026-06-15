// =====================================================================
// USTVARJANJE INVENTARNIH POSTAVK - Pijače in sestavine
// Barrel re-export — združuje vse podmodule
// =====================================================================

import type { InvItem } from '../types'
import { createHotBeveragesAndDairy } from './hot-beverages-dairy'
import { createSpirits } from './spirits'
import { createMixersProduceAndSyrups, createWatersJuicesAndBeer, createWines } from './wines-beer-waters'
import { createFoodSupplies } from './food-supplies'

export async function createBeverageInventory(): Promise<Record<string, InvItem>> {
  const [hotBeverages, spirits, mixersProduce, watersJuicesBeer, wines, food] = await Promise.all([
    createHotBeveragesAndDairy(),
    createSpirits(),
    createMixersProduceAndSyrups(),
    createWatersJuicesAndBeer(),
    createWines(),
    createFoodSupplies(),
  ])

  return {
    ...hotBeverages,
    ...spirits,
    ...mixersProduce,
    ...watersJuicesBeer,
    ...wines,
    ...food,
  }
}
