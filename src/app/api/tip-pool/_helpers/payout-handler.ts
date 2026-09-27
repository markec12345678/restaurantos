// Payout handler za tip-pool — izplačilo distribuiranih napitnin
//
// R145-b (epic #115 #32): doslej Noben endpoint ni pisal
// TipDistribution.status='paid' + paidAt oz. TipPool.status='paid' —
// izplačilni ciklus je bil odprt (mrtvi stolpci, audit R145-a Q3-4).
//
// ─── STATE MACHINE (pinned po kontraktu R145-a + R145-c UI) ───
//   pending     → 400 'Distribucija še ni shranjena' (POST generira pool,
//                 PUT redistribucija še NI bila shranjena — nič za izplačat)
//   distributed → DOVOLJENO za izplačilo (edini vir tega statusa: PUT handler)
//   approved    → 400 (dormant stanje — NIČ v codebase ne piše 'approved';
//                 če se kdaj uvede approve korak, se razširi ENA konstanta
//                 spodaj — payout ostane zaprt do takrat)
//   paid        → 409 idempotenčni guard 'Tip pool je že izplačan'
// Izbira 'distributed' (in ne 'approved'-only): R145-a kontrakt pinna
// payout iz 'distributed', R145-c UI pokaže 'Izplačaj' SAMO na
// pool.status === 'distributed' — strežnik in UI sta 1:1.
//
// ─── HASH CHAIN — chain-safe payout (najdeno + odločitev R145-b) ───
// chainHash payload = [previousHash, employeeName, amount.toFixed(2), status,
// dateIso] — STATUS JE del payloada. updateMany status-flip ('pending' →
// 'paid') bi pustil chainHash STAR (izračunan nad 'pending') → vsaka
// izplačana vrstica = prelom verige ob re-verifikaciji (EU 852/2004).
// Zato payout sledi hišnemu PUT-vzorcu (deleteMany + chain-recreate):
//   1. deleteMany starih distribucij (v tx)
//   2. createTipDistributionWithChain(..., status 'paid', tx) — veriga se
//      podaljša z 'paid' vrsticami (hash nad 'paid' = konsistenten)
//   3. paidAt updateMany — paidAt NI del hash payloada → chain-varen
// Dodatno najdeno (PRE-AFTER obstoječe, tukaj NI fixano — shared lib izven
// obsega tip-pool): verifyTipDistributionChainIntegrity recompute uporablja
// amount.toString() (Decimal) namesto amount.toFixed(2) in entry.createdAt
// namesto creation-time now() → mismatch za večino vrstic TUDI brez payouta.
// Oznaka za prihodnjo rundo (verify formula fix).
//
// PII/denar kanon: audit details = števci/zneski/datum SAMO — NIKOLI
// per-employee imena ali zneski.

import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers, toNum, sumBy } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { createTipDistributionWithChain } from '@/lib/tip-distribution-chain'
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { Prisma } from '@prisma/client'

