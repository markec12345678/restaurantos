// ============================================
// DAILY DIGEST — Unit testi (Task 20)
//
// Preverjamo:
// - fetchDailyDigestData: agregacije (revenue/avg/changePct/tips/tax)
// - topItems: grupiranje, sortiranje po količini, top 5, voided izključitev (query)
// - paymentMethods: sort po znesku, prazen method → 'neznano'
// - FURS: dead_letter se šteje kot failed
// - Decimal kot string (Prisma) → pravilno številčenje
// - buildDailyDigestHtml: ključne vsebine + HTML escape + absoluten CTA URL
// - ensureDailySummaryLog: delegacija + skipped log
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  orderAggregate: vi.fn(),
  orderGroupBy: vi.fn(),
  orderFindMany: vi.fn(), // R76: urna razporeditev (total + createdAt)
  orderItemFindMany: vi.fn(),
  outboxEventGroupBy: vi.fn(),
  sendEmail: vi.fn(),
  createScheduledEmailLog: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      aggregate: mocks.orderAggregate,
      groupBy: mocks.orderGroupBy,
      findMany: mocks.orderFindMany, // R76
    },
    orderItem: {
      findMany: mocks.orderItemFindMany,
    },
    outboxEvent: {
      groupBy: mocks.outboxEventGroupBy,
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mocks.sendEmail,
  createScheduledEmailLog: mocks.createScheduledEmailLog,
}))

import {
  fetchDailyDigestData,
  buildDailyDigestHtml,
  sendDailyDigestEmail,
  ensureDailySummaryLog,
  type DailyDigestData,
} from '@/lib/email/daily-digest'

function mockAgg({
  count = 0,
  total = 0,
  tax = 0,
  tip = 0,
}: { count?: number; total?: number | string; tax?: number | string; tip?: number | string } = {}) {
  return {
    _count: { _all: count },
    _sum: { total, tax, tip },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.orderAggregate.mockResolvedValue(mockAgg())
  mocks.orderGroupBy.mockResolvedValue([])
  mocks.orderFindMany.mockResolvedValue([]) // R76: privzeto brez naročil
  mocks.orderItemFindMany.mockResolvedValue([])
  mocks.outboxEventGroupBy.mockResolvedValue([])
})

