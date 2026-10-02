// ============================================
// #152 korak 2 (R216) — G2 SALE-CHAIN COGS BUSINESS-DAY BUCKETIRANJE
// ============================================
// Vrzel G2 (docs/INVENTORY-CHAIN.md §5): prihodki so bucketirani na
// Order.paidAt (LJ poslovni dan — fiskalni kanon P2-08), COGS pa na
// StockTransaction.createdAt (čas ognja). Naročilo ob 23:50 / plačilo ob
// 00:10 je razdelilo bruto maržo med dneva (dan D: COGS brez prihodka; dan
// D+1: prihodek brez COGS).
//
// FIX (kanon pariteta, usklajeno z #148 ljubljanaDayBounds): sale-chain
// ('sale' + 'return') bucketiran na order.paidAt (ISTI kanon kot prihodki);
// fallback BIT-FOR-BIT (orderId null ALI order.paidAt null) + ne-naročilni
// tipi (procurement/write-off/adjustment/batch-*) ostanejo na createdAt.
// Relacija StockTransaction.order (0026_stocktx_order_relation) omogoča
// relation filter.
//
// Tukaj WHERE-oblikne pini za VSE 4 konzumente + helper. Kanonski EFEKT
// (cross-midnight vrstice v realni bazi) v IT drillu
// (tests/integration/r209-inventory-chain-drill.test.ts — R216 G2 describe).
import { describe, it, expect, beforeEach, vi } from 'vitest'

const m = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderGroupBy: vi.fn(),
  orderAggregate: vi.fn(),
  orderCount: vi.fn(),
  orderItemFindMany: vi.fn(),
  orderItemGroupBy: vi.fn(),
  paymentGroupBy: vi.fn(),
  stockTransactionGroupBy: vi.fn(),
  stockTransactionFindMany: vi.fn(),
  stockTransactionAggregate: vi.fn(),
  shiftFindFirst: vi.fn(),
  shiftAggregate: vi.fn(),
  locationFindUnique: vi.fn(),
  receiptCount: vi.fn(),
  journalLineFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: m.orderFindMany,
      groupBy: m.orderGroupBy,
      aggregate: m.orderAggregate,
      count: m.orderCount,
    },
    orderItem: { findMany: m.orderItemFindMany, groupBy: m.orderItemGroupBy },
    payment: { groupBy: m.paymentGroupBy },
    stockTransaction: {
      groupBy: m.stockTransactionGroupBy,
      findMany: m.stockTransactionFindMany,
      aggregate: m.stockTransactionAggregate,
    },
    cashRegisterShift: { findFirst: m.shiftFindFirst, aggregate: m.shiftAggregate },
    location: { findUnique: m.locationFindUnique },
    receipt: { count: m.receiptCount },
    journalLine: { findMany: m.journalLineFindMany },
  },
}))

import { fetchFinancialData } from '@/app/api/reports/financial/_helpers-queries'
import { fetchEodData } from '@/app/api/reports/eod/_helpers/data-fetch'
import { fetchFursShiftCogs } from '@/app/api/dashboard/_helpers/furs-shift-cogs'
import { generateProfitLoss } from '@/lib/accounting/journal-generator'
import {
  buildSaleCogsWindowFilter,
  buildOtherStockTypesWindowFilter,
  SALE_CHAIN_COGS_TYPES,
} from '@/lib/reports/sale-cogs-bucketing'

const LOC_A = 'loc-a'
const S = new Date('2026-03-15T23:00:00Z') // LJ polnoč 2026-03-16 (CET→ meje; identiteta je vse kar pinamo)
const E = new Date('2026-03-16T22:59:59.999Z')

