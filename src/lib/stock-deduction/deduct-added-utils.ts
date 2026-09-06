// ============================================
// Pomožne funkcije za odbitje zaloge — dodani artikli
// ============================================
//
// FIX P2 (audit 2026-09-06): Atomic preprečitev negative stock z updateMany
// + WHERE clause (enak pattern kot deduct-direct.ts in deduct-recipe.ts).
//

import { toNum, round2, multiply, subtract } from '../decimal'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

// Odbitje za receptne sestavine (RecipeItem)
export async function deductRecipeItems(
  tx: TransactionClient,
  item: StockDeductionItem,
  orderNumber: number,
  orderId: string,
  result: StockDeductionResult,
): Promise<void> {
  const recipeItems = await tx.recipeItem.findMany({
    where: { menuItemId: item.menuItemId },
  })

  if (recipeItems.length === 0) return

  for (const recipe of recipeItems) {
    const qtyToDeduct = toNum(multiply(recipe.quantityPerServing, item.quantity))
    const invItem = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItemId } })

    if (!invItem) {
      result.errors.push({ inventoryItemId: recipe.inventoryItemId, error: `Sestavina ${recipe.inventoryItemId} ni najdena` })
      continue
    }

    const previousQty = toNum(invItem.quantity)

    // FIX P2: Atomic preprečitev negative stock
    const updateResult = await tx.inventoryItem.updateMany({
      where: { id: invItem.id, quantity: { gte: qtyToDeduct } },
      data: { quantity: { decrement: qtyToDeduct } },
    })

    let actualDeducted = qtyToDeduct
    let newQty: number

    if (updateResult.count === 0) {
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
          inventoryItemId: invItem.id, type: 'sale', quantity: 0, previousQty, newQty: previousQty,
          costPerUnit: invItem.costPerUnit, totalCost: 0,
          reason: `POSKUS PRODAJE (nezadostna zaloga) - naročilo #${orderNumber}`, orderId,
        },
      })
    } else {
      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: invItem.id }, select: { quantity: true } })
      newQty = toNum(updatedItem?.quantity ?? subtract(previousQty, qtyToDeduct))
      actualDeducted = qtyToDeduct

      await tx.stockTransaction.create({
        data: {
          inventoryItemId: invItem.id, type: 'sale', quantity: -actualDeducted, previousQty, newQty,
          costPerUnit: invItem.costPerUnit, totalCost: round2(multiply(-actualDeducted, invItem.costPerUnit)),
          reason: `Dodano k naročilu #${orderNumber}`, orderId,
        },
      })
    }

    result.deducted.push({ inventoryItemId: invItem.id, name: invItem.name, quantityDeducted: actualDeducted, previousQty, newQty, method: 'recipe' })

    if (newQty <= toNum(invItem.minQuantity)) {
      result.lowStockAlerts.push({ inventoryItemId: invItem.id, name: invItem.name, currentQty: newQty, minQty: toNum(invItem.minQuantity) })
    }
  }
}

// Odbitje za direktno 1:1 povezavo InventoryItem↔MenuItem
export async function deductDirectItem(
  tx: TransactionClient,
  item: StockDeductionItem,
  orderNumber: number,
  orderId: string,
  result: StockDeductionResult,
): Promise<void> {
  const invItem = await tx.inventoryItem.findFirst({ where: { menuItemId: item.menuItemId } })

  if (!invItem || toNum(invItem.servingsPerUnit) <= 0) return

  const unitsPerServing = 1 / toNum(invItem.servingsPerUnit)
  const totalUnitsToDeduct = Math.round(item.quantity * unitsPerServing * 10000) / 10000

  const previousQty = toNum(invItem.quantity)

  // FIX P2: Atomic preprečitev negative stock
  const updateResult = await tx.inventoryItem.updateMany({
    where: { id: invItem.id, quantity: { gte: totalUnitsToDeduct } },
    data: { quantity: { decrement: totalUnitsToDeduct } },
  })

  let actualDeducted = totalUnitsToDeduct
  let newQty: number

  if (updateResult.count === 0) {
    actualDeducted = 0
    newQty = previousQty
    result.errors.push({
      inventoryItemId: invItem.id,
      name: invItem.name,
      error: `Premalo zaloge za "${invItem.name}" — na voljo: ${previousQty}, potrebno: ${totalUnitsToDeduct}`,
    })
    result.success = false

    await tx.stockTransaction.create({
      data: {
        inventoryItemId: invItem.id, type: 'sale', quantity: 0, previousQty, newQty: previousQty,
        costPerUnit: invItem.costPerUnit, totalCost: 0,
        reason: `POSKUS PRODAJE (nezadostna zaloga) - naročilo #${orderNumber}`, orderId,
      },
    })
  } else {
    const updatedItem = await tx.inventoryItem.findUnique({ where: { id: invItem.id }, select: { quantity: true } })
    newQty = toNum(updatedItem?.quantity ?? subtract(previousQty, totalUnitsToDeduct))
    actualDeducted = totalUnitsToDeduct

    await tx.stockTransaction.create({
      data: {
        inventoryItemId: invItem.id, type: 'sale', quantity: -actualDeducted, previousQty, newQty,
        costPerUnit: invItem.costPerUnit, totalCost: round2(multiply(-actualDeducted, invItem.costPerUnit)),
        reason: `Dodano k naročilu #${orderNumber}`, orderId,
      },
    })
  }

  result.deducted.push({ inventoryItemId: invItem.id, name: invItem.name, quantityDeducted: actualDeducted, previousQty, newQty, method: 'direct' })

  if (newQty <= toNum(invItem.minQuantity)) {
    result.lowStockAlerts.push({ inventoryItemId: invItem.id, name: invItem.name, currentQty: newQty, minQty: toNum(invItem.minQuantity) })
  }
}
