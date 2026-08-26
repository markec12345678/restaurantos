// ============================================
// DIREKTNO RAZKNJIŽEVANJE — Direct 1:1 deduction fallback
// ============================================

import { toNum, round2, multiply, add } from '../decimal'
import type { StockDeductionItem, StockDeductionResult } from './types'

export async function deductDirectItem(
  tx: Omit<import('@prisma/client').PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  item: StockDeductionItem,
  orderId: string,
  orderNumber: number,
  result: StockDeductionResult
): Promise<void> {
  const invItem = await tx.inventoryItem.findFirst({
    where: { menuItemId: item.menuItemId },
  })

  if (!invItem || toNum(invItem.servingsPerUnit) <= 0) return

  const unitsPerServing = 1 / toNum(invItem.servingsPerUnit)
  const totalUnitsToDeduct = Math.round(item.quantity * unitsPerServing * 10000) / 10000

  const updatedItem = await tx.inventoryItem.update({
    where: { id: invItem.id },
    data: { quantity: { decrement: totalUnitsToDeduct } },
  })
  const previousQty = toNum(add(updatedItem.quantity, totalUnitsToDeduct))
  let newQty = toNum(updatedItem.quantity)

  let actualDeducted = totalUnitsToDeduct
  if (newQty < 0) {
    actualDeducted = round2(add(totalUnitsToDeduct, newQty))
    await tx.inventoryItem.update({ where: { id: invItem.id }, data: { quantity: 0 } })
    newQty = 0
  }

  await tx.stockTransaction.create({
    data: {
      inventoryItemId: invItem.id,
      type: 'sale',
      quantity: -actualDeducted,
      previousQty,
      newQty,
      costPerUnit: invItem.costPerUnit,
      totalCost: round2(multiply(actualDeducted, invItem.costPerUnit)),
      reason: `Prodaja - naročilo #${orderNumber}`,
      orderId,
    },
  })

  result.deducted.push({
    inventoryItemId: invItem.id,
    name: invItem.name,
    quantityDeducted: totalUnitsToDeduct,
    previousQty,
    newQty,
    method: 'direct',
  })

  if (newQty <= toNum(invItem.minQuantity)) {
    result.lowStockAlerts.push({
      inventoryItemId: invItem.id,
      name: invItem.name,
      currentQty: newQty,
      minQty: toNum(invItem.minQuantity),
    })
  }
}
