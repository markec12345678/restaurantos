// ============================================
// R129 (epic #115 P1-07) — CENTER NAROČIL — unit testi
// ============================================
// Čiste funkcije iz src/components/pos/reorder/helpers.ts:
//   - normalizeSuggestion   → defenzivna normalizacija starega/novega odgovora GET /api/inventory/reorder
//   - isActionable/filterActionable → izberljivi predlogi (low|critical, qty > 0, ni pokrit z NO)
//   - groupEstimatedValue   → Σ suggestedQty × unitPrice (2 decimalki)
//   - summarizeStatuses     → števeci po statusu (vključno 'brez podatkov')
//   - formatSuggestionNote  → oznaka preskočenih artiklov iz draft-po odgovora
//   - sortByUrgency / fmtQty / formatDateSafe / round2
// Isti kompaktni vzorec kot tests/unit/offline/r128-offline-cancel-ops.test.ts
// (čiste funkcije, brez mockov in brez I/O).
// ============================================
import { describe, it, expect } from 'vitest'
import {
  normalizeSuggestion,
  isActionable,
  filterActionable,
  groupEstimatedValue,
  summarizeStatuses,
  formatSuggestionNote,
  sortByUrgency,
  fmtQty,
  formatDateSafe,
  round2,
  type ReorderCenterSuggestion,
} from '@/components/pos/reorder/helpers'

/** Tovarnica za NOVO obliko predloga (R129-server kontrakt) */
function makeSuggestion(overrides: Partial<ReorderCenterSuggestion> = {}): ReorderCenterSuggestion {
  return {
    itemId: 'inv-1',
    name: 'Pivo Laško 0,5L',
    unit: 'kos',
    supplier: 'Pivovarna Laško',
    quantity: 5,
    minQuantity: 10,
    reorderPoint: 12,
    safetyStock: 4,
    suggestedQty: 24,
    unitPrice: 0.85,
    avgDailyUsage: 2,
    daysUntilEmpty: 2,
    urgency: 'critical',
    status: 'critical',
    dataStatus: 'sufficient',
    factors: ['Zaloga zmanjka čez 2 dni!', 'Pod točko naročila (5 < 12)'],
    reason: 'Zaloga zmanjka čez 2 dni!',
    openPoQty: 0,
    openPos: [],
    expectedDelivery: null,
    leadTimeDays: 3,
    ...overrides,
  }
}

