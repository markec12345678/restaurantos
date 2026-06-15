'use client'

import { useShiftHandlers } from './useShiftHandlers'
import { useShiftQueries } from './useShiftQueries'
import { useShiftComputations } from './useShiftComputations'

export function useShiftManager() {
  const handlers = useShiftHandlers()
  const queries = useShiftQueries()
  const computations = useShiftComputations(queries.employees, queries.shifts, queries.timeEntries)

  return {
    shiftDialogOpen: handlers.shiftDialogOpen, setShiftDialogOpen: handlers.setShiftDialogOpen,
    editingShift: handlers.editingShift,
    shiftForm: handlers.shiftForm, setShiftForm: handlers.setShiftForm,
    deleteShiftDialogOpen: handlers.deleteShiftDialogOpen, setDeleteShiftDialogOpen: handlers.setDeleteShiftDialogOpen,
    deleteShiftTarget: handlers.deleteShiftTarget,
    clockInEmployeeId: handlers.clockInEmployeeId, setClockInEmployeeId: handlers.setClockInEmployeeId,
    clockInJobId: handlers.clockInJobId, setClockInJobId: handlers.setClockInJobId,
    employeesList: computations.employeesList, jobs: queries.jobs,
    allShifts: computations.allShifts, shiftsLoading: queries.shiftsLoading,
    activeEntries: computations.activeEntries, completedEntries: computations.completedEntries, entriesLoading: queries.entriesLoading,
    scheduledCount: computations.scheduledCount, inProgressCount: computations.inProgressCount, completedCount: computations.completedCount, totalHoursToday: computations.totalHoursToday,
    createShiftMutation: handlers.createShiftMutation, updateShiftMutation: handlers.updateShiftMutation, deleteShiftMutation: handlers.deleteShiftMutation,
    clockInMutation: handlers.clockInMutation,
    openCreateShift: handlers.openCreateShift, openEditShift: handlers.openEditShift, handleShiftSubmit: handlers.handleShiftSubmit,
    startShift: handlers.startShift, completeShift: handlers.completeShift, markAbsent: handlers.markAbsent,
    handleClockIn: () => handlers.handleClockIn(computations.activeEntries), handleClockOut: handlers.handleClockOut,
    handleShiftDialogOpenChange: handlers.handleShiftDialogOpenChange,
    handleDeleteShift: handlers.handleDeleteShift, handleDeleteConfirm: handlers.handleDeleteConfirm,
  }
}
