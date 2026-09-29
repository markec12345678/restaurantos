// ============================================
// R160-b — P3 UTC ostanki + N1–N8 → LJ kanon — uniti
// ============================================
// Vzorec trap-DB kanona (r84/r149/r159): vi.hoisted + vi.mock('@/lib/db') +
// vi.mock('@/lib/auth-middleware') z importOriginal spreadom (requireAuth
// mockan, tenant resolverji REALNI, rate-limit mockan). **@/lib/timezone-sl
// ostane REALen** — točka testa so LJ bucketi/ključi na pravih modulih.
// Čiste funkcije (vat/financial vedrčenje, digest hourOf, eDavki XML,
// employees urna porazdelitev) se testirajo BREZ trapa.
//
// Pini (P2-08, R160-a verdicti):
//   vat time-distribution  — daily/weekly/monthly vedra po LJ stenskem času
//   financial N1           — mesečna vedra 01..daysInMonth; LJ 00:30 ne izgine
//                            (tihi izpad odstranjen po konstrukciji)
//   digest hourOf          — Date/naiven niz/offset niz/date-only
//   eDavki XML (N8)        — <Period> = mesec OBDOBJA (endDate), ne
//                            generiranja; <DatumIzdelave> = LJ datum
//   employees (N3)         — hourlyBreakdown po LJ uri
//   happy-hour (N4)        — aktivno okno po LJ weekday/uri (UTC vs LJ
//                            weekday divergenca: 2025-07-01T22:30Z)
//   wallet (N6/P3-2)       — stats branch: LJ end−1ms; list: gte/lt LJ
//   cash-register (P3-6)   — webhook daily_report.ready datum po LJ
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const LOC_A = 'loc-tenant-a'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
  // db (db + named export createAuditLog, ki ga _helpers.ts bere iz '@/lib/db')
  createAuditLog: vi.fn(),
  happyHourScheduleFindMany: vi.fn(),
  walletPaymentFindMany: vi.fn(),
  // cash-register post-close
  emitEvent: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  upsertZReportForDay: vi.fn(),
  // wallet stats
  walletStats: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    happyHourSchedule: { findMany: mocks.happyHourScheduleFindMany },
    walletPayment: { findMany: mocks.walletPaymentFindMany },
  },
  createAuditLog: mocks.createAuditLog,
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return { ...actual, requireAuth: mocks.requireAuth }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.mock('@/lib/event-emitter', () => ({
  emitEvent: mocks.emitEvent,
}))

vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logger')>()
  return {
    ...actual,
    logger: { ...actual.logger, error: mocks.loggerError, info: mocks.loggerInfo },
  }
})

vi.mock('@/app/api/z-report/_helpers', () => ({
  upsertZReportForDay: mocks.upsertZReportForDay,
}))

vi.mock('@/lib/wallet-payment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet-payment')>()
  return { ...actual, getWalletPaymentStats: mocks.walletStats }
})

// @/lib/timezone-sl je REALen (NI mockan) — točka testa.

import { GET as happyHourGET } from '@/app/api/happy-hour/route'
import { GET as walletGET } from '@/app/api/wallet-payment/route'
import { postShiftCloseActions } from '@/app/api/cash-register/[id]/_helpers'
import { computeTimeVatDistribution } from '@/app/api/reports/vat/_helpers/time-distribution'
import { computeTimeDistribution } from '@/app/api/reports/financial/_helpers-compute/time-distribution'
import { hourOf } from '@/lib/digest-hours'
import { generateEdavkiXml } from '@/app/api/reports/export/_helpers/xml-generator'
import { aggregateOrderItems } from '@/app/api/reports/employees/_helpers/aggregation'

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.getClientIp.mockReturnValue('203.0.113.9')
  mocks.emitEvent.mockReturnValue(Promise.resolve())
  mocks.upsertZReportForDay.mockResolvedValue({ report: { id: 'z1' } })
  mocks.createAuditLog.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

// Mejni instant: 2025-07-01T22:30:00Z = UTC torek 22:30, LJ sreda 00:30
// (CEST +2) — weekday IN ura se razlikujeta med conama.
const BOUNDARY = new Date('2025-07-01T22:30:00.000Z')

