// ============================================
// LABOR REPORTS — Scheduled vs Actual + Overtime
// ============================================
// PO SR vzoru - 8 specializiranih labor reportov.
// Mi implementiramo ključne:
//   1. scheduledVsActual — primerjaj načrtovane izmene z dejanskimi clock-in/out
//   2. overtimeAnalysis — analiza nadur (preko 8h/dan ali 40h/teden)
//   3. attendanceHistory — zgodovina prisotnosti
//   4. dailyLaborCost — dnevni strošek dela
//   5. payrollSummary — povzetek plač
// ============================================

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'

// --- Tipi ---
export interface ScheduledVsActualEntry {
  employeeId: string
  employeeName: string
  date: string
  // Scheduled
  scheduledStart?: string
  scheduledEnd?: string
  scheduledHours: number
  // Actual
  actualStart?: string
  actualEnd?: string
  actualHours: number
  // Diff
  arrivedLate: boolean
  lateMinutes: number
  leftEarly: boolean
  earlyMinutes: number
  // Status
  status: 'present' | 'absent' | 'late' | 'partial' | 'no_show'
}

export interface ScheduledVsActualReport {
  entries: ScheduledVsActualEntry[]
  summary: {
    totalScheduledHours: number
    totalActualHours: number
    totalVariance: number
    onTimeCount: number
    lateCount: number
    absentCount: number
    noShowCount: number
    punctualityRate: number // %
  }
}

export interface OvertimeEntry {
  employeeId: string
  employeeName: string
  // Daily overtime (>8h)
  dailyOvertimeHours: number
  // Weekly overtime (>40h)
  weeklyOvertimeHours: number
  // Holiday overtime
  holidayOvertimeHours: number
  // Total
  totalOvertimeHours: number
  // Cost
  overtimePay: number
  regularPay: number
  totalPay: number
}

export interface OvertimeReport {
  entries: OvertimeEntry[]
  summary: {
    totalOvertimeHours: number
    totalOvertimePay: number
    totalRegularPay: number
    totalPay: number
    employeesWithOvertime: number
    overtimePayPercentage: number // % of total pay
  }
}

export interface AttendanceEntry {
  employeeId: string
  employeeName: string
  date: string
  clockIn?: string
  clockOut?: string
  totalMinutes: number
  totalHours: number
  breakMinutes: number
  payRate: number
  totalPay: number
  type: string
  status: string
}

export interface AttendanceReport {
  entries: AttendanceEntry[]
  summary: {
    totalEntries: number
    totalHours: number
    totalPay: number
    byType: Record<string, { count: number; hours: number; pay: number }>
  }
}

// --- Konstante ---
const STANDARD_DAILY_HOURS = 8
const STANDARD_WEEKLY_HOURS = 40
const OVERTIME_MULTIPLIER = 1.5

