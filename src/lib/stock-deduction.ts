// ============================================
// CENTRALIZIRANO RAZKNJIŽEVANJE ZALOGE
// Skrbi za pravilno odbiranje zaloge ob prodaji
// in vračanje ob preklicu/stornu
// ============================================

import { db } from './db'
import { getAppUrl } from './utils'
import { emitStockLow } from './event-emitter'
import { toNum, round2, multiply, add, subtract } from './decimal'
import { logger } from './logger'

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

  // FIX MEDIUM: Batch query — pridobi vse recepte in inventar naenkrat namesto N+1
  const menuItemIds = items.filter(i => !i.voided).map(i => i.menuItemId)
  if (menuItemIds.length === 0) return { available: true, warnings: [] }

  const [allRecipes, allInvItems] = await Promise.all([
    db.recipeItem.findMany({
      where: { menuItemId: { in: menuItemIds } },
      include: { inventoryItem: true, menuItem: { select: { name: true } } },
    }),
    db.inventoryItem.findMany({
      where: { menuItemId: { in: menuItemIds } },
      include: { menuItem: { select: { name: true } } },
    }),
  ])

  // Zgradi lookup mape
  const recipesByMenuItem = new Map<string, typeof allRecipes>()
  for (const r of allRecipes) {
    if (!recipesByMenuItem.has(r.menuItemId)) recipesByMenuItem.set(r.menuItemId, [])
    recipesByMenuItem.get(r.menuItemId)!.push(r)
  }
  const invByMenuItem = new Map(allInvItems.map(i => [i.menuItemId!, i]))

  for (const item of items) {
    if (item.voided) continue

    const recipeItems = recipesByMenuItem.get(item.menuItemId) || []

    if (recipeItems.length > 0) {
      for (const recipe of recipeItems) {
        const needed = toNum(multiply(recipe.quantityPerServing, item.quantity))
        if (toNum(recipe.inventoryItem.quantity) < needed) {
          warnings.push({
            menuItemId: item.menuItemId,
            itemName: recipe.menuItem.name,
            ingredientName: recipe.inventoryItem.name,
            needed,
            available: toNum(recipe.inventoryItem.quantity),
            unit: recipe.inventoryItem.unit,
          })
        }
      }
    } else {
      // Preveri prek direktnega 1:1 linka
      const invItem = invByMenuItem.get(item.menuItemId)

      if (invItem && toNum(invItem.servingsPerUnit) > 0) {
        const servingsNeeded = item.quantity
        const availableServings = toNum(multiply(invItem.quantity, invItem.servingsPerUnit))
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

  // FIX HIGH: Celotno razknjiževanje v eni transakciji — prepreči parcialno stanje
  // inventoryDeducted flag se nastavi ZNOTRAJ transakcije, kar zagotavlja atomarnost
  await db.$transaction(async (tx) => {
    // Obdelaj vsak artikel
    for (const item of items) {
      if (item.voided) continue

      // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
      const recipeItems = await tx.recipeItem.findMany({
        where: { menuItemId: item.menuItemId },
      })

      if (recipeItems.length > 0) {
        // Uporabi receptne sestavine
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

          // Atomic decrement
          const updatedItem = await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { decrement: qtyToDeduct } },
          })
          const previousQty = toNum(add(updatedItem.quantity, qtyToDeduct))
          let newQty = toNum(updatedItem.quantity)

          // Clamp to 0 if negative
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

        // Clamp to 0 if negative
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
    }

    // Označi naročilo kot razknjiženo ZNOTRAJ transakcije — atomarno
    await tx.order.update({
      where: { id: orderId },
      data: { inventoryDeducted: true },
    })
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

  // FIX CRITICAL: Celotno vračanje v eni transakciji — prepreči double-return in parcialno stanje
  // Preverjanje existingReturns ZNOTRAJ transakcije zagotavlja atomarnost
  await db.$transaction(async (tx) => {
    // Preveri, da je zaloga RAZKNJIŽENA pred vračanjem
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order || !order.inventoryDeducted) {
      result.success = false
      result.errors.push({ error: 'Zaloga ni bila razknjižena za to naročilo' })
      return
    }

    // FIX CRITICAL: Preveri, če že obstajajo 'return' transakcije za to naročilo
    // ZNOTRAJ transakcije — prepreči sočasen double-return
    const existingReturns = await tx.stockTransaction.findFirst({
      where: { orderId, type: 'return' },
    })
    if (existingReturns) {
      result.success = false
      result.errors.push({ error: 'Zaloga za to naročilo je že bila vračena' })
      return
    }

    // Pridobi artikle naročila
    const orderItems = await tx.orderItem.findMany({
      where: { orderId, voided: false },
    })

    for (const oi of orderItems) {
      // 1. RecipeItem (večsastavni recepti)
      const recipeItems = await tx.recipeItem.findMany({
        where: { menuItemId: oi.menuItemId },
      })

      if (recipeItems.length > 0) {
        for (const recipe of recipeItems) {
          const qtyToReturn = toNum(multiply(recipe.quantityPerServing, oi.quantity))

          const invItem = await tx.inventoryItem.findUnique({
            where: { id: recipe.inventoryItemId },
          })

          if (!invItem) continue

          // Atomic increment
          const updatedItem = await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: { increment: qtyToReturn } },
          })
          const previousQty = toNum(subtract(updatedItem.quantity, qtyToReturn))
          const newQty = toNum(updatedItem.quantity)

          await tx.stockTransaction.create({
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
        const invItem = await tx.inventoryItem.findFirst({
          where: { menuItemId: oi.menuItemId },
        })

        if (!invItem || toNum(invItem.servingsPerUnit) <= 0) continue

        const unitsPerServing = 1 / toNum(invItem.servingsPerUnit)
        const totalUnitsToReturn = Math.round(oi.quantity * unitsPerServing * 10000) / 10000

        // Atomic increment
        const updatedItem = await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { increment: totalUnitsToReturn } },
        })
        const previousQty = toNum(subtract(updatedItem.quantity, totalUnitsToReturn))
        const newQty = toNum(updatedItem.quantity)

        await tx.stockTransaction.create({
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
  })

  // FIX CRITICAL: NE ponastavi inventoryDeducted na false!
  // Če ga ponastavimo, lahko FURS fallback (ki preverja !inventoryDeducted)
  // znova odbije zalogo za že preklicano naročilo — double deduction!
  // Pravilna semantika: inventoryDeducted=true pomeni "zaloga je bila obdelana"
  // (bilo deduct ALI deduct+return). Obdelava je končana.
  // Za zaščito pred double-return: preveri, če že obstajajo 'return' transakcije
  // za to naročilo — če da, ne dovoli ponovnega vračanja.

  return result
}

// ============================================
// POŠLJI LOW-STOCK OBVESTILO PREKO WEBSOCKET
// ============================================

export async function broadcastLowStockAlert(
  alerts: Array<{ inventoryItemId: string; name: string; currentQty: number; minQty: number }>
) {
  if (alerts.length === 0) return

  // Webhook: stock.low / stock.critical
  for (const alert of alerts) {
    emitStockLow({
      inventoryItemId: alert.inventoryItemId,
      itemName: alert.name,
      currentQty: alert.currentQty,
      minQty: alert.minQty,
    }).catch(err => logger.error('StockDeduction', 'stock.low napaka:', err))
  }

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