describe('fetchDailyDigestData — agregacije', () => {
  it('izračuna revenue, avgTicket, tips, tax iz aggregate', async () => {
    mocks.orderAggregate
      .mockResolvedValueOnce(mockAgg({ count: 10, total: '543.21', tax: '89.50', tip: '30.00' })) // danes (Decimal kot string)
      .mockResolvedValueOnce(mockAgg({ total: '400.00' })) // prejšnji dan

    const d = await fetchDailyDigestData(new Date(2026, 8, 17))

    expect(d.ordersCount).toBe(10)
    expect(d.revenue).toBeCloseTo(543.21, 2)
    expect(d.avgTicket).toBeCloseTo(54.321, 3)
    expect(d.tips).toBe(30)
    expect(d.tax).toBe(89.5)
  })

  it('revenueChangePct: +20 % ko prejšnji dan 400 € in današnji 480 €', async () => {
    mocks.orderAggregate
      .mockResolvedValueOnce(mockAgg({ count: 4, total: 480 }))
      .mockResolvedValueOnce(mockAgg({ total: 400 }))

    const d = await fetchDailyDigestData(new Date())
    expect(d.revenueChangePct).toBe(20)
  })

  it('revenueChangePct: −20 % padec', async () => {
    mocks.orderAggregate
      .mockResolvedValueOnce(mockAgg({ count: 4, total: 320 }))
      .mockResolvedValueOnce(mockAgg({ total: 400 }))

    const d = await fetchDailyDigestData(new Date())
    expect(d.revenueChangePct).toBe(-20)
  })

  it('revenueChangePct je null, če prejšnji dan ni bil promet', async () => {
    mocks.orderAggregate
      .mockResolvedValueOnce(mockAgg({ count: 2, total: 100 }))
      .mockResolvedValueOnce(mockAgg({ total: 0 }))

    const d = await fetchDailyDigestData(new Date())
    expect(d.revenueChangePct).toBeNull()
  })

  it('avgTicket je 0 pri 0 naročil (brez division by zero)', async () => {
    const d = await fetchDailyDigestData(new Date())
    expect(d.ordersCount).toBe(0)
    expect(d.avgTicket).toBe(0)
  })

  it('uporablja paymentStatus=paid filter (konsistentno z Z-reportom)', async () => {
    await fetchDailyDigestData(new Date())
    const whereArg = mocks.orderAggregate.mock.calls[0][0].where
    expect(whereArg.paymentStatus).toBe('paid')
  })

  // ─── R65: polna dnevna primerjava (prej samo promet) ───
  it('R65: polna primerjava — prevOrdersCount/ordersChangePct/prevAvgTicket/prevTips', async () => {
    mocks.orderAggregate
      .mockResolvedValueOnce(mockAgg({ count: 10, total: '543.21', tip: '30.00' })) // danes
      .mockResolvedValueOnce(mockAgg({ count: 8, total: 400, tip: 10 })) // prejšnji dan

    const d = await fetchDailyDigestData(new Date(2026, 8, 17))

    expect(d.prevOrdersCount).toBe(8)
    expect(d.ordersChangePct).toBe(25) // (10−8)/8
    expect(d.prevTips).toBe(10)
    expect(d.tipsChangePct).toBe(200) // (30−10)/10
    expect(d.prevAvgTicket).toBeCloseTo(50, 3) // 400/8
    expect(d.avgTicketChangePct).toBeCloseTo(8.6, 1) // (54.321−50)/50
  })

  it('R65: prejšnji dan brez naročil → vsa pct polja null (NE neskončnost)', async () => {
    mocks.orderAggregate
      .mockResolvedValueOnce(mockAgg({ count: 3, total: 120, tip: 5 }))
      .mockResolvedValueOnce(mockAgg({ count: 0, total: 0, tip: 0 }))

    const d = await fetchDailyDigestData(new Date())

    expect(d.prevOrdersCount).toBe(0)
    expect(d.ordersChangePct).toBeNull()
    expect(d.tipsChangePct).toBeNull()
    expect(d.avgTicketChangePct).toBeNull()
    expect(d.prevAvgTicket).toBe(0)
  })

  it('R65: prejšnji dan aggregate dobi _count in _sum.tip (query oblika)', async () => {
    await fetchDailyDigestData(new Date())
    const prevCall = mocks.orderAggregate.mock.calls[1][0]
    expect(prevCall.where.paymentStatus).toBe('paid')
    expect(prevCall._count).toEqual({ _all: true })
    expect(prevCall._sum).toEqual({ total: true, tip: true })
  })

  it('R76: urna razporeditev — findMany dobi where/select obliko, hourly teče iz vrstic', async () => {
    // naročila: 2 ob 12. uri (po lokalni uri serverja), 1 ob 19. uri
    const base = new Date(2026, 8, 17)
    const at = (h: number, m = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0)
    mocks.orderFindMany.mockResolvedValue([
      { total: '25.50', createdAt: at(12) },
      { total: 14.5, createdAt: at(12, 30) },
      { total: 100, createdAt: at(19) },
    ])

    const d = await fetchDailyDigestData(new Date())

    // query oblika: isti where kot aggregate (paid + dnevski bounds), minimal select
    const call = mocks.orderFindMany.mock.calls[0][0]
    expect(call.where.paymentStatus).toBe('paid')
    expect(call.select).toEqual({ total: true, createdAt: true })

    expect(d.hourly).toHaveLength(24)
    expect(d.hourly![12]).toMatchObject({ hour: 12, revenue: 40, orders: 2 })
    expect(d.hourly![19]).toMatchObject({ hour: 19, revenue: 100, orders: 1 })
    expect(d.hourly!.filter(p => p.isPeak).map(p => p.hour)).toEqual([19])
  })

  it('R76: dan brez naročil → hourly 24 praznih točk (brez vrha)', async () => {
    const d = await fetchDailyDigestData(new Date())
    expect(d.hourly).toHaveLength(24)
    expect(d.hourly!.every(p => !p.isPeak && p.revenue === 0)).toBe(true)
  })
})

