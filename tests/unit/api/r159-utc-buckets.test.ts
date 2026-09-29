// ============================================
// R159-b — R158-4 [P2]: 7+3 UTC-bucket mest → LJ kanon — trap-DB uniti
// ============================================
// Vzorec trap-DB kanona (r84/r149): vi.hoisted + vi.mock('@/lib/db') +
// vi.mock('@/lib/auth-middleware') z importOriginal spreadom (requireAuth
// mockan, tenant resolverji REALNI, rateLimitedResponse REALEN — ni 429
// poti tu); checkRateLimitAsync/getClientIp mockana; **@/lib/timezone-sl
// ostane REALen** — točka testa so LJ meje/bucketi na pravih modulih.
// Route funkcije se kličejo DIREKTNO (new Request) — brez strežnika.
//
// Pini (P2-08):
//   sales    — gte/lt = LJ bounds (letnica 2025 + DST-konec 2024-10-27),
//              dailyRevenue bucket po LJ poslovnemu dnevu
//   vat      — gte/lt = LJ bounds
//   e-invoice-book — datumIzdaje (ZAKONSKI datum) po LJ + LJ okno
//   tax-report (klient) — dnevni DDV po LJ dnevu; Z-join po reportDate
//   eod GET  — privzeti datum = ljubljanaTodayStr + LJ okno (zadnja ms)
//   eod POST — explicitni datum → LJ okno v computeEodCloseData/logEodClose
//   financial calcDateRange — daily/weekly/monthly/yearly + prev po LJ
//   dashboard computeWeeklyRevenue — vedra po LJ dnevih
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const LOC_A = 'loc-tenant-a'

const mocks = vi.hoisted(() => ({
  // infra
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
  // db
  orderFindMany: vi.fn(),
  orderGroupBy: vi.fn(),
  orderCount: vi.fn(),
  receiptFindMany: vi.fn(),
  // eod './_helpers' barrel (metrična shape je izven R159 obsega)
  fetchEodData: vi.fn(),
  computeEodMetrics: vi.fn(),
  // eod './eod-close' (post-handler konzument)
  computeEodCloseData: vi.fn(),
  closeShiftTransaction: vi.fn(),
  logEodClose: vi.fn(),
  // furs config resolver (e-invoice-book)
  getRestaurantInfoForLocation: vi.fn(),
  // klientski fetch (tax-report helpers)
  authFetch: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: mocks.orderFindMany,
      groupBy: mocks.orderGroupBy,
      count: mocks.orderCount,
    },
    receipt: { findMany: mocks.receiptFindMany },
    cashRegisterShift: { findFirst: vi.fn() },
  },
}))

// requireAuth mockan na meji z REALNIMI tenant resolverji (r84/r149 kanon)
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

// eod route './_helpers' barrel — stub (fetchEodData pinamo, metriko mockamo)
vi.mock('@/app/api/reports/eod/_helpers', () => ({
  fetchEodData: mocks.fetchEodData,
  computeEodMetrics: mocks.computeEodMetrics,
  computeCategoryBreakdown: vi.fn(async () => []),
  enrichEmployeeNames: vi.fn(async (x: unknown) => x),
}))

// eod-close — post-handler konzument (shape izven R159 obsega)
vi.mock('@/app/api/reports/eod/_helpers/eod-close', () => ({
  computeEodCloseData: mocks.computeEodCloseData,
  closeShiftTransaction: mocks.closeShiftTransaction,
  logEodClose: mocks.logEodClose,
}))

vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: mocks.getRestaurantInfoForLocation,
}))

// tax-report helpers so klientski modul — authFetch mockan (PinLogin je
// težak klientski modul, izven R159 obsega)
vi.mock('@/components/pos/PinLogin', () => ({
  authFetch: mocks.authFetch,
}))

// @/lib/timezone-sl je REALen (NI mockan) — točka testa.

