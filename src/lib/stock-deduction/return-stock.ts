// ============================================
// VRNI ZALOGO OB PREKLICU / STORNU
// ============================================
//
// FIX P1 (audit 2026-09-06): Dodan optional `tx` parameter, da se lahko
// vračanje zaloge kliče ZNOTRAJ outer transakcije (npr. z order.updateMany
// in createAuditLog v eni atomarni transakciji). Če `tx` ni podan,
// odpre svojo lastno transakcijo (backward compat).
//

import { db } from '../db'
import { toNum, round2, multiply, subtract } from '../decimal'
import type { StockDeductionResult } from './types'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export async function returnStockForOrder(
  orderId: string,
  orderNumber: number,
  reason: string,
  tx?: TransactionClient,
): Promise<StockDeductionResult> {
  const result: StockDeductionResult = {
    success: true,
    deducted: [],
    lowStockAlerts: [],
    errors: [],
  }

  const runInside = async (client: TransactionClient) => {
    // Preveri, da je zaloga RAZKNJIČENA pred vračanjem
    const order = await client.order.findUnique({ where: { id: orderId } })
    if (!order || !order.inventoryDeducted) {
      result.success = false
      result.errors.push({ error: 'Zaloga ni bila razknjižena za to naročilo' })
      return
    }

    // FIX CRITICAL: Preveri, če že obstajajo 'return' transakcije za to naročilo
    // ZNOTRAJ transakcije — prepreči sočasen double-return
    const existingReturns = await client.stockTransaction.findFirst({
      where: { orderId, type: 'return' },
    })
    if (existingReturns) {
      result.success = false
      result.errors.push({ error: 'Zaloga za to naročilo je že bila vračana' })
      return
    }

    // Pridobi artikle naročila
    const orderItems = await client.orderItem.findMany({
      where: { orderId, voided: false },
    })

    for (const oi of orderItems) {
      // 1. RecipeItem (večsastavni recepti)
      const recipeItems = await client.recipeItem.findMany({
        where: { menuItemId: oi.menuItemId },
      })

      if (recipeItems.length > 0) {
        for (const recipe of recipeItems) {
          const qtyToReturn = toNum(multiply(recipe.quantityPerServing, oi.quantity))

          const invItem = await client.inventoryItem.findUnique({
            where: { id: recipe.inventoryItemId },
          })

          if (!invItem) continue

          // Atomic increment
          const updatedItem = await client.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { increment: qtyToReturn } },
          })
          const previousQty = toNum(subtract(updatedItem.quantity, qtyToReturn))
          const newQty = toNum(updatedItem.quantity)

          await client.stockTransaction.create({
            data: {
              inventoryItemId: invItem.id,
              type: 'return',
              quantity: qtyToReturn,
              previousQty,
              newQty,
              costPerUnit: invItem.costPerUnit,
              totalCost: round2(multiply(-qtyToReturn, invItem.costPerUnit)),
              reason: `${reason} - naročilo #${orderNumber}`,
              orderId,
            },
          })

          result.deducted.push({
            inventoryItemId: invItem.id,
            name: invItem.name,
            quantityDeducted: qtyToReturn,
            previousQty,
            newQty,
            method: 'recipe',
          })
        }
      } else {
        // 2. Direktna 1:1 povezava
        const invItem = await client.inventoryItem.findFirst({
          where: { menuItemId: oi.menuItemId },
        })

        if (!invItem || toNum(invItem.servingsPerUnit) <= 0) continue

        const unitsPerServing = 1 / toNum(invItem.servingsPerUnit)
        const totalUnitsToReturn = Math.round(oi.quantity * unitsPerServing * 10000) / 10000

        // Atomic increment
        const updatedItem = await client.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { increment: totalUnitsToReturn } },
        })
        const previousQty = toNum(subtract(updatedItem.quantity, totalUnitsToReturn))
        const newQty = toNum(updatedItem.quantity)

        await client.stockTransaction.create({
          data: {
            inventoryItemId: invItem.id,
            type: 'return',
            quantity: totalUnitsToReturn,
            previousQty,
            newQty,
            costPerUnit: invItem.costPerUnit,
            totalCost: round2(multiply(-totalUnitsToReturn, invItem.costPerUnit)),
            reason: `${reason} - naročilo #${orderNumber}`,
            orderId,
          },
        })

        result.deducted.push({
          inventoryItemId: invItem.id,
          name: invItem.name,
          quantityDeducted: totalUnitsToReturn,
          previousQty,
          newQty,
          method: 'direct',
        })
      }
    }
  }

  if (tx) {
    await runInside(tx)
  } else {
    // FIX CRITICAL: Celotno vračanje v eni transakciji — prepreči double-return in parcialno stanje
    // Preverjanje existingReturns ZNOTRAJ transakcije zagotavlja atomarnost
    await db.$transaction(async (innerTx) => {
      await runInside(innerTx)
    })
  }

  // FIX CRITICAL: NE ponastavi inventoryDeducted na false!
  // Če ga ponastavimo, lahko FURS fallback (ki preverja !inventoryDeducted)
  // znova odbije zalogo za že preklicano naročilo — double deduction!
  // Pravilna semantika: inventoryDeducted=true pomeni "zaloga je bila obdelana"
  // (bilo deduct ALI deduct+return). Obdelava je končana.
  // Za zaščito pred double-return: preveri, če že obstajajo 'return' transakcije
  // za to naročilo — če da, ne dovoli ponovnega vračanja.

  return result
}
