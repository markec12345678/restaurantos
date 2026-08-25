// POST /api/public/kiosk — Self-service kiosk ordering (brez auth, rate-limited)
// Stranka na kiosku izbere artikle in plača — ustvari order + payment
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkRateLimit, getClientIp, KIOSK_LIMIT, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
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
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX SECURITY: dodaj rate limit na GET (menu fetch) — prejšnja koda ni bila
  // omejena, napadalec je lahko z metal DB poizvedbami in izčrpal povezave.
  // Kiosk tipično naloži meni ob zagonu, 30 req/min je več kot dovolj.
  const rl = checkRateLimit('kiosk-menu', getClientIp(req), PUBLIC_MENU_LIMIT)
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
  try {
    // Rate limiting — prepreči zlorabo kioska
    const rl = checkRateLimit('kiosk-order', getClientIp(req), KIOSK_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429 })
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    let data
    try { data = kioskOrderSchema.parse(bodyResult.data) } catch (e) { return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 }) }

    // Pridobi meni artikle za izračun
    const menuItemIds = data.orderItems.map(oi => oi.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      select: { id: true, name: true, price: true, vatRate: true },
    })

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo' }, { status: 400 })
    }

    // Izračunaj totale
    let subtotal = 0
    let tax = 0
    const orderItemsData = data.orderItems.map(oi => {
      const mi = menuItems.find(m => m.id === oi.menuItemId)!
      const lineTotal = toNum(mi.price) * oi.quantity
      const lineTax = lineTotal * (toNum(mi.vatRate) / 100)
      subtotal += lineTotal - lineTax
      tax += lineTax
      return {
        menuItemId: oi.menuItemId,
        menuItemName: mi.name,
        quantity: oi.quantity,
        price: mi.price,
        vatRate: mi.vatRate,
        vatAmount: lineTax,
        notes: oi.notes,
        status: 'pending',
      }
    })

    const total = subtotal + tax

    // FIX CRITICAL (race): Atomsko generiraj orderNumber z db.counter.upsert.
    // Prejšnja koda `await db.order.count() + 1` je bila neatomska — dve sočasni
    // kiosk naročili bi dobili enako številko (unique constraint violation → 500).
    let nextOrderNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'orderNumber' },
        update: { value: { increment: 1 } },
        create: { name: 'orderNumber', value: 1 },
      })
      nextOrderNumber = counter.value
    } catch (counterErr: unknown) {
      logger.error('API', '[KIOSK] Counter upsert failed:', counterErr)
      return NextResponse.json({ error: 'Napaka pri generiranju številke naročila. Poskusite znova.' }, { status: 503 })
    }

    // Ustvari naročilo (dine-in za mizo, takeout za s seboj)
    const order = await db.order.create({
      data: {
        orderNumber: nextOrderNumber,
        type: data.diningOption,
        status: 'pending',
        customerName: data.customerName,
        subtotal,
        tax,
        total,
        totalWithTip: total,
        paymentStatus: 'unpaid',
        paymentMethod: '',
        orderItems: { create: orderItemsData },
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
    return handleApiError(error, 'POST /api/public/kiosk', 'Napaka pri kiosk naročilu')
  }
}
