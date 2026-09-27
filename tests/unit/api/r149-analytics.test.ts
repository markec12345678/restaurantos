// ============================================
// R149-b — EPIC #115 #36 ADVANCED ANALYTICS — trap-DB uniti
// ============================================
// Vzorec r146-accounting-export / r147-portability (vi.hoisted +
// vi.mock('@/lib/db') + vi.mock('@/lib/auth-middleware') z importOriginal
// spreadom — requireAuth na meji z REALEN hasPermission; tenant resolverji
// REALNI iz '@/lib/tenant-scope' (ruta uvaža direktno, NI barrel);
// rateLimitedResponse REALen — 429 shape gre čez pravi helper; pctChange +
// LJ časovni kanon REALna — P2-08 dokaz na pravih modulih).
//
// Pokritje (kontrakt R149-a):
//   GET /api/analytics/overview
//    1.  rl bucket 'analytics' PRED authom (getClientIp + AUTHENTICATED_LIMIT,
//        invocationCallOrder pin) — presets.ts NESPREMENJEN (prosti vedro)
//    2.  429 realen rateLimitedResponse — zero-DB, zero-audit
//    3.  401 fail-closed (tudi { session: null, error: null } javna pot)
//    4.  403 realen hasPermission (waiter/take_orders za view_reports) —
//        zero-DB, zero-audit + permission pin view_reports
//    5.  MODEL A: staff z lokacijo — ?locationId ignoriran (seja avtoritativna)
//    6.  MODEL A: super-admin brez ?locationId → global (where brez filtra)
//    7.  MODEL A: super-admin z ?locationId → cross-branch (vsi 5 where pinov)
//    8.  MODEL A: manager BREZ lokacije → 403 NO_LOCATION_MESSAGE (fail-closed)
//    9.  MODEL A: neobstoječa lokacija → 200, 2× byte-identičen body (zero-oracle)
//   10.  400 ×7: manjkajoč start/end, slab format ×2, neznana granularnost,
//        okno > 90 dni, start < 2020, start > end — točna SI sporočila, zero-DB
//   11.  ROW_CAP: count 50001 → 400 točno sporočilo + findMany/aggregate/
//        groupBy NIČ + count args pin; 50000 → preide; count PRED findMany
//   12.  LJ koledar (P2-08): window bounds po LJ polnoči; order 00:30 UTC →
//        LJ ura 1; order 23:30 UTC prejšnjega dne → NASLEDNJI LJ dan, ura 0;
//        fiksno dolge serije (prazna vedra) day/week/month; 24-urni vektor
//   13.  comparison: pctChange matematika + zero-previous guard (null) +
//        prev-okno bounds pin (enako dolgo, takoj pred start)
//   14.  determinizem: orderBy [{paidAt asc},{id asc}] + minimal select;
//        tie-breakerji topItems/category/payment/type/staff; staff cap 20;
//        2 klica byte-identičen body; BREZ generatedAt v odgovoru
//   15.  shape: točne top-level ključe + window/kpis/meta + Decimal rounding
//        (toNum/round2) + no-store na 200+400+401+403+429 + NIČ audit zapisa
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

const mocks = vi.hoisted(() => ({
  // db modeli (samo tiste, ki jih analytics ruta/helpers lahko pokličejo)
  orderFindMany: vi.fn(),
  orderCount: vi.fn(),
  orderAggregate: vi.fn(),
  orderGroupBy: vi.fn(),
  orderItemGroupBy: vi.fn(),
  paymentGroupBy: vi.fn(),
  menuItemFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  // infra
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  const dbMock = {
    order: {
      findMany: mocks.orderFindMany,
      count: mocks.orderCount,
      aggregate: mocks.orderAggregate,
      groupBy: mocks.orderGroupBy,
    },
    orderItem: { groupBy: mocks.orderItemGroupBy },
    payment: { groupBy: mocks.paymentGroupBy },
    menuItem: { findMany: mocks.menuItemFindMany },
    employee: { findMany: mocks.employeeFindMany },
  }
  return { db: dbMock, createAuditLog: mocks.createAuditLog }
})

// requireAuth mockan na meji z REALEN hasPermission (r145/r146 kanon);
// tenant resolverji ostanejo REALNI ('@/lib/tenant-scope' NI mockan).
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as overviewGET } from '@/app/api/analytics/overview/route'
import { hasPermission } from '@/lib/auth-middleware/permissions'
import { NO_LOCATION_MESSAGE } from '@/lib/tenant-scope'
import { ANALYTICS_MAX_WINDOW_DAYS, ANALYTICS_ROW_CAP } from '@/app/api/analytics/overview/_helpers'

// sessionRef — requireAuth mock bere trenutno sejo (r145 kanon)
const sessionRef: { current: Record<string, unknown> | null } = { current: null }

// groupBy fixture refi (2 klica per model — razlikujemo po args.by / args.take)
const topItemGroupsRef: { current: unknown[] } = { current: [] }
const categoryGroupsRef: { current: unknown[] } = { current: [] }
const orderTypeGroupsRef: { current: unknown[] } = { current: [] }
const staffGroupsRef: { current: unknown[] } = { current: [] }

