// ============================================
// STOCKTAKE DETAIL — /api/stocktakes/[id] (epic #115 P0-01, runda 121)
// ============================================
// GET   — detail z vrsticami (snapshot expected/cost + štetje + razlike)
// PATCH — vnos/popravek štetja (SAMO DRAFT = ponovno štetje). Vrstica mora
//         pripadati inventuri; variance snapshot se preračuna ob vsakem vnosu.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { z } from 'zod'
import { updateStocktakeCounts } from '../_helpers/stocktake-mutations'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  counts: z
    .array(
      z.object({
        lineId: z.string().min(1).max(100),
        countedQuantity: z.number().min(0, 'Količina ne sme biti negativna').max(1000000),
        lineNote: z.string().max(500, 'Opomba je predolga').optional(),
      }),
    )
    .min(1, 'Manjka štetje')
    .max(500),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    const { id } = await params
    if (!id || typeof id !== 'string' || id.length > 100) {
      return NextResponse.json({ error: 'Neveljaven ID inventure' }, { status: 400 })
    }

    // MODEL A: lokacijsko vezana seja vidi samo svoje inventure; super-admin
    // (null locationId) čez lokacije (pariteta z scoped lookups R80/R81-F).
    const locationScope = authResult.session?.locationId ?? null
    const stocktake = await db.stocktake.findFirst({
      where: {
        id,
        ...(locationScope ? { locationId: locationScope } : {}),
      },
      include: { lines: { orderBy: { itemName: 'asc' } } },
    })
    if (!stocktake) {
      return NextResponse.json({ error: 'Inventura ni najdena' }, { status: 404 })
    }

    return NextResponse.json({ stocktake })
  } catch (error: unknown) {
    return structuredErrorResponse(error, 'GET /api/stocktakes/[id]', 'Napaka pri pridobivanju inventure')
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    const { id } = await params
    if (!id || typeof id !== 'string' || id.length > 100) {
      return NextResponse.json({ error: 'Neveljaven ID inventure' }, { status: 400 })
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error: validationError } = validateBody(patchSchema, bodyResult.data)
    if (validationError) return validationError

    const locationScope = authResult.session?.locationId ?? null

    const stocktake = await updateStocktakeCounts({
      stocktakeId: id,
      locationScope,
      counts: data.counts,
      countedByName: authResult.session?.employeeId ?? '',
    })

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'STOCKTAKE_COUNT',
      entityType: 'Stocktake',
      entityId: id,
      details: {
        locationId: (stocktake as { locationId?: string }).locationId ?? null,
        countedLines: data.counts.length,
        countedByName: authResult.session?.employeeId ?? '',
      },
      locationId: (stocktake as { locationId?: string }).locationId ?? undefined,
    })

    return NextResponse.json({ stocktake })
  } catch (error: unknown) {
    return structuredErrorResponse(error, 'PATCH /api/stocktakes/[id]', 'Napaka pri vnosu štetja')
  }
}
