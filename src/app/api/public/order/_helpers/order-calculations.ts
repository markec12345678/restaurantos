// Izračuni cen artiklov in zaloga za javna QR naročila

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, calcVat, type DecimalLike } from '@/lib/decimal'
import { rawFromUsable } from '@/lib/recipes/yield'
import { logger } from '@/lib/logger'
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
import { parseOrderItemModifiers } from '@/lib/json-fields'
import { acquireInvStockLocks } from '@/lib/stock-deduction/locks'
import { recordBatchConsumption } from '@/lib/stock-deduction/batch-allocation'

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
      yieldPercent?: DecimalLike | null
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
    // P1-9: Zod-validiran parser — cene modifierjev se vedno znova preberejo
    // iz DB (spodaj) tako da klient ne more vatati cene;
    const parsedModifiers: Array<{ id?: string; name?: string; price?: number }> = parseOrderItemModifiers(item.modifiersJson)

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
      yieldPercent?: DecimalLike | null
      inventoryItem: { id: string; quantity: DecimalLike; costPerUnit: DecimalLike; unit?: string } | null
    }>
  }>,
  orderNumber: number,
  orderId: string,
): Promise<void> {
  // R218 G3 (epik #144 / issue #152 korak 2): kanon R182 ključavnice — prej
  // edini sale pisec BREZ advisory ključavnic (§5 G3). Vse artikle zakleni
  // PRED prvo mutacijo InventoryItem.quantity (sortirano + dedup po
  // acquireInvStockLocks → določen globalni vrstni red, deadlock nemogoč;
  // ključavnice so listi lock grafa — entitetni kontekst, order.create, je
  // že v tej transakciji izveden).
  await acquireInvStockLocks(
    tx,
    items.flatMap((item) =>
      (menuItemMap.get(item.menuItemId)?.recipeItems ?? []).map((r) => r.inventoryItem?.id ?? null),
    ),
  )

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId)
    if (!menuItem) continue
    const qty = item.quantity

    for (const recipe of menuItem.recipeItems) {
      if (!recipe.inventoryItem) continue
      // R123 (P0-05): RAW odvod = usable / yield%
      const deductQty = rawFromUsable(toNum(recipe.quantityPerServing), toNum(recipe.yieldPercent)) * qty
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
        const invItemId = recipe.inventoryItem.id
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: invItemId,
            type: 'sale',
            quantity: -deductQty,
            previousQty: prevQty,
            newQty: prevQty - deductQty,
            costPerUnit: toNum(currentInvItem.costPerUnit),
            totalCost: deductQty * toNum(currentInvItem.costPerUnit),
            reason: `QR naročilo #${orderNumber}`,
            // R218 G3: G2 kanon pariteta — QR sale StockTx nosi orderId (prej
            // edini sale pisec brez njega → createdAt fallback bucketiranje,
            // neskladno z ostalimi tremi sale pisci).
            orderId,
          },
        }).then((stockTx) =>
          // R120 (epic #115 §4) + R218 G3: FEFO razporeditev odbitka po
          // serijah (prej unbatched uhajanje — INVENTORY-CHAIN.md §5 G3).
          recordBatchConsumption(tx, {
            inventoryItemId: invItemId,
            quantity: deductQty,
            stockTransactionId: stockTx.id,
          }),
        )
      } else {
        // FIX QR-03 HIGH: Zaloga ni zadostna — ne sprejmi naročila tiho!
        throw new Error(`INSUFFICIENT_STOCK:${menuItem.name}:potrebno ${deductQty.toFixed(2)} ${recipe.inventoryItem.unit || 'enot'}, na zalogi ${toNum(currentInvItem.quantity).toFixed(2)}`)
      }
    }
  }
}

// ─── Broadcast NEW_ORDER to KDS/POS via WebSocket ───
// WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (401 — brez
// Authorization glave). Zdaj: direkten globalThis.__wsBroadcast klic +
// locationId (kjer izvedljiv) za per-location dostavo.
export function broadcastNewOrder(
  orderId: string,
  orderNumber: number,
  tableNumber?: number | string | null,
  locationId?: string | null,
): void {
  wsBroadcastEvent('NEW_ORDER', {
    orderId,
    orderNumber,
    type: 'dine-in',
    source: 'qr',
    tableNumber: tableNumber || null,
    locationId: locationId ?? null,
  })
}
