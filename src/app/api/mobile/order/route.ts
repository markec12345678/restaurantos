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

    // Izračunaj total
    let total = 0
    const orderItemsData = input.items.map((item) => {
      const mi = menuItems.find((m) => m.id === item.menuItemId)!
      const lineTotal = toNum(mi.price) * item.quantity
      total += lineTotal
      return {
        menuItemId: item.menuItemId,
        menuItemName: mi.name,
        quantity: item.quantity,
        price: mi.price,
        vatRate: mi.vatRate,
        vatAmount: toNum(mi.price) * 0.22 * item.quantity,
        notes: item.notes,
      }
    })

    // FIX P4: Uporabi $transaction za order.create — če klic failne med
    // order.create in orderItems.create, ostane order brez postavk (inconsistent).
    // Prisma nested create je sicer atomic, ampak izrecna transakcija je boljša
    // za future-proofing (če dodamo side effects kot inventory deduction).
    // input je zagotovo definiran tukaj — orderSchema.parse bi vržo napako če bi failal
    const validatedInput = input!
    const order = await db.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          type: validatedInput.tableId ? 'dine_in' : 'takeaway',
          tableId: validatedInput.tableId || null,
          status: 'pending',
          paymentStatus: 'unpaid',
          subtotal: total,
          tax: total * 0.22,
          total: total * 1.22,
          notes: `Mobile order from ${validatedInput.customerName}${validatedInput.customerPhone ? ` (${validatedInput.customerPhone})` : ''}`,
          idempotencyKey: validatedInput.idempotencyKey || null,
          orderItems: {
            create: orderItemsData,
          },
        } as never,
        include: {
          orderItems: true,
        },
      })
    })

    // Proži event za KDS
    const broadcastEvent = (globalThis as Record<string, unknown>).__wsBroadcast as ((type: string, payload: unknown) => void) | undefined
    broadcastEvent?.('NEW_ORDER', { orderId: order.id, orderNumber: order.orderNumber })

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
