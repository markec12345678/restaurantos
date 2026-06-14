// ============================================
// PREVERI RAZPOLŽLJIVOST ZALOGE
// ============================================

import { db } from '../db'
import { toNum, multiply } from '../decimal'
import type { StockDeductionItem } from './types'

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
