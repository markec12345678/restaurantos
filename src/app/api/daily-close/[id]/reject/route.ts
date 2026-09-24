// ============================================
// DAILY CLOSE REJECT — POST /api/daily-close/[id]/reject
// (epic #115 P0-02, R126-a)
// ============================================
// Samo admin/super_admin. PENDING_APPROVAL → REOPENED (popis sporen —
// ponoven popis): CAS updateMany (count 0 → 409 DAILY_CLOSE_NOT_PENDING),
// rejectedNote OBVEZEN (min 3), reopenCount++, audit DAILY_CLOSE_REJECTED.
// Z-poročilo ostane draft (NIČ ne spreminja).
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, isWithinScope } from '@/lib/tenant-scope'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { ljubljanaTodayStr } from '@/lib/timezone-sl'

export const dynamic = 'force-dynamic'

const rejectSchema = z.object({
  rejectedNote: z.string()
    .min(3, 'Razlog zavrnitve je obvezen (vsaj 3 znaki)')
    .max(1000, 'Razlog ne sme preseči 1000 znakov'),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // P0-C2: centralni tenant scope resolver — resolver PRED body parse (kanon)
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/daily-close/[id]/reject',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(rejectSchema, bodyResult.data)
    if (validationError) return validationError

    const employeeId = authResult.session?.employeeId ?? null
    // Snapshot imena akterja (preživi brisanje zaposlenega)
    const employee = employeeId
      ? await db.employee.findUnique({ where: { id: employeeId }, select: { name: true } })
      : null
    const reopenedByName = employee?.name ?? ''

    const close = await db.$transaction(async (tx) => {
      const existing = await tx.dailyClose.findUnique({ where: { id } })
      if (!existing || !isWithinScope(scope.locationId, existing.locationId)) {
        throw { error: 'Dnevni zaključek ni najden', status: 404 }
      }

      // CAS status claim — count 0 = ni več PENDING_APPROVAL → 409
      const cas = await tx.dailyClose.updateMany({
        where: { id, status: 'PENDING_APPROVAL' },
        data: {
          status: 'REOPENED',
          rejectedNote: data.rejectedNote,
          reopenedById: employeeId,
          reopenedByName,
          reopenedAt: new Date(),
          reopenCount: { increment: 1 },
        },
      })
      if (cas.count === 0) {
        throw { error: 'DAILY_CLOSE_NOT_PENDING', status: 409 }
      }

      const updated = await tx.dailyClose.findUnique({ where: { id } })
      if (!updated) {
        // Teoretično nemogoče (pravkar update-an) — obrambno
        throw { error: 'Dnevni zaključek ni najden', status: 404 }
      }
      return updated
    })

    await createAuditLog({
      action: 'DAILY_CLOSE_REJECTED',
      entityType: 'daily_close',
      entityId: close.id,
      details: {
        date: ljubljanaTodayStr(close.businessDate),
        countedCash: toNum(close.countedCash),
        variance: toNum(close.cashVariance),
        rejectedNote: data.rejectedNote,
      },
      userId: employeeId ?? undefined,
    })

    return NextResponse.json(deepToNumbers({ close }))
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Dnevni zaključek je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 },
      )
    }
    return structuredErrorResponse(error, 'POST /api/daily-close/[id]/reject', 'Napaka pri zavrnitvi dnevnega zaključka')
  }
}
