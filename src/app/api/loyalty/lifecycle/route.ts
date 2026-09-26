// ============================================
// R143-b (epic #115 #30) — GET /api/loyalty/lifecycle
// Življenjski cikel zvestobe: EN strežniški agregat za UI sekcijo
// "Življenjski cikel" (R143-c), namesto več klientskih klicev.
// Sekcije: totals, byTier, lifecycleBuckets, expiringSoon30d, topAccounts.
//
// Kanon (1:1 z /api/reports/briefing, kontrakt R143-a):
//   • force-dynamic,
//   • rate limit AUTHENTICATED_LIMIT bucket 'loyalty-lifecycle' (obstoječi
//     preset — novi NE izmišljevati, R140-b/R141-b kanon),
//   • requireAuth view_reports + resolveTenantLocationIdOrThrow (fail-closed;
//     lokacijska seja IGNORIRA ?locationId, super-admin brez parametra = null
//     scope = globalni pogled),
//   • VSAKA sekcija v svojem try/catch (z .catch tovarno) z nevtralnim
//     fallbackom — ena padla sekcija NIKOLI ne 500-a celotnega odgovora;
//     napaka gre v strukturiran log (nikoli v odgovor),
//   • deepToNumbers na meji odgovora,
//   • Cache-Control no-store (osvežinski pregled, ni cache-friendly),
//   • PII kanon: topAccounts = whitelist brez telefona/e-pošte (briefing
//     VIP precedent — PII nikoli ne zapusti strežnika v agregatih).
//
// ZERO-MIGRATION: čisto na obstoječi shemi (LoyaltyAccount/LoyaltyTransaction).
// Dejansko pisanje type='expire' + decrement balans je DEFER (kontrakt
// R143-a) — ta ruta je samo branje.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { deepToNumbers } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { tierProgress, type TierProgress } from '@/lib/loyalty-tiers'
import { computeExpiringPoints } from '@/lib/loyalty/lifecycle'
import {
  LIFECYCLE_ACTIVE_MAX_DAYS,
  LIFECYCLE_ACCOUNT_CAP,
  LIFECYCLE_TOP_ACCOUNTS,
  lifecycleBucketForDays,
  type LifecycleBucket,
} from '@/lib/loyalty/lifecycle-constants'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

interface TotalsSection {
  active: number
  inactive60d: number
}
type ByTierSection = Record<'bronze' | 'silver' | 'gold' | 'platinum', number>
type BucketsSection = Record<LifecycleBucket, number>
interface ExpiringSection {
  points: number
  accounts: number
  capped: boolean
  /** Št. prebranih računov (obseg izračuna — poštena pokritost) */
  scanned: number
}
interface TopAccountRow {
  id: string
  customerName: string
  tier: string
  pointsBalance: number
  lifetimePoints: number
  tierProgress: TierProgress
}

// Nevtralni fallbacki (briefing kanon — vsaka sekcija ima svojega).
const NEUTRAL_TOTALS: TotalsSection = { active: 0, inactive60d: 0 }
const NEUTRAL_BY_TIER: ByTierSection = { bronze: 0, silver: 0, gold: 0, platinum: 0 }
const NEUTRAL_BUCKETS: BucketsSection = { new: 0, active: 0, at_risk: 0, churned: 0 }
const NEUTRAL_EXPIRING: ExpiringSection = { points: 0, accounts: 0, capped: false, scanned: 0 }
const NEUTRAL_TOP_ACCOUNTS: TopAccountRow[] = []

/** Briefing-kanon .catch tovarna: logiraj sekcijo, vrni nevtralni fallback. */
function sectionFallback<T>(section: string, neutral: T) {
  return (error: unknown): T => {
    logger.error('GET /api/loyalty/lifecycle', 'LIFECYCLE_SECTION_FALLBACK', {
      section,
      error: error instanceof Error ? error.message : String(error),
    })
    return neutral
  }
}

// R86-4 kanon: skupni scope za vse sekcije — pogojni spread, NIKOLI
// { locationId: null } (null = super-admin globalni pogled).
function scopedWhere(locationId: string | null) {
  return { isActive: true, ...(locationId ? { locationId } : {}) }
}

// 1. TOTALS — aktivni + neaktivni 60 dni.
// IZBIRA (dokumentirana): inactive60d = aktivni računi brez transakcije v
// zadnjih 60 dneh, VKLJUČNO z računi brez VSEH transakcij (`transactions:
// { none: { createdAt: gte } }` ujema tudi prazne) — 1:1 z obstoječo
// winback statistiko (getLoyaltyAutomationStats, WINBACK_INACTIVE_DAYS=60),
// ena count poizvedba namesto groupBy per account (učinkovito).
async function fetchTotals(locationId: string | null, now: Date): Promise<TotalsSection> {
  const scope = scopedWhere(locationId)
  const cutoff60 = new Date(now.getTime() - LIFECYCLE_ACTIVE_MAX_DAYS * DAY_MS)
  const [active, inactive60d] = await Promise.all([
    db.loyaltyAccount.count({ where: scope }),
    db.loyaltyAccount.count({
      where: { ...scope, transactions: { none: { createdAt: { gte: cutoff60 } } } },
    }),
  ])
  return { active, inactive60d }
}

