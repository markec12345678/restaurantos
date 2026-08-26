// =====================================================================
// INVENTARNE POSTAVKE - Siri, testenine in žita
// =====================================================================

import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createDairyAndGrains(): Promise<Record<string, InvItem>> {
    // --- SIRI ---
    const invMozzarella = await db.inventoryItem.create({ data: { name: 'Mozzarella (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 10.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invParmezan = await db.inventoryItem.create({ data: { name: 'Parmezan Grana Padano (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 1.00 } })
    const invGorgonzola = await db.inventoryItem.create({ data: { name: 'Gorgonzola (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 16.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 1.07 } })
    const invFeta = await db.inventoryItem.create({ data: { name: 'Feta sir (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.67 } })
    const invOvcjaSkuta = await db.inventoryItem.create({ data: { name: 'Ovčja skuta (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.93 } })
    const invBrie = await db.inventoryItem.create({ data: { name: 'Brie (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 15.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 12, servingSize: '80g', costPerServing: 1.25 } })
    const invCamembert = await db.inventoryItem.create({ data: { name: 'Camembert (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 3.00 } })
    const invMladiSir = await db.inventoryItem.create({ data: { name: 'Mladi sir za žar (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.50, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 3.50 } })
    const invKislaSmetana = await db.inventoryItem.create({ data: { name: 'Kisla smetana (0.20L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 0.80, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 0.80 } })
    const invSladkaSmetana = await db.inventoryItem.create({ data: { name: 'Sladka smetana za kuho (0.25L)', unit: 'kos', quantity: 8, minQuantity: 2, costPerUnit: 1.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 2, servingSize: '0.125L', costPerServing: 0.50 } })
    const invMascarpone = await db.inventoryItem.create({ data: { name: 'Mascarpone (0.25kg)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 2.50, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 2, servingSize: '125g', costPerServing: 1.25 } })

    // --- TESTENINE IN ŽITA ---
    const invSpageti = await db.inventoryItem.create({ data: { name: 'Špageti (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 2.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })
    const invPeresniki = await db.inventoryItem.create({ data: { name: 'Peresniki (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 3.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invSirokiRezanci = await db.inventoryItem.create({ data: { name: 'Široki rezanci (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 3.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invNjoki = await db.inventoryItem.create({ data: { name: 'Njoki krompirjevi (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invFuzi = await db.inventoryItem.create({ data: { name: 'Fuži (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invZlikrofi = await db.inventoryItem.create({ data: { name: 'Žlikrofi (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 6.00, supplier: 'Žlikrofarna', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 1.50 } })
    const invLazanjaTesto = await db.inventoryItem.create({ data: { name: 'Lazanja testo (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invRiz = await db.inventoryItem.create({ data: { name: 'Riž (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.50 } })
    const invPicaTesto = await db.inventoryItem.create({ data: { name: 'Pica testo (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Pekarna', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 3, servingSize: '330g', costPerServing: 1.00 } })
    const invPolenta = await db.inventoryItem.create({ data: { name: 'Polenta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 8, servingSize: '125g', costPerServing: 0.25 } })
    const invAjdovaKasa = await db.inventoryItem.create({ data: { name: 'Ajdrova kaša (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 6, servingSize: '160g', costPerServing: 0.50 } })

    return {
      invMozzarella, invParmezan, invGorgonzola, invFeta, invOvcjaSkuta, invBrie, invCamembert,
      invMladiSir, invKislaSmetana, invSladkaSmetana, invMascarpone,
      invSpageti, invPeresniki, invSirokiRezanci, invNjoki, invFuzi, invZlikrofi,
      invLazanjaTesto, invRiz, invPicaTesto, invPolenta, invAjdovaKasa,
    }
}
