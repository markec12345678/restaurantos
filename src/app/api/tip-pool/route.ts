// ============================================
// TIP POOL API — Razdelitev napitnin
// Toast POS standard — equal, hours, points, manual
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const createTipPoolSchema = z.object({
  date: z.string().min(1),
  distributionMethod: z.enum(['equal', 'hours', 'points', 'manual']).default('equal'),
  locationId: z.string().optional(),
})

const distributeTipsSchema = z.object({
  tipPoolId: z.string().min(1),
  distributions: z.array(z.object({
    employeeId: z.string().min(1),
    employeeName: z.string().min(1),
    hoursWorked: z.number().min(0).default(0),
    points: z.number().min(0).default(0),
    amount: z.number().min(0),
  })),
})

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

    return NextResponse.json(pools)
  } catch (error: any) {
    console.error('TipPool GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju napitnin' }, { status: 500 })
  }
}

// POST — Ustvari tip pool za dan
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const parsed = createTipPoolSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: parsed.error.issues }, { status: 400 })
    }

    const { date, distributionMethod, locationId } = parsed.data

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
    const payments = await db.payment.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
        tipAmount: { gt: 0 },
        status: 'completed',
      },
    })

    const totalTips = payments.reduce((sum, p) => sum + p.tipAmount, 0)
    const cashTips = payments.filter(p => p.type === 'cash').reduce((sum, p) => sum + p.tipAmount, 0)
    const cardTips = payments.filter(p => p.type === 'card').reduce((sum, p) => sum + p.tipAmount, 0)

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
    let distributions: Array<{
      employeeId: string
      employeeName: string
      hoursWorked: number
      points: number
      amount: number
    }> = []

    switch (distributionMethod) {
      case 'equal': {
        const perPerson = totalTips / employees.length
        distributions = employees.map(e => ({ ...e, amount: Math.round(perPerson * 100) / 100 }))
        break
      }
      case 'hours': {
        const totalHours = employees.reduce((sum, e) => sum + e.hoursWorked, 0)
        distributions = employees.map(e => ({
          ...e,
          amount: totalHours > 0 ? Math.round((e.hoursWorked / totalHours) * totalTips * 100) / 100 : 0,
        }))
        break
      }
      case 'points': {
        const totalPoints = employees.reduce((sum, e) => sum + e.points, 0)
        distributions = employees.map(e => ({
          ...e,
          amount: totalPoints > 0 ? Math.round((e.points / totalPoints) * totalTips * 100) / 100 : 0,
        }))
        break
      }
      case 'manual': {
        // Za manual distribucijo nastavi 0, uporabnik bo ročno določil
        distributions = employees.map(e => ({ ...e, amount: 0 }))
        break
      }
    }

    // Poravnaj razliko zaradi zaokroževanja
    const distributedTotal = distributions.reduce((sum, d) => sum + d.amount, 0)
    const diff = Math.round((totalTips - distributedTotal) * 100) / 100
    if (diff !== 0 && distributions.length > 0) {
      distributions[0].amount = Math.round((distributions[0].amount + diff) * 100) / 100
    }

    // Upsert tip pool
    const poolData = {
      date: dayStart,
      totalTips,
      cashTips,
      cardTips,
      distributionMethod,
      status: 'pending' as const,
      locationId: locationId || null,
    }

    const pool = existing
      ? await db.tipPool.update({ where: { id: existing.id }, data: poolData })
      : await db.tipPool.create({ data: poolData })

    // Izbriši stare distribucije in ustvari nove
    await db.tipDistribution.deleteMany({ where: { tipPoolId: pool.id } })
    await db.tipDistribution.createMany({
      data: distributions.map(d => ({
        tipPoolId: pool.id,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        hoursWorked: d.hoursWorked,
        points: d.points,
        amount: d.amount,
        status: 'pending',
      })),
    })

    const result = await db.tipPool.findUnique({
      where: { id: pool.id },
      include: { distributions: true },
    })

    return NextResponse.json(result, { status: existing ? 200 : 201 })
  } catch (error: any) {
    console.error('TipPool POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju tip poola' }, { status: 500 })
  }
}

// PUT — Posodobi distribucijo / odobri
export async function PUT(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const parsed = distributeTipsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: parsed.error.issues }, { status: 400 })
    }

    const { tipPoolId, distributions } = parsed.data

    const pool = await db.tipPool.findUnique({ where: { id: tipPoolId } })
    if (!pool) return NextResponse.json({ error: 'Tip pool ne obstaja' }, { status: 404 })
    if (pool.status === 'paid') return NextResponse.json({ error: 'Tip pool je že izplačan' }, { status: 400 })

    // Posodobi distribucije
    for (const d of distributions) {
      await db.tipDistribution.upsert({
        where: { id: `${tipPoolId}_${d.employeeId}` },
        update: { amount: d.amount, hoursWorked: d.hoursWorked, points: d.points },
        create: {
          tipPoolId,
          employeeId: d.employeeId,
          employeeName: d.employeeName,
          hoursWorked: d.hoursWorked,
          points: d.points,
          amount: d.amount,
          status: 'pending',
        },
      })
    }

    // Označi kot distributed
    await db.tipPool.update({
      where: { id: tipPoolId },
      data: { status: 'distributed' },
    })

    await createAuditLog({
      action: 'tip_pool_distributed',
      entityType: 'tip_pool',
      details: { totalTips: pool.totalTips, employeeCount: distributions.length, message: `Napitnine razdeljene: €${pool.totalTips.toFixed(2)} med ${distributions.length} zaposlenih` },
      userId: (authResult as any).employee?.id,
    })

    const result = await db.tipPool.findUnique({
      where: { id: tipPoolId },
      include: { distributions: true },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('TipPool PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju napitnin' }, { status: 500 })
  }
}

// Pomožna funkcija za izračun ur
function calculateHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMin = (sh || 0) * 60 + (sm || 0)
  const endMin = (eh || 0) * 60 + (em || 0)
  const diff = endMin - startMin
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0
}