// ---------- Fixture helperji ----------

type SessionOverrides = Record<string, unknown>

function session(overrides: SessionOverrides = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['view_reports'],
    locationId: LOC_A,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

const locStaffSession = () => session()
const superAdminSession = () =>
  session({ role: 'super_admin', locationId: null, permissions: ['admin', 'view_reports'] })
const waiterSession = () => session({ role: 'waiter', permissions: ['take_orders'] })

const unauthorized = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }),
})

const forbidden = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Nimate dovoljenja za to operacijo.' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  }),
})

function overviewURL(params: string): string {
  return `http://localhost:3000/api/analytics/overview?${params}`
}

const WEEK = 'start=2026-01-01&end=2026-01-07' // 7 dni, CET (UTC+1)

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    paidAt: new Date('2026-01-02T10:00:00Z'),
    total: new Prisma.Decimal('100.00'),
    tip: new Prisma.Decimal('5.00'),
    tax: new Prisma.Decimal('22.00'),
    discount: new Prisma.Decimal('0'),
    type: 'dine-in',
    employeeId: 'emp-1',
    ...overrides,
  }
}

function itemGroup(menuItemId: string, quantity: number, price: string) {
  return { menuItemId, _sum: { quantity, price: new Prisma.Decimal(price) } }
}

beforeEach(() => {
  vi.clearAllMocks()
  topItemGroupsRef.current = []
  categoryGroupsRef.current = []
  orderTypeGroupsRef.current = []
  staffGroupsRef.current = []

  // requireAuth na meji z REALEN hasPermission — ruta mora sama zahtevati
  // pravi permission ('view_reports'), sicer 401/403 kanon
  mocks.requireAuth.mockImplementation(async (_req: Request, opts?: { permission?: string | string[] }) => {
    if (!sessionRef.current) return unauthorized()
    const required = !opts?.permission ? [] : Array.isArray(opts.permission) ? opts.permission : [opts.permission]
    if (!hasPermission(sessionRef.current as never, required as never)) return forbidden()
    return { session: sessionRef.current, error: null }
  })
  sessionRef.current = locStaffSession()
  mocks.getClientIp.mockReturnValue('203.0.113.7')
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.createAuditLog.mockResolvedValue(undefined)

  mocks.orderFindMany.mockResolvedValue([])
  mocks.orderCount.mockResolvedValue(0)
  mocks.orderAggregate.mockResolvedValue({ _sum: { total: null }, _count: 0 })
  mocks.orderGroupBy.mockImplementation(async (args: { by: string[] }) =>
    args.by[0] === 'employeeId' ? staffGroupsRef.current : orderTypeGroupsRef.current,
  )
  mocks.orderItemGroupBy.mockImplementation(async (args: { take?: number }) =>
    args.take != null ? topItemGroupsRef.current : categoryGroupsRef.current,
  )
  mocks.paymentGroupBy.mockResolvedValue([])
  mocks.menuItemFindMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) =>
    args.where.id.in.map((id) => ({ id, name: `Artikel ${id}`, category: { name: `Kategorija ${id}` } })),
  )
  mocks.employeeFindMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) =>
    args.where.id.in.map((id) => ({ id, name: `Zaposleni ${id}` })),
  )
})

const dbMocks = [
  'orderFindMany', 'orderCount', 'orderAggregate', 'orderGroupBy',
  'orderItemGroupBy', 'paymentGroupBy', 'menuItemFindMany', 'employeeFindMany',
] as const

function expectZeroDB() {
  for (const name of dbMocks) {
    expect(mocks[name]).not.toHaveBeenCalled()
  }
}

