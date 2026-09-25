// ============================================
// R129 / EPIC #115 P1-07 — REORDER KANON (PURE unit testi)
// ============================================
// Testira PURE jedro kanona ('@/lib/reorder/canon'): formula, statusi,
// viri (source labels), faktorji, lead-time veriga. Brez db modulov —
// collectUsageFactsBatch se testira s strukturnim fake klientom
// (kanon tipa ReorderDbClient je minimalen).
// ============================================
import { describe, it, expect } from 'vitest'
import {
  OPEN_PO_STATUSES,
  CONSUMPTION_TX_TYPES,
  SAFETY_STOCK_DAYS,
  collectUsageFactsBatch,
  collectUsageFacts,
  computeReorderSuggestion,
  type UsageFacts,
  type ReorderItemInput,
  type ReorderDbClient,
} from '@/lib/reorder/canon'

// ---------- Fixture pomožniki ----------

function makeItem(over: Partial<ReorderItemInput> = {}): ReorderItemInput {
  return {
    id: 'inv-1',
    name: 'Test Artikel',
    unit: 'pcs',
    supplier: 'Dobavitelj',
    quantity: 6,
    minQuantity: 10,
    costPerUnit: 2,
    ...over,
  }
}

function makeFacts(over: Partial<UsageFacts> = {}): UsageFacts {
  return {
    windowDays: 30,
    recentDays: 7,
    totalConsumed: 69,
    avgDailyUsage: 2.3,
    recentConsumed: 21.7,
    recentDailyUsage: 3.1,
    txCount: 12,
    hasEnoughData: true,
    ...over,
  }
}

function makeZeroFacts(): UsageFacts {
  return {
    windowDays: 30,
    recentDays: 7,
    totalConsumed: 0,
    avgDailyUsage: 0,
    recentConsumed: 0,
    recentDailyUsage: 0,
    txCount: 0,
    hasEnoughData: false,
  }
}

// ============================================
// A. Konstante — stale fix (audit R129-a)
// ============================================
describe('R129 canon konstante', () => {
  it('OPEN_PO_STATUSES = živi PO state machine (brez stale sent/confirmed)', () => {
    expect([...OPEN_PO_STATUSES]).toEqual(['draft', 'submitted', 'approved', 'partial'])
  })

  it('CONSUMPTION_TX_TYPES = sale + batch-consumption (realna poraba)', () => {
    expect([...CONSUMPTION_TX_TYPES]).toEqual(['sale', 'batch-consumption'])
  })

  it('SAFETY_STOCK_DAYS = 2 (iz predictive-ordering L65)', () => {
    expect(SAFETY_STOCK_DAYS).toBe(2)
  })
})

// ============================================
// B. Nezadostni podatki — brez izmišljanja napovedi
// ============================================
describe('R129 canon — insufficient data', () => {
  it('min-osnovani predlog, dataStatus insufficient, brez porabnih števil v faktorjih', () => {
    const s = computeReorderSuggestion(makeItem(), makeZeroFacts(), { openPoQty: 3 })

    expect(s.dataStatus).toBe('insufficient')
    expect(s.status).toBe('low') // 6 ≤ rP (min 10)
    expect(s.reorderPoint).toBe(10)
    expect(s.reorderPointSource).toBe('min-fallback')
    expect(s.safetyStock).toBeNull()
    expect(s.safetyStockSource).toBe('none')
    expect(s.leadTimeDays).toBe(2)
    expect(s.leadTimeSource).toBe('default')

    // formula brez porabe: max(0, ceil(2×10 − 6 − 3)) = 11
    expect(s.suggestedQty).toBe(11)

    // faktorji: NO usage-derived numbers (kanon: ne izmišljuj napovedi)
    const joined = s.factors.join('\n')
    expect(joined).not.toContain('Povprečna poraba')
    expect(joined).not.toContain('Poraba (zadnjih')
    expect(joined).toContain('Podatki o porabi: nezadostni — predlog iz minimuma (brez izmišljanja napovedi)')
    expect(joined).toContain('Predlog: naroči 11 pcs (2× min zaloga 20 − zaloga 6 − odprto 3)')
    // varnostna zaloga ni izmišljena
    expect(joined).toContain('Varnostna zaloga: ni podatka (prištevano 0)')
  })

  it('artikel brez podatkov in brez odprtega PO: max(0, …) ne dela negativnih predlogov', () => {
    const s = computeReorderSuggestion(
      makeItem({ quantity: 50, minQuantity: 5 }),
      makeZeroFacts(),
      {},
    )
    expect(s.status).toBe('ok')
    expect(s.suggestedQty).toBe(0) // 2×5 − 50 < 0 → 0
  })
})

