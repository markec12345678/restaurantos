// ============================================
// WASTE LEDGER — razveljavitev odpada (epic #115 §3, runda 119)
// ============================================
// POST /api/waste/[id]/reverse — kompenzacijska semantika: ledger vrstica se
// NIKOLI ne briše; reverse ustvari kompenzacijski StockTransaction ('return',
// +količina nazaj) in označi WasteRecord.reversedAt. Audit trail prek
// WASTE_REVERSE AuditLog dogodka. Dvojni reverse → 409 (fail-closed).
import { createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, deepToNumbers, type DecimalLike } from '@/lib/decimal'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { reverseWasteRecord } from '../../_helpers/waste-mutations'

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
      return NextResponse.json({ error: 'Neveljaven ID zapisa' }, { status: 400 })
    }

    const reversed = (await reverseWasteRecord({
      wasteRecordId: id,
      // MODEL A: lokacijsko vezana seja vidi samo svoje zapore; super-admin
      // (null locationId) lahko razveljavi čez lokacije (enaka politika kot
      // scoped lookups R80/R81-F).
      sessionLocationId: authResult.session?.locationId ?? null,
      reversedByUserId: authResult.session?.employeeId ?? null,
    })) as {
      id: string
      locationId: string
      inventoryItemId: string
      quantity: DecimalLike
      totalCost: DecimalLike
      reason: string
      reversedAt: Date
      reversalStockTransactionId: string | null
    }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'WASTE_REVERSE',
      entityType: 'WasteRecord',
      entityId: reversed.id,
      details: {
        locationId: reversed.locationId,
        inventoryItemId: reversed.inventoryItemId,
        quantity: toNum(reversed.quantity),
        reason: reversed.reason,
        totalCost: toNum(reversed.totalCost),
        reversalStockTransactionId: reversed.reversalStockTransactionId,
      },
      locationId: reversed.locationId,
    })

    return NextResponse.json({ record: deepToNumbers(reversed) })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Razveljavitev je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 },
      )
    }
    return structuredErrorResponse(error, 'POST /api/waste/[id]/reverse', 'Napaka pri razveljavitvi odpada')
  }
}
