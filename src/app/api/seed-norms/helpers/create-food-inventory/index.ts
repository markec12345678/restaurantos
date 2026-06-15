// =====================================================================
// USTVARJANJE INVENTARNIH POSTAVK - Hrana (Barrel export)
// =====================================================================

import type { InvItem } from '../types'
import { createMeatFishInventory } from './meat-fish'
import { createDairyProduceInventory } from './dairy-produce'
import { createSaucesDessertsInventory } from './sauces-desserts'

export async function createFoodInventory(): Promise<Record<string, InvItem>> {
  const [meatFish, dairyProduce, saucesDesserts] = await Promise.all([
    createMeatFishInventory(),
    createDairyProduceInventory(),
    createSaucesDessertsInventory(),
  ])

  return {
    ...meatFish,
    ...dairyProduce,
    ...saucesDesserts,
  }
}
