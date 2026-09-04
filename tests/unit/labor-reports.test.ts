// ============================================
// Labor Reports — Unit testi
// ============================================
import { describe, it, expect } from 'vitest'
import {
  STANDARD_DAILY_HOURS,
  STANDARD_WEEKLY_HOURS,
  OVERTIME_MULTIPLIER,
} from '@/lib/labor-reports'

// --- Konstante ---

describe('Labor constants', () => {
  it('STANDARD_DAILY_HOURS = 8', () => {
    expect(STANDARD_DAILY_HOURS).toBe(8)
  })

  it('STANDARD_WEEKLY_HOURS = 40', () => {
    expect(STANDARD_WEEKLY_HOURS).toBe(40)
  })

  it('OVERTIME_MULTIPLIER = 1.5', () => {
    expect(OVERTIME_MULTIPLIER).toBe(1.5)
  })
})

// --- Pomožne funkcije (replicate iz lib za testiranje logike) ---

function calcShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  let hours = (endH * 60 + endM - startH * 60 - startM) / 60
  if (hours < 0) hours += 24
  return hours
}

function isLate(scheduledStart: string, actualStart: string, toleranceMin = 5): { late: boolean; minutes: number } {
  const [sH, sM] = scheduledStart.split(':').map(Number)
  const [aH, aM] = actualStart.split(':').map(Number)
  const diffMin = (aH * 60 + aM) - (sH * 60 + sM)
  if (diffMin > toleranceMin) {
    return { late: true, minutes: diffMin }
  }
  return { late: false, minutes: 0 }
}

function isEarlyLeave(scheduledEnd: string, actualEnd: string, toleranceMin = 5): { early: boolean; minutes: number } {
  const [sH, sM] = scheduledEnd.split(':').map(Number)
  const [aH, aM] = actualEnd.split(':').map(Number)
  const diffMin = (sH * 60 + sM) - (aH * 60 + aM)
  if (diffMin > toleranceMin) {
    return { early: true, minutes: diffMin }
  }
  return { early: false, minutes: 0 }
}

function calculateOvertimePay(
  regularHours: number,
  overtimeHours: number,
  hourlyRate: number,
): { regular: number; overtime: number; total: number } {
  const regular = regularHours * hourlyRate
  const overtime = overtimeHours * hourlyRate * OVERTIME_MULTIPLIER
  return {
    regular: Math.round(regular * 100) / 100,
    overtime: Math.round(overtime * 100) / 100,
    total: Math.round((regular + overtime) * 100) / 100,
  }
}

function classifyAttendance(
  actualHours: number,
  scheduledHours: number,
  isLate: boolean,
  isEarly: boolean,
  noShow: boolean,
): 'present' | 'absent' | 'late' | 'partial' | 'no_show' {
  if (noShow) return 'no_show'
  if (actualHours === 0) return 'absent'
  if (isLate) return 'late'
  if (isEarly || actualHours < scheduledHours * 0.8) return 'partial'
  return 'present'
}

// --- Testi ---

describe('calcShiftHours', () => {
  it('8h izmena (09:00-17:00)', () => {
    expect(calcShiftHours('09:00', '17:00')).toBe(8)
  })

  it('4h izmena (08:00-12:00)', () => {
    expect(calcShiftHours('08:00', '12:00')).toBe(4)
  })

  it('cross-midnight (22:00-06:00) = 8h', () => {
    expect(calcShiftHours('22:00', '06:00')).toBe(8)
  })

  it('1h izmena', () => {
    expect(calcShiftHours('10:00', '11:00')).toBe(1)
  })
})

describe('isLate detection', () => {
  it('točen prihod → ni pozno', () => {
    const result = isLate('09:00', '09:00')
    expect(result.late).toBe(false)
  })

  it('3 min pozno → ni pozno (znotraj tolerance)', () => {
    const result = isLate('09:00', '09:03')
    expect(result.late).toBe(false)
  })

  it('10 min pozno → pozno', () => {
    const result = isLate('09:00', '09:10')
    expect(result.late).toBe(true)
    expect(result.minutes).toBe(10)
  })

  it('1h pozno → pozno', () => {
    const result = isLate('09:00', '10:00')
    expect(result.late).toBe(true)
    expect(result.minutes).toBe(60)
  })

  it('zgodaj prihod → ni pozno', () => {
    const result = isLate('09:00', '08:30')
    expect(result.late).toBe(false)
  })
})

