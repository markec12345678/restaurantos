// =====================================================================
// RECEPTI - Pica
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../../types'

export function buildPicaRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invTestoZaPico,
    invParadiznikovaOmaka,
    invMocarela,
    invBazilika,
    invGovedinaMleta,
    invBBQOmaka,
    invCebula,
    invPaprika,
    invGobe,
    invOlive,
  } = inv

  const recipes: RecipeEntry[] = []

  const margherita = mi('Margherita')
  if (margherita) {
    recipes.push({ menuItemName: 'Margherita', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'Margherita', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Margherita', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'Margherita', ingredientId: invBazilika.id, quantityPerServing: 1, unit: 'servings', notes: 'Bazilika' })
  }
  const pepperoni = mi('Pepperoni')
  if (pepperoni) {
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'Pepperoni', ingredientId: invGovedinaMleta.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Pepperoni' })
  }
  const bbqPiscanec = mi('BBQ piščanec')
  if (bbqPiscanec) {
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invBBQOmaka.id, quantityPerServing: 2, unit: 'servings', notes: 'BBQ omaka' })
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'BBQ piščanec', ingredientId: invCebula.id, quantityPerServing: 1, unit: 'servings', notes: 'Rdeča čebula' })
  }
  const vegetarijanska = mi('Vegetarijanska')
  if (vegetarijanska) {
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invTestoZaPico.id, quantityPerServing: 1, unit: 'servings', notes: '1 testo' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invPaprika.id, quantityPerServing: 1, unit: 'servings', notes: 'Paprika' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invGobe.id, quantityPerServing: 1, unit: 'servings', notes: 'Gobe' })
    recipes.push({ menuItemName: 'Vegetarijanska', ingredientId: invOlive.id, quantityPerServing: 1, unit: 'servings', notes: 'Olive' })
  }

  return recipes
}
