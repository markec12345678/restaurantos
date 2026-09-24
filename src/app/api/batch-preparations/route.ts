// ============================================
// BATCH PREPARATION API — priprava vmesnih produktov (epic #115 P0-04, runda 122)
// ============================================
// GET  /api/batch-preparations — scoped seznam priprav (zgodovina + odprte)
//                                z agregati (vrstice, skupni strošek).
// POST /api/batch-preparations — nova priprava (DRAFT): sestavine → izdelek;
//                                idempotentno po (locationId, idempotencyKey)
//                                — retry ne ustvari dveh priprav.
// Zaključek/preklic: POST /api/batch-preparations/[id]/complete | /cancel.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { createBatchPreparation } from './_helpers/batch-preparation-mutations'

export const dynamic = 'force-dynamic'

// Združena validacija vrstic (pariteta z mutacijami; napake semantike —
// distinct, output ≠ sestavina, obseg lokacije — lovi mutations kanon)
const lineSchema = z.object({
  inventoryItemId: z
    .string()
    .min(5)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, 'Neveljaven ID sestavine'),
  quantity: z
    .number()
    .positive('Količina sestavine mora biti večja od 0')
    .max(1_000_000, 'Količina je prevelika'),
})

const createBatchPreparationSchema = z.object({
  outputItemId: z
    .string()
    .min(5)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, 'Neveljaven ID izhodnega artikla'),
  outputQuantity: z
    .number()
    .positive('Proizvedena količina mora biti večja od 0')
    .max(1_000_000, 'Količina je prevelika'),
  note: z.string().max(1000, 'Opomba je predolga').default(''),
  locationId: z.string().max(100).optional(),
  // R116 kanon: client generira stabilen ključ ob submitu — retry/duplicate
  // submit vrne ISTO pripravo brez duplikata.
  idempotencyKey: z.string().min(1).max(100).optional(),
  lines: z.array(lineSchema).min(1, 'Priprava potrebuje vsaj eno sestavino').max(50),
})

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/batch-preparations',
    })
    if ('error' in scope) return scope.error

    const statusFilter = searchParams.get('status')

    const preparations = await db.batchPreparation.findMany({
      where: {
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        lines: true,
        outputItem: { select: { name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const entries = preparations.map(bp => ({
      id: bp.id,
      locationId: bp.locationId,
      status: bp.status,
      outputItemId: bp.outputItemId,
      outputItemName: bp.outputItem?.name ?? '',
      outputUnit: bp.outputUnit || bp.outputItem?.unit || '',
      outputQuantity: bp.outputQuantity,
      outputCostPerUnit: bp.outputCostPerUnit,
      totalInputCost: bp.totalInputCost,
      note: bp.note,
      createdByName: bp.createdByName,
      completedByName: bp.completedByName,
      completedAt: bp.completedAt?.toISOString() ?? null,
      cancelledAt: bp.cancelledAt?.toISOString() ?? null,
      lineCount: bp.lines.length,
      createdAt: bp.createdAt.toISOString(),
    }))

    return NextResponse.json({ entries })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/batch-preparations', 'Napaka pri pridobivanju priprav')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limit — pisalna pot (enaka higiena kot /api/stocktakes)
    const rl = await checkRateLimitAsync('batch-preparations', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // MODEL A: seja avtoritativna; super-admin MORA podati izrecen locationId
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/batch-preparations',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(createBatchPreparationSchema, bodyResult.data)
    if (validationError) return validationError

    const locRes = resolveWriteLocationId(scope.locationId, data.locationId)
    if (!locRes.ok) return locRes.response
    const locationId = locRes.locationId

    const idempotencyKey = data.idempotencyKey?.trim() || null

    // Fast-path replay (R116 kanon) — pošteno 200 z ISTO pripravo
    if (idempotencyKey) {
      const existing = await db.batchPreparation.findFirst({
        where: { locationId, idempotencyKey },
      })
      if (existing) {
        return NextResponse.json(
          { preparation: deepToNumbers(existing), replay: true, message: 'Priprava je že ustvarjena' },
          { status: 200 },
        )
      }
    }

    const result = await createBatchPreparation({
      locationId,
      outputItemId: data.outputItemId,
      outputQuantity: data.outputQuantity,
      note: data.note,
      idempotencyKey,
      createdByName: authResult.session?.employeeId ?? '',
      lines: data.lines,
    })

    const preparation = result.preparation as { id: string; status: string }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'BATCHPREP_CREATE',
      entityType: 'BatchPreparation',
      entityId: preparation.id,
      details: {
        locationId,
        status: preparation.status,
        outputItemId: data.outputItemId,
        outputQuantity: data.outputQuantity,
        lineCount: data.lines.length,
        replay: result.replay,
      },
      locationId,
    })

    return NextResponse.json(
      { preparation: deepToNumbers(result.preparation), replay: result.replay },
      { status: 201 },
    )
  } catch (error: unknown) {
    // Idempotency race: dva vzporedna POST-a z istim ključem → unique constraint
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Podvojena priprava (sočasen dostop) — ponovite zahtevek z istim idempotencyKey' },
        { status: 409 },
      )
    }
    return structuredErrorResponse(error, 'POST /api/batch-preparations', 'Napaka pri ustvarjanju priprave')
  }
}
