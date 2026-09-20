
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createShiftSchema } from '@/lib/validations'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { endOfDayParam, handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import { resolveWriteLocationId } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za vpogled v izmene
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}
    // FIX R80 (MEDIUM): findMany + count BREZ locationId — razporedi +
    // basePayRate VSEH tenantov (manage_employees). Shift.locationId obstaja
    // (nullable — legacy vrstice brez lokacije so fail-closed nevidne).
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
      where.date = dateFilter
    }

    // FIX HIGH: Paginacija za izmene
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    const [shifts, total] = await Promise.all([
      db.shift.findMany({
        where,
        orderBy: { date: 'asc' },
        take: limit,
        skip: offset,
        include: {
          employee: { select: { id: true, name: true, role: true } },
          job: { select: { id: true, name: true, basePayRate: true } },
        },
      }),
      db.shift.count({ where }),
    ])

    return NextResponse.json({ shifts, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/shifts', 'Napaka pri pridobivanju izmen')
  }
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

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createShiftSchema)
    if (validationError) return validationError

    // FIX QA runda 37: DB stolpec Shift.locationId je NOT NULL (schema drift) —
    // lokacija je fail-closed rezolvirana iz seje zgoraj (R87-4).
    const shift = await db.shift.create({
      data: {
        employeeId: data.employeeId,
        jobId: data.jobId || null,
        date: new Date(data.date),
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
      }, locationId ?? null).catch(err => logger.error('API', '[Webhook] shift.started napaka:', err))
    }

    return NextResponse.json(shift, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/shifts', 'Napaka pri ustvarjanju izmene')
  }
}
