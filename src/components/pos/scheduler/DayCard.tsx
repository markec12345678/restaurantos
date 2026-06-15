'use client'
import { memo } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { isToday } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { type ShiftType, DAY_NAMES, calcHours } from './constants'
import { ShiftRow } from './ShiftRow'

// ─── DayCard — Posamezen dan v tednu ───

interface DayCardProps {
  date: Date
  dateIdx: number
  shifts: ShiftType[]
  onAddShift: (_date?: Date) => void
  onEditShift: (_shift: ShiftType) => void
  onDeleteShift: (_id: string) => void
  onStatusChange: (_id: string, _status: string) => void
}

export const DayCard = memo(function DayCard({
  date, dateIdx, shifts, onAddShift, onEditShift, onDeleteShift, onStatusChange,
}: DayCardProps) {
  const isTodayDate = isToday(date)
  const isWeekend = dateIdx >= 5
  const totalHours = shifts.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)

  return (
    <div className={`rounded-xl border p-3 ${isTodayDate ? 'border-primary bg-primary/5' : isWeekend ? 'bg-muted/30' : 'bg-card'}`}>
      {/* Dan header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`text-center min-w-14 ${isTodayDate ? 'text-primary' : ''}`}>
            <p className="text-xs font-medium text-muted-foreground">{DAY_NAMES[dateIdx]}</p>
            <p className={`text-lg font-bold ${isTodayDate ? 'text-primary' : ''}`}>
              {format(date, 'd')}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">
              {format(date, 'd. MMMM', { locale: sl })}
              {isTodayDate && <Badge className="ml-2 text-[9px]" variant="default">Danes</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {shifts.length} {shifts.length === 1 ? 'izmena' : 'izmen'} · {totalHours.toFixed(1)}h
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAddShift(date)}>
          <Plus className="h-3 w-3 mr-1" /> Dodaj izmeno
        </Button>
      </div>
      {/* Izmene za ta dan */}
      {shifts.length === 0 ? (
        <div className="py-3 text-center text-muted-foreground text-xs border-t border-dashed">
          Ni načrtovanih izmen
        </div>
      ) : (
        <div className="space-y-1.5 pt-2 border-t">
          {shifts.map((shift, shiftIdx) => (
            <ShiftRow
              key={shift.id}
              shift={shift}
              shiftIdx={shiftIdx}
              onEditShift={onEditShift}
              onDeleteShift={onDeleteShift}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
})
