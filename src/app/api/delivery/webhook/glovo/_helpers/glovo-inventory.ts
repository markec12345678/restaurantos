// Glovo Inventory Deduction — zmanjšanje zaloge znotraj transakcije
//
// FIX P4 (audit 2026-09-06): Ko updateMany vrne count=0 (nezadostna zaloga),
// se operacija prej tiho preskočila — order je bil ustvarjen, zaloga pa NI
// bila odbita. To je finančna nepravilnost (Glovo dobi order, mi pa ne
// odbijemo zaloge). Sedaj: throw INSUFFICIENT_STOCK error, ki ga caller
// ulovi in zavrne order (ali vsaj zabeleži napako).
//

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { toNum } from '@/lib/decimal'
import { rawFromUsable } from '@/lib/recipes/yield'
import { recordBatchConsumption } from '@/lib/stock-deduction/batch-allocation'
import { acquireInvStockLocks } from '@/lib/stock-deduction/locks'
import type { WebhookOrderItem } from './glovo-schema'

// FIX CRITICAL: Zmanjšaj zalogo ZNOTRAJ transakcije (prepreči race condition)
export async function deductInventoryForOrder(
  orderId: string,
  orderNumber: number,
  orderItems: WebhookOrderItem[],
  providerLabel: string,
) {
  await db.$transaction(async (tx) => {
    // R218 G3 (epik #144 / issue #152 korak 2): pre-fetch vseh menuItems ENKRAT
    // (tx-fresh) — zbir invIds za acquireInvStockLocks (kanon R182: vse
    // ključavnice PRED prvo mutacijo, sortirane + dedup — deadlock nemogoč)
    // in odpravi N+1 fetch v zanki (recepti se berejo iz istega tx-fresh
    // zemljevida, ki ga ključavnice varujejo).
    const loadMenuItem = (id: string) =>
      tx.menuItem.findUnique({
        where: { id },
        include: { recipeItems: { include: { inventoryItem: true } } },
      })
    const menuMap = new Map<string, Awaited<ReturnType<typeof loadMenuItem>>>()
    for (const item of orderItems) {
      if (!menuMap.has(item.menuItemId)) {
        menuMap.set(item.menuItemId, await loadMenuItem(item.menuItemId))
      }
    }
    await acquireInvStockLocks(
      tx,
      [...menuMap.values()].flatMap((m) => (m?.recipeItems ?? []).map((r) => r.inventoryItem?.id ?? null)),
    )

    for (const item of orderItems) {
      const menuItem = menuMap.get(item.menuItemId)
      if (!menuItem) continue
      for (const recipe of menuItem.recipeItems) {
        if (!recipe.inventoryItem) continue
        // R123 (P0-05): RAW odvod = usable / yield%
        const deductQty = rawFromUsable(toNum(recipe.quantityPerServing), toNum(recipe.yieldPercent)) * item.quantity
        const currentInv = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
        if (!currentInv) continue
        const updated = await tx.inventoryItem.updateMany({
          where: { id: recipe.inventoryItem.id, quantity: { gte: deductQty } },
          data: { quantity: { decrement: deductQty } },
        })
        if (updated.count > 0) {
          await tx.stockTransaction.create({
            data: {
              inventoryItemId: recipe.inventoryItem.id,
              type: 'sale', quantity: -deductQty,
              previousQty: toNum(currentInv.quantity), newQty: toNum(currentInv.quantity) - deductQty,
              costPerUnit: toNum(currentInv.costPerUnit), totalCost: deductQty * toNum(currentInv.costPerUnit),
              reason: `${providerLabel} naročilo #${orderNumber}`, orderId,
            },
          }).then((stockTx) =>
            // R120 (epic #115 §4): FEFO razporeditev odbitka po serijah
            recordBatchConsumption(tx, {
              inventoryItemId: recipe.inventoryItem.id,
              quantity: deductQty,
              stockTransactionId: stockTx.id,
            }),
          )
        } else {
          // FIX P4: Nezadostna zaloga — zabeleži v audit + throw da caller ve
          await tx.stockTransaction.create({
            data: {
              inventoryItemId: recipe.inventoryItem.id,
              type: 'sale', quantity: 0,
              previousQty: toNum(currentInv.quantity), newQty: toNum(currentInv.quantity),
              costPerUnit: toNum(currentInv.costPerUnit), totalCost: 0,
              reason: `POSKUS PRODAJE (nezadostna zaloga) - ${providerLabel} naročilo #${orderNumber}`,
              orderId,
            },
          })
          logger.error(
            providerLabel,
            `Nezadostna zaloga za "${menuItem.name}" pri Glovo order #${orderNumber}: potrebno ${deductQty.toFixed(2)}, na voljo ${toNum(currentInv.quantity).toFixed(2)}`,
          )
          // Throw da se transakcija roll-back-a — order ne dobi inventoryDeducted=true
          throw new Error(`INSUFFICIENT_STOCK:${menuItem.name}:potrebno ${deductQty.toFixed(2)}, na voljo ${toNum(currentInv.quantity).toFixed(2)}`)
        }
      }
    }
    await tx.order.update({ where: { id: orderId }, data: { inventoryDeducted: true } })
  })
}