// ============================================
// C. Zadostni podatki — formula točna
// ============================================
describe('R129 canon — sufficient data (formula exact)', () => {
  it('suggestedQty = ceil(rP + safety + ADU×lead − available − openPo)', () => {
    // item brez eksplicitnih polj → vse izpeljano:
    // rP = max(10, ceil(2.3×2)) = 10; safety = ceil(2.3×2) = 5; lead = 2 (default)
    const s = computeReorderSuggestion(makeItem(), makeFacts(), { openPoQty: 3 })

    expect(s.dataStatus).toBe('sufficient')
    expect(s.reorderPoint).toBe(10)
    expect(s.reorderPointSource).toBe('derived')
    expect(s.safetyStock).toBe(5)
    expect(s.safetyStockSource).toBe('derived')
    expect(s.leadTimeDays).toBe(2)
    expect(s.leadTimeSource).toBe('default')
    expect(s.status).toBe('low') // 6 ≤ 10
    // ceil(10 + 5 + 4.6 − 6 − 3) = ceil(10.6) = 11 (6+3 < rP 10 → status low)
    expect(s.suggestedQty).toBe(11)
  })

  it('eksplicitna item polja preglasijo izpeljana (source labels)', () => {
    const s = computeReorderSuggestion(
      makeItem({ reorderPoint: 15, safetyStock: 7, leadTimeDays: 5 }),
      makeFacts(),
      { openPoQty: 4, ruleLeadTimeDays: 4, avgDeliveryDays: 6 },
    )
    expect(s.reorderPoint).toBe(15)
    expect(s.reorderPointSource).toBe('item')
    expect(s.safetyStock).toBe(7)
    expect(s.safetyStockSource).toBe('item')
    expect(s.leadTimeDays).toBe(5)
    expect(s.leadTimeSource).toBe('item')
    // ceil(15 + 7 + 2.3×5 − 6 − 4) = ceil(23.5) = 24
    expect(s.suggestedQty).toBe(24)
  })
})

// ============================================
// D. Odprte naročilnice — odbitek + covered-by-po
// ============================================
describe('R129 canon — odprte naročilnice', () => {
  it('openPo se odbije in pokritost daje status covered-by-po', () => {
    const s = computeReorderSuggestion(
      makeItem({ quantity: 20 }),
      makeFacts(),
      {
        openPoQty: 25,
        openPoRefs: [
          { poNumber: 'ND-2026-000123', expectedDate: '2026-09-25T12:00:00.000Z' },
          { poNumber: 'ND-2026-000001', expectedDate: '2026-09-20T12:00:00.000Z' },
        ],
      },
    )
    // 20 + 25 = 45 ≥ rP 10 → pokrito
    expect(s.status).toBe('covered-by-po')
    expect(s.openPoQty).toBe(25)
    // ceil(10 + 5 + 4.6 − 20 − 25) = ceil(−25.4 → 0) = 0
    expect(s.suggestedQty).toBe(0)
    expect(s.expectedDelivery).toBe('2026-09-20T12:00:00.000Z') // najzgodnejši
    expect(s.openPos).toHaveLength(2)
    const joined = s.factors.join('\n')
    expect(joined).toContain('Odprta naročilnica: 25 pcs (ND-2026-000123, pričakovano 25.09.')
    expect(joined).toContain('Status: pokrito z odprto naročilnico')
  })

  it('odprta naročilnica brez expectedDate → expectedDelivery null', () => {
    const s = computeReorderSuggestion(
      makeItem({ quantity: 20 }),
      makeFacts(),
      { openPoQty: 25, openPoRefs: [{ poNumber: 'ND-2026-000009' }] },
    )
    expect(s.expectedDelivery).toBeNull()
    expect(s.status).toBe('covered-by-po')
  })
})

// ============================================
// E. Statusi — critical / low / ok
// ============================================
describe('R129 canon — statusi', () => {
  it('quantity ≤ 0 → critical (tudi brez podatkov)', () => {
    const s = computeReorderSuggestion(makeItem({ quantity: 0 }), makeZeroFacts(), {})
    expect(s.status).toBe('critical')
  })

  it('quantity ≤ reorderPoint → low', () => {
    const s = computeReorderSuggestion(makeItem({ quantity: 10 }), makeFacts(), {})
    expect(s.status).toBe('low')
  })

  it('quantity > reorderPoint brez PO → ok', () => {
    const s = computeReorderSuggestion(makeItem({ quantity: 50 }), makeFacts(), {})
    expect(s.status).toBe('ok')
  })
})

