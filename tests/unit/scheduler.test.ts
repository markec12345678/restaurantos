// ============================================
// AI Staff Scheduler — Unit testi
// ============================================
// Testira algoritmične funkcije (brez DB):
//   - calcShiftHours (vključno cross-midnight)
//   - isEmployeeAvailable
//   - isOnTimeOff
//   - hasMinRest (11h EU labor law)
//   - classifyBusyLevel
//   - requiredStaffPerShift
//   - weeklyHours
//   - consecutiveWorkingDays
// ============================================

import { describe, it, expect } from 'vitest'
import {
  calcShiftHours,
  isEmployeeAvailable,
  isOnTimeOff,
  hasMinRest,
  classifyBusyLevel,
  requiredStaffPerShift,
  weeklyHours,
  consecutiveWorkingDays,
  LABOR_CONSTRAINTS,
  type GeneratedShift,
} from '@/lib/scheduler'

describe('calcShiftHours', () => {
  it('isto-dnevna izmena', () => {
    expect(calcShiftHours('07:00', '15:00')).toBe(8)
    expect(calcShiftHours('11:00', '19:00')).toBe(8)
  })

  it('cross-midnight izmena (nočna)', () => {
    expect(calcShiftHours('19:00', '03:00')).toBe(8)
    expect(calcShiftHours('22:00', '06:00')).toBe(8)
  })

  it('1-urna izmena', () => {
    expect(calcShiftHours('12:00', '13:00')).toBe(1)
  })

  it('full day (redko)', () => {
    expect(calcShiftHours('00:00', '23:59')).toBeCloseTo(23.98, 1)
  })
})

describe('isEmployeeAvailable', () => {
  it('brez podatkov o razpoložljivosti → na voljo (ne preferirano)', () => {
    const result = isEmployeeAvailable(1, '07:00', '15:00', [])
    expect(result.available).toBe(true)
    expect(result.preferred).toBe(false)
  })

  it('popolno ujemanje z preferiranim oknom', () => {
    const avail = [{ dayOfWeek: 1, startTime: '07:00', endTime: '15:00', isPreferred: true }]
    const result = isEmployeeAvailable(1, '07:00', '15:00', avail)
    expect(result.available).toBe(true)
    expect(result.preferred).toBe(true)
  })

  it('delno prekrivanje — ne na voljo (izmena izven okna)', () => {
    const avail = [{ dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isPreferred: true }]
    const result = isEmployeeAvailable(1, '07:00', '15:00', avail)
    expect(result.available).toBe(false) // 07:00 pred 08:00 — ne pokriva
  })

  it('danes je na voljo ampak dan se ne ujema', () => {
    const avail = [{ dayOfWeek: 2, startTime: '07:00', endTime: '15:00', isPreferred: true }]
    const result = isEmployeeAvailable(1, '07:00', '15:00', avail)
    expect(result.available).toBe(false)
  })

  it('na voljo ampak ni preferirano (samo emergency)', () => {
    const avail = [{ dayOfWeek: 1, startTime: '07:00', endTime: '15:00', isPreferred: false }]
    const result = isEmployeeAvailable(1, '07:00', '15:00', avail)
    expect(result.available).toBe(true)
    expect(result.preferred).toBe(false)
  })
})

describe('isOnTimeOff', () => {
  const baseDate = '2026-09-15' // torek

  it('odobren dopust na isti dan', () => {
    const requests = [
      { startDate: new Date('2026-09-15'), endDate: new Date('2026-09-15'), status: 'approved' },
    ]
    expect(isOnTimeOff(baseDate, requests)).toBe(true)
  })

  it('odobren dopust v obdobju', () => {
    const requests = [
      { startDate: new Date('2026-09-10'), endDate: new Date('2026-09-20'), status: 'approved' },
    ]
    expect(isOnTimeOff(baseDate, requests)).toBe(true)
  })

  it('pending prošnja se ne šteje', () => {
    const requests = [
      { startDate: new Date('2026-09-10'), endDate: new Date('2026-09-20'), status: 'pending' },
    ]
    expect(isOnTimeOff(baseDate, requests)).toBe(false)
  })

  it('zavrnjena prošnja se ne šteje', () => {
    const requests = [
      { startDate: new Date('2026-09-10'), endDate: new Date('2026-09-20'), status: 'rejected' },
    ]
    expect(isOnTimeOff(baseDate, requests)).toBe(false)
  })

  it('datum izven obdobja dopusta', () => {
    const requests = [
      { startDate: new Date('2026-09-01'), endDate: new Date('2026-09-05'), status: 'approved' },
    ]
    expect(isOnTimeOff(baseDate, requests)).toBe(false)
  })
})

