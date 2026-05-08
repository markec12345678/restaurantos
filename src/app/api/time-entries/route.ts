import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
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
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const timeEntry = await db.timeEntry.create({
      data: {
        employeeId: body.employeeId,
        jobId: body.jobId || null,
        clockIn: body.clockIn ? new Date(body.clockIn) : new Date(),
        clockOut: body.clockOut ? new Date(body.clockOut) : null,
        breakStart: body.breakStart ? new Date(body.breakStart) : null,
        breakEnd: body.breakEnd ? new Date(body.breakEnd) : null,
        breakMinutes: body.breakMinutes || 0,
        totalMinutes: body.totalMinutes || 0,
        payRate: body.payRate || 0,
        totalPay: body.totalPay || 0,
        type: body.type || 'regular',
        status: body.status || 'active',
        notes: body.notes || '',
      },
      include: {
        employee: { select: { id: true, name: true } },
        job: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(timeEntry, { status: 201 })
  } catch (error) {
    console.error('Failed to create time entry:', error)
    return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 })
  }
}
