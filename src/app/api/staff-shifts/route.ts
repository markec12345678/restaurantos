// ============================================
// STAFF SHIFTS API — Razpored zaposlenih
// 7shifts + Toast standard
// CRUD, tedenski pregled, pokritost
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { createStaffShiftSchema, checkTimeOverlap, buildShiftsWhere, computeShiftStats } from './_helpers'


// ============================================
// GET — Pridobi izmene (z filtri)
// ============================================
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const rawLimit = parseInt(searchParams.get('limit') || '200')
    const limit = Math.min(Number.isNaN(rawLimit) ? 200 : rawLimit, 500)
    const where = buildShiftsWhere(searchParams)

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

    const { data, error: validationError } = await validateRequest(req, createStaffShiftSchema)
    if (validationError) return validationError

    const { employeeId, shiftDate, shiftType, startTime, endTime, locationId, role, notes, status } = data

    const employee = await db.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ error: 'Zaposleni ni najden' }, { status: 404 })
    }

    // Preveri konflikte — časovno prekrivanje
    const existing = await db.staffShift.findFirst({
      where: {
        employeeId,
        shiftDate: new Date(shiftDate),
        status: { notIn: ['cancelled'] },
      },
    })

    if (existing && checkTimeOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
      return NextResponse.json({
        error: `Zaposleni ${employee.name} ima že izmeno ${existing.startTime}-${existing.endTime} na ${shiftDate}, ki se prekriva z ${startTime}-${endTime}`,
        existingShift: existing,
      }, { status: 409 })
    }

    const shift = await db.staffShift.create({
      data: {
        employeeId,
        shiftDate: new Date(shiftDate),
        shiftType,
        startTime,
        endTime,
        locationId: locationId || null,
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
