// ============================================
// AI STAFF SCHEDULER ENGINE
// ============================================
// Generates optimal staff schedule based on:
//   1. Forecasted demand (from historical orders, day-of-week patterns)
//   2. Employee availability (StaffAvailability table)
//   3. Employee roles/jobs (EmployeeJob table)
//   4. Labor law constraints (EU/SI):
//      - Max 48h/week (default 40h)
//      - Min 11h rest between shifts
//      - Min 1 day off per week
//      - Max 6 consecutive working days
//   5. Existing shifts (don't overwrite)
//
// Po raziskavi 2025 zmanjša stroške dela za 10-15% z AI scheduling.
// ============================================

import { toNum, round2 } from '@/lib/decimal'

// --- Konstante (EU/SI labor law) ---
export const LABOR_CONSTRAINTS = {
  MAX_HOURS_PER_WEEK: 48, // EU directive 2003/88/EC
  DEFAULT_HOURS_PER_WEEK: 40, // SI standard
  MIN_REST_BETWEEN_SHIFTS_HOURS: 11, // EU minimum
  MIN_DAYS_OFF_PER_WEEK: 1,
  MAX_CONSECUTIVE_WORKING_DAYS: 6,
  MAX_SHIFT_HOURS: 10, // Single shift cap
  BREAK_THRESHOLD_HOURS: 6, // >6h → break required
  DEFAULT_BREAK_MINUTES: 30,
} as const

// --- Shift templates ---
// Tipični izmeni v restavraciji
export const SHIFT_TEMPLATES = {
  morning: { start: '07:00', end: '15:00', role_priority: ['chef', 'prep', 'manager', 'server'] },
  afternoon: { start: '11:00', end: '19:00', role_priority: ['server', 'bartender', 'host', 'chef'] },
  evening: { start: '15:00', end: '23:00', role_priority: ['server', 'bartender', 'chef', 'dishwasher'] },
  night: { start: '19:00', end: '03:00', role_priority: ['bartender', 'server', 'chef', 'dishwasher'] },
} as const

export type ShiftType = keyof typeof SHIFT_TEMPLATES

// --- Tipi ---
export interface SchedulerInput {
  startDate: string // ISO date (YYYY-MM-DD)
  days: number // Koliko dni naprej (1-14)
  locationId?: string
  dryRun?: boolean // default true — ne shrani v DB
  apply?: boolean // true = shrani v DB (override dryRun)
}

export interface ForecastedDay {
  date: string
  dayOfWeek: number // 0=nedelja ... 6=sobota
  expectedRevenue: number
  expectedOrders: number
  busyLevel: 'low' | 'medium' | 'high' | 'peak' // določa št. potrebnih zaposlenih
}

export interface GeneratedShift {
  date: string
  shiftType: ShiftType
  startTime: string
  endTime: string
  employeeId: string
  employeeName: string
  role: string
  hours: number
  breakMinutes: number
  locationId?: string
  // Metadata
  reasons: string[] // Zakaj ta delavec?
  warnings: string[] // Morebitne težave
}

export interface SchedulerResult {
  generated: GeneratedShift[]
  coverage: Array<{
    date: string
    shiftType: ShiftType
    required: number
    assigned: number
    gap: number
  }>
  insights: {
    totalShifts: number
    totalHours: number
    totalLaborCost: number
    employeesUsed: number
    coverageGaps: number
    conflicts: string[]
    recommendations: string[]
  }
  dryRun: boolean
}

// --- Pomožne funkcije ---

// Pretvori HH:mm v minute
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Izračunaj ure izmena
export function calcShiftHours(start: string, end: string): number {
  let mins = timeToMinutes(end) - timeToMinutes(start)
  if (mins < 0) mins += 24 * 60 // cross-midnight
  return round2(mins / 60)
}

// Preveri prekrivanje
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = timeToMinutes(aStart)
  let aE = timeToMinutes(aEnd)
  if (aE <= aS) aE += 24 * 60
  const bS = timeToMinutes(bStart)
  let bE = timeToMinutes(bEnd)
  if (bE <= bS) bE += 24 * 60
  return aS < bE && aE > bS
}

// Ali je zaposleni na voljo v danem oknu?
export function isEmployeeAvailable(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isPreferred: boolean }>,
): { available: boolean; preferred: boolean } {
  if (availability.length === 0) {
    // Brez podatkov o razpoložljivosti — privzamemo, da je na voljo (preferred=false)
    return { available: true, preferred: false }
  }

  const dayAvail = availability.filter((a) => a.dayOfWeek === dayOfWeek)
  if (dayAvail.length === 0) return { available: false, preferred: false }

  for (const slot of dayAvail) {
    if (overlaps(startTime, endTime, slot.startTime, slot.endTime)) {
      // Prekrivanje mora v celoti pokrivati zahtevano okno
      const slotStart = timeToMinutes(slot.startTime)
      const slotEnd = timeToMinutes(slot.endTime)
      const reqStart = timeToMinutes(startTime)
      const reqEnd = timeToMinutes(endTime)
      if (slotStart <= reqStart && slotEnd >= reqEnd) {
        return { available: true, preferred: slot.isPreferred }
      }
    }
  }
  return { available: false, preferred: false }
}

