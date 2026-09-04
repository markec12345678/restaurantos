// ============================================
// KOT (Kitchen Order Ticket) API — URY Mosaic-style
// ============================================
// GET  /api/kot?orderId=xxx — Seznam KOT dokumentov za naročilo
// POST /api/kot — Ustvari nov KOT (original/modified/cancelled)
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { getNextCounter } from '@/lib/counters'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET — Seznam KOT dokumentov za naročilo
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (orderId) where.orderId = orderId
    if (type) where.type = type

    const kots = await db.kotDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      kots: deepToNumbers(kots),
      total: kots.length,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/kot', 'Napaka pri pridobivanju KOT dokumentov')
  }
}

// POST — Ustvari nov KOT dokument
const createKotSchema = z.object({
  orderId: z.string().min(1),
  type: z.enum(['original', 'modified', 'partially_cancelled', 'cancelled']).default('original'),
  itemsJson: z.string().default('[]'),
  orderNotes: z.string().default(''),
  tableNumber: z.number().int().optional(),
  orderType: z.enum(['dine-in', 'takeout', 'delivery']).default('dine-in'),
  previousKotId: z.string().optional(),
  cancelReason: z.string().default(''),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = createKotSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: error.issues }, { status: 400 })
    }

    // Preveri da order obstaja
    const order = await db.order.findUnique({
      where: { id: data.orderId },
      select: { id: true, orderNumber: true, tableId: true, type: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // Pridobi številko mize če ni podana
    let tableNumber = data.tableNumber
    if (tableNumber === undefined && order.tableId) {
      const table = await db.table.findUnique({
        where: { id: order.tableId },
        select: { number: true },
      })
      tableNumber = table?.number
    }

    // Pridobi številko KOT iz counterja
    const kotNumber = await getNextCounter('kotNumber')

    // Ustvari KOT dokument
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kot = await (db.kotDocument as any).create({
      data: {
        kotNumber,
        orderId: data.orderId,
        type: data.type,
        itemsJson: data.itemsJson,
        orderNotes: data.orderNotes,
        tableNumber: tableNumber ?? null,
        orderType: data.orderType,
        status: data.type === 'cancelled' ? 'cancelled' : 'pending',
        cancelledAt: data.type === 'cancelled' ? new Date() : null,
        cancelReason: data.cancelReason,
        previousKotId: data.previousKotId,
        employeeId: authResult.session?.employeeId,
        firedAt: data.type === 'original' ? new Date() : null,
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    })

    logger.info('KOT', `Ustvarjen KOT #${kot.kotNumber} (${data.type}) za naročilo #${order.orderNumber}`)

    return NextResponse.json(deepToNumbers(kot), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/kot', 'Napaka pri ustvarjanju KOT dokumenta')
  }
}
