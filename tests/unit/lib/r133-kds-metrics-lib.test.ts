// ============================================
// R133 / EPIC #115 P1-09 — KDS METRIKE LIB (čista matematika)
// ============================================
// Testira '@/lib/kds/metrics' (brez db, pariteta r131-pack-size):
//   - percentiles: linearna interpolacija rank = p·(n−1), n=1, prazen → null
//   - prepMinutes: (readyAt − baseAt)/60_000, neg = 0 clamp, invalid → null
//   - computePrepStats: avg/median/p90, on-time INKLUSIVNA meja (elapsed ==
//     target = on-time), brez-target izključen iz onTimeRate ampak v count,
//     onTimeRate null če onTimeSample = 0
//   - resolveBaseAt: firedAt ?? createdAt (kanon #4 — legacy/sales tok brez
//     firedAt pade na createdAt)
//   - computeStationBreakdown: groupBy station, null → 'other', sort desc
// ============================================
import { describe, it, expect } from 'vitest'
import {
  prepMinutes,
  percentiles,
  computePrepStats,
  computeStationBreakdown,
  resolveBaseAt,
  round1,
  type KdsBumpedRow,
} from '@/lib/kds/metrics'

const T0 = new Date('2026-03-15T10:00:00.000Z')

function at(minutes: number): Date {
  return new Date(T0.getTime() + minutes * 60_000)
}

function row(minutesFromBase: number, targetMinutes: number | null, station: string | null = 'kitchen', orderId = 'ord-1'): KdsBumpedRow {
  return {
    readyAt: at(minutesFromBase),
    baseAt: T0,
    targetMinutes,
    station,
    orderId,
  }
}

// ============================================
// percentiles — linearna interpolacija
// ============================================
describe('R133 kds-metrics lib — percentiles', () => {
  it('točna interpolacija: [0..9] p90 → rank 8.1 → 8.1', () => {
    const sorted = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(percentiles(sorted, 0.9)).toBe(8.1)
  })

  it('median sodega n: [1,2,3,4] → rank 1.5 → 2.5', () => {
    expect(percentiles([1, 2, 3, 4], 0.5)).toBe(2.5)
  })

  it('median lihega n: točna vrednost srednjega elementa', () => {
    expect(percentiles([3, 1, 2].sort((a, b) => a - b), 0.5)).toBe(2)
  })

  it('n=1 → edini element (rank 0, brez lerp)', () => {
    expect(percentiles([7], 0.5)).toBe(7)
    expect(percentiles([7], 0.9)).toBe(7)
  })

  it('n=2: [10,20] p0.5 → 15 (sredina)', () => {
    expect(percentiles([10, 20], 0.5)).toBe(15)
  })

  it('prazen seznam → null (nikoli NaN)', () => {
    expect(percentiles([], 0.5)).toBeNull()
    expect(percentiles([], 0.9)).toBeNull()
  })

  it('ne-finite p → null (defenzivno)', () => {
    expect(percentiles([1, 2], NaN as unknown as 0.5)).toBeNull()
  })
})

// ============================================
// prepMinutes — clamp negativnih, invalid datumi
// ============================================
describe('R133 kds-metrics lib — prepMinutes', () => {
  it('pozitivna razlika: 5.5 min', () => {
    expect(prepMinutes({ readyAt: at(5.5), baseAt: T0 })).toBe(5.5)
  })

  it('ničelna razlika → 0', () => {
    expect(prepMinutes({ readyAt: T0, baseAt: T0 })).toBe(0)
  })

  it('negativna razlika (urni zamik: ready PRED base) → 0 clamp', () => {
    // readyAt 30 min PRED baseAt = napaka podatka (kanon #2) — nikoli negativne metrike
    expect(prepMinutes({ readyAt: at(-30), baseAt: T0 })).toBe(0)
  })

  it('neveljavni datumi → null (nikoli NaN v agregate)', () => {
    const invalid = new Date('not-a-date')
    expect(prepMinutes({ readyAt: invalid, baseAt: T0 })).toBeNull()
    expect(prepMinutes({ readyAt: T0, baseAt: invalid })).toBeNull()
  })
})

// ============================================
// resolveBaseAt — kanon #4 (firedAt ?? createdAt)
// ============================================
describe('R133 kds-metrics lib — resolveBaseAt (legacy/sales fallback)', () => {
  it('firedAt nastavljen → firedAt', () => {
    const fired = at(1)
    const created = at(5)
    expect(resolveBaseAt(fired, created)).toBe(fired)
  })

  it('firedAt null (sales tok / legacy) → createdAt fallback', () => {
    const created = at(5)
    expect(resolveBaseAt(null, created)).toBe(created)
    expect(resolveBaseAt(undefined, created)).toBe(created)
  })
})

