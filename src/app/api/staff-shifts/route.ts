// ============================================
// STAFF SHIFTS API — Razpored zaposlenih
// 7shifts + Toast standard
// CRUD, tedenski pregled, pokritost
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { Prisma } from '@prisma/client'

// ============================================
// GET — Pridobi izmene (z filtri)
// ============================================
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const employeeId = searchParams.get('employeeId')
    const locationId = searchParams.get('locationId')
    const status = searchParams.get('status')
    const shiftType = searchParams.get('shiftType')
    const rawLimit = parseInt(searchParams.get('limit') || '200')
    const limit = Math.min(Number.isNaN(rawLimit) ? 200 : rawLimit, 500)

    const where: Record<string, unknown> = {}

    if (startDate && endDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.shiftDate = { gte: start, lte: end }
    } else if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      where.shiftDate = { gte: start }
    }

    if (employeeId) where.employeeId = employeeId
    if (locationId) where.locationId = locationId
    if (status) where.status = status
    if (shiftType) where.shiftType = shiftType

    const shifts = await db.staffShift.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, role: true, pin: true } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
      take: limit,
    })

    // Statistika pokritosti
    const totalShifts = shifts.length
    const byType: Record<string, number> = {}
    const byRole: Record<string, number> = {}
    let totalHours = 0

    for (const s of shifts) {
      byType[s.shiftType] = (byType[s.shiftType] || 0) + 1
      byRole[s.role] = (byRole[s.role] || 0) + 1

      // Izračunaj ure
      const [startH, startM] = s.startTime.split(':').map(Number)
      const [endH, endM] = s.endTime.split(':').map(Number)
      const hours = (endH * 60 + endM - startH * 60 - startM) / 60
      if (hours > 0) totalHours += hours
    }

    return NextResponse.json({
      shifts,
      stats: {
        totalShifts,
        totalHours: Math.round(totalHours * 10) / 10,
        byType,
        byRole,
      },
    })
  } catch (error) {
    console.error('[STAFF-SHIFTS GET]', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju izmen' }, { status: 500 })
  }
}

// ============================================
// POST — Ustvari izmeno
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { employeeId, shiftDate, shiftType, startTime, endTime, locationId, role, notes, status } = body

    if (!employeeId || !shiftDate || !startTime || !endTime) {
      return NextResponse.json({ error: 'Manjkajoči podatki: employeeId, shiftDate, startTime, endTime' }, { status: 400 })
    }

    // Preveri ali zaposleni obstaja
    const employee = await db.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ error: 'Zaposleni ni najden' }, { status: 404 })
    }

    // Preveri konflikte — ali ima ta zaposleni že izmeno na ta dan?
    const existing = await db.staffShift.findFirst({
      where: {
        employeeId,
        shiftDate: new Date(shiftDate),
        status: { notIn: ['cancelled'] },
      },
    })

    if (existing) {
      return NextResponse.json({
        error: `Zaposleni ${employee.name} ima že izmeno na ${shiftDate}`,
        existingShift: existing,
      }, { status: 409 })
    }

    const shift = await db.staffShift.create({
      data: {
        employeeId,
        shiftDate: new Date(shiftDate),
        shiftType: shiftType || 'morning',
        startTime,
        endTime,
        locationId: locationId || null,
        role: role || employee.role,
        notes: notes || '',
        status: status || 'scheduled',
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
  } catch (error) {
    console.error('[STAFF-SHIFTS POST]', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: 'Napaka pri ustvarjanju izmene', code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Napaka pri ustvarjanju izmene' }, { status: 500 })
  }
}
