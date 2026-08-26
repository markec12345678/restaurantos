'use client'

import { useState } from 'react'
import { type ShiftItem, type ShiftFormState } from '../constants'

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
