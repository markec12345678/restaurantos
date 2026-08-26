// Mikserji, sadje za garnirje, sirupi
import { db } from '@/lib/db'
import type { InvItem } from '../../types'

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
