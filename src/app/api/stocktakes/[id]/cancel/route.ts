// ============================================
// STOCKTAKE CANCEL — /api/stocktakes/[id]/cancel (epic #115 P0-01)
// ============================================
// POST — DRAFT | IN_REVIEW → CANCELLED: brez korekcij zaloge (štetje
//        opuščeno). APPROVED ni mogoče preklicati (ledger ostaja resnica).
//        Pogojni status guard → dvojni cancel = 409 (fail-closed).
import { createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { cancelStocktake } from '../../_helpers/stocktake-mutations'

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
      return NextResponse.json({ error: 'Neveljaven ID inventure' }, { status: 400 })
    }

    const locationScope = authResult.session?.locationId ?? null

    const stocktake = (await cancelStocktake({
      stocktakeId: id,
      locationScope,
    })) as { id: string; locationId: string; status: string }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'STOCKTAKE_CANCEL',
      entityType: 'Stocktake',
      entityId: stocktake.id,
      details: { locationId: stocktake.locationId, status: stocktake.status },
      locationId: stocktake.locationId,
    })

    return NextResponse.json({ stocktake })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Inventura je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 },
      )
    }
    return structuredErrorResponse(error, 'POST /api/stocktakes/[id]/cancel', 'Napaka pri preklicu inventure')
  }
}
