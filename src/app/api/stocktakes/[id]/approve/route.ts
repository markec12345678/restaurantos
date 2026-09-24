// ============================================
// STOCKTAKE APPROVE — /api/stocktakes/[id]/approve (epic #115 P0-01)
// ============================================
// POST — IN_REVIEW → APPROVED: aplicira korekcije SKOZI zalogovni kanon
//        (R106): per vrstica advisory lock + tx-fresh zaloga + absolutna
//        nastavitev = preštetje + StockTransaction ('adjustment'/'write-off',
//        previousQty → newQty) + FEFO batch razknjižba minusa (R120 mirror).
//
// ZAŠČITA PRED DVOJNO POTRDITVIJO: pogojni status claim znotraj transakcije —
// dva vzporedna approve-a (Promise.all ali dvojni klik) povzročita natanko
// ENO aplicirano korekcijo; drugi dobi 409.
import { createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { approveStocktake } from '../../_helpers/stocktake-mutations'

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

    const result = await approveStocktake({
      stocktakeId: id,
      locationScope,
      approvedByName: authResult.session?.employeeId ?? '',
    })

    const stocktake = result.stocktake as { id: string; locationId: string; status: string }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'STOCKTAKE_APPROVE',
      entityType: 'Stocktake',
      entityId: stocktake.id,
      details: {
        locationId: stocktake.locationId,
        status: stocktake.status,
        adjustedLines: result.summary.adjustedLines,
        totalVarianceValue: result.summary.totalVarianceValue,
        adjustments: result.summary.lines,
      },
      locationId: stocktake.locationId,
    })

    return NextResponse.json({ stocktake: result.stocktake, summary: result.summary })
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
    return structuredErrorResponse(error, 'POST /api/stocktakes/[id]/approve', 'Napaka pri potrditvi inventure')
  }
}
