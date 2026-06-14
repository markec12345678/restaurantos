'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Razpored zaposlenih (Staff Scheduler)
// Toast POS + 7shifts standard
// Tedenski pogled, dodeljevanje izmen, statistika ur
// ═══════════════════════════════════════════════════════════════
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, CheckCircle2, XCircle, UserCheck, Briefcase, TrendingUp } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import { format, addDays, startOfWeek, isToday } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'
import { type EmployeeType, type ShiftType, type JobType, statusLabels, calcHours } from './scheduler/constants'

// ─── Lazy-loaded podkomponente ─────────────────────────────────
const WeekView = dynamic(
  () => import('./scheduler/WeekView').then(mod => mod.WeekView),
  { ssr: false },
)
const ShiftDialog = dynamic(
  () => import('./scheduler/ShiftDialog').then(mod => mod.ShiftDialog),
  { ssr: false },
)
const CopyWeekDialog = dynamic(
  () => import('./scheduler/CopyWeekDialog').then(mod => mod.CopyWeekDialog),
  { ssr: false },
)

// ─── GLAVNA KOMPONENTA ─────────────────────────────────────────
export const StaffScheduler = memo(function StaffScheduler() {
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
    queryKey: [...queryKeys.shifts.schedule, from, to],
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
    queryKey: queryKeys.jobs.all,
    queryFn: async () => {
      const res = await authFetch('/api/jobs')
      return res.json()
    },
  })
  const shifts: ShiftType[] = shiftsData?.shifts || shiftsData || []
  const employees: EmployeeType[] = employeesData?.employees || employeesData || []
  const jobs: JobType[] = jobsData?.jobs || jobsData || []

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
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
      setCopyDialogOpen(false)
    },
  })

  // ─── Navigacija ───
  const navigateWeek = useCallback((dir: number) => setWeekStart(prev => addDays(prev, dir * 7)), [])
  const goToThisWeek = useCallback(() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })), [])

  // ─── Odpri dialog za novo izmeno ───
  const openNewShift = useCallback((_date?: Date, _employeeId?: string) => {
    setEditingShift(null)
    setDialogOpen(true)
  }, [])
  const handleShiftStatusChange = useCallback((id: string, status: string) => {
    statusMutation.mutate({ id, status })
  }, [statusMutation])
  const handleEditShift = useCallback((shift: ShiftType) => {
    setEditingShift(shift)
    setDialogOpen(true)
  }, [])
  const handleDeleteShift = useCallback((id: string) => {
    deleteMutation.mutate(id)
  }, [deleteMutation])
  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setEditingShift(null)
  }, [])
  const handleCopyWeek = useCallback(() => {
    const source = copySourceDate || format(addDays(weekStart, -7), 'yyyy-MM-dd')
    copyWeekMutation.mutate({ sourceDate: source, targetWeekStart: format(weekStart, 'yyyy-MM-dd') })
  }, [copySourceDate, weekStart, copyWeekMutation])
  const handleCopyDialogClose = useCallback(() => {
    setCopyDialogOpen(false)
  }, [])

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
            {/* Kopiraj teden gumb */}
            <CalendarDays className="h-4 w-4 mr-1" /> Kopiraj teden
          </Button>
          <Button size="sm" onClick={() => openNewShift()}>
            <Plus className="h-4 w-4 mr-1" /> Nova izmena
          </Button>
        </div>
      </div>
      {/* Teden navigacija + filtri */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Nazaj" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isToday(addDays(weekStart, 3)) ? 'default' : 'outline'} size="sm" onClick={goToThisWeek} className="min-w-48">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            {format(weekStart, 'd. MMM', { locale: sl })} — {format(weekEnd, 'd. MMM yyyy', { locale: sl })}
          </Button>
          <Button variant="outline" size="icon" aria-label="Naprej" className="h-8 w-8" onClick={() => navigateWeek(1)}>
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

      {/* Tedenski razpored — lazy-loaded */}
      <WeekView
        weekDates={weekDates}
        shiftsByDate={shiftsByDate}
        shiftsByEmployee={shiftsByEmployee}
        filteredShifts={filteredShifts}
        isLoading={isLoading}
        onAddShift={openNewShift}
        onEditShift={handleEditShift}
        onDeleteShift={handleDeleteShift}
        onStatusChange={handleShiftStatusChange}
      />

      {/* Dialog za novo/uredi izmeno — lazy-loaded */}
      <ShiftDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        shift={editingShift}
        employees={employees}
        jobs={jobs}
        weekDates={weekDates}
        onSave={saveMutation.mutate}
      />

      {/* Dialog za kopiranje tedna — lazy-loaded */}
      <CopyWeekDialog
        open={copyDialogOpen}
        onClose={handleCopyDialogClose}
        onOpenChange={setCopyDialogOpen}
        copySourceDate={copySourceDate}
        onCopySourceDateChange={setCopySourceDate}
        defaultSourceDate={format(addDays(weekStart, -7), 'yyyy-MM-dd')}
        onCopy={handleCopyWeek}
      />
    </div>
  )
})
