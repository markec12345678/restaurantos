// =====================================================================
// GRADNJA RECEPTOV - Kava in topli napitki
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildKavaRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invCajVrecice,
    invCokolada,
    invKakav,
    invKavaBrezKofeina,
    invKavaZrna,
    invKravjeMleko,
    invLimone,
    invMed,
    invRizevoMleko,
    invSladoled,
    invSmetana,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- TOPLI NAPITKI - KAVA ---
  const espresso = mi('Kava Espresso')
  if (espresso) recipes.push({ menuItemName: 'Kava Espresso', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })

  const macchiato = mi('Kava Macchiato')
  if (macchiato) {
    recipes.push({ menuItemName: 'Kava Macchiato', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
    recipes.push({ menuItemName: 'Kava Macchiato', ingredientId: invKravjeMleko.id, quantityPerServing: 0.1, unit: 'L', notes: 'Kapljica mleka' })
  }

  const cappuccino = mi('Cappuccino')
  if (cappuccino) {
    recipes.push({ menuItemName: 'Cappuccino', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
    recipes.push({ menuItemName: 'Cappuccino', ingredientId: invKravjeMleko.id, quantityPerServing: 0.15, unit: 'L', notes: 'Mlečna pena' })
  }

  const kavaZMlekom = mi('Kava z Mlekom')
  if (kavaZMlekom) {
    recipes.push({ menuItemName: 'Kava z Mlekom', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
    recipes.push({ menuItemName: 'Kava z Mlekom', ingredientId: invKravjeMleko.id, quantityPerServing: 0.10, unit: 'L', notes: 'Mleko' })
  }

  const kavaSSmetano = mi('Kava s Smetano')
  if (kavaSSmetano) {
    recipes.push({ menuItemName: 'Kava s Smetano', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
    recipes.push({ menuItemName: 'Kava s Smetano', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana na vrhu' })
  }

  const belaKava = mi('Bela Kava')
  if (belaKava) {
    recipes.push({ menuItemName: 'Bela Kava', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
    recipes.push({ menuItemName: 'Bela Kava', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Veliko mleka' })
  }

  const espressoBrezKofeina = mi('Kava Espresso Brez Kofeina')
  if (espressoBrezKofeina) recipes.push({ menuItemName: 'Kava Espresso Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })

  const kavaMlekoBrezKofeina = mi('Kava z Mlekom Brez Kofeina')
  if (kavaMlekoBrezKofeina) {
    recipes.push({ menuItemName: 'Kava z Mlekom Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
    recipes.push({ menuItemName: 'Kava z Mlekom Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.10, unit: 'L', notes: 'Mleko' })
  }

  const cappuccinoBrezKofeina = mi('Cappuccino Brez Kofeina')
  if (cappuccinoBrezKofeina) {
    recipes.push({ menuItemName: 'Cappuccino Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
    recipes.push({ menuItemName: 'Cappuccino Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.15, unit: 'L', notes: 'Mlečna pena' })
  }

  const macchiatoBrezKofeina = mi('Kava Macchiato Brez Kofeina')
  if (macchiatoBrezKofeina) {
    recipes.push({ menuItemName: 'Kava Macchiato Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
    recipes.push({ menuItemName: 'Kava Macchiato Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.05, unit: 'L', notes: 'Kapljica mleka' })
  }

  const belaKavaBrezKofeina = mi('Bela Kava Brez Kofeina')
  if (belaKavaBrezKofeina) {
    recipes.push({ menuItemName: 'Bela Kava Brez Kofeina', ingredientId: invKavaBrezKofeina.id, quantityPerServing: 1, unit: 'servings', notes: '7g decaf zrn' })
    recipes.push({ menuItemName: 'Bela Kava Brez Kofeina', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Veliko mleka' })
  }

  const kavaRizevoMleko = mi('Kava z Riževim Mlekom')
  if (kavaRizevoMleko) {
    recipes.push({ menuItemName: 'Kava z Riževim Mlekom', ingredientId: invKavaZrna.id, quantityPerServing: 1, unit: 'servings', notes: '7g kavnih zrn' })
    recipes.push({ menuItemName: 'Kava z Riževim Mlekom', ingredientId: invRizevoMleko.id, quantityPerServing: 0.15, unit: 'L', notes: 'Riževo mleko' })
  }

  const kakav = mi('Kakav')
  if (kakav) {
    recipes.push({ menuItemName: 'Kakav', ingredientId: invKakav.id, quantityPerServing: 1, unit: 'servings', notes: '20g kakava' })
    recipes.push({ menuItemName: 'Kakav', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Mleko' })
  }

  const kakavSSmetano = mi('Kakav s Smetano')
  if (kakavSSmetano) {
    recipes.push({ menuItemName: 'Kakav s Smetano', ingredientId: invKakav.id, quantityPerServing: 1, unit: 'servings', notes: '20g kakava' })
    recipes.push({ menuItemName: 'Kakav s Smetano', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Mleko' })
    recipes.push({ menuItemName: 'Kakav s Smetano', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana na vrhu' })
  }

  const babyccino = mi('Babyccino')
  if (babyccino) recipes.push({ menuItemName: 'Babyccino', ingredientId: invKravjeMleko.id, quantityPerServing: 0.10, unit: 'L', notes: 'Samo mlečna pena' })

  const vrocaCokolada = mi('Vroča Čokolada')
  if (vrocaCokolada) {
    recipes.push({ menuItemName: 'Vroča Čokolada', ingredientId: invCokolada.id, quantityPerServing: 1, unit: 'servings', notes: '80g čokolade' })
    recipes.push({ menuItemName: 'Vroča Čokolada', ingredientId: invKravjeMleko.id, quantityPerServing: 0.20, unit: 'L', notes: 'Mleko' })
    recipes.push({ menuItemName: 'Vroča Čokolada', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana na vrhu' })
  }

  const cajLimonaMed = mi('Čaj z Limono in Medom')
  if (cajLimonaMed) {
    recipes.push({ menuItemName: 'Čaj z Limono in Medom', ingredientId: invCajVrecice.id, quantityPerServing: 1, unit: 'servings', notes: '1 čajna vrečka' })
    recipes.push({ menuItemName: 'Čaj z Limono in Medom', ingredientId: invLimone.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limone' })
    recipes.push({ menuItemName: 'Čaj z Limono in Medom', ingredientId: invMed.id, quantityPerServing: 1, unit: 'servings', notes: '1 žlička medu' })
  }

  const ledenaKavaOlimia = mi('Ledena Kava Olimia')
  if (ledenaKavaOlimia) {
    recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invKavaZrna.id, quantityPerServing: 2, unit: 'servings', notes: 'Dvojni espresso' })
    recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invSladoled.id, quantityPerServing: 1, unit: 'servings', notes: '1 žlica vaniljevega sladoleda' })
    recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invCokolada.id, quantityPerServing: 0.3, unit: 'servings', notes: 'Čokoladni preliv' })
    recipes.push({ menuItemName: 'Ledena Kava Olimia', ingredientId: invSmetana.id, quantityPerServing: 0.03, unit: 'L', notes: 'Smetana' })
  }

  return recipes
}
