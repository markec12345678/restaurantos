// ============================================
// CENTRALIZIRANO RAZKNJIŽEVANJE ZALOGE
// Skrbi za pravilno odbiranje zaloge ob prodaji
// in vračanje ob preklicu/stornu
// ============================================

import { db } from './db'
import { getAppUrl } from './utils'

// ============================================
// TIPI
// ============================================

interface StockDeductionItem {
  menuItemId: string
  quantity: number
  voided?: boolean
}

interface StockDeductionResult {
  success: boolean
  deducted: Array<{
    inventoryItemId: string
    name: string
    quantityDeducted: number
    previousQty: number
    newQty: number
    method: 'recipe' | 'direct'
  }>
  lowStockAlerts: Array<{
    inventoryItemId: string
    name: string
    currentQty: number
    minQty: number
  }>
  errors: Array<{
    inventoryItemId?: string
    name?: string
    error: string
  }>
}

// ============================================
// PREVERI RAZPOLŽLJIVOST ZALOGE
// ============================================

export async function checkStockAvailability(
  items: StockDeductionItem[]
): Promise<{
  available: boolean
  warnings: Array<{ menuItemId: string; itemName: string; ingredientName: string; needed: number; available: number; unit: string }>
}> {
  const warnings: Array<{ menuItemId: string; itemName: string; ingredientName: string; needed: number; available: number; unit: string }> = []

  for (const item of items) {
    if (item.voided) continue

    // Preveri prek RecipeItem (večsastavni recepti)
    const recipeItems = await db.recipeItem.findMany({
      where: { menuItemId: item.menuItemId },
      include: { inventoryItem: true, menuItem: { select: { name: true } } },
    })

    if (recipeItems.length > 0) {
      for (const recipe of recipeItems) {
        const needed = recipe.quantityPerServing * item.quantity
        if (recipe.inventoryItem.quantity < needed) {
          warnings.push({
            menuItemId: item.menuItemId,
            itemName: recipe.menuItem.name,
            ingredientName: recipe.inventoryItem.name,
            needed,
            available: recipe.inventoryItem.quantity,
            unit: recipe.inventoryItem.unit,
          })
        }
      }
    } else {
      // Preveri prek direktnega 1:1 linka
      const invItem = await db.inventoryItem.findFirst({
        where: { menuItemId: item.menuItemId },
        include: { menuItem: { select: { name: true } } },
      })

      if (invItem && invItem.servingsPerUnit > 0) {
        const servingsNeeded = item.quantity
        const availableServings = invItem.quantity * invItem.servingsPerUnit
        if (availableServings < servingsNeeded) {
          warnings.push({
            menuItemId: item.menuItemId,
            itemName: invItem.menuItem?.name || 'Neznan',
            ingredientName: invItem.name,
            needed: servingsNeeded,
            available: availableServings,
            unit: invItem.unit,
          })
        }
      }
    }
  }

  return {
    available: warnings.length === 0,
    warnings,
  }
}

// ============================================
// ODBIJI ZALOGO OB PRODAJI (FIRE naročila)
// ============================================