// Preveri ali je zaposleni na dopustu
export function isOnTimeOff(
  dateStr: string,
  timeOffRequests: Array<{ startDate: Date; endDate: Date; status: string }>,
): boolean {
  const date = new Date(dateStr)
  date.setHours(12, 0, 0, 0) // poldne — varna primerjava
  return timeOffRequests.some((tor) => {
    if (tor.status !== 'approved') return false
    const start = new Date(tor.startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(tor.endDate)
    end.setHours(23, 59, 59, 999)
    return date >= start && date <= end
  })
}

// Preveri minimalni počitek med izmenami (11h)
export function hasMinRest(
  dateStr: string,
  startTime: string,
  endTime: string,
  existingShifts: Array<{ shiftDate: Date; startTime: string; endTime: string }>,
): boolean {
  const newStart = new Date(`${dateStr}T${startTime}:00`)
  let newEnd = new Date(`${dateStr}T${endTime}:00`)
  if (newEnd <= newStart) newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000)

  for (const shift of existingShifts) {
    const shiftDateStr = new Date(shift.shiftDate).toISOString().split('T')[0]
    const exStart = new Date(`${shiftDateStr}T${shift.startTime}:00`)
    let exEnd = new Date(`${shiftDateStr}T${shift.endTime}:00`)
    if (exEnd <= exStart) exEnd = new Date(exEnd.getTime() + 24 * 60 * 60 * 1000)

    // Prejšnja izmena: exEnd → newStart mora biti >= 11h
    const restAfterEx = (newStart.getTime() - exEnd.getTime()) / (60 * 60 * 1000)
    if (restAfterEx >= 0 && restAfterEx < LABOR_CONSTRAINTS.MIN_REST_BETWEEN_SHIFTS_HOURS) {
      return false
    }
    // Naslednja izmena: newEnd → exStart mora biti >= 11h
    const restBeforeEx = (exStart.getTime() - newEnd.getTime()) / (60 * 60 * 1000)
    if (restBeforeEx >= 0 && restBeforeEx < LABOR_CONSTRAINTS.MIN_REST_BETWEEN_SHIFTS_HOURS) {
      return false
    }
  }
  return true
}

// Določi busy level glede na pričakovani promet
export function classifyBusyLevel(revenue: number, orders: number): ForecastedDay['busyLevel'] {
  // Hevristika: <500€ low, 500-1500€ medium, 1500-3000€ high, >3000€ peak
  if (revenue > 3000 || orders > 100) return 'peak'
  if (revenue > 1500 || orders > 50) return 'high'
  if (revenue > 500 || orders > 20) return 'medium'
  return 'low'
}

// Določi št. potrebnih zaposlenih glede na busy level in shift type
export function requiredStaffPerShift(busy: ForecastedDay['busyLevel'], shiftType: ShiftType): number {
  const matrix: Record<ForecastedDay['busyLevel'], Record<ShiftType, number>> = {
    low: { morning: 2, afternoon: 2, evening: 2, night: 1 },
    medium: { morning: 3, afternoon: 3, evening: 4, night: 2 },
    high: { morning: 4, afternoon: 4, evening: 5, night: 3 },
    peak: { morning: 5, afternoon: 5, evening: 6, night: 4 },
  }
  return matrix[busy][shiftType]
}

// Izračunaj tedenske ure zaposlenega
export function weeklyHours(
  employeeId: string,
  existingShifts: GeneratedShift[],
  dateStr: string,
): number {
  // Najdi začetek tedna (ponedelnjek)
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // 0=nedelja → -6
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  const nextSunday = new Date(monday)
  nextSunday.setDate(monday.getDate() + 7)

  return existingShifts
    .filter((s) => {
      if (s.employeeId !== employeeId) return false
      const sDate = new Date(s.date)
      return sDate >= monday && sDate < nextSunday
    })
    .reduce((sum, s) => sum + s.hours, 0)
}

// Šteje zaporedne delovne dneve
export function consecutiveWorkingDays(
  employeeId: string,
  generated: GeneratedShift[],
  dateStr: string,
): number {
  const date = new Date(dateStr)
  let count = 1 // ta dan
  // Preveri prejšnje dni
  for (let i = 1; i <= 7; i++) {
    const prev = new Date(date)
    prev.setDate(date.getDate() - i)
    const prevStr = prev.toISOString().split('T')[0]
    const hasShift = generated.some((s) => s.employeeId === employeeId && s.date === prevStr)
    if (hasShift) count++
    else break
  }
  return count
}
