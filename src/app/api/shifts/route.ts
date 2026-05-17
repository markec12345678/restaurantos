import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createShiftSchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za vpogled v izmene
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

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

    // FIX HIGH: Paginacija za izmene
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [shifts, total] = await Promise.all([
      db.shift.findMany({
        where,
        orderBy: { date: 'asc' },
        take: limit,
        skip: offset,
        include: {
          employee: { select: { id: true, name: true, role: true } },
          job: { select: { id: true, name: true, basePayRate: true } },
        },
      }),
      db.shift.count({ where }),
    ])

    return NextResponse.json({ shifts, total, limit, offset })
  } catch (error) {
    console.error('Napaka pri pridobivanju izmen:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju izmen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX BUG 13: Zahtevaj avtentikacijo za ustvarjanje izmen
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX BUG 13: Zod validacija
    const { data, error: validationError } = validateBody(createShiftSchema, body)
    if (validationError) return validationError

    const shift = await db.shift.create({
      data: {
        employeeId: data.employeeId,
        jobId: data.jobId || null,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        breakMinutes: data.breakMinutes,
        notes: data.notes,
      },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        job: { select: { id: true, name: true, basePayRate: true } },
      },
    })
    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju izmene:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju izmene' }, { status: 500 })
  }
}