describe('fetchDailyDigestData — topItems / plačila / FURS', () => {
  it('grupira artikle po imenu, sortira po količini, cut na 5', async () => {
    mocks.orderItemFindMany.mockResolvedValue([
      { menuItemName: 'Pizza Margherita', quantity: 3, price: '8.50' },
      { menuItemName: 'Pizza Margherita', quantity: 2, price: '8.50' },
      { menuItemName: 'Kava', quantity: 7, price: '1.30' },
      { menuItemName: 'Test 2', quantity: 6, price: '2.00' },
      { menuItemName: 'Test 3', quantity: 5, price: '2.00' },
      { menuItemName: 'Test 4', quantity: 4, price: '2.00' },
      { menuItemName: 'Test 5', quantity: 3, price: '2.00' },
      { menuItemName: 'Test 6', quantity: 2, price: '2.00' },
    ])

    const d = await fetchDailyDigestData(new Date())

    expect(d.topItems).toHaveLength(5)
    // sort: količina desc, tie-break prihodek desc → Kava(7), Test 2(6), Pizza(5, 42.5€) pred Test 3(5, 10€), Test 4(4)
    expect(d.topItems[0]).toEqual({ name: 'Kava', quantity: 7, revenue: expect.closeTo(9.1, 2) })
    expect(d.topItems[1]).toEqual({ name: 'Test 2', quantity: 6, revenue: 12 })
    expect(d.topItems[2]).toEqual({ name: 'Pizza Margherita', quantity: 5, revenue: expect.closeTo(42.5, 2) })
    expect(d.topItems).toEqual([
      expect.objectContaining({ name: 'Kava' }),
      expect.objectContaining({ name: 'Test 2' }),
      expect.objectContaining({ name: 'Pizza Margherita' }),
      expect.objectContaining({ name: 'Test 3' }),
      expect.objectContaining({ name: 'Test 4' }),
    ])
  })

  it('prazno ime artikla → "(neimenovan artikel)"', async () => {
    mocks.orderItemFindMany.mockResolvedValue([{ menuItemName: '', quantity: 1, price: '5.00' }])
    const d = await fetchDailyDigestData(new Date())
    expect(d.topItems[0].name).toBe('(neimenovan artikel)')
  })

  it('paymentMethods: sort po znesku desc, prazen → "neznano"', async () => {
    mocks.orderGroupBy.mockResolvedValue([
      { paymentMethod: '', _count: { _all: 1 }, _sum: { total: '10.00' } },
      { paymentMethod: 'cash', _count: { _all: 5 }, _sum: { total: '150.00' } },
      { paymentMethod: 'card', _count: { _all: 3 }, _sum: { total: '90.00' } },
    ])

    const d = await fetchDailyDigestData(new Date())
    expect(d.paymentMethods[0]).toEqual({ method: 'cash', count: 5, amount: 150 })
    expect(d.paymentMethods[2].method).toBe('neznano')
  })

  it('FURS: dead_letter se šteje kot failed', async () => {
    mocks.outboxEventGroupBy.mockResolvedValue([
      { status: 'sent', _count: { _all: 12 } },
      { status: 'failed', _count: { _all: 2 } },
      { status: 'dead_letter', _count: { _all: 1 } },
    ])

    const d = await fetchDailyDigestData(new Date())
    expect(d.furs).toEqual({ sent: 12, failed: 3 })
  })

  it('orderItem query izključuje voided in deduje paid filter od order', async () => {
    await fetchDailyDigestData(new Date())
    const arg = mocks.orderItemFindMany.mock.calls[0][0]
    expect(arg.where.voided).toBe(false)
    expect(arg.where.order.paymentStatus).toBe('paid')
  })
})

