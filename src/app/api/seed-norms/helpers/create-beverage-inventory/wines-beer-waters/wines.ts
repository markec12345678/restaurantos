// Penine in vina
import { db } from '@/lib/db'
import type { InvItem } from '../../types'

export async function createWines(): Promise<Record<string, InvItem>> {
    // --- VINA - za točenje po kozarcih ---
    const invPeninaZaTocenje = await db.inventoryItem.create({ data: { name: 'Penina za točenje (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Vinoteka', category: 'beverages', servingsPerUnit: 7, servingSize: '0.10L', costPerServing: 1.71 } })

    // --- PENINE IN ŠAMPANJCI ---
    const invNo1Brut = await db.inventoryItem.create({ data: { name: 'No.1 Brut (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Istenič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invSlapsakBrutReserve = await db.inventoryItem.create({ data: { name: 'Domaine Slapšak Brut Reserve (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Slapšak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invSlapsakBrutRose = await db.inventoryItem.create({ data: { name: 'Domaine Slapšak Brut Rosé (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Slapšak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invGourmetRose = await db.inventoryItem.create({ data: { name: 'Penina Gourmet Rosé (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Istenič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invZlataRadgonska = await db.inventoryItem.create({ data: { name: 'Zlata Radgonska Penina Brut Selection (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Radgonske gorice', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 18.00 } })
    const invMariaBrut = await db.inventoryItem.create({ data: { name: 'Maria Brut 2020 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 19.00, supplier: 'Kerin', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 19.00 } })
    const invBoemmeRumeniMuskat = await db.inventoryItem.create({ data: { name: 'Penina Boemme Rumeni Muškat (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 19.00, supplier: 'Emino', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 19.00 } })
    const invBjanaBrut = await db.inventoryItem.create({ data: { name: 'Bjana Brut (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 30.00, supplier: 'Bjana', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 30.00 } })
    const invMufiPetNat = await db.inventoryItem.create({ data: { name: 'Mufi Pet Nat Brut Nature 2023 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 19.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 19.00 } })
    const invLouisRoederer = await db.inventoryItem.create({ data: { name: 'Champagne Louis Roederer Collection 244 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Roederer', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invPolRoger = await db.inventoryItem.create({ data: { name: 'Champagne Pol Roger Brut Reserve (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Pol Roger', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invMoetChandon = await db.inventoryItem.create({ data: { name: 'Moët & Chandon Imperial Brut (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 58.00, supplier: 'Moët', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 58.00 } })
    const invDomPerignon = await db.inventoryItem.create({ data: { name: 'Dom Pérignon Brut 2013 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 220.00, supplier: 'Dom Pérignon', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 220.00 } })

    // --- BELA VINA ---
    const invCuveeEmino = await db.inventoryItem.create({ data: { name: 'Cuvee Emino 2022 (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Emino', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 1.71 } })
    const invChardonnayVerus = await db.inventoryItem.create({ data: { name: 'Chardonnay Verus 2023 (0.75L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 20.00, supplier: 'Verus', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invSauvignonCru = await db.inventoryItem.create({ data: { name: 'Sauvignon Blanc Cru Veliki Vrh 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Brodnjak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invLaskiRizling = await db.inventoryItem.create({ data: { name: 'Laški Rizling 2021 (0.75L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 20.00, supplier: 'Colnar', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invTraminec = await db.inventoryItem.create({ data: { name: 'Traminec 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invRebula = await db.inventoryItem.create({ data: { name: 'Rebula 2022 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Blažič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invChardonnayDular = await db.inventoryItem.create({ data: { name: 'Chardonnay Dular 2022 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invChardonnayVicomte = await db.inventoryItem.create({ data: { name: 'Chardonnay Domaine Vicomte de Noue 2020 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 70.00, supplier: 'Marinčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 70.00 } })
    const invSiponVerus = await db.inventoryItem.create({ data: { name: 'Šipon Verus 2022 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Verus', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invSiviPinotJamertal = await db.inventoryItem.create({ data: { name: 'Sivi Pinot Jamertal 2021 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Valdhuber', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invRenskiRizlingStare = await db.inventoryItem.create({ data: { name: 'Renski Rizling Stare Trte 2015 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Dveri-Pax', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invRenskiRizlingKeltis = await db.inventoryItem.create({ data: { name: 'Renski Rizling Keltis 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invAlter = await db.inventoryItem.create({ data: { name: 'Alter 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 24.00, supplier: 'Šumenjak', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 24.00 } })
    const invMalvazijaMovia = await db.inventoryItem.create({ data: { name: 'Malvazija Malval Movia 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Movia', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 20.00 } })
    const invRebulaCru = await db.inventoryItem.create({ data: { name: 'Rebula Cru Selection 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 32.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 32.00 } })
    const invBurjaBela = await db.inventoryItem.create({ data: { name: 'Burja Bela 2022 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 23.00, supplier: 'Burja', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 23.00 } })
    const invAngelBelo2021 = await db.inventoryItem.create({ data: { name: 'Angel Belo Grande Cuvee 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 38.00, supplier: 'Batič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 38.00 } })
    const invAngelBelo2019 = await db.inventoryItem.create({ data: { name: 'Angel Belo Grande Cuvee 2019 (3.00L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 150.00, supplier: 'Batič', category: 'wine', servingsPerUnit: 1, servingSize: '3.00L', costPerServing: 150.00 } })
    const invRumeniMuskat = await db.inventoryItem.create({ data: { name: 'Rumeni Muškat 2023 (0.75L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 17.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 2.43 } })
    const invRumeniMuskatPozna = await db.inventoryItem.create({ data: { name: 'Rumeni Muškat Pozna Trgatev 2019 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Prus', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 3.14 } })
    const invBelaFrankinja = await db.inventoryItem.create({ data: { name: 'Bela Frankinja 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 2.86 } })

    // --- ROSÉ VINA ---
    const invRoseBatic = await db.inventoryItem.create({ data: { name: 'Rosé Batič 2024 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Batič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 25.00 } })
    const invRoseVerstovsek = await db.inventoryItem.create({ data: { name: 'Rosé Verstovšek Estate 2024 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Verstovšek', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 2.86 } })

    // --- RDEČA VINA ---
    const invModraFrankinjaEmino = await db.inventoryItem.create({ data: { name: 'Modra Frankinja Emino 2023 (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Emino', category: 'wine', servingsPerUnit: 7, servingSize: '0.10L kozarec', costPerServing: 1.71 } })
    const invModraFrankinjaDular = await db.inventoryItem.create({ data: { name: 'Modra Frankinja Dular 2023 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 17.00, supplier: 'Dular', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invModraFrankinjaLuna = await db.inventoryItem.create({ data: { name: 'Modra Frankinja Luna 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 38.00, supplier: 'Kobal', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 38.00 } })
    const invModriPinotVerus = await db.inventoryItem.create({ data: { name: 'Modri Pinot Verus 2019 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Verus', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 22.00 } })
    const invModriPinotOpoka = await db.inventoryItem.create({ data: { name: 'Modri Pinot Opoka 2020 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 55.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 55.00 } })
    const invMerlotKeltis = await db.inventoryItem.create({ data: { name: 'Merlot Keltis 2018 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 28.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invMerlotOpoka = await db.inventoryItem.create({ data: { name: 'Merlot Opoka 2019 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invCabernetKeltis = await db.inventoryItem.create({ data: { name: 'Cabernet Sauvignon Keltis 2018 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 28.00, supplier: 'Keltis', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invCabernetPavo = await db.inventoryItem.create({ data: { name: 'Cabernet Sauvignon Pavo Limited Edition 2021 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 50.00, supplier: 'Kristančič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 50.00 } })
    const invGuerilaRetro = await db.inventoryItem.create({ data: { name: 'Guerila Retro Selection 2020 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Guerila', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invDuetEdiSimcic = await db.inventoryItem.create({ data: { name: 'Duet Edi Simčič 2021 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 36.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 36.00 } })
    const invDuetLex2018 = await db.inventoryItem.create({ data: { name: 'Duet Lex Edi Simčič 2018 (1.50L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 110.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '1.50L', costPerServing: 110.00 } })
    const invDuetLex2020 = await db.inventoryItem.create({ data: { name: 'Duet Lex Edi Simčič 2020 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 55.00, supplier: 'Simčič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 55.00 } })
    const invCarolinaRdeca = await db.inventoryItem.create({ data: { name: 'Carolina Rdeča 2018 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 40.00, supplier: 'Jakončič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 40.00 } })
    const invVelikoRdeceMovia = await db.inventoryItem.create({ data: { name: 'Veliko Rdeče Movia 2015 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 52.00, supplier: 'Movia', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 52.00 } })

    // --- TUJA VINA ---
    const invPosipTerraMadre = await db.inventoryItem.create({ data: { name: 'Pošip Premium Terra Madre 2021 (0.75L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 17.00, supplier: 'Terra Madre', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invAndreisVinasmora = await db.inventoryItem.create({ data: { name: 'Andreis Vinasmora 2020 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 17.00, supplier: 'Babič', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invPlavacMali = await db.inventoryItem.create({ data: { name: 'Plavac Mali Premium Terra Madre 2017 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Terra Madre', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 28.00 } })
    const invVranecInstinct = await db.inventoryItem.create({ data: { name: 'Vranec Instinct 2019 (0.75L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 17.00, supplier: 'Puklavec', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 17.00 } })
    const invJermannDreams = await db.inventoryItem.create({ data: { name: 'Chardonnay Where Dreams Have No End 2021 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Jermann', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })
    const invVintageTunina = await db.inventoryItem.create({ data: { name: 'Vintage Tunina 2022 (0.75L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 65.00, supplier: 'Jermann', category: 'wine', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 65.00 } })

    // --- LIKERSKO VINO ---
    const invKerosBelo = await db.inventoryItem.create({ data: { name: 'Keros Belo 2020 (0.50L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 25.00, supplier: 'Kerin', category: 'wine', servingsPerUnit: 10, servingSize: '0.05L', costPerServing: 2.50 } })
    const invKerosRdece = await db.inventoryItem.create({ data: { name: 'Keros Rdeče 2018 (0.50L)', unit: 'steklenica', quantity: 4, minQuantity: 1, costPerUnit: 25.00, supplier: 'Kerin', category: 'wine', servingsPerUnit: 10, servingSize: '0.05L', costPerServing: 2.50 } })
    const invVelikoRdece2012 = await db.inventoryItem.create({ data: { name: 'Veliko Rdeče Movia 2012 (3.00L)', unit: 'steklenica', quantity: 1, minQuantity: 0, costPerUnit: 200.00, supplier: 'Movia', category: 'wine', servingsPerUnit: 1, servingSize: '3.00L', costPerServing: 200.00 } })
    const invSladkiRefosk = await db.inventoryItem.create({ data: { name: 'Sladki Refošk (0.50L)', unit: 'steklenica', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Vina Koper', category: 'wine', servingsPerUnit: 5, servingSize: '0.10L', costPerServing: 2.80 } })

    return {
      invPeninaZaTocenje,
      invNo1Brut, invSlapsakBrutReserve, invSlapsakBrutRose, invGourmetRose,
      invZlataRadgonska, invMariaBrut, invBoemmeRumeniMuskat, invBjanaBrut,
      invMufiPetNat, invLouisRoederer, invPolRoger, invMoetChandon, invDomPerignon,
      invCuveeEmino, invChardonnayVerus, invSauvignonCru, invLaskiRizling,
      invTraminec, invRebula, invChardonnayDular, invChardonnayVicomte,
      invSiponVerus, invSiviPinotJamertal, invRenskiRizlingStare, invRenskiRizlingKeltis,
      invAlter, invMalvazijaMovia, invRebulaCru, invBurjaBela,
      invAngelBelo2021, invAngelBelo2019, invRumeniMuskat, invRumeniMuskatPozna, invBelaFrankinja,
      invRoseBatic, invRoseVerstovsek,
      invModraFrankinjaEmino, invModraFrankinjaDular, invModraFrankinjaLuna,
      invModriPinotVerus, invModriPinotOpoka, invMerlotKeltis, invMerlotOpoka,
      invCabernetKeltis, invCabernetPavo, invGuerilaRetro,
      invDuetEdiSimcic, invDuetLex2018, invDuetLex2020, invCarolinaRdeca, invVelikoRdeceMovia,
      invPosipTerraMadre, invAndreisVinasmora, invPlavacMali, invVranecInstinct,
      invJermannDreams, invVintageTunina,
      invKerosBelo, invKerosRdece, invVelikoRdece2012, invSladkiRefosk,
    }
}
