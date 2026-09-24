// ============================================
// POST /api/batch-preparations/[id]/cancel — preklic osnutka priprave
// ============================================
// Samo DRAFT → CANCELLED (brez zalogovnih učinkov). COMPLETED priprava je
// nespremenljiva (ledger je resnica) → 409. Scope pariteta s
// stocktakes/[id]/cancel (R121).
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { createAuditLog } from '@/lib/db'
import { cancelBatchPreparation } from '../../_helpers/batch-preparation-mutations'

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

    const cancelled = await cancelBatchPreparation({
      preparationId: id,
      locationScope,
    })

    const preparation = cancelled as { id: string; locationId: string; status: string }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'BATCHPREP_CANCEL',
      entityType: 'BatchPreparation',
      entityId: preparation.id,
      details: { locationId: preparation.locationId, status: preparation.status },
      locationId: preparation.locationId,
    })

    return NextResponse.json({ preparation: cancelled })
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
    return structuredErrorResponse(error, 'POST /api/batch-preparations/[id]/cancel', 'Napaka pri preklicu priprave')
  }
}