// ════════════════════════════════════════════════════════════════
// Rate limit + auth vrata
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — rate limit + auth vrata', () => {
  it("1. rl bucket 'analytics' PRED authom — getClientIp(req) + AUTHENTICATED_LIMIT + view_reports pin", async () => {
    const req = new Request(overviewURL(WEEK))
    const res = await overviewGET(req)

    expect(res.status).toBe(200)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      'analytics',
      '203.0.113.7',
      { maxRequests: 120, windowMs: 60_000 },
    )
    expect(mocks.getClientIp).toHaveBeenCalledWith(req)
    // PRED authom: invocationCallOrder pin (rl tik pred requireAuth)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledTimes(1)
    expect(mocks.requireAuth).toHaveBeenCalledTimes(1)
    expect(mocks.checkRateLimitAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requireAuth.mock.invocationCallOrder[0],
    )
    // permission pin: read-only reporting gate (isti kot dashboard/reports)
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'view_reports' })
  })

  it('2. presežen rl → 429 realen rateLimitedResponse (Retry-After 30, remaining 0, no-store), zero-DB, zero-audit', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })

    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.requireAuth).not.toHaveBeenCalled()
    expectZeroDB()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('3. 401 fail-closed — zero-DB, zero-audit, no-store', async () => {
    mocks.requireAuth.mockImplementation(async () => unauthorized())

    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(401)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expectZeroDB()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('3b. { session: null, error: null } javna pot → 401 fail-closed (BUG-HUNT kanon)', async () => {
    mocks.requireAuth.mockImplementation(async () => ({ session: null, error: null }))

    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(401)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expectZeroDB()
  })

  it("4. 403 realen hasPermission (waiter/take_orders za 'view_reports') — zero-DB, zero-audit", async () => {
    sessionRef.current = waiterSession()
    // realen hasPermission pin: waiter brez view_reports pade
    expect(hasPermission(waiterSession() as never, ['view_reports'])).toBe(false)
    // manager bypass preide (pariteta reports/dashboard gate)
    expect(hasPermission(locStaffSession() as never, ['view_reports'])).toBe(true)

    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(403)
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'view_reports' })
    expectZeroDB()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('5. manager (view_reports) preide → 200 + no-store', async () => {
    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

// ════════════════════════════════════════════════════════════════
// MODEL A scope (where pini)
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — MODEL A scope', () => {
  it('6. staff z lokacijo → seja avtoritativna, ?locationId TUJA ignoriran (count + findMany + groupBy)', async () => {
    sessionRef.current = locStaffSession()

    await overviewGET(new Request(overviewURL(`${WEEK}&locationId=${LOC_B}`)))

    const countWhere = mocks.orderCount.mock.calls[0][0].where
    expect(countWhere.locationId).toBe(LOC_A)
    const findWhere = mocks.orderFindMany.mock.calls[0][0].where
    expect(findWhere.locationId).toBe(LOC_A)
    // relacijski scope-i sledijo isti lokaciji
    const topArgs = mocks.orderItemGroupBy.mock.calls[0][0]
    expect(topArgs.where.order.locationId).toBe(LOC_A)
    const payArgs = mocks.paymentGroupBy.mock.calls[0][0]
    expect(payArgs.where.check.order.locationId).toBe(LOC_A)
  })

  it('7. super-admin brez ?locationId → GLOBAL (where BREZ lokacijskega filtra)', async () => {
    sessionRef.current = superAdminSession()

    await overviewGET(new Request(overviewURL(WEEK)))

    const countWhere = mocks.orderCount.mock.calls[0][0].where
    expect(countWhere.locationId).toBeUndefined()
    const findWhere = mocks.orderFindMany.mock.calls[0][0].where
    expect(findWhere.locationId).toBeUndefined()
    expect(mocks.orderItemGroupBy.mock.calls[0][0].where.order.locationId).toBeUndefined()
    expect(mocks.paymentGroupBy.mock.calls[0][0].where.check.order.locationId).toBeUndefined()
  })

  it('8. super-admin z ?locationId=LOC_B → cross-branch na vseh 5 poizvedbah', async () => {
    sessionRef.current = superAdminSession()

    await overviewGET(new Request(overviewURL(`${WEEK}&locationId=${LOC_B}`)))

    expect(mocks.orderCount.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.orderItemGroupBy.mock.calls[0][0].where.order.locationId).toBe(LOC_B)
    expect(mocks.orderItemGroupBy.mock.calls[1][0].where.order.locationId).toBe(LOC_B)
    expect(mocks.paymentGroupBy.mock.calls[0][0].where.check.order.locationId).toBe(LOC_B)
    // order.groupBy (type mix) — 2. klic je staff (by employeeId), 1. je type
    expect(mocks.orderGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.orderGroupBy.mock.calls[1][0].where.locationId).toBe(LOC_B)
  })

  it('8b. regular brez lokacije (manager, locationId null) → 403 NO_LOCATION_MESSAGE fail-closed, zero-DB', async () => {
    sessionRef.current = session({ locationId: null })

    const res = await overviewGET(new Request(overviewURL(`${WEEK}&locationId=${LOC_B}`)))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe(NO_LOCATION_MESSAGE)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expectZeroDB()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('9. neobstoječa ?locationId → 200 prazne sekcije, 2× byte-identičen body (zero-oracle)', async () => {
    sessionRef.current = superAdminSession()

    const resGhost = await overviewGET(new Request(overviewURL(`${WEEK}&locationId=loc-ne-obstaja`)))
    const resEmpty = await overviewGET(new Request(overviewURL(`${WEEK}&locationId=${LOC_B}`)))

    expect(resGhost.status).toBe(200)
    expect(resEmpty.status).toBe(200)
    const ghostText = await resGhost.text()
    const emptyText = await resEmpty.text()
    expect(ghostText).toBe(emptyText)

    const body = JSON.parse(ghostText)
    expect(body.topItems).toEqual([])
    expect(body.categoryBreakdown).toEqual([])
    expect(body.paymentMix).toEqual([])
    expect(body.orderTypeMix).toEqual([])
    expect(body.staffPerformance).toEqual([])
    expect(body.kpis).toEqual({ revenue: 0, tax: 0, tips: 0, discounts: 0, orders: 0, avgOrderValue: 0 })
    expect(body.hourlyProfile).toHaveLength(24)
    expect(body.series).toHaveLength(7)
  })
})

// ════════════════════════════════════════════════════════════════
// 400 vrata (params + fail-closed caps)
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — 400 vrata (params + caps)', () => {
  const cases: Array<[string, string, string]> = [
    ['start manjka', 'end=2026-01-07', 'Začetni datum je obvezen.'],
    ['end manjka', 'start=2026-01-01', 'Končni datum je obvezen.'],
    ['slab format start', 'start=15.01.2026&end=2026-01-07', 'Začetni datum mora biti v formatu YYYY-MM-DD'],
    ['slab format end', 'start=2026-01-01&end=07.01.2026', 'Končni datum mora biti v formatu YYYY-MM-DD'],
    ['neznana granularnost', `${WEEK}&granularity=year`, 'Neznana granularnost. Dovoljene: day, week, month'],
    ['okno > 90 dni', 'start=2026-01-01&end=2026-04-01', 'Obdobje ne sme preseči 90 dni. Uporabite manjše obdobje.'],
    ['start < 2020', 'start=2019-12-31&end=2026-01-07', 'Začetni datum ne more biti pred 2020'],
    ['start > end', 'start=2026-01-07&end=2026-01-01', 'Začetni datum mora biti pred končnim'],
  ]

  for (const [name, params, message] of cases) {
    it(`400: ${name} → točno sporočilo, zero-DB, zero-audit`, async () => {
      const res = await overviewGET(new Request(overviewURL(params)))

      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe(message)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expectZeroDB()
      expect(mocks.createAuditLog).not.toHaveBeenCalled()
    })
  }

  it('10b. granularnost manjka → privzeto day (200, window.granularity day)', async () => {
    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(200)
    expect((await res.json()).window.granularity).toBe('day')
  })

  it('10c. okno TOČNO 90 dni preide (meja cap-a)', async () => {
    const res = await overviewGET(new Request(overviewURL('start=2026-01-01&end=2026-03-31')))

    expect(res.status).toBe(200)
    expect((await res.json()).meta.windowDays).toBe(90)
  })
})

// ════════════════════════════════════════════════════════════════
// ROW_CAP (fail-closed, R148 CAP precedens)
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — ROW_CAP fail-closed', () => {
  it('11. count 50001 > 50_000 → 400 točno sporočilo, findMany/aggregate/groupBy NIČ, zero-audit', async () => {
    mocks.orderCount.mockResolvedValue(50_001)

    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Okno zajema preveč naročil (50001). Zožite obdobje.')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
    expect(mocks.orderAggregate).not.toHaveBeenCalled()
    expect(mocks.orderGroupBy).not.toHaveBeenCalled()
    expect(mocks.orderItemGroupBy).not.toHaveBeenCalled()
    expect(mocks.paymentGroupBy).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()

    // count args pin: paid okno + scope
    const args = mocks.orderCount.mock.calls[0][0]
    expect(args.where.paymentStatus).toBe('paid')
    expect(args.where.paidAt.gte.toISOString()).toBe('2025-12-31T23:00:00.000Z')
    expect(args.where.paidAt.lt.toISOString()).toBe('2026-01-07T23:00:00.000Z')
    expect(args.where.locationId).toBe(LOC_A)
  })

  it('11b. count == 50_000 (meja) → preide do findMany', async () => {
    mocks.orderCount.mockResolvedValue(ANALYTICS_ROW_CAP)

    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(200)
    expect(mocks.orderFindMany).toHaveBeenCalledTimes(1)
  })

  it('11c. count() teče PRED findMany (invocationCallOrder)', async () => {
    await overviewGET(new Request(overviewURL(WEEK)))

    expect(mocks.orderCount).toHaveBeenCalledTimes(1)
    expect(mocks.orderCount.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.orderFindMany.mock.invocationCallOrder[0],
    )
  })

  it('11d. konstanti izvoženi za teste (fail-closed caps)', () => {
    expect(ANALYTICS_MAX_WINDOW_DAYS).toBe(90)
    expect(ANALYTICS_ROW_CAP).toBe(50_000)
  })
})

