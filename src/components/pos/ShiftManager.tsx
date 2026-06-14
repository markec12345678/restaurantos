'use client'

import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { CalendarDays, Clock } from 'lucide-react'
import { useState, useCallback, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'
import { type ShiftItem, type TimeEntryItem, type Employee, type Job, type ShiftFormState } from './shift/constants'
import { useShiftMutations } from './shift/useShiftMutations'

// Lazy-loaded podkomponente
const ShiftSummaryCards = dynamic(() => import('./shift/ShiftSummaryCards').then(m => ({ default: m.ShiftSummaryCards })), { ssr: false })
const ShiftsTab = dynamic(() => import('./shift/ShiftsTab').then(m => ({ default: m.ShiftsTab })), { ssr: false })
const TimeTab = dynamic(() => import('./shift/TimeTab').then(m => ({ default: m.TimeTab })), { ssr: false })
const ShiftDialog = dynamic(() => import('./shift/ShiftDialog').then(m => ({ default: m.ShiftDialog })), { ssr: false })
const DeleteShiftDialog = dynamic(() => import('./shift/DeleteShiftDialog').then(m => ({ default: m.DeleteShiftDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const ShiftManager = memo(function ShiftManager() {
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
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================

  const {
    createShiftMutation,
    updateShiftMutation,
    deleteShiftMutation,
    clockInMutation,
    clockOutMutation,
  } = useShiftMutations({
    onCloseShiftDialog: () => setShiftDialogOpen(false),
    onClearEditingShift: () => setEditingShift(null),
    onCloseDeleteDialog: () => setDeleteShiftDialogOpen(false),
    onResetClockInFields: () => { setClockInEmployeeId(''); setClockInJobId('') },
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

  const handleShiftDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingShift(null)
    setShiftDialogOpen(open)
  }, [])

  const handleDeleteShift = useCallback((shift: ShiftItem) => {
    setDeleteShiftTarget(shift)
    setDeleteShiftDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteShiftTarget) deleteShiftMutation.mutate(deleteShiftTarget.id)
  }, [deleteShiftTarget, deleteShiftMutation])

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
      <ShiftSummaryCards
        scheduledCount={scheduledCount}
        inProgressCount={inProgressCount}
        completedCount={completedCount}
        totalHoursToday={totalHoursToday}
      />

      {/* Zavihki */}
      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts"><CalendarDays className="h-4 w-4 mr-1.5" />Izmene</TabsTrigger>
          <TabsTrigger value="time"><Clock className="h-4 w-4 mr-1.5" />Ure</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="space-y-4">
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

        <TabsContent value="time" className="space-y-4">
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
        onOpenChange={setDeleteShiftDialogOpen}
        onConfirm={handleDeleteConfirm}
        isPending={deleteShiftMutation.isPending}
      />
    </div>
  )
})
