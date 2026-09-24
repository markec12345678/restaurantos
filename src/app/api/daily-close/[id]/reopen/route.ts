// ============================================
// DAILY CLOSE REOPEN — POST /api/daily-close/[id]/reopen
// (epic #115 P0-02, R126-a)
// ============================================
// Samo admin/super_admin. CLOSED → REOPENED: CAS updateMany
// (count 0 → 409 DAILY_CLOSE_NOT_CLOSED), reopenReason OBVEZEN (min 3,
// max 500), reopenCount++. Z-poročilo dneva nazaj na DRAFT (pogojni
// updateMany — status finalized/approved → draft; legacy 'approved' vrstice
// so v shemi dokumentirane in jih UI tretira kot finalizirane). Dva audit
// vnosa v vrstnem redu dogodkov: DAILY_CLOSE_REOPENED, nato Z_REPORT_REOPENED.
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

const reopenSchema = z.object({
  reopenReason: z.string()
    .min(3, 'Razlog za ponovno odpiranje je obvezen (vsaj 3 znaki)')
    .max(500, 'Razlog ne sme preseči 500 znakov'),
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
      endpoint: 'POST /api/daily-close/[id]/reopen',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(reopenSchema, bodyResult.data)
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

      // CAS status claim — count 0 = ni CLOSED (npr. PENDING_APPROVAL) → 409
      const cas = await tx.dailyClose.updateMany({
        where: { id, status: 'CLOSED' },
        data: {
          status: 'REOPENED',
          reopenCount: { increment: 1 },
          reopenedById: employeeId,
          reopenedByName,
          reopenedAt: new Date(),
          reopenReason: data.reopenReason,
        },
      })
      if (cas.count === 0) {
        throw { error: 'DAILY_CLOSE_NOT_CLOSED', status: 409 }
      }

      // Z-poročilo dneva nazaj na DRAFT — CAS where status finalized/approved
      // ('approved' = legacy shemski status, UI ga tretira kot finaliziran).
      await tx.zReport.updateMany({
        where: {
          reportDate: existing.businessDate,
          locationId: existing.locationId,
          status: { in: ['finalized', 'approved'] },
        },
        data: { status: 'draft' },
      })

      const updated = await tx.dailyClose.findUnique({ where: { id } })
      if (!updated) {
        // Teoretično nemogoče (pravkar update-an) — obrambno
        throw { error: 'Dnevni zaključek ni najden', status: 404 }
      }
      return updated
    })

    // Audit v oglednem vrstnem redu dogodkov: najprej DailyClose CAS, nato
    // Z-report prehod na draft.
    await createAuditLog({
      action: 'DAILY_CLOSE_REOPENED',
      entityType: 'daily_close',
      entityId: close.id,
      details: {
        date: ljubljanaTodayStr(close.businessDate),
        countedCash: toNum(close.countedCash),
        variance: toNum(close.cashVariance),
        reopenReason: data.reopenReason,
      },
      userId: employeeId ?? undefined,
    })
    await createAuditLog({
      action: 'Z_REPORT_REOPENED',
      entityType: 'z_report',
      entityId: close.zReportId ?? '',
      details: {
        date: ljubljanaTodayStr(close.businessDate),
        locationId: close.locationId,
        status: 'draft',
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
    return structuredErrorResponse(error, 'POST /api/daily-close/[id]/reopen', 'Napaka pri ponovnem odpiranju dnevnega zaključka')
  }
}
