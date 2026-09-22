// POST /api/tables/merge — Združi dve mizi v eno
// Body: { sourceTableId, targetTableId }
// Vsa aktivna naročila s source mize se prenesejo na target mizo.
// Če ima target miza že odprto naročilo, se artikli združijo v obstoječe naročilo.
// Source miza se sprosti (status=available).
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '@/lib/structured-error'
import { mergeTables } from '../_helpers/table-ops'
import { z } from 'zod'
import { Prisma } from '@prisma/client'


const mergeSchema = z.object({
  sourceTableId: z.string().min(1, 'Izvorna miza je obvezna'),
  targetTableId: z.string().min(1, 'Ciljna miza je obvezna'),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R86-2c1 (M2): resolver — OBE mizi morata biti v scope-u.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/tables/merge',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(mergeSchema, bodyResult.data)
    if (validationError) return validationError

    if (data.sourceTableId === data.targetTableId) {
      return NextResponse.json({ error: 'Izvorna in ciljna miza sta isti' }, { status: 400 })
    }

    // BUG-HUNT FIX 2026-09-19 (HIGH, cross-tenant) + R86-2c1 (M2): scoped
    // fast-path findFirst par (zgodnja 404 stopnica; R108 OR-5: dejanski
    // pisalni tok je v kanonu mergeTables() s tx-fresh re-readom — ti readi
    // so SAMO zgodnja stopnica + vir številk miz za odgovor/audit).
    const [sourceTable, targetTable] = await Promise.all([
      db.table.findFirst({
        where: { id: data.sourceTableId, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      }),
      db.table.findFirst({
        where: { id: data.targetTableId, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      }),
    ])
    if (!sourceTable) return NextResponse.json({ error: 'Izvorna miza ni najdena' }, { status: 404 })
    if (!targetTable) return NextResponse.json({ error: 'Ciljna miza ni najdena' }, { status: 404 })
    // Admin (brez lokacijske seje): obe mizi morata biti vsaj na isti lokaciji
    if (sourceTable.locationId && targetTable.locationId && sourceTable.locationId !== targetTable.locationId) {
      return NextResponse.json({ error: 'Mizi nista na isti lokaciji' }, { status: 400 })
    }

    // R108 OR-5 (HIGH, kanon R106/R107): združitev v ENEM kanonu —
    // $transaction(Serializable) + advisory ključavnici OBEH miz ('table-ops:',
    // SORTED → deadlock nemogoč) + tx-fresh re-read naročil IN artiklov (prej:
    // stale outer seznam → artikli dodani med branjem in tx ostali na
    // preklicanem naročilu = orphaned revenue) + CAS cancel source naročil
    // (status+paymentStatus v where — prej NEPOGOJEN update → plačano
    // naročilo preklicano) + recalc totals iz TX-FRESH podatkov (prej stale
    // discount/tip → lost update) + strukturirani throw-i.
    const result = await mergeTables({
      sourceTableId: data.sourceTableId,
      targetTableId: data.targetTableId,
      locationId: scope.locationId,
    })

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'TABLE_MERGE',
      entityType: 'Table',
      entityId: data.sourceTableId,
      details: {
        sourceTableNumber: sourceTable.number,
        targetTableNumber: targetTable.number,
        targetTableId: data.targetTableId,
        mergedOrderIds: result.mergedOrderIds,
        itemsMerged: result.totalItemsMerged,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Miza ${sourceTable.number} združena z mizo ${targetTable.number}`,
      itemsMerged: result.totalItemsMerged,
      sourceTableStatus: 'available',
      targetTableStatus: 'occupied',
    })
  } catch (error: unknown) {
    // R108 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Združitev je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/tables/merge', 'Napaka pri združevanju miz')
  }
}
