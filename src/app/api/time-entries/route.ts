import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createTimeEntrySchema } from '@/lib/validations'

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

    const timeEntries = await db.timeEntry.findMany({
      where,
      orderBy: { clockIn: 'desc' },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        job: { select: { id: true, name: true, basePayRate: true } },
      },
    })

    return NextResponse.json(timeEntries)
  } catch (error) {
    console.error('Failed to fetch time entries:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju časovnih vnosov' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za ustvarjanje časovnih vnosov
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX BUG 13: Zod validacija
    const { data, error: validationError } = validateBody(createTimeEntrySchema, body)
    if (validationError) return validationError

    // Izračunaj totalMinutes in totalPay strežniško
    const clockIn = new Date(data.clockIn)
    const clockOut = data.clockOut ? new Date(data.clockOut) : null
    let totalMinutes = 0
    let payRate = 0
    let totalPay = 0

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
        payRate = empJob?.payRate || 0
      }
      totalPay = Math.round((totalMinutes / 60) * payRate * 100) / 100
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

    return NextResponse.json(timeEntry, { status: 201 })
  } catch (error) {
    console.error('Failed to create time entry:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju časovnega vnosa' }, { status: 500 })
  }
}
