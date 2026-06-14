'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Tedenski pogled (Week View)
// Tedenski razpored z izmenami po dnevih in povzetkom po zaposlenih
// ═══════════════════════════════════════════════════════════════
import { memo } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { isToday } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Plus, Edit, Trash2, CheckCircle2, AlertTriangle, Coffee, TrendingUp, BarChart3 } from 'lucide-react'
import { type ShiftType, DAY_NAMES, statusLabels, statusColors, calcHours, getShiftColor } from './constants'

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
          {/* Dnevi v tednu */}
          {weekDates.map((date, dateIdx) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const dayShifts = shiftsByDate[dateStr] || []
            const isTodayDate = isToday(date)
            const isWeekend = dateIdx >= 5
            const totalHours = dayShifts.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)
            return (
              <div key={dateStr} className={`rounded-xl border p-3 ${isTodayDate ? 'border-primary bg-primary/5' : isWeekend ? 'bg-muted/30' : 'bg-card'}`}>
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
                        {dayShifts.length} {dayShifts.length === 1 ? 'izmena' : 'izmen'} · {totalHours.toFixed(1)}h
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAddShift(date)}>
                    <Plus className="h-3 w-3 mr-1" /> Dodaj izmeno
                  </Button>
                </div>
                {/* Izmene za ta dan */}
                {dayShifts.length === 0 ? (
                  <div className="py-3 text-center text-muted-foreground text-xs border-t border-dashed">
                    Ni načrtovanih izmen
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-2 border-t">
                    {dayShifts.map((shift, shiftIdx) => {
                      const hours = calcHours(shift.startTime, shift.endTime, shift.breakMinutes)
                      const overtime = hours > 8
                      return (
                        <div key={shift.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${getShiftColor(shiftIdx)} transition-colors hover:shadow-sm`}>
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
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {/* Povzetek po zaposlenih */}
      {!isLoading && filteredShifts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Povzetek po zaposlenih
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(shiftsByEmployee).map(([empId, empShifts]) => {
              const emp = empShifts[0]?.employee
              if (!emp) return null
              const totalH = empShifts.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)
              const completedH = empShifts.filter(s => s.status === 'completed').reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)
              const _scheduledH = totalH - completedH
              return (
                <Card key={empId} className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.role}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-sm font-bold">{totalH.toFixed(1)}h</p>
                      <p className="text-[10px] text-muted-foreground">{completedH.toFixed(1)}h opravljenih</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {empShifts.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{format(new Date(s.date), 'EEE d', { locale: sl })}</span>
                        <span>{s.startTime}—{s.endTime} ({calcHours(s.startTime, s.endTime, s.breakMinutes).toFixed(1)}h)</span>
                        <Badge variant="outline" className={`text-[8px] h-4 px-1 ${statusColors[s.status]}`}>
                          {statusLabels[s.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {/* Urna kartica */}
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>40h tedensko</span>
                      <span className={totalH > 40 ? 'text-red-600 font-bold' : totalH >= 35 ? 'text-emerald-600' : ''}>
                        {totalH.toFixed(1)}h ({((totalH / 40) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden" role="progressbar" aria-valuenow={Math.min(100, (totalH / 40) * 100)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={totalH > 40 ? 'Prekoračene ure' : totalH >= 35 ? 'Zadostne ure' : 'Nizke ure'}>
                      <div className={`h-full rounded-full transition-all ${totalH > 40 ? 'bg-red-500' : totalH >= 35 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, (totalH / 40) * 100)}%` }} />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})
