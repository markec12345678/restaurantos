// ============================================
// LOYALTY POINTS — ENOTNI PISALNI KANON (R107)
// ============================================
// R107 (TOCTOU razred iz R100–R106): PUT /api/loyalty/[id] je imel ISTO
// forenziko kot R106 INV-1/INV-2 zalogovne poti:
//
//   LO-1 (HIGH, lost update / dvojna delta): `existing` prebran IZVEN tx,
//        `diff = newPoints − existing.pointsBalance` izračunan iz STALE
//        vrednosti → dva sočasna "nastavi na 100" (iz 50) → oba izračunata
//        diff=+50 → končno stanje 150 (LOST UPDATE). Podobno sočasna
//        unovčenja (earn path decrement) tiho prepisana.
//   LO-2 (MEDIUM, lažni audit): avtomatski LoyaltyTransaction zapis je bil
//        ustvarjen s STALE diff-om (points: stale diff) → zgodovina točk
//        ne ustreza dejanski spremembi.
//   LO-3 (MEDIUM, stale tier): maybeTierUpgrade(existing.tier STALE,
//        lifetime) → pod sočasnostjo lahko povišanje temelji na staršem
//        nivoju (upgrade-only semantika sicer ohranjena).
//
// Earn/redeem pot v payments (_helpers/loyalty.ts) je že atomarna (increment
// / updateMany gte decrement) — ta kanon serializira ROČNE prilagoditve z
// njimi prek Serializable izolacije (P2034 → 409 v ruti).
//
// KANON (zrcali R106 stock-mutations / R105 receive / R104 qr-pay):
//   $transaction(Serializable) + pg_advisory_xact_lock(hashtext('loyalty-points:'
//   + accountId)) + tx-fresh scoped re-read + diff SAMO proti svežim podatkom
//   + atomarni pogojni update-ji (updateMany gte za unovčenje) + strukturirani
//   { error, status } throw-i (structuredErrorResponse v ruti) + P2002/P2034
//   → 409 v catch bloku.

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum } from '@/lib/decimal'
import { maybeTierUpgrade, tierLabelSi } from '@/lib/loyalty-tiers'
import { logger } from '@/lib/logger'

export interface LoyaltyAdjustData {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  tier?: string
  isActive?: boolean
  pointsBalance?: number
  lifetimePoints?: number
  transaction?: {
    type: string
    points: number
    reason?: string
    orderId?: string | null
    checkId?: string | null
    monetaryValue?: number
  }
}

export interface LoyaltyAdjustResult {
  account: Record<string, unknown>
  tierUpgrade: { from: string; to: string } | null
  /** TX-FRESH diff točk (0 = brez spremembe točk) */
  pointsDiff: number
}

/** R107: skupni per-account lock ključ — serializira ročne prilagoditve točk. */
export function loyaltyPointsLockKey(loyaltyAccountId: string): string {
  return `loyalty-points:${loyaltyAccountId}`
}

const TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10_000,
} as const

/**
 * R107 LO-1/LO-2/LO-3: ročna prilagoditev točk + metadata pod per-account
 * ključavnico. Diff je izračunan iz TX-FRESH stanja (prej stale read izven
 * tx); unovčenje ima atomarni gte guard (nikoli pod 0); audit zapis in tier
 * upgrade temeljita na svežih vrednostih.
 */
