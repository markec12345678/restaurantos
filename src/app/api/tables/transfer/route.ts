// POST /api/tables/transfer — Prenesi naročilo z ene mize na drugo
// Body: { sourceTableId, targetTableId, orderId? }
// - Če orderId podan: prenese samo to naročilo
// - Če brez orderId: prenese vsa aktivna naročila s source na target
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '@/lib/structured-error'
import { transferTableOrders } from '../_helpers/table-ops'
import { z } from 'zod'
import { Prisma } from '@prisma/client'


const transferSchema = z.object({
  sourceTableId: z.string().min(1, 'Izvorna miza je obvezna'),
  targetTableId: z.string().min(1, 'Ciljna miza je obvezna'),
  orderId: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(transferSchema, bodyResult.data)
    if (validationError) return validationError

    if (data.sourceTableId === data.targetTableId) {
      return NextResponse.json({ error: 'Izvorna in ciljna miza sta isti' }, { status: 400 })
    }

    // FIX R80 (HIGH, WRITE IDOR) + FIX R86-2a (M2): resolver + scoped
    // findFirst par (fast-path 404 stopnica; R108 OR-4: dejanski pisalni
    // tok je v kanonu transferTableOrders() s tx-fresh re-readom — ti readi
    // so SAMO zgodnja 404 stopnica + vir številk miz za odgovor/audit).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'POST /api/tables/transfer',
    })
    if ('error' in scope) return scope.error
    const tableScope = scope.locationId ? { locationId: scope.locationId } : {}

    // Preveri obe mizi (scoped — findFirst namesto findUnique)
    const [sourceTable, targetTable] = await Promise.all([
      db.table.findFirst({ where: { id: data.sourceTableId, ...tableScope } }),
      db.table.findFirst({ where: { id: data.targetTableId, ...tableScope } }),
    ])
    if (!sourceTable) return notInScopeResponse('Miza')
    if (!targetTable) return notInScopeResponse('Miza')

    // R108 OR-4 (HIGH, kanon R106/R107): prenos v ENEM kanonu —
    // $transaction(Serializable) + advisory ključavnici OBEH miz
    // ('table-ops:', SORTED vrstni red → A→B ∥ B→A deadlock nemogoč) +
    // tx-fresh scoped re-read miz IN seznama naročil (prej: stale seznam,
    // NEPOGOJEN premik → plačano/preklicano naročilo prenešeno) +
    // strukturirani { error, status } throw-i.
    const result = await transferTableOrders({
      sourceTableId: data.sourceTableId,
      targetTableId: data.targetTableId,
      orderId: data.orderId ?? null,
      locationId: scope.locationId,
    })

    // Audit log
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'TABLE_TRANSFER',
      entityType: 'Table',
      entityId: data.sourceTableId,
      details: {
        sourceTableNumber: sourceTable.number,
        targetTableNumber: targetTable.number,
        targetTableId: data.targetTableId,
        ordersTransferred: result.transferredOrders.map(o => o.orderNumber),
        sourceFreed: result.sourceFreed,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Preneseno ${result.transferredOrders.length} naročil z mize ${sourceTable.number} na mizo ${targetTable.number}`,
      transferredOrders: result.transferredOrders.length,
      sourceTableStatus: result.sourceFreed ? 'available' : 'occupied',
      targetTableStatus: 'occupied',
    })
  } catch (error: unknown) {
    // R108 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Prenos je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/tables/transfer', 'Napaka pri prenosu naročila')
  }
}