describe('buildDailyDigestHtml', () => {
  const base: DailyDigestData = {
    date: '2026-09-17',
    ordersCount: 12,
    revenue: 345.6,
    tips: 20,
    tax: 61.4,
    avgTicket: 28.8,
    prevRevenue: 300,
    revenueChangePct: 15.2,
    paymentMethods: [
      { method: 'cash', count: 7, amount: 200 },
      { method: 'card', count: 5, amount: 145.6 },
    ],
    topItems: [{ name: 'Pizza Margherita', quantity: 8, revenue: 68 }],
    furs: { sent: 10, failed: 1 },
  }

  it('vsebuje ključne podatke', () => {
    const html = buildDailyDigestHtml(base)
    expect(html).toContain('Dnevni povzetek — 2026-09-17')
    expect(html).toContain('345,60') // formatEUR
    expect(html).toContain('Pizza Margherita')
    expect(html).toContain('cash')
    expect(html).toContain('1 neuspešnih')
    expect(html).toContain('▲ 15.2%')
  })

  it('escape-uje HTML v imenih artiklov', () => {
    const html = buildDailyDigestHtml({ ...base, topItems: [{ name: '<script>alert(1)</script>', quantity: 1, revenue: 9 }] })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('negativen trend → rdeč badge z ▼', () => {
    const html = buildDailyDigestHtml({ ...base, revenueChangePct: -3.5 })
    expect(html).toContain('▼ 3.5%')
    expect(html).toContain('#b91c1c')
  })

  it('ni primerjave → muted obvestilo namesto badgea', () => {
    const html = buildDailyDigestHtml({ ...base, revenueChangePct: null })
    expect(html).toContain('ni primerjave')
  })

  // ─── R65: primerjavna kartica v emailu ───
  it('R65: comparison card s polnimi polji — Kazalnik/Danes/Včeraj/Sprememba', () => {
    const html = buildDailyDigestHtml({
      ...base,
      prevOrdersCount: 8,
      ordersChangePct: 25,
      prevAvgTicket: 50,
      avgTicketChangePct: 8.6,
      prevTips: 10,
      tipsChangePct: 200,
    })
    expect(html).toContain('Primerjava s prejšnjim dnem')
    expect(html).toContain('Kazalnik')
    expect(html).toContain('včeraj 300,00') // base.prevRevenue=300 → formatEUR
    expect(html).toContain('▲ 25%') // ordersChangePct
    expect(html).toContain('▲ 200%') // tipsChangePct
  })

  it('R65: brez prevOrdersCount (stari klicatelj) → comparison card IZPUŠČENA', () => {
    const html = buildDailyDigestHtml(base) // base nima R65 polj
    expect(html).not.toContain('Primerjava s prejšnjim dnem')
  })

  it('R65: prevOrdersCount 0 → comparison card izpuščena (brez praznih obljub)', () => {
    const html = buildDailyDigestHtml({ ...base, prevOrdersCount: 0, ordersChangePct: null })
    expect(html).not.toContain('Primerjava s prejšnjim dnem')
  })

  it('CTA uporablja absoluten URL iz NEXT_PUBLIC_APP_URL', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://restaurantos-theta.vercel.app/'
    try {
      const html = buildDailyDigestHtml(base)
      expect(html).toContain('href="https://restaurantos-theta.vercel.app/reports"')
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = prev
    }
  })
})

describe('sendDailyDigestEmail / ensureDailySummaryLog', () => {
  const base: DailyDigestData = {
    date: '2026-09-17',
    ordersCount: 5,
    revenue: 100,
    tips: 5,
    tax: 18,
    avgTicket: 20,
    prevRevenue: 0,
    revenueChangePct: null,
    paymentMethods: [],
    topItems: [],
    furs: { sent: 0, failed: 0 },
  }

  it('pošlje SAMO podanemu prejemniku z ustreznim subjectom', async () => {
    mocks.sendEmail.mockResolvedValue({ success: true })

    await sendDailyDigestEmail('manager@restavracija.si', base)

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    const opts = mocks.sendEmail.mock.calls[0][0]
    expect(opts.to).toBe('manager@restavracija.si')
    expect(opts.subject).toBe('Dnevni povzetek 2026-09-17 — RestaurantOS')
    expect(opts.html).toContain('Dnevni povzetek')
  })

  it('propagira napako od sendEmail (process route jo označi kot failed)', async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, error: 'SMTP down' })
    const result = await sendDailyDigestEmail('x@y.si', base)
    expect(result).toEqual({ success: false, error: 'SMTP down' })
  })

  it('ensureDailySummaryLog delegira na createScheduledEmailLog z daily_summary', async () => {
    mocks.createScheduledEmailLog.mockResolvedValue({ success: true, created: 2, recipients: ['a@b.si', 'c@d.si'], reportDate: '2026-09-16', reportType: 'daily_summary' })

    const r = await ensureDailySummaryLog(new Date(2026, 8, 16))

    expect(mocks.createScheduledEmailLog).toHaveBeenCalledWith('daily_summary', new Date(2026, 8, 16))
    expect(r.created).toBe(2)
  })

  it('ensureDailySummaryLog pri skipped ne vrže (idempotentno)', async () => {
    mocks.createScheduledEmailLog.mockResolvedValue({ success: true, created: 0, recipients: [], reportDate: '2026-09-16', reportType: 'daily_summary', skipped: true, reason: 'že sent' })

    const r = await ensureDailySummaryLog(new Date(2026, 8, 16))
    expect(r.skipped).toBe(true)
  })
})
