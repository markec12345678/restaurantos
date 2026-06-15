'use client'

import { useCallback } from 'react'
import { addDays, startOfWeek, format } from 'date-fns'
import { useSchedulerQueries } from './queries'
import { useSchedulerMutations } from './mutations'
import type { ShiftType } from '../constants'

// ============================================
// HOOK: Razpored zaposlenih — Glavni barrel
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useStaffScheduler() {
  const queries = useSchedulerQueries()
  const mutations = useSchedulerMutations()

  // ─── Navigacija ───
  const navigateWeek = useCallback((dir: number) => {
    queries.setWeekStart(prev => addDays(prev, dir * 7))
  }, [queries])

  const goToThisWeek = useCallback(() => {
    queries.setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }, [queries])

  // ─── Odpri dialog za novo izmeno ───
  const openNewShift = useCallback((_date?: Date, _employeeId?: string) => {
    mutations.setEditingShift(null)
    mutations.setDialogOpen(true)
  }, [mutations])

  const handleShiftStatusChange = useCallback((id: string, status: string) => {
    mutations.statusMutation.mutate({ id, status })
  }, [mutations])

  const handleEditShift = useCallback((shift: ShiftType) => {
    mutations.setEditingShift(shift)
    mutations.setDialogOpen(true)
  }, [mutations])

  const handleDeleteShift = useCallback((id: string) => {
    mutations.deleteMutation.mutate(id)
  }, [mutations])

  const handleDialogClose = useCallback(() => {
    mutations.setDialogOpen(false)
    mutations.setEditingShift(null)
  }, [mutations])

  const handleCopyWeek = useCallback(() => {
    const source = mutations.copySourceDate || format(addDays(queries.weekStart, -7), 'yyyy-MM-dd')
    mutations.copyWeekMutation.mutate({ sourceDate: source, targetWeekStart: format(queries.weekStart, 'yyyy-MM-dd') })
  }, [mutations, queries])

  const handleCopyDialogClose = useCallback(() => {
    mutations.setCopyDialogOpen(false)
  }, [mutations])

  return {
    // Stanja
    weekStart: queries.weekStart, weekEnd: queries.weekEnd, weekDates: queries.weekDates,
    dialogOpen: mutations.dialogOpen, setDialogOpen: mutations.setDialogOpen,
    editingShift: mutations.editingShift,
    selectedEmployee: queries.selectedEmployee, setSelectedEmployee: queries.setSelectedEmployee,
    copyDialogOpen: mutations.copyDialogOpen, setCopyDialogOpen: mutations.setCopyDialogOpen,
    copySourceDate: mutations.copySourceDate, setCopySourceDate: mutations.setCopySourceDate,
    // Podatki
    shifts: queries.shifts, employees: queries.employees, jobs: queries.jobs,
    shiftsByDate: queries.shiftsByDate, shiftsByEmployee: queries.shiftsByEmployee,
    isLoading: queries.isLoading, stats: queries.stats,
    // Mutacije
    saveMutation: mutations.saveMutation, deleteMutation: mutations.deleteMutation,
    // Handlerji
    navigateWeek, goToThisWeek,
    openNewShift, handleShiftStatusChange, handleEditShift,
    handleDeleteShift, handleDialogClose,
    handleCopyWeek, handleCopyDialogClose,
  }
}
