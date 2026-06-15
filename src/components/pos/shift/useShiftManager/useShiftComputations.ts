'use client'

import { useMemo } from 'react'
import { type Employee, type ShiftItem, type TimeEntryItem } from '../constants'

// ============================================
// IZRAČUNI — Aktivne izmene, statistike
// ============================================

export function useShiftComputations(
  employees: Employee[] | undefined,
  shifts: ShiftItem[] | undefined,
  timeEntries: TimeEntryItem[] | undefined,
) {
  const employeesList = Array.isArray(employees) ? employees : []
  const allShifts = shifts || []
  const allEntries = timeEntries || []

  const activeEntries = useMemo(() => allEntries.filter(e => !e.clockOut), [allEntries])
  const completedEntries = useMemo(() => allEntries.filter(e => e.clockOut).sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()), [allEntries])

  const scheduledCount = allShifts.filter(s => s.status === 'scheduled').length
  const inProgressCount = allShifts.filter(s => s.status === 'in_progress').length
  const completedCount = allShifts.filter(s => s.status === 'completed').length
  const totalHoursToday = allEntries
    .filter(e => new Date(e.clockIn).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + e.totalMinutes, 0) / 60

  return { employeesList, allShifts, activeEntries, completedEntries, scheduledCount, inProgressCount, completedCount, totalHoursToday }
}
