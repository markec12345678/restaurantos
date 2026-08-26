'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShiftRow, EmployeeRow, TimeEntryRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import type { ShiftEmployee } from './constants'

export function useShiftOverview() {
  const [employees, setEmployees] = useState<ShiftEmployee[]>([])
  const [_loading, setLoading] = useState(true)

  useEffect(() => {
    loadShiftData()
    const interval = setInterval(loadShiftData, 30000) // Osveži vsakih 30s
    return () => clearInterval(interval)
  }, [])

  const loadShiftData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Naloži razpored
      const shiftRes = await authFetch(`/api/staff-shifts?date=${today}`)
      const shiftData = await shiftRes.json()

      // Naloži zaposlene
      const empRes = await authFetch('/api/employees')
      const empData = await empRes.json()

      // Naloži časovne evidence
      const timeRes = await authFetch('/api/time-entries')
      const timeData = await timeRes.json()

      const shiftEmployees: ShiftEmployee[] = (shiftData || []).map((shift: ShiftRow) => {
        const emp = empData?.find?.((e: EmployeeRow) => e.id === shift.employeeId) || {}
        const timeEntry = timeData?.find?.((t: TimeEntryRow) =>
          t.employeeId === shift.employeeId &&
          t.clockIn && new Date(t.clockIn).toISOString().split('T')[0] === today
        )

        let status: ShiftEmployee['status'] = 'scheduled'
        let clockedInAt: string | null = null
        let breakStartedAt: string | null = null
        let totalBreakMinutes = 0

        if (timeEntry?.clockIn && !timeEntry?.clockOut) {
          if (timeEntry?.breakStart && !timeEntry?.breakEnd) {
            status = 'on-break'
            breakStartedAt = timeEntry.breakStart
          } else {
            status = 'clocked-in'
          }
          clockedInAt = timeEntry.clockIn
          if (timeEntry.breakMinutes) totalBreakMinutes = timeEntry.breakMinutes
        } else if (timeEntry?.clockOut) {
          status = 'clocked-out'
          clockedInAt = timeEntry.clockIn
        }

        // Izračunaj ure
        const now = new Date()
        const start = shift.startTime ? new Date(`1970-01-01T${shift.startTime}`) : new Date()
        const end = shift.endTime ? new Date(`1970-01-01T${shift.endTime}`) : new Date()
        const totalShiftHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        let hoursWorked = 0
        if (clockedInAt) {
          hoursWorked = (now.getTime() - new Date(clockedInAt).getTime()) / (1000 * 60 * 60) - (totalBreakMinutes / 60)
        }
        const hoursRemaining = Math.max(0, totalShiftHours - hoursWorked)

        return {
          id: shift.employeeId || shift.id,
          name: emp.name || shift.employeeId || 'Neznan',
          role: emp.primaryJob || emp.role || shift.shiftType || 'Osebje',
          shiftType: shift.shiftType || 'full',
          shiftStart: shift.startTime || '08:00',
          shiftEnd: shift.endTime || '16:00',
          status,
          clockedInAt,
          breakStartedAt,
          totalBreakMinutes,
          location: shift.locationId || 'Glavna',
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100,
        }
      })

      setEmployees(shiftEmployees)
    } catch {
      toast.error('Napaka pri nalaganju izmenskih podatkov')
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = useCallback(async (employeeId: string) => {
    try {
      await authFetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, clockIn: new Date().toISOString() }),
      })
      await loadShiftData()
    } catch {
      toast.error('Napaka pri prijavi na izmeno')
    }
  }, [loadShiftData])

  const handleClockOut = useCallback(async (employeeId: string) => {
    try {
      await authFetch('/api/time-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, clockOut: new Date().toISOString() }),
      })
      await loadShiftData()
    } catch {
      toast.error('Napaka pri odjavi iz izmene')
    }
  }, [loadShiftData])

  const handleBreak = useCallback(async (employeeId: string, onBreak: boolean) => {
    try {
      await authFetch('/api/time-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          [onBreak ? 'breakEnd' : 'breakStart']: new Date().toISOString(),
        }),
      })
      await loadShiftData()
    } catch {
      toast.error('Napaka pri preklopu odmora')
    }
  }, [loadShiftData])

  return {
    employees,
    loading: _loading,
    handleClockIn,
    handleClockOut,
    handleBreak,
  }
}
