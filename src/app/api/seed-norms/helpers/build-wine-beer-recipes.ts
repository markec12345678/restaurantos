// =====================================================================
// GRADNJA RECEPTOV - Vode, sokovi, pivo, vina
// =====================================================================

import type { InvItem, MiFn, RecipeEntry } from './types'

export function buildWineBeerRecipes(inv: Record<string, InvItem>, mi: MiFn): RecipeEntry[] {
  const {
    invAlter,
    invAnanasovSok,
    invAndreisVinasmora,
    invAngelBelo2019,
    invAngelBelo2021,
    invBelaFrankinja,
    invBevogTak,
    invBjanaBrut,
    invBoemmeRumeniMuskat,
    invBubbleTea,
    invBurjaBela,
    invCabernetKeltis,
    invCabernetPavo,
    invCajVrecice,
    invCarolinaRdeca,
    invCedevita,
    invChardonnayDular,
    invChardonnayVerus,
    invChardonnayVicomte,
    invCocaCola,
    invCocaColaZero,
    invCockta,
    invCuveeEmino,
    invDaura,
    invDomPerignon,
    invDuetEdiSimcic,
    invDuetLex2018,
    invDuetLex2020,
    invFanta,
    invFeverTreeMedTonic,
    invFeverTreeRhubarb,
    invFeverTreeTonic,
    invGourmetRose,
    invGuerilaRetro,
    invHalerKeg,
    invHeineken00,
    invJabolcniSok,
    invJagodniSok,
    invJermannDreams,
    invKerosBelo,
    invKerosRdece,
    invLaskiRizling,
    invLaskoKeg,
    invLedeniCaj,
    invLimone,
    invLouisRoederer,
    invMalvazijaMovia,
    invMarelicniSok,
    invMariaBrut,
    invMerlotKeltis,
    invMerlotOpoka,
    invMeta,
    invMineralnaVoda025,
    invMineralnaVoda050,
    invMineralnaVoda100,
    invModraFrankinjaDular,
    invModraFrankinjaEmino,
    invModraFrankinjaLuna,
    invModriPinotOpoka,
    invModriPinotVerus,
    invMoetChandon,
    invMufiPetNat,
    invNaravnaVoda025,
    invNaravnaVoda050,
    invNaravnaVoda100,
    invNo1Brut,
    invPeliconIPAKeg,
    invPeliconWinter,
    invPlavacMali,
    invPolRoger,
    invPomarance,
    invPomarancniSok,
    invPosipTerraMadre,
    invRadenskaFunc,
    invRadlerKeg,
    invRebula,
    invRebulaCru,
    invRedBull,
    invRenskiRizlingKeltis,
    invRenskiRizlingStare,
    invResetFroggy,
    invResetLagerish,
    invResetStout,
    invRibezovSok,
    invRoseBatic,
    invRoseVerstovsek,
    invRumeniMuskat,
    invRumeniMuskatPozna,
    invSauvignonCru,
    invSchweppesBitter,
    invSiponVerus,
    invSiviPinotJamertal,
    invSladkiRefosk,
    invSladkor,
    invSlapsakBrutReserve,
    invSlapsakBrutRose,
    invSprite,
    invTonicWater,
    invTraminec,
    invUnionKeg,
    invVelikoRdece2012,
    invVelikoRdeceMovia,
    invVintageTunina,
    invVodaZOkusom,
    invVranecInstinct,
    invZeleniHaler,
    invZlataRadgonska
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

    // =====================================================================
    // VINSKI RECEPTI - Penine, Bela, Rosé, Rdeča, Tuja, Likerska vina
    // =====================================================================

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
