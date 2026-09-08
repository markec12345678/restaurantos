// ============================================
// P1 AUDIT PODATKOVNEGA MODELA — Unit testi
//
// Preverjamo:
// - Decimal aritmetika v order-items (brez float artefaktov; 19.99×3, 9.5% DDV)
// - Porazdelitev popusta po postavkah (zadnja postavka prevzame ostanek)
// - Kanonični izračun: total = neto + DDV − popust (kiosk/mobile enako kot POS)
// - Per-lokacijski števci (getNextOrderNumber/getNextReceiptNumber):
//   pravilno ime counterja + NULL fallback na globalni števec
// - resolveDefaultLocationId: single-tenant resolucija
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

import {
  buildOrderItemsData,
  calculateOrderTotals,
  validateMenuItems,
} from '@/app/api/orders/_helpers/order-items'
import {
  getNextCounter,
  getNextOrderNumber,
  getNextReceiptNumber,
  scopedCounterName,
  resolveDefaultLocationId,
} from '@/lib/counters'
import { db } from '@/lib/db'

// Mock db — counters modul uporablja db kot fallback klienta
vi.mock('@/lib/db', () => ({
  db: {
    counter: {
      upsert: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}))

const mockUpsert = db.counter.upsert as unknown as ReturnType<typeof vi.fn>
const mockRaw = db.$queryRawUnsafe as unknown as ReturnType<typeof vi.fn>
const mockLocationFindFirst = db.location.findFirst as unknown as ReturnType<typeof vi.fn>

// Menu item mock s PRAVIMI Prisma.Decimal instancami (toNum preverja instanceof)
const mi = (id: string, price: number, vatRate: number) => ({
  id,
  price: new Prisma.Decimal(price),
  vatRate: new Prisma.Decimal(vatRate),
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── P1-8: Decimal aritmetika ───
describe('P1-8 buildOrderItemsData — Decimal aritmetika', () => {
  it('19.99 × 3 = 59.97 brez float artefaktov (subtotal)', () => {
    const vatMap = new Map([['a', mi('a', 19.99, 22)]])
    const { subtotal, orderItemsData } = buildOrderItemsData(
      [{ menuItemId: 'a', quantity: 3 }],
      vatMap,
      0,
    )
    expect(subtotal).toBe(59.97)
    expect(orderItemsData[0].vatAmount).toBe(13.19) // 59.97 × 0.22 = 13.1934 → 13.19
  })

  it('DDV se zaokroži PO STAVKI (ROUND_HALF_UP na 2 decimali)', () => {
    // 0.05 × 22% = 0.011 → 0.01; 3.15 × 9.5% = 0.29925 → 0.30
    const vatMap = new Map([
      ['a', mi('a', 0.05, 22)],
      ['b', mi('b', 3.15, 9.5)],
    ])
    const { orderItemsData } = buildOrderItemsData(
      [{ menuItemId: 'a', quantity: 1 }, { menuItemId: 'b', quantity: 1 }],
      vatMap,
      0,
    )
    expect(orderItemsData[0].vatAmount).toBe(0.01)
    expect(orderItemsData[1].vatAmount).toBe(0.3)
  })

  it('9.5 % DDV stopnja se upošteva pravilno (ne 22 %)', () => {
    const vatMap = new Map([['a', mi('a', 10.00, 9.5)]])
    const { orderItemsData } = buildOrderItemsData([{ menuItemId: 'a', quantity: 1 }], vatMap, 0)
    expect(orderItemsData[0].vatAmount).toBe(0.95)
  })

  it('0 % DDV stopnja → vatAmount 0', () => {
    const vatMap = new Map([['a', mi('a', 5.00, 0)]])
    const { orderItemsData } = buildOrderItemsData([{ menuItemId: 'a', quantity: 2 }], vatMap, 0)
    expect(orderItemsData[0].vatAmount).toBe(0)
  })

  it('popust se porazdeli proporcionalno; ZADNJA postavka prevzame ostanek', () => {
    const vatMap = new Map([
      ['a', mi('a', 10.00, 22)],
      ['b', mi('b', 10.00, 22)],
      ['c', mi('c', 10.00, 22)],
    ])
    const { orderItemsData } = buildOrderItemsData(
      [{ menuItemId: 'a', quantity: 1 }, { menuItemId: 'b', quantity: 1 }, { menuItemId: 'c', quantity: 1 }],
      vatMap,
      10.00, // 10 € popusta na 30 € osnove → 3.33 + 3.33 + 3.34
    )
    expect(orderItemsData[0].discountAmount).toBe(3.33)
    expect(orderItemsData[1].discountAmount).toBe(3.33)
    expect(orderItemsData[2].discountAmount).toBe(3.34) // ostanek na zadnji postavki
    // vsota popustov po postavkah = natanko 10.00
    const sum = orderItemsData.reduce((s, i) => s + i.discountAmount, 0)
    expect(Number(sum.toFixed(2))).toBe(10)
  })

  it('popust NIKOLI ne presega osnove (cap na subtotal)', () => {
    const vatMap = new Map([['a', mi('a', 5.00, 22)]])
    const { orderItemsData } = buildOrderItemsData([{ menuItemId: 'a', quantity: 1 }], vatMap, 100)
    expect(orderItemsData[0].discountAmount).toBe(5) // capped
  })

  it('negativen popust se ignorira (0)', () => {
    const vatMap = new Map([['a', mi('a', 5.00, 22)]])
    const { orderItemsData } = buildOrderItemsData([{ menuItemId: 'a', quantity: 1 }], vatMap, -5)
    expect(orderItemsData[0].discountAmount).toBe(0)
  })

  it('DDV se obračuna na DAVČNO OSNOVO po popustu (ne na bruto)', () => {
    const vatMap = new Map([['a', mi('a', 100.00, 22)]])
    const { orderItemsData } = buildOrderItemsData([{ menuItemId: 'a', quantity: 1 }], vatMap, 50)
    // osnova 50.00 → DDV 11.00 (ne 22.00)
    expect(orderItemsData[0].vatAmount).toBe(11)
  })
})

describe('P1-8 calculateOrderTotals — kanonična formula', () => {
  it('total = neto + DDV − popust; napitnina NI vključena', () => {
    const vatMap = new Map([['a', mi('a', 19.99, 22)]])
    const { orderItemsData, subtotal } = buildOrderItemsData([{ menuItemId: 'a', quantity: 3 }], vatMap, 0)
    const totals = calculateOrderTotals(orderItemsData, subtotal)
    expect(totals.subtotal).toBe(59.97)
    expect(totals.totalTax).toBe(13.19)
    expect(totals.totalDiscountAmount).toBe(0)
    expect(totals.total).toBe(73.16) // 59.97 + 13.19
  })

  it('popust zniža total', () => {
    const vatMap = new Map([['a', mi('a', 100.00, 22)]])
    const { orderItemsData, subtotal } = buildOrderItemsData([{ menuItemId: 'a', quantity: 1 }], vatMap, 10)
    const totals = calculateOrderTotals(orderItemsData, subtotal)
    // neto 100, popust 10 → osnova 90 → DDV 19.80 → total 90 + 19.80 = 109.80
    expect(totals.totalTax).toBe(19.8)
    expect(totals.total).toBe(109.8)
  })
})

describe('P1-8 validateMenuItems', () => {
  it('vrne manjkajoči artikel', () => {
    const vatMap = new Map([['a', mi('a', 1, 22)]])
    expect(validateMenuItems([{ menuItemId: 'b', quantity: 1 }], vatMap)).toBe('b')
    expect(validateMenuItems([{ menuItemId: 'a', quantity: 1 }], vatMap)).toBeNull()
  })
})

// ─── P1-7: per-lokacijski števci ───
describe('P1-7 scopedCounterName', () => {
  it('brez lokacije = globalno ime', () => {
    expect(scopedCounterName('orderNumber', null)).toBe('orderNumber')
    expect(scopedCounterName('orderNumber', undefined)).toBe('orderNumber')
  })
  it('z lokacijo = ime@locationId', () => {
    expect(scopedCounterName('orderNumber', 'loc-1')).toBe('orderNumber@loc-1')
  })
})

describe('P1-7 getNextOrderNumber — per-lokacijsko številčenje', () => {
  it('z lokacijo: atomarna INSERT..SELECT MAX..ON CONFLICT izjava', async () => {
    mockRaw.mockResolvedValue([{ value: 42 }])
    const n = await getNextOrderNumber('loc-1')
    expect(n).toBe(42)
    expect(mockRaw).toHaveBeenCalledTimes(1)
    const [sql, ...params] = mockRaw.mock.calls[0]
    expect(sql).toContain('INSERT INTO "Counter"')
    expect(sql).toContain('COALESCE(MAX(o."orderNumber"), 0) + 1')
    expect(sql).toContain('ON CONFLICT ("name") DO UPDATE SET "value" = "Counter"."value" + 1')
    expect(params[1]).toBe('orderNumber@loc-1')
    expect(params[2]).toBe('loc-1')
  })

  it('brez lokacije: globalni counter (backward compat)', async () => {
    mockUpsert.mockResolvedValue({ value: 7 })
    const n = await getNextOrderNumber(null)
    expect(n).toBe(7)
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { name: 'orderNumber' },
      update: { value: { increment: 1 } },
      create: { name: 'orderNumber', value: 1 },
    })
    expect(mockRaw).not.toHaveBeenCalled()
  })
})

describe('P1-7 getNextReceiptNumber — per-lokacijsko (FURS)', () => {
  it('z lokacijo: R-YYYY-NNNNNN + counter receiptNumber-YYYY@loc', async () => {
    mockRaw.mockResolvedValue([{ value: 5 }])
    const num = await getNextReceiptNumber('loc-1')
    const year = new Date().getFullYear()
    expect(num).toBe(`R-${year}-000005`)
    const [sql, ...params] = mockRaw.mock.calls[0]
    expect(sql).toContain('SUBSTRING("receiptNumber" FROM')
    expect(sql).toContain('ON CONFLICT')
    expect(params[1]).toBe(`receiptNumber-${year}@loc-1`)
    expect(params[2]).toBe('loc-1')
    expect(params[3]).toBe(`R-${year}-%`)
  })

  it('brez lokacije: globalni letni counter', async () => {
    mockUpsert.mockResolvedValue({ value: 9 })
    const year = new Date().getFullYear()
    const num = await getNextReceiptNumber(null)
    expect(num).toBe(`R-${year}-000009`)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: `receiptNumber-${year}` } })
    )
  })
})

describe('P1-6 resolveDefaultLocationId', () => {
  it('vrne aktivno lokacijo', async () => {
    mockLocationFindFirst.mockResolvedValueOnce({ id: 'loc-active' })
    expect(await resolveDefaultLocationId()).toBe('loc-active')
    expect(mockLocationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    )
  })

  it('brez aktivnih → katera koli lokacija (neaktivna)', async () => {
    mockLocationFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'loc-any' })
    expect(await resolveDefaultLocationId()).toBe('loc-any')
  })

  it('brez lokacij → null (fail-safe, ne vrže)', async () => {
    mockLocationFindFirst.mockResolvedValue(null)
    expect(await resolveDefaultLocationId()).toBeNull()
  })
})

describe('P1-7 getNextCounter — scope param (novo)', () => {
  it('scope se priključi imenu', async () => {
    mockUpsert.mockResolvedValue({ value: 3 })
    const n = await getNextCounter('purchaseOrderNumber-2026', undefined, 'loc-2')
    expect(n).toBe(3)
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { name: 'purchaseOrderNumber-2026@loc-2' },
      update: { value: { increment: 1 } },
      create: { name: 'purchaseOrderNumber-2026@loc-2', value: 1 },
    })
  })
})
