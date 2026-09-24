// ============================================
// POST /api/batch-preparations/[id]/complete — zaključek priprave
// ============================================
// ENA Serializabilna transakcija (kanon v _helpers/batch-preparation-mutations):
//   sestavine CAS decrement ('batch-consumption' + FEFO razknjižba R120) →
//   izdelek CAS increment + proizvodni cost basis ('batch-production') →
//   header snapshot. Pogojni status claim: dvojni complete → natanko ENA
//   poraba (409). Scope pariteta s stocktakes/[id]/approve (R121).
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { createAuditLog } from '@/lib/db'
import { completeBatchPreparation } from '../../_helpers/batch-preparation-mutations'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    const { id } = await params
    if (!id || typeof id !== 'string' || id.length > 100) {
      return NextResponse.json({ error: 'Neveljaven ID priprave' }, { status: 400 })
    }

    const locationScope = authResult.session?.locationId ?? null

    const result = await completeBatchPreparation({
      preparationId: id,
      locationScope,
      completedByName: authResult.session?.employeeId ?? '',
    })

    const preparation = result.preparation as { id: string; locationId: string; status: string }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'BATCHPREP_COMPLETE',
      entityType: 'BatchPreparation',
      entityId: preparation.id,
      details: {
        locationId: preparation.locationId,
        status: preparation.status,
        totalInputCost: result.summary.totalInputCost,
        outputCostPerUnit: result.summary.outputCostPerUnit,
        outputQuantity: result.summary.outputQuantity,
        consumedLines: result.summary.inputs.length,
      },
      locationId: preparation.locationId,
    })

    return NextResponse.json({ preparation: result.preparation, summary: result.summary })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Priprava je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 },
      )
    }
    return structuredErrorResponse(error, 'POST /api/batch-preparations/[id]/complete', 'Napaka pri zaključku priprave')
  }
}
