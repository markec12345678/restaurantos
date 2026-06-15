// =====================================================================
// GRADNJA RECEPTOV - Vode, sokovi, gazirane pijače
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildVodeSokoviRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invAnanasovSok,
    invBubbleTea,
    invCajVrecice,
    invCedevita,
    invCocaCola,
    invCocaColaZero,
    invCockta,
    invFanta,
    invFeverTreeMedTonic,
    invFeverTreeRhubarb,
    invFeverTreeTonic,
    invJabolcniSok,
    invJagodniSok,
    invLedeniCaj,
    invLimone,
    invMarelicniSok,
    invMeta,
    invMineralnaVoda025,
    invMineralnaVoda050,
    invMineralnaVoda100,
    invNaravnaVoda025,
    invNaravnaVoda050,
    invNaravnaVoda100,
    invPomarancniSok,
    invPomarance,
    invRadenskaFunc,
    invRedBull,
    invRibezovSok,
    invSchweppesBitter,
    invSladkor,
    invSprite,
    invTonicWater,
    invVodaZOkusom,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- VODE (enostavno - 1:1 inventar) ---
  const waterDrinks: [string, typeof invMineralnaVoda025][] = [
    ['Mineralna Voda (0.25L)', invMineralnaVoda025],
    ['Mineralna Voda (0.50L)', invMineralnaVoda050],
    ['Mineralna Voda (1.00L)', invMineralnaVoda100],
    ['Naravna Voda (0.25L)', invNaravnaVoda025],
    ['Naravna Voda (0.50L)', invNaravnaVoda050],
    ['Naravna Voda (1.00L)', invNaravnaVoda100],
    ['Naravna Voda z Okusom (0.50L)', invVodaZOkusom],
    ['Voda Radenska FunctionALL (0.50L)', invRadenskaFunc],
  ]
  for (const [name, inv] of waterDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 enota' })
  }

  // --- NARAVNI SOKOVI ---
  const limonada = mi('Limonada (0.35L)')
  if (limonada) {
    recipes.push({ menuItemName: 'Limonada (0.35L)', ingredientId: invLimone.id, quantityPerServing: 5, unit: 'servings', notes: 'Sok 1/2 limone' })
    recipes.push({ menuItemName: 'Limonada (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor po okusu' })
    recipes.push({ menuItemName: 'Limonada (0.35L)', ingredientId: invNaravnaVoda050.id, quantityPerServing: 0.7, unit: 'servings', notes: 'Voda' })
  }

  const limonadaOkus = mi('Limonada z Okusom (0.35L)')
  if (limonadaOkus) {
    recipes.push({ menuItemName: 'Limonada z Okusom (0.35L)', ingredientId: invLimone.id, quantityPerServing: 5, unit: 'servings', notes: 'Sok 1/2 limone' })
    recipes.push({ menuItemName: 'Limonada z Okusom (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor' })
    recipes.push({ menuItemName: 'Limonada z Okusom (0.35L)', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
  }

  const hisniSokMeta = mi('Hišni Sok Meta (0.35L)')
  if (hisniSokMeta) {
    recipes.push({ menuItemName: 'Hišni Sok Meta (0.35L)', ingredientId: invMeta.id, quantityPerServing: 3, unit: 'servings', notes: 'Sveža meta' })
    recipes.push({ menuItemName: 'Hišni Sok Meta (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 3, unit: 'servings', notes: 'Sladkor' })
  }

  const hisniLedeniCaj = mi('Hišni Ledeni Čaj (0.35L)')
  if (hisniLedeniCaj) {
    recipes.push({ menuItemName: 'Hišni Ledeni Čaj (0.35L)', ingredientId: invCajVrecice.id, quantityPerServing: 1, unit: 'servings', notes: '1 čajna vrečka' })
    recipes.push({ menuItemName: 'Hišni Ledeni Čaj (0.35L)', ingredientId: invSladkor.id, quantityPerServing: 2, unit: 'servings', notes: 'Sladkor' })
    recipes.push({ menuItemName: 'Hišni Ledeni Čaj (0.35L)', ingredientId: invLimone.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limone' })
  }

  const naravniPomSok = mi('Naravni Pomarančni Sok (0.10L)')
  if (naravniPomSok) {
    recipes.push({ menuItemName: 'Naravni Pomarančni Sok (0.10L)', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: 'Sok 1 pomaranče' })
  }

  // --- SOKOVI V STEKLENICAH ---
  const sokDrinks: [string, typeof invMarelicniSok][] = [
    ['Marelični Sok (0.20L)', invMarelicniSok],
    ['Naravni Jabolčni Sok 100% (0.20L)', invJabolcniSok],
    ['Ribezov Sok (0.20L)', invRibezovSok],
    ['Ananasov Sok (0.20L)', invAnanasovSok],
    ['Pomarančni Sok (0.20L)', invPomarancniSok],
    ['Jagodni Sok (0.20L)', invJagodniSok],
    ['Ledeni Čaj (0.25L)', invLedeniCaj],
    ['Cedevita (0.30L)', invCedevita],
    ['Bubble Tea (0.36L)', invBubbleTea],
  ]
  for (const [name, inv] of sokDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 enota' })
  }

  // --- GAZIRANE PIJAČE ---
  const gaziraneDrinks: [string, typeof invCocaCola][] = [
    ['Coca Cola (0.25L)', invCocaCola],
    ['Coca Cola Zero (0.25L)', invCocaColaZero],
    ['Fanta (0.25L)', invFanta],
    ['Cockta (0.275L)', invCockta],
    ['Sprite (0.25L)', invSprite],
    ['Schweppes Tonic Water (0.25L)', invTonicWater],
    ['Schweppes Bitter Lemon (0.25L)', invSchweppesBitter],
    ['Fever Tree Tonic Water (0.20L)', invFeverTreeTonic],
    ['Fever Tree Mediterranean Tonic (0.20L)', invFeverTreeMedTonic],
    ['Fever Tree Rhubarb & Raspberry Tonic (0.20L)', invFeverTreeRhubarb],
    ['Red Bull (0.20L)', invRedBull],
  ]
  for (const [name, inv] of gaziraneDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 enota' })
  }

  return recipes
}