// ============================================
// RAZKNJIŽI ZALOGO ZA DODANE ARTIKLE V OBSTOJEČE NAROČILO
// (za add-items — ne preverja inventoryDeducted flaga)
// ============================================

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
  for (const item of items) {
    if (item.voided) continue

    // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
    const recipeItems = await db.recipeItem.findMany({
      where: { menuItemId: item.menuItemId },
    })

    if (recipeItems.length > 0) {
      for (const recipe of recipeItems) {
        const qtyToDeduct = recipe.quantityPerServing * item.quantity

        // Use atomic decrement inside transaction — read is also inside
        await db.$transaction(async (tx) => {
          // Read inside transaction to get current value
          const invItem = await tx.inventoryItem.findUnique({
            where: { id: recipe.inventoryItemId },
          })

          if (!invItem) {
            result.errors.push({
              inventoryItemId: recipe.inventoryItemId,
              error: `Sestavina ${recipe.inventoryItemId} ni najdena`,
            })
            return
          }

          // Atomic decrement
          const updatedItem = await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { decrement: qtyToDeduct } },
          })
          const previousQty = updatedItem.quantity + qtyToDeduct
          let newQty = updatedItem.quantity

          // FIX MEDIUM: Clamp to 0 if negative — pravilno zabeleži dejansko odbito količino
          let actualDeducted = qtyToDeduct
          if (newQty < 0) {
            actualDeducted = qtyToDeduct + newQty // newQty je negativno
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
              totalCost: actualDeducted * invItem.costPerUnit,
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

          if (newQty <= invItem.minQuantity) {
            result.lowStockAlerts.push({
              inventoryItemId: invItem.id,
              name: invItem.name,
              currentQty: newQty,
              minQty: invItem.minQuantity,
            })
          }
        })
      }
    } else {
      // 2. Fallback: direktna 1:1 povezava InventoryItem↔MenuItem
      await db.$transaction(async (tx) => {
        const invItem = await tx.inventoryItem.findFirst({
          where: { menuItemId: item.menuItemId },
        })

        if (!invItem || invItem.servingsPerUnit <= 0) return

        const unitsPerServing = 1 / invItem.servingsPerUnit
        const totalUnitsToDeduct = Math.round(item.quantity * unitsPerServing * 10000) / 10000

        // Atomic decrement
        const updatedItem = await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { decrement: totalUnitsToDeduct } },
        })
        const previousQty = updatedItem.quantity + totalUnitsToDeduct
        let newQty = updatedItem.quantity

        // FIX MEDIUM: Clamp to 0 if negative — pravilno zabeleži dejansko odbito količino
        let actualDeducted = totalUnitsToDeduct
        if (newQty < 0) {
          actualDeducted = totalUnitsToDeduct + newQty // newQty je negativno
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
            totalCost: actualDeducted * invItem.costPerUnit,
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

        if (newQty <= invItem.minQuantity) {
          result.lowStockAlerts.push({
            inventoryItemId: invItem.id,
            name: invItem.name,
            currentQty: newQty,
            minQty: invItem.minQuantity,
          })
        }
      })
    }
  }

  return result
}

// ============================================
// ODBIJI ZALOGO OB PRODAJI (FIRE naročila)
// ============================================

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

  // Obdelaj vsak artikel
  for (const item of items) {
    if (item.voided) continue

    // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
    const recipeItems = await db.recipeItem.findMany({
      where: { menuItemId: item.menuItemId },
    })

    if (recipeItems.length > 0) {
      // Uporabi receptne sestavine
      for (const recipe of recipeItems) {
        const qtyToDeduct = recipe.quantityPerServing * item.quantity

        // Use atomic decrement inside transaction — read is also inside
        await db.$transaction(async (tx) => {
          const invItem = await tx.inventoryItem.findUnique({
            where: { id: recipe.inventoryItemId },
          })

          if (!invItem) {
            result.errors.push({
              inventoryItemId: recipe.inventoryItemId,
              error: `Sestavina ${recipe.inventoryItemId} ni najdena`,
            })
            return
          }

          // Atomic decrement
          const updatedItem = await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { decrement: qtyToDeduct } },
          })
          const previousQty = updatedItem.quantity + qtyToDeduct
          let newQty = updatedItem.quantity

          // FIX MEDIUM: Clamp to 0 if negative — pravilno zabeleži dejansko odbito količino
          let actualDeducted = qtyToDeduct
          if (newQty < 0) {
            actualDeducted = qtyToDeduct + newQty // newQty je negativno
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
              totalCost: actualDeducted * invItem.costPerUnit,
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

          // Preveri low stock
          if (newQty <= invItem.minQuantity) {
            result.lowStockAlerts.push({
              inventoryItemId: invItem.id,
              name: invItem.name,
              currentQty: newQty,
              minQty: invItem.minQuantity,
            })
          }
        })
      }
    } else {
      // 2. Fallback: direktna 1:1 povezava InventoryItem↔MenuItem
      await db.$transaction(async (tx) => {
        const invItem = await tx.inventoryItem.findFirst({
          where: { menuItemId: item.menuItemId },
        })

        if (!invItem || invItem.servingsPerUnit <= 0) return

        const unitsPerServing = 1 / invItem.servingsPerUnit
        const totalUnitsToDeduct = Math.round(item.quantity * unitsPerServing * 10000) / 10000

        // Atomic decrement
        const updatedItem = await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { decrement: totalUnitsToDeduct } },
        })
        const previousQty = updatedItem.quantity + totalUnitsToDeduct
        let newQty = updatedItem.quantity

        // FIX MEDIUM: Clamp to 0 if negative — pravilno zabeleži dejansko odbito količino
        let actualDeducted = totalUnitsToDeduct
        if (newQty < 0) {
          actualDeducted = totalUnitsToDeduct + newQty // newQty je negativno
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
            totalCost: actualDeducted * invItem.costPerUnit,
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

        // Preveri low stock
        if (newQty <= invItem.minQuantity) {
          result.lowStockAlerts.push({
            inventoryItemId: invItem.id,
            name: invItem.name,
            currentQty: newQty,
            minQty: invItem.minQuantity,
          })
        }
      })
      // Če ni ne recepta ne direktne povezave — artikel nima zaloge (npr. storitev)
    }
  }

  // Označi naročilo kot razknjiženo
  await db.order.update({
    where: { id: orderId },
    data: { inventoryDeducted: true },
  })

  return result
}

