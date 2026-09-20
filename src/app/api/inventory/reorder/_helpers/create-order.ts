// ============================================
// PAMETNO NAROČANJE ZALOGE — Ustvarjanje naročilnice za POST
// ============================================

import { db } from '@/lib/db'
import { toNum, round2, multiply } from '@/lib/decimal'
import type { ReorderOrderResult } from './types'

export async function createReorderOrder(
  items: Array<{ inventoryItemId: string; quantity: number; costPerUnit: number }>,
  employeeName: string,
  // FIX R85-4c M7: tenant scope — null (super-admin) = globalno, string = samo ta lokacija
  locationId?: string | null
): Promise<{ results: ReorderOrderResult[]; errors: Array<{ inventoryItemId: string; error: string }> }> {
  const results: ReorderOrderResult[] = []
  const errors: Array<{ inventoryItemId: string; error: string }> = []

  // FIX MEDIUM: Batch query namesto N+1 — pridobi vse artikle naenkrat
  // FIX R85-4c: scope filter — prej globalno ({ id: { in } }) → cross-tenant WRITE
  // (tuji artikel je bil povečan + tuj StockTransaction zapisan). Artikli izven
  // scope-a so "ni najden" (fail-closed, brez razkritja obstoja tuje lokacije).
  const itemIds = items.map(item => item.inventoryItemId)
  const invItems = await db.inventoryItem.findMany({
    where: {
      id: { in: itemIds },
      ...(locationId ? { locationId } : {}),
    },
  })
  const invItemMap = new Map(invItems.map(i => [i.id, i]))

  // Preveri vse artikle pred transakcijo
  for (const item of items) {
    const invItem = invItemMap.get(item.inventoryItemId)
    if (!invItem) {
      errors.push({ inventoryItemId: item.inventoryItemId, error: 'Artikel ni najden' })
    }
  }

  const validItems = items.filter(item => invItemMap.has(item.inventoryItemId))

  await db.$transaction(async (tx) => {
    for (const item of validItems) {
      const invItem = invItemMap.get(item.inventoryItemId)!

      // FIX: Ustvari transakcijo IN posodobi zalogo atomarno — uporabi atomic increment
      const updated = await tx.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: {
          quantity: { increment: item.quantity },
          lastRestocked: new Date(),
        },
      })

      await tx.stockTransaction.create({
        data: {
          inventoryItemId: item.inventoryItemId,
          type: 'procurement',
          quantity: item.quantity,
          previousQty: toNum(updated.quantity) - item.quantity,
          newQty: toNum(updated.quantity),
          costPerUnit: item.costPerUnit,
          totalCost: round2(multiply(item.quantity, item.costPerUnit)),
          reason: `Samodejno naročilo (${employeeName || 'sistem'})`,
          employeeName: employeeName || '',
        },
      })

      results.push({
        inventoryItemId: item.inventoryItemId,
        itemName: invItem.name,
        quantity: item.quantity,
        totalCost: round2(multiply(item.quantity, item.costPerUnit)),
      })
    }
  })

  return { results, errors }
}
