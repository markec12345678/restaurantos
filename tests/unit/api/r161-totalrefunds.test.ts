// ============================================
// R161 — R158-5 [P3] DailyClose.totalRefunds vedno 0 → resničen refund agregat
// ============================================
// Forenzična veriga (audit R161-a §1, anchorji re-verificirani 2× na HEAD):
//  • route src/app/api/daily-close/route.ts:300 —
//    totalRefunds: toNum(Number(reportBag.totalRefunds ?? statsBag.totalRefunds ?? 0))
//    je VEDNO padel na 0, ker calculateReportStats (stats.ts) refund agregata
//    NI izpostavil (ZReportStats: 23 polj brez refundskega; build-report prav
//    tako ne; ZReport model nima stolpca — 0 migracij potrebnih).
//  • Ground truth (kanon blagajniške izmene, cash-register/[id]/route.ts :83/:97/:143):
//    payments status in ['completed','refunded'] (voided izključen),
//    totalRefunds = Σ refundAmount. Refund write-path: payments/[id]/refund
//    (increment refundAmount, status 'refunded' ob polnem povračilu).
//  • Fix (R161-b): NOV tx-fresh payment.aggregate v calculateReportStats na
//    client (= tx v upsert-z-report :154, R110 ZR-2 nadaljevanje) z ISTIMI
//    LJ mejami kot orders poizvedba (gte dayStart / lt dayEnd — R159 kanon,
//    MEJE NE SPREMINJANE, samo prenešene v where).
//  • DEVIACIJA od Z paidOrders — NAMERNA (dokumentirana v stats.ts):
//    order paymentStatus in ['paid','partial','storno'] je širši od Z orders
//    (['paid','partial']): vračilo storno orderja je realen odtegljaj (isti
//    vzorec kot izmena :83 ['paid','storno']), delno plačan order z delnim
//    povračilom ostane 'partial' — brez tega bi delna povračila ušla agregatu.
//  • Z≡DC pariteta (S6): prodaja ostane NETO (refund netting :132),
//    totalRefunds je bruto vsota povračil — komplementarna, brez dvojnega štetja.
//  • Export potrošnik (accounting-reports.ts generateDailyCloseCsv): stolpec
//    'Povračila' bere eur(c.totalRefunds) DIREKTNO iz DailyClose vrstice —
//    po fixu se samodejno popravi (r146 kanon: eur = toNum(x).toFixed(2),
//    LOČILO ';' , FORMAT S PIKO — "12.50", NE "12,50").
//
// Trap DB (hišni stil R126/R146/R159): vi.hoisted + getter; klicane so
// PRODUKCIJSKE funkcije direktno (route funkcije se NE mockajo); timezone-sl
// je REALEN; auth/rate-limit niso v igri (lib-klici, ne HTTP).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'

const LOC_1 = 'loc-1'

// ---------- Trap DB ----------
const trap = vi.hoisted(() => {
  const captured = {
    paymentAggregate: [] as Array<Record<string, unknown>>,
    cashShiftFindMany: [] as Array<Record<string, unknown>>,
    dailyCloseFindMany: [] as Array<Record<string, unknown>>,
  }
  const state = {
    paymentAggregateResult: { _sum: { refundAmount: null as unknown } },
    cashShifts: [] as Array<Record<string, unknown>>,
    dailyCloses: [] as Array<Record<string, unknown>>,
  }
  return { captured, state }
})

vi.mock('@/lib/db', () => ({
  db: {
    payment: {
      aggregate: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.paymentAggregate.push(args)
        return trap.state.paymentAggregateResult
      }),
    },
    cashRegisterShift: {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.cashShiftFindMany.push(args)
        return trap.state.cashShifts
      }),
    },
    dailyClose: {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.dailyCloseFindMany.push(args)
        return trap.state.dailyCloses
      }),
    },
  },
}))

// Import PO mockih (produkcija, ne kopije)
import { calculateReportStats } from '@/app/api/z-report/_helpers/stats'
import { generateDailyCloseCsv } from '@/app/api/reports/export/_helpers/accounting-reports'

const DAY = '2025-01-01'
const dayStart = ljubljanaDayBounds(DAY).start
const dayEnd = ljubljanaDayBounds(DAY).end

