'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Razpored zaposlenih (Staff Scheduler)
// Toast POS + 7shifts standard
// Tedenski pogled, dodeljevanje izmen, statistika ur
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, Users, Plus,
  Edit, Trash2, CheckCircle2, XCircle, AlertTriangle, Copy,
  UserCheck, Briefcase, Coffee, TrendingUp, BarChart3,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { format, addDays, startOfWeek, isSameDay, isToday, parseISO } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'

// ─── Tipi ──────────────────────────────────────────────────────
interface EmployeeType {
  id: string
  name: string
  role: string
  pin: string
  isActive: boolean
}

interface ShiftType {
  id: string
  employeeId: string
  employee: { id: string; name: string; role: string }
  jobId: string | null
  job: { id: string; name: string; color: string } | null
  date: string
  startTime: string
  endTime: string
  status: string
  breakMinutes: number
  notes: string
}

// ─── Konstante ─────────────────────────────────────────────────
const DAY_NAMES = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const SHIFT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
]

const statusLabels: Record<string, string> = {
  scheduled: 'Načrtovana',
  in_progress: 'V teku',
  completed: 'Zaključena',
  absent: 'Odsoten',
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// ─── Pomožne funkcije ──────────────────────────────────────────
function calcHours(start: string, end: string, breakMin: number): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60 // če ponoči
  return Math.max(0, (diff - breakMin) / 60)
}

function getShiftColor(idx: number): string {
  return SHIFT_COLORS[idx % SHIFT_COLORS.length]
}