// ══════════════════════════════════════════════════════════════════
describe('R160 P3-1 — vat time-distribution vedra po LJ', () => {
  const order = {
    paidAt: BOUNDARY,
    createdAt: new Date('2025-07-01T20:00:00.000Z'),
    orderItems: [{ voided: false, price: 100, quantity: 1, vatRate: 22, vatAmount: 22 }],
  }

  it('daily → "00:00" (LJ ura, ne UTC 22:00)', () => {
    const out = computeTimeVatDistribution([order], 'daily')
    expect(out.find(e => e.period === '00:00')?.totalVat).toBe(22)
    expect(out.find(e => e.period === '22:00')).toBeUndefined()
  })

  it('weekly → "Sre" (LJ weekday sreda, ne UTC torek)', () => {
    const out = computeTimeVatDistribution([order], 'weekly')
    expect(out.find(e => e.period === 'Sre')?.totalVat).toBe(22)
    expect(out.find(e => e.period === 'Tor')).toBeUndefined()
  })

  it('monthly → "2" (LJ dan 2. 7., ne UTC 1. 7.)', () => {
    const out = computeTimeVatDistribution([order], 'monthly')
    expect(out.find(e => e.period === '2')?.totalVat).toBe(22)
    expect(out.find(e => e.period === '1')).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R160 N1 — financial time-distribution: LJ + brez tihega izpada', () => {
  const mk = (paidAt: Date): { paidAt: Date; createdAt: Date; total: number } =>
    ({ paidAt, createdAt: paidAt, total: 50 })

  it('daily: LJ 00:30 → vedro "00" (ne UTC "22")', () => {
    const out = computeTimeDistribution('daily', new Date('2025-07-01T00:00:00.000Z'), [mk(BOUNDARY)], [])
    expect(out['00'].orders).toBe(1)
    expect(out['00'].revenue).toBe(50)
    expect(out['22'].orders).toBe(0)
  })

  it('weekly: LJ 00:30 → "Sre" (ne UTC "Tor")', () => {
    const out = computeTimeDistribution('weekly', new Date('2025-07-01T00:00:00.000Z'), [mk(BOUNDARY)], [])
    expect(out['Sre'].orders).toBe(1)
    expect(out['Tor'].orders).toBe(0)
  })

  it('monthly (februar 28 dni): vedra 01..28 obstajajo; naročilo LJ 6. 2. 00:30 (2025-02-05T23:30Z, CET+1) → "06" ne "05"', () => {
    const out = computeTimeDistribution('monthly', new Date('2025-02-01T00:00:00.000Z'), [mk(new Date('2025-02-05T23:30:00.000Z'))], [])
    for (let d = 1; d <= 28; d++) {
      expect(out[String(d).padStart(2, '0')]).toBeDefined()
    }
    expect(out['29']).toBeUndefined() // 28-dnevno ogrodje
    expect(out['06'].orders).toBe(1) // LJ dan, NE UTC dan '05'
    expect(out['05'].orders).toBe(0)
  })

  it('monthly: vsi dnevni ključi LJ naročil znotraj ogrodja → NIČ izgubljenih naročil (tihi izpad odstranjen)', () => {
    // 31-dnevni mesec: naročilo na LJ 31. 7. mora pristati v '31'
    const out = computeTimeDistribution('monthly', new Date('2025-07-01T00:00:00.000Z'), [mk(new Date('2025-07-30T23:30:00.000Z'))], [])
    expect(out['31'].orders).toBe(1)
  })

  it('prevPaidOrdersLight → prevOrders/prevRevenue v istem LJ vedru', () => {
    const out = computeTimeDistribution('daily', new Date('2025-07-01T00:00:00.000Z'), [], [mk(BOUNDARY)])
    expect(out['00'].prevOrders).toBe(1)
    expect(out['00'].prevRevenue).toBe(50)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R160 P3-4 — digest hourOf po LJ', () => {
  it('Date 2026-09-17T22:30Z → ura 0 (LJ 00:30 naslednjega dne, CEST)', () => {
    expect(hourOf(new Date('2026-09-17T22:30:00.000Z'))).toBe(0)
  })
  it('naiven niz (brez offseta) = LJ stenski čas zapisovalca → 5', () => {
    expect(hourOf('2026-09-17T05:30:00')).toBe(5)
  })
  it('offset niz: 08:30Z = 10:30 LJ → 10', () => {
    expect(hourOf('2026-09-17T08:30:00Z')).toBe(10)
  })
  it('date-only niz ostaja zavrnjen → null', () => {
    expect(hourOf('2026-09-17')).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R160 N8 — eDavki XML: Period = obdobje, DatumIzdelave = LJ', () => {
  it('endDate julij → <Period>202507</Period>; generacija LJ 2. 8. (22:30Z 1. 8.) → <DatumIzdelave>2025-08-02</DatumIzdelave>', () => {
    const xml = generateEdavkiXml({
      startDate: '2025-07-01',
      endDate: '2025-07-31',
      generatedAt: '2025-08-01T22:30:00.000Z',
      vatBreakdown: [
        { rate: 22, code: 'S', label: 'Standardna', baseAmount: 100, vatAmount: 22, totalAmount: 122 },
      ],
    } as unknown as Parameters<typeof generateEdavkiXml>[0], {})
    expect(xml).toContain('<Period>202507</Period>') // mesec OBDOBJA (ne 202508 — prej mesec generiranja)
    expect(xml).toContain('<DatumIzdelave>2025-08-02</DatumIzdelave>') // LJ datum, NE UTC '2025-08-01'
  })

  it('brez endDate → LJ mesec generatedAt', () => {
    const xml = generateEdavkiXml({
      startDate: null,
      endDate: null,
      generatedAt: '2025-08-01T22:30:00.000Z',
      vatBreakdown: [],
    } as unknown as Parameters<typeof generateEdavkiXml>[0], {})
    expect(xml).toContain('<Period>202508</Period>') // LJ mesec (22:30Z 1. 8. = LJ 2. 8.)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R160 N3 — employees hourlyBreakdown po LJ uri', () => {
  it('order.createdAt 2025-07-01T22:30Z → vedro "00" (LJ 00:30), ne "22"', () => {
    const stats = {
      voidedItems: 0, itemsSold: 0, categoryBreakdown: {}, topItems: {}, hourlyBreakdown: {},
    } as unknown as Parameters<typeof aggregateOrderItems>[0]
    aggregateOrderItems(stats, {
      createdAt: BOUNDARY,
      orderItems: [{ voided: false, quantity: 2, price: 10, menuItemId: 'mi1' }],
    })
    expect(stats.hourlyBreakdown['00']).toBeDefined()
    expect(stats.hourlyBreakdown['00'].orders).toBe(1)
    expect(stats.hourlyBreakdown['22']).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R160 N4 — happy-hour aktivno okno po LJ', () => {
  it('2025-07-01T22:30Z: UTC=Torek 22:30, LJ=Sreda 00:30 → urnik [Sre 00:00–01:00] je AKTIVEN (prej UTC eval ga je spustil)', async () => {
    vi.setSystemTime(BOUNDARY)
    mockSession()
    mocks.happyHourScheduleFindMany.mockResolvedValue([
      {
        id: 'hh1', isActive: true, daysOfWeek: [3], startTime: '00:00', endTime: '01:00',
        priceGroupId: 'pg1', priceGroup: { id: 'pg1', name: 'Happy', locationId: LOC_A },
        validFrom: null, validTo: null,
      },
    ])

    const res = await happyHourGET(new Request('http://localhost:3000/api/happy-hour'))
    expect(res.status).toBe(200)
    // scope prek priceGroup.locationId (starš) — LJ eval mora vključiti urnik
    expect(mocks.happyHourScheduleFindMany.mock.calls[0][0].where).toEqual({
      priceGroup: { locationId: LOC_A },
    })
    const body = await res.json()
    expect(body.currentlyActive).toBe(true)
    expect(body.activePriceGroupIds).toEqual(['pg1'])
    expect(body.activeSchedules).toHaveLength(1)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R160 N6/P3-2 — wallet-payment LJ meje', () => {
  it('stats branch: getWalletPaymentStats prejme LJ bounds (from 2025-06-30T22:00Z, to = LJ end−1ms)', async () => {
    mockSession()
    mocks.walletStats.mockResolvedValue({ total: 0, count: 0 })

    const res = await walletGET(new Request('http://localhost:3000/api/wallet-payment?stats=1&dateFrom=2025-07-01&dateTo=2025-07-01'))
    expect(res.status).toBe(200)

    const [from, to, locId] = mocks.walletStats.mock.calls[0]
    expect(from.toISOString()).toBe('2025-06-30T22:00:00.000Z') // LJ polnoč (CEST), NE UTC polnoč
    expect(to.toISOString()).toBe('2025-07-01T21:59:59.999Z') // LJ end − 1 ms (vključna pariteta, r35-luknja zaprta)
    expect(locId).toBe(LOC_A)
  })

  it('list branch: where.createdAt gte/lt po LJ (ekskluzivna polnoč)', async () => {
    mockSession()
    mocks.walletPaymentFindMany.mockResolvedValue([])

    const res = await walletGET(new Request('http://localhost:3000/api/wallet-payment?dateFrom=2025-01-01&dateTo=2025-01-01'))
    expect(res.status).toBe(200)

    const where = mocks.walletPaymentFindMany.mock.calls[0][0].where as Record<string, Record<string, Date>>
    expect(where.createdAt.gte.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(where.createdAt.lt.toISOString()).toBe('2025-01-01T23:00:00.000Z')
    expect(Object.prototype.hasOwnProperty.call(where.createdAt, 'lte')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R160 P3-6 — cash-register webhook daily_report.ready po LJ', () => {
  it('zaprtje izmene 2025-07-01T22:30Z → webhook date = "2025-07-02" (LJ poslovni dan, prej UTC "2025-07-01")', async () => {
    vi.setSystemTime(BOUNDARY)
    await postShiftCloseActions(
      {
        id: 'shift-1', employeeName: 'Janez', locationId: LOC_A,
        closedAt: BOUNDARY, totalSales: 100, cashSales: 100, cardSales: 0,
        cashDifference: 0, totalOrders: 5,
      } as unknown as Parameters<typeof postShiftCloseActions>[0],
      'shift-1',
      'emp-1',
    )

    const ready = mocks.emitEvent.mock.calls.find(c => c[0] === 'daily_report.ready')
    expect(ready).toBeDefined()
    expect(ready?.[1].date).toBe('2025-07-02') // LJ dan (prej UTC split bi dal 2025-07-01)
    expect(ready?.[2]).toBe(LOC_A)
    // avtomatski Z-draft ostane vezan na isti LJ dan
    expect(mocks.upsertZReportForDay).toHaveBeenCalledWith(expect.objectContaining({ date: '2025-07-02', finalize: false }))
  })
})