export async function handlePayoutTipPool(
  req: Request,
  _authResult: { session?: { employeeId?: string; locationId?: string | null } | null },
  tipPoolId: string,
) {
  // Scope iz centralnega resolverja (fail-closed za lokacijsko vezane seje
  // brez lokacije — R86-2a kanon, isti vzorec kot PUT handler).
  const { searchParams } = new URL(req.url)
  const scope = resolveTenantLocationIdOrThrow(_authResult.session, searchParams, {
    endpoint: 'POST /api/tip-pool/[id]/payout',
  })
  if ('error' in scope) return scope.error

  // Zero-oracle (R144-d lekcija): nonexistent ≡ out-of-scope → EXACT isti
  // 404 body (notInScopeResponse('Tipski bazen')) — nikoli dveh različnih
  // sporočil, ki bi razkrila obstoj poola na tuji lokaciji.
  const pool = await db.tipPool.findUnique({ where: { id: tipPoolId } })
  if (!pool || !isWithinScope(scope.locationId, pool.locationId)) {
    return notInScopeResponse('Tipski bazen')
  }

  // Hitri faili PRED tx (idempotenčni guard + state machine — glej glavo)
  if (pool.status === 'paid') {
    return NextResponse.json({ error: 'Tip pool je že izplačan' }, { status: 409 })
  }
  if (pool.status !== 'distributed') {
    return NextResponse.json({ error: 'Distribucija še ni shranjena' }, { status: 400 })
  }

  try {
    const now = new Date()
    await db.$transaction(async (tx) => {
      // Optimistic lock: status re-check ZNOTRAJ tx (pariteta PUT handlerja)
      const current = await tx.tipPool.findUnique({
        where: { id: tipPoolId },
        select: { status: true },
      })
      if (!current) throw new Error('POOL_NOT_FOUND')
      if (current.status === 'paid') throw new Error('ALREADY_PAID')
      if (current.status !== 'distributed') throw new Error('NOT_DISTRIBUTED')

      const dists = await tx.tipDistribution.findMany({ where: { tipPoolId } })

      // Chain-safe payout — glej glavo fajla (status je del hash payloada)
      await tx.tipDistribution.deleteMany({ where: { tipPoolId } })
      const createdIds = await createTipDistributionWithChain(
        dists.map(d => ({
          tipPoolId,
          employeeId: d.employeeId,
          employeeName: d.employeeName,
          hoursWorked: toNum(d.hoursWorked),
          points: toNum(d.points),
          amount: toNum(d.amount),
          status: 'paid' as const,
        })),
        tx, // ← outer tx — atomarno z deleteMany, pool.update in auditom
      )

      // paidAt NI del hash payloada → update je chain-varen (samo na novo
      // ustvarjenih id-jih, da izključimo druge poolove vrstice)
      if (createdIds.length > 0) {
        await tx.tipDistribution.updateMany({
          where: { id: { in: createdIds } },
          data: { paidAt: now },
        })
      }

      await tx.tipPool.update({
        where: { id: tipPoolId },
        data: { status: 'paid' },
      })

      // Audit ZNOTRAJ tx (put-handler kanon) — counters/amounts SAMO
      await createAuditLog({
        action: 'TIP_POOL_PAID',
        entityType: 'TipPool',
        entityId: tipPoolId,
        details: {
          tipPoolId,
          date: pool.date.toISOString(),
          totalTips: toNum(pool.totalTips),
          distributionCount: dists.length,
          paidBy: _authResult.session?.employeeId ?? null,
        },
        userId: _authResult.session?.employeeId,
        locationId: pool.locationId,
      }, tx) // ← predamo tx
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    })
  } catch (error: unknown) {
    if (error instanceof Error && ['ALREADY_PAID', 'POOL_NOT_FOUND', 'NOT_DISTRIBUTED'].includes(error.message)) {
      const message = error.message === 'ALREADY_PAID'
        ? 'Tip pool je bil medtem izplačan — osvežite stran'
        : error.message === 'POOL_NOT_FOUND'
          ? 'Tip pool ni najden ali je bil izbrisan'
          : 'Distribucija je bila medtem spremenjena — osvežite stran'
      return NextResponse.json({ error: message }, { status: 409 })
    }
    // P2034: Serialization conflict — pariteta PUT handlerja
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json(
        { error: 'Tip pool se obdeluje — poskusite znova čez nekaj sekund' },
        { status: 409 },
      )
    }
    throw error
  }

  // Re-fetch + povzetek izplačila (odgovor v pariteti PUT: poln pool z
  // distribucijami; payoutSummary je DODATNO polje — ne lomi UI kontrakta)
  const result = await db.tipPool.findUnique({
    where: { id: tipPoolId },
    include: { distributions: true },
  })

  const distributionCount = result?.distributions.length ?? 0
  const totalPaid = toNum(sumBy(result?.distributions ?? [], d => d.amount))

  return NextResponse.json(deepToNumbers({
    ...result,
    payoutSummary: { distributionCount, totalPaid },
  }))
}
