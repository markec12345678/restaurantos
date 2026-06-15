// ============================================
// ODBIJI ZALOGO OB PRODAJI (FIRE naročila)
// Orchestrator — recipe + direct deduction
// ============================================

import { db } from '../db'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { deductRecipeItems } from './deduct-recipe'
import { deductDirectItem } from './deduct-direct'

export async function deductStockForOrder(
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

  // Preveri, da zaloga še NI bila razknjižena
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) {
    result.success = false
    result.errors.push({ error: 'Naročilo ni najdeno' })
    return result
  }

  if (order.inventoryDeducted) {
    // Že razknjiženo — preskoči
    return result
  }

  // Celotno razknjiževanje v eni transakciji — prepreči parcialno stanje
  await db.$transaction(async (tx) => {
    // 1. Recipe-based deduction (vrne indekse obdelanih postavk)
    const recipeHandled = await deductRecipeItems(tx, items, orderId, orderNumber, result)

    // 2. Direct deduction za preostale postavke
    for (let i = 0; i < items.length; i++) {
      if (items[i].voided || recipeHandled.has(i)) continue
      await deductDirectItem(tx, items[i], orderId, orderNumber, result)
    }

    // Označi naročilo kot razknjiženo ZNOTRAJ transakcije — atomarno
    await tx.order.update({
      where: { id: orderId },
      data: { inventoryDeducted: true },
    })
  })

  return result
}
