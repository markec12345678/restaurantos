// @vitest-environment node
// ============================================
// R133 / EPIC #115 P1-09 — INTEGRACIJA: KDS BUMP → READYAT STAMPING →
// METRIKE (prava PGlite)
// ============================================
// Kanon P1-09 na pravi bazi (PGlite, izoliran PGLITE_DATA_DIR; vzorec:
// r132-recon-drill):
//   1. PATCH /api/orders/[id] item_status 'ready' → readyAt ≠ null v DB
//      (strežniški timestamp) + readyById/readyByName snapshot (actor iz seje)
//   2. GET /api/kitchen/metrics → realna števila (itemsBumped=1, avg > 0,
//      on-time po targetu — inkluzivna meja, station breakdown, caps)
//   3. Ponovni PATCH ready → readyAt OVERWRITE (čas zadnje priprave)
//   4. Live agregati: aktivni ticketi + čakalna vrsta po postaji (null → 'other')
//   5. ?window=24h — drugo okno
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (route, tx kanon R112 z advisory lockom +
// Serializable, actor lookup, metrics agregati, deepToNumbers) je REALNO.
// Zagon: PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/init-pglite.mjs
//        → PGLITE_DATA_DIR=/tmp/pglite-data-it bunx vitest run
//          tests/integration/r133-kds-metrics-drill.test.ts
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: async () =>
      authRef.current
        ? {
            session: {
              token: 'integration-test-token',
              employeeId: authRef.current.employeeId,
              role: authRef.current.role,
              permissions: authRef.current.permissions,
              createdAt: Date.now(),
              expiresAt: Date.now() + 3_600_000,
              absoluteExpiry: Date.now() + 86_400_000,
              locationId: authRef.current.locationId,
            },
            error: null,
          }
        : { session: null, error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }) },
  }
})

import { db } from '@/lib/db'
import { PATCH as orderPatch } from '@/app/api/orders/[id]/route'
import { GET as metricsGet } from '@/app/api/kitchen/metrics/route'

const RUN_ID = `r133-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  prepStation: `${RUN_ID}-st`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-mi`,
  orderA: `${RUN_ID}-ord-a`,
  itemA: `${RUN_ID}-item-a`,
  orderB: `${RUN_ID}-ord-b`,
  itemB: `${RUN_ID}-item-b`,
}

