'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Tedenski pogled (Week View)
// Tedenski razpored z izmenami po dnevih in povzetkom po zaposlenih
// ═══════════════════════════════════════════════════════════════
import { memo } from 'react'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { type ShiftType } from './constants'
import { DayCard } from './DayCard'
import { EmployeeSummary } from './EmployeeSummary'

// ─── Props ─────────────────────────────────────────────────────
export interface WeekViewProps {
  weekDates: Date[]
  shiftsByDate: Record<string, ShiftType[]>
  shiftsByEmployee: Record<string, ShiftType[]>
  filteredShifts: ShiftType[]
  isLoading: boolean
  onAddShift: (_date?: Date) => void
  onEditShift: (_shift: ShiftType) => void
  onDeleteShift: (_id: string) => void
  onStatusChange: (_id: string, _status: string) => void
}

// ─── Komponenta ────────────────────────────────────────────────
export const WeekView = memo(function WeekView({
  weekDates,
  shiftsByDate,
  shiftsByEmployee,
  filteredShifts,
  isLoading,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onStatusChange,
}: WeekViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map((date, dateIdx) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const dayShifts = shiftsByDate[dateStr] || []
            return (
              <DayCard
                key={dateStr}
                date={date}
                dateIdx={dateIdx}
                shifts={dayShifts}
                onAddShift={onAddShift}
                onEditShift={onEditShift}
                onDeleteShift={onDeleteShift}
                onStatusChange={onStatusChange}
              />
            )
          })}
        </div>
      )}
      {/* Povzetek po zaposlenih */}
      {!isLoading && filteredShifts.length > 0 && (
        <EmployeeSummary shiftsByEmployee={shiftsByEmployee} />
      )}
    </div>
  )
})
