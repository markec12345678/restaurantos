// ============================================
// VRNI ZALOGO OB PREKLICU / STORNU
// ============================================
//
// FIX P1 (audit 2026-09-06): Dodan optional `tx` parameter, da se lahko
// vračanje zaloge kliče ZNOTRAJ outer transakcije (npr. z order.updateMany
// in createAuditLog v eni atomarni transakciji). Če `tx` ni podan,
// odpre svojo lastno transakcijo (backward compat).
//
// P1-19 (concurrency) + P1-inventory (snapshot) — audit 2026-09-09:
//
//   1. RACE (dvojni return): prej je `findFirst(type='return')` check veljal
//      kot "atomaren" komentar, ampak brez zaklepa sta dva sočasna klica
//      (storno + soft-delete, ali dvoklik na stornu) oba prebrala "ni še
//      vračano" → oba vrnila zalogo (dvakrat). Fix: pg_advisory_xact_lock
//      na orderId serializira vse vračilne poti; check-not-return se zdaj
//      izvede pod zaklepom → enolično.
//
//   2. SNAPSHOT RECEPTURE: vračanje sedaj NE ponovno bere trenutne recepture
//      (RecipeItem se lahko spremeni MED prodajo in stornom — return bi
//      vrnil napačno količino). Namesto tega se VRATI TOČNO OGLEDALO
//      (mirror) dejansko odbitih 'sale' StockMovement vrstic tega naročila:
//      vsak sale row (quantity = -X) dobi return row (+X) na ISTI artikel.
//      Dedukcija sama je tako svoj lasten snapshot — matematika ostane
//      izenačena ne glede na kasnejše spremembe receptur/cen.
//      Fallback na staro (receptno) logiko SAMO za legacy naročila brez
//      sale vrstic (pred uvedbo movement log-a).
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
    // P1-19: zakleni vračanje za TA order — serijsko izvajanje prek vseh poti
    // (storno, soft-delete, cancellation). xact lock se sprosti ob commit/rollback.
    // hashtext('stock-return:' + orderId) → enolično imešan ključ (ne kolidira
    // s payment locki na hashtext(checkId)).
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'stock-return:' + orderId}))`

    // Preveri, da je zaloga RAZKNJIČENA pred vračanjem
    const order = await client.order.findUnique({ where: { id: orderId } })
    if (!order || !order.inventoryDeducted) {
      result.success = false
      result.errors.push({ error: 'Zaloga ni bila razknjičena za to naročilo' })
      return
    }

    // Preveri, če že obstajajo 'return' transakcije za to naročilo —
    // ZDAJ pod advisory zaklepom → resnično atomarna zaščita pred double-return
    const existingReturns = await client.stockTransaction.findFirst({
      where: { orderId, type: 'return' },
    })
    if (existingReturns) {
      result.success = false
      result.errors.push({ error: 'Zaloga za to naročilo je že bila vračana' })
      return
    }

    // ── P1-inventory (snapshot): vračanje po DEJANSKO odbitih vrsticah ──
    const saleRows = await client.stockTransaction.findMany({
      where: { orderId, type: 'sale' },
      orderBy: { createdAt: 'asc' },
    })

    // Agregiraj odbite količine po artiklu (en artikel ima lahko več vrstic)
    const deductedByItem = new Map<string, number>()
    for (const row of saleRows) {
      const qty = toNum(row.quantity) // negativno za dejanski odbitek
      if (qty >= 0) continue // 0 = poskus ob nezadostni zalogi — nič za vrnit
      const current = deductedByItem.get(row.inventoryItemId) ?? 0
      deductedByItem.set(row.inventoryItemId, current - qty) // seštej |odbitek|
    }

    if (deductedByItem.size > 0) {
      // Mirror return — točno nasprotje dedukcije (snapshot semantika)
      for (const [inventoryItemId, qtyToReturn] of deductedByItem) {
        const invItem = await client.inventoryItem.findUnique({
          where: { id: inventoryItemId },
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
          method: 'snapshot', // vračilo po snapshotu dedukcije (ne trenutni recepturi)
        })

        if (newQty <= toNum(invItem.minQuantity)) {
          result.lowStockAlerts.push({
            inventoryItemId: invItem.id,
            name: invItem.name,
            currentQty: newQty,
            minQty: toNum(invItem.minQuantity),
            locationId: invItem.locationId ?? null,
          })
        }
      }
      return
    }

    // ── LEGACY fallback: naročila brez sale vrstic (stara logika, receptna) ──
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
        // P1-7: zoži na lokacijo naročila (InventoryItem je per-lokacija;
        // @@unique([menuItemId, locationId]) — menuItemId več ni globalno unikaten)
        const invItem = await client.inventoryItem.findFirst({
          where: {
            menuItemId: oi.menuItemId,
            ...(order.locationId ? { locationId: order.locationId } : {}),
          },
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
    // Celotno vračanje v eni transakciji — prepreči double-return in parcialno stanje
    await db.$transaction(async (innerTx) => {
      await runInside(innerTx)
    })
  }

  // NE ponastavi inventoryDeducted na false!
  // Če ga ponastavimo, lahko FURS fallback (ki preverja !inventoryDeducted)
  // znova odbije zalogo za že preklicano naročilo — double deduction!
  // Pravilna semantika: inventoryDeducted=true pomeni "zaloga je bila obdelana"
  // (bilo deduct ALI deduct+return). Obdelava je končana.
  // Za zaščito pred double-return: pg_advisory_xact_lock + existingReturns
  // check ZNOTRAJ zaklepa.

  return result
}
