
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createTimeEntrySchema } from '@/lib/validations'
import { toNum, round2, multiply, deepToNumbers } from '@/lib/decimal'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse, resolveWriteLocationId } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za vpogled v časovne vnose
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // R80 FIX HIGH (aggregate leak): prej je GET izpostavljal plače (payRate/
    // totalPay) in delovne ure VSEH lokacij (manage_employees dosegljiv
    // managerjem). TimeEntry ima lasten locationId stolpec. Fail-closed;
    // null scope (super-admin) = globalni pogled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/time-entries',
    })
    if ('error' in scope) return scope.error

    const employeeId = searchParams.get('employeeId')
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {
      // R80: tenant filter — findMany + count oba dedita ta where
      // (null scope = PRAZEN filter, nikoli { locationId: null })
      ...(scope.locationId ? { locationId: scope.locationId } : {}),
    }
    if (employeeId) where.employeeId = employeeId
    if (jobId) where.jobId = jobId
    if (status) where.status = status
    if (type) where.type = type

    // FIX HIGH: Paginacija za časovne vnose
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    const [timeEntries, total] = await Promise.all([
      db.timeEntry.findMany({
        where,
        orderBy: { clockIn: 'desc' },
        take: limit,
        skip: offset,
        include: {
          employee: { select: { id: true, name: true, role: true } },
          job: { select: { id: true, name: true, basePayRate: true } },
        },
      }),
      db.timeEntry.count({ where }),
    ])

    return NextResponse.json({ timeEntries: deepToNumbers(timeEntries), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/time-entries', 'Napaka pri pridobivanju časovnih vnosov')
  }
}

export async function POST(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za ustvarjanje časovnih vnosov
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R87-4 (LOW preostanek): centralni resolver TAKOJ za requireAuth (pred
    // body parse), nadomesti R81-G inline gate + legacy resolveLocationId žig.
    // Prej je super-admin (role-admin, NULL session.locationId) prek
    // resolveLocationId(NULL, employeeId) dobil GLOBALNI prva-lokacija fallback
    // (location-fallback.ts) → payroll vnos (payRate/totalPay!) na PRVI lokaciji
    // KATEREGA KOLI tenanta. Zdaj: regular/manager NULL → 403 fail-closed (isto
    // kot R81-G gate); super-admin brez ?locationId → 400 fail-closed.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/time-entries',
    })
    if ('error' in scope) return scope.error
    const writeLoc = resolveWriteLocationId(scope.locationId)
    if (!writeLoc.ok) return writeLoc.response
    const locationId = writeLoc.locationId
    const sessionLocId = scope.locationId

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createTimeEntrySchema)
    if (validationError) return validationError

    // Izračunaj totalMinutes in totalPay strežniško
    const clockIn = new Date(data.clockIn)
    const clockOut = data.clockOut ? new Date(data.clockOut) : null
    let totalMinutes = 0
    let payRate = 0
    let totalPay = 0

    // FIX HIGH: Preveri, da zaposleni nima že odprtega časovnega vnosa (clockIn brez clockOut)
    // Brez tega bi lahko ustvarili več aktivnih vnosov za enega zaposlenega
    if (!clockOut) {
      const openEntry = await db.timeEntry.findFirst({
        where: {
          employeeId: data.employeeId,
          clockOut: null,
          status: { notIn: ['cancelled'] },
        },
      })
      if (openEntry) {
        return NextResponse.json({
          error: `Zaposleni že ima odprt časovni vnos (ID: ${openEntry.id}, prijava: ${openEntry.clockIn.toISOString()})`,
          existingEntry: { id: openEntry.id, clockIn: openEntry.clockIn },
        }, { status: 409 })
      }
    }

    if (clockOut) {
      const diffMs = clockOut.getTime() - clockIn.getTime()
      totalMinutes = Math.floor(diffMs / 60000) - (data.breakMinutes || 0)
      totalMinutes = Math.max(0, totalMinutes)
    }

    // Pridobi urno postavko iz zaposlenega
    const employee = await db.employee.findUnique({ where: { id: data.employeeId } })
    // FIX R81-G (LEAK-MEDIUM, cross-tenant): employeeId je bil nescopecan —
    // manager je lahko vpisoval delovne urne (payroll!) TUJEGA zaposlenega.
    // Employee.locationId je nullable — NULL vrstice so fail-closed za
    // lokacijsko vezane seje; super-admin (brez session lokacije) = globalno.
    if (employee && !isWithinScope(sessionLocId, employee.locationId)) {
      return notInScopeResponse('Zaposleni')
    }
    if (employee) {
      // Pridobi payRate iz EmployeeJob če je jobId podan
      if (data.jobId) {
        const empJob = await db.employeeJob.findUnique({
          where: { employeeId_jobId: { employeeId: data.employeeId, jobId: data.jobId } },
        })
        payRate = toNum(empJob?.payRate) || 0
      }
      totalPay = round2(multiply(totalMinutes / 60, payRate))
    }

    // FIX QA runda 38: DB stolpec TimeEntry.locationId je NOT NULL (schema drift,
    // P2011 potrjen na prod) — lokacija je fail-closed rezolvirana iz seje zgoraj
    // (R87-4: resolver + resolveWriteLocationId; NIČ več globalnega
    // prva-lokacija fallback-a). createTimeEntrySchema NIMA locationId polja —
    // body se ne more vžigati tuje lokacije.

    const timeEntry = await db.timeEntry.create({
      data: {
        employeeId: data.employeeId,
        locationId,
        jobId: data.jobId || null,
        clockIn,
        clockOut,
        breakStart: data.breakStart ? new Date(data.breakStart) : null,
        breakEnd: data.breakEnd ? new Date(data.breakEnd) : null,
        breakMinutes: data.breakMinutes,
        totalMinutes,
        payRate,
        totalPay,
        type: data.type,
        status: data.status,
        notes: data.notes,
      },
      include: {
        employee: { select: { id: true, name: true } },
        job: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(deepToNumbers(timeEntry), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/time-entries', 'Napaka pri ustvarjanju časovnega vnosa')
  }
}
