// =====================================================================
// INVENTARNE POSTAVKE - Meso in morski sadeži
// =====================================================================

import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createMeatAndSeafood(): Promise<Record<string, InvItem>> {
    // --- MESO IZ REZANJA (kg) ---
    const invGovejaPecjenka = await db.inventoryItem.create({ data: { name: 'Goveja pečenka (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 18.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })
    const invGovejiFile = await db.inventoryItem.create({ data: { name: 'Goveji file (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 45.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 11.25 } })
    const invSvinjskiKare = await db.inventoryItem.create({ data: { name: 'Svinjski kare (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invSvinjskiVrat = await db.inventoryItem.create({ data: { name: 'Svinjski vrat (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 2.50 } })
    const invPiscancjiFile = await db.inventoryItem.create({ data: { name: 'Piščančji file (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 9.00, supplier: 'Perutnina Ptuj', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.80 } })
    const invMletoSvinjsko = await db.inventoryItem.create({ data: { name: 'Mleto svinjsko meso (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 8.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.60 } })
    const invMletoGoveje = await db.inventoryItem.create({ data: { name: 'Mleto goveje meso (1kg)', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invRozbif = await db.inventoryItem.create({ data: { name: 'Goveji rozbif (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 20.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 5.00 } })
    const invDivjaci = await db.inventoryItem.create({ data: { name: 'Divjačina - golaž meso (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Lovska družina', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 4.40 } })
    const invKlobasa = await db.inventoryItem.create({ data: { name: 'Pikantna klobasa (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 9.00, supplier: 'Klobasarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.80 } })
    const invCevapci = await db.inventoryItem.create({ data: { name: 'Čevapčiči (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 2.50 } })
    const invPleskavica = await db.inventoryItem.create({ data: { name: 'Pleskavica (1kos)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 2.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 2.00 } })
    const invPrsut = await db.inventoryItem.create({ data: { name: 'Pršut kraški (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 30.00, supplier: 'Kraški pršut', category: 'meat', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 1.50 } })
    const invSunka = await db.inventoryItem.create({ data: { name: 'Kuhana šunka (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invSlanina = await db.inventoryItem.create({ data: { name: 'Slanina (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.50 } })
    const invPanceta = await db.inventoryItem.create({ data: { name: 'Panceta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.93 } })
    const invSalama = await db.inventoryItem.create({ data: { name: 'Suha salama (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 11.00, supplier: 'Klobasarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.55 } })
    const invHrenovke = await db.inventoryItem.create({ data: { name: 'Hrenovke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 7.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.70 } })

    // --- RIBE IN MORSKI SADEŽI ---
    const invLosos = await db.inventoryItem.create({ data: { name: 'Lososov file (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 5.00 } })
    const invPstrv = await db.inventoryItem.create({ data: { name: 'Pstrv (1kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 5.00, supplier: 'Ribogojstvo', category: 'seafood', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 5.00 } })
    const invLignji = await db.inventoryItem.create({ data: { name: 'Lignji očiščeni (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 16.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.20 } })
    const invKalamari = await db.inventoryItem.create({ data: { name: 'Kalamari (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.80 } })
    const invTuna = await db.inventoryItem.create({ data: { name: 'Tuna steak (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 5.60 } })
    const invTunaKonzerva = await db.inventoryItem.create({ data: { name: 'Tuna v konzervi (1kos)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'seafood', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 konzerva', costPerServing: 2.50 } })
    const invHobotnica = await db.inventoryItem.create({ data: { name: 'Hobotnica (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 4.00 } })
    const invGamberi = await db.inventoryItem.create({ data: { name: 'Gamberi (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 8, servingSize: '125g', costPerServing: 2.75 } })
    const invMorskiSadezi = await db.inventoryItem.create({ data: { name: 'Mešani morski sadeži (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 18.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })

    return {
      invGovejaPecjenka, invGovejiFile, invSvinjskiKare, invSvinjskiVrat, invPiscancjiFile,
      invMletoSvinjsko, invMletoGoveje, invRozbif, invDivjaci, invKlobasa,
      invCevapci, invPleskavica, invPrsut, invSunka, invSlanina, invPanceta, invSalama, invHrenovke,
      invLosos, invPstrv, invLignji, invKalamari, invTuna, invTunaKonzerva, invHobotnica, invGamberi, invMorskiSadezi,
    }
}
