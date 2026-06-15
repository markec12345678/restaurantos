// =====================================================================
// SEED HRANE - Predjedi, Juhe, Testenine, Rižote, Mesne jedi, Žar, Burgerji, Ribje jedi
// =====================================================================

import type { InvMap, CatMap } from '../types'
import { seedPredjedi } from './predjedi'
import { seedJuhe } from './juhe'
import { seedTestenine } from './testenine'
import { seedRizote } from './rizote'
import { seedMesneJedi } from './mesne-jedi'
import { seedZar } from './zar'
import { seedBurgerji, seedRibjeJedi } from './burgerji-ribje'

export async function seedFoodPart1(inv: InvMap, cat: CatMap): Promise<void> {
  await seedPredjedi(inv, cat)
  await seedJuhe(inv, cat)
  await seedTestenine(inv, cat)
  await seedRizote(inv, cat)
  await seedMesneJedi(inv, cat)
  await seedZar(inv, cat)
  await seedBurgerji(inv, cat)
  await seedRibjeJedi(inv, cat)
}
