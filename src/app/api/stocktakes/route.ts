// ============================================
// STOCKTAKE API — fizična inventura (epic #115 P0-01, runda 121)
// ============================================
// GET  /api/stocktakes — scoped seznam inventur (zgodovina + odprte) z
//                        agregati (vrstice, preštete, vrednost razlike).
// POST /api/stocktakes — nova inventura (DRAFT): snapshot teoretičnega
//                        stanja vseh artiklov obsega (lastna lokacija ALI
//                        skupni vir); idempotentno po (locationId,
//                        idempotencyKey) — retry ne ustvari dveh inventur.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { createStocktake } from './_helpers/stocktake-mutations'

export const dynamic = 'force-dynamic'

const createStocktakeSchema = z.object({
  note: z.string().max(1000, 'Opomba je predolga').default(''),
  locationId: z.string().max(100).optional(),
  // R116 kanon: client generira stabilen ključ ob submitu — retry/duplicate
  // submit vrne ISTO inventuro brez duplikata.
  idempotencyKey: z.string().min(1).max(100).optional(),
})

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/stocktakes',
    })
    if ('error' in scope) return scope.error

    const statusFilter = searchParams.get('status')

    const stocktakes = await db.stocktake.findMany({
      where: {
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const entries = stocktakes.map(st => {
      const counted = st.lines.filter(l => l.countedQuantity !== null).length
      const snapshotVarianceValue = st.lines.reduce(
        (s, l) => s + (l.varianceValue !== null ? toNum(l.varianceValue) : 0),
        0,
      )
      return {
        id: st.id,
        locationId: st.locationId,
        status: st.status,
        note: st.note,
        createdByName: st.createdByName,
        approvedByName: st.approvedByName,
        submittedAt: st.submittedAt?.toISOString() ?? null,
        approvedAt: st.approvedAt?.toISOString() ?? null,
        cancelledAt: st.cancelledAt?.toISOString() ?? null,
        recountCount: st.recountCount,
        lineCount: st.lines.length,
        countedCount: counted,
        snapshotVarianceValue: Math.round(snapshotVarianceValue * 100) / 100,
        createdAt: st.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ entries })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/stocktakes', 'Napaka pri pridobivanju inventur')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limit — pisalna pot (enaka higiena kot /api/waste)
    const rl = await checkRateLimitAsync('stocktakes', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // MODEL A: seja avtoritativna; super-admin MORA podati izrecen locationId
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/stocktakes',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(createStocktakeSchema, bodyResult.data)
    if (validationError) return validationError

    const locRes = resolveWriteLocationId(scope.locationId, data.locationId)
    if (!locRes.ok) return locRes.response
    const locationId = locRes.locationId

    const idempotencyKey = data.idempotencyKey?.trim() || null

    // Fast-path replay (R116 kanon) — pošteno 200 z ISTO inventuro
    if (idempotencyKey) {
      const existing = await db.stocktake.findFirst({
        where: { locationId, idempotencyKey },
      })
      if (existing) {
        return NextResponse.json(
          { stocktake: deepToNumbers(existing), replay: true, message: 'Inventura je že ustvarjena' },
          { status: 200 },
        )
      }
    }

    const result = await createStocktake({
      locationId,
      note: data.note,
      idempotencyKey,
      createdByName: authResult.session?.employeeId ?? '',
    })

    const stocktake = result.stocktake as { id: string; status: string; note: string }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'STOCKTAKE_CREATE',
      entityType: 'Stocktake',
      entityId: stocktake.id,
      details: {
        locationId,
        status: stocktake.status,
        note: stocktake.note,
        replay: result.replay,
      },
      locationId,
    })

    return NextResponse.json(
      { stocktake: deepToNumbers(result.stocktake), replay: result.replay },
      { status: 201 },
    )
  } catch (error: unknown) {
    // Idempotency race: dva vzporedna POST-a z istim ključem → unique constraint
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Podvojena inventura (sočasen dostop) — ponovite zahtevek z istim idempotencyKey' },
        { status: 409 },
      )
    }
    return structuredErrorResponse(error, 'POST /api/stocktakes', 'Napaka pri ustvarjanju inventure')
  }
}