// ─── GLAVNA KOMPONENTA ─────────────────────────────────────────
export function StaffScheduler() {
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copySourceDate, setCopySourceDate] = useState('')

  const weekEnd = addDays(weekStart, 6)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // ─── Pridobi izmene za teden ───
  const from = format(weekStart, 'yyyy-MM-dd')
  const to = format(weekEnd, 'yyyy-MM-dd')

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['shifts-schedule', from, to],
    queryFn: async () => {
      const res = await authFetch(`/api/shifts?from=${from}&to=${to}`)
      return res.json()
    },
  })

  const { data: employeesData } = useQuery({
    queryKey: ['schedule-employees'],
    queryFn: async () => {
      const res = await authFetch('/api/employees')
      return res.json()
    },
  })

  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const res = await authFetch('/api/jobs')
      return res.json()
    },
  })

  const shifts: ShiftType[] = shiftsData?.shifts || shiftsData || []
  const employees: EmployeeType[] = employeesData?.employees || employeesData || []
  const jobs: { id: string; name: string; color: string }[] = jobsData?.jobs || jobsData || []

  // Filtriraj po zaposlenem
  const filteredShifts = selectedEmployee === 'all'
    ? shifts
    : shifts.filter(s => s.employeeId === selectedEmployee)

  // Grupiraj izmene po datumu
  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftType[]> = {}
    weekDates.forEach(d => { map[format(d, 'yyyy-MM-dd')] = [] })
    filteredShifts.forEach(s => {
      const key = format(new Date(s.date), 'yyyy-MM-dd')
      if (map[key]) map[key].push(s)
    })
    return map
  }, [filteredShifts, weekDates])

  // Grupiraj izmene po zaposlenem
  const shiftsByEmployee = useMemo(() => {
    const map: Record<string, ShiftType[]> = {}
    filteredShifts.forEach(s => {
      if (!map[s.employeeId]) map[s.employeeId] = []
      map[s.employeeId].push(s)
    })
    return map
  }, [filteredShifts])

  // Statistika
  const stats = useMemo(() => {
    const totalHours = filteredShifts.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)
    const scheduledCount = filteredShifts.filter(s => s.status === 'scheduled').length
    const completedCount = filteredShifts.filter(s => s.status === 'completed').length
    const inProgressCount = filteredShifts.filter(s => s.status === 'in_progress').length
    const absentCount = filteredShifts.filter(s => s.status === 'absent').length
    const uniqueEmployees = new Set(filteredShifts.map(s => s.employeeId)).size
    return { totalHours, scheduledCount, completedCount, inProgressCount, absentCount, uniqueEmployees }
  }, [filteredShifts])

  // ─── Mutacije ───
  const saveMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      if (editingShift) {
        const res = await authFetch(`/api/shifts/${editingShift.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Napaka pri posodabljanju')
        return res.json()
      } else {
        const res = await authFetch('/api/shifts', {
          method: 'POST',
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Napaka pri ustvarjanju')
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editingShift ? 'Izmena posodobljena' : 'Izmena ustvarjena')
      queryClient.invalidateQueries({ queryKey: ['shifts-schedule'] })
      setDialogOpen(false)
      setEditingShift(null)
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Izmena izbrisana')
      queryClient.invalidateQueries({ queryKey: ['shifts-schedule'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/shifts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (_, vars) => {
      toast.success(`Status: ${statusLabels[vars.status]}`)
      queryClient.invalidateQueries({ queryKey: ['shifts-schedule'] })
    },
  })

  const copyWeekMutation = useMutation({
    mutationFn: async ({ sourceDate, targetWeekStart }: { sourceDate: string; targetWeekStart: string }) => {
      const res = await authFetch('/api/shifts', {
        method: 'POST',
        body: JSON.stringify({ action: 'copy_week', sourceDate, targetWeekStart }),
      })
      if (!res.ok) throw new Error('Napaka pri kopiranju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Teden kopiran!')
      queryClient.invalidateQueries({ queryKey: ['shifts-schedule'] })
      setCopyDialogOpen(false)
    },
  })

  // ─── Navigacija ───
  const navigateWeek = (dir: number) => setWeekStart(prev => addDays(prev, dir * 7))
  const goToThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  // ─── Odpri dialog za novo izmeno ───
  const openNewShift = (date?: Date, employeeId?: string) => {
    setEditingShift(null)
    setDialogOpen(true)
    // Podatki bodo nastavljeni v dialogu
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Razpored zaposlenih
          </h2>
          <p className="text-xs text-muted-foreground">
            {stats.uniqueEmployees} zaposlenih · {stats.totalHours.toFixed(1)} ur · {filteredShifts.length} izmen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCopyDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-1" /> Kopiraj teden
          </Button>
          <Button size="sm" onClick={() => openNewShift()}>
            <Plus className="h-4 w-4 mr-1" /> Nova izmena
          </Button>
        </div>
      </div>

      {/* Teden navigacija + filtri */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isToday(addDays(weekStart, 3)) ? 'default' : 'outline'} size="sm" onClick={goToThisWeek} className="min-w-48">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            {format(weekStart, 'd. MMM', { locale: sl })} — {format(weekEnd, 'd. MMM yyyy', { locale: sl })}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1 ml-4">
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
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

      {/* Statistične kartice */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 px-4 py-3 flex-shrink-0">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Skupaj ur</p>
              <p className="font-bold text-sm">{stats.totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Zaposlenih</p>
              <p className="font-bold text-sm">{stats.uniqueEmployees}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Načrtovane</p>
              <p className="font-bold text-sm">{stats.scheduledCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">V teku</p>
              <p className="font-bold text-sm">{stats.inProgressCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Zaključene</p>
              <p className="font-bold text-sm">{stats.completedCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Odsotni</p>
              <p className="font-bold text-sm">{stats.absentCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tedenski razpored */}
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
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openNewShift(date)}>
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
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => statusMutation.mutate({ id: shift.id, status: 'in_progress' })}>
                                    <TrendingUp className="h-3 w-3" />
                                  </Button>
                                )}
                                {shift.status === 'in_progress' && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => statusMutation.mutate({ id: shift.id, status: 'completed' })}>
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingShift(shift); setDialogOpen(true) }}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteMutation.mutate(shift.id)}>
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
                const scheduledH = totalH - completedH
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
                      <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
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

      {/* Dialog za novo/uredi izmeno */}
      <ShiftDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingShift(null) }}
        shift={editingShift}
        employees={employees}
        jobs={jobs}
        weekDates={weekDates}
        onSave={saveMutation.mutate}
      />

      {/* Dialog za kopiranje tedna */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" />
              Kopiraj razpored
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kopiraj razpored iz prejšnjega tedna v prihodnji teden. Obstajajoče izmene ne bodo prepisane.
            </p>
            <div>
              <label className="text-xs font-medium">Izvorni teden</label>
              <Input
                type="date"
                value={copySourceDate || format(addDays(weekStart, -7), 'yyyy-MM-dd')}
                onChange={e => setCopySourceDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Prekliči</Button>
            <Button onClick={() => {
              const source = copySourceDate || format(addDays(weekStart, -7), 'yyyy-MM-dd')
              copyWeekMutation.mutate({ sourceDate: source, targetWeekStart: format(weekStart, 'yyyy-MM-dd') })
            }}>
              Kopiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DIALOG ZA NOVO/UREDI IZMENO
// ═══════════════════════════════════════════════════════════════
function ShiftDialog({
  open,
  onClose,
  shift,
  employees,
  jobs,
  weekDates,
  onSave,
}: {
  open: boolean
  onClose: () => void
  shift: ShiftType | null
  employees: EmployeeType[]
  jobs: { id: string; name: string; color: string }[]
  weekDates: Date[]
  onSave: (data: Record<string, unknown>) => void
}) {
  const isEditing = !!shift

  const [employeeId, setEmployeeId] = useState('')
  const [jobId, setJobId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [breakMinutes, setBreakMinutes] = useState(30)
  const [status, setStatus] = useState('scheduled')
  const [notes, setNotes] = useState('')

  // Napolni ob urejanju
  const resetForm = () => {
    if (shift) {
      setEmployeeId(shift.employeeId)
      setJobId(shift.jobId || '')
      setDate(format(new Date(shift.date), 'yyyy-MM-dd'))
      setStartTime(shift.startTime)
      setEndTime(shift.endTime)
      setBreakMinutes(shift.breakMinutes)
      setStatus(shift.status)
      setNotes(shift.notes)
    } else {
      setEmployeeId(employees[0]?.id || '')
      setJobId('')
      setDate(weekDates[0] ? format(weekDates[0], 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
      setStartTime('09:00')
      setEndTime('17:00')
      setBreakMinutes(30)
      setStatus('scheduled')
      setNotes('')
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm()
    else onClose()
  }

  const handleSave = () => {
    if (!employeeId || !date) {
      toast.error('Zaposleni in datum sta obvezna')
      return
    }
    onSave({ employeeId, jobId: jobId || null, date, startTime, endTime, breakMinutes, status, notes })
  }

  const hours = calcHours(startTime, endTime, breakMinutes)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {isEditing ? 'Uredi izmeno' : 'Nova izmena'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Zaposleni */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zaposleni</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Zaposleni *</label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Izberi zaposlenega" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Delovno mesto</label>
                <Select value={jobId || 'none'} onValueChange={v => setJobId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Brez" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brez posebne vloge</SelectItem>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Čas */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Čas</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium">Datum *</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Od</label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    {TIME_SLOTS.map(t => <SelectItem key={`${t}-30`} value={`${t.slice(0, 3)}30`}>{`${t.slice(0, 3)}30`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Do</label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    {TIME_SLOTS.map(t => <SelectItem key={`${t}-30`} value={`${t.slice(0, 3)}30`}>{`${t.slice(0, 3)}30`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Odmor (min)</label>
                <Select value={String(breakMinutes)} onValueChange={v => setBreakMinutes(parseInt(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Brez</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={`text-sm font-medium p-2 rounded-lg ${hours > 8 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
              <Clock className="h-3.5 w-3.5 inline mr-1" />
              Skupaj: {hours.toFixed(1)} ur {hours > 8 ? '(podaljšek!)' : hours >= 6 ? '(polna izmena)' : '(skrajšana izmena)'}
            </div>
          </div>

          {/* Status in opombe */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Načrtovana</SelectItem>
                    <SelectItem value="in_progress">V teku</SelectItem>
                    <SelectItem value="completed">Zaključena</SelectItem>
                    <SelectItem value="absent">Odsoten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Opombe</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Napredek, nadomestilo..." className="h-9 text-sm" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari izmeno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