// ============================================
// VRNI ZALOGO OB PREKLICU / STORNU
// ============================================

export async function returnStockForOrder(
  orderId: string,
  orderNumber: number,
  reason: string
): Promise<StockDeductionResult> {
  const result: StockDeductionResult = {
    success: true,
    deducted: [],
    lowStockAlerts: [],
    errors: [],
  }

  // Preveri, da je zaloga RAZKNJIŽENA pred vračanjem — prepreči double-return
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order || !order.inventoryDeducted) {
    result.success = false
    result.errors.push({ error: 'Zaloga ni bila razknjižena za to naročilo' })
    return result
  }

  // Pridobi artikle naročila
  const orderItems = await db.orderItem.findMany({
    where: { orderId, voided: false },
  })

  for (const oi of orderItems) {
    // 1. RecipeItem (večsastavni recepti)
    const recipeItems = await db.recipeItem.findMany({
      where: { menuItemId: oi.menuItemId },
    })

    if (recipeItems.length > 0) {
      for (const recipe of recipeItems) {
        const qtyToReturn = recipe.quantityPerServing * oi.quantity

        // Use atomic increment inside transaction — read is also inside
        await db.$transaction(async (tx) => {
          const invItem = await tx.inventoryItem.findUnique({
            where: { id: recipe.inventoryItemId },
          })

          if (!invItem) return

          // Atomic increment
          const updatedItem = await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { increment: qtyToReturn } },
          })
          const previousQty = updatedItem.quantity - qtyToReturn
          const newQty = updatedItem.quantity

          await tx.stockTransaction.create({
            data: {
              inventoryItemId: invItem.id,
              type: 'return',
              quantity: qtyToReturn,
              previousQty,
              newQty,
              costPerUnit: invItem.costPerUnit,
              totalCost: -(qtyToReturn * invItem.costPerUnit),
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
        })
      }
    } else {
      // 2. Direktna 1:1 povezava
      await db.$transaction(async (tx) => {
        const invItem = await tx.inventoryItem.findFirst({
          where: { menuItemId: oi.menuItemId },
        })

        if (!invItem || invItem.servingsPerUnit <= 0) return

        const unitsPerServing = 1 / invItem.servingsPerUnit
        const totalUnitsToReturn = Math.round(oi.quantity * unitsPerServing * 10000) / 10000

        // Atomic increment
        const updatedItem = await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { increment: totalUnitsToReturn } },
        })
        const previousQty = updatedItem.quantity - totalUnitsToReturn
        const newQty = updatedItem.quantity

        await tx.stockTransaction.create({
          data: {
            inventoryItemId: invItem.id,
            type: 'return',
            quantity: totalUnitsToReturn,
            previousQty,
            newQty,
            costPerUnit: invItem.costPerUnit,
            totalCost: -(totalUnitsToReturn * invItem.costPerUnit),
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
      })
    }
  }

  // Označi, da zaloga NI več razknjižena
  await db.order.update({
    where: { id: orderId },
    data: { inventoryDeducted: false },
  })

  return result
}

// ============================================
// POŠLJI LOW-STOCK OBVESTILO PREKO WEBSOCKET
// ============================================

export async function broadcastLowStockAlert(
  alerts: Array<{ inventoryItemId: string; name: string; currentQty: number; minQty: number }>
) {
  if (alerts.length === 0) return

  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'STOCK_LOW',
        payload: {
          alerts: alerts.map(a => ({
            inventoryItemId: a.inventoryItemId,
            name: a.name,
            currentQty: a.currentQty,
            minQty: a.minQty,
            severity: a.currentQty <= 0 ? 'out_of_stock' : 'low_stock',
          })),
          timestamp: new Date().toISOString(),
        },
      }),
    })
  } catch {
    // WS ni na voljo — tiho
  }
}
