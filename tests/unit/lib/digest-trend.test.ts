import { describe, expect, it } from 'vitest'
import { computeDigestTrend, slShortDayLabel, formatEURShort, isWeekStart, computeTrendComparison } from '@/lib/digest-trend'

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

// ============================================
// R72: 7/30 toggle — tedenski ločilniki + gosto/redko oznake
// ============================================

describe('isWeekStart (R72 tedenski ločilnik)', () => {
  it('ponedeljek → true', () => {
    expect(isWeekStart('2026-09-14')).toBe(true) // pon
    expect(isWeekStart('2026-09-21')).toBe(true)
  })

  it('ostali dnevi → false', () => {
    expect(isWeekStart('2026-09-19')).toBe(false) // sob
    expect(isWeekStart('2026-09-20')).toBe(false) // ned
    expect(isWeekStart('2026-09-18')).toBe(false) // pet
  })

  it('neveljaven vhod → false (fail-safe, polni range-check)', () => {
    expect(isWeekStart('')).toBe(false)
    expect(isWeekStart('ni-datum')).toBe(false)
    expect(isWeekStart('2026-13-99')).toBe(false)
    expect(isWeekStart('2026-02-30')).toBe(false) // 30. feb NE obstaja — Date.UTC bi ga tiho normaliziral na 1. mar (pon) → round-trip check to ujame
    expect(isWeekStart('2026-02-29')).toBe(false) // 2026 ni prestopno leto
  })
})

describe('computeDigestTrend — oznake gostota (R72)', () => {
  // lokalen dnevni vzorec (DAYS v zgornjem describe ni v obsegu)
  const DAYS7 = [
    { date: '2026-09-14', revenue: 1000, ordersCount: 10 }, // pon
    { date: '2026-09-15', revenue: 2000, ordersCount: 20 },
    { date: '2026-09-16', revenue: 1500, ordersCount: 15 },
    { date: '2026-09-17', revenue: 3000, ordersCount: 30 },
    { date: '2026-09-18', revenue: 500, ordersCount: 5 },
    { date: '2026-09-19', revenue: 2500, ordersCount: 25 },
    { date: '2026-09-20', revenue: 2000, ordersCount: 18 },
  ]

  it('7 dni (≤ prag) → VSE točke showLabel=true', () => {
    const t = computeDigestTrend(DAYS7)
    expect(t.points.every(p => p.showLabel)).toBe(true)
  })

  it('točke nosijo isWeekStart (PON detekcija na vsaki točki)', () => {
    const t = computeDigestTrend(DAYS7) // 14.9.(pon) … 20.9.(ned)
    expect(t.points[0].isWeekStart).toBe(true) // pon 14.
    expect(t.points[5].isWeekStart).toBe(false) // sob 19.
    expect(t.points[6].isWeekStart).toBe(false) // ned 20.
  })

  it('30 dni (> prag) → redke oznake: vsak 5. + zadnji + najboljši', () => {
    // 30 dni: 22.8.–20.9.2026; najboljši = 5.9. (rev 9000)
    const days30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 22 + i))
      const iso = d.toISOString().slice(0, 10)
      return { date: iso, revenue: i === 14 ? 9000 : 1000 + i * 10, ordersCount: 10 }
    })
    const t = computeDigestTrend(days30, 30)
    expect(t.dayCount).toBe(30)
    const labeled = t.points.filter(p => p.showLabel)
    // vsak 5. (i%5===4 → 4,9,14,19,24,29 = 6); zadnji (29) in najboljši (14,
    // 14%5===4) sta že v množici → točno 6 unikatnih
    expect(t.points[4].showLabel).toBe(true)
    expect(t.points[9].showLabel).toBe(true)
    expect(t.points[29].showLabel).toBe(true) // zadnji
    expect(t.points[14].showLabel).toBe(true) // najboljši
    expect(t.points[0].showLabel).toBe(false)
    expect(t.points[1].showLabel).toBe(false)
    expect(labeled.length).toBe(6)
  })

  it('14 dni (= prag) → VSE oznake; 15 dni (> prag) → redke', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({
      date: new Date(Date.UTC(2026, 7, 10 + i)).toISOString().slice(0, 10),
      revenue: 1000, ordersCount: 5,
    }))
    expect(computeDigestTrend(mk(14), 14).points.every(p => p.showLabel)).toBe(true)
    const t15 = computeDigestTrend(mk(15), 15)
    expect(t15.points.some(p => !p.showLabel)).toBe(true)
    expect(t15.points[14].showLabel).toBe(true) // zadnji VEDNO
  })

  it('30-dnevni trend: višine in povprečje ostanejo pravilne (skaliranje neodvisno od gostote)', () => {
    const days30 = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 7, 22 + i)).toISOString().slice(0, 10),
      revenue: i === 14 ? 9000 : 1000, ordersCount: 10,
    }))
    const t = computeDigestTrend(days30, 30)
    expect(t.total).toBe(29 * 1000 + 9000)
    expect(t.bestDate).toBe(days30[14].date)
    const best = t.points.find(p => p.isBest)!
    expect(best.heightPct).toBe(100)
    // vsi ostali (rev 1000) → 1000/9000 = 11.1% → min 2% prag ne smeta spremenit
    expect(t.points[0].heightPct).toBeCloseTo((1000 / 9000) * 100, 1)
  })
})

// ============================================
// R73: primerjava z predhodnim obdobjem
// ============================================

describe('computeTrendComparison (R73)', () => {
  it('rast: 125 vs 100 → +25 %, direction up', () => {
    const c = computeTrendComparison(125, 100)
    expect(c.prevTotal).toBe(100)
    expect(c.deltaPct).toBe(25)
    expect(c.direction).toBe('up')
  })

  it('padec: 50 vs 100 → −50 %, direction down', () => {
    const c = computeTrendComparison(50, 100)
    expect(c.deltaPct).toBe(-50)
    expect(c.direction).toBe('down')
  })

  it('izenačeno (< 0.05 % razlike) → flat', () => {
    const c = computeTrendComparison(100.04, 100)
    expect(c.deltaPct).toBe(0)
    expect(c.direction).toBe('flat')
  })

  it('brez podlage: prevTotal 0 → deltaPct null (UI čip skrit)', () => {
    const c = computeTrendComparison(500, 0)
    expect(c.prevTotal).toBe(0)
    expect(c.deltaPct).toBeNull()
    expect(c.direction).toBe('flat')
  })

  it('trenutno 0 vs predhodnega 100 → −100 % (polni padec)', () => {
    const c = computeTrendComparison(0, 100)
    expect(c.deltaPct).toBe(-100)
    expect(c.direction).toBe('down')
  })

  it('fail-safe: NaN/Infinity/negativno → 0 (kot povsod v lib)', () => {
    expect(computeTrendComparison(NaN, 100).deltaPct).toBe(-100) // NaN cur → 0
    expect(computeTrendComparison(100, NaN).deltaPct).toBeNull() // NaN prev → brez podlage
    expect(computeTrendComparison(100, Infinity).deltaPct).toBeNull()
    expect(computeTrendComparison(-5, 100).deltaPct).toBe(-100) // negativen cur → 0
    expect(computeTrendComparison(100, -5).prevTotal).toBe(0)
  })

  it('zaokroževanje na 1 decimalko (0.1 % ločljivost)', () => {
    // 111 vs 90 = +23.333... % → +23.3
    expect(computeTrendComparison(111, 90).deltaPct).toBe(23.3)
    // 105 vs 104 = +0.96...% → +1 (1 decimalna)
    expect(computeTrendComparison(105, 104).deltaPct).toBe(1)
  })
})