// ════════════════════════════════════════════════════════════════
// LJ koledar bucketizacija (P2-08)
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — LJ koledar (P2-08)', () => {
  it('12. okno = LJ polnoči (CET): paidAt gte/lt bounds pin za 7-dnevno okno', async () => {
    await overviewGET(new Request(overviewURL(WEEK)))

    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.paymentStatus).toBe('paid')
    expect(where.paidAt.gte.toISOString()).toBe('2025-12-31T23:00:00.000Z')
    expect(where.paidAt.lt.toISOString()).toBe('2026-01-07T23:00:00.000Z')
  })

  it('12b. order 2026-01-15T00:30:00Z (CET) → LJ ura 1 (NE utc ura 0), LJ dan enak', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ paidAt: new Date('2026-01-15T00:30:00Z'), total: new Prisma.Decimal('40.00') }),
    ])

    const res = await overviewGET(new Request(overviewURL('start=2026-01-15&end=2026-01-15')))
    const body = await res.json()

    // LJ midnight okna: 2026-01-14T23:00:00Z (CET) — UTC-day bucketing bi zgrešil
    expect(mocks.orderFindMany.mock.calls[0][0].where.paidAt.gte.toISOString()).toBe('2026-01-14T23:00:00.000Z')
    expect(body.hourlyProfile[0].orders).toBe(0)
    expect(body.hourlyProfile[1].orders).toBe(1)
    expect(body.hourlyProfile[1].revenue).toBe(40)
    expect(body.series).toHaveLength(1)
    expect(body.series[0].bucket).toBe('2026-01-15')
    expect(body.series[0].orders).toBe(1)
  })

  it('12c. order 2026-01-14T23:30:00Z → NASLEDNJI LJ dan (2026-01-15), LJ ura 0', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ paidAt: new Date('2026-01-14T23:30:00Z'), total: new Prisma.Decimal('25.00') }),
    ])

    const res = await overviewGET(new Request(overviewURL('start=2026-01-15&end=2026-01-15')))
    const body = await res.json()

    expect(body.series[0].bucket).toBe('2026-01-15')
    expect(body.series[0].orders).toBe(1)
    expect(body.hourlyProfile[0].orders).toBe(1)
    expect(body.hourlyProfile[1].orders).toBe(0)
  })

  it('12d. fiksno dolga serija vključno s praznimi vedri (day) + 24-urni vektor', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ paidAt: new Date('2026-01-02T12:00:00Z'), total: new Prisma.Decimal('80.00') }),
    ])

    const res = await overviewGET(new Request(overviewURL('start=2026-01-01&end=2026-01-03')))
    const body = await res.json()

    expect(body.series).toHaveLength(3)
    expect(body.series[0]).toEqual({
      bucket: '2026-01-01', start: '2025-12-31T23:00:00.000Z', end: '2026-01-01T23:00:00.000Z',
      revenue: 0, orders: 0, avgOrderValue: 0,
    })
    expect(body.series[1]).toEqual({
      bucket: '2026-01-02', start: '2026-01-01T23:00:00.000Z', end: '2026-01-02T23:00:00.000Z',
      revenue: 80, orders: 1, avgOrderValue: 80,
    })
    expect(body.series[2].orders).toBe(0)
    expect(body.hourlyProfile).toHaveLength(24)
  })

  it('12e. granularity=week → ISO tedni, fiksna vedra, row pade v svoj ISO teden', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ paidAt: new Date('2026-01-06T12:00:00Z'), total: new Prisma.Decimal('60.00') }),
    ])

    const res = await overviewGET(
      new Request(overviewURL('start=2026-01-01&end=2026-01-14&granularity=week')),
    )
    const body = await res.json()

    expect(body.window.granularity).toBe('week')
    expect(body.series.map((b: { bucket: string }) => b.bucket)).toEqual(['2026-W01', '2026-W02', '2026-W03'])
    expect(body.series[1].orders).toBe(1)
    expect(body.series[1].revenue).toBe(60)
    expect(body.series[0].orders).toBe(0)
    expect(body.series[2].orders).toBe(0)
  })

  it('12f. granularity=month → koledarski meseci, row pade v svoj mesec', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ paidAt: new Date('2026-02-10T12:00:00Z'), total: new Prisma.Decimal('90.00') }),
    ])

    const res = await overviewGET(
      new Request(overviewURL('start=2026-01-15&end=2026-03-20&granularity=month')),
    )
    const body = await res.json()

    expect(body.window.granularity).toBe('month')
    expect(body.series.map((b: { bucket: string }) => b.bucket)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(body.series[1].orders).toBe(1)
    expect(body.series[1].revenue).toBe(90)
  })

  it('12g. meta.windowDays = inkluzivna dolžina okna (end je INKLUZIVEN)', async () => {
    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    expect(body.meta.windowDays).toBe(7)
    expect(body.window).toEqual({
      start: '2026-01-01', end: '2026-01-07', granularity: 'day',
      prevStart: '2025-12-25', prevEnd: '2025-12-31',
    })
  })
})

