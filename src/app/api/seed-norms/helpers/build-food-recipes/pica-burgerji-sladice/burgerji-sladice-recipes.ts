// =====================================================================
// RECEPTI - Burgerji in sladice
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../../types'

export function buildBurgerjiRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invGovedinaMlena,
    invKruh,
    invSolata,
    invParadiznik,
    invCebula,
    invSlanina,
    invCheddarSir,
    invGobe,
    invSvicarskiSir,
    invAvokado,
  } = inv

  const recipes: RecipeEntry[] = []

  const klasicenBurger = mi('Klasičen burger')
  if (klasicenBurger) {
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invGovedinaMlena.id, quantityPerServing: 1, unit: 'servings', notes: '150g goveji patty' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invSolata.id, quantityPerServing: 1, unit: 'servings', notes: 'Solata' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invParadiznik.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnik' })
    recipes.push({ menuItemName: 'Klasičen burger', ingredientId: invCebula.id, quantityPerServing: 1, unit: 'servings', notes: 'Čebula' })
  }
  const baconCheeseburger = mi('Bacon cheeseburger')
  if (baconCheeseburger) {
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invGovedinaMlena.id, quantityPerServing: 1, unit: 'servings', notes: '150g goveji patty' })
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invSlanina.id, quantityPerServing: 3, unit: 'servings', notes: '150g slanine' })
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invCheddarSir.id, quantityPerServing: 1, unit: 'servings', notes: 'Cheddar' })
    recipes.push({ menuItemName: 'Bacon cheeseburger', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
  }
  const gobeSvicar = mi('Gobe in švicar')
  if (gobeSvicar) {
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invGovedinaMlena.id, quantityPerServing: 1, unit: 'servings', notes: '150g goveji patty' })
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invGobe.id, quantityPerServing: 2, unit: 'servings', notes: '200g gob' })
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invSvicarskiSir.id, quantityPerServing: 1, unit: 'servings', notes: 'Švicarski sir' })
    recipes.push({ menuItemName: 'Gobe in švicar', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
  }
  const zelenjavniBurger = mi('Zelenjavni burger')
  if (zelenjavniBurger) {
    recipes.push({ menuItemName: 'Zelenjavni burger', ingredientId: invKruh.id, quantityPerServing: 1, unit: 'servings', notes: 'Burger bun' })
    recipes.push({ menuItemName: 'Zelenjavni burger', ingredientId: invAvokado.id, quantityPerServing: 1, unit: 'servings', notes: 'Avokado' })
    recipes.push({ menuItemName: 'Zelenjavni burger', ingredientId: invSolata.id, quantityPerServing: 1, unit: 'servings', notes: 'Solata' })
  }

  return recipes
}

export function buildSladiceRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invMascarpone,
    invPiskoti,
    invKavaZaTiramisu,
    invKakavPrašek,
    invJajca,
    invCokolada,
    invMaslo,
    invMoka,
    invRicotta,
    invSmetana,
    invSladkor,
  } = inv

  const recipes: RecipeEntry[] = []

  const tiramisu = mi('Tiramisu')
  if (tiramisu) {
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invMascarpone.id, quantityPerServing: 1, unit: 'servings', notes: '200g mascarpone' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invPiskoti.id, quantityPerServing: 1, unit: 'servings', notes: '100g piškotov' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invKavaZaTiramisu.id, quantityPerServing: 1, unit: 'servings', notes: '0.10L kave' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invKakavPrašek.id, quantityPerServing: 1, unit: 'servings', notes: 'Kakav za posip' })
    recipes.push({ menuItemName: 'Tiramisu', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'servings', notes: '1 jajce' })
  }
  const cokoladniLava = mi('Čokoladni lava cake')
  if (cokoladniLava) {
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invCokolada.id, quantityPerServing: 1, unit: 'servings', notes: '80g čokolade' })
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invMaslo.id, quantityPerServing: 1, unit: 'servings', notes: 'Maslo' })
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invJajca.id, quantityPerServing: 2, unit: 'servings', notes: '2 jajci' })
    recipes.push({ menuItemName: 'Čokoladni lava cake', ingredientId: invMoka.id, quantityPerServing: 1, unit: 'servings', notes: 'Moka' })
  }
  const cheesecake = mi('Cheesecake')
  if (cheesecake) {
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invRicotta.id, quantityPerServing: 1, unit: 'servings', notes: '100g ricotte' })
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invMascarpone.id, quantityPerServing: 1, unit: 'servings', notes: '100g mascarpone' })
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invPiskoti.id, quantityPerServing: 1, unit: 'servings', notes: 'Podloga iz piškotov' })
    recipes.push({ menuItemName: 'Cheesecake', ingredientId: invMaslo.id, quantityPerServing: 1, unit: 'servings', notes: 'Maslo za podlogo' })
  }
  const cremeBrulee = mi('Crème brûlée')
  if (cremeBrulee) {
    recipes.push({ menuItemName: 'Crème brûlée', ingredientId: invSmetana.id, quantityPerServing: 3, unit: 'servings', notes: '0.15L sladke smetane' })
    recipes.push({ menuItemName: 'Crème brûlée', ingredientId: invJajca.id, quantityPerServing: 2, unit: 'servings', notes: '2 rumenjaka' })
    recipes.push({ menuItemName: 'Crème brûlée', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor + karamela' })
  }

  return recipes
}
