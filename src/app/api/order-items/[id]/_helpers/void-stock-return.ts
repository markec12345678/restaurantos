// Stock return helpers for voided items

import { db } from '@/lib/db'
import { toNum, isPositive, greaterThan } from '@/lib/decimal'
import { broadcastLowStockAlert } from '@/lib/stock-deduction'

// Vrni zalogo za voidan artikel
export async function returnStockForVoidedItem(
  orderItemId: string,
  menuItemId: string,
  quantity: number,
  menuItemName: string,
  voidReason: string,
  orderId: string,
  employeeId: string | undefined,
) {
  // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
  const recipeItems = await db.recipeItem.findMany({
    where: { menuItemId },
  })

  if (recipeItems.length > 0) {
    const lowStockAlerts: Array<{ inventoryItemId: string; name: string; currentQty: number; minQty: number }> = []

    await db.$transaction(async (tx) => {
      for (const recipe of recipeItems) {
        const qtyToReturn = toNum(greaterThan(recipe.quantityPerServing, 0) ? recipe.quantityPerServing : 0) * quantity

        const updated = await tx.inventoryItem.update({
          where: { id: recipe.inventoryItemId },
          data: { quantity: { increment: qtyToReturn } },
        })
        const previousQty = toNum(updated.quantity) - qtyToReturn
        const newQty = updated.quantity

        await tx.stockTransaction.create({
          data: {
            inventoryItemId: updated.id,
            type: 'return',
            quantity: qtyToReturn,
            previousQty,
            newQty,
            costPerUnit: updated.costPerUnit,
            totalCost: -(qtyToReturn * toNum(updated.costPerUnit)),
            reason: `VOID: ${menuItemName} - ${voidReason}`,
            orderId,
            employeeName: employeeId || '',
          },
        })

        if (!greaterThan(newQty, updated.minQuantity)) {
          lowStockAlerts.push({
            inventoryItemId: updated.id,
            name: updated.name,
            currentQty: toNum(newQty),
            minQty: toNum(updated.minQuantity),
          })
        }
      }
    })

    if (lowStockAlerts.length > 0) {
      broadcastLowStockAlert(lowStockAlerts)
    }
  } else {
    // 2. Fallback: direktna 1:1 povezava InventoryItem ↔ MenuItem
    const inventoryItem = await db.inventoryItem.findFirst({
      where: { menuItemId },
    })

    if (inventoryItem) {
      const unitsPerServing = isPositive(inventoryItem.servingsPerUnit) ? 1 / toNum(inventoryItem.servingsPerUnit) : 1
      const qtyToReturn = Math.round(quantity * unitsPerServing * 10000) / 10000

      await db.$transaction(async (tx) => {
        const updated = await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { quantity: { increment: qtyToReturn } },
        })
        const previousQty = toNum(updated.quantity) - qtyToReturn
        const newQty = updated.quantity

        await tx.stockTransaction.create({
          data: {
            inventoryItemId: inventoryItem.id,
            type: 'return',
            quantity: qtyToReturn,
            previousQty,
            newQty,
            costPerUnit: inventoryItem.costPerUnit,
            totalCost: -(qtyToReturn * toNum(inventoryItem.costPerUnit)),
            reason: `VOID: ${menuItemName} - ${voidReason}`,
            orderId,
            employeeName: employeeId || '',
          },
        })

        if (!greaterThan(newQty, inventoryItem.minQuantity)) {
          broadcastLowStockAlert([{
            inventoryItemId: inventoryItem.id,
            name: inventoryItem.name,
            currentQty: toNum(newQty),
            minQty: toNum(inventoryItem.minQuantity),
          }])
        }
      })
    }
  }
}
