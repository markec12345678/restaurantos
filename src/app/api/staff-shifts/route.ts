// ============================================
// STAFF SHIFTS API — Razpored zaposlenih
// 7shifts + Toast standard
// CRUD, tedenski pregled, pokritost
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse, resolveWriteLocationId } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '@/lib/structured-error'
import { createStaffShiftSchema, checkTimeOverlap, buildShiftsWhere, computeShiftStats } from './_helpers'

// FIX R81-G (LEAK-MEDIUM): inline role-aware fail-closed gate (zrcali
// resolveCatalogScope semantiko; inventory/adjust R81-F vzorec — brez
// tenant-scope helperjev za role check). Non-admin BREZ session.locationId
// = 403 (data integrity issue), ker ne moremo izpeljati scope-a.
function requireLocationScope(
  authResult: { session?: { role?: string; locationId?: string | null } | null },
): { sessionLocId: string | null } | { error: NextResponse } {
  const session = authResult.session
  const sessionLocId = session?.locationId ?? null
  const isRoleAdmin = session?.role === 'admin' || session?.role === 'super_admin'
  if (!sessionLocId && !isRoleAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      ),
    }
  }
  return { sessionLocId }
}


// ============================================
// GET — Pridobi izmene (z filtri)
// ============================================
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    // P1-16: centralna pagination validacija (limit max, search dolžina)
    const { limit } = parsePaginationParams(searchParams)

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/staff-shifts',
    })
    if (!scope.ok) return scope.error

    const where = buildShiftsWhere(searchParams, tenantScopeToWhere(scope))

    const shifts = await db.staffShift.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, role: true } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
      take: limit,
    })

    const stats = computeShiftStats(shifts)
    return NextResponse.json({ shifts, stats })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/staff-shifts', 'Napaka pri pridobivanju izmen')
  }
}

// ============================================
// POST — Ustvari izmeno
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R81-G (LEAK-MEDIUM): scope gate (403) PRED validacijo/db
    const scope = requireLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    const { data, error: validationError } = await validateRequest(req, createStaffShiftSchema)
    if (validationError) return validationError

    const { employeeId, shiftDate, shiftType, startTime, endTime, locationId, role, notes, status } = data

    const employee = await db.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ error: 'Zaposleni ni najden' }, { status: 404 })
    }
    // FIX R81-G (LEAK-MEDIUM, cross-tenant): employee.findUnique je bil
    // nescopecan — manager je lahko razporedil TUJEGA zaposlenega. Employee.
    // locationId je nullable — NULL vrstice so fail-closed za lokacijsko
    // vezane seje; super-admin (brez session lokacije) = globalni nadzor.
    if (!isWithinScope(sessionLocId, employee.locationId)) {
      return notInScopeResponse('Zaposleni')
    }

    // R86-2b (canonical žig): resolveWriteLocationId — scope zmaga; kandidata
    // (body, data-derived employee.locationId) sta dosegljiva SAMO null-scope
    // super-adminu. Globalni fallback getFirstLocationId() (prva lokacija
    // POLJUBNEGA tenanta) je ODSTRANJEN → brez kandidata 400 fail-closed
    // (prej cross-tenant žig prve lokacije v DB).
    const writeLoc = resolveWriteLocationId(sessionLocId, locationId, employee.locationId)
    if (!writeLoc.ok) return writeLoc.response

    // FIX R103 (S1, HIGH TOCTOU double-booking): prej je bil conflict probe
    // (findFirst) + create DVE ločeni operaciji — dva sočasna POST-a za
    // istega zaposlenega/datum/prekrivajočima časoma sta oba prebrala prazne
    // kandidate → oba create → dvojna razporeditev (isti razred kot R102 F2
    // reservations PUT double-booking). Zdaj: Serializable transakcija —
    // tx-fresh re-read zaposlenega (mid-flight izbris → 404 structured
    // throw) + svež conflict probe + create ZNOTRAJ tx; P2034 → 409 retry.
    const shift = await db.$transaction(async (tx) => {
      const freshEmployee = await tx.employee.findUnique({ where: { id: employeeId } })
      if (!freshEmployee) {
        throw { error: 'Zaposleni ni najden', status: 404 }
      }
      // Scope ponovno preverjen proti TX-fresh vrstici (sprememba lokacije
      // mid-flight ne sme obiti R81-G cross-tenant zaščite)
      if (!isWithinScope(sessionLocId, freshEmployee.locationId)) {
        throw { error: 'Zaposleni ni najden', status: 404 }
      }

      // FIX R81-G: conflict lookup je scopcan na session lokacijo (sedaj
      // tx-fresh — фанtomski vstavljanje sočasnega tx-a blokira Serializable)
      const existing = await tx.staffShift.findFirst({
        where: {
          employeeId,
          shiftDate: new Date(shiftDate),
          status: { notIn: ['cancelled'] },
          ...(sessionLocId ? { locationId: sessionLocId } : {}),
        },
      })

      if (existing && checkTimeOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
        throw {
          error: `Zaposleni ${freshEmployee.name} ima že izmeno ${existing.startTime}-${existing.endTime} na ${shiftDate}, ki se prekriva z ${startTime}-${endTime}`,
          status: 409,
        }
      }

      return tx.staffShift.create({
        data: {
          employeeId,
          shiftDate: new Date(shiftDate),
          shiftType,
          startTime,
          endTime,
          // FIX QA runda 37: DB stolpec StaffShift.locationId je NOT NULL (schema drift)
          // — pri Ana (admin brez lokacije) je create z null vrgel P2011.
          // FIX R81-G (LEAK-MEDIUM): za lokacijsko vezane seje je body locationId
          // STRIPPAN — razpored se NIKOLI ne ustvari na tuji lokaciji (seja je
          // avtoritativna); super-admin sme podati izrecen locationId.
          // R86-2b: žig je rezultat resolveWriteLocationId (zgoraj) — nikoli null.
          locationId: writeLoc.locationId,
          role: role || freshEmployee.role,
          notes,
          status,
          createdBy: authResult.session?.employeeId || null,
        },
        include: {
          employee: { select: { id: true, name: true, role: true } },
          location: { select: { id: true, name: true, code: true } },
        },
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await createAuditLog({
      action: 'STAFF_SHIFT_CREATED',
      entityType: 'StaffShift',
      entityId: shift.id,
      details: { employeeName: employee.name, shiftDate, startTime, endTime, shiftType },
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json(shift, { status: 201 })
  } catch (error: unknown) {
    // FIX R103 (error kontrakt): strukturirani { error, status } throw-i iz
    // $transaction telesa (404 mid-flight, 409 overlap) dosežejo klienta —
    // prej bi handleApiError vse obravnaval kot neznane → 500.
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2034'
    ) {
      return NextResponse.json(
        { error: 'Ustvarjanje izmene ni mogoče — drug uporabnik je hkrati razporejal istega zaposlenega. Poskusite znova.' },
        { status: 409 },
      )
    }
    logger.error('API', '[STAFF-SHIFTS POST]', error)
    return structuredErrorResponse(error, 'POST /api/staff-shifts', 'Napaka pri ustvarjanju izmene')
  }
}
