// =====================================================================
// USTVARJANJE INVENTARNIH POSTAVK - Siri, mlečni, testenine, zelinjava
// =====================================================================

import { db } from '@/lib/db'

export async function createDairyProduceInventory() {
  // --- SIRI ---
  const invMozzarella = await db.inventoryItem.create({ data: { name: 'Mozzarella (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mlekarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
  const invParmezan = await db.inventoryItem.create({ data: { name: 'Parmezan Grana Padano (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.40 } })
  const invFetaSir = await db.inventoryItem.create({ data: { name: 'Feta sir (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
  const invKozjiSir = await db.inventoryItem.create({ data: { name: 'Kozji sir (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 2.00 } })
  const invEdamec = await db.inventoryItem.create({ data: { name: 'Edamec (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
  const invGauda = await db.inventoryItem.create({ data: { name: 'Gauda (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
  const invSiroviStrukelj = await db.inventoryItem.create({ data: { name: 'Sirovi štrukelj (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 2.50, supplier: 'Pekarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 2.50 } })

  // --- MLEČNI IZDELKI ---
  const invKislaSmetana = await db.inventoryItem.create({ data: { name: 'Kisla smetana (0.20L)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 0.80, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 0.80 } })
  const invSladkaSmetana = await db.inventoryItem.create({ data: { name: 'Sladka smetana za kuhanje (0.20L)', unit: 'kos', quantity: 15, minQuantity: 5, costPerUnit: 1.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.00 } })

  // --- TESTENINE IN RIŽ ---
  const invSpageti = await db.inventoryItem.create({ data: { name: 'Špageti (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 2.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })
  const invRezanci = await db.inventoryItem.create({ data: { name: 'Široki rezanci (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.50 } })
  const invNjoki = await db.inventoryItem.create({ data: { name: 'Njoki (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
  const invRizeviRezanci = await db.inventoryItem.create({ data: { name: 'Riževi rezanci (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 4.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.80 } })

  // --- ZELINJAVA ---
  const invPommesFrites = await db.inventoryItem.create({ data: { name: 'Pommes frites zamrznjeni (2.5kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'produce', location: 'zamrzovalnik', servingsPerUnit: 5, servingSize: '500g', costPerServing: 1.25 } })
  const invSampinjoni = await db.inventoryItem.create({ data: { name: 'Sveži šampinjoni (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.80 } })
  const invMešanaZelenjava = await db.inventoryItem.create({ data: { name: 'Mešana zelenjava (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 0.75 } })
  const invCesen = await db.inventoryItem.create({ data: { name: 'Česen (0.5kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Green Valley', category: 'produce', location: 'skladišče', servingsPerUnit: 50, servingSize: '10g', costPerServing: 0.12 } })
  const invBucke = await db.inventoryItem.create({ data: { name: 'Bučke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
  const invMelancani = await db.inventoryItem.create({ data: { name: 'Melancani (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
  const invRukola = await db.inventoryItem.create({ data: { name: 'Rukola (0.2kg)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '50g', costPerServing: 0.63 } })
  const invBlitva = await db.inventoryItem.create({ data: { name: 'Blitva (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
  const invFeferoni = await db.inventoryItem.create({ data: { name: 'Feferoni (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'produce', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.30 } })
  const invAnanas = await db.inventoryItem.create({ data: { name: 'Ananas (1kos)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 6, servingSize: '1 rezina', costPerServing: 0.50 } })
  const invRepa = await db.inventoryItem.create({ data: { name: 'Repa (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })

  return {
    invMozzarella, invParmezan, invFetaSir, invKozjiSir, invEdamec,
    invGauda, invSiroviStrukelj, invKislaSmetana, invSladkaSmetana,
    invSpageti, invRezanci, invNjoki, invRizeviRezanci,
    invPommesFrites, invSampinjoni, invMešanaZelenjava, invCesen,
    invBucke, invMelancani, invRukola, invBlitva, invFeferoni,
    invAnanas, invRepa,
  }
}
