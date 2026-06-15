// =====================================================================
// RECEPTI - Priloge in koktajli
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../../types'

export function buildPrilogeRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invKrompir,
    invOljcnoOlje,
    invKruh,
    invCesn,
    invMaslo,
    invZelje,
    invKorenje,
    invSmetana,
    invCebula,
    invPivskoTesto,
  } = inv

  const recipes: RecipeEntry[] = []

  const pomfri = mi('Pomfri')
  if (pomfri) {
    recipes.push({ menuItemName: 'Pomfri', ingredientId: invKrompir.id, quantityPerServing: 1, unit: 'servings', notes: '200g krompirja' })
    recipes.push({ menuItemName: 'Pomfri', ingredientId: invOljcnoOlje.id, quantityPerServing: 3, unit: 'servings', notes: 'Za cvrtje' })
  }
  const cesnovKruh = mi('Česnov kruh')
  if (cesnovKruh) {
    recipes.push({ menuItemName: 'Česnov kruh', ingredientId: invKruh.id, quantityPerServing: 3, unit: 'servings', notes: '3 rezine kruha' })
    recipes.push({ menuItemName: 'Česnov kruh', ingredientId: invCesn.id, quantityPerServing: 3, unit: 'servings', notes: 'Česen' })
    recipes.push({ menuItemName: 'Česnov kruh', ingredientId: invMaslo.id, quantityPerServing: 2, unit: 'servings', notes: 'Česnovo maslo' })
  }
  const coleslaw = mi('Coleslaw')
  if (coleslaw) {
    recipes.push({ menuItemName: 'Coleslaw', ingredientId: invZelje.id, quantityPerServing: 1, unit: 'servings', notes: '250g zelja' })
    recipes.push({ menuItemName: 'Coleslaw', ingredientId: invKorenje.id, quantityPerServing: 1, unit: 'servings', notes: 'Korenje' })
    recipes.push({ menuItemName: 'Coleslaw', ingredientId: invSmetana.id, quantityPerServing: 1, unit: 'servings', notes: 'Kremni preliv' })
  }
  const cebljniObročki = mi('Čebulni obročki')
  if (cebljniObročki) {
    recipes.push({ menuItemName: 'Čebulni obročki', ingredientId: invCebula.id, quantityPerServing: 3, unit: 'servings', notes: '150g čebule' })
    recipes.push({ menuItemName: 'Čebulni obročki', ingredientId: invPivskoTesto.id, quantityPerServing: 1, unit: 'servings', notes: 'Pivsko testo' })
    recipes.push({ menuItemName: 'Čebulni obročki', ingredientId: invOljcnoOlje.id, quantityPerServing: 3, unit: 'servings', notes: 'Za cvrtje' })
  }

  return recipes
}

export function buildKoktajliRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invJackDaniels,
    invSladkor,
    invBrinoveJagode,
    invPomarance,
    invRumHavana,
    invMalibu,
    invAnanasovSok,
  } = inv

  const recipes: RecipeEntry[] = []

  const oldFashioned = mi('Old Fashioned')
  if (oldFashioned) {
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invJackDaniels.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L viskija' })
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invSladkor.id, quantityPerServing: 1, unit: 'servings', notes: 'Kocka sladkorja' })
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invBrinoveJagode.id, quantityPerServing: 1, unit: 'servings', notes: 'Brinove jagode' })
    recipes.push({ menuItemName: 'Old Fashioned', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: 'Lupina pomaranče' })
  }
  const pinaColada = mi('Pina Colada')
  if (pinaColada) {
    recipes.push({ menuItemName: 'Pina Colada', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L rum' })
    recipes.push({ menuItemName: 'Pina Colada', ingredientId: invMalibu.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L kokosov liker' })
    recipes.push({ menuItemName: 'Pina Colada', ingredientId: invAnanasovSok.id, quantityPerServing: 1, unit: 'servings', notes: 'Ananasov sok' })
  }

  return recipes
}
