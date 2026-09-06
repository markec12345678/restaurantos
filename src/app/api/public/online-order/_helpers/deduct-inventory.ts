// Pomožne funkcije za online naročila — Zmanjšanje zaloge
//
// FIX P4 (audit 2026-09-06): Ko updateMany vrne count=0 (nezadostna zaloga),
// se operacija prej tiho preskočila — order je bil ustvarjen, zaloga pa NI
// bila odbita. Sedaj: throw INSUFFICIENT_STOCK error, ki ga caller ulovi
// in zavrne order (transakcija roll-back-a order.create).
//

import { db } from '@/lib/db'
import { toNum, type DecimalLike } from '@/lib/decimal'
import { logger } from '@/lib/logger'

export async function deductInventory(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  items: Array<{ menuItemId: string; quantity: number; notes: string; modifiersJson: string }>,
  menuItemMap: Map<string, {
    id: string; price: DecimalLike; vatRate: DecimalLike
    recipeItems: Array<{
      quantityPerServing: DecimalLike
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
      const deductQty = toNum(recipe.quantityPerServing) * item.quantity
      const currentInvItem = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
      if (!currentInvItem) continue
      const updated = await tx.inventoryItem.updateMany({
        where: { id: recipe.inventoryItem.id, quantity: { gte: deductQty } },
        data: { quantity: { decrement: deductQty } },
      })
      if (updated.count > 0) {
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: recipe.inventoryItem.id, type: 'sale', quantity: -deductQty,
            previousQty: toNum(currentInvItem.quantity), newQty: toNum(currentInvItem.quantity) - deductQty,
            costPerUnit: toNum(currentInvItem.costPerUnit), totalCost: deductQty * toNum(currentInvItem.costPerUnit),
            reason: `Online naročilo #${nextOrderNumber}`, orderId: newOrderId,
          },
        })
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