describe('R129: normalizeSuggestion — defenzivna normalizacija (nov + star odgovor)', () => {
  it('NOVA oblika: polja 1:1, faktorji iz factors', () => {
    const n = normalizeSuggestion({
      itemId: 'inv-9', name: 'Moka', unit: 'kg', quantity: 3, minQuantity: 5,
      status: 'low', dataStatus: 'sufficient', factors: ['nizek dobiček', 'pod TP'],
      suggestedQty: 10, unitPrice: 2.5, supplier: 'Zasil',
    })
    expect(n.itemId).toBe('inv-9')
    expect(n.name).toBe('Moka')
    expect(n.status).toBe('low')
    expect(n.factors).toEqual(['nizek dobiček', 'pod TP'])
    expect(n.unitPrice).toBe(2.5)
    expect(n.dataStatus).toBe('sufficient')
  })

  it('STARA oblika: inventoryItemId/itemName/currentStock/costPerUnit → normalizirana polja', () => {
    const n = normalizeSuggestion({
      inventoryItemId: 'inv-old', itemName: 'Kava', unit: 'kg', currentStock: 2,
      suggestedQty: 7, costPerUnit: 12.5, urgency: 'critical', reason: 'Zaloga zmanjka čez 1 dan!',
    })
    expect(n.itemId).toBe('inv-old')
    expect(n.name).toBe('Kava')
    expect(n.quantity).toBe(2)
    expect(n.unitPrice).toBe(12.5)
    // star reason postane en sam faktor (razlaga ostane vidna)
    expect(n.factors).toEqual(['Zaloga zmanjka čez 1 dan!'])
    // status iz stare urgency: critical → critical, sicer nizek/zaloga OK prek isLowStock
    expect(n.status).toBe('critical')
  })

  it('STARA oblika urgency "high" → status "low"; brez urgency/isLowStock → "ok"', () => {
    expect(normalizeSuggestion({ urgency: 'high' }).status).toBe('low')
    expect(normalizeSuggestion({}).status).toBe('ok')
    expect(normalizeSuggestion({ isLowStock: true }).status).toBe('low')
  })

  it('factors manjkajo → fallback na [reason]; oba manjkata → prazen seznam', () => {
    expect(normalizeSuggestion({ reason: 'razlog X' }).factors).toEqual(['razlog X'])
    expect(normalizeSuggestion({}).factors).toEqual([])
  })

  it('neveljaven/neizčrpen status → fallback prek isLowStock/urgency', () => {
    expect(normalizeSuggestion({ status: 'neznano', isLowStock: true }).status).toBe('low')
    expect(normalizeSuggestion({ status: 'covered-by-po' }).status).toBe('covered-by-po')
  })

  it('openPos: brez poNumber filtrirane, expectedDate ohranjena; openPoQty default 0', () => {
    const n = normalizeSuggestion({
      openPoQty: 40,
      openPos: [{ poNumber: 'ND-1', expectedDate: '2026-01-15' }, { poNumber: '' }, { expectedDate: '2026-01-20' }],
    })
    expect(n.openPoQty).toBe(40)
    expect(n.openPos).toEqual([{ poNumber: 'ND-1', expectedDate: '2026-01-15' }])
    expect(normalizeSuggestion({}).openPoQty).toBe(0)
    expect(normalizeSuggestion({}).openPos).toEqual([])
  })

  it('neštevilske vrednosti → varni defaulti (0/null), name fallback', () => {
    const n = normalizeSuggestion({ quantity: NaN, suggestedQty: undefined, unitPrice: null as unknown as number, daysUntilEmpty: 'x' as unknown as number })
    expect(n.quantity).toBe(0)
    expect(n.suggestedQty).toBe(0)
    expect(n.unitPrice).toBe(0)
    expect(n.daysUntilEmpty).toBeNull()
    expect(n.name).toBe('Neznan artikel')
    expect(n.unit).toBe('kos')
  })

  it('dataStatus: samo "insufficient" je nezadosten, vse ostalo → sufficient', () => {
    expect(normalizeSuggestion({ dataStatus: 'insufficient' }).dataStatus).toBe('insufficient')
    expect(normalizeSuggestion({ dataStatus: 'cakajoci' }).dataStatus).toBe('sufficient')
    expect(normalizeSuggestion({}).dataStatus).toBe('sufficient')
  })
})

describe('R129: isActionable / filterActionable — izberljivi predlogi', () => {
  it('low|critical s suggestedQty > 0 so akcijski', () => {
    expect(isActionable(makeSuggestion({ status: 'low' }))).toBe(true)
    expect(isActionable(makeSuggestion({ status: 'critical' }))).toBe(true)
  })

  it('ok / covered-by-po / suggestedQty = 0 NISO akcijski', () => {
    expect(isActionable(makeSuggestion({ status: 'ok' }))).toBe(false)
    expect(isActionable(makeSuggestion({ status: 'covered-by-po' }))).toBe(false)
    expect(isActionable(makeSuggestion({ status: 'critical', suggestedQty: 0 }))).toBe(false)
  })

  it('filterActionable: obdrži samo akcijske (explicitno tudi NE covered-by-po)', () => {
    const list = [
      makeSuggestion({ itemId: 'a', status: 'critical' }),
      makeSuggestion({ itemId: 'b', status: 'ok' }),
      makeSuggestion({ itemId: 'c', status: 'covered-by-po' }),
      makeSuggestion({ itemId: 'd', status: 'low', suggestedQty: 0 }),
      makeSuggestion({ itemId: 'e', status: 'low' }),
    ]
    expect(filterActionable(list).map(s => s.itemId)).toEqual(['a', 'e'])
  })

  it('filterActionable: prazen vnos → prazen izhod', () => {
    expect(filterActionable([])).toEqual([])
  })
})

describe('R129: groupEstimatedValue — ocenjena vrednost izbire', () => {
  it('Σ suggestedQty × unitPrice, zaokroženo na 2 decimalki', () => {
    const items = [
      { suggestedQty: 10, unitPrice: 1.111 },
      { suggestedQty: 3, unitPrice: 2.5 },
    ]
    // 11.11 + 7.5 = 18.61
    expect(groupEstimatedValue(items)).toBe(18.61)
  })

  it('plavajoča vejica: 0.1 + 0.2 → 0.3 (brez 0.30000000000000004)', () => {
    expect(groupEstimatedValue([
      { suggestedQty: 1, unitPrice: 0.1 },
      { suggestedQty: 1, unitPrice: 0.2 },
    ])).toBe(0.3)
  })

  it('prazen seznam → 0; neštevilčne vrednosti → tretirane kot 0', () => {
    expect(groupEstimatedValue([])).toBe(0)
    expect(groupEstimatedValue([{ suggestedQty: NaN, unitPrice: 5 }])).toBe(0)
    expect(groupEstimatedValue([{ suggestedQty: 2, unitPrice: undefined as unknown as number }])).toBe(0)
  })

  it('round2 helper: negativne in velike vrednosti', () => {
    expect(round2(-1.005)).toBe(-1.0)
    expect(round2(1234.567)).toBe(1234.57)
    expect(round2(NaN)).toBe(0)
  })
})

