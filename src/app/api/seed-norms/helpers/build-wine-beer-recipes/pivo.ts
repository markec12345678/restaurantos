// =====================================================================
// GRADNJA RECEPTOV - Pivo (točeno, steklenično, craft, brezalkoholno)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildPivoRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invBevogTak,
    invDaura,
    invHalerKeg,
    invHeineken00,
    invLaskoKeg,
    invPeliconIPAKeg,
    invPeliconWinter,
    invRadlerKeg,
    invResetFroggy,
    invResetLagerish,
    invResetStout,
    invUnionKeg,
    invZeleniHaler,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- TOČENO PIVO ---
  const tocenoPivoDrinks: [string, typeof invHalerKeg, number][] = [
    ['Pivo Haler Lager Nefiltriran (0.30L)', invHalerKeg, 0.6],
    ['Pivo Haler Lager Nefiltriran (0.50L)', invHalerKeg, 1],
    ['Pivo Laško Lager (0.30L)', invLaskoKeg, 0.6],
    ['Pivo Laško Lager (0.50L)', invLaskoKeg, 1],
    ['Pivo Union Lager (0.30L)', invUnionKeg, 0.6],
    ['Pivo Union Lager (0.50L)', invUnionKeg, 1],
    ['Pelicon 3rd Pill IPA (0.30L)', invPeliconIPAKeg, 0.6],
    ['Pelicon 3rd Pill IPA (0.50L)', invPeliconIPAKeg, 1],
    ['Radler Grenivka (0.30L)', invRadlerKeg, 0.6],
    ['Radler Grenivka (0.50L)', invRadlerKeg, 1],
  ]
  for (const [name, inv, qty] of tocenoPivoDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: qty, unit: 'servings', notes: qty < 1 ? '0.30L' : '0.50L' })
  }

  // --- PIVO V STEKLENICAH ---
  const pivoBottleDrinks: [string, typeof invResetLagerish][] = [
    ['Reset Lagerish Cream Ale (0.50L)', invResetLagerish],
    ['Reset Froggy IPA (0.50L)', invResetFroggy],
    ['Reset Irish Extra Stout (0.50L)', invResetStout],
  ]
  for (const [name, inv] of pivoBottleDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
  }

  // --- CRAFT PIVA ---
  const craftDrinks: [string, typeof invPeliconWinter][] = [
    ['Pelicon Winter (0.75L)', invPeliconWinter],
    ['Zeleni Haler Lager s Konopljo (0.50L)', invZeleniHaler],
    ['Bevog Tak Pale Ale (0.33L)', invBevogTak],
  ]
  for (const [name, inv] of craftDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
  }

  // --- BREZALKOHOLNO PIVO ---
  const brezalkDrinks: [string, typeof invHeineken00][] = [
    ['Heineken 0.0 (0.33L)', invHeineken00],
    ['Daura Lager (0.33L)', invDaura],
  ]
  for (const [name, inv] of brezalkDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
  }

  return recipes
}
