// ============================================
// ODBIJI ZALOGO OB PRODAJI (FIRE naročila)
// Orchestrator — recipe + direct deduction
// ============================================
//
// R182 (A2 — docs/BUSINESS-CHAIN.md): per-item zaloga ključavnice.
// Prej: NOBENA advisory ključavnica (samo CAS claim na inventoryDeducted +
// pogojni decrement) → prodaja NI tekmovala z R106 kanon potmi (odpis/
// prilagoditev/restock, waste, stocktakes, batch) niti z return-stock /
// PO receive na istem artiklu → preplet StockTransaction revizijskih vrstic
// (previousQty → newQty ni bil brezvsnežen) + SSI abort-noise na R106 straneh.
// Zdaj: pre-pass resolucija artiklov (mirror deduct-recipe/deduct-direct
// resolucije — pariteta pripeta z drift-gate pini) → acquireInvStockLocks
// (sortirano, dedup, listi grafa) → šele nato mutacije. Brez izolacijskih
// sprememb: pisalna izključitev na artiklu = advisory lock; pogojni
// updateMany (gte) ostane obrambna globina (Serializable na vroči prodajni
// poti bi DODAL P2034 retry-noise — nasprotno cilju A2).

import { db } from '../db'
import { toNum } from '../decimal'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { deductRecipeItems } from './deduct-recipe'
import { deductDirectItem } from './deduct-direct'
import { acquireInvStockLocks } from './locks'

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

    // R182 (A2): pre-pass — zberi VSE artikle, ki jih bo dedukcija mutirala.
    // Resolucija MORA zrcaliti deduct-recipe (recipeItems po menuItemId) in
    // deduct-direct (findFirst menuItemId+lokacija naročila, servingsPerUnit
    // > 0) — pariteta je pripeta v tests/unit/security/r182-stock-lock-canon.test.ts.
    const invItemIds = new Set<string>()
    for (const item of items) {
      if (item.voided) continue
      const recipeItems = await tx.recipeItem.findMany({
        where: { menuItemId: item.menuItemId },
      })
      if (recipeItems.length > 0) {
        for (const recipe of recipeItems) invItemIds.add(recipe.inventoryItemId)
      } else {
        // P1-7: locationId naročila zoži zaloge na pravo lokacijo
        // (InventoryItem je per-lokacija: @@unique([menuItemId, locationId]))
        const invItem = await tx.inventoryItem.findFirst({
          where: {
            menuItemId: item.menuItemId,
            ...(order.locationId ? { locationId: order.locationId } : {}),
          },
        })
        if (invItem && toNum(invItem.servingsPerUnit) > 0) invItemIds.add(invItem.id)
      }
    }
    // R182 (A2): inv-stock ključavnice = listi grafa (PO CAS claim-u, PRED
    // vsako mutacijo), sortirano + dedup → deadlock nemogoč.
    await acquireInvStockLocks(tx, [...invItemIds])

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
