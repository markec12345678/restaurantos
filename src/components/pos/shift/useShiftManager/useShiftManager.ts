'use client'

import { useShiftState, useShiftQueries, useShiftComputations, useShiftHandlers } from './useShiftHandlers'

// ============================================
// HOOK: Upravljanje izmen in ur
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useShiftManager() {
  const state = useShiftState()
  const queries = useShiftQueries()
  const computations = useShiftComputations(queries.employees, queries.shifts, queries.timeEntries)
  const handlers = useShiftHandlers(
    state.shiftForm, state.editingShift, state.deleteShiftTarget,
    computations.activeEntries,
    state.clockInEmployeeId, state.clockInJobId,
    state.setShiftDialogOpen, state.setEditingShift,
    state.setDeleteShiftDialogOpen, state.setDeleteShiftTarget,
    state.setClockInEmployeeId, state.setClockInJobId,
    state.setShiftForm,
  )

  return {
    // Stanja
    shiftDialogOpen: state.shiftDialogOpen, setShiftDialogOpen: state.setShiftDialogOpen,
    editingShift: state.editingShift,
    shiftForm: state.shiftForm, setShiftForm: state.setShiftForm,
    deleteShiftDialogOpen: state.deleteShiftDialogOpen, setDeleteShiftDialogOpen: state.setDeleteShiftDialogOpen,
    deleteShiftTarget: state.deleteShiftTarget,
    clockInEmployeeId: state.clockInEmployeeId, setClockInEmployeeId: state.setClockInEmployeeId,
    clockInJobId: state.clockInJobId, setClockInJobId: state.setClockInJobId,

    // Podatki
    employeesList: computations.employeesList, jobs: queries.jobs,
    allShifts: computations.allShifts, shiftsLoading: queries.shiftsLoading,
    activeEntries: computations.activeEntries, completedEntries: computations.completedEntries, entriesLoading: queries.entriesLoading,
    scheduledCount: computations.scheduledCount, inProgressCount: computations.inProgressCount, completedCount: computations.completedCount, totalHoursToday: computations.totalHoursToday,

    // Mutacije
    createShiftMutation: handlers.createShiftMutation, updateShiftMutation: handlers.updateShiftMutation, deleteShiftMutation: handlers.deleteShiftMutation,
    clockInMutation: handlers.clockInMutation,

    // Handlerji
    openCreateShift: handlers.openCreateShift, openEditShift: handlers.openEditShift, handleShiftSubmit: handlers.handleShiftSubmit,
    startShift: handlers.startShift, completeShift: handlers.completeShift, markAbsent: handlers.markAbsent,
    handleClockIn: handlers.handleClockIn, handleClockOut: handlers.handleClockOut,
    handleShiftDialogOpenChange: handlers.handleShiftDialogOpenChange,
    handleDeleteShift: handlers.handleDeleteShift, handleDeleteConfirm: handlers.handleDeleteConfirm,
  }
}
