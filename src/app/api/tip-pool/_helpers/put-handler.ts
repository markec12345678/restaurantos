// PUT handler za tip-pool — posodobi distribucijo / odobri
//
// FIX P1 (audit 2026-09-06): Celotna operacija je sedaj zavita v $transaction:
//   1. Pridobi pool (z optimistic lock preverjanjem statusa)
//   2. deleteMany(stare distribucije)
//   3. createTipDistributionWithChain(nove distribucije, tx)
//   4. tipPool.update(status → 'distributed', tx)
//   5. createAuditLog(..., tx)
//
// Prej: te operacije so bile ločene — če je proces crashnil med njimi,
//   so ostale partial distribucije (npr. stare izbrisane, novih ni bilo).
// Sedaj: atomarno — ali uspe vse ali pa nič.
//

import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { distributeTipsSchema } from './schemas'
import { validateRequest } from '@/lib/api-utils'
import { createTipDistributionWithChain } from '@/lib/tip-distribution-chain'
import { Prisma } from '@prisma/client'

export async function handlePutTipPool(
  req: Request,
  _authResult: { session?: { employeeId?: string } | null },
) {
  const { data, error: validationError } = await validateRequest(req, distributeTipsSchema)
  if (validationError) return validationError

  const { tipPoolId, distributions } = data

  // Preveri pool status OUTSIDE transaction — hitri fail za 404/400
  const pool = await db.tipPool.findUnique({ where: { id: tipPoolId } })
  if (!pool) return NextResponse.json({ error: 'Tip pool ne obstaja' }, { status: 404 })
  if (pool.status === 'paid') return NextResponse.json({ error: 'Tip pool je že izplačan' }, { status: 400 })

  try {
    // Vse mutacije v eni transakciji — atomarno
    await db.$transaction(async (tx) => {
      // Optimistic lock: preveri da pool status ni bil spremenjen medtem
      // (npr. drug admin je kliknil "Pay" v istem trenutku)
      const currentPool = await tx.tipPool.findUnique({
        where: { id: tipPoolId },
        select: { status: true },
      })
      if (!currentPool) {
        // Pool ni bil najden — verjetno izbrisan medtem
        throw new Error('POOL_NOT_FOUND')
      }
      if (currentPool.status === 'paid') {
        throw new Error('ALREADY_PAID')
      }

      // FIX SECURITY (issue #35): uporabi createTipDistributionWithChain z tx
      // za hash verigo (prejšnja createMany() ni nastavila previousHash/chainHash)
      await tx.tipDistribution.deleteMany({ where: { tipPoolId } })
      await createTipDistributionWithChain(
        distributions.map(d => ({
          tipPoolId,
          employeeId: d.employeeId,
          employeeName: d.employeeName,
          hoursWorked: d.hoursWorked,
          points: d.points,
          amount: d.amount,
          status: 'pending' as const,
        })),
        tx, // ← predamo outer tx — atomarno z deleteMany in tipPool.update
      )

      // Označi kot distributed ZNOTRAJ transakcije
      await tx.tipPool.update({
        where: { id: tipPoolId },
        data: { status: 'distributed' },
      })

      // Audit log ZNOTRAJ transakcije — če transakcija failne, se audit log
      // ne zapiše (kar je pravilno — ni bilo ničesar distribuiranega)
      await createAuditLog({
        action: 'tip_pool_distributed',
        entityType: 'tip_pool',
        details: {
          totalTips: pool.totalTips,
          employeeCount: distributions.length,
          message: `Napitnine razdeljene: €${toNum(pool.totalTips).toFixed(2)} med ${distributions.length} zaposlenih`,
        },
        userId: _authResult.session?.employeeId,
      }, tx) // ← predamo tx
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    })
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'ALREADY_PAID' || error.message === 'POOL_NOT_FOUND')) {
      const message = error.message === 'ALREADY_PAID'
        ? 'Tip pool je bil medtem izplačan — osvežite stran'
        : 'Tip pool ni najden ali je bil izbrisan'
      return NextResponse.json({ error: message }, { status: 409 })
    }
    // P2034: Serialization conflict — drug admin je distribuiral hkrati
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json(
        { error: 'Tip pool se obdeluje — poskusite znova čez nekaj sekund' },
        { status: 409 },
      )
    }
    throw error
  }

  const result = await db.tipPool.findUnique({
    where: { id: tipPoolId },
    include: { distributions: true },
  })

  return NextResponse.json(deepToNumbers(result))
}
