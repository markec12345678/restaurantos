'use client'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { useState, useCallback, useMemo } from 'react'
import { type ShiftItem, type TimeEntryItem, type Employee, type Job, type ShiftFormState } from './constants'
import { useShiftMutations } from './useShiftMutations'

// ============================================
// HOOK: Upravljanje izmen in ur
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useShiftManager() {
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

  return {
    // Stanja
    shiftDialogOpen, setShiftDialogOpen,
    editingShift,
    shiftForm, setShiftForm,
    deleteShiftDialogOpen, setDeleteShiftDialogOpen,
    deleteShiftTarget,
    clockInEmployeeId, setClockInEmployeeId,
    clockInJobId, setClockInJobId,

    // Podatki
    employeesList, jobs,
    allShifts, shiftsLoading,
    activeEntries, completedEntries, entriesLoading,
    scheduledCount, inProgressCount, completedCount, totalHoursToday,

    // Mutacije
    createShiftMutation, updateShiftMutation, deleteShiftMutation,
    clockInMutation,

    // Handlerji
    openCreateShift, openEditShift, handleShiftSubmit,
    startShift, completeShift, markAbsent,
    handleClockIn, handleClockOut,
    handleShiftDialogOpenChange,
    handleDeleteShift, handleDeleteConfirm,
  }
}