describe('R216 G2: helper — sale-cogs-bucketing', () => {
  it('SALE_CHAIN_COGS_TYPES = [sale, return] (storno sledi prodajnemu poslovnemu dnevu)', () => {
    expect([...SALE_CHAIN_COGS_TYPES]).toEqual(['sale', 'return'])
  })

  it('buildSaleCogsWindowFilter: 2 veji (A: order.paidAt okno; B: createdAt fallback z unpaid/no-order guardom) — identiteta oken', () => {
    const branches = buildSaleCogsWindowFilter(S, E)
    expect(branches).toHaveLength(2)
    // (A) plačano v oknu → poslovni dan prodaje, BREZ omejitve na createdAt
    expect(branches[0]).toEqual({
      type: { in: ['sale', 'return'] },
      order: { paidAt: { gte: S, lte: E } },
    })
    const branchA = branches[0] as { order: { paidAt: { gte: Date; lte: Date } } }
    expect(branchA.order.paidAt.gte).toBe(S) // ISTI Date instanc (kanon pariteta s prihodki)
    expect(branchA.order.paidAt.lte).toBe(E)
    // (B) fallback BIT-FOR-BIT: brez plačanega naročila → čas ognja
    expect(branches[1]).toEqual({
      type: { in: ['sale', 'return'] },
      createdAt: { gte: S, lte: E },
      OR: [{ orderId: null }, { order: { paidAt: null } }],
    })
  })

  it('buildOtherStockTypesWindowFilter: ne-naročilni tipi ostanejo na času ognja', () => {
    expect(buildOtherStockTypesWindowFilter(S, E)).toEqual({
      type: { notIn: ['sale', 'return'] },
      createdAt: { gte: S, lte: E },
    })
  })
})

describe('R216 G2: fetchFinancialData — stockWhere kanon pariteta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.orderGroupBy.mockResolvedValue([])
    m.orderAggregate.mockResolvedValue({ _sum: {}, _count: 0 })
    m.orderFindMany.mockResolvedValue([])
    m.orderItemFindMany.mockResolvedValue([])
    m.stockTransactionGroupBy.mockResolvedValue([])
    m.shiftAggregate.mockResolvedValue({ _sum: {}, _count: 0 })
  })

  it('loc-bound: 3 OR veje (sale-chain po paidAt / fallback / ostali po createdAt) + inventoryItem scope top-level', async () => {
    await fetchFinancialData(S, E, S, E, LOC_A)
    expect(m.stockTransactionGroupBy).toHaveBeenCalledTimes(1)
    const where = m.stockTransactionGroupBy.mock.calls[0][0].where
    expect(where.OR).toHaveLength(3)
    // veja A — sale-chain po poslovnem dnevu prodaje (order.paidAt)
    expect(where.OR[0]).toEqual({
      type: { in: ['sale', 'return'] },
      order: { paidAt: { gte: S, lte: E } },
    })
    // veja B — fallback: brez plačanega naročila → createdAt
    expect(where.OR[1]).toEqual({
      type: { in: ['sale', 'return'] },
      createdAt: { gte: S, lte: E },
      OR: [{ orderId: null }, { order: { paidAt: null } }],
    })
    // veja C — ne-naročilni tipi → createdAt (kot prej)
    expect(where.OR[2]).toEqual({
      type: { notIn: ['sale', 'return'] },
      createdAt: { gte: S, lte: E },
    })
    // R84-1 pin ohranjen: scope prek inventoryItem, NIKOLI top-level locationId
    expect(where.inventoryItem).toEqual({ locationId: LOC_A })
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('super-admin: brez inventoryItem ključa (prazen filter)', async () => {
    await fetchFinancialData(S, E, S, E, null)
    const where = m.stockTransactionGroupBy.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'inventoryItem')).toBe(false)
    expect(where.OR).toHaveLength(3)
  })
})

describe('R216 G2: fetchEodData — stockCostGroups kanon pariteta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.orderGroupBy.mockResolvedValue([])
    m.orderAggregate.mockResolvedValue({ _sum: {}, _count: 0 })
    m.orderCount.mockResolvedValue(0)
    m.orderFindMany.mockResolvedValue([])
    m.orderItemGroupBy.mockResolvedValue([])
    m.orderItemFindMany.mockResolvedValue([])
    m.paymentGroupBy.mockResolvedValue([])
    m.stockTransactionGroupBy.mockResolvedValue([])
    m.shiftFindFirst.mockResolvedValue(null)
  })

  it('loc-bound: 3 OR veje + inventoryItem scope top-level (R84-1 G pin ohranjen)', async () => {
    await fetchEodData(S, E, LOC_A)
    expect(m.stockTransactionGroupBy).toHaveBeenCalledTimes(1)
    const where = m.stockTransactionGroupBy.mock.calls[0][0].where
    expect(where.OR).toHaveLength(3)
    expect(where.OR[0]).toEqual({
      type: { in: ['sale', 'return'] },
      order: { paidAt: { gte: S, lte: E } },
    })
    expect(where.OR[1].OR).toEqual([{ orderId: null }, { order: { paidAt: null } }])
    expect(where.OR[2].type).toEqual({ notIn: ['sale', 'return'] })
    expect(where.inventoryItem).toEqual({ locationId: LOC_A })
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('super-admin: brez inventoryItem ključa', async () => {
    await fetchEodData(S, E, null)
    const where = m.stockTransactionGroupBy.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'inventoryItem')).toBe(false)
  })
})

