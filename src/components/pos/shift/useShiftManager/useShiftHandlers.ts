'use client'

import { toast } from 'sonner'
import { useState, useCallback } from 'react'
import { type ShiftItem, type TimeEntryItem, type ShiftFormState } from '../constants'
import { useShiftMutations } from '../useShiftMutations'

// ============================================
// STANJA — Dialogi in polja
// ============================================

export function useShiftState() {
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

  return {
    shiftDialogOpen, setShiftDialogOpen,
    editingShift, setEditingShift,
    shiftForm, setShiftForm,
    deleteShiftDialogOpen, setDeleteShiftDialogOpen,
    deleteShiftTarget, setDeleteShiftTarget,
    clockInEmployeeId, setClockInEmployeeId,
    clockInJobId, setClockInJobId,
  }
}

// ============================================
// HANDLERJI — Akcije za izmene
// ============================================

export function useShiftHandlers(
  shiftForm: ShiftFormState,
  editingShift: ShiftItem | null,
  deleteShiftTarget: ShiftItem | null,
  activeEntries: TimeEntryItem[],
  clockInEmployeeId: string,
  clockInJobId: string,
  setShiftDialogOpen: (_open: boolean) => void,
  setEditingShift: (_shift: ShiftItem | null) => void,
  setDeleteShiftDialogOpen: (_open: boolean) => void,
  setDeleteShiftTarget: (_shift: ShiftItem | null) => void,
  setClockInEmployeeId: (_id: string) => void,
  setClockInJobId: (_id: string) => void,
  setShiftForm: (_form: ShiftFormState) => void,
) {
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

  const openCreateShift = useCallback(() => {
    setEditingShift(null)
    setShiftForm({ employeeId: '', jobId: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '17:00', breakMinutes: '30', notes: '' })
    setShiftDialogOpen(true)
  }, [setEditingShift, setShiftForm, setShiftDialogOpen])

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
  }, [setEditingShift, setShiftForm, setShiftDialogOpen])

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
  }, [setEditingShift, setShiftDialogOpen])

  const handleDeleteShift = useCallback((shift: ShiftItem) => {
    setDeleteShiftTarget(shift)
    setDeleteShiftDialogOpen(true)
  }, [setDeleteShiftTarget, setDeleteShiftDialogOpen])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteShiftTarget) deleteShiftMutation.mutate(deleteShiftTarget.id)
  }, [deleteShiftTarget, deleteShiftMutation])

  return {
    createShiftMutation, updateShiftMutation, deleteShiftMutation, clockInMutation,
    openCreateShift, openEditShift, handleShiftSubmit,
    startShift, completeShift, markAbsent,
    handleClockIn, handleClockOut,
    handleShiftDialogOpenChange,
    handleDeleteShift, handleDeleteConfirm,
  }
}
