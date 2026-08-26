// PUT handler za tip-pool — posodobi distribucijo / odobri

import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { distributeTipsSchema } from './schemas'
import { validateRequest } from '@/lib/api-utils'

export async function handlePutTipPool(
  req: Request,
  _authResult: { session?: { employeeId?: string } | null },
) {
  const { data, error: validationError } = await validateRequest(req, distributeTipsSchema)
  if (validationError) return validationError

  const { tipPoolId, distributions } = data

  const pool = await db.tipPool.findUnique({ where: { id: tipPoolId } })
  if (!pool) return NextResponse.json({ error: 'Tip pool ne obstaja' }, { status: 404 })
  if (pool.status === 'paid') return NextResponse.json({ error: 'Tip pool je že izplačan' }, { status: 400 })

  // FIX CRITICAL: Izbriši stare distribucije in ustvari nove
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
    userId: _authResult.session?.employeeId,
  })

  const result = await db.tipPool.findUnique({
    where: { id: tipPoolId },
    include: { distributions: true },
  })

  return NextResponse.json(deepToNumbers(result))
}
