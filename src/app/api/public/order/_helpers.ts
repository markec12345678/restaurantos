// Pomožne funkcije za javna QR naročila
// POST /api/public/order — pomožni modul za sheme, validacije, izračune in zalogo

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { toNum, calcVat, type DecimalLike } from '@/lib/decimal'
import { logger } from '@/lib/logger'

// ─── Sheme za validacijo ───
export const publicOrderItemSchema = z.object({
  menuItemId: z.string().min(1, 'ID artikla je obvezen').max(100, 'ID artikla ne sme preseči 100 znakov'),
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(20, 'Maksimalno 20 enot na artikel'),
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  modifiersJson: z.string().max(2000, 'Modifikatorji ne smejo preseči 2000 znakov').default('[]'),
})

export const publicOrderSchema = z.object({
  tableId: z.string().max(100, 'ID mize ne sme preseči 100 znakov').optional(),
  tableNumber: z.union([z.string().max(10, 'Številka mize ne sme preseči 10 znakov'), z.number().int().min(1, 'Številka mize mora biti vsaj 1').max(999, 'Številka mize ne sme preseči 999')]).optional(),
  customerName: z.string().max(100, 'Ime stranke ne sme preseči 100 znakov').default(''),
  customerPhone: z.string().max(30, 'Telefon ne sme preseči 30 znakov').default(''),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
  items: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
  orderItems: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
}).refine(data => data.items?.length || data.orderItems?.length, {
  message: 'Naročilo mora vsebovati vsaj en artikel',
})

// ─── Konstante ───
export const MAX_ORDER_TOTAL = 2000 // €2000 max za QR naročilo

// ─── Preveri, ali je restavracija odprta ───
export async function isRestaurantOpen(): Promise<boolean> {
  try {
    const hours = await db.openingHours.findMany({ where: {} })
    if (!hours || hours.length === 0) return false
    // FIX MEDIUM: Uporabi slovenski čas (CET/CEST), ne strežnikov lokalni čas
    const slovenianTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Ljubljana' })
    const now = new Date(slovenianTime)
    const dayOfWeek = now.getDay()
    const todayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
    if (!todayHours || todayHours.isClosed) return false

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (todayHours.openTime && currentTime < todayHours.openTime) return false
    if (todayHours.closeTime && currentTime > todayHours.closeTime) return false
    return true
  } catch {
    return false
  }
}

// ─── Poišči mizo — podprto prek tableNumber (int) ali tableId (UUID) ───
export interface ResolvedTable {
  tableId: string | undefined
  tableNumber: number | undefined
}

export async function resolveTable(
  tableId?: string,
  tableNumber?: string | number,
): Promise<ResolvedTable | NextResponse> {
  if (tableId) {
    // QR /qr/[tableId] pošilja UUID tableId
    const table = await db.table.findUnique({ where: { id: tableId } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena. Skennirajte QR kodo na mizi.' }, { status: 400 })
    }
    // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
    if (table.status === 'available' || table.status === 'occupied') {
      await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
    }
    return { tableId: table.id, tableNumber: table.number }
  }

  if (tableNumber) {
    const tableNum = parseInt(String(tableNumber), 10)
    if (isNaN(tableNum) || tableNum < 1 || tableNum > 999) {
      return NextResponse.json({ error: 'Neveljavna številka mize' }, { status: 400 })
    }
    const table = await db.table.findFirst({ where: { number: tableNum } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena. Obvestite natakarja.' }, { status: 400 })
    }
    // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
    if (table.status === 'available' || table.status === 'occupied') {
      await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
    }
    return { tableId: table.id, tableNumber: tableNum }
  }

  return { tableId: undefined, tableNumber: undefined }
}

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