// ════════════════════════════════════════════════════════════════
// Comparison (pctChange kanon, daily-digest precedens)
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — comparison', () => {
  it('13. pctChange matematika: 1000 vs 800 → +25; orders 2 vs 2 → 0; AOV 500 vs 400 → +25', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ total: new Prisma.Decimal('600.00'), tip: new Prisma.Decimal('0'), tax: new Prisma.Decimal('0') }),
      orderRow({ total: new Prisma.Decimal('400.00'), tip: new Prisma.Decimal('0'), tax: new Prisma.Decimal('0') }),
    ])
    mocks.orderAggregate.mockResolvedValue({ _sum: { total: new Prisma.Decimal('800.00') }, _count: 2 })

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    expect(body.kpis.revenue).toBe(1000)
    expect(body.kpis.orders).toBe(2)
    expect(body.kpis.avgOrderValue).toBe(500)
    expect(body.comparison.revenue).toEqual({ current: 1000, previous: 800, deltaPct: 25 })
    expect(body.comparison.orders).toEqual({ current: 2, previous: 2, deltaPct: 0 })
    expect(body.comparison.avgOrderValue).toEqual({ current: 500, previous: 400, deltaPct: 25 })
  })

  it('13b. zero-previous guard: prev 0 → deltaPct null (NE "∞ %")', async () => {
    mocks.orderFindMany.mockResolvedValue([orderRow()])
    mocks.orderAggregate.mockResolvedValue({ _sum: { total: null }, _count: 0 })

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    expect(body.comparison.revenue.previous).toBe(0)
    expect(body.comparison.revenue.deltaPct).toBeNull()
    expect(body.comparison.orders.previous).toBe(0)
    expect(body.comparison.orders.deltaPct).toBeNull()
    expect(body.comparison.avgOrderValue.previous).toBe(0)
    expect(body.comparison.avgOrderValue.deltaPct).toBeNull()
  })

  it('13c. prev okno = enako dolgo, takoj pred start (aggregate bounds pin)', async () => {
    await overviewGET(new Request(overviewURL(WEEK)))

    const where = mocks.orderAggregate.mock.calls[0][0].where
    expect(where.paymentStatus).toBe('paid')
    expect(where.paidAt.gte.toISOString()).toBe('2025-12-24T23:00:00.000Z') // LJ polnoč 2025-12-25
    expect(where.paidAt.lt.toISOString()).toBe('2025-12-31T23:00:00.000Z') // LJ polnoč 2026-01-01
    expect(where.locationId).toBe(LOC_A)
  })
})

