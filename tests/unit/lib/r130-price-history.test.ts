// ============================================
// R130 / EPIC #115 P1-08 — PRICE HISTORY STATS KANON (PURE unit testi)
// ============================================
// Pokritje:
//  • summarizePrices: prazno, 1 vrstica, 2+ vrstice, trend meje (točno ±5%,
//    tik čez), okna 30/90 dni (stare vrstice izven avg30), min90/max90,
//    Decimal EXACT (string in/out), Date + ISO vhod, determinističen `now`,
//    vrstni red vrstic ni pomemben, izenačeni observedAt (zadnji v vhodu
//    zmaguje za lastPrice)
//  • pickBestSupplier: prazno, vsem manjka zgodovina, izbira najnižje,
//    izenačeni ceni → prvi, ne-validne cene (< = 0) izključene
//  • computeMarginPercent: točno 1 decimalka, price <= 0 → null, negativna marža
// ============================================
import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  summarizePrices,
  pickBestSupplier,
  computeMarginPercent,
  TREND_THRESHOLD_PERCENT,
} from '@/lib/suppliers/price-history'

const NOW = new Date('2026-06-15T12:00:00.000Z')
const DAY = 86_400_000

// pomočnik: vrstica pred N dni (ISO string vhod)
function daysAgoIso(d: number): string {
  return new Date(NOW.getTime() - d * DAY).toISOString()
}

describe('R130 summarizePrices — robni primeri', () => {
  it('prazna zgodovina → vse null + count 0 + trend insufficient', () => {
    const s = summarizePrices([], { now: NOW })
    expect(s).toEqual({
      lastPrice: null, lastAt: null, avg30: null, avg90: null,
      min90: null, max90: null, count: 0, trend: 'insufficient',
    })
  })

  it('1 vrstica → lastPrice/lastAt izpolnjena, trend insufficient (<2 opazovanja)', () => {
    const s = summarizePrices(
      [{ unitPrice: '4.25', observedAt: daysAgoIso(1) }],
      { now: NOW },
    )
    expect(s.lastPrice).toBe('4.25')
    expect(s.lastAt).toBe(daysAgoIso(1))
    expect(s.count).toBe(1)
    expect(s.avg30).toBe('4.2500')
    expect(s.avg90).toBe('4.2500')
    expect(s.min90).toBe('4.25')
    expect(s.max90).toBe('4.25')
    expect(s.trend).toBe('insufficient')
  })

  it('vrstni red vhoda ni pomemben (sortira po observedAt)', () => {
    const a = summarizePrices(
      [
        { unitPrice: '2', observedAt: daysAgoIso(10) },
        { unitPrice: '3', observedAt: daysAgoIso(2) },
        { unitPrice: '1', observedAt: daysAgoIso(20) },
      ],
      { now: NOW },
    )
    const b = summarizePrices(
      [
        { unitPrice: '1', observedAt: daysAgoIso(20) },
        { unitPrice: '3', observedAt: daysAgoIso(2) },
        { unitPrice: '2', observedAt: daysAgoIso(10) },
      ],
      { now: NOW },
    )
    expect(a).toEqual(b)
    expect(a.lastPrice).toBe('3')
    expect(a.count).toBe(3)
  })

  it('izenačeni observedAt → zadnji v vhodnem vrstnem redu zmaguje za lastPrice', () => {
    const at = daysAgoIso(3)
    const s = summarizePrices(
      [
        { unitPrice: '9', observedAt: at },
        { unitPrice: '5', observedAt: at },
      ],
      { now: NOW },
    )
    expect(s.lastPrice).toBe('5')
  })

  it('okni 30/90: vrstica 40 dni nazaj je v avg90, NE v avg30; min90/max90 preko 90 dni', () => {
    const s = summarizePrices(
      [
        { unitPrice: '2.00', observedAt: daysAgoIso(40) }, // samo avg90
        { unitPrice: '3.00', observedAt: daysAgoIso(10) }, // avg30 + avg90
        { unitPrice: '6.00', observedAt: daysAgoIso(95) }, // izven obeh
      ],
      { now: NOW },
    )
    expect(s.count).toBe(3)
    expect(s.avg30).toBe('3.0000')
    expect(s.avg90).toBe('2.5000') // (2 + 3) / 2
    expect(s.min90).toBe('2')
    expect(s.max90).toBe('3')
    // trend: samo 1 opazovanje v 30-dnevnem oknu → insufficient
    expect(s.trend).toBe('insufficient')
  })

  it('trend up: last > avg30 za > 5%', () => {
    const s = summarizePrices(
      [
        { unitPrice: '10', observedAt: daysAgoIso(10) },
        { unitPrice: '12', observedAt: daysAgoIso(1) }, // +20%
      ],
      { now: NOW },
    )
    expect(s.trend).toBe('up')
  })

  it('trend down: last < avg30 za > 5%', () => {
    const s = summarizePrices(
      [
        { unitPrice: '10', observedAt: daysAgoIso(10) },
        { unitPrice: '8', observedAt: daysAgoIso(1) }, // −20%
      ],
      { now: NOW },
    )
    expect(s.trend).toBe('down')
  })

  it(`trend meja: točno +${TREND_THRESHOLD_PERCENT}% je stable, tik čez je up`, () => {
    // avg30 = 10; last = 10.5 → točno +5%
    const atBoundary = summarizePrices(
      [
        { unitPrice: '10', observedAt: daysAgoIso(10) },
        { unitPrice: '10.5', observedAt: daysAgoIso(1) },
      ],
      { now: NOW },
    )
    expect(atBoundary.trend).toBe('stable')

    // last = 10.51 → +5.1% > 5 → up
    const justOver = summarizePrices(
      [
        { unitPrice: '10', observedAt: daysAgoIso(10) },
        { unitPrice: '10.51', observedAt: daysAgoIso(1) },
      ],
      { now: NOW },
    )
    expect(justOver.trend).toBe('up')

    // last = 9.5 → točno −5% → stable
    const negBoundary = summarizePrices(
      [
        { unitPrice: '10', observedAt: daysAgoIso(10) },
        { unitPrice: '9.5', observedAt: daysAgoIso(1) },
      ],
      { now: NOW },
    )
    expect(negBoundary.trend).toBe('stable')

    // last = 9.49 → −5.1% → down
    const justUnder = summarizePrices(
      [
        { unitPrice: '10', observedAt: daysAgoIso(10) },
        { unitPrice: '9.49', observedAt: daysAgoIso(1) },
      ],
      { now: NOW },
    )
    expect(justUnder.trend).toBe('down')
  })

  it('Decimal EXACT: Prisma.Decimal vhod, string izhod (brez float napak)', () => {
    const s = summarizePrices(
      [
        { unitPrice: new Prisma.Decimal('0.1'), observedAt: daysAgoIso(10) },
        { unitPrice: new Prisma.Decimal('0.2'), observedAt: daysAgoIso(1) },
      ],
      { now: NOW },
    )
    // 0.1 + 0.2 = 0.3 EXACT (ne 0.30000000000000004)
    expect(s.avg30).toBe('0.1500')
    expect(s.lastPrice).toBe('0.2')
  })

  it('sprejme Date in ISO string kot observedAt', () => {
    const s = summarizePrices(
      [
        { unitPrice: '4', observedAt: new Date(NOW.getTime() - 5 * DAY) },
        { unitPrice: '6', observedAt: daysAgoIso(2) },
      ],
      { now: NOW },
    )
    expect(s.count).toBe(2)
    expect(s.lastAt).toBe(daysAgoIso(2))
    expect(s.avg30).toBe('5.0000')
  })

  it('brez `now` uporabi new Date() (deterministična trditev le na lastPrice/count)', () => {
    const s = summarizePrices([
      { unitPrice: '2.5', observedAt: new Date(Date.now() - DAY) },
    ])
    expect(s.count).toBe(1)
    expect(s.lastPrice).toBe('2.5')
    expect(s.trend).toBe('insufficient')
  })
})