// ============================================
// computePrepStats — avg/median/p90 + on-time inkluzivna meja
// ============================================
describe('R133 kds-metrics lib — computePrepStats', () => {
  it('avg/median/p90 + onTimeRate/lateCount/avgLateMinutes nad znanim vzorcem', () => {
    // minute: 4 (target 10, on-time), 8 (target 10, on-time), 12 (target 10, late 2),
    //         6 (brez tarče — v count, izključen iz onTimeRate)
    const rows = [row(4, 10), row(8, 10), row(12, 10), row(6, null)]
    const stats = computePrepStats(rows)
    expect(stats.count).toBe(4)
    expect(stats.avgMinutes).toBe(7.5) // (4+8+12+6)/4
    expect(stats.medianMinutes).toBe(7) // sorted [4,6,8,12] rank 1.5 → 6+0.5·2
    expect(stats.p90Minutes).toBe(10.8) // rank 2.7 → 8+0.7·4
    expect(stats.onTimeSample).toBe(3)
    expect(stats.onTimeRate).toBe(66.7) // 2/3 → 66.666… → 66.7 (round 1)
    expect(stats.lateCount).toBe(1)
    expect(stats.avgLateMinutes).toBe(2)
  })

  it('INKLUSIVNA meja: elapsed == target = on-time (lateCount 0, rate 100)', () => {
    const stats = computePrepStats([row(10, 10), row(9.9, 10)])
    expect(stats.onTimeSample).toBe(2)
    expect(stats.onTimeRate).toBe(100)
    expect(stats.lateCount).toBe(0)
    expect(stats.avgLateMinutes).toBeNull()
  })

  it('brez-tarčne vrstice: v count + avg/median/p90, IZKLJUČENE iz onTimeRate', () => {
    const stats = computePrepStats([row(5, null), row(15, null)])
    expect(stats.count).toBe(2)
    expect(stats.avgMinutes).toBe(10)
    expect(stats.onTimeSample).toBe(0)
    expect(stats.onTimeRate).toBeNull() // kanon #4: null, nikoli 0 ali izmišljen %
    expect(stats.lateCount).toBe(0)
    expect(stats.avgLateMinutes).toBeNull()
  })

  it('prazen vzorec → vse null, count 0', () => {
    const stats = computePrepStats([])
    expect(stats).toEqual({
      count: 0,
      avgMinutes: null,
      medianMinutes: null,
      p90Minutes: null,
      onTimeSample: 0,
      onTimeRate: null,
      lateCount: 0,
      avgLateMinutes: null,
    })
  })

  it('clamp negativnih v agregatu: [−5 → 0, 10] → avg 5', () => {
    const stats = computePrepStats([row(-5, 10), row(10, 10)])
    expect(stats.avgMinutes).toBe(5)
    expect(stats.onTimeSample).toBe(2)
    // clamp-ani 0 ≤ target 10 = on-time
    expect(stats.onTimeRate).toBe(100)
  })

  it('en element: avg = median = p90 = vrednost', () => {
    const stats = computePrepStats([row(6.2, 10)])
    expect(stats.avgMinutes).toBe(6.2)
    expect(stats.medianMinutes).toBe(6.2)
    expect(stats.p90Minutes).toBe(6.2)
    expect(stats.onTimeRate).toBe(100)
  })

  it('round 1 decimalka na izhodu (avg 7.333… → 7.3)', () => {
    const stats = computePrepStats([row(7, 10), row(7.5, 10), row(7.5, 10)])
    expect(stats.avgMinutes).toBe(7.3) // 22/3 = 7.333…
  })

  it('late samo nad tarčnim vzorcem (brez-tarčna 60 min ne napihne avgLate)', () => {
    const stats = computePrepStats([row(12, 10), row(60, null)])
    expect(stats.lateCount).toBe(1)
    expect(stats.avgLateMinutes).toBe(2)
  })
})

// ============================================
// computeStationBreakdown — groupBy, null→other, sort desc
// ============================================
describe('R133 kds-metrics lib — computeStationBreakdown', () => {
  it('groupBy station + null → "other" + sort po itemsBumped desc', () => {
    const rows = [
      row(4, 10, 'kitchen'),
      row(8, 10, 'kitchen'),
      row(30, 10, 'bar'), // late 20
      row(6, null, null), // brez postaje → 'other', brez tarče
    ]
    const breakdown = computeStationBreakdown(rows)
    expect(breakdown).toHaveLength(3)
    // sort: kitchen 2 prvi; bar/other 1 — vrstni red vstavljanja ohranjen (stabilen)
    expect(breakdown[0]).toEqual({ station: 'kitchen', itemsBumped: 2, avgMinutes: 6, onTimeRate: 100, lateCount: 0 })
    expect(breakdown[1].station).toBe('bar')
    expect(breakdown[1].itemsBumped).toBe(1)
    expect(breakdown[1].onTimeRate).toBe(0)
    expect(breakdown[1].lateCount).toBe(1)
    expect(breakdown[1].avgMinutes).toBe(30)
    expect(breakdown[2].station).toBe('other')
    expect(breakdown[2].itemsBumped).toBe(1)
    expect(breakdown[2].avgMinutes).toBe(6)
    expect(breakdown[2].onTimeRate).toBeNull() // brez tarče → null (nikoli 0)
  })

  it('prazen vzorec → prazen seznam', () => {
    expect(computeStationBreakdown([])).toEqual([])
  })

  it('stacija z največ bumpi je prva, tudi če je zadržana kasneje v seznamu', () => {
    const rows = [row(4, 10, 'bar'), row(2, 10, 'kitchen'), row(3, 10, 'kitchen')]
    const breakdown = computeStationBreakdown(rows)
    expect(breakdown.map(b => b.station)).toEqual(['kitchen', 'bar'])
  })
})

describe('R133 kds-metrics lib — round1', () => {
  it('round 1 decimalka', () => {
    expect(round1(7.33)).toBe(7.3)
    expect(round1(7.36)).toBe(7.4)
    expect(round1(66.66666)).toBe(66.7)
    expect(round1(0)).toBe(0)
  })
})
