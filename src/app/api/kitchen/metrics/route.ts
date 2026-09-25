// GET /api/kitchen/metrics — KDS production intelligence (R133 / epic #115 P1-09)
//
// READ-ONLY agregati (kanon #5): nikoli ne pišejo Order/OrderItem/KotDocument.
// Shape (kontrakt §4): { window, live, throughput, stations, caps } —
// deepToNumbers na meji, minute round 1, procenti 0–100 round 1.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { deepToNumbers } from '@/lib/decimal'
import {
  computePrepStats,
  computeStationBreakdown,
  resolveBaseAt,
  round1,
  type KdsBumpedRow,
} from '@/lib/kds/metrics'

export const dynamic = 'force-dynamic'
// Pariteta /api/kitchen: live poizvedba z orderItems + menuItem include je lahko počasna.
export const maxDuration = 30

// Kanon #8: prep-time vzorec capped 20.000 vrstic (orderBy readyAt asc, take).
// Ob cap: caps.capped=true + rowsAnalyzed — poročanje korektno za analiziran
// vzorec (starejše bumpi onke CAP meje so izpuščene, asc = najstarejši prvi).
const THROUGHPUT_SAMPLE_CAP = 20_000

// Statusi aktivnih artiklov na KDS (isti nabor kot KDS display — ready-polica
// je ločena, bumped artikli niso več "v vrsti").
const ACTIVE_ITEM_STATUSES = ['pending', 'fired', 'preparing'] as const

/**
 * ?window=today|24h|7d (default 'today'). Neznane vrednosti → defenzivno
 * 'today'. POENOSTAVITEV (dokumentirana v kontraktu §4): business-date kanon
 * P2-08 je ločen — 'today' = začetek trenutnega dneva po LOKALNEM času
 * strežnika (00:00 → now), ne POS poslovni datum.
 */
function resolveWindow(
  searchParams: URLSearchParams,
  now: Date,
): { kind: 'today' | '24h' | '7d'; from: Date; to: Date } {
  const raw = searchParams.get('window')
  const kind: 'today' | '24h' | '7d' = raw === '24h' ? '24h' : raw === '7d' ? '7d' : 'today'
  let from: Date
  if (kind === '24h') {
    from = new Date(now.getTime() - 24 * 60 * 60_000)
  } else if (kind === '7d') {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60_000)
  } else {
    from = new Date(now)
    from.setHours(0, 0, 0, 0)
  }
  return { kind, from, to: now }
}

