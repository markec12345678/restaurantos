// ============================================
// DIGEST HOURS — Unit testi (R76: "Promet po urah")
//
// Preverjamo:
// - computeHourlyDistribution: vedrčenje po lokalnih urah, 24 polnih vedrov,
//   fail-safe (Decimal/string/null totali, neveljavni datumi), vrh (izenačeni
//   → najzgodnejša), višine %, oznake (vsaka 3. + vrh)
// - summarizeHourly: vrh, zasedenost, najboljše zvezno okno, prazni vhodi
// ============================================

import { describe, it, expect } from 'vitest'

import {
  computeHourlyDistribution,
  summarizeHourly,
  HOURLY_LABEL_STRIDE,
  BUSY_WINDOW_HOURS,
  type HourlyPoint,
} from '@/lib/digest-hours'

/** Deterministični Date za testi (lokalna cona — enako kot getHours bere). */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 17, hour, minute, 0)
}

describe('computeHourlyDistribution — vedrčenje', () => {
  it('vrne točno 24 točk (vedno polni urnik), ure 0–23', () => {
    const pts = computeHourlyDistribution([{ total: 10, createdAt: at(12) }])
    expect(pts).toHaveLength(24)
    expect(pts.map(p => p.hour)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])
  })

  it('razporedi naročila v pravo lokalno uro in sešteje promet + število', () => {
    const pts = computeHourlyDistribution([
      { total: 25.5, createdAt: at(12) },
      { total: 14.5, createdAt: at(12, 45) },
      { total: 100, createdAt: at(19) },
    ])
    expect(pts[12]).toMatchObject({ hour: 12, revenue: 40, orders: 2 })
    expect(pts[19]).toMatchObject({ hour: 19, revenue: 100, orders: 1 })
    expect(pts[11].orders).toBe(0)
    expect(pts[20].revenue).toBe(0)
  })

  it('sprejme Decimal-kot-string totale (Prisma vzorec)', () => {
    const pts = computeHourlyDistribution([{ total: '33.25', createdAt: at(9) }])
    expect(pts[9].revenue).toBeCloseTo(33.25, 2)
  })

  it('fail-safe: null/undefined/NaN/negativni totali → 0, vrstica ŠE VEDNO šteje naročilo', () => {
    const pts = computeHourlyDistribution([
      { total: null, createdAt: at(8) },
      { total: 'ne-stevilka', createdAt: at(8) },
      { total: -5, createdAt: at(8) },
      { total: 7, createdAt: at(8) },
    ])
    expect(pts[8]).toMatchObject({ revenue: 7, orders: 4 })
  })

  it('neveljavni datumi vrstico preskočijo (Invalid Date, date-only niz, število)', () => {
    const pts = computeHourlyDistribution([
      { total: 10, createdAt: new Date(NaN) },
      { total: 10, createdAt: '2026-09-17' }, // date-only — zavrnjen (R72 lekcija)
      { total: 10, createdAt: 'poljuben niz' },
      { total: 10, createdAt: 123 as unknown as Date },
      { total: 10, createdAt: at(15) },
    ])
    expect(pts[15]).toMatchObject({ revenue: 10, orders: 1 })
    expect(pts.reduce((s, p) => s + p.orders, 0)).toBe(1)
  })

  it('časovni žig niz z T se razporedi po lokalni uri', () => {
    // brez Z → lokalna razčlemitev (specifikacija) → 10. ura
    const pts = computeHourlyDistribution([{ total: 5, createdAt: '2026-09-17T10:30:00' }])
    expect(pts[10].orders).toBe(1)
  })

  it('prazen/neveljaven vhod → 24 praznih točk', () => {
    for (const rows of [[], undefined, null] as unknown as never[][]) {
      const pts = computeHourlyDistribution(rows as never)
      expect(pts).toHaveLength(24)
      expect(pts.every(p => p.revenue === 0 && p.orders === 0)).toBe(true)
    }
  })
})

