// Mikserji, sadje za garnirje, sirupi, vode, sokovi, pivo, penine in vina
import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createMixersProduceAndSyrups(): Promise<Record<string, InvItem>> {
    // --- MIKSERJI (tonik, soda, cola, itd.) ---
    const invTonicWater = await db.inventoryItem.create({ data: { name: 'Schweppes Tonic Water (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invFeverTreeTonic = await db.inventoryItem.create({ data: { name: 'Fever Tree Tonic Water (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invFeverTreeMedTonic = await db.inventoryItem.create({ data: { name: 'Fever Tree Mediterranean Tonic (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invFeverTreeRhubarb = await db.inventoryItem.create({ data: { name: 'Fever Tree Rhubarb&Raspberry Tonic (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invGingerAle = await db.inventoryItem.create({ data: { name: 'Fever Tree Ginger Ale (0.20L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 1.80, supplier: 'Fever Tree', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.80 } })
    const invSodaVoda = await db.inventoryItem.create({ data: { name: 'Soda voda (0.20L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 0.50, supplier: 'Radenska', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 0.50 } })
    const invCocaCola = await db.inventoryItem.create({ data: { name: 'Coca-Cola (0.25L)', unit: 'kos', quantity: 72, minQuantity: 24, costPerUnit: 1.20, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.20 } })
    const invCocaColaZero = await db.inventoryItem.create({ data: { name: 'Coca-Cola Zero (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.20, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.20 } })
    const invFanta = await db.inventoryItem.create({ data: { name: 'Fanta (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invSprite = await db.inventoryItem.create({ data: { name: 'Sprite (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invCockta = await db.inventoryItem.create({ data: { name: 'Cockta (0.275L)', unit: 'kos', quantity: 36, minQuantity: 12, costPerUnit: 1.00, supplier: 'Cockta', category: 'mixers', servingsPerUnit: 1, servingSize: '0.275L', costPerServing: 1.00 } })
    const invSchweppesBitter = await db.inventoryItem.create({ data: { name: 'Schweppes Bitter Lemon (0.25L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.10, supplier: 'Coca-Cola CPC', category: 'mixers', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invRedBull = await db.inventoryItem.create({ data: { name: 'Red Bull (0.20L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 2.20, supplier: 'Red Bull', category: 'mixers', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 2.20 } })
    const invProsecco = await db.inventoryItem.create({ data: { name: 'Prosecco za koktajle (0.75L)', unit: 'steklenica', quantity: 6, minQuantity: 2, costPerUnit: 10.00, supplier: 'Vinoteka', category: 'beverages', servingsPerUnit: 6, servingSize: '0.12L', costPerServing: 1.67 } })

    // --- SADJE ZA GARNIRJE IN SOKOVE ---
    const invLimone = await db.inventoryItem.create({ data: { name: 'Limone (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 30, servingSize: '1 rezina', costPerServing: 0.10 } })
    const invLimete = await db.inventoryItem.create({ data: { name: 'Limete (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 5.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 30, servingSize: '1 rezina', costPerServing: 0.17 } })
    const invPomarance = await db.inventoryItem.create({ data: { name: 'Pomaranče (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 8, servingSize: '1 pomaranča', costPerServing: 0.31 } })
    const invMeta = await db.inventoryItem.create({ data: { name: 'Sveža meta (šen)', unit: 'šen', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 20, servingSize: '1 vejica', costPerServing: 0.10 } })
    const invRozmarin = await db.inventoryItem.create({ data: { name: 'Svež rožmarin (šen)', unit: 'šen', quantity: 2, minQuantity: 1, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 15, servingSize: '1 vejica', costPerServing: 0.17 } })
    const invBrinoveJagode = await db.inventoryItem.create({ data: { name: 'Brinove jagode (0.1kg)', unit: 'kg', quantity: 0.3, minQuantity: 0.1, costPerUnit: 25.00, supplier: 'Zeliščar', category: 'produce', servingsPerUnit: 30, servingSize: '3 jagode', costPerServing: 0.83 } })
    const invKumara = await db.inventoryItem.create({ data: { name: 'Kumara (1kos)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 1.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 20, servingSize: '1 rezina', costPerServing: 0.05 } })

    // --- MONIN SIRUPI ZA KOKTAJLE ---
    const invMoninMango = await db.inventoryItem.create({ data: { name: 'Monin Mango sirup (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })
    const invMoninJagoda = await db.inventoryItem.create({ data: { name: 'Monin Strawberry sirup (0.70L)', unit: 'steklenica', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })
    const invMoninBezeg = await db.inventoryItem.create({ data: { name: 'Monin Bezgovi sirup (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })
    const invMoninIngver = await db.inventoryItem.create({ data: { name: 'Monin Ginger sirup (0.70L)', unit: 'steklenica', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Monin', category: 'syrups', servingsPerUnit: 23, servingSize: '0.03L', costPerServing: 0.52 } })

    return {
      invTonicWater, invFeverTreeTonic, invFeverTreeMedTonic, invFeverTreeRhubarb,
      invGingerAle, invSodaVoda, invCocaCola, invCocaColaZero, invFanta, invSprite,
      invCockta, invSchweppesBitter, invRedBull, invProsecco,
      invLimone, invLimete, invPomarance, invMeta, invRozmarin, invBrinoveJagode, invKumara,
      invMoninMango, invMoninJagoda, invMoninBezeg, invMoninIngver,
    }
}

export async function createWatersJuicesAndBeer(): Promise<Record<string, InvItem>> {
    // --- VODE ---
    const invMineralnaVoda025 = await db.inventoryItem.create({ data: { name: 'Mineralna voda (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 0.60, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 0.60 } })
    const invMineralnaVoda050 = await db.inventoryItem.create({ data: { name: 'Mineralna voda (0.50L)', unit: 'kos', quantity: 36, minQuantity: 12, costPerUnit: 0.90, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 0.90 } })
    const invMineralnaVoda100 = await db.inventoryItem.create({ data: { name: 'Mineralna voda (1.00L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.30, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '1.00L', costPerServing: 1.30 } })
    const invNaravnaVoda025 = await db.inventoryItem.create({ data: { name: 'Naravna voda (0.25L)', unit: 'kos', quantity: 48, minQuantity: 12, costPerUnit: 0.40, supplier: 'Costella', category: 'beverages', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 0.40 } })
    const invNaravnaVoda050 = await db.inventoryItem.create({ data: { name: 'Naravna voda (0.50L)', unit: 'kos', quantity: 36, minQuantity: 12, costPerUnit: 0.60, supplier: 'Costella', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 0.60 } })
    const invNaravnaVoda100 = await db.inventoryItem.create({ data: { name: 'Naravna voda (1.00L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 0.90, supplier: 'Costella', category: 'beverages', servingsPerUnit: 1, servingSize: '1.00L', costPerServing: 0.90 } })
    const invVodaZOkusom = await db.inventoryItem.create({ data: { name: 'Voda z okusom (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.00, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 1.00 } })
    const invRadenskaFunc = await db.inventoryItem.create({ data: { name: 'Radenska FunctionALL (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Radenska', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 1.20 } })

    // --- SOKOVI ---
    const invMarelicniSok = await db.inventoryItem.create({ data: { name: 'Marelični sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invJabolcniSok = await db.inventoryItem.create({ data: { name: 'Jabolčni sok 100% (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.40, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.40 } })
    const invRibezovSok = await db.inventoryItem.create({ data: { name: 'Ribezov sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invAnanasovSok = await db.inventoryItem.create({ data: { name: 'Ananasov sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invPomarancniSok = await db.inventoryItem.create({ data: { name: 'Pomarančni sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invJagodniSok = await db.inventoryItem.create({ data: { name: 'Jagodni sok (0.20L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.20, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.20 } })
    const invLedeniCaj = await db.inventoryItem.create({ data: { name: 'Ledeni čaj (0.25L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.10, supplier: 'Fructal', category: 'beverages', servingsPerUnit: 1, servingSize: '0.25L', costPerServing: 1.10 } })
    const invCedevita = await db.inventoryItem.create({ data: { name: 'Cedevita (0.30L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.00, supplier: 'Cedevita', category: 'beverages', servingsPerUnit: 1, servingSize: '0.30L', costPerServing: 1.00 } })
    const invBubbleTea = await db.inventoryItem.create({ data: { name: 'Bubble Tea kit (0.36L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.50, supplier: 'Bubble Tea', category: 'beverages', servingsPerUnit: 1, servingSize: '0.36L', costPerServing: 2.50 } })

    // --- TOČENO PIVO (keg) ---
    const invHalerKeg = await db.inventoryItem.create({ data: { name: 'Haler Lager keg (30L)', unit: 'keg', quantity: 2, minQuantity: 1, costPerUnit: 75.00, supplier: 'Haler', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.25 } })
    const invLaskoKeg = await db.inventoryItem.create({ data: { name: 'Laško Lager keg (30L)', unit: 'keg', quantity: 3, minQuantity: 1, costPerUnit: 85.00, supplier: 'Laško', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.42 } })
    const invUnionKeg = await db.inventoryItem.create({ data: { name: 'Union Lager keg (30L)', unit: 'keg', quantity: 2, minQuantity: 1, costPerUnit: 80.00, supplier: 'Union', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.33 } })
    const invPeliconIPAKeg = await db.inventoryItem.create({ data: { name: 'Pelicon IPA keg (20L)', unit: 'keg', quantity: 1, minQuantity: 1, costPerUnit: 90.00, supplier: 'Pelicon', category: 'beverages', servingsPerUnit: 40, servingSize: '0.50L', costPerServing: 2.25 } })
    const invRadlerKeg = await db.inventoryItem.create({ data: { name: 'Radler Grenivka keg (30L)', unit: 'keg', quantity: 1, minQuantity: 1, costPerUnit: 80.00, supplier: 'Union', category: 'beverages', servingsPerUnit: 60, servingSize: '0.50L', costPerServing: 1.33 } })

    // --- PIVO V STEKLENICAH ---
    const invResetLagerish = await db.inventoryItem.create({ data: { name: 'Reset Lagerish Cream Ale (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.50, supplier: 'Reset', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.50 } })
    const invResetFroggy = await db.inventoryItem.create({ data: { name: 'Reset Froggy IPA (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.50, supplier: 'Reset', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.50 } })
    const invResetStout = await db.inventoryItem.create({ data: { name: 'Reset Irish Extra Stout (0.50L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.50, supplier: 'Reset', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.50 } })
    const invPeliconWinter = await db.inventoryItem.create({ data: { name: 'Pelicon Winter (0.75L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 6.50, supplier: 'Pelicon', category: 'beverages', servingsPerUnit: 1, servingSize: '0.75L', costPerServing: 6.50 } })
    const invZeleniHaler = await db.inventoryItem.create({ data: { name: 'Zeleni Haler Lager s Konopljo (0.50L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.80, supplier: 'Haler', category: 'beverages', servingsPerUnit: 1, servingSize: '0.50L', costPerServing: 2.80 } })
    const invBevogTak = await db.inventoryItem.create({ data: { name: 'Bevog Tak Pale Ale (0.33L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 2.20, supplier: 'Bevog', category: 'beverages', servingsPerUnit: 1, servingSize: '0.33L', costPerServing: 2.20 } })
    const invHeineken00 = await db.inventoryItem.create({ data: { name: 'Heineken 0.0 (0.33L)', unit: 'kos', quantity: 24, minQuantity: 6, costPerUnit: 1.80, supplier: 'Heineken', category: 'beverages', servingsPerUnit: 1, servingSize: '0.33L', costPerServing: 1.80 } })
    const invDaura = await db.inventoryItem.create({ data: { name: 'Daura Lager (0.33L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.10, supplier: 'Estrella Damm', category: 'beverages', servingsPerUnit: 1, servingSize: '0.33L', costPerServing: 2.10 } })

    return {
      invMineralnaVoda025, invMineralnaVoda050, invMineralnaVoda100,
      invNaravnaVoda025, invNaravnaVoda050, invNaravnaVoda100,
      invVodaZOkusom, invRadenskaFunc,
      invMarelicniSok, invJabolcniSok, invRibezovSok, invAnanasovSok,
      invPomarancniSok, invJagodniSok, invLedeniCaj, invCedevita, invBubbleTea,
      invHalerKeg, invLaskoKeg, invUnionKeg, invPeliconIPAKeg, invRadlerKeg,
      invResetLagerish, invResetFroggy, invResetStout, invPeliconWinter,
      invZeleniHaler, invBevogTak, invHeineken00, invDaura,
    }
}

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
