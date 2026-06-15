'use client'
import { memo } from 'react'
import { Clock, Edit, Trash2, CheckCircle2, AlertTriangle, Coffee, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { type ShiftType, statusLabels, statusColors, calcHours, getShiftColor } from './constants'

// ============================================
// SHIFT ROW — Posamezna izmena v dnevu
// ============================================
interface ShiftRowProps {
  shift: ShiftType
  shiftIdx: number
  onEditShift: (_shift: ShiftType) => void
  onDeleteShift: (_id: string) => void
  onStatusChange: (_id: string, _status: string) => void
}

export const ShiftRow = memo(function ShiftRow({
  shift, shiftIdx, onEditShift, onDeleteShift, onStatusChange,
}: ShiftRowProps) {
  const hours = calcHours(shift.startTime, shift.endTime, shift.breakMinutes)
  const overtime = hours > 8
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${getShiftColor(shiftIdx)} transition-colors hover:shadow-sm`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center text-xs font-bold border">
            {shift.employee?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{shift.employee?.name || 'Neznan'}</p>
            <p className="text-[10px] text-muted-foreground">
              {shift.job?.name || shift.employee?.role || 'Splošno'}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm font-medium">
            <Clock className="h-3 w-3" />
            {shift.startTime} — {shift.endTime}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className={overtime ? 'text-red-600 font-bold' : ''}>{hours.toFixed(1)}h</span>
            {shift.breakMinutes > 0 && (
              <span className="flex items-center gap-0.5">
                <Coffee className="h-2.5 w-2.5" /> {shift.breakMinutes}min
              </span>
            )}
            {overtime && (
              <span className="flex items-center gap-0.5 text-red-600">
                <AlertTriangle className="h-2.5 w-2.5" /> Podaljšek
              </span>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${statusColors[shift.status]}`}>
          {statusLabels[shift.status]}
        </Badge>
        <div className="flex items-center gap-1">
          {shift.status === 'scheduled' && (
            <Button variant="ghost" size="icon" aria-label="Trend navzgor" className="h-7 w-7" onClick={() => onStatusChange(shift.id, 'in_progress')}>
              <TrendingUp className="h-3 w-3" />
            </Button>
          )}
          {shift.status === 'in_progress' && (
            <Button variant="ghost" size="icon" aria-label="Potrdi" className="h-7 w-7" onClick={() => onStatusChange(shift.id, 'completed')}>
              <CheckCircle2 className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" onClick={() => onEditShift(shift)}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-red-500" onClick={() => onDeleteShift(shift.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
})
