
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createShiftSchema } from '@/lib/validations'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { endOfDayParam, handleApiError, parsePaginationParams, parseJsonBody, validateBody } from '@/lib/api-utils'
import { resolveWriteLocationId } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

// ISSUE #36 R125 (Faza 2): legacy Shift model je UKINJEN (migracija
// 0011_shift_dedup). /api/shifts je ostal kompatibilen sloj NAD StaffShift:
//   - zahteve in odgovori ohranijo `date` polje (preslikano iz StaffShift.shiftDate)
//   - POST/PUT/DELETE pišejo izključno v StaffShift
//   - copy_week akcija (razpored UI) je zdaj dejansko podprta

// ─── Skupni preslikovalec odgovora: StaffShift vrstica + legacy `date` alias ───
function withDateAlias(row: { shiftDate: Date } & Record<string, unknown>) {
  return { ...row, date: row.shiftDate }
}

export async function GET(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za vpogled v izmene
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    // `dateFrom`/`dateTo` = izvirni parametri; `from`/`to` = alias, ki ga
    // pošilja razpored UI (useStaffScheduler/queries.ts) — prej tiho ignorirana.
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('from')
    const dateTo = searchParams.get('dateTo') || searchParams.get('to')

    const where: Record<string, unknown> = {}
    // FIX R80 (MEDIUM): findMany + count z locationId scope-om (kanonični
    // resolver). StaffShift.locationId je nullable — NULL vrstice so fail-closed
    // nevidne za lokacijsko vezane seje; super-admin (null scope) = globalno.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/shifts',
    })
    if ('error' in scope) return scope.error
    if (scope.locationId) {
      where.locationId = scope.locationId
    }
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = endOfDayParam(dateTo) // FIX r35: konec dneva
      where.shiftDate = dateFilter
    }

    // FIX HIGH: Paginacija za izmene
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    const [shifts, total] = await Promise.all([
      db.staffShift.findMany({
        where,
        orderBy: { shiftDate: 'asc' },
        take: limit,
        skip: offset,
        include: {
          employee: { select: { id: true, name: true, role: true } },
          job: { select: { id: true, name: true, basePayRate: true } },
        },
      }),
      db.staffShift.count({ where }),
    ])

    // Back-compat kontrakt: legacy UI (useShiftQueries, EmployeeManager, ...)
    // bere `date` — StaffShift vrstice dobijo alias poleg shiftDate.
    return NextResponse.json({
      shifts: shifts.map(withDateAlias),
      total,
      limit,
      offset,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/shifts', 'Napaka pri pridobivanju izmen')
  }
}

// ─── copy_week: kopiraj 7-dnevni teden izmen na ciljni teden ───
// Razpored UI (useStaffScheduler/mutations.ts) pošilja
// { action: 'copy_week', sourceDate, targetWeekStart } — prej je endpoint
// to zavril z Zod 400 (akcija ni bila poznana).
async function handleCopyWeek(
  body: Record<string, unknown>,
  scopeLocationId: string | null,
): Promise<NextResponse> {
  const sourceDate = typeof body.sourceDate === 'string' ? body.sourceDate : ''
  const targetWeekStart = typeof body.targetWeekStart === 'string' ? body.targetWeekStart : ''
  const src = new Date(sourceDate)
  const tgt = new Date(targetWeekStart)
  if (!sourceDate || !targetWeekStart || isNaN(src.getTime()) || isNaN(tgt.getTime())) {
    return NextResponse.json(
      { error: 'Neveljaven datum za kopiranje tedna (sourceDate, targetWeekStart)' },
      { status: 400 },
    )
  }
  // Zaščita pred duplikatom: kopiranje tedna na samega sebi bi podvajalo vse izmene.
  if (src.getTime() === tgt.getTime()) {
    return NextResponse.json({ error: 'Izvorni in ciljni teden sta enaka' }, { status: 400 })
  }

  // 7-dnevno okno izvornega tedna (sourceDate = začetek tedna v UI)
  const srcStart = new Date(src.getFullYear(), src.getMonth(), src.getDate())
  const srcEnd = new Date(srcStart.getTime() + 7 * 86400000)
  const diffMs = new Date(tgt.getFullYear(), tgt.getMonth(), tgt.getDate()).getTime() - srcStart.getTime()

  const sourceRows = await db.staffShift.findMany({
    where: {
      shiftDate: { gte: srcStart, lt: srcEnd },
      status: { not: 'cancelled' },
      // FIX (tenant scope): filter je OBVEZEN, ko seja ima lokacijo —
      // kopiranje je vedno znotraj scope-a seje (nikoli čez tenant-e).
      ...(scopeLocationId ? { locationId: scopeLocationId } : {}),
    },
  })

  if (sourceRows.length === 0) {
    // Idempotentno: prazen izvorni teden = uspeh brez kreacij (UI pokaže uspeh)
    return NextResponse.json({ success: true, created: 0 })
  }

  const created = await db.staffShift.createMany({
    data: sourceRows.map(row => ({
      employeeId: row.employeeId,
      jobId: row.jobId,
      shiftDate: new Date(row.shiftDate.getTime() + diffMs),
      shiftType: row.shiftType,
      startTime: row.startTime,
      endTime: row.endTime,
      role: row.role,
      notes: row.notes,
      breakMinutes: row.breakMinutes,
      // Sveža izmena: status resetiran, časovni žigi izbrisani
      status: 'scheduled' as const,
      confirmedAt: null,
      actualStart: null,
      actualEnd: null,
      locationId: row.locationId,
    })),
  })

  return NextResponse.json({ success: true, created: created.count })
}

