'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { CalendarDays, Clock, Play, CheckCircle2, Timer } from 'lucide-react'
import { useState, useCallback, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'
import type { ShiftItem, TimeEntryItem, ShiftFormState, Employee, Job } from './shift/constants'

// ============================================
// LAZY-LOADED PODKOMPONENTE
// ============================================

const ShiftsTab = dynamic(
  () => import('./shift/ShiftsTab').then(mod => mod.ShiftsTab),
  { ssr: false },
)

const TimeTab = dynamic(
  () => import('./shift/TimeTab').then(mod => mod.TimeTab),
  { ssr: false },
)

const ShiftDialog = dynamic(
  () => import('./shift/ShiftDialog').then(mod => mod.ShiftDialog),
  { ssr: false },
)

const DeleteShiftDialog = dynamic(
  () => import('./shift/DeleteShiftDialog').then(mod => mod.DeleteShiftDialog),
  { ssr: false },
)

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const ShiftManager = memo(function ShiftManager() {
  const queryClient = useQueryClient()

  // --- Stanja za izmene ---
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null)
  const [shiftForm, setShiftForm] = useState<ShiftFormState>({
    employeeId: '',
    jobId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: '30',
    notes: '',
  })
  const [deleteShiftDialogOpen, setDeleteShiftDialogOpen] = useState(false)
  const [deleteShiftTarget, setDeleteShiftTarget] = useState<ShiftItem | null>(null)

  // --- Stanja za ure ---
  const [clockInEmployeeId, setClockInEmployeeId] = useState('')
  const [clockInJobId, setClockInJobId] = useState('')

  // ============================================
  // QUERIES
  // ============================================

  const { data: employees } = useQuery<Employee[]>({
    queryKey: queryKeys.employees.all,
    queryFn: async () => { const res = await authFetch('/api/employees'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  const { data: jobs } = useQuery<Job[]>({
    queryKey: queryKeys.jobs.all,
    queryFn: async () => { const res = await authFetch('/api/jobs'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  const { data: shifts, isLoading: shiftsLoading } = useQuery<ShiftItem[]>({
    queryKey: queryKeys.shifts.all,
    queryFn: async () => { const res = await authFetch('/api/shifts'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  const { data: timeEntries, isLoading: entriesLoading } = useQuery<TimeEntryItem[]>({
    queryKey: ['time-entries'],
    queryFn: async () => { const res = await authFetch('/api/time-entries'); if (!res.ok) throw new Error('Napaka'); return res.json() },
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const employeesList = Array.isArray(employees) ? employees : []
  const allShifts = shifts || []
  const allEntries = timeEntries || []

  const activeEntries = useMemo(() => allEntries.filter(e => !e.clockOut), [allEntries])
  const completedEntries = useMemo(() => allEntries.filter(e => e.clockOut).sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()), [allEntries])

  const scheduledCount = allShifts.filter(s => s.status === 'scheduled').length
  const inProgressCount = allShifts.filter(s => s.status === 'in_progress').length
  const completedCount = allShifts.filter(s => s.status === 'completed').length
  const totalHoursToday = allEntries
    .filter(e => new Date(e.clockIn).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + e.totalMinutes, 0) / 60

  // ============================================
  // MUTATIONS
  // ============================================

  const createShiftMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/shifts', { method: 'POST', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena uspešno ustvarjena'); queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all }); setShiftDialogOpen(false) },
    onError: () => toast.error('Napaka pri ustvarjanju izmene'),
  })

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena uspešno posodobljena'); queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all }); setShiftDialogOpen(false); setEditingShift(null) },
    onError: () => toast.error('Napaka pri posodabljanju izmene'),
  })

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena uspešno izbrisana'); queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all }); setDeleteShiftDialogOpen(false) },
    onError: () => toast.error('Napaka pri brisanju izmene'),
  })

  const clockInMutation = useMutation({
    mutationFn: async (data: { employeeId: string; jobId?: string; type?: string }) => {
      const res = await authFetch('/api/time-entries', { method: 'POST', body: JSON.stringify({ ...data, clockIn: new Date().toISOString() }) })
      return res.json()
    },
    onSuccess: () => { toast.success('Uspešno prijavljen'); queryClient.invalidateQueries({ queryKey: ['time-entries'] }); setClockInEmployeeId(''); setClockInJobId('') },
    onError: () => toast.error('Napaka pri prijavi'),
  })

  const clockOutMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/time-entries/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { toast.success('Uspešno odjavljen'); queryClient.invalidateQueries({ queryKey: ['time-entries'] }) },
    onError: () => toast.error('Napaka pri odjavi'),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreateShift = useCallback(() => {
    setEditingShift(null)
    setShiftForm({ employeeId: '', jobId: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '17:00', breakMinutes: '30', notes: '' })
    setShiftDialogOpen(true)
  }, [])

  const openEditShift = useCallback((shift: ShiftItem) => {
    setEditingShift(shift)
    setShiftForm({
      employeeId: shift.employeeId,
      jobId: shift.jobId || '',
      date: new Date(shift.date).toISOString().split('T')[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: String(shift.breakMinutes),
      notes: shift.notes,
    })
    setShiftDialogOpen(true)
  }, [])

  const handleShiftSubmit = useCallback(() => {
    if (!shiftForm.employeeId) { toast.error('Izberite zaposlenega'); return }
    const payload = {
      employeeId: shiftForm.employeeId,
      jobId: shiftForm.jobId || undefined,
      date: new Date(shiftForm.date).toISOString(),
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: parseInt(shiftForm.breakMinutes) || 30,
      notes: shiftForm.notes,
    }
    if (editingShift) {
      updateShiftMutation.mutate({ id: editingShift.id, ...payload })
    } else {
      createShiftMutation.mutate(payload)
    }
  }, [shiftForm, editingShift, updateShiftMutation, createShiftMutation])

  const startShift = useCallback((shift: ShiftItem) => {
    updateShiftMutation.mutate({ id: shift.id, status: 'in_progress' })
  }, [updateShiftMutation])

  const completeShift = useCallback((shift: ShiftItem) => {
    updateShiftMutation.mutate({ id: shift.id, status: 'completed' })
  }, [updateShiftMutation])

  const markAbsent = useCallback((shift: ShiftItem) => {
    updateShiftMutation.mutate({ id: shift.id, status: 'absent' })
  }, [updateShiftMutation])

  const handleClockIn = useCallback(() => {
    if (!clockInEmployeeId) { toast.error('Izberite zaposlenega'); return }
    // FIX HIGH: Prepreči duplicate clock-in — preveri, če zaposleni že ima aktivni vnos
    const hasActiveEntry = activeEntries.some((e: TimeEntryItem) => e.employeeId === clockInEmployeeId)
    if (hasActiveEntry) {
      toast.error('Ta zaposleni je že prijavljen. Najprej ga odjavite.')
      return
    }
    clockInMutation.mutate({ employeeId: clockInEmployeeId, jobId: clockInJobId || undefined })
  }, [clockInEmployeeId, clockInJobId, activeEntries, clockInMutation])

  const handleClockOut = useCallback((entryId: string) => {
    clockOutMutation.mutate({ id: entryId, clockOut: new Date().toISOString() })
  }, [clockOutMutation])

  // Handler za dijalog izmene — počišče urejanje ob zaprtju
  const handleShiftDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingShift(null)
    setShiftDialogOpen(open)
  }, [])

  // Handler za brisanje izmene
  const handleDeleteShift = useCallback((shift: ShiftItem) => {
    setDeleteShiftTarget(shift)
    setDeleteShiftDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteShiftTarget) {
      deleteShiftMutation.mutate(deleteShiftTarget.id)
    }
  }, [deleteShiftTarget, deleteShiftMutation])

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteShiftDialogOpen(open)
  }, [])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {/* Glava */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Izmene in ure
        </h2>
        <p className="text-sm text-muted-foreground">Upravljanje izmen, prijava/odjava ur in sledenje prisotnosti</p>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{scheduledCount}</p>
                <p className="text-xs text-muted-foreground">Načrtovane</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">V teku</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Zaključene</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Timer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHoursToday.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Ure danes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zavihki */}
      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts"><CalendarDays className="h-4 w-4 mr-1.5" />Izmene</TabsTrigger>
          <TabsTrigger value="time"><Clock className="h-4 w-4 mr-1.5" />Ure</TabsTrigger>
        </TabsList>

        {/* === ZAVIHEK: IZMENE === */}
        <TabsContent value="shifts">
          <ShiftsTab
            shifts={allShifts}
            shiftsLoading={shiftsLoading}
            openCreateShift={openCreateShift}
            openEditShift={openEditShift}
            startShift={startShift}
            completeShift={completeShift}
            markAbsent={markAbsent}
            onDeleteShift={handleDeleteShift}
          />
        </TabsContent>

        {/* === ZAVIHEK: URE === */}
        <TabsContent value="time">
          <TimeTab
            employeesList={employeesList}
            jobs={jobs}
            clockInEmployeeId={clockInEmployeeId}
            clockInJobId={clockInJobId}
            setClockInEmployeeId={setClockInEmployeeId}
            setClockInJobId={setClockInJobId}
            handleClockIn={handleClockIn}
            handleClockOut={handleClockOut}
            activeEntries={activeEntries}
            completedEntries={completedEntries}
            entriesLoading={entriesLoading}
            clockInPending={clockInMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Dijalog za izmeno */}
      <ShiftDialog
        open={shiftDialogOpen}
        onOpenChange={handleShiftDialogOpenChange}
        editingShift={editingShift}
        shiftForm={shiftForm}
        onShiftFormChange={setShiftForm}
        employeesList={employeesList}
        jobs={jobs}
        onSubmit={handleShiftSubmit}
        createPending={createShiftMutation.isPending}
        updatePending={updateShiftMutation.isPending}
      />

      {/* Dijalog za brisanje */}
      <DeleteShiftDialog
        open={deleteShiftDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
        onConfirm={handleDeleteConfirm}
        isPending={deleteShiftMutation.isPending}
      />
    </div>
  )
})
