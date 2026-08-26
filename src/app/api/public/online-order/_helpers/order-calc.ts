// Pomožne funkcije za online naročila — Izračun cen artiklov

import { db } from '@/lib/db'
import { toNum, calcVat, type DecimalLike } from '@/lib/decimal'
import { logger } from '@/lib/logger'

// ─── Izračunaj cene artiklov iz strežniških podatkov ───
export interface OrderItemCalc {
  menuItemId: string; quantity: number; price: number
  vatRate: number; vatAmount: number; notes: string; modifiersJson: string
}

export async function calculateOrderItems(
  items: Array<{ menuItemId: string; quantity: number; notes: string; modifiersJson: string }>,
  menuItemMap: Map<string, { id: string; price: DecimalLike; vatRate: DecimalLike; recipeItems: Array<{ quantityPerServing: DecimalLike; inventoryItem: { id: string; quantity: DecimalLike; costPerUnit: DecimalLike } | null }> }>
): Promise<{ orderItemsData: OrderItemCalc[]; subtotal: number; totalVat: number }> {
  let subtotal = 0
  let totalVat = 0
  const orderItemsData: OrderItemCalc[] = []

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId)
    if (!menuItem) continue

    const qty = item.quantity
    // FIX HIGH: Dodaj ceno modifikatorjev k subtotal
    let modifierTotal = 0
    const parsedModifiers: Array<{ name?: string; price?: number; id?: string }> = (() => {
      try { return JSON.parse(item.modifiersJson || '[]') } catch { return [] }
    })()

    // FIX CRITICAL: Fetch modifier prices from DB — do NOT trust client prices (price tampering)
    const modifierIds = parsedModifiers.filter(m => m.id).map(m => m.id as string)
    const dbModifiers = modifierIds.length > 0
      ? await db.modifier.findMany({ where: { id: { in: modifierIds } } })
      : []
    const modifierPriceMap = new Map(dbModifiers.map(m => [m.id, m.price]))

    for (const mod of parsedModifiers) {
      const dbPrice = mod.id ? modifierPriceMap.get(mod.id as string) : null
      if (dbPrice !== undefined && dbPrice !== null) {
        modifierTotal += toNum(dbPrice) * qty // Use DB price (trusted)
      } else {
        // FIX CRITICAL: REJECT modifiers without DB price match — ne zaupaj klientu!
        logger.warn('API', `[ONLINE ORDER] Modifier "${mod.name}" rejected — no DB price match (possible price tampering)`)
      }
    }

    const itemBase = toNum(menuItem.price) * qty + modifierTotal
    const itemVat = calcVat(itemBase, menuItem.vatRate)
    subtotal += itemBase
    totalVat += itemVat

    orderItemsData.push({
      menuItemId: menuItem.id, quantity: qty, price: toNum(menuItem.price),
      vatRate: toNum(menuItem.vatRate), vatAmount: itemVat, notes: item.notes, modifiersJson: item.modifiersJson,
    })
  }

  return { orderItemsData, subtotal, totalVat }
}