import { GET as salesGET } from '@/app/api/reports/sales/route'
import { GET as vatGET } from '@/app/api/reports/vat/route'
import { GET as eodGET } from '@/app/api/reports/eod/route'
import { GET as eInvoiceBookGET } from '@/app/api/furs/e-invoice-book/route'
import { handleEodPost } from '@/app/api/reports/eod/_helpers/post-handler'
import { calcDateRange } from '@/app/api/reports/financial/_helpers-queries'
import { loadReportData } from '@/components/pos/tax-report/helpers'
import { computeWeeklyRevenue } from '@/app/api/dashboard/_helpers/weekly'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'

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
  mocks.getRestaurantInfoForLocation.mockResolvedValue({
    name: 'Test Bar', taxId: 'SI12345678', businessId: '123', address: 'Ulica 1',
    postCode: '1000', city: 'Ljubljana', registerNumber: 'R1',
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ══════════════════════════════════════════════════════════════════
describe('R159 sales — LJ meje + dnevni bucket', () => {
  it('letnica: ?startDate=2025-01-01&endDate=2025-01-01 → paidAt gte 2024-12-31T23:00Z, lt 2025-01-01T23:00Z; plačilo 23:30Z 31.12. → bucket 2025-01-01', async () => {
    mockSession()
    mocks.orderFindMany.mockResolvedValue([
      {
        id: 'o1', type: 'dine-in', paymentMethod: 'card',
        paidAt: new Date('2024-12-31T23:30:00.000Z'),
        createdAt: new Date('2024-12-31T20:00:00.000Z'),
        total: 40, tip: 0, checks: [],
      },
    ])

    const res = await salesGET(new Request('http://localhost:3000/api/reports/sales?startDate=2025-01-01&endDate=2025-01-01'))
    expect(res.status).toBe(200)

    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.paidAt.gte.toISOString()).toBe('2024-12-31T23:00:00.000Z') // LJ polnoč, NE UTC polnoč
    expect(where.paidAt.lt.toISOString()).toBe('2025-01-01T23:00:00.000Z') // ekskluzivna LJ polnoč naslednjega dne
    expect(Object.prototype.hasOwnProperty.call(where.paidAt, 'lte')).toBe(false)

    const body = await res.json()
    expect(body.dailyRevenue).toEqual([{ date: '2025-01-01', revenue: 40, orders: 1 }])
    expect(body.totalRevenue).toBe(40)
  })

  it('DST-konec: ?startDate=2024-10-27 → gte 2024-10-26T22:00Z (CEST); plačilo 22:30Z 26.10. → bucket 2024-10-27', async () => {
    mockSession()
    mocks.orderFindMany.mockResolvedValue([
      {
        id: 'o2', type: 'take-away', paymentMethod: 'cash',
        paidAt: new Date('2024-10-26T22:30:00.000Z'), // LJ 00:30 27.10. (še CEST +2)
        createdAt: new Date('2024-10-26T20:00:00.000Z'),
        total: 12.5, tip: 0, checks: [],
      },
    ])

    const res = await salesGET(new Request('http://localhost:3000/api/reports/sales?startDate=2024-10-27&endDate=2024-10-27'))
    expect(res.status).toBe(200)

    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.paidAt.gte.toISOString()).toBe('2024-10-26T22:00:00.000Z') // start 25-h dneva
    expect(where.paidAt.lt.toISOString()).toBe('2024-10-27T23:00:00.000Z')

    const body = await res.json()
    expect(body.dailyRevenue).toEqual([{ date: '2024-10-27', revenue: 12.5, orders: 1 }])
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R159 vat — LJ meje', () => {
  it('?startDate=2025-01-01&endDate=2025-01-01 → paidAt gte 2024-12-31T23:00Z, lt 2025-01-01T23:00Z', async () => {
    mockSession()
    mocks.orderFindMany.mockResolvedValue([])

    const res = await vatGET(new Request('http://localhost:3000/api/reports/vat?startDate=2025-01-01&endDate=2025-01-01'))
    expect(res.status).toBe(200)

    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.paidAt.gte.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(where.paidAt.lt.toISOString()).toBe('2025-01-01T23:00:00.000Z')
    expect(Object.prototype.hasOwnProperty.call(where.paidAt, 'lte')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R159 e-invoice-book — zakonski datumIzdaje + LJ okno', () => {
  it('račun createdAt 2025-06-30T22:15Z (LJ 2025-07-01 00:15 CEST) → datumIzdaje 2025-07-01; LJ okno 2025-07-01 ga VKLJUČI (UTC okno ga je izgubilo)', async () => {
    mockSession()
    const receipt = {
      receiptNumber: 1, createdAt: new Date('2025-06-30T22:15:00.000Z'),
      taxId: 'SI12345678', businessName: 'Test Bar', zoi: 'ZOI123', eor: 'EOR456',
      fiscalVerified: true, fiscalStatus: 'verified',
      subtotal: 10, totalVat: 2.2, total: 12.2, tip: 0,
      vatBreakdown: '[]', paymentMethod: 'card', stornoOf: null,
      order: { orderNumber: 5, type: 'dine-in', paymentMethod: 'card', paymentStatus: 'paid', paidAt: new Date('2025-06-30T22:15:00.000Z') },
    }
    mocks.receiptFindMany.mockImplementation((args: { where: { isStorno: boolean } }) =>
      args.where.isStorno ? Promise.resolve([]) : Promise.resolve([receipt]),
    )

    const res = await eInvoiceBookGET(new Request('http://localhost:3000/api/furs/e-invoice-book?dateFrom=2025-07-01&dateTo=2025-07-01'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.invoices).toHaveLength(1) // LJ okno [6.30 22:00Z, 7.1 22:00Z) vključuje
    expect(body.invoices[0].datumIzdaje).toBe('2025-07-01')
    expect(body.summary.obdobje).toEqual({ od: '2025-07-01', do: '2025-07-01' })
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R159 tax-report helpers — LJ dnevi + Z-join', () => {
  it('dnevni DDV: order createdAt 2025-01-01T00:30Z (LJ 01:30) IN 2024-12-31T23:30Z (LJ 00:30) → OBA pod 2025-01-01; Z (reportDate 2025-01-01, createdAt zgodaj 2.1.) označi isti dan', async () => {
    vi.useFakeTimers({ now: new Date('2025-03-01T00:30:00.000Z'), toFake: ['Date'] })
    mocks.authFetch.mockImplementation((url: string) => {
      if (url.includes('/api/orders')) {
        return Promise.resolve({ json: async () => [
          { id: 'o1', status: 'completed', paymentStatus: 'paid', createdAt: '2025-01-01T00:30:00.000Z', total: 100, items: [{ price: 100, quantity: 1, taxRate: 22 }] },
          { id: 'o2', status: 'completed', paymentStatus: 'paid', createdAt: '2024-12-31T23:30:00.000Z', total: 50, items: [{ price: 50, quantity: 1, taxRate: 22 }] },
        ] })
      }
      if (url.includes('/api/z-report')) {
        return Promise.resolve({ json: async () => [
          // Z za poslovni dan 1.1., generiran zgodaj 2.1. (LJ 00:30) —
          // prej UTC split z.createdAt je ta join sistematično zgrešil
          { id: 'z1', date: '2025-01-01', createdAt: '2025-01-01T23:30:00.000Z' },
        ] })
      }
      return Promise.resolve({ json: async () => ({ total: 0, pending: 0, failed: 0 }) })
    })

    const data = await loadReportData('month')

    // LJ mesečni začetek (frozen: LJ danes 2025-03-01) → periodStart LJ polnoč
    expect(mocks.authFetch.mock.calls[0][0]).toContain('startDate=2025-02-28T23:00:00.000Z')

    expect(data.dailyBreakdown).toHaveLength(1)
    expect(data.dailyBreakdown[0].date).toBe('2025-01-01')
    expect(data.dailyBreakdown[0].revenue).toBe(150)
    expect(data.dailyBreakdown[0].zReport).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R159 legacy reports/eod — LJ privzeti + LJ okno', () => {
  const METRICS = {
    summary: {}, vatBreakdown: [], paymentMethods: [],
    categoryData: { categoryItemGroups: [], menuItemIds: [] },
    employeeBreakdown: [], empIds: [],
    hourlyBreakdown: [], costs: {}, voidedItems: [],
    activeShift: null, isDayClosed: false,
  }

  it('GET brez datuma ob LJ 00:30 (23:30Z) → privzeti datum = LJ NASLEDNJI dan + okno = LJ bounds (zadnja ms)', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-15T23:30:00.000Z'), toFake: ['Date'] })
    mockSession()
    mocks.fetchEodData.mockResolvedValue({})
    mocks.computeEodMetrics.mockReturnValue(METRICS)

    const res = await eodGET(new Request('http://localhost:3000/api/reports/eod'))
    expect(res.status).toBe(200)

    const [dayStart, dayEnd] = mocks.fetchEodData.mock.calls[0]
    expect(dayStart.toISOString()).toBe('2026-01-15T23:00:00.000Z') // LJ polnoč 16.1.
    expect(dayEnd.toISOString()).toBe('2026-01-16T22:59:59.999Z')   // zadnja ms LJ dneva

    const body = await res.json()
    expect(body.date).toBe('2026-01-16') // LJ danes, NE UTC 15.1.
  })

  it('GET ?date=2025-01-01 → fetchEodData dobi LJ bounds (2024-12-31T23:00Z .. 2025-01-01T22:59:59.999Z)', async () => {
    mockSession()
    mocks.fetchEodData.mockResolvedValue({})
    mocks.computeEodMetrics.mockReturnValue(METRICS)

    const res = await eodGET(new Request('http://localhost:3000/api/reports/eod?date=2025-01-01'))
    expect(res.status).toBe(200)

    const [dayStart, dayEnd] = mocks.fetchEodData.mock.calls[0]
    expect(dayStart.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(dayEnd.toISOString()).toBe('2025-01-01T22:59:59.999Z')
  })

  it('POST z date=2025-01-01 → computeEodCloseData/logEodClose na LJ oknu in LJ datumu', async () => {
    mockSession()
    mocks.orderCount.mockResolvedValue(0)
    mocks.computeEodCloseData.mockResolvedValue({
      activeShift: { id: 'shift-1' },
      actualClosingCash: 100, expectedCash: 100, cashDifference: 0,
      cashSales: 0, cardSales: 0, mobileSales: 0, alternateSales: 0,
      totalSales: 0, completedOrders: [], totalDiscounts: 0, totalTips: 0,
      totalVoided: 0, startingCash: 0,
    })
    mocks.closeShiftTransaction.mockResolvedValue({})
    mocks.logEodClose.mockResolvedValue({})

    const req = new Request('http://localhost:3000/api/reports/eod', {
      method: 'POST',
      body: JSON.stringify({ date: '2025-01-01', closingCash: 100 }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await handleEodPost(req, { session: { employeeId: 'emp-1' } }, LOC_A)
    expect(res.status).toBe(200)

    const [dayStart, dayEnd, closingCash, targetDate] = mocks.computeEodCloseData.mock.calls[0]
    expect(dayStart.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(dayEnd.toISOString()).toBe('2025-01-01T22:59:59.999Z')
    expect(closingCash).toBe(100)
    expect(targetDate).toBe('2025-01-01')
    expect(mocks.logEodClose.mock.calls[0][2]).toBe('2025-01-01')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R159 financial calcDateRange — LJ obdobja', () => {
  it('daily: refDate 2025-01-01 → [2024-12-31T23:00Z, 2025-01-01T22:59:59.999Z], prev = prejšnji LJ dan', () => {
    const r = calcDateRange(new Date('2025-01-01'), 'daily')
    expect(r.startDate.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(r.endDate.toISOString()).toBe('2025-01-01T22:59:59.999Z')
    expect(r.prevStartDate.toISOString()).toBe('2024-12-30T23:00:00.000Z')
    expect(r.prevEndDate.toISOString()).toBe('2024-12-31T22:59:59.999Z')
  })

  it('weekly: refDate sreda 2025-01-01 → ponedeljek 2024-12-30 LJ bounds, prev = prejšnji teden', () => {
    const r = calcDateRange(new Date('2025-01-01'), 'weekly')
    expect(r.startDate.toISOString()).toBe('2024-12-29T23:00:00.000Z')
    expect(r.endDate.toISOString()).toBe('2025-01-05T22:59:59.999Z')
    expect(r.prevStartDate.toISOString()).toBe('2024-12-22T23:00:00.000Z')
    expect(r.prevEndDate.toISOString()).toBe('2024-12-29T22:59:59.999Z')
  })

  it('monthly (CEST): refDate 2025-07-15 → [2025-06-30T22:00Z, 2025-07-31T21:59:59.999Z], prev = prejšnji mesec', () => {
    const r = calcDateRange(new Date('2025-07-15'), 'monthly')
    expect(r.startDate.toISOString()).toBe('2025-06-30T22:00:00.000Z')
    expect(r.endDate.toISOString()).toBe('2025-07-31T21:59:59.999Z')
    expect(r.prevStartDate.toISOString()).toBe('2025-05-31T22:00:00.000Z')
    expect(r.prevEndDate.toISOString()).toBe('2025-06-30T21:59:59.999Z')
  })

  it('yearly: refDate 2025-03-01 → [2024-12-31T23:00Z, 2025-12-31T22:59:59.999Z], prev = prejšnje leto', () => {
    const r = calcDateRange(new Date('2025-03-01'), 'yearly')
    expect(r.startDate.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(r.endDate.toISOString()).toBe('2025-12-31T22:59:59.999Z')
    expect(r.prevStartDate.toISOString()).toBe('2023-12-31T23:00:00.000Z')
    expect(r.prevEndDate.toISOString()).toBe('2024-12-31T22:59:59.999Z')
  })
})

// ══════════════════════════════════════════════════════════════════
describe('R159 dashboard computeWeeklyRevenue — LJ vedra', () => {
  it('order 2024-12-31T23:30Z (LJ 00:30 1.1.) pade v vedro 2025-01-01 (frozen LJ danes 2025-01-01)', async () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:00:00.000Z'), toFake: ['Date'] })
    mocks.orderGroupBy.mockResolvedValue([
      { createdAt: new Date('2024-12-31T23:30:00.000Z'), _sum: { total: 40 } },
    ])

    // sevenDaysAgo prihaja iz dashboard route kot LJ meja (2024-12-26 LJ polnoč)
    const result = await computeWeeklyRevenue(ljubljanaDayBounds('2024-12-26').start, null)

    expect(result.map(d => d.date)).toEqual([
      '2024-12-26', '2024-12-27', '2024-12-28', '2024-12-29', '2024-12-30', '2024-12-31', '2025-01-01',
    ])
    expect(result[6]).toEqual({ date: '2025-01-01', revenue: 40 })
  })
})
