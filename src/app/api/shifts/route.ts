import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')

  const where: Record<string, unknown> = {}
  if (employeeId) where.employeeId = employeeId

  const shifts = await db.shift.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { employee: true },
  })
  return NextResponse.json(shifts)
}

export async function POST(req: Request) {
  const body = await req.json()
  const shift = await db.shift.create({
    data: {
      employeeId: body.employeeId,
      date: new Date(body.date),
      startTime: body.startTime || '09:00',
      endTime: body.endTime || '17:00',
      status: body.status || 'scheduled',
    },
    include: { employee: true },
  })
  return NextResponse.json(shift)
}
