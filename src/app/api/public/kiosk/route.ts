// POST /api/public/kiosk — Self-service kiosk ordering (brez auth, rate-limited)
// Stranka na kiosku izbere artikle in plača — ustvari order + payment
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, KIOSK_LIMIT, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { getNextOrderNumber, resolveDefaultLocationId } from '@/lib/counters'
import { buildOrderItemsData, calculateOrderTotals } from '@/app/api/orders/_helpers/order-items'
import { Prisma } from '@prisma/client'
import { z } from 'zod'


const kioskOrderSchema = z.object({
  orderItems: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(200).default(''),
  })).min(1, 'Naročilo mora vsebovati vsaj en artikel'),
  diningOption: z.enum(['dine-in', 'takeout']).default('takeout'),
  tableNumber: z.string().max(10).optional(),
  customerName: z.string().max(100).default('Kiosk'),
  paymentMethod: z.enum(['cash', 'card']).default('card'),
  // FIX P4: idempotency key — brez njega React Query retry ustvari duplikat
  // (kiosk je javna naprava — network retry-ji so pogosti)
  idempotencyKey: z.string().max(100).optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX SECURITY: dodaj rate limit na GET (menu fetch) — prejšnja koda ni bila
  // omejena, napadalec je lahko z metal DB poizvedbami in izčrpal povezave.
  // Kiosk tipično naloži meni ob zagonu, 30 req/min je več kot dovolj.
  const rl = await checkRateLimitAsync('kiosk-menu', getClientIp(req), PUBLIC_MENU_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429 })
  }

  try {
    // Vrni meni za kiosk (samo aktivni artikli z alergeni)
    const menu = await db.menu.findMany({
      where: { isActive: true },
      include: {
        categories: {
          where: { menuItems: { some: { isAvailable: true } } },
          include: {
            menuItems: {
              where: { isAvailable: true },
              select: {
                id: true, name: true, description: true, price: true,
                vatRate: true, allergens: true, image: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ menus: menu })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/kiosk', 'Napaka pri pridobivanju menija')
  }
}

export async function POST(req: Request) {
  // `data` deklariran zunaj try — dostopen v catch za idempotent replay pri P2002
  let data: z.infer<typeof kioskOrderSchema> | undefined
  try {
    // Rate limiting — prepreči zlorabo kioska
    const rl = await checkRateLimitAsync('kiosk-order', getClientIp(req), KIOSK_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429 })
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    try { data = kioskOrderSchema.parse(bodyResult.data) } catch (e) { return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 }) }
    if (!data) return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })

    // Pridobi meni artikle za izračun
    const menuItemIds = data.orderItems.map(oi => oi.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      select: { id: true, name: true, price: true, vatRate: true },
    })

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo' }, { status: 400 })
    }

    // P1-8 FIX KRITIČNO: kiosk je prej ceno obravnal kot GROSS (neto = cena − DDV),
    // medtem ko jeMenuItem.price po definiciji sistema NETO (QR meni prikazuje
    // € × (1 + DDV/100); POS izračun: total = subtotal + DDV). Kiosk je s tem
    // zaračunaval MANJ kot POS za isti artikel — neusklajeno z računi/DB.
    // Sedaj: ISTI kanonični izračun (buildOrderItemsData + calculateOrderTotals).
    const vatMap = new Map(menuItems.map(mi => [mi.id, mi]))
    const { orderItemsData, subtotal } = buildOrderItemsData(data.orderItems, vatMap, 0)
    const { totalTax: tax, total } = calculateOrderTotals(orderItemsData, subtotal)

    // P1-6: kiosk naprava stoji na lokaciji — resolucija (single-tenant fallback)
    // Brez lokacije: ZAVRNI (naročilo brez lokacije bi bilo tiho izgubljeno za tenant poizvedbe)
    const kioskLocationId = await resolveDefaultLocationId()
    if (!kioskLocationId) {
      return NextResponse.json({ error: 'Kiosk ni nastavljen — kontaktirajte osebje' }, { status: 400 })
    }

    // P1-7: per-lokacijsko številčenje naročil (self-init iz MAX)
    const nextOrderNumber = await getNextOrderNumber(kioskLocationId)

    // P1-8: idempotencyKey — vedno prisoten (auto), klient lahko pošlje svojega
    const idempotencyKey = data.idempotencyKey ||
      `auto-kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    // FIX CRITICAL (Test 3.2 parity): vrni obstoječe naročilo pri replay-u
    const existingOrder = await db.order.findFirst({
      where: { idempotencyKey },
      select: { id: true, orderNumber: true, total: true, orderItems: { select: { id: true } } },
    })
    if (existingOrder) {
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        total: toNum(existingOrder.total),
        items: existingOrder.orderItems.length,
        message: `Naročilo #${existingOrder.orderNumber} že obstaja — plačaj €${toNum(existingOrder.total).toFixed(2)}`,
        idempotentReplay: true,
      }, { status: 200 })
    }

    // Ustvari naročilo (dine-in za mizo, takeout za s seboj)
    const order = await db.order.create({
      data: {
        orderNumber: nextOrderNumber,
        idempotencyKey,
        type: data.diningOption,
        status: 'pending',
        customerName: data.customerName,
        subtotal,
        tax,
        total,
        totalWithTip: total,
        paymentStatus: 'unpaid',
        paymentMethod: '',
        locationId: kioskLocationId,
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
      include: { orderItems: true },
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: toNum(order.total),
      items: order.orderItems.length,
      message: `Naročilo #${order.orderNumber} ustvarjeno na kiosku — plačaj €${toNum(order.total).toFixed(2)}`,
    }, { status: 201 })
  } catch (error: unknown) {
    // P2002 (idempotencyKey race): dva vzporedna klica z istim ključem —
    // drugi dobi unique violation → vrni obstoječe naročilo (200, ne 500)
    if (
      error && typeof error === 'object' && 'code' in error &&
      (error as { code?: string }).code === 'P2002' && data?.idempotencyKey
    ) {
      const existing = await db.order.findFirst({
        where: { idempotencyKey: data.idempotencyKey },
        select: { id: true, orderNumber: true, total: true, orderItems: { select: { id: true } } },
      })
      if (existing) {
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: toNum(existing.total),
          items: existing.orderItems.length,
          message: `Naročilo #${existing.orderNumber} že obstaja — plačaj €${toNum(existing.total).toFixed(2)}`,
          idempotentReplay: true,
        }, { status: 200 })
      }
    }
    return handleApiError(error, 'POST /api/public/kiosk', 'Napaka pri kiosk naročilu')
  }
}
