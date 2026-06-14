'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Razpored zaposlenih (Staff Scheduler)
// Toast POS + 7shifts standard
// Tedenski pogled, dodeljevanje izmen, statistika ur
// ═══════════════════════════════════════════════════════════════
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, memo } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  type EmployeeType,
  type ShiftType,
  type JobType,
  type SchedulerStats,
  calcHours,
  statusLabels,
} from './scheduler/constants'

// Lazy-loaded podkomponente
const SchedulerHeader = dynamic(() => import('./scheduler/SchedulerHeader').then(m => ({ default: m.SchedulerHeader })), { ssr: false })
const WeekNavigator = dynamic(() => import('./scheduler/WeekNavigator').then(m => ({ default: m.WeekNavigator })), { ssr: false })
const StatsCards = dynamic(() => import('./scheduler/StatsCards').then(m => ({ default: m.StatsCards })), { ssr: false })
const WeekView = dynamic(() => import('./scheduler/WeekView').then(m => ({ default: m.WeekView })), { ssr: false })
const ShiftDialog = dynamic(() => import('./scheduler/ShiftDialog').then(m => ({ default: m.ShiftDialog })), { ssr: false })
const CopyWeekDialog = dynamic(() => import('./scheduler/CopyWeekDialog').then(m => ({ default: m.CopyWeekDialog })), { ssr: false })

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
  const stats = useMemo<SchedulerStats>(() => {
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
      <SchedulerHeader
        stats={stats}
        filteredShiftsCount={filteredShifts.length}
        onCopyWeek={() => setCopyDialogOpen(true)}
        onNewShift={() => openNewShift()}
      />
      {/* Teden navigacija + filtri */}
      <WeekNavigator
        weekStart={weekStart}
        weekEnd={weekEnd}
        selectedEmployee={selectedEmployee}
        employees={employees}
        onNavigateWeek={navigateWeek}
        onGoToThisWeek={goToThisWeek}
        onEmployeeChange={setSelectedEmployee}
      />
      {/* Statisticne kartice */}
      <StatsCards stats={stats} />
      {/* Tedenski razpored */}
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
      {/* Dialog za novo/uredi izmeno */}
      <ShiftDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        shift={editingShift}
        employees={employees}
        jobs={jobs}
        weekDates={weekDates}
        onSave={saveMutation.mutate}
      />
      {/* Dialog za kopiranje tedna */}
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