// Minimalen plačan order za prodajno zanko (refund netting pin)
function paidOrderWithRefundedPayment() {
  return [
    {
      id: 'ord-1',
      totalWithTip: 100,
      total: 100,
      subtotal: 80,
      tax: 20,
      discount: 0,
      tip: 0,
      type: 'dine-in',
      orderItems: [],
      checks: [
        {
          payments: [{ status: 'completed', amount: 100, refundAmount: 30, type: 'cash' }],
        },
      ],
    },
  ]
}

type ClientArg = NonNullable<Parameters<typeof calculateReportStats>[5]>

function makeTxClient() {
  return {
    payment: {
      aggregate: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.paymentAggregate.push(args)
        return trap.state.paymentAggregateResult
      }),
    },
    cashRegisterShift: {
      findMany: vi.fn(async () => trap.state.cashShifts),
    },
  } as unknown as ClientArg
}

describe('R158-5 → R161: calculateReportStats.totalRefunds (refund agregat)', () => {
  beforeEach(() => {
    trap.captured.paymentAggregate.length = 0
    trap.captured.cashShiftFindMany.length = 0
    trap.captured.dailyCloseFindMany.length = 0
    trap.state.paymentAggregateResult = { _sum: { refundAmount: null } }
    trap.state.cashShifts = []
    trap.state.dailyCloses = []
  })

  it('1a: vrne totalRefunds iz agregata — Decimal(12.50) → 12.5', async () => {
    trap.state.paymentAggregateResult = { _sum: { refundAmount: new Prisma.Decimal('12.50') } }

    const stats = await calculateReportStats([], [], dayStart, dayEnd, LOC_1)

    expect(stats.totalRefunds).toBe(12.5)
  })

  it('1b: kanoničen where pin — status in [completed,refunded] (voided izključen), paidAt LJ meje, paymentStatus širši set, _sum refundAmount', async () => {
    await calculateReportStats([], [], dayStart, dayEnd, LOC_1)

    expect(trap.captured.paymentAggregate).toHaveLength(1)
    const args = trap.captured.paymentAggregate[0]
    // Pariteta z izmeno (cash-register :97): voided izključen
    expect(args.where).toMatchObject({ status: { in: ['completed', 'refunded'] } })
    // Relacijski scope prek check.order (Payment NIMA locationId — R82 kanon)
    const orderWhere = (args.where as { check: { order: Record<string, unknown> } }).check.order
    expect(orderWhere.locationId).toBe(LOC_1)
    // NAMERNO širše od Z paidOrders (['paid','partial']) — vračilo storno orderja
    // je realen odtegljaj; dokumentirano v stats.ts komentarju ob agregatu
    expect(orderWhere.paymentStatus).toEqual({ in: ['paid', 'partial', 'storno'] })
    expect(args._sum).toEqual({ refundAmount: true })
  })

  it('1c: LJ meje prenešene v where (identity passthrough) — plačilo ob LJ 00:30 je naslednji poslovni dan', async () => {
    await calculateReportStats([], [], dayStart, dayEnd, LOC_1)

    const orderWhere = (
      trap.captured.paymentAggregate[0].where as { check: { order: { paidAt: { gte: Date; lt: Date } } } }
    ).check.order
    // Identiteta (ne toISOString) — ista Date instanca kot parametra (MEJE NE SPREMINJANE)
    expect(orderWhere.paidAt.gte).toBe(dayStart)
    expect(orderWhere.paidAt.lt).toBe(dayEnd)
    // LJ okno za 2025-01-01 (CET zima): [2024-12-31T23:00Z, 2025-01-01T23:00Z)
    expect(dayStart.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(dayEnd.toISOString()).toBe('2025-01-01T23:00:00.000Z')
    // Plačilo ob 2025-01-01T23:30Z (= LJ 2025-01-02 00:30) je ZUNAJ (lt, ekskluzivna polnoč)
    const refundAtLjMidnightPlus30 = new Date('2025-01-01T23:30:00.000Z')
    expect(refundAtLjMidnightPlus30.getTime()).toBeGreaterThanOrEqual(dayEnd.getTime())
  })

  it('1d: številka kot _sum vrednost → passthrough; null → 0 (toNum konvencija)', async () => {
    trap.state.paymentAggregateResult = { _sum: { refundAmount: 7.5 } }
    const statsNum = await calculateReportStats([], [], dayStart, dayEnd, LOC_1)
    expect(statsNum.totalRefunds).toBe(7.5)

    trap.state.paymentAggregateResult = { _sum: { refundAmount: null } }
    const statsNull = await calculateReportStats([], [], dayStart, dayEnd, LOC_1)
    expect(statsNull.totalRefunds).toBe(0)
  })

  it('1e: client=tx → agregat teče NA TX (R110 ZR-2 nadaljevanje), db agregat NI klican', async () => {
    trap.state.paymentAggregateResult = { _sum: { refundAmount: new Prisma.Decimal('5.00') } }
    const txClient = makeTxClient()

    const stats = await calculateReportStats([], [], dayStart, dayEnd, LOC_1, txClient)

    expect(stats.totalRefunds).toBe(5)
    expect(trap.captured.paymentAggregate).toHaveLength(1) // samo tx klic
    expect((txClient.payment.aggregate as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
  })

  it('1f: brez locationId → where.check.order BREZ locationId ključa (pogojni spread)', async () => {
    await calculateReportStats([], [], dayStart, dayEnd, undefined)

    const orderWhere = (trap.captured.paymentAggregate[0].where as { check: { order: Record<string, unknown> } }).check.order
    expect(orderWhere).not.toHaveProperty('locationId')
  })

  it('1g: S6 pariteta — prodaja ostane NETO (refund netting 100−30), totalRefunds je bruto vsota (30); komplementarno, brez dvojnega štetja', async () => {
    trap.state.paymentAggregateResult = { _sum: { refundAmount: new Prisma.Decimal('30') } }

    const stats = await calculateReportStats(paidOrderWithRefundedPayment(), [], dayStart, dayEnd, LOC_1)

    expect(stats.totalSales).toBe(100)
    expect(stats.cashSales).toBe(70) // netting 100 − 30 (obstoječi kanon, nedotaknjen)
    expect(stats.totalRefunds).toBe(30) // bruto povračila kot samostojen podatek
  })

  it('1h: REGRESIJA — cashRegisterShift agregat nedotaknjen (openedAt gte/lt LJ meje, status closed, lokacijski spread)', async () => {
    await calculateReportStats([], [], dayStart, dayEnd, LOC_1)

    expect(trap.captured.cashShiftFindMany).toHaveLength(1)
    const shiftArgs = trap.captured.cashShiftFindMany[0]
    expect(shiftArgs.where).toEqual({
      openedAt: { gte: dayStart, lt: dayEnd },
      status: 'closed',
      locationId: LOC_1,
    })
  })
})

describe('R158-5: export "Povračila" stolpec (generateDailyCloseCsv) — bere DailyClose vrstico', () => {
  beforeEach(() => {
    trap.captured.dailyCloseFindMany.length = 0
    trap.state.dailyCloses = []
  })

  it('2: totalRefunds Decimal(12.50) → "12.50" (eur format S PIKO, ";" ločilo — r146 kanon)', async () => {
    trap.state.dailyCloses = [
      {
        id: 'dc-r161',
        businessDate: new Date('2026-01-15T00:00:00.000Z'),
        locationId: 'loc-1',
        totalSales: new Prisma.Decimal('1520.30'),
        cashSales: new Prisma.Decimal('520.30'),
        cardSales: new Prisma.Decimal('1000.00'),
        mobileSales: new Prisma.Decimal('0'),
        alternateSales: new Prisma.Decimal('0'),
        totalDiscounts: new Prisma.Decimal('20.00'),
        totalTips: new Prisma.Decimal('75.00'),
        totalVoided: new Prisma.Decimal('0'),
        totalRefunds: new Prisma.Decimal('12.50'),
        cashVariance: new Prisma.Decimal('0'),
        location: { name: 'Lokacija A', code: 'LA' },
      },
    ]

    const { csv } = await generateDailyCloseCsv(
      { gte: new Date('2026-01-15T00:00:00.000Z'), lt: new Date('2026-01-16T00:00:00.000Z') },
      'loc-1',
    )
    const lines = csv.trimEnd().split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Poslovni dan;Lokacija;Prodaja skupaj;Gotovina;Kartica;Mobilna;Alternativna;Popusti;Napitnine;Preklici;Povračila;Odstopanje gotovine')
    // 'Povračila' = 11. stolpec — sedaj pride iz resničnega DailyClose snapshot-a
    // (route :300), ne vedno-0; format: toNum(x).toFixed(2) → PIKA (r146 12e)
    expect(lines[1]).toBe('2026-01-15T00:00:00.000Z;Lokacija A;1520.30;520.30;1000.00;0.00;0.00;20.00;75.00;0.00;12.50;0.00')
  })
})