describe('computeHourlyDistribution — vrh in višine', () => {
  it('vrh = najvišji promet; izenačeni → najzgodnejša ura zasede', () => {
    const pts = computeHourlyDistribution([
      { total: 50, createdAt: at(13) },
      { total: 50, createdAt: at(18) },
      { total: 10, createdAt: at(9) },
    ])
    expect(pts[13].isPeak).toBe(true)
    expect(pts[18].isPeak).toBe(false)
    expect(pts[9].isPeak).toBe(false)
  })

  it('dan brez prometa → brez vrha (isPeak nikjer), vse višine 0', () => {
    const pts = computeHourlyDistribution([])
    expect(pts.every(p => !p.isPeak)).toBe(true)
    expect(pts.every(p => p.heightPct === 0)).toBe(true)
  })

  it('višine so % relativno na vrh (min 2 % za pozitivne)', () => {
    const pts = computeHourlyDistribution([
      { total: 200, createdAt: at(12) },
      { total: 100, createdAt: at(13) },
      { total: 1, createdAt: at(14) },
    ])
    expect(pts[12].heightPct).toBe(100)
    expect(pts[13].heightPct).toBeCloseTo(50, 5)
    expect(pts[14].heightPct).toBe(2) // min vidnost
    expect(pts[15].heightPct).toBe(0)
  })
})

describe('computeHourlyDistribution — oznake', () => {
  it('showLabel: vsaka 3. ura (0, 3, … 21) + vrh', () => {
    const pts = computeHourlyDistribution([{ total: 10, createdAt: at(14) }])
    const labeled = pts.filter(p => p.showLabel).map(p => p.hour)
    expect(labeled).toContain(14) // vrh vedno
    for (let h = 0; h < 24; h += HOURLY_LABEL_STRIDE) expect(labeled).toContain(h)
    expect(labeled).not.toContain(1)
    expect(labeled).not.toContain(22)
  })

  it('vrh na že-označeni uri ne podvoji oznak', () => {
    const pts = computeHourlyDistribution([{ total: 10, createdAt: at(12) }]) // 12 % 3 === 0
    expect(pts.filter(p => p.showLabel).map(p => p.hour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
    expect(pts[12].isPeak).toBe(true)
  })
})

describe('summarizeHourly', () => {
  it('sešteje vrh, zasedenost in kontrolno vsoto', () => {
    const points: HourlyPoint[] = computeHourlyDistribution([
      { total: 30, createdAt: at(11) },
      { total: 120, createdAt: at(12) },
      { total: 90, createdAt: at(13) },
      { total: 60, createdAt: at(20) },
    ])
    const s = summarizeHourly(points)
    expect(s).not.toBeNull()
    expect(s!.peakHour).toBe(12)
    expect(s!.peakRevenue).toBeCloseTo(120, 2)
    expect(s!.activeHours).toBe(4)
    expect(s!.totalRevenue).toBeCloseTo(300, 2)
  })

  it('najboljše zvezno okno: 3 ure, najvišja vsota, izenačene → najzgodnejše', () => {
    const points = computeHourlyDistribution([
      { total: 10, createdAt: at(11) },
      { total: 100, createdAt: at(12) },
      { total: 100, createdAt: at(13) },
      { total: 100, createdAt: at(14) },
      { total: 50, createdAt: at(18) },
      { total: 125, createdAt: at(19) },
      { total: 125, createdAt: at(20) },
    ])
    const s = summarizeHourly(points)
    // okno 12–14 = 300 zmaga nad 18–20 = 300? ne — 300 > 300 je lažno;
    // 12–14: 100+100+100 = 300; 18–20: 50+125+125 = 300 → izenačeno → najzgodnejše (12)
    expect(s!.busyWindow).toEqual({ startHour: 12, endHour: 14, revenue: 300 })
  })

  it('okno pri koncu dneva (21–23) se upošteva, prelom 23→0 ne', () => {
    const points = computeHourlyDistribution([
      { total: 40, createdAt: at(21) },
      { total: 40, createdAt: at(22) },
      { total: 40, createdAt: at(23) },
      { total: 5, createdAt: at(12) },
    ])
    const s = summarizeHourly(points)
    expect(s!.busyWindow).toEqual({ startHour: 21, endHour: 23, revenue: 120 })
  })

  it('dan brez prometa → brez okna in brez vrha, activeHours 0', () => {
    const s = summarizeHourly(computeHourlyDistribution([]))
    expect(s).not.toBeNull()
    expect(s!.peakHour).toBeNull()
    expect(s!.busyWindow).toBeNull()
    expect(s!.activeHours).toBe(0)
  })

  it('prazen vnos → null (sekcija se skrije)', () => {
    expect(summarizeHourly([])).toBeNull()
    expect(summarizeHourly(undefined as unknown as HourlyPoint[])).toBeNull()
  })
})

describe('konstante', () => {
  it('HOURLY_LABEL_STRIDE = 3, BUSY_WINDOW_HOURS = 3', () => {
    expect(HOURLY_LABEL_STRIDE).toBe(3)
    expect(BUSY_WINDOW_HOURS).toBe(3)
  })
})
