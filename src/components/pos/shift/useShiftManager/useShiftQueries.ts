'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type ShiftItem, type TimeEntryItem, type Employee, type Job } from '../constants'

// ============================================
// QUERIES — Poizvedbe za izmene, zaposlene, delovna mesta
// ============================================

export function useShiftQueries() {
  const { data: employees } = useQuery<Employee[]>({
    queryKey: queryKeys.employees.all,
    queryFn: async () => { const res = await authFetch('/api/employees'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  const { data: jobs } = useQuery<Job[]>({
    queryKey: queryKeys.jobs.all,
    queryFn: async () => { const res = await authFetch('/api/jobs'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  const { data: shifts, isLoading: shiftsLoading } = useQuery<ShiftItem[]>({
    queryKey: queryKeys.shifts.all,
    queryFn: async () => { const res = await authFetch('/api/shifts'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  const { data: timeEntries, isLoading: entriesLoading } = useQuery<TimeEntryItem[]>({
    queryKey: ['time-entries'],
    queryFn: async () => { const res = await authFetch('/api/time-entries'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  return { employees, jobs, shifts, shiftsLoading, timeEntries, entriesLoading }
}
