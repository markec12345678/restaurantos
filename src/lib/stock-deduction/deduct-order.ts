// ============================================
// ODBIJI ZALOGO OB PRODAJI (FIRE naročila)
// Orchestrator — recipe + direct deduction
// ============================================

import { db } from '../db'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { deductRecipeItems } from './deduct-recipe'
import { deductDirectItem } from './deduct-direct'

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

  // Preveri, da zaloga še NI bila razknjižena (fast path — zastarelo branje!)
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

  // Celotno razknjiževanje v eni transakciji — prepreči parcialno stanje
  await db.$transaction(async (tx) => {
    // P1-19 (concurrency): ATOMICNA ZAHTEVA (claim) flag-a ZNOTRAJ transakcije.
    //
    // Prej je bil `inventoryDeducted` prebran IZVEN transakcije (zgoraj) —
    // TOCTOU race: order-create flow in FURS-fallback flow (post-verify) sta
    // SOČASNO prebrala false → oba vstopila v transakcijo → oba razknjižila
    // zalogo (dvojni odbitek + duplikat StockMovement vrstic).
    //
    // Fix: pogojni updateMany (conditional update = optimistic locking vzorec):
    // samo PRVI klic postavi false→true in dobi count=1; konkurenčni klici
    // dobijo count=0 → takoj končajo BREZ razknjižbe. To je tudi idempotenca
    // za retry klice (isti order, drugačen čas).
    const claim = await tx.order.updateMany({
      where: { id: orderId, inventoryDeducted: false },
      data: { inventoryDeducted: true },
    })
    if (claim.count === 0) {
      // Druga sočasna transakcija je medtem že prevzela razknjižbo — izstopimo
      // brez stranskih učinkov (transaction se izvede kot no-op commit).
      return
    }

    // 1. Recipe-based deduction (vrne indekse obdelanih postavk)
    const recipeHandled = await deductRecipeItems(tx, items, orderId, orderNumber, result)

    // 2. Direct deduction za preostale postavke
    // P1-7: locationId naročila zoži zaloge na pravo lokacijo
    // (InventoryItem je per-lokacija: @@unique([menuItemId, locationId]))
    for (let i = 0; i < items.length; i++) {
      if (items[i].voided || recipeHandled.has(i)) continue
      await deductDirectItem(tx, items[i], orderId, orderNumber, result, order.locationId)
    }
  })

  return result
}
