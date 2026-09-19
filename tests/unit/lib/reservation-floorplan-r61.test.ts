import { describe, it, expect } from 'vitest'
import { diffFloorStatuses, relativeTimeSl } from '@/lib/reservation-floorplan'
import type { FloorStatus } from '@/lib/reservation-floorplan'

// RUNDA 61: ŽIVI TLORIS — detekcija sprememb statusa (utrip) + relativni čas
describe('diffFloorStatuses', () => {
  it('vrne prazen seznam, če se nič ni spremenilo', () => {
    const prev = new Map<string, FloorStatus>([
      ['t1', 'available'],
      ['t2', 'reserved'],
      ['t3', 'occupied'],
    ])
    const next = new Map(prev)
    expect(diffFloorStatuses(prev, next)).toEqual([])
  })

  it(' zazna prehod pri obstoječi mizi (available → occupied)', () => {
    const prev = new Map<string, FloorStatus>([
      ['t1', 'available'],
      ['t2', 'reserved'],
    ])
    const next = new Map<string, FloorStatus>([
      ['t1', 'occupied'],
      ['t2', 'reserved'],
    ])
    expect(diffFloorStatuses(prev, next)).toEqual(['t1'])
  })

  it('vrne vse spremenjene mize (več prehodov hkrati)', () => {
    const prev = new Map<string, FloorStatus>([
      ['t1', 'available'],
      ['t2', 'reserved'],
      ['t3', 'occupied'],
    ])
    const next = new Map<string, FloorStatus>([
      ['t1', 'reserved'],
      ['t2', 'available'],
      ['t3', 'available'],
    ])
    const changed = diffFloorStatuses(prev, next)
    expect(changed).toHaveLength(3)
    expect(changed).toEqual(expect.arrayContaining(['t1', 't2', 't3']))
  })

  it('NOVA miza (samo v next) ne sproži utripa', () => {
    const prev = new Map<string, FloorStatus>([['t1', 'available']])
    const next = new Map<string, FloorStatus>([
      ['t1', 'available'],
      ['t9', 'occupied'], // pravkar dodana
    ])
    expect(diffFloorStatuses(prev, next)).toEqual([])
  })

  it('IZBRISANA miza (samo v prev) ne sproži utripa', () => {
    const prev = new Map<string, FloorStatus>([
      ['t1', 'available'],
      ['t7', 'reserved'],
    ])
    const next = new Map<string, FloorStatus>([['t1', 'available']])
    expect(diffFloorStatuses(prev, next)).toEqual([])
  })

  it('prvi pregled (prazen prev) ne utripa — vsi statusi so "novi"', () => {
    const next = new Map<string, FloorStatus>([
      ['t1', 'occupied'],
      ['t2', 'reserved'],
    ])
    expect(diffFloorStatuses(new Map(), next)).toEqual([])
  })
})

describe('relativeTimeSl', () => {
  it('zelo sveže vrednosti → "pravkar" (< 10 s)', () => {
    expect(relativeTimeSl(0)).toBe('pravkar')
    expect(relativeTimeSl(5)).toBe('pravkar')
    expect(relativeTimeSl(9)).toBe('pravkar')
  })

  it('sekunde v obliki "pred N s" (10–59 s)', () => {
    expect(relativeTimeSl(10)).toBe('pred 10 s')
    expect(relativeTimeSl(25)).toBe('pred 25 s')
    expect(relativeTimeSl(59)).toBe('pred 59 s')
  })

  it('minute v obliki "pred N min" (1–59 min)', () => {
    expect(relativeTimeSl(60)).toBe('pred 1 min')
    expect(relativeTimeSl(90)).toBe('pred 1 min')
    expect(relativeTimeSl(185)).toBe('pred 3 min')
    expect(relativeTimeSl(3540)).toBe('pred 59 min')
  })

  it('ure v obliki "pred N h" (≥ 1 h)', () => {
    expect(relativeTimeSl(3600)).toBe('pred 1 h')
    expect(relativeTimeSl(7200)).toBe('pred 2 h')
    expect(relativeTimeSl(10800)).toBe('pred 3 h')
  })

  it('neštevilske/negativne vrednosti varno → "pravkar"', () => {
    expect(relativeTimeSl(NaN)).toBe('pravkar')
    expect(relativeTimeSl(-5)).toBe('pravkar')
    expect(relativeTimeSl(Infinity)).toBe('pravkar')
  })
})