// ════════════════════════════════════════════════════════════════
// Determinizem + tie-breaker sorti
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — determinizem + sorti', () => {
  it('14. findMany: determinističen orderBy [{paidAt asc},{id asc}] + minimal select', async () => {
    await overviewGET(new Request(overviewURL(WEEK)))

    const args = mocks.orderFindMany.mock.calls[0][0]
    expect(args.orderBy).toEqual([{ paidAt: 'asc' }, { id: 'asc' }])
    expect(Object.keys(args.select).sort()).toEqual(
      ['discount', 'employeeId', 'paidAt', 'tax', 'tip', 'total', 'type'],
    )
  })

  it('14b. topItems: take 10 + orderBy quantity desc na groupBy + JS re-sort tie-breakerji (quantity, revenue, ID)', async () => {
    topItemGroupsRef.current = [
      itemGroup('mi-b', 5, '10.00'), // q5, rev 50
      itemGroup('mi-a', 5, '12.00'), // q5, rev 60 → pred mi-b
      itemGroup('mi-c', 3, '30.00'), // q3
    ]

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    const groupArgs = mocks.orderItemGroupBy.mock.calls[0][0]
    expect(groupArgs.by).toEqual(['menuItemId'])
    expect(groupArgs.where.voided).toBe(false)
    expect(groupArgs.take).toBe(10)
    expect(groupArgs.orderBy).toEqual({ _sum: { quantity: 'desc' } })

    expect(body.topItems.map((t: { menuItemId: string }) => t.menuItemId)).toEqual(['mi-a', 'mi-b', 'mi-c'])
    expect(body.topItems[0]).toEqual({ menuItemId: 'mi-a', name: 'Artikel mi-a', quantity: 5, revenue: 60 })
    expect(body.topItems[1].revenue).toBe(50)

    // ime = prikazni lookup in:id + select {id, name}
    const lookup = mocks.menuItemFindMany.mock.calls[0][0]
    expect(lookup.where.id.in).toEqual(['mi-a', 'mi-b', 'mi-c'])
    expect(lookup.select).toEqual({ id: true, name: true })
  })

  it('14c. topItems fallback: manjkajoč menuItem → "(neimenovan artikel)" (determinizem po ID)', async () => {
    topItemGroupsRef.current = [itemGroup('mi-x', 2, '9.00')]
    mocks.menuItemFindMany.mockResolvedValue([])

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    expect(body.topItems[0].name).toBe('(neimenovan artikel)')
    expect(body.topItems[0].revenue).toBe(18)
  })

  it('14d. categoryBreakdown: isti groupBY brez take + net revenue (price_sum × quantity) + sort (revenue desc, ime asc)', async () => {
    categoryGroupsRef.current = [
      itemGroup('mi-x', 2, '50.00'), // 100
      itemGroup('mi-y', 1, '100.00'), // 100 (tie → ime asc)
      itemGroup('mi-z', 10, '1.00'), // 10
    ]

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    const groupArgs = mocks.orderItemGroupBy.mock.calls[1][0]
    expect(groupArgs.take).toBeUndefined()
    expect(groupArgs.where.voided).toBe(false)

    expect(body.categoryBreakdown).toEqual([
      { category: 'Kategorija mi-x', quantity: 2, revenue: 100 },
      { category: 'Kategorija mi-y', quantity: 1, revenue: 100 },
      { category: 'Kategorija mi-z', quantity: 10, revenue: 10 },
    ])
    // kategorija lookup = tisti menuItem klic, ki selekta category (topItems
    // lookup je lahko odsoten, če je top fixture prazna)
    const catLookup = mocks.menuItemFindMany.mock.calls
      .map((c) => c[0] as { select: { category?: unknown }; where: { id: { in: string[] } } })
      .find((a) => 'category' in a.select)
    expect(catLookup?.select).toEqual({ id: true, category: { select: { name: true } } })
    expect(catLookup?.where.id.in).toEqual(['mi-x', 'mi-y', 'mi-z'])
  })

  it('14e. paymentMix: status completed + check.order paid-okno + sort (amount desc, type asc) + tips/count', async () => {
    mocks.paymentGroupBy.mockResolvedValue([
      { type: 'card', _sum: { amount: new Prisma.Decimal('500.00'), tipAmount: new Prisma.Decimal('25.00') }, _count: 5 },
      { type: 'cash', _sum: { amount: new Prisma.Decimal('500.00'), tipAmount: new Prisma.Decimal('10.00') }, _count: 3 },
    ])

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    const args = mocks.paymentGroupBy.mock.calls[0][0]
    expect(args.by).toEqual(['type'])
    expect(args.where.status).toBe('completed')
    expect(args.where.check.order.paymentStatus).toBe('paid')
    expect(args._sum).toEqual({ amount: true, tipAmount: true })
    expect(args._count).toBe(true)

    expect(body.paymentMix).toEqual([
      { type: 'card', amount: 500, tips: 25, count: 5 },
      { type: 'cash', amount: 500, tips: 10, count: 3 },
    ])
  })

  it('14f. orderTypeMix: groupBy type + _sum total + _count + sort (revenue desc, type asc)', async () => {
    orderTypeGroupsRef.current = [
      { type: 'takeout', _sum: { total: new Prisma.Decimal('200.00') }, _count: 2 },
      { type: 'dine-in', _sum: { total: new Prisma.Decimal('300.00') }, _count: 3 },
    ]

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    const args = mocks.orderGroupBy.mock.calls[0][0]
    expect(args.by).toEqual(['type'])

    expect(body.orderTypeMix).toEqual([
      { type: 'dine-in', revenue: 300, orders: 3 },
      { type: 'takeout', revenue: 200, orders: 2 },
    ])
  })

  it('14g. staffPerformance: employeeId not null + sort (revenue, orders, ID) + cap 20 + imena lookup', async () => {
    const groups = [
      { employeeId: 'emp-a', _sum: { total: new Prisma.Decimal('100.00') }, _count: 2 },
      { employeeId: 'emp-b', _sum: { total: new Prisma.Decimal('100.00') }, _count: 5 },
      { employeeId: 'emp-c', _sum: { total: new Prisma.Decimal('200.00') }, _count: 1 },
      { employeeId: 'emp-d', _sum: { total: new Prisma.Decimal('100.00') }, _count: 2 },
    ]
    for (const x of 'e f g h i j k l m n o p q r s t u v'.split(' ')) {
      groups.push({ employeeId: `emp-${x}`, _sum: { total: new Prisma.Decimal('10.00') }, _count: 1 })
    }
    staffGroupsRef.current = groups // 22 → cap 20

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    const args = mocks.orderGroupBy.mock.calls[1][0]
    expect(args.by).toEqual(['employeeId'])
    expect(args.where.employeeId).toEqual({ not: null })

    expect(body.staffPerformance).toHaveLength(20) // emp-u / emp-v izpadeta
    expect(body.staffPerformance[0]).toEqual({ employeeId: 'emp-c', name: 'Zaposleni emp-c', revenue: 200, orders: 1 })
    expect(body.staffPerformance[1].employeeId).toBe('emp-b') // 100/5
    expect(body.staffPerformance[2].employeeId).toBe('emp-a') // 100/2
    expect(body.staffPerformance[3].employeeId).toBe('emp-d') // 100/2 → ID tie-breaker
    expect(body.staffPerformance[19].employeeId).toBe('emp-t')

    const lookup = mocks.employeeFindMany.mock.calls[0][0]
    expect(lookup.select).toEqual({ id: true, name: true })
  })

  it('14h. determinizem: 2 klica z istimi podatki → byte-identičen body, BREZ generatedAt/timestampov', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow(),
      orderRow({ paidAt: new Date('2026-01-03T18:30:00Z'), total: new Prisma.Decimal('45.50'), employeeId: null, type: 'takeout' }),
    ])
    mocks.orderAggregate.mockResolvedValue({ _sum: { total: new Prisma.Decimal('100.00') }, _count: 1 })
    topItemGroupsRef.current = [itemGroup('mi-1', 3, '5.00')]
    categoryGroupsRef.current = [itemGroup('mi-1', 3, '5.00')]
    mocks.paymentGroupBy.mockResolvedValue([
      { type: 'cash', _sum: { amount: new Prisma.Decimal('145.50'), tipAmount: new Prisma.Decimal('5.00') }, _count: 2 },
    ])

    const first = await overviewGET(new Request(overviewURL(WEEK)))
    const second = await overviewGET(new Request(overviewURL(WEEK)))

    expect(first.status).toBe(200)
    const firstText = await first.text()
    const secondText = await second.text()
    expect(firstText).toBe(secondText)
    expect(firstText).not.toContain('generatedAt')
    expect(firstText).not.toContain('timestamp')
  })
})

