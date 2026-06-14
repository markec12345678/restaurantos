// ============================================
// STAFF SHIFTS API — Razpored zaposlenih
// 7shifts + Toast standard
// CRUD, tedenski pregled, pokritost
// ============================================

// Zod validacijska shema za kreiranje izmene
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
const createStaffShiftSchema = z.object({
  employeeId: z.string().min(1, 'Zaposleni je obvezen').max(100, 'ID zaposlenega ne sme preseči 100 znakov'),
  shiftDate: z.string().min(1, 'Datum izmene je obvezen').max(20, 'Datum ne sme preseči 20 znakov'),
  shiftType: z.enum(['morning', 'afternoon', 'evening', 'night', 'split', 'double']).default('morning'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Čas mora biti v formatu HH:MM').max(5, 'Čas ne sme preseči 5 znakov'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Čas mora biti v formatu HH:MM').max(5, 'Čas ne sme preseči 5 znakov'),
  locationId: z.string().max(100, 'ID lokacije ne sme preseči 100 znakov').optional(),
  role: z.string().max(100, 'Vloga ne sme preseči 100 znakov').optional(),
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).default('scheduled'),
})

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
        employee: { select: { id: true, name: true, role: true } },
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
      let hours = (endH * 60 + endM - startH * 60 - startM) / 60
      // FIX HIGH: Nočne izmene (npr. 22:00-06:00) imajo negativen rezultat
      // Če je endTime < startTime, je izmena čez polnoč — dodaj 24 ure
      if (hours < 0) hours += 24
      totalHours += hours
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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/staff-shifts', 'Napaka pri pridobivanju izmen')
  }
}

// ============================================
// POST — Ustvari izmeno
// ============================================
export async function POST(req: Request) {
  try {
    // FIX: Staff shift management requires manage_employees, not manage_cash
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createStaffShiftSchema)
    if (validationError) return validationError

    const { employeeId, shiftDate, shiftType, startTime, endTime, locationId, role, notes, status } = data

    // Preveri ali zaposleni obstaja
    const employee = await db.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ error: 'Zaposleni ni najden' }, { status: 404 })
    }

    // Preveri konflikte — ali ima ta zaposleni že izmeno, ki se časovno prekriva?
    // FIX HIGH: Preveri TIME OVERLAP, ne samo isti datum — prejšnja koda je dopuščala prekrivanje
    const existing = await db.staffShift.findFirst({
      where: {
        employeeId,
        shiftDate: new Date(shiftDate),
        status: { notIn: ['cancelled'] },
      },
    })

    if (existing) {
      // FIX HIGH: Preveri časovno prekrivanje, ne samo obstoj izmene na isti dan
      // Delavni čas se lahko prekriva — npr. 08:00-16:00 in 14:00-22:00 se prekrivata
      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      let newStart = parseTime(startTime)
      let newEnd = parseTime(endTime)
      // FIX HIGH: Nočne izmene (npr. 22:00-06:00) — če je end < start, je čez polnoč
      if (newEnd <= newStart) newEnd += 24 * 60

      let exStart = parseTime(existing.startTime)
      let exEnd = parseTime(existing.endTime)
      if (exEnd <= exStart) exEnd += 24 * 60

      // Prekrivanje: newStart < exEnd && newEnd > exStart
      if (newStart < exEnd && newEnd > exStart) {
        return NextResponse.json({
          error: `Zaposleni ${employee.name} ima že izmeno ${existing.startTime}-${existing.endTime} na ${shiftDate}, ki se prekriva z ${startTime}-${endTime}`,
          existingShift: existing,
        }, { status: 409 })
      }
      // Ista izmena ampak brez prekrivanja — dovoli (npr. split shift)
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
