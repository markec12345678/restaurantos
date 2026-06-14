'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Navigacija po tednih (Week Navigator)
// Tedenska navigacija in filter po zaposlenih
// ═══════════════════════════════════════════════════════════════
import { memo } from 'react'
import { format, isToday, addDays } from 'date-fns'
import { sl } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { type EmployeeType } from './constants'

// ─── Props ─────────────────────────────────────────────────────
export interface WeekNavigatorProps {
  weekStart: Date
  weekEnd: Date
  selectedEmployee: string
  employees: EmployeeType[]
  onNavigateWeek: (_dir: number) => void
  onGoToThisWeek: () => void
  onEmployeeChange: (_value: string) => void
}

// ─── Komponenta ────────────────────────────────────────────────
export const WeekNavigator = memo(function WeekNavigator({
  weekStart,
  weekEnd,
  selectedEmployee,
  employees,
  onNavigateWeek,
  onGoToThisWeek,
  onEmployeeChange,
}: WeekNavigatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Nazaj" className="h-8 w-8" onClick={() => onNavigateWeek(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant={isToday(addDays(weekStart, 3)) ? 'default' : 'outline'} size="sm" onClick={onGoToThisWeek} className="min-w-48">
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          {format(weekStart, 'd. MMM', { locale: sl })} — {format(weekEnd, 'd. MMM yyyy', { locale: sl })}
        </Button>
        <Button variant="outline" size="icon" aria-label="Naprej" className="h-8 w-8" onClick={() => onNavigateWeek(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-1 ml-4">
        <Select value={selectedEmployee} onValueChange={onEmployeeChange}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="Vsi zaposleni" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi zaposleni ({employees.length})</SelectItem>
            {employees.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.name} — {emp.role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})