// 2. BY_TIER — groupBy po nivoju; vsi štirje nivoji VEDNO prisotni z 0
// defaultom (literarni map kanon, BUG-04) — neznane vrednosti v DB se ignorirajo.
async function fetchByTier(locationId: string | null): Promise<ByTierSection> {
  const rows = await db.loyaltyAccount.groupBy({
    by: ['tier'],
    where: scopedWhere(locationId),
    _count: { tier: true },
  })
  const result: ByTierSection = { ...NEUTRAL_BY_TIER }
  for (const row of rows) {
    if (row.tier === 'bronze' || row.tier === 'silver' || row.tier === 'gold' || row.tier === 'platinum') {
      result[row.tier] = row._count.tier
    }
  }
  return result
}

// 3. LIFECYCLE_BUCKETS — segmenti po dnevih od zadnje transakcije
// (new/active/at_risk/churned — konstante v lib/loyalty/lifecycle-constants,
// enoten vir za UI). IZBIRA (dokumentirana): zadnja transakcija per account
// = ENA groupBy po LoyaltyTransaction z _max(createdAt) za scoped accounte
// (indeks [loyaltyAccountId, createdAt]); 'new' = računi brez vnosa v
// groupBy (brez transakcij). Bounded take LIFECYCLE_ACCOUNT_CAP (varovalo,
// tipična lokacija je pod njim — glej konstante header).
async function fetchBuckets(locationId: string | null, now: Date): Promise<BucketsSection> {
  const accounts = await db.loyaltyAccount.findMany({
    where: scopedWhere(locationId),
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: LIFECYCLE_ACCOUNT_CAP,
  })
  const buckets: BucketsSection = { new: 0, active: 0, at_risk: 0, churned: 0 }
  if (accounts.length === 0) return buckets

  const lastTxRows = await db.loyaltyTransaction.groupBy({
    by: ['loyaltyAccountId'],
    where: { loyaltyAccountId: { in: accounts.map((a) => a.id) } },
    _max: { createdAt: true },
  })
  const lastTxByAccount = new Map<string, Date | null>(
    lastTxRows.map((r) => [r.loyaltyAccountId, r._max.createdAt]),
  )
  for (const account of accounts) {
    const last = lastTxByAccount.get(account.id) ?? null
    const days = last ? (now.getTime() - last.getTime()) / DAY_MS : null
    buckets[lifecycleBucketForDays(days)]++
  }
  return buckets
}

// 5. TOP_ACCOUNTS — top 5 po pointsBalance, PII whitelist select (NIČ
// telefona/e-pošte) + tierProgress iz kanonskega lib/loyalty-tiers
// (uvoz, NE dupliciran pragov — ročno dodeljen višji nivo se šteje kot
// trenutni, pariteta earn flow).
async function fetchTopAccounts(locationId: string | null): Promise<TopAccountRow[]> {
  const rows = await db.loyaltyAccount.findMany({
    where: scopedWhere(locationId),
    orderBy: { pointsBalance: 'desc' },
    take: LIFECYCLE_TOP_ACCOUNTS,
    select: {
      id: true,
      customerName: true,
      tier: true,
      pointsBalance: true,
      lifetimePoints: true,
    },
  })
  return rows.map((a) => ({
    id: a.id,
    customerName: a.customerName,
    tier: a.tier,
    pointsBalance: a.pointsBalance,
    lifetimePoints: a.lifetimePoints,
    tierProgress: tierProgress(a.lifetimePoints, a.tier),
  }))
}

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja (briefing/dashboard pariteta)
    const rl = await checkRateLimitAsync('loyalty-lifecycle', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // R80/R85 kanon: tenant scope — lokacijska seja je avtoritativna
    // (?locationId IGNORIRAN), super-admin brez parametra = null scope.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/loyalty/lifecycle',
    })
    if ('error' in scope) return scope.error
    const locationId = scope.locationId
    const now = new Date()

    // Vse sekcije VZPOREDNO (briefing/dashboard kanon) — vsaka z lastnim .catch.
    const [totals, byTier, lifecycleBuckets, expiring, topAccounts] = await Promise.all([
      fetchTotals(locationId, now).catch(sectionFallback('totals', NEUTRAL_TOTALS)),
      fetchByTier(locationId).catch(sectionFallback('byTier', NEUTRAL_BY_TIER)),
      fetchBuckets(locationId, now).catch(sectionFallback('lifecycleBuckets', NEUTRAL_BUCKETS)),
      computeExpiringPoints(locationId, now).catch(sectionFallback('expiringSoon30d', NEUTRAL_EXPIRING)),
      fetchTopAccounts(locationId).catch(sectionFallback('topAccounts', NEUTRAL_TOP_ACCOUNTS)),
    ])

    const payload = {
      totals,
      byTier,
      lifecycleBuckets,
      expiringSoon30d: expiring,
      topAccounts,
      generatedAt: now.toISOString(),
    }

    return NextResponse.json(deepToNumbers(payload), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/loyalty/lifecycle', 'Napaka pri pridobivanju življenjskega cikla zvestobe')
  }
}