describe('R129: summarizeStatuses — števeci po statusu', () => {
  it('šteje vse štiri statuse + brez podatkov (dataStatus insufficient)', () => {
    const list = [
      makeSuggestion({ status: 'critical', dataStatus: 'sufficient' }),
      makeSuggestion({ status: 'critical', dataStatus: 'insufficient' }),
      makeSuggestion({ status: 'low' }),
      makeSuggestion({ status: 'ok' }),
      makeSuggestion({ status: 'covered-by-po' }),
    ]
    expect(summarizeStatuses(list)).toEqual({
      total: 5, critical: 2, low: 1, ok: 1, coveredByPo: 1, withoutData: 1,
    })
  })

  it('prazen seznam → vse ničle', () => {
    expect(summarizeStatuses([])).toEqual({ total: 0, critical: 0, low: 0, ok: 0, coveredByPo: 0, withoutData: 0 })
  })
})

describe('R129: formatSuggestionNote — preskočeni artikli', () => {
  it('prazno/undefined → prazen niz', () => {
    expect(formatSuggestionNote([])).toBe('')
    expect(formatSuggestionNote(undefined as unknown as [])).toBe('')
  })

  it('izpiše ime (razlog), ločeno s podpičjem; brez imena → itemId; brez obojega → "?"', () => {
    expect(formatSuggestionNote([
      { itemId: 'a', name: 'Moka', reason: 'ni dobavitelja' },
      { itemId: 'b', reason: 'podatkov ni' },
      { itemId: '' },
    ])).toBe('Preskočeni artikli: Moka (ni dobavitelja); b (podatkov ni); ?')
  })
})

describe('R129: sortByUrgency / fmtQty / formatDateSafe', () => {
  it('kritični prvi, nato low, ok, covered-by-po; sekundarno daysUntilEmpty naraščajoče', () => {
    const list = [
      makeSuggestion({ itemId: 'ok1', status: 'ok' }),
      makeSuggestion({ itemId: 'low-late', status: 'low', daysUntilEmpty: 9 }),
      makeSuggestion({ itemId: 'crit', status: 'critical', daysUntilEmpty: 4 }),
      makeSuggestion({ itemId: 'cov', status: 'covered-by-po' }),
      makeSuggestion({ itemId: 'low-early', status: 'low', daysUntilEmpty: 1 }),
    ]
    expect(sortByUrgency(list).map(s => s.itemId)).toEqual(['crit', 'low-early', 'low-late', 'ok1', 'cov'])
  })

  it('daysUntilEmpty 999/null = "ne zmanjka" → najkasnejše znotraj istega statusa; ne mutira vhoda', () => {
    const list = [
      makeSuggestion({ itemId: 'a', status: 'low', daysUntilEmpty: null }),
      makeSuggestion({ itemId: 'b', status: 'low', daysUntilEmpty: 3 }),
    ]
    const sorted = sortByUrgency(list)
    expect(sorted.map(s => s.itemId)).toEqual(['b', 'a'])
    expect(list[0].itemId).toBe('a') // original ostane nespremenjen
  })

  it('fmtQty: cela števila brez decimalk, sicer max 2 decimalki', () => {
    expect(fmtQty(3)).toBe('3')
    expect(fmtQty(2.5)).toBe('2.5')
    expect(fmtQty(1.005)).toBe('1') // round2 → 1
    expect(fmtQty(NaN)).toBe('0')
  })

  it('formatDateSafe: null/prazno/neveljaven datum → null, veljaven → niz', () => {
    expect(formatDateSafe(null)).toBeNull()
    expect(formatDateSafe(undefined)).toBeNull()
    expect(formatDateSafe('')).toBeNull()
    expect(formatDateSafe('ni-datum')).toBeNull()
    expect(typeof formatDateSafe('2026-01-15T00:00:00.000Z')).toBe('string')
  })
})