// ============================================
// F. Lead time veriga virov: item → rule → derived → default
// ============================================
describe('R129 canon — leadTime fallback chain', () => {
  it('item premaga pravilo, pravilo izpeljavo, izpeljava privzeto', () => {
    const item = makeItem({ leadTimeDays: 7 })
    const ctxAll = { ruleLeadTimeDays: 4, avgDeliveryDays: 6 }

    expect(computeReorderSuggestion(item, makeFacts(), ctxAll)).toMatchObject({
      leadTimeDays: 7,
      leadTimeSource: 'item',
    })
    expect(
      computeReorderSuggestion(makeItem(), makeFacts(), ctxAll),
    ).toMatchObject({ leadTimeDays: 4, leadTimeSource: 'rule' })
    expect(
      computeReorderSuggestion(makeItem(), makeFacts(), { avgDeliveryDays: 6 }),
    ).toMatchObject({ leadTimeDays: 6, leadTimeSource: 'derived' })
    expect(computeReorderSuggestion(makeItem(), makeFacts(), {})).toMatchObject({
      leadTimeDays: 2,
      leadTimeSource: 'default',
    })
  })

  it('izpeljana točka naročila upošteva lead iz verige (max(min, ADU×lead))', () => {
    // ADU 2.3 × lead 7 = 16.1 → ceil 17 > min 10
    const s = computeReorderSuggestion(makeItem(), makeFacts({ avgDailyUsage: 2.3 }), {
      ruleLeadTimeDays: 7,
    })
    expect(s.reorderPoint).toBe(17)
  })
})

// ============================================
// G. Faktorji — razložljivost z viri
// ============================================
describe('R129 canon — faktorji', () => {
  it('zadostni podatki: ena vrstica per faktor, z virom', () => {
    const s = computeReorderSuggestion(makeItem(), makeFacts(), {
      openPoQty: 3,
      openPoRefs: [{ poNumber: 'ND-2026-000123', expectedDate: '2026-09-25T12:00:00.000Z' }],
    })
    expect(s.factors).toEqual([
      'Zaloga: 6 pcs',
      'Povprečna poraba (30 dni): 2,3 pcs/dan — prodaja + poraba priprav',
      'Poraba (zadnjih 7 dni): 3,1 pcs/dan',
      'Dobavni čas: 2 dni (privzeto)',
      'Varnostna zaloga: 5 pcs (izpeljano: 2 dni porabe)',
      'Točka naročila: 10 pcs (izpeljana: max(min zaloga, poraba med dobavo))',
      'Odprta naročilnica: 3 pcs (ND-2026-000123, pričakovano 25.09.)',
      'Predlog: naroči 11 pcs (rP 10 + varnost 5 + poraba med dobavo 4,6 − zaloga 6 − odprto 3)',
    ])
  })
})

// ============================================
// H. collectUsageFactsBatch — agregacija (fake db klient)
// ============================================
describe('R129 canon — collectUsageFactsBatch', () => {
  const NOW = new Date('2026-09-25T12:00:00.000Z')

  function fakeDb(rows: Array<{ inventoryItemId: string; quantity: unknown; createdAt: Date }>): ReorderDbClient {
    return {
      stockTransaction: { findMany: async () => rows },
    } as unknown as ReorderDbClient
  }

  it('okno + recent split, abs porabe, hasEnoughData per artikel', async () => {
    const db = fakeDb([
      { inventoryItemId: 'a', quantity: -5, createdAt: new Date('2026-09-24T12:00:00.000Z') }, // recent
      { inventoryItemId: 'a', quantity: -2, createdAt: new Date('2026-08-26T12:00:00.000Z') }, // okno samo
      { inventoryItemId: 'b', quantity: 3, createdAt: new Date('2026-09-20T12:00:00.000Z') },  // anomalia +abs
    ])

    const map = await collectUsageFactsBatch(db, ['a', 'b', 'c'], { now: NOW })

    const a = map.get('a')!
    expect(a.totalConsumed).toBe(7)
    expect(a.avgDailyUsage).toBeCloseTo(7 / 30, 10)
    expect(a.recentConsumed).toBe(5)
    expect(a.recentDailyUsage).toBeCloseTo(5 / 7, 10)
    expect(a.txCount).toBe(2)
    expect(a.hasEnoughData).toBe(true)

    const b = map.get('b')!
    expect(b.totalConsumed).toBe(3)
    expect(b.txCount).toBe(1)
    expect(b.hasEnoughData).toBe(true)

    const c = map.get('c')!
    expect(c.totalConsumed).toBe(0)
    expect(c.txCount).toBe(0)
    expect(c.hasEnoughData).toBe(false)
  })

  it('collectUsageFacts vrne zero-facts za artikel brez transakcij', async () => {
    const facts = await collectUsageFacts(fakeDb([]), 'nope', { now: NOW })
    expect(facts.hasEnoughData).toBe(false)
    expect(facts.txCount).toBe(0)
    expect(facts.avgDailyUsage).toBe(0)
  })
})
