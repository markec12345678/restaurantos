// =====================================================================
// GRADNJA RECEPTOV - Vina (penine, bela, rosé, rdeča, tuja, likerska)
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from '../types'

export function buildVinaRecipes(
  inv: Record<string, InvItem>,
  mi: MiFn
): RecipeEntry[] {
  const {
    invAlter,
    invAndreisVinasmora,
    invAngelBelo2019,
    invAngelBelo2021,
    invBelaFrankinja,
    invBjanaBrut,
    invBoemmeRumeniMuskat,
    invBurjaBela,
    invCabernetKeltis,
    invCabernetPavo,
    invCarolinaRdeca,
    invChardonnayDular,
    invChardonnayVerus,
    invChardonnayVicomte,
    invCuveeEmino,
    invDuetEdiSimcic,
    invDuetLex2018,
    invDuetLex2020,
    invGourmetRose,
    invGuerilaRetro,
    invJermannDreams,
    invKerosBelo,
    invKerosRdece,
    invLaskiRizling,
    invMalvazijaMovia,
    invMariaBrut,
    invMerlotKeltis,
    invMerlotOpoka,
    invModraFrankinjaDular,
    invModraFrankinjaEmino,
    invModraFrankinjaLuna,
    invModriPinotOpoka,
    invModriPinotVerus,
    invMufiPetNat,
    invNo1Brut,
    invPlavacMali,
    invPosipTerraMadre,
    invRebula,
    invRebulaCru,
    invRenskiRizlingKeltis,
    invRenskiRizlingStare,
    invRoseBatic,
    invRoseVerstovsek,
    invRumeniMuskat,
    invRumeniMuskatPozna,
    invSauvignonCru,
    invSiponVerus,
    invSiviPinotJamertal,
    invSladkiRefosk,
    invSlapsakBrutReserve,
    invSlapsakBrutRose,
    invTraminec,
    invVelikoRdece2012,
    invVelikoRdeceMovia,
    invVintageTunina,
    invVranecInstinct,
    invZlataRadgonska,
    invLouisRoederer,
    invPolRoger,
    invMoetChandon,
    invDomPerignon,
  } = inv

  const recipes: RecipeEntry[] = []

  // --- PENINE IN ŠAMPANJCI (steklenica = 1 serving) ---
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
  for (const [name, inv] of penineDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
  }

  // --- BELA VINA - KOZARCI (1 serving = 0.10L iz steklenice z servingsPerUnit=7) ---
  const belaVinaKozarec: [string, typeof invCuveeEmino][] = [
    ['Cuvee Emino 2022 (kozarec)', invCuveeEmino],
    ['Rumeni Muškat 2023 (kozarec)', invRumeniMuskat],
    ['Rumeni Muškat Pozna Trgatev 2019 (kozarec)', invRumeniMuskatPozna],
    ['Bela Frankinja 2023 (kozarec)', invBelaFrankinja],
  ]
  for (const [name, inv] of belaVinaKozarec) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec 0.10L' })
  }

  // --- BELA VINA - STEKLENICE (1 serving = 1 steklenica) ---
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
  for (const [name, inv] of belaVinaSteklenica) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
  }

  // --- ROSÉ VINA ---
  const roseDrinks: [string, typeof invRoseBatic, number][] = [
    ['Rosé Batič 2024', invRoseBatic, 1],
    ['Rosé Verstovšek Estate 2024 (kozarec)', invRoseVerstovsek, 1],
    ['Rosé Verstovšek Estate 2024 (steklenica)', invRoseVerstovsek, 1],
  ]
  for (const [name, inv, qty] of roseDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: qty, unit: 'servings', notes: name.includes('kozarec') ? '1 kozarec' : '1 steklenica' })
  }

  // --- RDEČA VINA - KOZARCI ---
  const rdecaVinaKozarec: [string, typeof invModraFrankinjaEmino][] = [
    ['Modra Frankinja Emino 2023 (kozarec)', invModraFrankinjaEmino],
  ]
  for (const [name, inv] of rdecaVinaKozarec) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec 0.10L' })
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
  for (const [name, inv] of rdecaVinaSteklenica) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
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
  for (const [name, inv] of tujaVinaDrinks) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica 0.75L' })
  }

  // --- LIKERSKO VINO ---
  const likerskoVinoKozarec: [string, typeof invKerosBelo][] = [
    ['Keros Belo 2020 (0.05L)', invKerosBelo],
    ['Keros Rdeče 2018 (0.05L)', invKerosRdece],
    ['Sladki Refošk (kozarec)', invSladkiRefosk],
  ]
  for (const [name, inv] of likerskoVinoKozarec) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 kozarec' })
  }
  const likerskoVinoStek: [string, typeof invKerosBelo][] = [
    ['Keros Belo 2020 (0.50L)', invKerosBelo],
    ['Keros Rdeče 2018 (0.50L)', invKerosRdece],
    ['Veliko Rdeče Movia 2012', invVelikoRdece2012],
    ['Sladki Refošk (0.50L)', invSladkiRefosk],
  ]
  for (const [name, inv] of likerskoVinoStek) {
    const item = mi(name)
    if (item) recipes.push({ menuItemName: name, ingredientId: inv.id, quantityPerServing: 1, unit: 'servings', notes: '1 steklenica' })
  }

  return recipes
}
