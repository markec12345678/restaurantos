// Pomožne funkcije za /api/order-items/[id] route
// Void stock return, order/check recalculation

import { db } from '@/lib/db'
import { toNum, round2, isPositive, greaterThan } from '@/lib/decimal'
import { broadcastLowStockAlert } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'

// Helper za WebSocket broadcast
export async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

// Preračunaj zneske naročila po voidu
export async function recalculateOrderTotals(orderItemId: string, orderId: string) {
  const allItems = await db.orderItem.findMany({
    where: { orderId },
  })

  let newSubtotal = 0
  let newTax = 0
  for (const item of allItems) {
    if (!item.voided) {
      const itemBase = toNum(item.price) * item.quantity
      const itemVat = toNum(item.vatAmount) > 0 ? toNum(item.vatAmount) : (itemBase * toNum(item.vatRate) / 100)
      newSubtotal += itemBase
      newTax += itemVat
    }
  }

  const order = await db.order.findUnique({ where: { id: orderId } })
  const discount = toNum(order?.discount)
  const cappedDiscount = Math.min(discount, newSubtotal)
  const newTotal = newSubtotal + newTax - cappedDiscount

  await db.order.update({
    where: { id: orderId },
    data: {
      subtotal: Math.round(newSubtotal * 100) / 100,
      tax: Math.round(newTax * 100) / 100,
      discount: cappedDiscount,
      total: Math.max(0, Math.round(newTotal * 100) / 100),
      totalWithTip: Math.max(0, Math.round(newTotal * 100) / 100) + toNum(order?.tip),
    },
  })
}

// Preračunaj totale čeka po voidu
export async function recalculateCheckTotals(checkId: string) {
  const linkedCheck = await db.check.findUnique({
    where: { id: checkId },
    include: { orderItems: true },
  })
  if (!linkedCheck) return

  let checkSubtotal = 0
  let checkTax = 0
  for (const oi of linkedCheck.orderItems) {
    if (oi.voided) continue
    const itemBase = toNum(oi.price) * oi.quantity
    const itemVat = toNum(oi.vatAmount) > 0 ? toNum(oi.vatAmount) : (itemBase * (toNum(oi.vatRate) / 100))
    checkSubtotal += itemBase
    checkTax += itemVat
  }
  const checkDiscount = toNum(linkedCheck.discount)
  const checkTotal = round2(checkSubtotal + checkTax + toNum(linkedCheck.serviceCharge) - checkDiscount)
  const checkTotalWithTip = round2(checkTotal + toNum(linkedCheck.tip))

  await db.check.update({
    where: { id: linkedCheck.id },
    data: {
      subtotal: round2(checkSubtotal),
      tax: round2(checkTax),
      total: checkTotal,
      totalWithTip: checkTotalWithTip,
    },
  })
}

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
