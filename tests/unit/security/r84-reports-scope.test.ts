// ============================================
// R84-1 — REPORTS TENANT SCOPE FIX WAVE
// ============================================
// REGRESIJA za 6 HIGH + 2 MEDIUM (read-only auditor R84-0):
//   HIGH  sales       — order.findMany brez locationId (prihodek vseh tenantov)
//   HIGH  vat         — FURS-relevantna DDV razčlenitev čez vse tenant-e
//   HIGH  popular     — orderItem.findMany prek globalnega orderWhere
//   HIGH  employees   — order + employee.findMany (križno-tenant PII)
//   HIGH  ap-aging    — accountsPayable.findMany brez scope-a
//   HIGH  eod POST    — CROSS-TENANT WRITE: findFirst({ status: 'open' }) brez
//                      lokacije → zaprtje tuje izemene z združenimi vsi-tenant
//                      povzetki (computeEodCloseData + closeShiftTransaction)
//   MEDIUM eod GET residuals — statusOrderWhere (statusCounts, cancelled,
//                      pending, voided) + stockCostGroups brez scope-a
//   MEDIUM digest-preview/send/trend — platform-level poročila dosegljiva
//                      lokacijskim adminom (permission 'admin' gre na vlogo)
//
// Vzorec: realen tenant-scope resolver (kakor R80 A2) + pinanje where-clavz.
// null scope (super-admin) = PRAZEN filter, NIKOLI { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  orderFindMany: vi.fn(),
  orderGroupBy: vi.fn(),
  orderAggregate: vi.fn(),
  orderCount: vi.fn(),
  orderItemFindMany: vi.fn(),
  orderItemAggregate: vi.fn(),
  orderItemCount: vi.fn(),
  orderItemGroupBy: vi.fn(),
  menuItemFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  accountsPayableFindMany: vi.fn(),
  stockTransactionGroupBy: vi.fn(),
  shiftFindFirst: vi.fn(),
  shiftFindUnique: vi.fn(),
  shiftUpdate: vi.fn(),
  shiftAggregate: vi.fn(),
  paymentGroupBy: vi.fn(),
  scheduledEmailLogFindMany: vi.fn(),
  scheduledEmailLogUpdate: vi.fn(),
  fetchDailyDigestData: vi.fn(),
  buildDailyDigestHtml: vi.fn(),
  sendDailyDigestEmail: vi.fn(),
  ensureDailySummaryLog: vi.fn(),
}))

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: mocks.orderFindMany,
      groupBy: mocks.orderGroupBy,
      aggregate: mocks.orderAggregate,
      count: mocks.orderCount,
    },
    orderItem: {
      findMany: mocks.orderItemFindMany,
      aggregate: mocks.orderItemAggregate,
      count: mocks.orderItemCount,
      groupBy: mocks.orderItemGroupBy,
    },
    menuItem: { findMany: mocks.menuItemFindMany },
    employee: { findMany: mocks.employeeFindMany },
    accountsPayable: { findMany: mocks.accountsPayableFindMany },
    stockTransaction: { groupBy: mocks.stockTransactionGroupBy },
    cashRegisterShift: {
      findFirst: mocks.shiftFindFirst,
      findUnique: mocks.shiftFindUnique,
      update: mocks.shiftUpdate,
      aggregate: mocks.shiftAggregate,
    },
    payment: { groupBy: mocks.paymentGroupBy },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ cashRegisterShift: { findUnique: mocks.shiftFindUnique, update: mocks.shiftUpdate } })),
    createAuditLog: vi.fn().mockResolvedValue({}),
    scheduledEmailLog: {
      findMany: mocks.scheduledEmailLogFindMany,
      update: mocks.scheduledEmailLogUpdate,
    },
  },
}))

vi.mock('@/lib/email/daily-digest', () => ({
  fetchDailyDigestData: mocks.fetchDailyDigestData,
  buildDailyDigestHtml: mocks.buildDailyDigestHtml,
  sendDailyDigestEmail: mocks.sendDailyDigestEmail,
  ensureDailySummaryLog: mocks.ensureDailySummaryLog,
}))