const KUHAR_NAME = 'R133 Kuhar'
const TARGET_MIN = 15 // prepStation.avgPrepTime — on-time meja (inkluzivna)

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function authedReq(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers)
  headers.set('authorization', 'Bearer integration')
  return new Request(url, { ...init, headers })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function patchItemReady(orderId: string, itemId: string) {
  return orderPatch(
    authedReq(`http://local/api/orders/${orderId}?locationId=${IDS.location}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'item_status', itemId, status: 'ready' }),
    }),
    params(orderId),
  )
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.location, name: 'R133 Lokacija', code: `${RUN_ID}-L`, premisesId: `${RUN_ID}-p`, isActive: true } })
  await db.employee.create({
    data: { id: IDS.employee, name: KUHAR_NAME, email: `${RUN_ID}@r133-test.local`, role: 'manager', status: 'active', locationId: IDS.location },
  })
  await db.prepStation.create({
    data: { id: IDS.prepStation, name: 'R133 Vroča kuhinja', type: 'kitchen', avgPrepTime: TARGET_MIN, locationId: IDS.location },
  })
  await db.menu.create({ data: { id: IDS.menu, name: `R133 Meni ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `R133 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({
    data: { id: IDS.menuItem, name: 'R133 Test Pica', price: 9.5, categoryId: IDS.category, vatRate: 9.5, prepStationId: IDS.prepStation },
  })

  // Order A + artikel (firedAt 8 min nazaj → elapsed ≈ 8 < target 15 = on-time)
  await db.order.create({
    data: {
      id: IDS.orderA,
      orderNumber: 133001,
      status: 'in-progress',
      locationId: IDS.location,
      firedAt: new Date(Date.now() - 15 * 60_000),
    },
  })
  await db.orderItem.create({
    data: {
      id: IDS.itemA,
      orderId: IDS.orderA,
      menuItemId: IDS.menuItem,
      quantity: 1,
      price: 9.5,
      status: 'fired',
      firedAt: new Date(Date.now() - 8 * 60_000),
    },
  })

  // Order B + AKTIVNI artikel (pending, brez firedAt) — za live agregate
  await db.order.create({
    data: {
      id: IDS.orderB,
      orderNumber: 133002,
      status: 'in-progress',
      locationId: IDS.location,
      firedAt: null,
    },
  })
  await db.orderItem.create({
    data: {
      id: IDS.itemB,
      orderId: IDS.orderB,
      menuItemId: IDS.menuItem,
      quantity: 1,
      price: 4.5,
      status: 'pending',
    },
  })

  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.location, permissions: ['take_orders'] }
})

afterAll(async () => {
  // Čiščenje po FK redu (artikli → naročila → katalog → postaja → oseba → lokacija)
  await db.orderItem.deleteMany({ where: { orderId: { in: [IDS.orderA, IDS.orderB] } } }).catch(() => {})
  await db.order.deleteMany({ where: { id: { in: [IDS.orderA, IDS.orderB] } } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.prepStation.deleteMany({ where: { id: IDS.prepStation } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R133 integracija: bump → readyAt stamping → metrike', () => {
  it('(1) PATCH item_status "ready" → readyAt ≠ null v DB + readyById/readyByName snapshot', async () => {
    const res = await patchItemReady(IDS.orderA, IDS.itemA)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.success).toBe(true)

    const item = await db.orderItem.findUnique({ where: { id: IDS.itemA } })
    expect(item!.status).toBe('ready')
    expect(item!.readyAt).not.toBeNull()
    expect(item!.readyAt!.getTime()).toBeGreaterThan(Date.now() - 60_000) // strežniški timestamp ≈ now
    expect(item!.readyById).toBe(IDS.employee)
    expect(item!.readyByName).toBe(KUHAR_NAME) // snapshot imena (actor lookup)
  })

  it('(2) GET /api/kitchen/metrics → realna števila (itemsBumped, prep stats, on-time, stations, caps)', async () => {
    const res = await metricsGet(authedReq(`http://local/api/kitchen/metrics?locationId=${IDS.location}`))
    expect(res.status).toBe(200)
    const body = await asJson(res)

    expect((body.window as Record<string, unknown>).kind).toBe('today')

    const throughput = body.throughput as Record<string, unknown>
    expect(throughput.itemsBumped).toBe(1)
    expect(throughput.ordersTouched).toBe(1)
    // prep = readyAt − firedAt ≈ 8 min (> 0, < target 15)
    expect(Number(throughput.avgFiredToReadyMinutes)).toBeGreaterThan(0)
    expect(Number(throughput.avgFiredToReadyMinutes)).toBeLessThan(TARGET_MIN)
    // inkluzivna meja: elapsed ≈ 8 ≤ target 15 → on-time 100 %
    expect(throughput.onTimeRate).toBe(100)
    expect(throughput.lateCount).toBe(0)

    const stations = body.stations as Array<Record<string, unknown>>
    expect(stations).toHaveLength(1)
    expect(stations[0]).toMatchObject({ station: 'kitchen', itemsBumped: 1, onTimeRate: 100, lateCount: 0 })
    expect(Number(stations[0].avgMinutes)).toBeGreaterThan(0)

    expect(body.caps).toEqual({ rowsAnalyzed: 1, capped: false })
  })

  it('(3) ponovni PATCH ready → readyAt OVERWRITE (čas zadnje priprave), itemsBumped ostane 1', async () => {
    const forcedOld = new Date('2026-01-01T00:00:00.000Z')
    await db.orderItem.update({ where: { id: IDS.itemA }, data: { readyAt: forcedOld } })

    // ready → preparing (non-ready NE počisti readyAt) → ready (overwrite)
    await orderPatch(
      authedReq(`http://local/api/orders/${IDS.orderA}?locationId=${IDS.location}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'item_status', itemId: IDS.itemA, status: 'preparing' }),
      }),
      params(IDS.orderA),
    )
    const afterPreparing = await db.orderItem.findUnique({ where: { id: IDS.itemA } })
    expect(afterPreparing!.readyAt).toEqual(forcedOld)

    const res = await patchItemReady(IDS.orderA, IDS.itemA)
    expect(res.status).toBe(200)

    const item = await db.orderItem.findUnique({ where: { id: IDS.itemA } })
    expect(item!.readyAt!.getTime()).toBeGreaterThan(forcedOld.getTime())

    // vzorec še vedno 1 vrstica (isti artikel — overwrite, ne duplikat)
    const res2 = await metricsGet(authedReq(`http://local/api/kitchen/metrics?locationId=${IDS.location}&window=24h`))
    const body2 = await asJson(res2)
    expect((body2.window as Record<string, unknown>).kind).toBe('24h')
    expect((body2.throughput as Record<string, unknown>).itemsBumped).toBe(1)
  })

  it('(4) live agregati: aktivni ticketi + čakalna vrsta po postaji (null → "other")', async () => {
    const res = await metricsGet(authedReq(`http://local/api/kitchen/metrics?locationId=${IDS.location}`))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const live = body.live as Record<string, unknown>

    // Order A ima vse artikle ready → ni več aktiven; Order B (pending artikel) = 1 ticket
    expect(live.activeTickets).toBe(1)
    expect(Number(live.oldestTicketMinutes)).toBeGreaterThanOrEqual(0)
    expect(Number(live.avgTicketAgeMinutes)).toBeGreaterThanOrEqual(0)

    const queue = live.queueByStation as Array<Record<string, unknown>>
    expect(queue).toHaveLength(1)
    // artikel B → menuItem R133 Test Pica ima prepStation 'kitchen'
    expect(queue[0]).toMatchObject({ station: 'kitchen', items: 1 })
    expect(Number(queue[0].oldestMinutes)).toBeGreaterThanOrEqual(0)
  })

  it('(5) ?window=7d — korektno okno (kind + itemsBumped 1)', async () => {
    const res = await metricsGet(authedReq(`http://local/api/kitchen/metrics?locationId=${IDS.location}&window=7d`))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect((body.window as Record<string, unknown>).kind).toBe('7d')
    expect((body.throughput as Record<string, unknown>).itemsBumped).toBe(1)
  })
})