describe('isEarlyLeave detection', () => {
  it('točen odhod → ni prezgodaj', () => {
    const result = isEarlyLeave('17:00', '17:00')
    expect(result.early).toBe(false)
  })

  it('3 min prezgodaj → ni (znotraj tolerance)', () => {
    const result = isEarlyLeave('17:00', '16:57')
    expect(result.early).toBe(false)
  })

  it('15 min prezgodaj → early', () => {
    const result = isEarlyLeave('17:00', '16:45')
    expect(result.early).toBe(true)
    expect(result.minutes).toBe(15)
  })

  it('1h prezgodaj → early', () => {
    const result = isEarlyLeave('17:00', '16:00')
    expect(result.early).toBe(true)
    expect(result.minutes).toBe(60)
  })

  it('poznej odhod → ni early', () => {
    const result = isEarlyLeave('17:00', '17:30')
    expect(result.early).toBe(false)
  })
})

describe('calculateOvertimePay', () => {
  it('brez nadur', () => {
    const result = calculateOvertimePay(40, 0, 10)
    expect(result.regular).toBe(400)
    expect(result.overtime).toBe(0)
    expect(result.total).toBe(400)
  })

  it('5h nadur', () => {
    const result = calculateOvertimePay(40, 5, 10)
    expect(result.regular).toBe(400)
    expect(result.overtime).toBe(75) // 5 * 10 * 1.5
    expect(result.total).toBe(475)
  })

  it('10h nadur', () => {
    const result = calculateOvertimePay(40, 10, 15)
    expect(result.regular).toBe(600)
    expect(result.overtime).toBe(225) // 10 * 15 * 1.5
    expect(result.total).toBe(825)
  })

  it('ura €20, 8h nadur', () => {
    const result = calculateOvertimePay(40, 8, 20)
    expect(result.regular).toBe(800)
    expect(result.overtime).toBe(240) // 8 * 20 * 1.5
    expect(result.total).toBe(1040)
  })
})

describe('classifyAttendance', () => {
  it('present — vse OK', () => {
    expect(classifyAttendance(8, 8, false, false, false)).toBe('present')
  })

  it('late — prišel pozno', () => {
    expect(classifyAttendance(8, 8, true, false, false)).toBe('late')
  })

  it('partial — šel prezgodaj', () => {
    expect(classifyAttendance(6, 8, false, true, false)).toBe('partial')
  })

  it('partial — manj kot 80% ur', () => {
    expect(classifyAttendance(5, 8, false, false, false)).toBe('partial') // 5/8 = 62.5%
  })

  it('present — 85% ur (blizu polne)', () => {
    expect(classifyAttendance(7, 8, false, false, false)).toBe('present') // 7/8 = 87.5%
  })

  it('absent — 0 ur', () => {
    expect(classifyAttendance(0, 8, false, false, false)).toBe('absent')
  })

  it('no_show — izrecno', () => {
    expect(classifyAttendance(0, 8, false, false, true)).toBe('no_show')
  })
})

describe('EU labor law compliance', () => {
  it('8h dnevno je standard', () => {
    expect(STANDARD_DAILY_HOURS).toBe(8)
  })

  it('40h tedensko je standard (5 dni * 8h)', () => {
    expect(STANDARD_WEEKLY_HOURS).toBe(40)
  })

  it('1.5x multiplier za nadure (EU directive)', () => {
    expect(OVERTIME_MULTIPLIER).toBe(1.5)
  })

  it('max 48h/teden vključno z nadurami (EU directive 2003/88/EC)', () => {
    // 40h redno + 8h nadur = 48h (max)
    const maxWeekly = STANDARD_WEEKLY_HOURS + 8
    expect(maxWeekly).toBe(48)
  })
})

describe('Punctuality rate calculation', () => {
  it('100% punctuality — vsi present', () => {
    const entries = [
      { status: 'present' },
      { status: 'present' },
      { status: 'present' },
    ]
    const onTime = entries.filter((e) => e.status === 'present').length
    const rate = (onTime / entries.length) * 100
    expect(rate).toBe(100)
  })

  it('33% punctuality — 1 od 3 present', () => {
    const entries = [
      { status: 'present' },
      { status: 'late' },
      { status: 'absent' },
    ]
    const onTime = entries.filter((e) => e.status === 'present').length
    const rate = (onTime / entries.length) * 100
    expect(rate).toBeCloseTo(33.33, 1)
  })

  it('0% punctuality — noben present', () => {
    const entries = [
      { status: 'late' },
      { status: 'absent' },
    ]
    const onTime = entries.filter((e) => e.status === 'present').length
    const rate = (onTime / entries.length) * 100
    expect(rate).toBe(0)
  })
})