describe('R216 G2: fetchFursShiftCogs — todayCogs kanon pariteta', () => {
  const TODAY = new Date('2026-03-15T23:00:00Z')
  const TOMORROW = new Date('2026-03-16T23:00:00Z')

  beforeEach(() => {
    vi.clearAllMocks()
    m.locationFindUnique.mockResolvedValue({ fursCertPath: '/cert', fursEnvironment: 'test' })
    m.receiptCount.mockResolvedValue(0)
    m.shiftFindFirst.mockResolvedValue(null)
    m.stockTransactionFindMany.mockResolvedValue([])
  })

  it('loc-bound: type=sale + 2 OR veji (order.paidAt okno / createdAt fallback) + inventoryItem scope', async () => {
    await fetchFursShiftCogs(TODAY, TOMORROW, 1000, LOC_A)
    expect(m.stockTransactionFindMany).toHaveBeenCalledTimes(1)
    const where = m.stockTransactionFindMany.mock.calls[0][0].where
    expect(where.type).toBe('sale')
    expect(where.OR).toHaveLength(2)
    expect(where.OR[0]).toEqual({ order: { paidAt: { gte: TODAY, lt: TOMORROW } } })
    expect(where.OR[1]).toEqual({
      createdAt: { gte: TODAY, lt: TOMORROW },
      OR: [{ orderId: null }, { order: { paidAt: null } }],
    })
    // R85-H1 pin ohranjen: scope prek inventoryItem.locationId
    expect(where.inventoryItem).toEqual({ locationId: LOC_A })
  })

  it('super-admin: brez inventoryItem ključa; findMany reject → .catch fallback [] (todayCogs 0)', async () => {
    m.stockTransactionFindMany.mockRejectedValueOnce(new Error('db down'))
    const result = await fetchFursShiftCogs(TODAY, TOMORROW, 1000, null)
    const where = m.stockTransactionFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'inventoryItem')).toBe(false)
    // .catch fallback ohranjen — brez crasha, todayCogs 0
    expect(result.todayCogs).toBe(0)
    expect(result.grossProfit).toBe(1000)
  })
})

describe('R216 G2: generateProfitLoss — P&L COGS fallback kanon pariteta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.journalLineFindMany.mockResolvedValue([])
    m.stockTransactionAggregate.mockResolvedValue({ _sum: { totalCost: null }, _count: 0 })
  })

  it('z oknom: type=sale + 2 OR veji (order.paidAt / createdAt fallback), identiteta meja', async () => {
    await generateProfitLoss(S, E)
    expect(m.stockTransactionAggregate).toHaveBeenCalledTimes(1)
    const where = m.stockTransactionAggregate.mock.calls[0][0].where
    expect(where.type).toBe('sale')
    expect(where.OR).toHaveLength(2)
    expect(where.OR[0]).toEqual({ order: { paidAt: { gte: S, lte: E } } })
    expect(where.OR[0].order.paidAt.gte).toBe(S)
    expect(where.OR[1]).toEqual({
      createdAt: { gte: S, lte: E },
      OR: [{ orderId: null }, { order: { paidAt: null } }],
    })
  })

  it('brez okna: where ostane { type: sale } (BIT-FOR-BIT, brez OR/createdAt ključev)', async () => {
    await generateProfitLoss()
    const where = m.stockTransactionAggregate.mock.calls[0][0].where
    expect(where).toEqual({ type: 'sale' })
    expect(Object.prototype.hasOwnProperty.call(where, 'OR')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(where, 'createdAt')).toBe(false)
  })
})
