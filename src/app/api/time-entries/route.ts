
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createTimeEntrySchema } from '@/lib/validations'
import { toNum, round2, multiply, deepToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za vpogled v časovne vnose
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (jobId) where.jobId = jobId
    if (status) where.status = status
    if (type) where.type = type

    // FIX HIGH: Paginacija za časovne vnose
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

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

    const timeEntry = await db.timeEntry.create({
      data: {
        employeeId: data.employeeId,
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