// --- 1. SCHEDULED VS ACTUAL ---
export async function getScheduledVsActualReport(
  dateFrom: Date,
  dateTo: Date,
): Promise<ScheduledVsActualReport> {
  // Pridobi scheduled shifts
  const shifts = await db.staffShift.findMany({
    where: {
      shiftDate: { gte: dateFrom, lte: dateTo },
      status: { notIn: ['cancelled'] },
    },
    include: {
      employee: { select: { id: true, name: true } },
    },
  })

  // Pridobi actual time entries
  const timeEntries = await db.timeEntry.findMany({
    where: {
      clockIn: { gte: dateFrom, lte: dateTo },
    },
    include: {
      employee: { select: { id: true, name: true } },
    },
  })

  // Match shifts z time entries
  const entries: ScheduledVsActualEntry[] = []

  for (const shift of shifts) {
    const shiftDate = new Date(shift.shiftDate)
    const shiftDateStr = shiftDate.toISOString().split('T')[0]

    // Najdi time entry za ta employee na ta dan
    const matchingEntry = timeEntries.find((te) => {
      const teDate = new Date(te.clockIn).toISOString().split('T')[0]
      return te.employeeId === shift.employeeId && teDate === shiftDateStr
    })

    const scheduledHours = calcShiftHours(shift.startTime, shift.endTime)
    const actualHours = matchingEntry ? matchingEntry.totalMinutes / 60 : 0

    // Late detection
    let arrivedLate = false
    let lateMinutes = 0
    if (matchingEntry) {
      const scheduledStart = parseTimeOnDate(shiftDate, shift.startTime)
      const actualStart = new Date(matchingEntry.clockIn)
      const diffMin = (actualStart.getTime() - scheduledStart.getTime()) / 60000
      if (diffMin > 5) {
        // 5 min tolerance
        arrivedLate = true
        lateMinutes = Math.round(diffMin)
      }
    }

    // Early leave detection
    let leftEarly = false
    let earlyMinutes = 0
    if (matchingEntry?.clockOut) {
      const scheduledEnd = parseTimeOnDate(shiftDate, shift.endTime)
      const actualEnd = new Date(matchingEntry.clockOut)
      const diffMin = (scheduledEnd.getTime() - actualEnd.getTime()) / 60000
      if (diffMin > 5) {
        leftEarly = true
        earlyMinutes = Math.round(diffMin)
      }
    }

    // Status
    let status: ScheduledVsActualEntry['status']
    if (!matchingEntry) {
      status = shift.status === 'no_show' ? 'no_show' : 'absent'
    } else if (arrivedLate) {
      status = 'late'
    } else if (leftEarly || actualHours < scheduledHours * 0.8) {
      status = 'partial'
    } else {
      status = 'present'
    }

    entries.push({
      employeeId: shift.employeeId,
      employeeName: shift.employee.name,
      date: shiftDateStr,
      scheduledStart: shift.startTime,
      scheduledEnd: shift.endTime,
      scheduledHours: round2(scheduledHours),
      actualStart: matchingEntry ? new Date(matchingEntry.clockIn).toTimeString().substring(0, 5) : undefined,
      actualEnd: matchingEntry?.clockOut ? new Date(matchingEntry.clockOut).toTimeString().substring(0, 5) : undefined,
      actualHours: round2(actualHours),
      arrivedLate,
      lateMinutes,
      leftEarly,
      earlyMinutes,
      status,
    })
  }

  // Summary
  const totalScheduledHours = entries.reduce((s, e) => s + e.scheduledHours, 0)
  const totalActualHours = entries.reduce((s, e) => s + e.actualHours, 0)
  const onTimeCount = entries.filter((e) => e.status === 'present').length
  const lateCount = entries.filter((e) => e.status === 'late').length
  const absentCount = entries.filter((e) => e.status === 'absent').length
  const noShowCount = entries.filter((e) => e.status === 'no_show').length

  const punctualityRate = entries.length > 0
    ? round2((onTimeCount / entries.length) * 100)
    : 0

  return {
    entries: entries.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName)),
    summary: {
      totalScheduledHours: round2(totalScheduledHours),
      totalActualHours: round2(totalActualHours),
      totalVariance: round2(totalActualHours - totalScheduledHours),
      onTimeCount,
      lateCount,
      absentCount,
      noShowCount,
      punctualityRate,
    },
  }
}

// --- 2. OVERTIME ANALYSIS ---
export async function getOvertimeReport(
  dateFrom: Date,
  dateTo: Date,
): Promise<OvertimeReport> {
  const timeEntries = await db.timeEntry.findMany({
    where: {
      clockIn: { gte: dateFrom, lte: dateTo },
      status: { notIn: ['disputed'] },
    },
    include: {
      employee: { select: { id: true, name: true } },
    },
  })

  // Grupiraj po employee
  const byEmployee: Record<string, {
    employeeName: string
    entries: typeof timeEntries
  }> = {}

  for (const te of timeEntries) {
    if (!byEmployee[te.employeeId]) {
      byEmployee[te.employeeId] = {
        employeeName: te.employee.name,
        entries: [],
      }
    }
    byEmployee[te.employeeId].entries.push(te)
  }

  const entries: OvertimeEntry[] = []

  for (const [employeeId, data] of Object.entries(byEmployee)) {
    let dailyOvertimeHours = 0
    let weeklyOvertimeHours = 0
    let holidayOvertimeHours = 0
    let regularPay = 0
    let overtimePay = 0

    // Group by day
    const byDay: Record<string, typeof timeEntries> = {}
    for (const te of data.entries) {
      const dateKey = new Date(te.clockIn).toISOString().split('T')[0]
      if (!byDay[dateKey]) byDay[dateKey] = []
      byDay[dateKey].push(te)
    }

    // Daily overtime
    for (const dayEntries of Object.values(byDay)) {
      const dailyMinutes = dayEntries.reduce((s, te) => s + te.totalMinutes, 0)
      const dailyHours = dailyMinutes / 60
      if (dailyHours > STANDARD_DAILY_HOURS) {
        const overtimeHours = dailyHours - STANDARD_DAILY_HOURS
        dailyOvertimeHours += overtimeHours
        // Pay calculation
        const regularMinutes = STANDARD_DAILY_HOURS * 60
        const overtimeMinutes = overtimeHours * 60
        const rate = toNum(dayEntries[0].payRate)
        regularPay += (regularMinutes / 60) * rate
        overtimePay += (overtimeMinutes / 60) * rate * OVERTIME_MULTIPLIER
      } else {
        const rate = toNum(dayEntries[0].payRate)
        regularPay += (dailyMinutes / 60) * rate
      }
    }

    // Weekly overtime (preprosta implementacija - vse v enem obdobju)
    const totalHours = data.entries.reduce((s, te) => s + te.totalMinutes, 0) / 60
    if (totalHours > STANDARD_WEEKLY_HOURS) {
      weeklyOvertimeHours = totalHours - STANDARD_WEEKLY_HOURS
    }

    // Holiday overtime
    const holidayEntries = data.entries.filter((te) => te.type === 'holiday')
    holidayOvertimeHours = holidayEntries.reduce((s, te) => s + te.totalMinutes / 60, 0)

    const totalOvertimeHours = dailyOvertimeHours + weeklyOvertimeHours + holidayOvertimeHours
    const totalPay = regularPay + overtimePay

    if (totalOvertimeHours > 0) {
      entries.push({
        employeeId,
        employeeName: data.employeeName,
        dailyOvertimeHours: round2(dailyOvertimeHours),
        weeklyOvertimeHours: round2(weeklyOvertimeHours),
        holidayOvertimeHours: round2(holidayOvertimeHours),
        totalOvertimeHours: round2(totalOvertimeHours),
        overtimePay: round2(overtimePay),
        regularPay: round2(regularPay),
        totalPay: round2(totalPay),
      })
    }
  }

  // Summary
  const totalOvertimeHours = entries.reduce((s, e) => s + e.totalOvertimeHours, 0)
  const totalOvertimePay = entries.reduce((s, e) => s + e.overtimePay, 0)
  const totalRegularPay = entries.reduce((s, e) => s + e.regularPay, 0)
  const totalPay = totalOvertimePay + totalRegularPay

  return {
    entries: entries.sort((a, b) => b.totalOvertimeHours - a.totalOvertimeHours),
    summary: {
      totalOvertimeHours: round2(totalOvertimeHours),
      totalOvertimePay: round2(totalOvertimePay),
      totalRegularPay: round2(totalRegularPay),
      totalPay: round2(totalPay),
      employeesWithOvertime: entries.length,
      overtimePayPercentage: totalPay > 0 ? round2((totalOvertimePay / totalPay) * 100) : 0,
    },
  }
}

