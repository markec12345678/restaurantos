'use client'

import { useState, memo } from 'react'
import { CalendarDays } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useShiftOverview } from './shift-overview/useShiftOverview'

// Lazy-loaded podkomponente
const ShiftSummaryCards = dynamic(() => import('./shift-overview/ShiftSummaryCards').then(m => ({ default: m.ShiftSummaryCards })), { ssr: false })
const ShiftFilterBar = dynamic(() => import('./shift-overview/ShiftFilterBar').then(m => ({ default: m.ShiftFilterBar })), { ssr: false })
const ShiftEmployeeList = dynamic(() => import('./shift-overview/ShiftEmployeeList').then(m => ({ default: m.ShiftEmployeeList })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA PREGLEDA IZMEN
// ============================================
export const ShiftOverview = memo(function ShiftOverview() {
  const { employees, handleClockIn, handleClockOut, handleBreak } = useShiftOverview()
  const [filterStatus, setFilterStatus] = useState<string>('all')

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
