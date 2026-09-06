// Poizvedbe za napitnine in persistenca
//
// FIX P1 (audit 2026-09-06): persistTipPoolWithDistributions je sedaj zavita
// v $transaction — prej so bile operacije (tipPool.upsert + deleteMany +
// createTipDistributionWithChain) ločene, kar je pomenilo da pri crash-u
// lahko ostanejo partial distribucije.
//

import { db } from '@/lib/db'
import { sumBy, toNum } from '@/lib/decimal'
import type { Distribution } from './schemas'
import { createTipDistributionWithChain } from '@/lib/tip-distribution-chain'
import { Prisma } from '@prisma/client'

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
  // FIX P1: Vse mutacije v eni transakciji — atomarno.
  // Če je existing pool že 'paid', ne dovolimo override-a.
  // Če katerakoli operacija failne, se celotna transakcija roll-back-a.
  return db.$transaction(async (tx) => {
    // Optimistic lock: če existing pool obstaja, preveri da ni bil medtem
    // preklican ali izplačan
    if (existing) {
      const current = await tx.tipPool.findUnique({
        where: { id: existing.id },
        select: { status: true },
      })
      if (!current) {
        throw new Error('POOL_DELETED')
      }
      if (current.status === 'paid') {
        throw new Error('ALREADY_PAID')
      }
    }

    const pool = existing
      ? await tx.tipPool.update({ where: { id: existing.id }, data: poolData })
      : await tx.tipPool.create({ data: poolData })

    // Izbriši stare distribucije in ustvari nove ZNOTRAJ transakcije
    // FIX SECURITY (issue #35): uporabi createTipDistributionWithChain za hash verigo
    // (prejšnja createMany() ni nastavila previousHash/chainHash — lažna integriteta)
    await tx.tipDistribution.deleteMany({ where: { tipPoolId: pool.id } })
    await createTipDistributionWithChain(
      distributions.map(d => ({
        tipPoolId: pool.id,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        hoursWorked: d.hoursWorked,
        points: d.points,
        amount: d.amount,
        status: 'pending' as const,
      })),
      tx, // ← predamo outer tx
    )

    return pool.id
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10000,
  })
}
