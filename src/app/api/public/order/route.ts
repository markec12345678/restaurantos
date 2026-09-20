
// =====================================================================
// PUBLIC ORDER ENDPOINT - Brez avtentikacije (za QR naročanje)
// Stranka skenira QR kodo, naroči direktno iz telefona
// Podpira oba QR frontenda: /qr-menu (tableNumber) in /qr/[tableId] (tableId)
// =====================================================================

import { db } from '@/lib/db'
import { withLocationColumnFallback } from '@/lib/prisma-column-fallback'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { checkRateLimitAsync, getClientIp, PUBLIC_ORDER_LIMIT } from '@/lib/rate-limit'
import { toNum } from '@/lib/decimal'
import { getNextOrderNumber } from '@/lib/counters'
import { logger } from '@/lib/logger'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { formatEUR } from '@/lib/safe-format'
import {

  publicOrderSchema,
  isRestaurantOpen,
  resolveTable,
  markTableOccupied,
  calculateOrderItems,
  deductInventoryInTx,
  broadcastNewOrder,
  MAX_ORDER_TOTAL,
} from './_helpers'

export const dynamic = 'force-dynamic'

// R87-3: ENOTNA validacija lokacijskega konteksta (isti kanon kot public/kiosk
// R86-3 in public/delivery-check R83): regex oblika + location.findFirst({ id,
// isActive: true }). Neznana / tuja / neaktivna / neveljavna oblika → IZKLJUČNO
// notInScopeResponse('Lokacija') 404 'Lokacija ni najden' — isti odgovor za
// "ne obstaja" in "tuja" (ni obstoja-oraklja). NIKOLI globalnega
// resolveDefaultLocationId() za pisno pot (odstranjen R86 residual).
async function resolveQrLocation(
  explicitId: string,
): Promise<{ ok: true; locationId: string } | { ok: false; response: NextResponse }> {
  if (!/^[a-z0-9]{5,50}$/i.test(explicitId)) {
    return { ok: false, response: notInScopeResponse('Lokacija') }
  }
  const location = await db.location.findFirst({
    where: { id: explicitId, isActive: true },
    select: { id: true },
  })
  if (!location) return { ok: false, response: notInScopeResponse('Lokacija') }
  return { ok: true, locationId: location.id }
}

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
    const { data, error: validationError } = await validateRequest(req, publicOrderSchema)
    if (validationError) return validationError

    const items = data.items || data.orderItems || []

    // R87-3: izrecen lokacijski kontekst — ?locationId (query, QR URL) ali
    // body.locationId (priloži ga first-party klijent). Query ima prednost
    // (konsistentno s kioskom).
    const url = new URL(req.url)
    const explicitLocationId =
      url.searchParams.get('locationId')?.trim() || data.locationId || null

    // Poišči mizo - podprto prek tableNumber (int) ali tableId (UUID)
    // MODEL A: mizo/lokacijo rešimo NAJPREJ — dining option in artikli so
    // scoped NA LOKACIJO MIZE (prej: globalni findFirst({type}) brez scopa!).
    // R84 (M2): tableNumber BREZ locationId → 400 (fail-closed). markOccupied:
    // false — resolveTable je tu READ-ONLY (write je šele po gate-ih spodaj).
    const tableResult = await resolveTable(data.tableId, data.tableNumber, explicitLocationId, { markOccupied: false })
    if (tableResult instanceof NextResponse) return tableResult
    const { tableId, tableNumber: resolvedTableNumber, locationId: tableLocationId } = tableResult

    // R87-3 FIX (R86-3 residual), fail-closed: POST NIKOLI več uporabi globalnega
    // resolveDefaultLocationId() fallbacka (prej: naročilo BREZ tabele in brez
    // lokacije — ali z ignoriranim body.locationId — padlo na PRVO AKTIVNO
    // lokacijo KATEREGA KOLI tenanta = cross-tenant žig naročila, tuj
    // per-lokacijski order counter, tuj KDS broadcast, odbitek tuje zaloge).
    //   1. izrecen ?locationId / body.locationId → VALIDIRAN (obstaja + aktiven);
    //      hkrati z mizo (tableId pot) → neujemana lokacija mize = tuji kontekst
    //      → unificiran 404 (prej je žig šel na lokacijo TUJE mize);
    //   2. brez izrecnega, z tableId (QR koda na mizi — edina oblika, ki jo QR
    //      kode dejansko kodirajo, glej tables/qr-batch: /qr/[tableId]) → lokacija
    //      iz DB vrstice mize (server-authoritative, Table.locationId NOT NULL
    //      MODEL A) — VEDNO validirana (obstaja + aktiven → sicer 404);
    //   3. brez obeh → 400 'QR naročanje ni nastavljeno' + ZERO pisnih klicev
    //      (noben order create, noben counter, noben KDS broadcast).
    let qrLocationId: string | null = null
    if (explicitLocationId) {
      const loc = await resolveQrLocation(explicitLocationId)
      if (!loc.ok) return loc.response
      if (tableLocationId && tableLocationId !== loc.locationId) {
        // tableId pripada drugi lokaciji kot izrecni kontekst — tuja kombinacija
        return notInScopeResponse('Lokacija')
      }
      qrLocationId = loc.locationId
    } else if (tableLocationId) {
      const loc = await resolveQrLocation(tableLocationId)
      if (!loc.ok) return loc.response
      qrLocationId = loc.locationId
    } else {
      return NextResponse.json({ error: 'QR naročanje ni nastavljeno — kontaktirajte osebje' }, { status: 400 })
    }

    // R83 fix: prej je bil isOpen check GLOBALEN (mešani urniki vseh tenantov)
    // in PRED resolucijo lokacije. Zdaj: urnik TOČNO TE lokacije.
    const isOpen = await isRestaurantOpen(qrLocationId)
    if (!isOpen) {
      return NextResponse.json({ error: 'Restavracija je trenutno zaprta. Naročila niso mogoča.' }, { status: 403 })
    }

    // R83-FIX (M1): miza se označi 'occupied' ŠELE po uspešnih gate-ih —
    // prej je 403 ob zaprti restavraciji pustil fantomsko zasedeno mizo
    if (tableId) {
      await markTableOccupied(tableId).catch(() => {})
    }

    // Poišči ali ustvari dining option za QR naročanje — PO LOKACIJI (MODEL A;
    // unique(type, locationId); auto-create z lokacijo mize, P2002-safe)
    // FIX QA runda 39: P1054 most (DiningOption brez locationId stolpca v Neonu)
    let diningOption = await withLocationColumnFallback('qr-order:diningOption-find', (withLoc) =>
      db.diningOption.findFirst({ where: withLoc ? { type: 'dine-in', locationId: qrLocationId } : { type: 'dine-in' } }))
    if (!diningOption) {
      try {
        diningOption = await withLocationColumnFallback('qr-order:diningOption-create', (withLoc) =>
          db.diningOption.create({
            data: { name: 'Na mestu', type: 'dine-in', isActive: true, sortOrder: 0, prepTimeMinutes: 15, locationId: withLoc ? qrLocationId : undefined } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        }))
      } catch (e: unknown) {
        // P2002 = vzporedna kreacija (unique type+location) — ponovno poišči
        if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
          diningOption = await withLocationColumnFallback('qr-order:diningOption-refind', (withLoc) =>
            db.diningOption.findFirst({ where: withLoc ? { type: 'dine-in', locationId: qrLocationId } : { type: 'dine-in' } }))
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
      return NextResponse.json({ error: `Naročilo presega maksimalni znesek ${formatEUR(MAX_ORDER_TOTAL)}. Zmanjšajte količino.` }, { status: 400 })
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
    // WS AUDIT: lokacija za per-location dostavo (KDS druge lokacije ne vidi)
    // R87-3: VALIDIRANA lokacija (prej: table.locationId ali null pri poti brez mize)
    broadcastNewOrder(order.id, order.orderNumber, resolvedTableNumber || data.tableNumber, qrLocationId)

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
