// =====================================================================
// SEED HRANE - Burgerji, Ribje jedi, Pice, Solate, Priloge, Sladice, Otroški, Vegetarijanske
// =====================================================================

import { db } from '@/lib/db'
import type { InvMap, CatMap } from '../types'
import { seedRibjeJediPart2 } from './ribje-jedi'
import { seedPice } from './pice'
import { seedSolate } from './solate'
import { seedPriloge } from './priloge'
import { seedSladice } from './sladice'
import { seedOtroški, seedVegetarijanske } from './otroski-vegetarijanske'

export async function seedFoodPart2(inv: InvMap, cat: CatMap): Promise<void> {
  await seedRibjeJediPart2(inv, cat)
  await seedPice(inv, cat)
  await seedSolate(inv, cat)
  await seedPriloge(inv, cat)
  await seedSladice(inv, cat)
  await seedOtroški(inv, cat)
  await seedVegetarijanske(inv, cat)

  // Get references to items created by beverage seed (if they exist)
  const existingKavnaZrna = await db.inventoryItem.findFirst({ where: { name: { contains: 'Kavna zrna' } } })
  const existingCokolada = await db.inventoryItem.findFirst({ where: { name: { contains: 'Čokolada za vročo' } } })
  const existingSladkor = await db.inventoryItem.findFirst({ where: { name: { contains: 'Sladkor' } } })
  const existingMed = await db.inventoryItem.findFirst({ where: { name: { contains: 'Med' } } })

  // These are kept for potential future use by beverage seed integration
  void existingKavnaZrna
  void existingCokolada
  void existingSladkor
  void existingMed
}