export async function GET(req: Request) {
  try {
    // Pariteta /api/kitchen + /api/kitchen/matrix: take_orders + tenant scope
    // (fail-closed 403 za regularno vlogo brez lokacije; null scope = admin
    // cross-lokacijski nadzor).
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/kitchen/metrics',
    })
    if ('error' in scope) return scope.error
    const locationId = scope.locationId

    const now = new Date()
    // (destrukturirano — lokalno ime `window` bi senčilo globalnega v jsdom kontekstu)
    const { kind: windowKind, from: windowFrom, to: windowTo } = resolveWindow(searchParams, now)

    // --- LIVE (trenutno stanje) ---
    // Aktivni ticketi = naročila statusa pending/in-progress z VSAJ 1 aktivnim
    // (ne-voidanim) artiklom. Age per ticket = now − (firedAt ?? createdAt)
    // (kanon #4 fallback, pariteta KDS display R114).
    const activeOrders = await db.order.findMany({
      where: {
        status: { in: ['pending', 'in-progress'] },
        ...(locationId ? { locationId } : {}),
        orderItems: { some: { voided: false, status: { in: [...ACTIVE_ITEM_STATUSES] } } },
      },
      select: {
        id: true,
        firedAt: true,
        createdAt: true,
        orderItems: {
          where: { voided: false, status: { in: [...ACTIVE_ITEM_STATUSES] } },
          select: {
            firedAt: true,
            createdAt: true,
            menuItem: { select: { prepStation: { select: { type: true } } } },
          },
        },
      },
    })

    const ticketAgesMinutes = activeOrders.map((o) =>
      Math.max(0, (now.getTime() - resolveBaseAt(o.firedAt, o.createdAt).getTime()) / 60_000),
    )

    // Čakalna vrsta po postaji: groupBy prepStation.type (null → 'other') —
    // število aktivnih artiklov + najstarejši artikel (age = now −
    // (item.firedAt ?? order.createdAt)). Sortirano items desc (najbolj
    // obremenjena postaja prva).
    const queueGroups = new Map<string, { items: number; oldestMinutes: number }>()
    for (const order of activeOrders) {
      const orderCreatedAt = order.createdAt
      for (const item of order.orderItems) {
        const station = item.menuItem?.prepStation?.type ?? 'other'
        const ageMinutes = Math.max(
          0,
          (now.getTime() - resolveBaseAt(item.firedAt, orderCreatedAt).getTime()) / 60_000,
        )
        const bucket = queueGroups.get(station)
        if (bucket) {
          bucket.items += 1
          bucket.oldestMinutes = Math.max(bucket.oldestMinutes, ageMinutes)
        } else {
          queueGroups.set(station, { items: 1, oldestMinutes: ageMinutes })
        }
      }
    }
    const queueByStation = [...queueGroups.entries()]
      .map(([station, q]) => ({ station, items: q.items, oldestMinutes: round1(q.oldestMinutes) }))
      .sort((a, b) => b.items - a.items)

    const live = {
      activeTickets: activeOrders.length,
      oldestTicketMinutes: ticketAgesMinutes.length > 0 ? round1(Math.max(...ticketAgesMinutes)) : null,
      avgTicketAgeMinutes: ticketAgesMinutes.length > 0
        ? round1(ticketAgesMinutes.reduce((sum, a) => sum + a, 0) / ticketAgesMinutes.length)
        : null,
      queueByStation,
    }

    // --- THROUGHPUT (okno) ---
    // Bumped vrstice: readyAt v oknu, ne-voidane, tenant scope prek order.
    // Legacy vrstice (readyAt NULL) so po kanonu #3 naravno izključene
    // (readyAt gte filtrira) — NIKOLI izmišljen čas.
    const bumpedRows = await db.orderItem.findMany({
      where: {
        readyAt: { gte: windowFrom, lte: windowTo },
        voided: false,
        ...(locationId ? { order: { locationId } } : {}),
      },
      select: {
        readyAt: true,
        firedAt: true,
        createdAt: true,
        orderId: true,
        menuItem: { select: { prepStation: { select: { avgPrepTime: true, type: true } } } },
      },
      orderBy: { readyAt: 'asc' },
      take: THROUGHPUT_SAMPLE_CAP,
    })
    // Kanon #8: capped, če je vzorec zadnil mejo (obstajajo lahko še starejše
    // vrstice onke meje — poročilo velja za analizirani vzorec).
    const capped = bumpedRows.length >= THROUGHPUT_SAMPLE_CAP

    // readyAt je po where-gte vedno nastavljen; null-guard je type-level zaščita
    // (Prisma tip je Date | null) + dokumentacija kanona #3 (legacy NULL
    // vrstice NIKOLI ne pridejo v vzorec). new Date() koercija = defensive
    // kopija (vsaka prep stat dobi vlastiti Date, brez cross-realm ali aliasing
    // pasti).
    const kdsRows: KdsBumpedRow[] = bumpedRows
      .filter((row): row is typeof row & { readyAt: Date } => row.readyAt != null)
      .map((row) => ({
      readyAt: new Date(row.readyAt),
      baseAt: resolveBaseAt(row.firedAt, row.createdAt),
      // Tarča priprave: MenuItem.prepTimeMinutes NE obstaja v shemi (obstaja
      // samo DiningOption.prepTimeMinutes + PrepStation.avgPrepTime — odstopanje
      // od kontrakta dokumentirano) → tarča = prepStation.avgPrepTime; brez
      // postaje = brez tarče (izključena iz onTimeRate, šteje se v itemsBumped).
      targetMinutes: row.menuItem?.prepStation?.avgPrepTime ?? null,
      station: row.menuItem?.prepStation?.type ?? null,
      orderId: row.orderId,
      }))

    const stats = computePrepStats(kdsRows)
    const stations = computeStationBreakdown(kdsRows)

    const payload = {
      window: { kind: windowKind, from: windowFrom.toISOString(), to: windowTo.toISOString() },
      live,
      throughput: {
        itemsBumped: stats.count,
        ordersTouched: new Set(kdsRows.map((r) => r.orderId)).size,
        avgFiredToReadyMinutes: stats.avgMinutes,
        medianFiredToReadyMinutes: stats.medianMinutes,
        p90FiredToReadyMinutes: stats.p90Minutes,
        onTimeRate: stats.onTimeRate,
        lateCount: stats.lateCount,
        avgLateMinutes: stats.avgLateMinutes,
      },
      stations,
      caps: { rowsAnalyzed: kdsRows.length, capped },
    }

    return NextResponse.json(deepToNumbers(payload))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/kitchen/metrics', 'Napaka pri pridobivanju KDS metrik')
  }
}
