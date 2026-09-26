// ============================================
// R144-b (epic #115 #31) — GET /api/gift-cards/liability
// Pasivna obveznost darilnih kartic (liability balance): EN strežniški
// agregat za UI sekcijo "Odzavnost" (R144-c), namesto več klientskih klicev.
//
// Semantika (kontrakt R144-a):
//   • outstandingBalance = Σ balance NAD statusi active + depleted — to je
//     denar, ki ga strankam še lahko potrošimo (depleted je zmeraj 0, vključen
//     je zaradi poštenosti formule). SUSPENDED/EXPIRED NE ŠTEJEJO v
//     outstanding (zamrznjen/odpisan saldo — štejeta se samo kot števci);
//     IZBIRA dokumentirana: suspend/potekle karte ostanejo vidne prek
//     števcev + expiringSoon30d, da poročilo pokaže tudi "lazy expiry"
//     ostatke (aktivni potekli saldo, označen šele ob redeem/PUT — R144-a).
//   • expiringSoon30d = status active IN expiresAt ≤ now + 30 dni (zgornja
//     meja SAMO — namerno BREZ spodnje meje: kartice z expiresAt v preteklosti
//     so še vedno 'active' (lazy expiry) in so NAJBOLJ urgente za odpis).
//   • byLocation: lokacijski admin (ali super-admin z ?locationId) dobi
//     ENOJNO vrstico svoje lokacije (tudi z ničelnimi števci); super-admin
//     globalno dobi vrstico za vsako lokacijo s karticami + "Brez lokacije"
//     bucket za null-location kartice (pariteta devices NO_LOCATION_LABEL,
//     deterministično na koncu).
//
// Kanon (1:1 z /api/loyalty/lifecycle R143-b):
//   • force-dynamic, rate limit AUTHENTICATED_LIMIT bucket 'gift-cards-liability',
//   • requireAuth view_reports (liability je poročilo) + resolveTenantLocationIdOrThrow
//     (lokacijska seja avtoritativna — ?locationId IGNORIRAN; super-admin
//     brez parametra = null scope = globalni pogled; z ?locationId = cross-branch),
//   • deepToNumbers na meji odgovora (Decimal(12,2) → number; _sum.balance prek
//     toNum — Number(decimal) precedens),
//   • Cache-Control no-store,
//   • READ-ONLY — NIKOLI audit zapis (branje nima prehoda).
//   • Brez per-sekcijskih .catch fallbackov (R143-b kanon: preproste poizvedbe
//     — 2× groupBy + 1× aggregate + 1× location lookup; napaka → jasen 500).
//
// ZERO-MIGRATION: čisto na obstoječi shemi (GiftCard + Location).

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { GIFT_CARD_EXPIRING_SOON_DAYS } from '@/lib/gift-cards/constants'

export const dynamic = 'force-dynamic'

/** null-location bucket oznaka (pariteta devices/constants NO_LOCATION_LABEL). */
const NO_LOCATION_LABEL = 'Brez lokacije'

const DAY_MS = 24 * 60 * 60 * 1000

interface StatusBucket {
  cards: number
  balance: number
}

interface LocationLiabilityRow {
  locationId: string | null
  locationName: string
  locationCode: string | null
  outstandingBalance: number
  activeCards: number
  depletedCards: number
  suspendedCards: number
  expiredCards: number
}

/** Literarni statusi (BUG-04 kanon) — neznane vrednosti v DB se ignorirajo. */
function emptyBucket(): StatusBucket {
  return { cards: 0, balance: 0 }
}

const DAY_STATUS_KEYS = ['active', 'depleted', 'suspended', 'expired'] as const
type DayStatus = (typeof DAY_STATUS_KEYS)[number]

function isDayStatus(status: string): status is DayStatus {
  return (DAY_STATUS_KEYS as readonly string[]).includes(status)
}

