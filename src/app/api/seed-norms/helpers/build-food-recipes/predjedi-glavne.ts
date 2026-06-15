// =====================================================================
// GRADNJA RECEPTOV - Hrana: predjedi, juhe, glavne jedi, testenine
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildPredjediGlavneRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invAvokado,
    invBazilika,
    invBechamel,
    invCebula,
    invCesn,
    invFettuccine,
    invGobe,
    invGovedinaMleta,
    invGovejaJuha,
    invJajca,
    invJanjetina,
    invKorenje,
    invKrompir,
    invKruh,
    invKruhoveDrobtine,
    invLimone,
    invMaslo,
    invMocarela,
    invMoka,
    invOljcnoOlje,
    invPanceta,
    invParadiznik,
    invParadiznikovaOmaka,
    invPenneTestenine,
    invPeprikaChili,
    invPivskoTesto,
    invRimskiOhrovt,
    invSladkor,
    invSmetana,
    invSolata,
    invZelje,
    invZrezki,
    invZrezkiRezanci,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- PREDJEDI ---
  const cezarjevaSolata = mi('Cezarjeva solata')
  if (cezarjevaSolata) {
    recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invRimskiOhrovt.id, quantityPerServing: 2, unit: 'servings', notes: '200g rimskega ohrovta' })
    recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Parmezan' })
    recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invKruh.id, quantityPerServing: 2, unit: 'servings', notes: 'Krutoni' })
    recipes.push({ menuItemName: 'Cezarjeva solata', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Preliv' })
  }
  const bruschetta = mi('Bruschetta')
  if (bruschetta) {
    recipes.push({ menuItemName: 'Bruschetta', ingredientId: invKruh.id, quantityPerServing: 3, unit: 'servings', notes: '3 rezine kruha' })
    recipes.push({ menuItemName: 'Bruschetta', ingredientId: invParadiznik.id, quantityPerServing: 2, unit: 'servings', notes: '200g paradižnika' })
    recipes.push({ menuItemName: 'Bruschetta', ingredientId: invBazilika.id, quantityPerServing: 2, unit: 'servings', notes: 'Bazilika' })
    recipes.push({ menuItemName: 'Bruschetta', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Oljčno olje' })
    recipes.push({ menuItemName: 'Bruschetta', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
  }
  const vijolicniZavitki = mi('Vijolični zavitki')
  if (vijolicniZavitki) {
    recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invPivskoTesto.id, quantityPerServing: 1, unit: 'servings', notes: '100g testa' })
    recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invZelje.id, quantityPerServing: 1, unit: 'servings', notes: 'Zelenjavno polnilo' })
    recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invKorenje.id, quantityPerServing: 1, unit: 'servings', notes: 'Korenje' })
    recipes.push({ menuItemName: 'Vijolični zavitki', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Cvrtje + preliv' })
  }
  const juhaDneva = mi('Juha dneva')
  if (juhaDneva) {
    recipes.push({ menuItemName: 'Juha dneva', ingredientId: invGovejaJuha.id, quantityPerServing: 1, unit: 'servings', notes: '0.50L jušne osnove' })
    recipes.push({ menuItemName: 'Juha dneva', ingredientId: invZrezkiRezanci.id, quantityPerServing: 1, unit: 'servings', notes: 'Rezanci' })
  }

  // --- JUHE ---
  const govejaJuha = mi('Goveja juha')
  if (govejaJuha) {
    recipes.push({ menuItemName: 'Goveja juha', ingredientId: invGovejaJuha.id, quantityPerServing: 1, unit: 'servings', notes: '0.50L jušne osnove' })
    recipes.push({ menuItemName: 'Goveja juha', ingredientId: invZrezkiRezanci.id, quantityPerServing: 1, unit: 'servings', notes: '100g rezancev' })
    recipes.push({ menuItemName: 'Goveja juha', ingredientId: invKorenje.id, quantityPerServing: 1, unit: 'servings', notes: 'Zelenjava' })
  }
  const paradiznikovaJuha = mi('Paradižnikova juha')
  if (paradiznikovaJuha) {
    recipes.push({ menuItemName: 'Paradižnikova juha', ingredientId: invParadiznik.id, quantityPerServing: 3, unit: 'servings', notes: '300g paradižnika' })
    recipes.push({ menuItemName: 'Paradižnikova juha', ingredientId: invBazilika.id, quantityPerServing: 1, unit: 'servings', notes: 'Bazilika' })
    recipes.push({ menuItemName: 'Paradižnikova juha', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Sir za posip' })
  }
  const gobovaJuha = mi('Gobicna juha')
  if (gobovaJuha) {
    recipes.push({ menuItemName: 'Gobicna juha', ingredientId: invGobe.id, quantityPerServing: 3, unit: 'servings', notes: '300g gob' })
    recipes.push({ menuItemName: 'Gobicna juha', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Truški' })
    recipes.push({ menuItemName: 'Gobicna juha', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
  }

  // --- GLAVNE JEDI ---
  const zarLosos = mi('Žar losos')
  if (zarLosos) {
    recipes.push({ menuItemName: 'Žar losos', ingredientId: invLimone.id, quantityPerServing: 3, unit: 'servings', notes: 'Limona + maslo' })
    recipes.push({ menuItemName: 'Žar losos', ingredientId: invMaslo.id, quantityPerServing: 2, unit: 'servings', notes: 'Maslo za omako' })
    recipes.push({ menuItemName: 'Žar losos', ingredientId: invKrompir.id, quantityPerServing: 1, unit: 'servings', notes: 'Priloga' })
  }
  const ribeyeZrezek = mi('Ribeye zrezek')
  if (ribeyeZrezek) {
    recipes.push({ menuItemName: 'Ribeye zrezek', ingredientId: invOljcnoOlje.id, quantityPerServing: 2, unit: 'servings', notes: 'Za peko' })
    recipes.push({ menuItemName: 'Ribeye zrezek', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
    recipes.push({ menuItemName: 'Ribeye zrezek', ingredientId: invMaslo.id, quantityPerServing: 2, unit: 'servings', notes: 'Maslo' })
  }
  const piscanecParmezan = mi('Piščanec parmezan')
  if (piscanecParmezan) {
    recipes.push({ menuItemName: 'Piščanec parmezan', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Mocarela za posip' })
    recipes.push({ menuItemName: 'Piščanec parmezan', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Piščanec parmezan', ingredientId: invKruhoveDrobtine.id, quantityPerServing: 2, unit: 'servings', notes: 'Paniranje' })
  }
  const janjeciKotleti = mi('Janječji kotleti')
  if (janjeciKotleti) {
    recipes.push({ menuItemName: 'Janječji kotleti', ingredientId: invJanjetina.id, quantityPerServing: 1, unit: 'servings', notes: '250g janjetine' })
    recipes.push({ menuItemName: 'Janječji kotleti', ingredientId: invOljcnoOlje.id, quantityPerServing: 1, unit: 'servings', notes: 'Za peko' })
    recipes.push({ menuItemName: 'Janječji kotleti', ingredientId: invCesn.id, quantityPerServing: 1, unit: 'servings', notes: 'Česen' })
  }

  // --- TESTENINE ---
  const spagetiKarbonara = mi('Špageti karbonara')
  if (spagetiKarbonara) {
    recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invZrezki.id, quantityPerServing: 1, unit: 'servings', notes: '100g špagetov' })
    recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invPanceta.id, quantityPerServing: 1, unit: 'servings', notes: '65g pancete' })
    recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invJajca.id, quantityPerServing: 2, unit: 'servings', notes: '2 jajci' })
    recipes.push({ menuItemName: 'Špageti karbonara', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Parmezan' })
  }
  const fettuccineAlfredo = mi('Fettuccine alfredo')
  if (fettuccineAlfredo) {
    recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invFettuccine.id, quantityPerServing: 1, unit: 'servings', notes: '100g testenin' })
    recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invBechamel.id, quantityPerServing: 1, unit: 'servings', notes: '0.10L béchamel' })
    recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invMaslo.id, quantityPerServing: 1, unit: 'servings', notes: 'Maslo' })
    recipes.push({ menuItemName: 'Fettuccine alfredo', ingredientId: invMocarela.id, quantityPerServing: 0.5, unit: 'servings', notes: 'Parmezan' })
  }
  const penneArrabbiata = mi('Penne arrabbiata')
  if (penneArrabbiata) {
    recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invPenneTestenine.id, quantityPerServing: 1, unit: 'servings', notes: '100g penne' })
    recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invCesn.id, quantityPerServing: 2, unit: 'servings', notes: 'Česen' })
    recipes.push({ menuItemName: 'Penne arrabbiata', ingredientId: invPeprikaChili.id, quantityPerServing: 2, unit: 'servings', notes: 'Chili' })
  }
  const lazanja = mi('Lazanja')
  if (lazanja) {
    recipes.push({ menuItemName: 'Lazanja', ingredientId: invPenneTestenine.id, quantityPerServing: 1, unit: 'servings', notes: 'Testenine za lazanzo' })
    recipes.push({ menuItemName: 'Lazanja', ingredientId: invGovedinaMleta.id, quantityPerServing: 1, unit: 'servings', notes: '200g mlete govedine' })
    recipes.push({ menuItemName: 'Lazanja', ingredientId: invParadiznikovaOmaka.id, quantityPerServing: 1, unit: 'servings', notes: 'Paradižnikova omaka' })
    recipes.push({ menuItemName: 'Lazanja', ingredientId: invBechamel.id, quantityPerServing: 1, unit: 'servings', notes: 'Béchamel' })
    recipes.push({ menuItemName: 'Lazanja', ingredientId: invMocarela.id, quantityPerServing: 1, unit: 'servings', notes: 'Sir za posip' })
  }

  return recipes
}
