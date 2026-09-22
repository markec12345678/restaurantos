// ============================================
// RAZKNJIŽI ZALOGO ZA DODANE ARTIKLE V OBSTOJEČE NAROČILO
// (za add-items — ne preverja inventoryDeducted flaga)
// ============================================
//
// R108 (OR-3, TOCTOU razred iz R100–R107): prej je bila razknjižba
// SAMOSTAJNA transakcija, ločena od pisalnega toka naročila (create
// OrderItems + recalc totals) — crash/odpad med transakcijama → artikli na
// naročilu BREZ odbitka zaloge (FURS/fizična zaloga neskladje). Zdaj:
// `deductStockForItemsInTx()` izpostavi ITERACIJO brez lastne transakcije —
// klicatelj (R108 order-mutations kanon) jo izvede v ISTI Serializable tx
// kot pisanje naročila. `deductStockForAddedItems()` ostane za backward
// compat (lastna transakcija, enaka semantika).

import { db } from '../db'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { deductRecipeItems, deductDirectItem } from './deduct-added-utils'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

/**
 * R108: odbitje zaloge znotraj TUJE transakcije (brez lastne $transaction).
 * Klicatelj poseduje transakcijsko mejo ( Serializable kanon) — odbitki so
 * atomarni s pisanjem naročila. Rezultat se akumulira v podani `result`.
 */
export async function deductStockForItemsInTx(
  tx: TransactionClient,
  items: StockDeductionItem[],
  orderNumber: number,
  orderId: string,
  orderLocationId: string | null | undefined,
  result: StockDeductionResult,
): Promise<void> {
  for (const item of items) {
    if (item.voided) continue

    // 1. Preveri RecipeItem (večsastavni recepti) — PREDNOST
    const recipeItems = await tx.recipeItem.findMany({
      where: { menuItemId: item.menuItemId },
    })

    if (recipeItems.length > 0) {
      await deductRecipeItems(tx, item, orderNumber, orderId, result)
    } else {
      // 2. Fallback: direktna 1:1 povezava InventoryItem↔MenuItem
      // P1-7: zoži zalogo na lokacijo naročila
      await deductDirectItem(tx, item, orderNumber, orderId, result, orderLocationId)
    }
  }
}

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
    await deductStockForItemsInTx(tx, items, orderNumber, orderId, order.locationId, result)
  })

  return result
}
