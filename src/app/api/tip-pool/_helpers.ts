// Pomožne funkcije za Tip Pool API
// Validacije, distribucija, izračun ur, poizvedbe

import { z } from 'zod'
import { db } from '@/lib/db'
import { sumBy, toNum } from '@/lib/decimal'

// ─── Validacijske sheme ───────────────────────────────────────

export const createTipPoolSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(30, 'Neveljaven format datuma'),
  distributionMethod: z.enum(['equal', 'hours', 'points', 'manual']).default('equal'),
  locationId: z.string().max(100, 'ID lokacije je predolg').optional(),
})

export const distributeTipsSchema = z.object({
  tipPoolId: z.string().min(1, 'ID tip poola je obvezen').max(100, 'ID je predolg'),
  distributions: z.array(z.object({
    employeeId: z.string().min(1, 'ID zaposlenega je obvezen').max(100, 'ID je predolg'),
    employeeName: z.string().min(1, 'Ime zaposlenega je obvezno').max(100, 'Ime je predolgo'),
    hoursWorked: z.number().min(0).max(24, 'Ure ne morejo preseči 24').default(0),
    points: z.number().min(0).max(1000, 'Preveč točk').default(0),
    amount: z.number().min(0, 'Znesek ne more biti negativen').max(999999, 'Znesek je previsok'),
  })).min(1, 'Vsaj ena distribucija je obvezna').max(100, 'Preveč distribucij'),
})

// ─── Tipi za distribucijo ─────────────────────────────────────

export interface EmployeeEntry {
  employeeId: string
  employeeName: string
  hoursWorked: number
  points: number
}

export interface Distribution extends EmployeeEntry {
  amount: number
}

// ─── Izračun distribucije ─────────────────────────────────────

export function calculateDistributions(
  method: 'equal' | 'hours' | 'points' | 'manual',
  employees: EmployeeEntry[],
  totalTips: number
): Distribution[] {
  let distributions: Distribution[] = []

  switch (method) {
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

  return distributions
}

// ─── Pomožna funkcija za izračun ur ───────────────────────────

// FIX BUG-8 MEDIUM: Podpora za nočne izmene (npr. 22:00–06:00)
export function calculateHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMin = (sh || 0) * 60 + (sm || 0)
  const endMin = (eh || 0) * 60 + (em || 0)
  let diff = endMin - startMin
  // FIX: Če je diff negativen, je izmena čez polnoč (npr. 22:00–06:00)
  if (diff < 0) diff += 24 * 60
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0
}

// ─── Poizvedbe za napitnine ──────────────────────────────────

export interface DayTipsResult {
  payments: { tipAmount: Parameters<typeof toNum>[0]; type: string }[]
  totalTips: number
  cashTips: number
  cardTips: number
}

export async function fetchDayPayments(
  dayStart: Date,
  dayEnd: Date,
  locationId?: string
): Promise<DayTipsResult> {
  const paymentWhere: Record<string, unknown> = {
    createdAt: { gte: dayStart, lt: dayEnd },
    tipAmount: { gt: 0 },
    status: 'completed',
  }
  if (locationId) {
    paymentWhere.check = { order: { locationId } }
  }
  const payments = await db.payment.findMany({ where: paymentWhere })

  const totalTips = toNum(sumBy(payments, p => p.tipAmount))
  const cashTips = toNum(sumBy(payments.filter(p => p.type === 'cash'), p => p.tipAmount))
  const cardTips = toNum(sumBy(payments.filter(p => p.type === 'card'), p => p.tipAmount))

  return { payments, totalTips, cashTips, cardTips }
}

export async function persistTipPoolWithDistributions(
  existing: { id: string; status: string } | null,
  poolData: {
    date: Date
    totalTips: number
    cashTips: number
    cardTips: number
    distributionMethod: string
    status: 'pending'
    locationId: string | null
  },
  distributions: Distribution[]
): Promise<string> {
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

  return pool.id
}