export async function POST(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za ustvarjanje izmen
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R87-4 (LOW preostanek): centralni resolver TAKOJ za requireAuth (pred
    // body parse). Prej: resolveLocationId(session, employee ?? data.employeeId)
    // je za NULL-location sejo (manage_employees dosegljiv managerjem;
    // permission ≠ vloga) povlekel employee lookup in nato GLOBALNI
    // prva-lokacija fallback (location-fallback.ts) → izmena na PRVI lokaciji
    // KATEREGA KOLI tenanta. Zdaj: regular/manager NULL → 403; super-admin brez
    // ?locationId → 400 fail-closed (ne global-first stamp).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/shifts',
    })
    if ('error' in scope) return scope.error
    const writeLoc = resolveWriteLocationId(scope.locationId)
    if (!writeLoc.ok) return writeLoc.response
    const locationId = writeLoc.locationId

    // FIX SECURITY: centralno branje body-ja (DoS omejitev, Content-Type check).
    // Body se prebere ENKRAT — akcija 'copy_week' se detektira PRED Zod
    // validacijo (createShiftSchema ne pozna akcijskega payloada).
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const body = (bodyResult.data ?? {}) as Record<string, unknown>
    if (body.action === 'copy_week') {
      return await handleCopyWeek(body, scope.locationId)
    }

    const { data, error: validationError } = validateBody(createShiftSchema, body)
    if (validationError) return validationError

    // FIX QA runda 37: DB stolpec lokacije je NOT NULL (schema drift) —
    // lokacija je fail-closed rezolvirana iz seje zgoraj (R87-4).
    // ISSUE #36 R125: create gre v StaffShift (legacy `date` → shiftDate).
    const shift = await db.staffShift.create({
      data: {
        employeeId: data.employeeId,
        jobId: data.jobId || null,
        shiftDate: new Date(data.date),
        shiftType: data.shiftType,
        role: data.role,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        breakMinutes: data.breakMinutes,
        notes: data.notes,
        locationId,
      },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        job: { select: { id: true, name: true, basePayRate: true } },
      },
    })

    // Webhook: shift.started
    if (data.status === 'in_progress') {
      const employee = shift.employee
      // R83: locationId pass-through — tenant isolation v webhook delivery
      emitEvent('shift.started', {
        shiftId: shift.id,
        employeeName: employee?.name || '',
        jobName: shift.job?.name || '',
        role: shift.role,
      }, locationId ?? null).catch(err => logger.error('API', '[Webhook] shift.started napaka:', err))
    }

    return NextResponse.json(withDateAlias(shift), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/shifts', 'Napaka pri ustvarjanju izmene')
  }
}