describe('R130 pickBestSupplier', () => {
  it('prazen vnos → null/null', () => {
    expect(pickBestSupplier([])).toEqual({ supplierId: null, lastPrice: null })
  })

  it('vsem manjka zgodovina (ali lastPrice null) → null/null', () => {
    expect(pickBestSupplier([
      { supplierId: 's1', summary: null },
      { supplierId: 's2', summary: { lastPrice: null, lastAt: null, avg30: null, avg90: null, min90: null, max90: null, count: 0, trend: 'insufficient' } },
    ])).toEqual({ supplierId: null, lastPrice: null })
  })

  it('izbere najnižji lastPrice', () => {
    const best = pickBestSupplier([
      { supplierId: 's1', summary: { lastPrice: '4.20', lastAt: 'x', avg30: null, avg90: null, min90: null, max90: null, count: 2, trend: 'stable' } },
      { supplierId: 's2', summary: { lastPrice: '3.90', lastAt: 'x', avg30: null, avg90: null, min90: null, max90: null, count: 2, trend: 'down' } },
      { supplierId: 's3', summary: { lastPrice: '5.00', lastAt: 'x', avg30: null, avg90: null, min90: null, max90: null, count: 2, trend: 'up' } },
    ])
    expect(best).toEqual({ supplierId: 's2', lastPrice: '3.90' })
  })

  it('izenačeni ceni → prvi v vhodnem vrstnem redu (deterministično)', () => {
    const best = pickBestSupplier([
      { supplierId: 'a', summary: { lastPrice: '2', lastAt: 'x', avg30: null, avg90: null, min90: null, max90: null, count: 1, trend: 'insufficient' } },
      { supplierId: 'b', summary: { lastPrice: '2.0', lastAt: 'x', avg30: null, avg90: null, min90: null, max90: null, count: 1, trend: 'insufficient' } },
    ])
    expect(best.supplierId).toBe('a')
  })

  it('cene <= 0 so izključene (obrambno)', () => {
    const best = pickBestSupplier([
      { supplierId: 's1', summary: { lastPrice: '0', lastAt: 'x', avg30: null, avg90: null, min90: null, max90: null, count: 1, trend: 'insufficient' } },
      { supplierId: 's2', summary: { lastPrice: '1.5', lastAt: 'x', avg30: null, avg90: null, min90: null, max90: null, count: 1, trend: 'insufficient' } },
    ])
    expect(best).toEqual({ supplierId: 's2', lastPrice: '1.5' })
  })
})

describe('R130 computeMarginPercent', () => {
  it('(price − cost)/price kot string %, 1 decimalka', () => {
    expect(computeMarginPercent('12.5', '4.375')).toBe('65.0')
    expect(computeMarginPercent(10, 3)).toBe('70.0')
    expect(computeMarginPercent(3, 9)).toBe('-200.0') // izguba
  })

  it('price <= 0 → null (brez cene ni marže)', () => {
    expect(computeMarginPercent(0, 2)).toBeNull()
    expect(computeMarginPercent(-5, 2)).toBeNull()
  })

  it('cost nad price → negativna marža je dovoljena', () => {
    expect(computeMarginPercent('2.00', '2.50')).toBe('-25.0')
  })
})
