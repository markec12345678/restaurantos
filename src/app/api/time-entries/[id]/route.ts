
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { updateTimeEntrySchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { toNum, round2, multiply, deepToNumbers } from '@/lib/decimal'
import { syncActualTimesFromTimeEntry } from '@/lib/scheduling/actual-times-sync'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija za posodobitev časovnega vnosa
    const { data, error: validationError } = validateBody(updateTimeEntrySchema, bodyResult.data)
    if (validationError) return validationError

    // FIX MEDIUM: Preveri da časovni vnos obstaja pred posodobitvijo
    // FIX P0-C1 (IDOR): findUnique → findFirst z locationId scope (cross-tenant zaščita)
    // R86-2b (M2 razred): prej raw spread `session?.locationId ?? undefined` —
    // fail-open za non-admin seja z NULL lokacijo (cross-tenant payroll PUT:
    // payRate/totalPay tujega vnosa). Resolver: fail-closed 403 + scope pin.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/time-entries/[id]',
    })
    if ('error' in scope) return scope.error
    const existingEntry = await db.timeEntry.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existingEntry) {
      return NextResponse.json({ error: 'Časovni vnos ni najden' }, { status: 404 })
    }

    // FIX R103 (T4, plačilna integriteta): odobren vnos je NESPREMENLJIV —
    // prej je bilo payRate/clockOut vse mogoče prepisati tudi na statusu
    // 'approved' (odobrena plačila so se tiho spremenila brez sledi). Spori
    // gredo prek statusa 'disputed' (POST/konstrukcija), ne prek tihega PUT-a.
    if (existingEntry.status === 'approved') {
      return NextResponse.json(
        { error: 'Odobren časovni vnos ni več uredujiv — plačilna integriteta' },
        { status: 400 },
      )
    }

    const updateData: Record<string, unknown> = {}

    // Clock-out support
    if (data.clockOut !== undefined) {
      updateData.clockOut = data.clockOut ? new Date(data.clockOut) : new Date()
    }
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.payRate !== undefined) updateData.payRate = data.payRate

    // Auto-calculate totalMinutes and totalPay on clock-out
    // FIX MEDIUM: Vedno izračunaj totalPay iz payRate × ure — prepreči plačno goljufijo
    if (data.clockOut !== undefined) {
      const clockOutTime = updateData.clockOut as Date
      const diffMs = clockOutTime.getTime() - existingEntry.clockIn.getTime()
      const totalMinutes = Math.floor(diffMs / 60000) - (existingEntry.breakMinutes || 0)
      updateData.totalMinutes = Math.max(0, totalMinutes)
      const payRate = data.payRate !== undefined ? data.payRate : toNum(existingEntry.payRate)
      updateData.totalPay = Math.round((Math.max(0, totalMinutes) / 60) * payRate * 100) / 100
    } else if (data.payRate !== undefined) {
      // FIX HIGH: Preračunaj totalPay, če se payRate spremeni
      const clockOutTime = existingEntry.clockOut ? new Date(existingEntry.clockOut) : new Date()
      const totalMinutes = Math.max(0, Math.floor((clockOutTime.getTime() - existingEntry.clockIn.getTime()) / 60000) - (existingEntry.breakMinutes || 0))
      updateData.totalMinutes = totalMinutes
      updateData.totalPay = round2(multiply(totalMinutes / 60, data.payRate))
    }

    // FIX R103 (T3): prej NEPOGOJEN db.timeEntry.update({ where: { id } }) —
    // mid-flight izbris → P2025 → 500; scope-escape mid-flight. Zdaj: scoped
    // updateMany → count 0 → 404 (R102 F5 vzorec); odgovor iz svežega re-fetcha.
    const updated = await db.timeEntry.updateMany({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      data: updateData,
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Časovni vnos ni najden' }, { status: 404 })
    }

    const timeEntry = await db.timeEntry.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true } },
        job: { select: { id: true, name: true } },
      },
    })

    // ISSUE #36 R125: sinhronizacija dejanskih časov v StaffShift ob clock-out
    // (updateData.clockOut je vedno nastavljen, ko je bil data.clockOut prisoten).
    // Helper je notranje toleranten (try/catch + logger.warn) — nikoli ne
    // prelomi clock-out odgovora in ne spreminja statusa izmene.
    if (updateData.clockOut instanceof Date && existingEntry.employeeId) {
      await syncActualTimesFromTimeEntry({
        employeeId: existingEntry.employeeId,
        clockIn: existingEntry.clockIn,
        clockOut: updateData.clockOut,
        locationId: existingEntry.locationId ?? null,
      })
    }

    return NextResponse.json(deepToNumbers(timeEntry))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/time-entries/[id]', 'Napaka pri posodabljanju časovnega vnosa')
  }
}
