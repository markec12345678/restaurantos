// =====================================================================
// GRADNJA RECEPTOV - Vina: Penine in bela vina
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../../types'

export function buildPenineBelaRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn,
): RecipeEntry[] {
  const {
    invNo1Brut, invSlapsakBrutReserve, invSlapsakBrutRose, invGourmetRose,
    invZlataRadgonska, invMariaBrut, invBoemmeRumeniMuskat, invBjanaBrut,
    invMufiPetNat, invLouisRoederer, invPolRoger, invMoetChandon, invDomPerignon,
    invCuveeEmino, invRumeniMuskat, invRumeniMuskatPozna, invBelaFrankinja,
    invChardonnayVerus, invSauvignonCru, invLaskiRizling, invTraminec,
    invRebula, invChardonnayDular, invChardonnayVicomte, invSiponVerus,
    invSiviPinotJamertal, invRenskiRizlingStare, invRenskiRizlingKeltis,
    invAlter, invMalvazijaMovia, invRebulaCru, invBurjaBela,
    invAngelBelo2019, invAngelBelo2021,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- PENINE IN ŠAMPANJCI ---
  const penineDrinks: [string, typeof invNo1Brut][] = [
    ['No.1 Brut', invNo1Brut],
    ['Domaine Slapšak Brut Reserve', invSlapsakBrutReserve],
    ['Domaine Slapšak Brut Rosé', invSlapsakBrutRose],
    ['Penina Gourmet Rosé', invGourmetRose],
    ['Zlata Radgonska Penina Brut Selection', invZlataRadgonska],
    ['Maria Brut 2020', invMariaBrut],
    ['Penina Boemme Rumeni Muškat', invBoemmeRumeniMuskat],
    ['Bjana Brut', invBjanaBrut],
    ['Mufi Pet Nat Brut Nature 2023', invMufiPetNat],
    ['Champagne Louis Roederer Collection 244 Brut', invLouisRoederer],
    ['Champagne Pol Roger Brut Reserve', invPolRoger],
    ['Moët & Chandon Imperial Brut', invMoetChandon],
    ['Dom Pérignon Brut 2013', invDomPerignon],
  ]
  for (const [name, invItem] of penineDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
  }

  // --- BELA VINA - KOZARCI ---
  const belaVinaKozarec: [string, typeof invCuveeEmino][] = [
    ['Cuvee Emino 2022 (kozarec)', invCuveeEmino],
    ['Rumeni Muškat 2023 (kozarec)', invRumeniMuskat],
    ['Rumeni Muškat Pozna Trgatev 2019 (kozarec)', invRumeniMuskatPozna],
    ['Bela Frankinja 2023 (kozarec)', invBelaFrankinja],
  ]
  for (const [name, invItem] of belaVinaKozarec) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec 0.10L' })
  }

  // --- BELA VINA - STEKLENICE ---
  const belaVinaSteklenica: [string, typeof invChardonnayVerus][] = [
    ['Cuvee Emino 2022 (steklenica)', invCuveeEmino],
    ['Chardonnay Verus 2023', invChardonnayVerus],
    ['Sauvignon Blanc Cru Veliki Vrh 2023', invSauvignonCru],
    ['Laški Rizling 2021', invLaskiRizling],
    ['Traminec 2023', invTraminec],
    ['Rebula 2022', invRebula],
    ['Chardonnay Dular 2022', invChardonnayDular],
    ['Chardonnay Domaine Vicomte de Noue 2020', invChardonnayVicomte],
    ['Šipon Verus 2022', invSiponVerus],
    ['Sivi Pinot Jamertal 2021', invSiviPinotJamertal],
    ['Renski Rizling Stare Trte 2015', invRenskiRizlingStare],
    ['Renski Rizling Keltis 2021', invRenskiRizlingKeltis],
    ['Alter 2021', invAlter],
    ['Malvazija Malval Movia 2023', invMalvazijaMovia],
    ['Rebula Cru Selection 2021', invRebulaCru],
    ['Burja Bela 2022', invBurjaBela],
    ['Angel Belo Grande Cuvee 2021', invAngelBelo2021],
    ['Angel Belo Grande Cuvee 2019', invAngelBelo2019],
    ['Rumeni Muškat 2023 (steklenica)', invRumeniMuskat],
    ['Rumeni Muškat Pozna Trgatev 2019 (steklenica)', invRumeniMuskatPozna],
    ['Bela Frankinja 2023 (steklenica)', invBelaFrankinja],
  ]
  for (const [name, invItem] of belaVinaSteklenica) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: invItem.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
  }

  return recipes
}
