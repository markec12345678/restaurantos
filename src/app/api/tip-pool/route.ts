// ============================================
// TIP POOL API — Razdelitev napitnin
// Toast POS standard — equal, hours, points, manual
// ============================================

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import {
  createTipPoolSchema,
  calculateDistributions,
  calculateHours,
  fetchDayPayments,
  persistTipPoolWithDistributions,
  handlePutTipPool,
} from './_helpers'

// GET — Pridobi tip poole
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')
    const locationId = searchParams.get('locationId')

    const where: Record<string, unknown> = {}
    if (date) {
      const d = new Date(date)
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const end = new Date(start.getTime() + 86400000)
      where.date = { gte: start, lt: end }
    }
    if (status) where.status = status
    if (locationId) where.locationId = locationId

    const pools = await db.tipPool.findMany({
      where,
      include: { distributions: true },
      orderBy: { date: 'desc' },
      take: 30,
    })

    return NextResponse.json(deepToNumbers(pools))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/tip-pool', 'Napaka pri pridobivanju napitnin')
  }
}

// POST — Ustvari tip pool za dan
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createTipPoolSchema)
    if (validationError) return validationError

    const { date, distributionMethod, locationId } = data

    const d = new Date(date)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    // Preveri če že obstaja
    const existing = await db.tipPool.findFirst({
      where: { date: dayStart, ...(locationId ? { locationId } : {}) },
    })
    if (existing && existing.status === 'paid') {
      return NextResponse.json({ error: 'Tip pool za ta dan je že izplačan' }, { status: 400 })
    }

    // Pridobi napitnine iz plačil za ta dan
    const { totalTips, cashTips, cardTips } = await fetchDayPayments(dayStart, dayEnd, locationId)

    // Pridobi zaposlene, ki so delali ta dan
    const shifts = await db.shift.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, status: { in: ['completed', 'in_progress'] } },
      include: { employee: true },
    })

    const employees = shifts.map(s => ({
      employeeId: s.employeeId,
      employeeName: s.employee.name,
      hoursWorked: calculateHours(s.startTime, s.endTime),
      points: 1,
    }))

    if (employees.length === 0) {
      return NextResponse.json({ error: 'Ni zaposlenih, ki so delali ta dan' }, { status: 400 })
    }

    // Izračunaj distribucijo
    const distributions = calculateDistributions(distributionMethod, employees, totalTips)

    // Upsert tip pool + distribucije
    const poolId = await persistTipPoolWithDistributions(
      existing,
      { date: dayStart, totalTips, cashTips, cardTips, distributionMethod, status: 'pending', locationId: locationId || null },
      distributions
    )

    const result = await db.tipPool.findUnique({
      where: { id: poolId },
      include: { distributions: true },
    })

    return NextResponse.json(deepToNumbers(result), { status: existing ? 200 : 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/tip-pool', 'Napaka pri ustvarjanju tip poola')
  }
}

// PUT — Posodobi distribucijo / odobri
export async function PUT(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    return await handlePutTipPool(req, authResult as { session?: { employeeId?: string } | null })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/tip-pool', 'Napaka pri posodabljanju napitnin')
  }
}