// --- 3. ATTENDANCE HISTORY ---
export async function getAttendanceReport(
  dateFrom: Date,
  dateTo: Date,
  employeeId?: string,
): Promise<AttendanceReport> {
  const where: Record<string, unknown> = {
    clockIn: { gte: dateFrom, lte: dateTo },
  }
  if (employeeId) where.employeeId = employeeId

  const timeEntries = await db.timeEntry.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true } },
    },
    orderBy: { clockIn: 'desc' },
  })

  const entries: AttendanceEntry[] = timeEntries.map((te) => ({
    employeeId: te.employeeId,
    employeeName: te.employee.name,
    date: new Date(te.clockIn).toISOString().split('T')[0],
    clockIn: new Date(te.clockIn).toTimeString().substring(0, 5),
    clockOut: te.clockOut ? new Date(te.clockOut).toTimeString().substring(0, 5) : undefined,
    totalMinutes: te.totalMinutes,
    totalHours: round2(te.totalMinutes / 60),
    breakMinutes: te.breakMinutes,
    payRate: toNum(te.payRate),
    totalPay: toNum(te.totalPay),
    type: te.type,
    status: te.status,
  }))

  // Summary
  const totalHours = entries.reduce((s, e) => s + e.totalHours, 0)
  const totalPay = entries.reduce((s, e) => s + e.totalPay, 0)
  const byType: Record<string, { count: number; hours: number; pay: number }> = {}
  for (const entry of entries) {
    if (!byType[entry.type]) byType[entry.type] = { count: 0, hours: 0, pay: 0 }
    byType[entry.type].count++
    byType[entry.type].hours += entry.totalHours
    byType[entry.type].pay += entry.totalPay
  }

  // Round byType
  for (const type of Object.keys(byType)) {
    byType[type].hours = round2(byType[type].hours)
    byType[type].pay = round2(byType[type].pay)
  }

  return {
    entries,
    summary: {
      totalEntries: entries.length,
      totalHours: round2(totalHours),
      totalPay: round2(totalPay),
      byType,
    },
  }
}

// --- Helper functions ---
function calcShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  let hours = (endH * 60 + endM - startH * 60 - startM) / 60
  if (hours < 0) hours += 24 // cross-midnight
  return hours
}

function parseTimeOnDate(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const result = new Date(date)
  result.setHours(h, m, 0, 0)
  return result
}

// --- Export constants ---
export { STANDARD_DAILY_HOURS, STANDARD_WEEKLY_HOURS, OVERTIME_MULTIPLIER }
