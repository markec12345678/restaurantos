import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: Record<string, unknown> = {}
  if (employeeId) where.employeeId = employeeId
  if (status) where.status = status
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, unknown> = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) dateFilter.lte = new Date(dateTo)
    where.date = dateFilter
  }

  const shifts = await db.shift.findMany({
    where,
    orderBy: { date: 'asc' },
    include: {
      employee: { select: { id: true, name: true, role: true } },
      job: { select: { id: true, name: true, basePayRate: true } },
    },
  })
  return NextResponse.json(shifts)
}

export async function POST(req: Request) {
  const body = await req.json()
  const shift = await db.shift.create({
    data: {
      employeeId: body.employeeId,
      jobId: body.jobId || null,
      date: new Date(body.date),
      startTime: body.startTime || '09:00',
      endTime: body.endTime || '17:00',
      status: body.status || 'scheduled',
      breakMinutes: body.breakMinutes ?? 30,
      notes: body.notes || '',
    },
    include: {
      employee: { select: { id: true, name: true, role: true } },
      job: { select: { id: true, name: true, basePayRate: true } },
    },
  })
  return NextResponse.json(shift)
}
