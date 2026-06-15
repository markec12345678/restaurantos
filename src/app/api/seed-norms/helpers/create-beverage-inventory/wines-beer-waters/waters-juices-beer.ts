// Vode, sokovi, pivo
import { db } from '@/lib/db'
import type { InvItem } from '../../types'

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
