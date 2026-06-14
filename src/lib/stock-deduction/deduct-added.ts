// ============================================
// RAZKNJIŽI ZALOGO ZA DODANE ARTIKLE V OBSTOJEČE NAROČILO
// (za add-items — ne preverja inventoryDeducted flaga)
// ============================================

import { db } from '../db'
import { toNum, round2, multiply, add } from '../decimal'
import type { StockDeductionItem, StockDeductionResult } from './types'

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
        for (const recipe of recipeItems) {
          const qtyToDeduct = toNum(multiply(recipe.quantityPerServing, item.quantity))

          // Read inside transaction to get current value
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

          // Atomic decrement
          const updatedItem = await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { decrement: qtyToDeduct } },
          })
          const previousQty = toNum(add(updatedItem.quantity, qtyToDeduct))
          let newQty = toNum(updatedItem.quantity)

          // FIX MEDIUM: Clamp to 0 if negative — pravilno zabeleži dejansko odbito količino
          let actualDeducted = qtyToDeduct
          if (newQty < 0) {
            actualDeducted = round2(add(qtyToDeduct, newQty)) // newQty je negativno
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
              totalCost: round2(multiply(-actualDeducted, invItem.costPerUnit)),
              reason: `Dodano k naročilu #${orderNumber}`,
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
      } else {
        // 2. Fallback: direktna 1:1 povezava InventoryItem↔MenuItem
        const invItem = await tx.inventoryItem.findFirst({
          where: { menuItemId: item.menuItemId },
        })

        if (!invItem || toNum(invItem.servingsPerUnit) <= 0) continue

        const unitsPerServing = 1 / toNum(invItem.servingsPerUnit)
        const totalUnitsToDeduct = Math.round(item.quantity * unitsPerServing * 10000) / 10000

        // Atomic decrement
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
            totalCost: round2(multiply(-actualDeducted, invItem.costPerUnit)),
            reason: `Dodano k naročilu #${orderNumber}`,
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
    }
  })

  return result
}
