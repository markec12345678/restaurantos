// ============================================
// DAILY CLOSE APPROVE — POST /api/daily-close/[id]/approve
// (epic #115 P0-02, R126-a)
// ============================================
// Samo admin/super_admin. PENDING_APPROVAL → CLOSED: CAS updateMany
// (count 0 → 409 DAILY_CLOSE_NOT_PENDING), nato Z-poročilo dneva finalize
// (actualCash = countedCash; Z_REPORT_FINALIZED = idempotentno OK) + audit
// DAILY_CLOSE_APPROVED.
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
import { upsertZReportForDay } from '@/app/api/z-report/_helpers'

export const dynamic = 'force-dynamic'

const approveSchema = z.object({
  approvalNote: z.string().max(1000, 'Opomba ne sme preseči 1000 znakov').default(''),
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
      endpoint: 'POST /api/daily-close/[id]/approve',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(approveSchema, bodyResult.data)
    if (validationError) return validationError

    const employeeId = authResult.session?.employeeId ?? null
    // Snapshot imena odobritelja (preživi brisanje zaposlenega)
    const employee = employeeId
      ? await db.employee.findUnique({ where: { id: employeeId }, select: { name: true } })
      : null
    const approvedByName = employee?.name ?? ''

    const close = await db.$transaction(async (tx) => {
      const existing = await tx.dailyClose.findUnique({ where: { id } })
      if (!existing || !isWithinScope(scope.locationId, existing.locationId)) {
        throw { error: 'Dnevni zaključek ni najden', status: 404 }
      }

      // CAS status claim — dva vzporedna approve-a → natanko ENA potrditev,
      // drugi dobi count 0 → 409 (vzorec R104 CAS).
      const cas = await tx.dailyClose.updateMany({
        where: { id, status: 'PENDING_APPROVAL' },
        data: {
          status: 'CLOSED',
          approvedById: employeeId,
          approvedByName,
          approvedAt: new Date(),
          approvalNote: data.approvalNote,
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

    // Z-poročilo dneva finalize (po transakciji) — actualCash = countedCash,
    // notes = approvalNote ali obstoječe notes dnevnega zaključka.
    try {
      await upsertZReportForDay({
        date: ljubljanaTodayStr(close.businessDate),
        locationId: close.locationId,
        actualCash: toNum(close.countedCash),
        notes: data.approvalNote || close.notes,
        finalize: true,
        employeeId,
      })
    } catch (zErr) {
      const msg = zErr instanceof Error ? zErr.message : String(zErr)
      if (msg !== 'Z_REPORT_FINALIZED') throw zErr // Z_REPORT_CONFLICT → 409 passthrough
      // že finalizirano — idempotentno OK
    }

    await createAuditLog({
      action: 'DAILY_CLOSE_APPROVED',
      entityType: 'daily_close',
      entityId: close.id,
      details: {
        date: ljubljanaTodayStr(close.businessDate),
        countedCash: toNum(close.countedCash),
        variance: toNum(close.cashVariance),
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
    return structuredErrorResponse(error, 'POST /api/daily-close/[id]/approve', 'Napaka pri odobritvi dnevnega zaključka')
  }
}