describe('hasMinRest — EU labor law 11h', () => {
  const dateStr = '2026-09-15'
  const newShiftStart = '15:00'
  const newShiftEnd = '23:00'

  it('brez obstoječih izmen → OK', () => {
    expect(hasMinRest(dateStr, newShiftStart, newShiftEnd, [])).toBe(true)
  })

  it('prejšnja izmena končana pred 11h → OK', () => {
    // Prejšnja: 07:00-15:00, nova: 15:00-23:00 → 0h počitka! NE OK
    // Popravimo: prejšnja 03:00-11:00, nova 15:00-23:00 → 4h počitka → NE OK
    // Prejšnja 00:00-04:00, nova 15:00-23:00 → 11h počitka → OK
    const existing = [
      { shiftDate: new Date(dateStr), startTime: '00:00', endTime: '04:00' },
    ]
    expect(hasMinRest(dateStr, newShiftStart, newShiftEnd, existing)).toBe(true)
  })

  it('prejšnja izmena premalo počitka < 11h → NE OK', () => {
    // Prejšnja: 07:00-15:00, nova: 15:00-23:00 → 0h počitka
    const existing = [
      { shiftDate: new Date(dateStr), startTime: '07:00', endTime: '15:00' },
    ]
    expect(hasMinRest(dateStr, newShiftStart, newShiftEnd, existing)).toBe(false)
  })

  it('prejšnji dan pozna izmena → premalo počitka', () => {
    // Včeraj: 19:00-03:00, danes: 07:00-15:00 → 3:00 do 7:00 = 4h počitka
    const yesterday = new Date(dateStr)
    yesterday.setDate(yesterday.getDate() - 1)
    const existing = [
      { shiftDate: yesterday, startTime: '19:00', endTime: '03:00' },
    ]
    expect(hasMinRest(dateStr, '07:00', '15:00', existing)).toBe(false)
  })

  it('prejšnji dan zgodnja izmena → dovolj počitka', () => {
    // Včeraj: 07:00-15:00, danes: 07:00-15:00 → 16h počitka
    const yesterday = new Date(dateStr)
    yesterday.setDate(yesterday.getDate() - 1)
    const existing = [
      { shiftDate: yesterday, startTime: '07:00', endTime: '15:00' },
    ]
    expect(hasMinRest(dateStr, '07:00', '15:00', existing)).toBe(true)
  })
})

describe('classifyBusyLevel', () => {
  it('low — majhen promet', () => {
    expect(classifyBusyLevel(200, 10)).toBe('low')
    expect(classifyBusyLevel(0, 0)).toBe('low')
  })

  it('medium — srednji promet', () => {
    expect(classifyBusyLevel(800, 25)).toBe('medium')
  })

  it('high — visok promet', () => {
    expect(classifyBusyLevel(2000, 60)).toBe('high')
  })

  it('peak — zelo visok promet', () => {
    expect(classifyBusyLevel(3500, 120)).toBe('peak')
  })

  it('peak tudi z veliko naročili nizke vrednosti', () => {
    expect(classifyBusyLevel(1500, 150)).toBe('peak')
  })
})

describe('requiredStaffPerShift', () => {
  it('low day potrebuje malo osebja', () => {
    expect(requiredStaffPerShift('low', 'morning')).toBe(2)
    expect(requiredStaffPerShift('low', 'night')).toBe(1)
  })

  it('peak day potrebuje veliko osebja', () => {
    expect(requiredStaffPerShift('peak', 'morning')).toBe(5)
    expect(requiredStaffPerShift('peak', 'evening')).toBe(6)
  })

  it('večer vedno >= jutro', () => {
    for (const level of ['low', 'medium', 'high', 'peak'] as const) {
      expect(requiredStaffPerShift(level, 'evening')).toBeGreaterThanOrEqual(
        requiredStaffPerShift(level, 'morning'),
      )
    }
  })
})