export async function updateLoyaltyAccountWithLock(opts: {
  loyaltyAccountId: string
  sessionLocationId: string | null
  data: LoyaltyAdjustData
}): Promise<LoyaltyAdjustResult> {
  const { loyaltyAccountId, sessionLocationId, data } = opts

  return await db.$transaction(async (tx) => {
    // R107: advisory lock per account — serializira sočasne prilagoditve točk
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${loyaltyPointsLockKey(loyaltyAccountId)}))`

    // Tx-fresh scoped re-read (prej: stale `existing` izven tx določal diff)
    const fresh = await tx.loyaltyAccount.findFirst({
      where: {
        id: loyaltyAccountId,
        ...(sessionLocationId ? { locationId: sessionLocationId } : {}),
      },
    })
    if (!fresh) {
      throw { error: 'Zvestobni račun ni najden', status: 404 }
    }

    const updateData: Record<string, unknown> = {}
    if (data.customerName !== undefined) updateData.customerName = data.customerName
    if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone
    if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail
    if (data.tier !== undefined) updateData.tier = data.tier
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    let pointsDiff = 0
    if (data.pointsBalance !== undefined) {
      const MAX_POINTS_PER_ADJUSTMENT = 50000
      const MAX_TOTAL_POINTS = 500000
      const target = Math.max(0, data.pointsBalance)
      // LO-1: diff iz TX-FRESH zaloge točk (pod lock + Serializable je
      // read-compute-write atomicen — lost update nemogoč)
      const diff = target - toNum(fresh.pointsBalance)
      if (diff > MAX_POINTS_PER_ADJUSTMENT) {
        throw {
          error: `Enkratno prilaganje omejeno na ${MAX_POINTS_PER_ADJUSTMENT} točk. Za večje prilagoditve kontaktirajte administratorja.`,
          status: 400,
        }
      }
      if (target > MAX_TOTAL_POINTS) {
        throw { error: `Skupno število točk ne more preseči ${MAX_TOTAL_POINTS}.`, status: 400 }
      }
      if (diff > 0) {
        // Atomic increment z TX-FRESH diff
        updateData.pointsBalance = { increment: diff }
        if (data.lifetimePoints === undefined) {
          updateData.lifetimePoints = { increment: diff }
        }
      } else if (diff < 0) {
        // Atomic gte guard — unovčenje NIKOLI ne pade pod 0 (dvorno varovalo
        // poleg lock + Serializable)
        const absDiff = Math.abs(diff)
        const guard = await tx.loyaltyAccount.updateMany({
          where: { id: loyaltyAccountId, pointsBalance: { gte: absDiff } },
          data: { pointsBalance: { decrement: absDiff } },
        })
        if (guard.count === 0) {
          throw { error: 'Ni dovolj točk za unovčenje', status: 400 }
        }
      }
      pointsDiff = diff
    }

    if (data.lifetimePoints !== undefined && !updateData.lifetimePoints) {
      updateData.lifetimePoints = Math.max(0, data.lifetimePoints)
    }

    const account = (await tx.loyaltyAccount.update({
      where: { id: loyaltyAccountId },
      data: updateData,
    })) as Record<string, unknown> & { tier: string; lifetimePoints: number }

    // LO-3: tier upgrade od TX-FRESH tierja (upgrade-only — nikoli ponižanje)
    let tierUpgrade: { from: string; to: string } | null = null
    const upgradedTo = maybeTierUpgrade(fresh.tier, toNum(account.lifetimePoints))
    if (upgradedTo) {
      await tx.loyaltyAccount.update({
        where: { id: loyaltyAccountId },
        data: { tier: upgradedTo },
      })
      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId,
          type: 'earn',
          points: 0,
          reason: `Povišanje nivoa v ${tierLabelSi(upgradedTo)}`,
        },
      })
      tierUpgrade = { from: fresh.tier, to: upgradedTo }
      logger.info('LOYALTY', 'Rocni adjust sprozil povicanje nivoa', {
        loyaltyAccountId,
        from: fresh.tier,
        to: upgradedTo,
      })
    }

    // LO-2: transakcijski zapis s TX-FRESH diff (prej stale diff → lažni audit)
    if (data.transaction) {
      const txData = data.transaction
      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId,
          type: txData.type,
          points: txData.points,
          reason: txData.reason || '',
          orderId: txData.orderId || null,
          checkId: txData.checkId || null,
          monetaryValue: txData.monetaryValue ?? 0,
        },
      })
    } else if (pointsDiff !== 0) {
      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId,
          type: pointsDiff > 0 ? 'earn' : 'redeem',
          points: pointsDiff,
          reason: pointsDiff > 0 ? 'Prislužene točke' : 'Unovčenje točk',
        },
      })
    }

    return { account, tierUpgrade, pointsDiff }
  }, TX_OPTS)
}
