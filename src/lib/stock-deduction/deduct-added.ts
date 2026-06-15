// ============================================
// RAZKNJIŽI ZALOGO ZA DODANE ARTIKLE V OBSTOJEČE NAROČILO
// (za add-items — ne preverja inventoryDeducted flaga)
// ============================================

import { db } from '../db'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { deductRecipeItems, deductDirectItem } from './deduct-added-utils'

export async function deductStockForAddedItems(
  orderId: string,
  orderNumber: number,
  items: StockDeductionItem[]
): Promise<StockDeductionResult> {
  const result: StockDeductionResult = {
    success: true,
    deducted: [],
    lowStockAlerts: [],
    errors: [],
  }

  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) {
    result.success = false
    result.errors.push({ error: 'Naročilo ni najdeno' })
    return result
  }

  // Obdelaj vsak artikel (brez preverjanja inventoryDeducted — to so NOVI artikli)
  // FIX BUG-4: Vse odbitke zavij v eno transakcijo — prepreči delno odbito zalogo
  await db.$transaction(async (tx) => {
    for (const item of items) {
      if (item.voided) continue

      // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
      const recipeItems = await tx.recipeItem.findMany({
        where: { menuItemId: item.menuItemId },
      })

      if (recipeItems.length > 0) {
        await deductRecipeItems(tx, item, orderNumber, orderId, result)
      } else {
        // 2. Fallback: direktna 1:1 povezava InventoryItem↔MenuItem
        await deductDirectItem(tx, item, orderNumber, orderId, result)
      }
    }
  })

  return result
}
