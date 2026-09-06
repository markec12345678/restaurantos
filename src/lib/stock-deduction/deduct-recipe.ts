// ============================================
// RECEPTNO RAZKNJIŽEVANJE — Recipe-based deduction
// ============================================
//
// FIX P2 (audit 2026-09-06): Atomic preprečitev negative stock z updateMany
// + WHERE clause (enak pattern kot deduct-direct.ts).
//

import { toNum, round2, multiply, subtract } from '../decimal'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export async function deductRecipeItems(
  tx: TransactionClient,
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

      const previousQty = toNum(invItem.quantity)

      // FIX P2: Atomic preprečitev negative stock z updateMany + WHERE clause.
      const updateResult = await tx.inventoryItem.updateMany({
        where: {
          id: invItem.id,
          quantity: { gte: qtyToDeduct }, // ← atomarni check
        },
        data: {
          quantity: { decrement: qtyToDeduct },
        },
      })

      let actualDeducted = qtyToDeduct
      let newQty: number

      if (updateResult.count === 0) {
        // Ni dovolj zaloge
        actualDeducted = 0
        newQty = previousQty
        result.errors.push({
          inventoryItemId: invItem.id,
          name: invItem.name,
          error: `Premalo zaloge za "${invItem.name}" — na voljo: ${previousQty}, potrebno: ${qtyToDeduct}`,
        })
        result.success = false

        await tx.stockTransaction.create({
          data: {
            inventoryItemId: invItem.id,
            type: 'sale',
            quantity: 0,
            previousQty,
            newQty: previousQty,
            costPerUnit: invItem.costPerUnit,
            totalCost: 0,
            reason: `POSKUS PRODAJE (nezadostna zaloga) - naročilo #${orderNumber}`,
            orderId,
          },
        })
      } else {
        const updatedItem = await tx.inventoryItem.findUnique({
          where: { id: invItem.id },
          select: { quantity: true },
        })
        newQty = toNum(updatedItem?.quantity ?? subtract(previousQty, qtyToDeduct))
        actualDeducted = qtyToDeduct

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
      }

      result.deducted.push({
        inventoryItemId: invItem.id,
        name: invItem.name,
        quantityDeducted: actualDeducted,
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
