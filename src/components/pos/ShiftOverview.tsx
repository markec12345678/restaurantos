'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { ShiftRow, EmployeeRow, TimeEntryRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { CalendarDays } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ShiftEmployee } from './shift-overview/constants'

// Lazy-loaded podkomponente
const ShiftSummaryCards = dynamic(() => import('./shift-overview/ShiftSummaryCards').then(m => ({ default: m.ShiftSummaryCards })), { ssr: false })
const ShiftFilterBar = dynamic(() => import('./shift-overview/ShiftFilterBar').then(m => ({ default: m.ShiftFilterBar })), { ssr: false })
const ShiftEmployeeList = dynamic(() => import('./shift-overview/ShiftEmployeeList').then(m => ({ default: m.ShiftEmployeeList })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA PREGLEDA IZMEN
// ============================================
export const ShiftOverview = memo(function ShiftOverview() {
  const [employees, setEmployees] = useState<ShiftEmployee[]>([])
  const [_loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

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

  // Izračuni
  const filtered = filterStatus === 'all'
    ? employees
    : employees.filter(e => e.status === filterStatus)

  const clockedInCount = employees.filter(e => e.status === 'clocked-in').length
  const onBreakCount = employees.filter(e => e.status === 'on-break').length
  const scheduledCount = employees.filter(e => e.status === 'scheduled').length
  const totalHoursToday = employees.reduce((s, e) => s + e.hoursWorked, 0)

  const currentTime = new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <CalendarDays className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Pregled izmen</h2>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {currentTime}
            </p>
          </div>
        </div>
      </div>

      {/* Povzetek */}
      <ShiftSummaryCards
        clockedInCount={clockedInCount}
        onBreakCount={onBreakCount}
        scheduledCount={scheduledCount}
        totalHoursToday={totalHoursToday}
      />

      {/* Filtri */}
      <ShiftFilterBar
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      {/* Seznam zaposlenih */}
      <ShiftEmployeeList
        employees={filtered}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        onBreak={handleBreak}
      />
    </div>
  )
})