import { GET as salesGET } from '@/app/api/reports/sales/route'
import { GET as vatGET } from '@/app/api/reports/vat/route'
import { GET as popularGET } from '@/app/api/reports/popular/route'
import { GET as employeesReportGET } from '@/app/api/reports/employees/route'
import { GET as apAgingGET } from '@/app/api/reports/ap-aging/route'
import { GET as digestPreviewGET } from '@/app/api/reports/digest-preview/route'
import { POST as digestSendPOST } from '@/app/api/reports/digest-send/route'
import { GET as digestTrendGET } from '@/app/api/reports/digest-trend/route'
import { GET as eodGET } from '@/app/api/reports/eod/route'
import { fetchFinancialData } from '@/app/api/reports/financial/_helpers-queries'
import { fetchEodData } from '@/app/api/reports/eod/_helpers/data-fetch'
import { computeEodCloseData, closeShiftTransaction } from '@/app/api/reports/eod/_helpers/eod-close'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

const orderRow = {
  id: 'order-1',
  type: 'dine-in',
  status: 'completed',
  paymentStatus: 'paid',
  locationId: LOC_A,
  total: 100,
  subtotal: 90,
  tax: 10,
  discount: 0,
  tip: 5,
  paidAt: new Date('2026-01-01T12:00:00Z'),
  createdAt: new Date('2026-01-01T11:00:00Z'),
  employeeId: 'emp-1',
  tableId: null,
  checks: [],
  orderItems: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.orderFindMany.mockResolvedValue([orderRow])
  mocks.orderGroupBy.mockResolvedValue([])
  mocks.orderAggregate.mockResolvedValue({ _sum: { total: 0, subtotal: 0, tax: 0, discount: 0, tip: 0, totalWithTip: 0 }, _count: 0 })
  mocks.orderCount.mockResolvedValue(0)
  mocks.orderItemFindMany.mockResolvedValue([])
  mocks.orderItemAggregate.mockResolvedValue({ _sum: { price: 0, vatAmount: 0, quantity: 0 } })
  mocks.orderItemCount.mockResolvedValue(0)
  mocks.orderItemGroupBy.mockResolvedValue([])
  mocks.menuItemFindMany.mockResolvedValue([])
  mocks.employeeFindMany.mockResolvedValue([])
  mocks.accountsPayableFindMany.mockResolvedValue([])
  mocks.stockTransactionGroupBy.mockResolvedValue([])
  mocks.shiftFindFirst.mockResolvedValue(null)
  mocks.paymentGroupBy.mockResolvedValue([])
  mocks.scheduledEmailLogFindMany.mockResolvedValue([])
  mocks.ensureDailySummaryLog.mockResolvedValue({ success: true, reportDate: '2026-01-01' })
})

