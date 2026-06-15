// ============================================
// RECEPTNO RAZKNJIŽEVANJE — Recipe-based deduction
// ============================================

import { toNum, round2, multiply, add } from '../decimal'
import type { StockDeductionItem, StockDeductionResult } from './types'

export async function deductRecipeItems(
  tx: Omit<import('@prisma/client').PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  items: StockDeductionItem[],
  orderId: string,
  orderNumber: number,
  result: StockDeductionResult
): Promise<Set<number>> {
  const handledIndices = new Set<number>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.voided) continue

    const recipeItems = await tx.recipeItem.findMany({
      where: { menuItemId: item.menuItemId },
    })

    if (recipeItems.length === 0) continue
    handledIndices.add(i)

    for (const recipe of recipeItems) {
      const qtyToDeduct = toNum(multiply(recipe.quantityPerServing, item.quantity))

      const invItem = await tx.inventoryItem.findUnique({
        where: { id: recipe.inventoryItemId },
      })

      if (!invItem) {
        result.errors.push({
          inventoryItemId: recipe.inventoryItemId,
          error: `Sestavina ${recipe.inventoryItemId} ni najdena`,
        })
        continue
      }

      const updatedItem = await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: { quantity: { decrement: qtyToDeduct } },
      })
      const previousQty = toNum(add(updatedItem.quantity, qtyToDeduct))
      let newQty = toNum(updatedItem.quantity)

      let actualDeducted = qtyToDeduct
      if (newQty < 0) {
        actualDeducted = round2(add(qtyToDeduct, newQty))
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
        quantityDeducted: qtyToDeduct,
        previousQty,
        newQty,
        method: 'recipe',
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
  }

  return handledIndices
}
