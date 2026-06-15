// Izračuni cen artiklov in zaloga za javna QR naročila

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, calcVat, type DecimalLike } from '@/lib/decimal'
import { logger } from '@/lib/logger'

// ─── Izračunaj cene artiklov iz strežniških podatkov (NE zaupaj klientu!) ───
export interface OrderItemData {
  menuItemId: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  notes: string
  modifiersJson: string
}

export async function calculateOrderItems(
  items: Array<{ menuItemId: string; quantity: number; notes: string; modifiersJson: string }>,
  menuItemMap: Map<string, {
    id: string
    price: DecimalLike
    vatRate: DecimalLike
    recipeItems: Array<{
      quantityPerServing: DecimalLike
      inventoryItem: { id: string; quantity: DecimalLike; costPerUnit: DecimalLike; unit?: string } | null
    }>
  }>,
): Promise<{ orderItemsData: OrderItemData[]; subtotal: number; totalVat: number }> {
  let subtotal = 0
  let totalVat = 0
  const orderItemsData: OrderItemData[] = []

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId)
    if (!menuItem) continue

    const qty = item.quantity
    let modifierTotal = 0
    const parsedModifiers: Array<{ id?: string; name?: string; price?: number }> = (() => {
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
        modifierTotal += toNum(dbPrice) * qty
      } else {
        logger.warn('API', `[QR ORDER] Modifier "${mod.name}" rejected — no DB price match (possible price tampering)`)
      }
    }

    const itemBase = toNum(menuItem.price) * qty + modifierTotal
    const itemVat = calcVat(itemBase, menuItem.vatRate)
    subtotal += itemBase
    totalVat += itemVat

    orderItemsData.push({
      menuItemId: menuItem.id,
      quantity: qty,
      price: toNum(menuItem.price),
      vatRate: toNum(menuItem.vatRate),
      vatAmount: itemVat,
      notes: item.notes,
      modifiersJson: item.modifiersJson,
    })
  }

  return { orderItemsData, subtotal, totalVat }
}

// ─── Zmanjšaj zalogo znotraj transakcije (atomarno — prepreči race condition) ───
export async function deductInventoryInTx(
  tx: Prisma.TransactionClient,
  items: Array<{ menuItemId: string; quantity: number }>,
  menuItemMap: Map<string, {
    id: string
    name: string
    recipeItems: Array<{
      quantityPerServing: DecimalLike
      inventoryItem: { id: string; quantity: DecimalLike; costPerUnit: DecimalLike; unit?: string } | null
    }>
  }>,
  orderNumber: number,
): Promise<void> {
  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId)
    if (!menuItem) continue
    const qty = item.quantity

    for (const recipe of menuItem.recipeItems) {
      if (!recipe.inventoryItem) continue
      const deductQty = toNum(recipe.quantityPerServing) * qty
      // FIX MEDIUM: Preberi trenutno količino ZNOTRAJ transakcije — prepreči stale previousQty
      const currentInvItem = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
      if (!currentInvItem) continue

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: recipe.inventoryItem.id,
          quantity: { gte: deductQty },
        },
        data: { quantity: { decrement: deductQty } },
      })

      if (updated.count > 0) {
        const prevQty = toNum(currentInvItem.quantity)
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: recipe.inventoryItem.id,
            type: 'sale',
            quantity: -deductQty,
            previousQty: prevQty,
            newQty: prevQty - deductQty,
            costPerUnit: toNum(currentInvItem.costPerUnit),
            totalCost: deductQty * toNum(currentInvItem.costPerUnit),
            reason: `QR naročilo #${orderNumber}`,
          },
        })
      } else {
        // FIX QR-03 HIGH: Zaloga ni zadostna — ne sprejmi naročila tiho!
        throw new Error(`INSUFFICIENT_STOCK:${menuItem.name}:potrebno ${deductQty.toFixed(2)} ${recipe.inventoryItem.unit || 'enot'}, na zalogi ${toNum(currentInvItem.quantity).toFixed(2)}`)
      }
    }
  }
}

// ─── Broadcast NEW_ORDER to KDS/POS via WebSocket ───
export async function broadcastNewOrder(
  orderId: string,
  orderNumber: number,
  tableNumber?: number | string | null,
): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    await fetch(`${appUrl}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'NEW_ORDER',
        payload: {
          orderId,
          orderNumber,
          type: 'dine-in',
          source: 'qr',
          tableNumber: tableNumber || null,
        },
      }),
    })
  } catch {
    // WS ni na voljo — ni kritično
  }
}