// ════════════════════════════════════════════════════════════════
// Shape + Decimal + headers + audit (cheap-read kanon)
// ════════════════════════════════════════════════════════════════
describe('R149 analytics — shape, Decimal, headers, audit', () => {
  it('15. točna top-level shape + window/kpis/meta pini', async () => {
    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    expect(Object.keys(body).sort()).toEqual([
      'categoryBreakdown', 'comparison', 'hourlyProfile', 'kpis', 'meta',
      'orderTypeMix', 'paymentMix', 'series', 'staffPerformance', 'topItems', 'window',
    ])
    expect(Object.keys(body.window).sort()).toEqual(['end', 'granularity', 'prevEnd', 'prevStart', 'start'])
    expect(Object.keys(body.kpis).sort()).toEqual(['avgOrderValue', 'discounts', 'orders', 'revenue', 'tax', 'tips'])
    expect(body.meta).toEqual({ rowCap: 50_000, windowDays: 7 })
    expect(body.hourlyProfile).toHaveLength(24)
  })

  it('15b. KPI aggregate iz istih vrstic: revenue/tax/tips/discounts/orders/avgOrderValue', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ total: new Prisma.Decimal('100.00'), tax: new Prisma.Decimal('22.00'), tip: new Prisma.Decimal('5.00'), discount: new Prisma.Decimal('2.00') }),
      orderRow({ paidAt: new Date('2026-01-03T20:00:00Z'), total: new Prisma.Decimal('50.00'), tax: new Prisma.Decimal('11.00'), tip: new Prisma.Decimal('2.50'), discount: new Prisma.Decimal('0.50') }),
    ])

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    expect(body.kpis).toEqual({ revenue: 150, tax: 33, tips: 7.5, discounts: 2.5, orders: 2, avgOrderValue: 75 })
  })

  it('15c. Decimal → number + round2 HALF_UP pin (100.456 → 100.46, 100.50 → 100.5)', async () => {
    mocks.orderFindMany.mockResolvedValue([
      orderRow({ total: new Prisma.Decimal('100.456'), tip: new Prisma.Decimal('0.005') }),
      orderRow({ paidAt: new Date('2026-01-02T11:00:00Z'), total: new Prisma.Decimal('100.50'), tip: new Prisma.Decimal('0'), tax: new Prisma.Decimal('0'), discount: new Prisma.Decimal('0') }),
    ])

    const res = await overviewGET(new Request(overviewURL(WEEK)))
    const body = await res.json()

    expect(body.kpis.revenue).toBe(200.96) // 100.456 + 100.50 = 200.956 → round2 200.96
    expect(body.kpis.tips).toBe(0.01) // 0.005 → HALF_UP 0.01
    expect(typeof body.kpis.revenue).toBe('number')
  })

  it('15d. no-store na VSEH odgovorih (200 + 400 + 401 + 403 + 429)', async () => {
    const ok = await overviewGET(new Request(overviewURL(WEEK)))
    expect(ok.headers.get('Cache-Control')).toBe('no-store')

    const bad = await overviewGET(new Request(overviewURL('start=2026-01-01')))
    expect(bad.status).toBe(400)
    expect(bad.headers.get('Cache-Control')).toBe('no-store')

    mocks.requireAuth.mockImplementation(async () => unauthorized())
    const un = await overviewGET(new Request(overviewURL(WEEK)))
    expect(un.headers.get('Cache-Control')).toBe('no-store')

    mocks.requireAuth.mockImplementation(async (_req: Request, opts?: { permission?: string | string[] }) => {
      if (!sessionRef.current) return unauthorized()
      const required = !opts?.permission ? [] : Array.isArray(opts.permission) ? opts.permission : [opts.permission]
      if (!hasPermission(sessionRef.current as never, required as never)) return forbidden()
      return { session: sessionRef.current, error: null }
    })
    sessionRef.current = waiterSession()
    const forb = await overviewGET(new Request(overviewURL(WEEK)))
    expect(forb.headers.get('Cache-Control')).toBe('no-store')

    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    const limited = await overviewGET(new Request(overviewURL(WEEK)))
    expect(limited.headers.get('Cache-Control')).toBe('no-store')
  })

  it('15e. NIČ audit zapisa na uspešen 200 (cheap-read kanon, R148 retention precedens)', async () => {
    mocks.orderFindMany.mockResolvedValue([orderRow()])

    const res = await overviewGET(new Request(overviewURL(WEEK)))

    expect(res.status).toBe(200)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})
