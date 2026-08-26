import { useCallback } from 'react'
import { toast } from 'sonner'
import type { HaccpEntry, HaccpFormData } from '../types'
import { useHaccpMutations } from '../useHaccpMutations'

export function useHaccpHandlers(
  formData: HaccpFormData,
  setFormData: React.Dispatch<React.SetStateAction<HaccpFormData>>,
  editingEntry: HaccpEntry | null,
  setEditingEntry: (_entry: HaccpEntry | null) => void,
  setDialogOpen: (_open: boolean) => void,
  deleteTarget: HaccpEntry | null,
  setDeleteDialogOpen: (_open: boolean) => void,
  setDeleteTarget: (_entry: HaccpEntry | null) => void,
  setActiveTab: (_tab: string) => void,
  setSearch: (_search: string) => void,
  setDateFrom: (_date: string) => void,
  setDateTo: (_date: string) => void,
) {
  const { createMutation, updateMutation, deleteMutation } = useHaccpMutations({
    setDialogOpen,
    setEditingEntry: () => setEditingEntry(null),
    setDeleteDialogOpen,
    setDeleteTarget: () => setDeleteTarget(null),
  })

  const openCreate = useCallback((presetCategory?: string, presetTitle?: string, presetValue?: string) => {
    setEditingEntry(null)
    setFormData({
      category: presetCategory || 'temperature',
      title: presetTitle || '',
      description: '',
      value: presetValue || '',
      status: 'ok',
      correctiveAction: '',
      employeeName: '',
    })
    setDialogOpen(true)
  }, [setEditingEntry, setFormData, setDialogOpen])

  const openEdit = useCallback((entry: HaccpEntry) => {
    setEditingEntry(entry)
    setFormData({
      category: entry.category,
      title: entry.title,
      description: entry.description,
      value: entry.value,
      status: entry.status,
      correctiveAction: entry.correctiveAction,
      employeeName: entry.employeeName,
    })
    setDialogOpen(true)
  }, [setEditingEntry, setFormData, setDialogOpen])

  const handleSubmit = useCallback(() => {
    if (!formData.title.trim()) {
      toast.error('Naslov vnosa je obvezen')
      return
    }
    if (!formData.employeeName.trim()) {
      toast.error('Ime zaposlenega je obvezno')
      return
    }

    const payload = {
      ...formData,
      date: new Date().toISOString(),
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [formData, editingEntry, updateMutation, createMutation])

  const confirmDelete = useCallback((entry: HaccpEntry) => {
    setDeleteTarget(entry)
    setDeleteDialogOpen(true)
  }, [setDeleteTarget, setDeleteDialogOpen])

  const resetFilters = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    setSearch('')
    setActiveTab('all')
  }, [setDateFrom, setDateTo, setSearch, setActiveTab])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingEntry(null)
    }
    setDialogOpen(open)
  }, [setEditingEntry, setDialogOpen])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

  return {
    openCreate,
    openEdit,
    handleSubmit,
    confirmDelete,
    resetFilters,
    handleDialogOpenChange,
    handleDeleteConfirm,
    isCreatePending: createMutation.isPending,
    isUpdatePending: updateMutation.isPending,
    isDeletePending: deleteMutation.isPending,
  }
}
