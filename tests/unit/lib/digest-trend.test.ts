import { describe, expect, it } from 'vitest'
import { computeDigestTrend, slShortDayLabel, formatEURShort } from '@/lib/digest-trend'

// R71: 7-dnevni trend za dnevni povzetek (podaljšek R65). Lib je ČIST
// (isti vzorec kot pctChange R65) — testi pokrivajo skaliranje, "najboljši
// dan", duplikate, fail-safe vhode in slovenske oznake dni.

describe('slShortDayLabel', () => {
  it('pozna dneve v tednu (2026-09-14 je ponedeljek)', () => {
    // pon 14.9.2026 → sob 19.9.
    expect(slShortDayLabel('2026-09-14')).toBe('pon')
    expect(slShortDayLabel('2026-09-15')).toBe('tor')
    expect(slShortDayLabel('2026-09-16')).toBe('sre')
    expect(slShortDayLabel('2026-09-17')).toBe('čet')
    expect(slShortDayLabel('2026-09-18')).toBe('pet')
    expect(slShortDayLabel('2026-09-19')).toBe('sob')
    expect(slShortDayLabel('2026-09-20')).toBe('ned')
  })

  it('neveljaven vhod → prazen string (fail-safe)', () => {
    expect(slShortDayLabel('')).toBe('')
    expect(slShortDayLabel('ni-datum')).toBe('')
    expect(slShortDayLabel('2026-13-99')).toBe('')
  })
})

describe('formatEURShort', () => {
  it('brez centov + pika za tisočice (ročno, brez Intl)', () => {
    expect(formatEURShort(1234.56)).toBe('1.235 €') // zaokroži na celote
    expect(formatEURShort(987)).toBe('987 €')
    expect(formatEURShort(1234567)).toBe('1.234.567 €')
  })

  it('fail-safe: NaN/negativno/undefined → 0 €', () => {
    expect(formatEURShort(NaN)).toBe('0 €')
    expect(formatEURShort(-50)).toBe('0 €')
    expect(formatEURShort(undefined)).toBe('0 €')
  })
})

describe('computeDigestTrend', () => {
  const DAYS = [
    { date: '2026-09-14', revenue: 1000, ordersCount: 10 },
    { date: '2026-09-15', revenue: 2000, ordersCount: 20 },
    { date: '2026-09-16', revenue: 1500, ordersCount: 15 },
    { date: '2026-09-17', revenue: 3000, ordersCount: 30 }, // najboljši
    { date: '2026-09-18', revenue: 500, ordersCount: 5 },
    { date: '2026-09-19', revenue: 2500, ordersCount: 25 },
    { date: '2026-09-20', revenue: 2000, ordersCount: 18 },
  ]

  it('osnovni trend: 7 točk, skupka, povprečje, najboljši dan', () => {
    const t = computeDigestTrend(DAYS)
    expect(t.dayCount).toBe(7)
    expect(t.total).toBe(12500)
    expect(t.avgPerDay).toBeCloseTo(12500 / 7)
    expect(t.totalOrders).toBe(123)
    expect(t.bestDate).toBe('2026-09-17')
    expect(t.avgLinePct).not.toBeNull()
  })

  it('višine so % relativno na najboljši dan; min 2 % za vidnost', () => {
    const t = computeDigestTrend(DAYS)
    const best = t.points.find(p => p.isBest)!
    expect(best.heightPct).toBe(100)
    const weakest = t.points.find(p => p.date === '2026-09-18')!
    expect(weakest.heightPct).toBeCloseTo((500 / 3000) * 100)
    // dan z 0 prometom → višina 0 (ne min 2 % — min velja samo pri max>0 mapiranju)
    const zero = computeDigestTrend([
      { date: '2026-09-14', revenue: 0, ordersCount: 0 },
      { date: '2026-09-15', revenue: 1000, ordersCount: 10 },
    ])
    expect(zero.points[0].heightPct).toBe(0)
    expect(zero.points[1].heightPct).toBe(100)
  })

  it('avgLinePct = povprečje/max × 100', () => {
    const t = computeDigestTrend(DAYS)
    expect(t.avgLinePct).toBeCloseTo((12500 / 7 / 3000) * 100)
  })

  it('obreže na zadnjih 7 dni, če je vhod daljši', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-09-${String(11 + i).padStart(2, '0')}`,
      revenue: (i + 1) * 100,
      ordersCount: i + 1,
    }))
    const t = computeDigestTrend(ten, 7)
    expect(t.dayCount).toBe(7)
    expect(t.points[0].date).toBe('2026-09-14')
    expect(t.points[6].date).toBe('2026-09-20')
    // zadnjih 7 od 10: i=3..9 → 400+500+600+700+800+900+1000
    expect(t.total).toBe(4900)
  })

  it('vhod v NAPAČNEM vrstnem redu → sortiraj ASC po datumu', () => {
    const t = computeDigestTrend([DAYS[2], DAYS[0], DAYS[1]])
    expect(t.points.map(p => p.date)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16'])
  })

  it('duplikati datumov → združi (vsota revenue + orders)', () => {
    const t = computeDigestTrend([
      { date: '2026-09-14', revenue: 100, ordersCount: 2 },
      { date: '2026-09-14', revenue: 50, ordersCount: 1 },
      { date: '2026-09-15', revenue: 200, ordersCount: 4 },
    ])
    expect(t.dayCount).toBe(2)
    expect(t.points[0].revenue).toBe(150)
    expect(t.points[0].ordersCount).toBe(3)
  })

  it('ne-finitne/negativne vrednosti → 0 (fail-safe, kot toNum)', () => {
    const t = computeDigestTrend([
      { date: '2026-09-14', revenue: NaN, ordersCount: -5 },
      { date: '2026-09-15', revenue: 500, ordersCount: 5 },
    ])
    expect(t.points[0].revenue).toBe(0)
    expect(t.points[0].ordersCount).toBe(0)
    expect(t.bestDate).toBe('2026-09-15')
  })

  it('vsi dnevi 0 prometa → bestDate null, avgLinePct null, višine 0', () => {
    const t = computeDigestTrend([
      { date: '2026-09-14', revenue: 0, ordersCount: 0 },
      { date: '2026-09-15', revenue: 0, ordersCount: 0 },
    ])
    expect(t.bestDate).toBeNull()
    expect(t.avgLinePct).toBeNull()
    expect(t.total).toBe(0)
    expect(t.points.every(p => p.heightPct === 0)).toBe(true)
  })

  it('prazen / ne-array vhod → prazna struktura (UI skrije sekcijo)', () => {
    const empty = computeDigestTrend([])
    expect(empty.points).toEqual([])
    expect(empty.dayCount).toBe(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const junk = computeDigestTrend('abc' as any)
    expect(junk.points).toEqual([])
  })

  it('vnosi brez veljavnega datuma → preskočeni', () => {
    const t = computeDigestTrend([
      { date: 'invalid', revenue: 999, ordersCount: 9 },
      { date: '2026-09-15', revenue: 500, ordersCount: 5 },
    ])
    expect(t.dayCount).toBe(1)
    expect(t.points[0].date).toBe('2026-09-15')
  })

  it('slovenske oznake dni so pravilne na točkah', () => {
    const t = computeDigestTrend(DAYS)
    // 2026-09-14 = ponedeljek
    expect(t.points[0].dayLabel).toBe('pon')
    expect(t.points[0].dayNum).toBe(14)
    expect(t.points[3].dayLabel).toBe('čet') // 17.9.
    expect(t.points[6].dayLabel).toBe('ned') // 20.9.
  })
})
