// Recepti za burgerje in vegetarijanske jedi

import type { InvItem, RecipeEntry } from '../../types'

export function buildBurgerAndVegRecipes(inv: Record<string, InvItem>): RecipeEntry[] {
  const {
    invBurgerPatty, invKozjiSir, invSlanina, invCebula, invCheddarSir,
    invSolata, invRostbeef, invTartufi, invPesto, invBucke,
    invPiscancjiFile, invJajca, invMešanaZelenjava, invMletnoMeso,
    invCesen, invOlivnoOlje, invMelancani, invSampinjoni,
  } = inv

  return [
    // --- BURGERJI ---
    { menuItemName: 'Hišni burger', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
    { menuItemName: 'Hišni burger', ingredientId: invKozjiSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'kozji sir' },
    { menuItemName: 'Hišni burger', ingredientId: invSlanina.id, quantityPerServing: 0.05, unit: 'kg', notes: 'slanina' },
    { menuItemName: 'Hišni burger', ingredientId: invCebula.id, quantityPerServing: 0.03, unit: 'kg', notes: 'karamelizirana čebula' },
    { menuItemName: 'The classic', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
    { menuItemName: 'The classic', ingredientId: invCheddarSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'cheddar' },
    { menuItemName: 'The classic', ingredientId: invSolata.id, quantityPerServing: 0.03, unit: 'kg', notes: 'solata' },
    { menuItemName: 'Big BOSS', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
    { menuItemName: 'Big BOSS', ingredientId: invRostbeef.id, quantityPerServing: 0.05, unit: 'kg', notes: 'rostbeef' },
    { menuItemName: 'Big BOSS', ingredientId: invTartufi.id, quantityPerServing: 1, unit: 'kos', notes: 'tartufina majoneza' },
    { menuItemName: 'Cheese please', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g goveji patty' },
    { menuItemName: 'Cheese please', ingredientId: invCheddarSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'cheddar' },
    { menuItemName: 'Green garden', ingredientId: invBurgerPatty.id, quantityPerServing: 1, unit: 'kos', notes: '170g patty' },
    { menuItemName: 'Green garden', ingredientId: invPesto.id, quantityPerServing: 1, unit: 'kos', notes: 'bazilični pesto' },
    { menuItemName: 'Green garden', ingredientId: invBucke.id, quantityPerServing: 0.05, unit: 'kg', notes: 'bučke' },
    { menuItemName: 'Crispy chicken burger', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.18, unit: 'kg', notes: '180g piščančja prsa' },
    { menuItemName: 'Crispy chicken burger', ingredientId: invCheddarSir.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
    { menuItemName: 'Fit burger', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.18, unit: 'kg', notes: '180g piščančja prsa' },
    { menuItemName: 'Fit burger', ingredientId: invBucke.id, quantityPerServing: 0.05, unit: 'kg', notes: 'bučke' },
    { menuItemName: 'Fit burger', ingredientId: invJajca.id, quantityPerServing: 1, unit: 'kos', notes: '1 jajce' },

    // --- VEGETARIJANSKE ---
    { menuItemName: 'Zelenjavni zrezki', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.2, unit: 'kg', notes: 'zelenjava' },
    { menuItemName: 'Sojini polpeti', ingredientId: invMletnoMeso.id, quantityPerServing: 0.15, unit: 'kg', notes: 'sojini polpeti' },
    { menuItemName: 'Bučke na žaru', ingredientId: invBucke.id, quantityPerServing: 0.25, unit: 'kg', notes: 'bučke' },
    { menuItemName: 'Bučke na žaru', ingredientId: invCesen.id, quantityPerServing: 0.01, unit: 'kg', notes: 'česen' },
    { menuItemName: 'Bučke na žaru', ingredientId: invOlivnoOlje.id, quantityPerServing: 0.02, unit: 'L', notes: 'olivno olje' },
    { menuItemName: 'Ocvrte bučke', ingredientId: invBucke.id, quantityPerServing: 0.25, unit: 'kg', notes: 'bučke' },
    { menuItemName: 'Ocvrti melancani', ingredientId: invMelancani.id, quantityPerServing: 0.25, unit: 'kg', notes: 'melancani' },
    { menuItemName: 'Vegetarijanska plošča', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.2, unit: 'kg', notes: 'zelenjava' },
    { menuItemName: 'Vegetarijanska plošča', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'šampinjoni' },
  ]
}
