import { describe, expect, it } from 'vitest'
import {
  countDangerOrders,
  shouldRemind,
  KDS_REMINDER_INTERVAL_MS,
  KDS_DANGER_MINUTES,
} from '@/lib/kds-reminder'

// Runda 64: KDS opomnik nevarne cone — čista logika (hook je tanek ovoj)

describe('countDangerOrders', () => {
  it('šteje samo elapsed ≥ 25 min (ista meja kot rdeča kartica)', () => {
    expect(countDangerOrders([0, 5, 24, 25, 30, 90])).toBe(3)
    expect(countDangerOrders([0, 5, 24])).toBe(0)
  })

  it('prazen seznam → 0; negativni (prihodnji firedAt) ne štejejo', () => {
    expect(countDangerOrders([])).toBe(0)
    expect(countDangerOrders([-5, -1])).toBe(0)
  })

  it('prag je konfigurabilen (privzeto 25)', () => {
    expect(countDangerOrders([9, 10, 11], 10)).toBe(2)
    expect(KDS_DANGER_MINUTES).toBe(25)
  })
})

describe('shouldRemind', () => {
  const T = 1_700_000_000_000

  it('prvi pregled z naročilom v nevarni coni → TAKOJ opomni', () => {
    expect(shouldRemind(T, 0, 2, true)).toBe(true)
  })

  it('interval še ni minil → ne opomni (59_999 ms < 60_000)', () => {
    expect(shouldRemind(T, T - KDS_REMINDER_INTERVAL_MS + 1, 2, true)).toBe(false)
    expect(shouldRemind(T, T - KDS_REMINDER_INTERVAL_MS, 2, true)).toBe(true)
  })

  it('brez naročil v nevarni coni ali utišan zvok → nikoli', () => {
    expect(shouldRemind(T, 0, 0, true)).toBe(false)
    expect(shouldRemind(T, 0, 3, false)).toBe(false)
  })
})
