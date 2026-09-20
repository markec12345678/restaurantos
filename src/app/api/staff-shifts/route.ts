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

    // Preveri konflikte — časovno prekrivanje
    // FIX R81-G: conflict lookup je scopcan na session lokacijo
    const existing = await db.staffShift.findFirst({
      where: {
        employeeId,
        shiftDate: new Date(shiftDate),
        status: { notIn: ['cancelled'] },
        ...(sessionLocId ? { locationId: sessionLocId } : {}),
      },
    })

    if (existing && checkTimeOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
      return NextResponse.json({
        error: `Zaposleni ${employee.name} ima že izmeno ${existing.startTime}-${existing.endTime} na ${shiftDate}, ki se prekriva z ${startTime}-${endTime}`,
        existingShift: existing,
      }, { status: 409 })
    }

    // R86-2b (canonical žig): resolveWriteLocationId — scope zmaga; kandidata
    // (body, data-derived employee.locationId) sta dosegljiva SAMO null-scope
    // super-adminu. Globalni fallback getFirstLocationId() (prva lokacija
    // POLJUBNEGA tenanta) je ODSTRANJEN → brez kandidata 400 fail-closed
    // (prej cross-tenant žig prve lokacije v DB).
    const writeLoc = resolveWriteLocationId(sessionLocId, locationId, employee.locationId)
    if (!writeLoc.ok) return writeLoc.response

    const shift = await db.staffShift.create({
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
        role: role || employee.role,
        notes,
        status,
        createdBy: authResult.session?.employeeId || null,
      },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        location: { select: { id: true, name: true, code: true } },
      },
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
    logger.error('API', '[STAFF-SHIFTS POST]', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: 'Napaka pri ustvarjanju izmene', code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Napaka pri ustvarjanju izmene' }, { status: 500 })
  }
}
