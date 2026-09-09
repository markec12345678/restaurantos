
// =====================================================================
// PUBLIC ORDER ENDPOINT - Brez avtentikacije (za QR naročanje)
// Stranka skenira QR kodo, naroči direktno iz telefona
// Podpira oba QR frontenda: /qr-menu (tableNumber) in /qr/[tableId] (tableId)
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, PUBLIC_ORDER_LIMIT } from '@/lib/rate-limit'
import { toNum } from '@/lib/decimal'
import { getNextOrderNumber, resolveDefaultLocationId } from '@/lib/counters'
import { logger } from '@/lib/logger'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
import {

  publicOrderSchema,
  isRestaurantOpen,
  resolveTable,
  calculateOrderItems,
  deductInventoryInTx,
  broadcastNewOrder,
  MAX_ORDER_TOTAL,
} from './_helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting — uporabi skupni modul
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('public-order', clientIp, PUBLIC_ORDER_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč naročil. Poskusite znova čez nekaj minut.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    // FIX: Check if restaurant is open before accepting QR orders
    const isOpen = await isRestaurantOpen()
    if (!isOpen) {
      return NextResponse.json({ error: 'Restavracija je trenutno zaprta. Naročila niso mogoča.' }, { status: 403 })
    }

    const { data, error: validationError } = await validateRequest(req, publicOrderSchema)
    if (validationError) return validationError

    const items = data.items || data.orderItems || []

    // Poišči mizo - podprto prek tableNumber (int) ali tableId (UUID)
    // MODEL A: mizo/lokacijo rešimo NAJPREJ — dining option in artikli so
    // scoped NA LOKACIJO MIZE (prej: globalni findFirst({type}) brez scopa!).
    const tableResult = await resolveTable(data.tableId, data.tableNumber)
    if (tableResult instanceof NextResponse) return tableResult
    const { tableId, tableNumber: resolvedTableNumber, locationId: resolvedLocationId } = tableResult

    const qrLocationId = resolvedLocationId || await resolveDefaultLocationId()
    if (!qrLocationId) {
      return NextResponse.json({ error: 'QR naročanje ni nastavljeno — kontaktirajte osebje' }, { status: 400 })
    }

    // Poišči ali ustvari dining option za QR naročanje — PO LOKACIJI (MODEL A;
    // unique(type, locationId); auto-create z lokacijo mize, P2002-safe)
    let diningOption = await db.diningOption.findFirst({ where: { type: 'dine-in', locationId: qrLocationId } })
    if (!diningOption) {
      try {
        diningOption = await db.diningOption.create({
          data: { name: 'Na mestu', type: 'dine-in', isActive: true, sortOrder: 0, prepTimeMinutes: 15, locationId: qrLocationId }
        })
      } catch (e: unknown) {
        // P2002 = vzporedna kreacija (unique type+location) — ponovno poišči
        if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
          diningOption = await db.diningOption.findFirst({ where: { type: 'dine-in', locationId: qrLocationId } })
        }
        if (!diningOption) throw e
      }
    }

    // Pridobi podatke o menu itemih za izračun — SAMO z menijev lokacije mize
    // (MODEL A: veriga MenuItem → Category → Menu → locationId; prej brez scopa)
    const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true,
        category: { menu: { locationId: qrLocationId } },
      },
      include: { recipeItems: { include: { inventoryItem: true } } }
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // Preveri, da vsi artikli obstajajo in so na voljo (na tej lokaciji)
    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map(m => m.id))
      const missing = menuItemIds.filter((id: string) => !foundIds.has(id))
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo', unavailableItems: missing }, { status: 400 })
    }

    // Generiraj številko naročila z atomskim counterjem
    // FIX Q04 MEDIUM: Če counter ne deluje, VRNI NAPAKO namesto neatomskega fallbacka
    // P1-7: per-lokacijsko številčenje — qrLocationId je že rešen zgoraj (MODEL A)
    let nextOrderNumber: number
    try {
      nextOrderNumber = await getNextOrderNumber(qrLocationId)
    } catch (counterErr: unknown) {
      logger.error('API', '[QR ORDER] Counter upsert failed — ZAVRNI naročilo (neatomska operacija):', counterErr)
      return NextResponse.json({ error: 'Napaka pri generiranju številke naročila. Poskusite znova.' }, { status: 503 })
    }

    // Izračunaj zneske iz strežniških podatkov (NE zaupaj klientu!)
    const { orderItemsData, subtotal, totalVat } = await calculateOrderItems(items, menuItemMap)

    if (orderItemsData.length === 0) {
      return NextResponse.json({ error: 'Noben veljaven artikel v naročilu' }, { status: 400 })
    }

    const total = subtotal + totalVat

    // FIX QR-02 HIGH: Maksimalni skupni znesek naročila — prepreči zlorabo
    if (total > MAX_ORDER_TOTAL) {
      return NextResponse.json({ error: `Naročilo presega maksimalni znesek €${MAX_ORDER_TOTAL}. Zmanjšajte količino.` }, { status: 400 })
    }

    const displayTableNum = resolvedTableNumber || data.tableNumber || '?'

    // Ustvari naročilo IN zmanjšaj zalogo v transakciji (atomarno)
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          type: 'dine-in',
          status: 'pending',
          subtotal,
          tax: totalVat,
          total,
          totalWithTip: total,
          customerName: data.customerName || `QR Miza ${displayTableNum}`,
          notes: data.notes || `QR naročilo - Miza ${displayTableNum}`,
          tableId,
          diningOptionId: diningOption!.id,
          inventoryDeducted: false,
          locationId: qrLocationId,
          orderItems: {
            create: orderItemsData,
          },
        },
        include: { orderItems: true, table: true }
      })

      // Zmanjšaj zalogo znotraj transakcije (atomarno - prepreči race condition)
      await deductInventoryInTx(tx, items, menuItemMap, nextOrderNumber)

      // Označi, da je zaloga zmanjšana
      await tx.order.update({
        where: { id: newOrder.id },
        data: { inventoryDeducted: true }
      })

      // FIX F7-5: Miza avtomatsko postane 'occupied' ob QR naročilu
      if (tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: 'occupied' },
        })
      }

      return newOrder
    })

    // FIX: Broadcast NEW_ORDER to KDS/POS via WebSocket
    // WS AUDIT: locationId mize za per-location dostavo (KDS druge lokacije ne vidi)
    broadcastNewOrder(order.id, order.orderNumber, resolvedTableNumber || data.tableNumber, resolvedLocationId ?? null)

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: String(order.orderNumber),
        status: order.status,
        total: toNum(order.total),
        estimatedTime: '15-20 min',
        tableNumber: resolvedTableNumber || data.tableNumber || null,
      }
    }, { status: 201 })

  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/public/order', [
      { match: 'INSUFFICIENT_STOCK', message: 'Artikel ni na zalogi', status: 409, extra: (parts) => ({ error: `Na žalost ${parts[1] || 'Artikel'} ni več na zalogi (${parts[2] || ''}). Prosimo, izberite drug artikel.` }) },
    ], 'Napaka pri oddaji naročila. Prosimo, poskusite znova.')
  }
}
