// Pomožne funkcije za online naročila — Zmanjšanje zaloge
//
// FIX P4 (audit 2026-09-06): Ko updateMany vrne count=0 (nezadostna zaloga),
// se operacija prej tiho preskočila — order je bil ustvarjen, zaloga pa NI
// bila odbita. Sedaj: throw INSUFFICIENT_STOCK error, ki ga caller ulovi
// in zavrne order (transakcija roll-back-a order.create).
//

import { db } from '@/lib/db'
import { toNum, type DecimalLike } from '@/lib/decimal'
import { rawFromUsable } from '@/lib/recipes/yield'
import { logger } from '@/lib/logger'
import { recordBatchConsumption } from '@/lib/stock-deduction/batch-allocation'

export async function deductInventory(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  items: Array<{ menuItemId: string; quantity: number; notes: string; modifiersJson: string }>,
  menuItemMap: Map<string, {
    id: string; price: DecimalLike; vatRate: DecimalLike
    recipeItems: Array<{
      quantityPerServing: DecimalLike
      yieldPercent?: DecimalLike | null
      inventoryItem: { id: string; quantity: DecimalLike; costPerUnit: DecimalLike } | null
    }>
  }>,
  nextOrderNumber: number,
  newOrderId: string,
): Promise<void> {
  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId)
    if (!menuItem) continue
    for (const recipe of menuItem.recipeItems) {
      if (!recipe.inventoryItem) continue
      // R123 (P0-05): RAW odvod = usable / yield%
      const deductQty = rawFromUsable(toNum(recipe.quantityPerServing), toNum(recipe.yieldPercent)) * item.quantity
      const currentInvItem = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
      if (!currentInvItem) continue
      const updated = await tx.inventoryItem.updateMany({
        where: { id: recipe.inventoryItem.id, quantity: { gte: deductQty } },
        data: { quantity: { decrement: deductQty } },
      })
      if (updated.count > 0) {
        // Narrowing v .then closure — artikel zajamemo prej (TS18047)
        const invItemId = recipe.inventoryItem.id
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: invItemId, type: 'sale', quantity: -deductQty,
            previousQty: toNum(currentInvItem.quantity), newQty: toNum(currentInvItem.quantity) - deductQty,
            costPerUnit: toNum(currentInvItem.costPerUnit), totalCost: deductQty * toNum(currentInvItem.costPerUnit),
            reason: `Online naročilo #${nextOrderNumber}`, orderId: newOrderId,
          },
        }).then((stockTx) =>
          // R120 (epic #115 §4): FEFO razporeditev odbitka po serijah
          recordBatchConsumption(tx, {
            inventoryItemId: invItemId,
            quantity: deductQty,
            stockTransactionId: stockTx.id,
          }),
        )
      } else {
        // FIX P4: Nezadostna zaloga — throw da se transakcija roll-back-a
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: recipe.inventoryItem.id, type: 'sale', quantity: 0,
            previousQty: toNum(currentInvItem.quantity), newQty: toNum(currentInvItem.quantity),
            costPerUnit: toNum(currentInvItem.costPerUnit), totalCost: 0,
            reason: `POSKUS PRODAJE (nezadostna zaloga) - Online naročilo #${nextOrderNumber}`,
            orderId: newOrderId,
          },
        })
        logger.error(
          'ONLINE_ORDER',
          `Nezadostna zaloga za artikel ${item.menuItemId} pri online order #${nextOrderNumber}: potrebno ${deductQty.toFixed(2)}, na voljo ${toNum(currentInvItem.quantity).toFixed(2)}`,
        )
        throw new Error(`INSUFFICIENT_STOCK:potrebno ${deductQty.toFixed(2)}, na voljo ${toNum(currentInvItem.quantity).toFixed(2)}`)
      }
    }
  }
}