// ══════════════════════════════════════════════════════════════════
// A. SALES
// ══════════════════════════════════════════════════════════════════
describe('R84-1 A: GET /api/reports/sales — tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await salesGET(new Request('http://localhost:3000/api/reports/sales'))
    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: findMany where vsebuje locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await salesGET(new Request('http://localhost:3000/api/reports/sales'))
    expect(res.status).toBe(200)
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('?locationId bypass je ignoriran za lokacijskega admina', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await salesGET(new Request(`http://localhost:3000/api/reports/sales?locationId=${LOC_B}`))
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: filter OPUŠČEN — nikoli { locationId: null }', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await salesGET(new Request('http://localhost:3000/api/reports/sales'))
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. VAT
// ══════════════════════════════════════════════════════════════════
describe('R84-1 B: GET /api/reports/vat — tenant scope', () => {
  it('loc-bound admin: findMany where vsebuje locationId + paymentStatus paid', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await vatGET(new Request('http://localhost:3000/api/reports/vat'))
    expect(res.status).toBe(200)
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.paymentStatus).toBe('paid')
  })

  it('?locationId bypass je ignoriran', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await vatGET(new Request(`http://localhost:3000/api/reports/vat?locationId=${LOC_B}`))
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: filter OPUŠČEN', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await vatGET(new Request('http://localhost:3000/api/reports/vat'))
    expect(Object.prototype.hasOwnProperty.call(mocks.orderFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. POPULAR
// ══════════════════════════════════════════════════════════════════
describe('R84-1 C: GET /api/reports/popular — tenant scope', () => {
  it('loc-bound admin: orderItem.findMany where.order.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await popularGET(new Request('http://localhost:3000/api/reports/popular'))
    expect(res.status).toBe(200)
    const where = mocks.orderItemFindMany.mock.calls[0][0].where
    expect(where.order.locationId).toBe(LOC_A)
    expect(where.voided).toBe(false)
  })

  it('super-admin: where.order brez locationId', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await popularGET(new Request('http://localhost:3000/api/reports/popular'))
    const orderWhere = mocks.orderItemFindMany.mock.calls[0][0].where.order
    expect(Object.prototype.hasOwnProperty.call(orderWhere, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. EMPLOYEES (poročilo)
// ══════════════════════════════════════════════════════════════════
describe('R84-1 D: GET /api/reports/employees — tenant scope (PII)', () => {
  it('loc-bound admin: order.findMany + employee.findMany oba scoped', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await employeesReportGET(new Request('http://localhost:3000/api/reports/employees'))
    expect(res.status).toBe(200)
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // employee PII zaščiten
    const empWhere = mocks.employeeFindMany.mock.calls[0][0].where
    expect(empWhere.locationId).toBe(LOC_A)
    expect(empWhere.status).toBe('active')
    // totals aggregate dedijo scope (isti where)
    expect(mocks.orderAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderItemCount.mock.calls[0][0].where.order.locationId).toBe(LOC_A)
  })

  it('?locationId bypass je ignoriran (PII)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await employeesReportGET(new Request(`http://localhost:3000/api/reports/employees?locationId=${LOC_B}`))
    expect(mocks.employeeFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: oba filtra OPUŠČENA', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await employeesReportGET(new Request('http://localhost:3000/api/reports/employees'))
    expect(Object.prototype.hasOwnProperty.call(mocks.orderFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(mocks.employeeFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. AP-AGING
// ══════════════════════════════════════════════════════════════════
describe('R84-1 E: GET /api/reports/ap-aging — tenant scope', () => {
  it('loc-bound admin: findMany where.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await apAgingGET(new Request('http://localhost:3000/api/reports/ap-aging'))
    expect(res.status).toBe(200)
    const where = mocks.accountsPayableFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.status).toEqual({ in: ['open', 'partial', 'overdue'] })
  })

  it('super-admin: filter OPUŠČEN (vidi tudi legacy NULL lokacije)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await apAgingGET(new Request('http://localhost:3000/api/reports/ap-aging'))
    const where = mocks.accountsPayableFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// F. FINANCIAL helpers (vseh 10 poizvedb)
// ══════════════════════════════════════════════════════════════════
describe('R84-1 F: fetchFinancialData — locationId scope na vseh 10 poizvedbah', () => {
  const S = new Date('2026-01-01T00:00:00Z')
  const E = new Date('2026-01-31T23:59:59Z')

  it('loc-bound: order groupBy/aggregate/findMany vse locationId', async () => {
    await fetchFinancialData(S, E, S, E, LOC_A)
    // 1. status groupBy
    expect(mocks.orderGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // 2+5. aggregate (trenutno + prejšnje obdobje)
    expect(mocks.orderAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderAggregate.mock.calls[1][0].where.locationId).toBe(LOC_A)
    // 3+4+6. findMany
    for (const call of mocks.orderFindMany.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
    // 7. orderItem — prek relacije order.locationId
    expect(mocks.orderItemFindMany.mock.calls[0][0].where.order.locationId).toBe(LOC_A)
    // 8. stockTransaction — prek relacije inventoryItem.locationId
    expect(mocks.stockTransactionGroupBy.mock.calls[0][0].where.inventoryItem.locationId).toBe(LOC_A)
  })

  it('loc-bound: cashRegisterShift aggregate scoped', async () => {
    await fetchFinancialData(S, E, S, E, LOC_A)
    // 9. blagajna — aggregate scoped prek shiftWhere.locationId
    expect(mocks.shiftAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // stockTransaction NI dobil ravnega locationId (vezava prek relacije!)
    const stWhere = mocks.stockTransactionGroupBy.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(stWhere, 'locationId')).toBe(false)
    expect(stWhere.inventoryItem).toEqual({ locationId: LOC_A })
  })

  it('super-admin: vseh 10 poizvedb brez locationId ključa', async () => {
    await fetchFinancialData(S, E, S, E, null)
    expect(Object.prototype.hasOwnProperty.call(mocks.orderGroupBy.mock.calls[0][0].where, 'locationId')).toBe(false)
    for (const call of mocks.orderAggregate.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
    for (const call of mocks.orderFindMany.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
    const stWhere = mocks.stockTransactionGroupBy.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(stWhere, 'inventoryItem')).toBe(false)
    const oiWhere = mocks.orderItemFindMany.mock.calls[0][0].where.order
    expect(Object.prototype.hasOwnProperty.call(oiWhere, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// G. EOD GET residuals (data-fetch.ts)
// ══════════════════════════════════════════════════════════════════
describe('R84-1 G: fetchEodData — residual queries scoped', () => {
  const DS = new Date('2026-01-01T00:00:00Z')
  const DE = new Date('2026-01-01T23:59:59Z')

  it('loc-bound: statusCounts groupBy + voided orderItems + stockTransaction scoped', async () => {
    await fetchEodData(DS, DE, LOC_A)
    // 1. statusCounts — prej statusOrderWhere brez lokacije
    expect(mocks.orderGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // 3. cancelled aggregate
    expect(mocks.orderAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // 4. pending count
    expect(mocks.orderCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // 12. voided items — prek order: statusOrderWhere
    expect(mocks.orderItemFindMany.mock.calls[0][0].where.order.locationId).toBe(LOC_A)
    // 10. stockCost — prek inventoryItem relacije
    const stWhere = mocks.stockTransactionGroupBy.mock.calls[0][0].where
    expect(stWhere.inventoryItem).toEqual({ locationId: LOC_A })
  })

  it('super-admin: residuals brez locationId', async () => {
    await fetchEodData(DS, DE, null)
    expect(Object.prototype.hasOwnProperty.call(mocks.orderGroupBy.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(mocks.orderCount.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(mocks.stockTransactionGroupBy.mock.calls[0][0].where, 'inventoryItem')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// H. EOD POST — CROSS-TENANT WRITE zaprt
// ══════════════════════════════════════════════════════════════════
describe('R84-1 H: computeEodCloseData + closeShiftTransaction — tenant scope', () => {
  const DS = new Date('2026-01-01T00:00:00Z')
  const DE = new Date('2026-01-01T23:59:59Z')
  const shiftA = {
    id: 'shift-A', status: 'open', locationId: LOC_A,
    startingCash: 100, openedAt: new Date('2026-01-01T08:00:00Z'),
  }

  it('loc-bound: findFirst({ status: open, locationId }) — ne najde tuje izemene', async () => {
    mocks.shiftFindFirst.mockResolvedValue(shiftA)
    await computeEodCloseData(DS, DE, 500, '2026-01-01', LOC_A)
    const where = mocks.shiftFindFirst.mock.calls[0][0].where
    expect(where.status).toBe('open')
    expect(where.locationId).toBe(LOC_A)
    // completedOrders scoped
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // voidedItems scoped
    expect(mocks.orderItemAggregate.mock.calls[0][0].where.order.locationId).toBe(LOC_A)
  })

  it('brez lokacije (super-admin): findFirst { status: open } — globalno', async () => {
    mocks.shiftFindFirst.mockResolvedValue(shiftA)
    await computeEodCloseData(DS, DE, 500, '2026-01-01', null)
    const where = mocks.shiftFindFirst.mock.calls[0][0].where
    expect(where.status).toBe('open')
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('closeShiftTransaction: location guard zavrne tujo izmeno (SHIFT_NOT_FOUND)', async () => {
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-B', status: 'open', locationId: LOC_B })
    await expect(
      closeShiftTransaction('shift-B', {
        actualClosingCash: 500, expectedCash: 500, cashDifference: 0,
        cashSales: 0, cardSales: 0, mobileSales: 0, alternateSales: 0,
        totalSales: 0, completedOrdersCount: 0, totalDiscounts: 0,
        totalTips: 0, totalVoided: 0,
      }, LOC_A),
    ).rejects.toThrow('SHIFT_NOT_FOUND')
    expect(mocks.shiftUpdate).not.toHaveBeenCalled()
  })

  it('closeShiftTransaction: lastna izmena se zapre (update klican)', async () => {
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-A', status: 'open', locationId: LOC_A })
    mocks.shiftUpdate.mockResolvedValue({})
    await closeShiftTransaction('shift-A', {
      actualClosingCash: 500, expectedCash: 500, cashDifference: 0,
      cashSales: 0, cardSales: 0, mobileSales: 0, alternateSales: 0,
      totalSales: 0, completedOrdersCount: 0, totalDiscounts: 0,
      totalTips: 0, totalVoided: 0,
    }, LOC_A)
    expect(mocks.shiftUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.shiftUpdate.mock.calls[0][0].data.status).toBe('closed')
  })

  it('closeShiftTransaction: legacy NULL lokacija + loc-bound admin → zavrnjeno (fail-closed)', async () => {
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-X', status: 'open', locationId: null })
    await expect(
      closeShiftTransaction('shift-X', {
        actualClosingCash: 500, expectedCash: 500, cashDifference: 0,
        cashSales: 0, cardSales: 0, mobileSales: 0, alternateSales: 0,
        totalSales: 0, completedOrdersCount: 0, totalDiscounts: 0,
        totalTips: 0, totalVoided: 0,
      }, LOC_A),
    ).rejects.toThrow('SHIFT_NOT_FOUND')
  })

  it('closeShiftTransaction: super-admin (null) sme zapreti NULL-lokacijsko izmeno', async () => {
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-X', status: 'open', locationId: null })
    mocks.shiftUpdate.mockResolvedValue({})
    await closeShiftTransaction('shift-X', {
      actualClosingCash: 500, expectedCash: 500, cashDifference: 0,
      cashSales: 0, cardSales: 0, mobileSales: 0, alternateSales: 0,
      totalSales: 0, completedOrdersCount: 0, totalDiscounts: 0,
      totalTips: 0, totalVoided: 0,
    }, null)
    expect(mocks.shiftUpdate).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════
// I. EOD GET — statusCounts scoped na ruti (potrjeno prek data-fetch)
// ══════════════════════════════════════════════════════════════════
describe('R84-1 I: GET /api/reports/eod — GET pot ostane scoped (regresija R83)', () => {
  it('loc-bound admin: GET vrača 200 (fetchEodData interno scoped)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await eodGET(new Request('http://localhost:3000/api/reports/eod?date=2026-01-01'))
    expect(res.status).toBe(200)
    // statusCounts (groupBy) scoped — R84 residual fix
    expect(mocks.orderGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// J. DIGEST — platform-level gate
// ══════════════════════════════════════════════════════════════════
describe('R84-1 J: digest-preview/send/trend — platform admin gate', () => {
  it('preview: lokacijski admin → 403, NI klicev na db/digest', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await digestPreviewGET(new Request('http://localhost:3000/api/reports/digest-preview'))
    expect(res.status).toBe(403)
    expect(mocks.fetchDailyDigestData).not.toHaveBeenCalled()
    expect(mocks.buildDailyDigestHtml).not.toHaveBeenCalled()
  })

  it('preview: super-admin (brez lokacije) → 200', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.fetchDailyDigestData.mockResolvedValue({ revenue: 100 })
    mocks.buildDailyDigestHtml.mockReturnValue('<html></html>')
    const res = await digestPreviewGET(new Request('http://localhost:3000/api/reports/digest-preview'))
    expect(res.status).toBe(200)
    expect(mocks.fetchDailyDigestData).toHaveBeenCalledTimes(1)
  })

  it('send: lokacijski admin → 403, NI poizvedb na scheduledEmailLog', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await digestSendPOST(new Request('http://localhost:3000/api/reports/digest-send', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(403)
    expect(mocks.scheduledEmailLogFindMany).not.toHaveBeenCalled()
    expect(mocks.ensureDailySummaryLog).not.toHaveBeenCalled()
  })

  it('send: super-admin → 200 (skipped, ni pending logov)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await digestSendPOST(new Request('http://localhost:3000/api/reports/digest-send', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('trend: lokacijski admin → 403, NI poizvedb na order', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await digestTrendGET(new Request('http://localhost:3000/api/reports/digest-trend'))
    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('trend: super-admin → 200', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.orderFindMany.mockResolvedValue([])
    const res = await digestTrendGET(new Request('http://localhost:3000/api/reports/digest-trend'))
    expect(res.status).toBe(200)
  })
})
