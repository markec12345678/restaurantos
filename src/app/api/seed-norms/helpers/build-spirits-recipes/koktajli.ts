// =====================================================================
// GRADNJA RECEPTOV - Koktajli in Gin Tonics
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildKoktajliRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invAperol,
    invBrinoveJagode,
    invCampari,
    invCocaCola,
    invFeverTreeMedTonic,
    invFeverTreeRhubarb,
    invFeverTreeTonic,
    invGingerAle,
    invGinKristal,
    invGinKristalOrange,
    invGinKristalRaspberry,
    invGinMare,
    invGinMonolog,
    invHendricks,
    invKumara,
    invLimete,
    invLimone,
    invMeta,
    invMonkey47,
    invMoninJagoda,
    invMoninMango,
    invPomarance,
    invProsecco,
    invRozmarin,
    invRumHavana,
    invSladkor,
    invSodaVoda,
    invVermut,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- MEŠANE PIJAČE (koktajli - kompleksni recepti) ---
  const aperolSpritz = mi('Aperol Spritz')
  if (aperolSpritz) {
    recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invAperol.id, quantityPerServing: 3, unit: 'servings', notes: '0.09L Aperol' })
    recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invProsecco.id, quantityPerServing: 1, unit: 'servings', notes: '0.12L Prosecco' })
    recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.02L Soda' })
    recipes.push({ menuItemName: 'Aperol Spritz', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina pomaranče' })
  }

  const martiniSpritz = mi('Martini Spritz')
  if (martiniSpritz) {
    recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invVermut.id, quantityPerServing: 3, unit: 'servings', notes: '0.09L Martini bianco' })
    recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invProsecco.id, quantityPerServing: 1, unit: 'servings', notes: '0.12L Prosecco' })
    recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.02L Soda' })
    recipes.push({ menuItemName: 'Martini Spritz', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
  }

  const negroni = mi('Negroni')
  if (negroni) {
    recipes.push({ menuItemName: 'Negroni', ingredientId: invGinKristal.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Gin' })
    recipes.push({ menuItemName: 'Negroni', ingredientId: invVermut.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Vermut' })
    recipes.push({ menuItemName: 'Negroni', ingredientId: invCampari.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Campari' })
    recipes.push({ menuItemName: 'Negroni', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina pomaranče' })
  }

  const cubaLibre = mi('Cuba Libre')
  if (cubaLibre) {
    recipes.push({ menuItemName: 'Cuba Libre', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
    recipes.push({ menuItemName: 'Cuba Libre', ingredientId: invCocaCola.id, quantityPerServing: 1, unit: 'servings', notes: '0.25L Cola' })
    recipes.push({ menuItemName: 'Cuba Libre', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
  }

  const mojito = mi('Mojito')
  if (mojito) {
    recipes.push({ menuItemName: 'Mojito', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
    recipes.push({ menuItemName: 'Mojito', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.15L Soda' })
    recipes.push({ menuItemName: 'Mojito', ingredientId: invSladkor.id, quantityPerServing: 1, unit: 'servings', notes: '1 žlička sladkorja' })
    recipes.push({ menuItemName: 'Mojito', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
    recipes.push({ menuItemName: 'Mojito', ingredientId: invLimete.id, quantityPerServing: 2, unit: 'servings', notes: '2 rezini limete' })
  }

  const mangoMojito = mi('Mango Mojito')
  if (mangoMojito) {
    recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
    recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.15L Soda' })
    recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invMoninMango.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Monin Mango' })
    recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
    recipes.push({ menuItemName: 'Mango Mojito', ingredientId: invLimete.id, quantityPerServing: 2, unit: 'servings', notes: '2 rezini limete' })
  }

  const strawberryMojito = mi('Strawberry Mojito')
  if (strawberryMojito) {
    recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invRumHavana.id, quantityPerServing: 2, unit: 'servings', notes: '0.06L Rum' })
    recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invSodaVoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.15L Soda' })
    recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invMoninJagoda.id, quantityPerServing: 1, unit: 'servings', notes: '0.03L Monin Strawberry' })
    recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
    recipes.push({ menuItemName: 'Strawberry Mojito', ingredientId: invLimete.id, quantityPerServing: 2, unit: 'servings', notes: '2 rezini limete' })
  }

  // --- GIN TONICS ---
  const londonDryGT = mi('London Dry Gin Tonic')
  if (londonDryGT) {
    recipes.push({ menuItemName: 'London Dry Gin Tonic', ingredientId: invGinKristal.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
    recipes.push({ menuItemName: 'London Dry Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
    recipes.push({ menuItemName: 'London Dry Gin Tonic', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
  }

  const monologGT = mi('Monologue Gin Tonic')
  if (monologGT) {
    recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invGinMonolog.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
    recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
    recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invBrinoveJagode.id, quantityPerServing: 1, unit: 'servings', notes: 'Brinove jagode' })
    recipes.push({ menuItemName: 'Monologue Gin Tonic', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
  }

  const hendricksGT = mi('Hendrick\'s Gin Tonic')
  if (hendricksGT) {
    recipes.push({ menuItemName: 'Hendrick\'s Gin Tonic', ingredientId: invHendricks.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
    recipes.push({ menuItemName: 'Hendrick\'s Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
    recipes.push({ menuItemName: 'Hendrick\'s Gin Tonic', ingredientId: invKumara.id, quantityPerServing: 1, unit: 'servings', notes: 'Rezina kumare' })
  }

  const ginMareTonic = mi('Gin Mare Tonic')
  if (ginMareTonic) {
    recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invGinMare.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
    recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invFeverTreeMedTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Mediterranean tonik' })
    recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invLimete.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limete' })
    recipes.push({ menuItemName: 'Gin Mare Tonic', ingredientId: invRozmarin.id, quantityPerServing: 1, unit: 'servings', notes: 'Vejica rožmarina' })
  }

  const monkey47GT = mi('Monkey 47 Gin Tonic')
  if (monkey47GT) {
    recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invMonkey47.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
    recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invFeverTreeTonic.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Tonic' })
    recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invBrinoveJagode.id, quantityPerServing: 1, unit: 'servings', notes: 'Brinove jagode' })
    recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invRozmarin.id, quantityPerServing: 1, unit: 'servings', notes: 'Vejica rožmarina' })
    recipes.push({ menuItemName: 'Monkey 47 Gin Tonic', ingredientId: invLimone.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina limone' })
  }

  const orangeGingerGT = mi('Orange & Ginger Gin Tonic')
  if (orangeGingerGT) {
    recipes.push({ menuItemName: 'Orange & Ginger Gin Tonic', ingredientId: invGinKristalOrange.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
    recipes.push({ menuItemName: 'Orange & Ginger Gin Tonic', ingredientId: invGingerAle.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Ginger Ale' })
    recipes.push({ menuItemName: 'Orange & Ginger Gin Tonic', ingredientId: invPomarance.id, quantityPerServing: 1, unit: 'servings', notes: '1 rezina pomaranče' })
  }

  const raspberryGT = mi('Raspberry Pink Gin Tonic')
  if (raspberryGT) {
    recipes.push({ menuItemName: 'Raspberry Pink Gin Tonic', ingredientId: invGinKristalRaspberry.id, quantityPerServing: 1.5, unit: 'servings', notes: '0.045L Gin' })
    recipes.push({ menuItemName: 'Raspberry Pink Gin Tonic', ingredientId: invFeverTreeRhubarb.id, quantityPerServing: 1, unit: 'servings', notes: '0.20L Rhubarb&Raspberry tonik' })
    recipes.push({ menuItemName: 'Raspberry Pink Gin Tonic', ingredientId: invMeta.id, quantityPerServing: 1, unit: 'servings', notes: 'Meta listi' })
  }

  return recipes
}
