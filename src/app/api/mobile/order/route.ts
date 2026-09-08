// ============================================
// /api/mobile/order — Mobile order creation
// ============================================
// Za QR code ordering (gost naroči preko mobilne naprave).
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'
import { verifyApiKey } from '@/lib/api-security'
import { toNum } from '@/lib/decimal'
import { getNextOrderNumber, resolveDefaultLocationId } from '@/lib/counters'
import { buildOrderItemsData, calculateOrderTotals } from '@/app/api/orders/_helpers/order-items'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const orderSchema = z.object({
  tableId: z.string().optional(),
  customerName: z.string().max(100).default('Mobile Order'),
  customerPhone: z.string().max(50).optional(),
  // FIX P4 (audit 2026-09-06): Idempotency key za preprečitev duplikatov pri
  // double-click ali network retry. Brez tega se lahko isti order ustvari dvakrat.
  idempotencyKey: z.string().max(100).optional(),
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
    modifiers: z.array(z.object({
      modifierId: z.string(),
      quantity: z.number().int().min(1).default(1),
    })).default([]),
    notes: z.string().max(200).default(''),
  })).min(1, 'Vsaj 1 artikel je obvezen'),
})

// GET — pridobi status naročila (za guest tracking)
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const apiKeyResult = await verifyApiKey(authHeader)
    if (!apiKeyResult.valid) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: 'orderId je obvezen' }, { status: 400 })
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        orderItems: {
          select: {
            id: true,
            menuItemName: true,
            quantity: true,
            status: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    return handleApiError(err, 'mobile/order GET')
  }
}

// POST — ustvari mobilno naročilo
export async function POST(req: Request) {
  // FIX P4: `input` je deklariran zunaj try da je dostopen v catch bloku
  // za idempotency key lookup pri P2002 unique constraint violation.
  let input: z.infer<typeof orderSchema> | undefined
  try {
    const authHeader = req.headers.get('authorization')
    const apiKeyResult = await verifyApiKey(authHeader)
    if (!apiKeyResult.valid) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 })
    }

    if (!apiKeyResult.apiKey?.scopes.includes('write:orders') && !apiKeyResult.apiKey?.scopes.includes('admin')) {
      return NextResponse.json({ error: 'Nimaš dovoljenja za ustvarjanje naročil' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    input = orderSchema.parse(body)

    // FIX P4: Idempotency check — če idempotencyKey obstaja, preveri ali je
    // order s tem ključem že ustvarjen. Če da, vrni obstoječi (200, ne 201).
    if (input.idempotencyKey) {
      const existing = await db.order.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
        include: { orderItems: true },
      })
      if (existing) {
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: toNum(existing.total),
          estimatedReadyTime: new Date(new Date(existing.createdAt).getTime() + 15 * 60 * 1000).toISOString(),
          idempotentReplay: true, // klient ve da je to replay
        }, { status: 200 })
      }
    }

    // Pridobi meni artikle za validacijo + cene
    const menuItemIds = input.items.map((i) => i.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true, price: true, vatRate: true, isAvailable: true },
    })

    // Validiraj razpoložljivost
    for (const item of input.items) {
      const mi = menuItems.find((m) => m.id === item.menuItemId)
      if (!mi) {
        return NextResponse.json({ error: `Artikel ${item.menuItemId} ne obstaja` }, { status: 400 })
      }
      if (!mi.isAvailable) {
        return NextResponse.json({ error: `Artikel ${mi.name} ni na voljo` }, { status: 400 })
      }
    }

    // P1-6/P1-8: mobilno naročilo uporablja ISTI kanonični izračun kot POS
    // (buildOrderItemsData + calculateOrderTotals — Decimal aritmetika, DDV po
    // postavki iz DB vatRate). Prej: hardkodiran 0.22 DDV na vse artikle
    // (napačno za 9,5 % in 0 % stopnje) + manjkajoč orderNumber (create je
    // vedno padel na Prisma required-field napaki).
    const vatMap = new Map(menuItems.map(mi => [mi.id, mi]))
    const { orderItemsData, subtotal } = buildOrderItemsData(input.items, vatMap, 0)
    const { totalTax, total } = calculateOrderTotals(orderItemsData, subtotal)

    // P1-6: resolucija lokacije (miza → single-tenant fallback) — enak vzorec kot POS
    let orderLocationId: string | null = null
    if (input.tableId) {
      const table = await db.table.findUnique({
        where: { id: input.tableId },
        select: { locationId: true },
      })
      orderLocationId = table?.locationId ?? null
    }
    if (!orderLocationId) {
      orderLocationId = await resolveDefaultLocationId()
    }

    // P1-7: per-lokacijsko številčenje + FIX: idempotencyKey vedno prisoten
    // (prej: samo če ga klient pošlje — retry brez ključa je ustvaril duplikat)
    const idempotencyKey = input.idempotencyKey ||
      `auto-mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const orderNumber = await getNextOrderNumber(orderLocationId)

    // FIX P4: Uporabi $transaction za order.create — če klic failne med
    // order.create in orderItems.create, ostane order brez postavk (inconsistent).
    // Prisma nested create je sicer atomic, ampak izrecna transakcija je boljša
    // za future-proofing (če dodamo side effects kot inventory deduction).
    const validatedInput = input!
    const order = await db.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          orderNumber,
          type: validatedInput.tableId ? 'dine-in' : 'takeout',
          tableId: validatedInput.tableId || null,
          status: 'pending',
          paymentStatus: 'unpaid',
          subtotal,
          tax: totalTax,
          total,
          totalWithTip: total,
          notes: `Mobile order from ${validatedInput.customerName}${validatedInput.customerPhone ? ` (${validatedInput.customerPhone})` : ''}`,
          idempotencyKey,
          locationId: orderLocationId,
          orderItems: {
            // OrderItemData (z menuItemId skalarjem) — isti unchecked vzorec kot POS post-handler
            create: (
              orderItemsData.map(oid => ({
                ...oid,
                menuItemName: menuItems.find(m => m.id === oid.menuItemId)?.name ?? '',
              })) as Prisma.OrderItemUncheckedCreateInput[]
            ),
          },
        },
        include: {
          orderItems: true,
        },
      })
    })

    // Proži event za KDS
    // WS AUDIT: locationId za per-location dostavo (KDS druge lokacije ne vidi)
    const broadcastEvent = (globalThis as Record<string, unknown>).__wsBroadcast as ((type: string, payload: unknown) => void) | undefined
    broadcastEvent?.('NEW_ORDER', { orderId: order.id, orderNumber: order.orderNumber, locationId: order.locationId ?? null })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: toNum(order.total),
      estimatedReadyTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min ETA
    }, { status: 201 })
  } catch (err) {
    // FIX P4: P2002 = unique constraint violation na idempotencyKey —
    // vzporedni request je medtem ustvaril order z istim ključem.
    // Vrni obstoječi (race condition resolve).
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002' && input?.idempotencyKey) {
      const existing = await db.order.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
        include: { orderItems: true },
      })
      if (existing) {
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: toNum(existing.total),
          estimatedReadyTime: new Date(new Date(existing.createdAt).getTime() + 15 * 60 * 1000).toISOString(),
          idempotentReplay: true,
        }, { status: 200 })
      }
    }
    return handleApiError(err, 'mobile/order POST')
  }
}
