'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays, startOfWeek } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  type EmployeeType,
  type ShiftType,
  type JobType,
  type SchedulerStats,
  calcHours,
} from '../constants'

// ============================================
// HOOK: Poizvedbe in izračuni za razpored
// ============================================

export function useSchedulerQueries() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const weekEnd = addDays(weekStart, 6)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const from = format(weekStart, 'yyyy-MM-dd')
  const to = format(weekEnd, 'yyyy-MM-dd')
  const { data: shiftsData, isLoading } = useQuery({
    queryKey: [...queryKeys.shifts.schedule, from, to],
    queryFn: async () => {
      const res = await authFetch(`/api/shifts?from=${from}&to=${to}`)
      return res.json()
    },
  })
  const { data: employeesData } = useQuery({
    queryKey: ['schedule-employees'],
    queryFn: async () => {
      const res = await authFetch('/api/employees')
      return res.json()
    },
  })
  const { data: jobsData } = useQuery({
    queryKey: queryKeys.jobs.all,
    queryFn: async () => {
      const res = await authFetch('/api/jobs')
      return res.json()
    },
  })
  const shifts: ShiftType[] = shiftsData?.shifts || shiftsData || []
  const employees: EmployeeType[] = employeesData?.employees || employeesData || []
  const jobs: JobType[] = jobsData?.jobs || jobsData || []

  // Filtriraj po zaposlenem
  const filteredShifts = selectedEmployee === 'all'
    ? shifts
    : shifts.filter(s => s.employeeId === selectedEmployee)

  // Grupiraj izmene po datumu
  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftType[]> = {}
    weekDates.forEach(d => { map[format(d, 'yyyy-MM-dd')] = [] })
    filteredShifts.forEach(s => {
      const key = format(new Date(s.date), 'yyyy-MM-dd')
      if (map[key]) map[key].push(s)
    })
    return map
  }, [filteredShifts, weekDates])

  // Grupiraj izmene po zaposlenem
  const shiftsByEmployee = useMemo(() => {
    const map: Record<string, ShiftType[]> = {}
    filteredShifts.forEach(s => {
      if (!map[s.employeeId]) map[s.employeeId] = []
      map[s.employeeId].push(s)
    })
    return map
  }, [filteredShifts])

  // Statistika
  const stats = useMemo<SchedulerStats>(() => {
    const totalHours = filteredShifts.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)
    const scheduledCount = filteredShifts.filter(s => s.status === 'scheduled').length
    const completedCount = filteredShifts.filter(s => s.status === 'completed').length
    const inProgressCount = filteredShifts.filter(s => s.status === 'in_progress').length
    const absentCount = filteredShifts.filter(s => s.status === 'absent').length
    const uniqueEmployees = new Set(filteredShifts.map(s => s.employeeId)).size
    return { totalHours, scheduledCount, completedCount, inProgressCount, absentCount, uniqueEmployees }
  }, [filteredShifts])

  return {
    weekStart, setWeekStart, weekEnd, weekDates,
    selectedEmployee, setSelectedEmployee,
    shifts: filteredShifts, employees, jobs,
    shiftsByDate, shiftsByEmployee,
    isLoading, stats,
  }
}