describe('weeklyHours', () => {
  // Ponedeljek 2026-09-14
  const monday = '2026-09-14'
  const tuesday = '2026-09-15'
  const sunday = '2026-09-13' // prejšnja nedelja, isti teden
  const lastSunday = '2026-09-20' // naslednja nedelja, isti teden

  const emp1 = 'emp-1'
  const emp2 = 'emp-2'

  it('brez izmen → 0h', () => {
    expect(weeklyHours(emp1, [], monday)).toBe(0)
  })

  it('ena izmena v tednu → 8h', () => {
    const shifts: GeneratedShift[] = [
      {
        date: monday, shiftType: 'morning', startTime: '07:00', endTime: '15:00',
        employeeId: emp1, employeeName: 'Test', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      },
    ]
    expect(weeklyHours(emp1, shifts, monday)).toBe(8)
  })

  it('samo drugi zaposleni → 0h za tega', () => {
    const shifts: GeneratedShift[] = [
      {
        date: monday, shiftType: 'morning', startTime: '07:00', endTime: '15:00',
        employeeId: emp2, employeeName: 'Other', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      },
    ]
    expect(weeklyHours(emp1, shifts, monday)).toBe(0)
  })

  it('več izmen v istem tednu', () => {
    const shifts: GeneratedShift[] = [
      {
        date: monday, shiftType: 'morning', startTime: '07:00', endTime: '15:00',
        employeeId: emp1, employeeName: 'Test', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      },
      {
        date: tuesday, shiftType: 'morning', startTime: '07:00', endTime: '15:00',
        employeeId: emp1, employeeName: 'Test', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      },
      {
        date: lastSunday, shiftType: 'evening', startTime: '15:00', endTime: '23:00',
        employeeId: emp1, employeeName: 'Test', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      },
    ]
    // Teden 14.-20. sep vse tri izmene
    expect(weeklyHours(emp1, shifts, monday)).toBe(24)
  })

  it('prejšnja nedelja se ne šteje', () => {
    const shifts: GeneratedShift[] = [
      {
        date: sunday, shiftType: 'morning', startTime: '07:00', endTime: '15:00',
        employeeId: emp1, employeeName: 'Test', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      },
    ]
    // Teden 14.-20. sep — prejšnja nedelja (13.) je v prejšnjem tednu
    expect(weeklyHours(emp1, shifts, monday)).toBe(0)
  })
})

describe('consecutiveWorkingDays', () => {
  const emp1 = 'emp-1'
  const baseDate = '2026-09-15' // torek

  it('brez prejšnjih izmen → 1 (ta dan)', () => {
    expect(consecutiveWorkingDays(emp1, [], baseDate)).toBe(1)
  })

  it('ena prejšnja izmena (včeraj) → 2', () => {
    const yesterday = new Date(baseDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const shifts: GeneratedShift[] = [
      {
        date: yesterday.toISOString().split('T')[0], shiftType: 'morning',
        startTime: '07:00', endTime: '15:00',
        employeeId: emp1, employeeName: 'Test', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      },
    ]
    expect(consecutiveWorkingDays(emp1, shifts, baseDate)).toBe(2)
  })

  it('3 zaporedne dni + ta dan = 4', () => {
    const date = new Date(baseDate)
    const shifts: GeneratedShift[] = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date(date)
      d.setDate(date.getDate() - i)
      shifts.push({
        date: d.toISOString().split('T')[0], shiftType: 'morning',
        startTime: '07:00', endTime: '15:00',
        employeeId: emp1, employeeName: 'Test', role: 'server',
        hours: 8, breakMinutes: 30, reasons: [], warnings: [],
      })
    }
    expect(consecutiveWorkingDays(emp1, shifts, baseDate)).toBe(4)
  })

  it('prekinitev v nizu — štejemo samo zaporedne', () => {
    const date = new Date(baseDate)
    const shifts: GeneratedShift[] = []
    // 1 dan prej
    const d1 = new Date(date); d1.setDate(date.getDate() - 1)
    shifts.push({
      date: d1.toISOString().split('T')[0], shiftType: 'morning',
      startTime: '07:00', endTime: '15:00',
      employeeId: emp1, employeeName: 'Test', role: 'server',
      hours: 8, breakMinutes: 30, reasons: [], warnings: [],
    })
    // 3 dni prej (preamor daleč)
    const d3 = new Date(date); d3.setDate(date.getDate() - 3)
    shifts.push({
      date: d3.toISOString().split('T')[0], shiftType: 'morning',
      startTime: '07:00', endTime: '15:00',
      employeeId: emp1, employeeName: 'Test', role: 'server',
      hours: 8, breakMinutes: 30, reasons: [], warnings: [],
    })
    // Pričakujemo 2 (včeraj + danes), prekine pri d3
    expect(consecutiveWorkingDays(emp1, shifts, baseDate)).toBe(2)
  })
})

describe('LABOR_CONSTRAINTS', () => {
  it('EU max 48h/week', () => {
    expect(LABOR_CONSTRAINTS.MAX_HOURS_PER_WEEK).toBe(48)
  })

  it('EU min 11h rest', () => {
    expect(LABOR_CONSTRAINTS.MIN_REST_BETWEEN_SHIFTS_HOURS).toBe(11)
  })

  it('EU min 1 day off/week', () => {
    expect(LABOR_CONSTRAINTS.MIN_DAYS_OFF_PER_WEEK).toBe(1)
  })

  it('EU max 6 consecutive working days', () => {
    expect(LABOR_CONSTRAINTS.MAX_CONSECUTIVE_WORKING_DAYS).toBe(6)
  })
})
