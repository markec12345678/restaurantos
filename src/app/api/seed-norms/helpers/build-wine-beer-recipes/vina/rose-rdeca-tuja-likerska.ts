// =====================================================================
// GRADNJA RECEPTOV - Vina: Rosé, rdeča, tuja, likerska
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../../types'

export function buildRoseRdecaTujalikerskaRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn,
): RecipeEntry[] {
  const {
    invRoseBatic, invRoseVerstovsek,
    invModraFrankinjaEmino, invModraFrankinjaDular, invModraFrankinjaLuna,
    invModriPinotVerus, invModriPinotOpoka, invMerlotKeltis, invMerlotOpoka,
    invCabernetKeltis, invCabernetPavo, invGuerilaRetro, invDuetEdiSimcic,
    invDuetLex2018, invDuetLex2020, invCarolinaRdeca, invVelikoRdeceMovia,
    invPosipTerraMadre, invAndreisVinasmora, invPlavacMali, invVranecInstinct,
    invJermannDreams, invVintageTunina,
    invKerosBelo, invKerosRdece, invSladkiRefosk,
    invVelikoRdece2012,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- ROSÉ VINA ---
  const roseDrinks: [string, typeof invRoseBatic, number][] = [
    ['Rosé Batič 2024', invRoseBatic, 1],
    ['Rosé Verstovšek Estate 2024 (kozarec)', invRoseVerstovsek, 1],
    ['Rosé Verstovšek Estate 2024 (steklenica)', invRoseVerstovsek, 1],
  ]
  for (const [name, invItem, qty] of roseDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: qty, unit: 'servings', notes: name.includes('kozarec') ? '1 kozarec' : '1 steklenica' })
  }

  // --- RDEČA VINA - KOZARCI ---
  const rdecaVinaKozarec: [string, typeof invModraFrankinjaEmino][] = [
    ['Modra Frankinja Emino 2023 (kozarec)', invModraFrankinjaEmino],
  ]
  for (const [name, invItem] of rdecaVinaKozarec) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec 0.10L' })
  }

  // --- RDEČA VINA - STEKLENICE ---
  const rdecaVinaSteklenica: [string, typeof invModraFrankinjaDular][] = [
    ['Modra Frankinja Emino 2023 (steklenica)', invModraFrankinjaEmino],
    ['Modra Frankinja Dular 2023', invModraFrankinjaDular],
    ['Modra Frankinja Luna 2021', invModraFrankinjaLuna],
    ['Modri Pinot Verus 2019', invModriPinotVerus],
    ['Modri Pinot Opoka 2020', invModriPinotOpoka],
    ['Merlot Keltis 2018', invMerlotKeltis],
    ['Merlot Opoka 2019', invMerlotOpoka],
    ['Cabernet Sauvignon Keltis 2018', invCabernetKeltis],
    ['Cabernet Sauvignon Pavo Limited Edition 2021', invCabernetPavo],
    ['Guerila Retro Selection 2020', invGuerilaRetro],
    ['Duet Edi Simčič 2021', invDuetEdiSimcic],
    ['Duet Lex Edi Simčič 2018', invDuetLex2018],
    ['Duet Lex Edi Simčič 2020', invDuetLex2020],
    ['Carolina Rdeča 2018', invCarolinaRdeca],
    ['Veliko Rdeče Movia 2015', invVelikoRdeceMovia],
  ]
  for (const [name, invItem] of rdecaVinaSteklenica) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
  }

  // --- TUJA VINA ---
  const tujaVinaDrinks: [string, typeof invPosipTerraMadre][] = [
    ['Pošip Premium Terra Madre 2021', invPosipTerraMadre],
    ['Andreis Vinasmora 2020', invAndreisVinasmora],
    ['Plavac Mali Premium Terra Madre 2017', invPlavacMali],
    ['Vranec Instinct 2019', invVranecInstinct],
    ['Chardonnay Where Dreams Have No End 2021', invJermannDreams],
    ['Vintage Tunina 2022', invVintageTunina],
  ]
  for (const [name, invItem] of tujaVinaDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
  }

  // --- LIKERSKO VINO ---
  const likerskoVinoKozarec: [string, typeof invKerosBelo][] = [
    ['Keros Belo 2020 (0.05L)', invKerosBelo],
    ['Keros Rdeče 2018 (0.05L)', invKerosRdece],
    ['Sladki Refošk (kozarec)', invSladkiRefosk],
  ]
  for (const [name, invItem] of likerskoVinoKozarec) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec' })
  }
  const likerskoVinoStek: [string, typeof invKerosBelo][] = [
    ['Keros Belo 2020 (0.50L)', invKerosBelo],
    ['Keros Rdeče 2018 (0.50L)', invKerosRdece],
    ['Veliko Rdeče Movia 2012', invVelikoRdece2012],
    ['Sladki Refošk (0.50L)', invSladkiRefosk],
  ]
  for (const [name, invItem] of likerskoVinoStek) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
  }

  return recipes
}