/** outstanding = active + depleted (suspended/expired IZKLJUČENI — glej header). */
function outstandingOf(b: Record<DayStatus, StatusBucket>): number {
  return b.active.balance + b.depleted.balance
}

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja (dashboard/lifecycle pariteta)
    const rl = await checkRateLimitAsync('gift-cards-liability', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // Liability je poročilo → view_reports (ni take_orders — branje agregata,
    // ne checkout fizikalnost)
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // R80/R85 kanon: tenant scope — lokacijska seja je avtoritativna
    // (?locationId IGNORIRAN), super-admin brez parametra = null scope,
    // z ?locationId = cross-branch pogled na eno lokacijo.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/gift-cards/liability',
    })
    if ('error' in scope) return scope.error
    const locationId = scope.locationId

    // R86-4 kanon: pogojni spread — NIKOLI { locationId: null } (null =
    // super-admin globalni pogled).
    const where: Record<string, unknown> = { ...(locationId ? { locationId } : {}) }

    const now = new Date()
    const cutoff30 = new Date(now.getTime() + GIFT_CARD_EXPIRING_SOON_DAYS * DAY_MS)

    // ── 1) TOTALS: groupBy po statusu (_count + _sum balance) ──
    const statusRows = await db.giftCard.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: { balance: true },
    })
    const totalsByStatus: Record<DayStatus, StatusBucket> = {
      active: emptyBucket(),
      depleted: emptyBucket(),
      suspended: emptyBucket(),
      expired: emptyBucket(),
    }
    for (const row of statusRows) {
      if (!isDayStatus(row.status)) continue
      totalsByStatus[row.status].cards += row._count._all
      totalsByStatus[row.status].balance += toNum(row._sum.balance)
    }

    // ── 2) EXPIRING SOON 30d: active IN expiresAt ≤ now+30d (brez spodnje
    //      meje — lazy expiry ostatke naj poročilo pokaže, glej header) ──
    const expiring = await db.giftCard.aggregate({
      where: { ...where, status: 'active', expiresAt: { lte: cutoff30 } },
      _count: { _all: true },
      _sum: { balance: true },
    })

    // ── 3) BY LOCATION: ENA groupBy po (locationId, status) ──
    const locRows = await db.giftCard.groupBy({
      by: ['locationId', 'status'],
      where,
      _count: { _all: true },
      _sum: { balance: true },
    })
    const bucketsByLocation = new Map<string, Record<DayStatus, StatusBucket>>()
    const NULL_KEY = '__null__'
    for (const row of locRows) {
      const key = row.locationId ?? NULL_KEY
      const bucket = bucketsByLocation.get(key) ?? {
        active: emptyBucket(),
        depleted: emptyBucket(),
        suspended: emptyBucket(),
        expired: emptyBucket(),
      }
      if (isDayStatus(row.status)) {
        bucket[row.status].cards += row._count._all
        bucket[row.status].balance += toNum(row._sum.balance)
      }
      bucketsByLocation.set(key, bucket)
    }

    // Lokacijski admin / super-admin z ?locationId: ENOJNA vrstica svoje
    // lokacije — tudi če lokacija še nima kartic (ničelni števci, pošteno
    // prazno stanje namesto izgine ustrezne sekcije v UI).
    if (locationId && !bucketsByLocation.has(locationId)) {
      bucketsByLocation.set(locationId, {
        active: emptyBucket(),
        depleted: emptyBucket(),
        suspended: emptyBucket(),
        expired: emptyBucket(),
      })
    }

    // Imena lokacij — ENA findMany samo za prisotne id-je (null bucket ne
    // potrebuje lookupa; display polja { id, name, code } brez PII).
    const locIds = [...bucketsByLocation.keys()].filter((k) => k !== NULL_KEY)
    const locRowsMeta = locIds.length
      ? await db.location.findMany({
          where: { id: { in: locIds } },
          select: { id: true, name: true, code: true },
        })
      : []
    const nameById = new Map(locRowsMeta.map((l) => [l.id, l]))

    const byLocation: LocationLiabilityRow[] = []
    for (const [key, bucket] of bucketsByLocation) {
      if (key === NULL_KEY) {
        // 'Brez lokacije' deterministično na KONEC (devices kanon)
        byLocation.push({
          locationId: null,
          locationName: NO_LOCATION_LABEL,
          locationCode: null,
          outstandingBalance: outstandingOf(bucket),
          activeCards: bucket.active.cards,
          depletedCards: bucket.depleted.cards,
          suspendedCards: bucket.suspended.cards,
          expiredCards: bucket.expired.cards,
        })
      } else {
        const meta = nameById.get(key)
        byLocation.push({
          locationId: key,
          locationName: meta?.name ?? key,
          locationCode: meta?.code ?? null,
          outstandingBalance: outstandingOf(bucket),
          activeCards: bucket.active.cards,
          depletedCards: bucket.depleted.cards,
          suspendedCards: bucket.suspended.cards,
          expiredCards: bucket.expired.cards,
        })
      }
    }
    byLocation.sort((a, b) => {
      if (a.locationId === null) return 1 // 'Brez lokacije' zadnja
      if (b.locationId === null) return -1
      return a.locationName.localeCompare(b.locationName)
    })

    const payload = {
      totals: {
        outstandingBalance: outstandingOf(totalsByStatus),
        activeCards: totalsByStatus.active.cards,
        depletedCards: totalsByStatus.depleted.cards,
        suspendedCards: totalsByStatus.suspended.cards,
        expiredCards: totalsByStatus.expired.cards,
        expiringSoon30d: {
          cards: expiring._count._all,
          balance: toNum(expiring._sum.balance),
        },
      },
      byLocation,
      generatedAt: now.toISOString(),
    }

    return NextResponse.json(deepToNumbers(payload), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/gift-cards/liability', 'Napaka pri pridobivanju odzavnosti darilnih kartic')
  }
}
