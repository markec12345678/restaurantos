// =====================================================================
// Barrel export za create-inventory/ — inventarne postavke hrane
// =====================================================================

import type { InvMap } from '../types'
import { createMeatAndSeafood } from './meat-seafood'
import { createDairyAndGrains } from './dairy-grains'
import { createProduceSaucesAndExtras } from './produce-sauces-extras'

export async function createFoodInventoryItems(): Promise<InvMap> {
  const [meatAndSeafood, dairyAndGrains, produceSaucesAndExtras] = await Promise.all([
    createMeatAndSeafood(),
    createDairyAndGrains(),
    createProduceSaucesAndExtras(),
  ])

  return {
    ...meatAndSeafood,
    ...dairyAndGrains,
    ...produceSaucesAndExtras,
  }
}
