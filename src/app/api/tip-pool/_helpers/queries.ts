// Poizvedbe za napitnine in persistenca

import { db } from '@/lib/db'
import { sumBy, toNum } from '@/lib/decimal'
import type { Distribution } from './schemas'

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
