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
import { notInScopeResponse } from '@/lib/tenant-scope'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// FIX R81-F (LEAK-HIGH+MEDIUM): inline role-aware fail-closed gate (zrcali
// resolveCatalogScope semantiko; subscription platformAdminGate stil — brez
// tenant-scope helperjev). kot je take_orders staff ruta — non-admin BREZ
// session.locationId = 403 (data integrity issue), ker scope-a ni mogoče
// izpeljati in bi videl kuhinjske liste VSEH tenantov.
function requireKotLocationScope(
  authResult: { session?: { role?: string; locationId?: string | null } | null },
): { sessionLocId: string | null } | { error: NextResponse } {
  const session = authResult.session
  const sessionLocId = session?.locationId ?? null
  const isRoleAdmin = session?.role === 'admin' || session?.role === 'super_admin'
  if (!sessionLocId && !isRoleAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      ),
    }
  }
  return { sessionLocId }
}

// GET — Seznam KOT dokumentov za naročilo
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    // FIX R81-F: scope gate
    const scope = requireKotLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const type = searchParams.get('type')

    // FIX R81-F (LEAK-MEDIUM): seznam je bil globalen — kuhinjski listi
    // (artikli, notes, mize, employee) VSEH tenantov za take_orders staff.
    // KotDocument nima lastnega locationId — scope prek relacije
    // kotDocument.order.locationId (Order.locationId NOT NULL). Kuhinjski
    // display-i brez searchParams dobijo samo svojo lokacijo (session),
    // ?locationId query override namerno NE obstaja.
    const where: Record<string, unknown> = {
      ...(sessionLocId ? { order: { locationId: sessionLocId } } : {}),
    }
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
    // FIX R81-F: scope gate
    const scope = requireKotLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = createKotSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: error.issues }, { status: 400 })
    }

    // Preveri da order obstaja
    // FIX R81-F (LEAK-HIGH, WRITE IDOR): order lookup je bil nescopecan
    // (findUnique po raw ID) — staff je lahko izdal KOT dokument za TUJE
    // naročilo. findFirst z locationId scope (P0-C1 pattern; Order.locationId
    // NOT NULL) — izven scope-a ali neobstoječe = enak 404 (brez razkritja).
    const order = await db.order.findFirst({
      where: {
        id: data.orderId,
        ...(sessionLocId ? { locationId: sessionLocId } : {}),
      },
      select: { id: true, orderNumber: true, tableId: true, type: true },
    })
    if (!order) {
      return notInScopeResponse('Naročilo')
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
