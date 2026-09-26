// ============================================
// ŽIVLJENJSKI CIKEL ZVESTOBE — SKUPEN DB IZRAČUN (FIFO expiring približek)
// R143-b (epic #115 #30)
// ============================================
// Skupen vir za GET /api/loyalty/lifecycle (sekcija expiringSoon30d) IN
// POST /api/loyalty-automation akcijo 'expiry_notify' (kontrakt R143-a (b)+(c)).
//
// FIFO PIBLJIŽEK (dokumentirana izbira, zero-migration): točke formalno
// potečejo po 365 dneh (POINTS_EXPIRY_DAYS kanon), a shema NIMA expiresAt
// stolpca niti 'expire' ledgerja (noben zapisovalec — R143-a forenzika).
// Zato je pošten približek: nevarne so točke nad zneskom, ki jih je račun
// prislužil v zadnjih 335 dneh (365 − 30):
//     expiring(account) = max(0, pointsBalance − Σ earn(createdAt ≥ now−335d))
// Zmanjševanje stanja (redeem/adjust/expire) NI odšteto po FIFO vrstnem redu
// — to je zgolj PIBLJIŽEK za obvestila/pregled, ne zapisi. Dejansko pisanje
// type='expire' + decrement je DEFER na migracijo/business odločitev.
//
// UČINKOVITOST (kontrakt: "single groupBy + JS aggregation"): ena findMany
// po scoped računih (cap LIFECYCLE_ACCOUNT_CAP, determinističen orderBy) +
// ENA groupBy po earn transakcijah v oknu — ni per-account poizvedb.

import { db } from '@/lib/db'
import { LIFECYCLE_ACCOUNT_CAP, LIFECYCLE_EXPIRY_WINDOW_DAYS } from './lifecycle-constants'

export interface ExpiringPointsSummary {
  /** Σ max(0, pointsBalance − earn v oknu) po vseh prebranih računih */
  points: number
  /** Št. računov z expiring > 0 */
  accounts: number
  /** true, če je bil dosežen LIFECYCLE_ACCOUNT_CAP (izračun je lahko podrešen) */
  capped: boolean
  /** Št. dejansko prebranih računov (obseg izračuna) */
  scanned: number
}

/** R143-b: koliko točk bo (približek FIFO) poteklo v naslednjih 30 dneh. */
export async function computeExpiringPoints(
  locationId: string | null,
  now: Date = new Date(),
): Promise<ExpiringPointsSummary> {
  const windowStart = new Date(now.getTime() - LIFECYCLE_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // R86-4 kanon: pogojni spread — NIKOLI { locationId: null } (null = super-admin globalni pogled).
  const accounts = await db.loyaltyAccount.findMany({
    where: { isActive: true, ...(locationId ? { locationId } : {}) },
    select: { id: true, pointsBalance: true },
    orderBy: { createdAt: 'desc' }, // determinističen rez pod cap-om
    take: LIFECYCLE_ACCOUNT_CAP,
  })
  if (accounts.length === 0) {
    return { points: 0, accounts: 0, capped: false, scanned: 0 }
  }

  const earnRows = await db.loyaltyTransaction.groupBy({
    by: ['loyaltyAccountId'],
    where: {
      type: 'earn',
      createdAt: { gte: windowStart },
      loyaltyAccountId: { in: accounts.map((a) => a.id) },
    },
    _sum: { points: true },
  })
  const earnByAccount = new Map<string, number>(
    earnRows.map((r) => [r.loyaltyAccountId, r._sum.points ?? 0]),
  )

  let points = 0
  let accountsExpiring = 0
  for (const account of accounts) {
    const expiring = Math.max(0, account.pointsBalance - (earnByAccount.get(account.id) ?? 0))
    if (expiring > 0) {
      points += expiring
      accountsExpiring++
    }
  }

  return {
    points,
    accounts: accountsExpiring,
    // Cap dosežen = rezultat je PODOMAČEN (morda obstaja več računov) —
    // pošten degraded flag (kontrakt R143-b), nikoli lažen "natančen" podatek.
    capped: accounts.length >= LIFECYCLE_ACCOUNT_CAP,
    scanned: accounts.length,
  }
}
