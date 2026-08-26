'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, isToday } from 'date-fns'
import { sl } from 'date-fns/locale'
import { statusLabels } from './constants'
import type { ReservationType } from './constants'

interface DateNavigationProps {
  selectedDate: Date
  dateStr: string
  onNavigate: (_dir: number) => void
  onGoToToday: () => void
  onDateInput: (_dateStr: string) => void
}

export const DateNavigation = memo(function DateNavigation({
  selectedDate,
  dateStr,
  onNavigate,
  onGoToToday,
  onDateInput,
}: DateNavigationProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Nazaj" className="h-8 w-8" onClick={() => onNavigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant={isToday(selectedDate) ? 'default' : 'outline'} size="sm" onClick={onGoToToday} className="min-w-32">
        <Calendar className="h-3.5 w-3.5 mr-1.5" />
        {isToday(selectedDate) ? 'Danes' : format(selectedDate, 'EEE d. MMM', { locale: sl })}
      </Button>
      <Button variant="outline" size="icon" aria-label="Naprej" className="h-8 w-8" onClick={() => onNavigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Input
        type="date"
        value={dateStr}
        onChange={e => onDateInput(e.target.value)}
        className="w-36 h-8 text-xs"
      />
    </div>
  )
})

interface FilterBarProps {
  filterStatus: string
  onFilterChange: (_status: string) => void
  reservations: ReservationType[]
}

export const FilterBar = memo(function FilterBar({
  filterStatus,
  onFilterChange,
  reservations,
}: FilterBarProps) {
  return (
    <div className="flex gap-1 ml-4">
      {['all', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'].map(status => (
        <Button
          key={status}
          variant={filterStatus === status ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-[10px] px-2"
          onClick={() => onFilterChange(status)}
        >
          {status === 'all' ? 'Vse' : statusLabels[status]}
          {status !== 'all' && (
            <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
              {reservations.filter(r => r.status === status).length}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  )
})
