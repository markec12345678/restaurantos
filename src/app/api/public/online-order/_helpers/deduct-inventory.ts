// Pomožne funkcije za online naročila — Zmanjšanje zaloge

import { db } from '@/lib/db'
import { toNum, type DecimalLike } from '@/lib/decimal'

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
      }
    }
  }
}
