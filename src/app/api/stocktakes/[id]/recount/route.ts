// ============================================
// STOCKTAKE RECOUNT — /api/stocktakes/[id]/recount (epic #115 P0-01)
// ============================================
// POST — IN_REVIEW → DRAFT: pregled pošlje štetje nazaj v ponovno štetje
//        (recountCount++). Med DRAFT se količine smejo popravljati (PATCH).
//        Pogojni status guard → dvojni recount = 409 (fail-closed).
import { createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { recountStocktake } from '../../_helpers/stocktake-mutations'

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

    const stocktake = (await recountStocktake({
      stocktakeId: id,
      locationScope,
    })) as { id: string; locationId: string; status: string; recountCount: number }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'STOCKTAKE_RECOUNT',
      entityType: 'Stocktake',
      entityId: stocktake.id,
      details: {
        locationId: stocktake.locationId,
        status: stocktake.status,
        recountCount: stocktake.recountCount,
      },
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
    return structuredErrorResponse(error, 'POST /api/stocktakes/[id]/recount', 'Napaka pri povratku v ponovno štetje')
  }
}
