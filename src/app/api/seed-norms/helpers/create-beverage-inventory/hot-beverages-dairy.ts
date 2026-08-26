// Kava, mleko, sladkor in osnovne pijače/sestavine
import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createHotBeveragesAndDairy(): Promise<Record<string, InvItem>> {
    const invKavaZrna = await db.inventoryItem.create({ data: { name: 'Kavna zrna (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 25.00, supplier: 'Kavarna Roast', category: 'beverages', servingsPerUnit: 120, servingSize: '7g', costPerServing: 0.21 } })
    const invKavaBrezKofeina = await db.inventoryItem.create({ data: { name: 'Kava brez kofeina (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 30.00, supplier: 'Kavarna Roast', category: 'beverages', servingsPerUnit: 120, servingSize: '7g', costPerServing: 0.25 } })
    const invKravjeMleko = await db.inventoryItem.create({ data: { name: 'Kravje mleko (1L)', unit: 'L', quantity: 20, minQuantity: 5, costPerUnit: 1.20, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.24 } })
    const invOvsenoMleko = await db.inventoryItem.create({ data: { name: 'Ovseno mleko (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Oatly', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.50 } })
    const invMandljevoMleko = await db.inventoryItem.create({ data: { name: 'Mandljevo mleko (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Alpro', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.60 } })
    const invSojinoMleko = await db.inventoryItem.create({ data: { name: 'Sojino mleko (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 2.20, supplier: 'Alpro', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.44 } })
    const invRizevoMleko = await db.inventoryItem.create({ data: { name: 'Riževo mleko (1L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 2.80, supplier: 'Rice Dream', category: 'dairy', servingsPerUnit: 5, servingSize: '0.20L', costPerServing: 0.56 } })
    const invSmetana = await db.inventoryItem.create({ data: { name: 'Sladka smetana (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 20, servingSize: '0.05L', costPerServing: 0.18 } })
    const invSladkor = await db.inventoryItem.create({ data: { name: 'Sladkor (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 200, servingSize: '5g', costPerServing: 0.01 } })
    const invMed = await db.inventoryItem.create({ data: { name: 'Med (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Kmetija Med', category: 'dry-goods', servingsPerUnit: 100, servingSize: '10g', costPerServing: 0.10 } })
    const invKakav = await db.inventoryItem.create({ data: { name: 'Kakav v prahu (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.24 } })
    const invCokolada = await db.inventoryItem.create({ data: { name: 'Čokolada za vročo čokolado (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 15.00, supplier: 'Gorenjka', category: 'dry-goods', servingsPerUnit: 12, servingSize: '80g', costPerServing: 1.25 } })
    const invCajVrecice = await db.inventoryItem.create({ data: { name: 'Čajne vrečke (100kos)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Čajarna', category: 'beverages', servingsPerUnit: 100, servingSize: '1 vrečka', costPerServing: 0.08 } })
    const invSladoled = await db.inventoryItem.create({ data: { name: 'Vaniljev sladoled (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 6.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 10, servingSize: '0.10L', costPerServing: 0.60 } })

    return { invKavaZrna, invKavaBrezKofeina, invKravjeMleko, invOvsenoMleko, invMandljevoMleko, invSojinoMleko, invRizevoMleko, invSmetana, invSladkor, invMed, invKakav, invCokolada, invCajVrecice, invSladoled }
}
