// ============================================
// TIP POOL API — Razdelitev napitnin
// Toast POS standard — equal, hours, points, manual
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers, sumBy, toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
const createTipPoolSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(30, 'Neveljaven format datuma'),
  distributionMethod: z.enum(['equal', 'hours', 'points', 'manual']).default('equal'),
  locationId: z.string().max(100, 'ID lokacije je predolg').optional(),
})

const distributeTipsSchema = z.object({
  tipPoolId: z.string().min(1, 'ID tip poola je obvezen').max(100, 'ID je predolg'),
  distributions: z.array(z.object({
    employeeId: z.string().min(1, 'ID zaposlenega je obvezen').max(100, 'ID je predolg'),
    employeeName: z.string().min(1, 'Ime zaposlenega je obvezno').max(100, 'Ime je predolgo'),
    hoursWorked: z.number().min(0).max(24, 'Ure ne morejo preseči 24').default(0),
    points: z.number().min(0).max(1000, 'Preveč točk').default(0),
    amount: z.number().min(0, 'Znesek ne more biti negativen').max(999999, 'Znesek je previsok'),
  })).min(1, 'Vsaj ena distribucija je obvezna').max(100, 'Preveč distribucij'),
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
    // FIX BUG-7 MEDIUM: Filtriraj plačila po locationId preko check → order → locationId
    const paymentWhere: Record<string, unknown> = {
      createdAt: { gte: dayStart, lt: dayEnd },
      tipAmount: { gt: 0 },
      status: 'completed',
    }
    if (locationId) {
      paymentWhere.check = { order: { locationId } }
    }
    const payments = await db.payment.findMany({
      where: paymentWhere,
    })

    const totalTips = toNum(sumBy(payments, p => p.tipAmount))
    const cashTips = toNum(sumBy(payments.filter(p => p.type === 'cash'), p => p.tipAmount))
    const cardTips = toNum(sumBy(payments.filter(p => p.type === 'card'), p => p.tipAmount))

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

    const { data, error: validationError } = await validateRequest(req, distributeTipsSchema)
    if (validationError) return validationError

    const { tipPoolId, distributions } = data

    const pool = await db.tipPool.findUnique({ where: { id: tipPoolId } })
    if (!pool) return NextResponse.json({ error: 'Tip pool ne obstaja' }, { status: 404 })
    if (pool.status === 'paid') return NextResponse.json({ error: 'Tip pool je že izplačan' }, { status: 400 })

    // FIX CRITICAL: Prejšnja koda je uporabila upsert z lažnim IDjem `${tipPoolId}_${d.employeeId}`
    // ki NIKOLI ni zadel obstoječega zapisa (CUID format). Vsak PUT je ustvaril DUPLIKATNE distribucije.
    // Popravek: izbriši stare distribucije in ustvari nove (enako kot POST route)
    await db.tipDistribution.deleteMany({ where: { tipPoolId } })
    await db.tipDistribution.createMany({
      data: distributions.map(d => ({
        tipPoolId,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        hoursWorked: d.hoursWorked,
        points: d.points,
        amount: d.amount,
        status: 'pending' as const,
      })),
    })

    // Označi kot distributed
    await db.tipPool.update({
      where: { id: tipPoolId },
      data: { status: 'distributed' },
    })

    await createAuditLog({
      action: 'tip_pool_distributed',
      entityType: 'tip_pool',
      details: { totalTips: pool.totalTips, employeeCount: distributions.length, message: `Napitnine razdeljene: €${toNum(pool.totalTips).toFixed(2)} med ${distributions.length} zaposlenih` },
      userId: authResult.session?.employeeId,
    })

    const result = await db.tipPool.findUnique({
      where: { id: tipPoolId },
      include: { distributions: true },
    })

    return NextResponse.json(deepToNumbers(result))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/tip-pool', 'Napaka pri posodabljanju napitnin')
  }
}

// Pomožna funkcija za izračun ur
// FIX BUG-8 MEDIUM: Podpora za nočne izmene (npr. 22:00–06:00) — prejšnja koda je vrnila 0
function calculateHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMin = (sh || 0) * 60 + (sm || 0)
  const endMin = (eh || 0) * 60 + (em || 0)
  let diff = endMin - startMin
  // FIX: Če je diff negativen, je izmena čez polnoč (npr. 22:00–06:00)
  if (diff < 0) diff += 24 * 60
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0
}
