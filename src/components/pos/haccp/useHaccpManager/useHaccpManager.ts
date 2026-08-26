import { useMemo } from 'react'
import { useHaccpState } from './useHaccpState'
import { useHaccpQueries } from './useHaccpQueries'
import { useHaccpHandlers } from './useHaccpHandlers'

export interface UseHaccpManagerReturn {
  // Stanja
  activeTab: string
  setActiveTab: (_tab: string) => void
  search: string
  setSearch: (_search: string) => void
  dateFrom: string
  setDateFrom: (_date: string) => void
  dateTo: string
  setDateTo: (_date: string) => void
  showFilters: boolean
  setShowFilters: (_show: boolean) => void
  dialogOpen: boolean
  editingEntry: import('../types').HaccpEntry | null
  formData: import('../types').HaccpFormData
  setFormData: React.Dispatch<React.SetStateAction<import('../types').HaccpFormData>>
  deleteDialogOpen: boolean
  deleteTarget: import('../types').HaccpEntry | null
  expandedEntry: string | null
  setExpandedEntry: (_id: string | null) => void

  // Podatki
  isLoading: boolean
  allEntries: import('../types').HaccpEntry[]
  filteredEntries: import('../types').HaccpEntry[]
  todayEntries: import('../types').HaccpEntry[]
  warningCount: number
  criticalCount: number
  lastEntryTime: string
  hasActiveFilters: boolean

  // Mutacije
  isCreatePending: boolean
  isUpdatePending: boolean
  isDeletePending: boolean

  // Handlerji
  openCreate: (_presetCategory?: string, _presetTitle?: string, _presetValue?: string) => void
  openEdit: (_entry: import('../types').HaccpEntry) => void
  handleSubmit: () => void
  confirmDelete: (_entry: import('../types').HaccpEntry) => void
  resetFilters: () => void
  handleDialogOpenChange: (_open: boolean) => void
  handleDeleteConfirm: () => void
  setDeleteDialogOpen: (_open: boolean) => void
}

export function useHaccpManager(): UseHaccpManagerReturn {
  const state = useHaccpState()
  const queries = useHaccpQueries(state.activeTab, state.dateFrom, state.dateTo)

  // Filter by search text
  const filteredEntries = useMemo(() =>
    queries.allEntries.filter((entry) =>
      entry.title.toLowerCase().includes(state.search.toLowerCase()) ||
      entry.description.toLowerCase().includes(state.search.toLowerCase()) ||
      entry.employeeName.toLowerCase().includes(state.search.toLowerCase())
    ), [queries.allEntries, state.search]
  )

  const handlers = useHaccpHandlers(
    state.formData,
    state.setFormData,
    state.editingEntry,
    state.setEditingEntry,
    state.setDialogOpen,
    state.deleteTarget,
    state.setDeleteDialogOpen,
    state.setDeleteTarget,
    state.setActiveTab,
    state.setSearch,
    state.setDateFrom,
    state.setDateTo,
  )

  const hasActiveFilters = !!(state.dateFrom || state.dateTo || state.search || state.activeTab !== 'all')

  return {
    activeTab: state.activeTab, setActiveTab: state.setActiveTab,
    search: state.search, setSearch: state.setSearch,
    dateFrom: state.dateFrom, setDateFrom: state.setDateFrom,
    dateTo: state.dateTo, setDateTo: state.setDateTo,
    showFilters: state.showFilters, setShowFilters: state.setShowFilters,
    dialogOpen: state.dialogOpen, editingEntry: state.editingEntry,
    formData: state.formData, setFormData: state.setFormData,
    deleteDialogOpen: state.deleteDialogOpen, deleteTarget: state.deleteTarget,
    expandedEntry: state.expandedEntry, setExpandedEntry: state.setExpandedEntry,
    isLoading: queries.isLoading, allEntries: queries.allEntries,
    filteredEntries, todayEntries: queries.todayEntries,
    warningCount: queries.warningCount, criticalCount: queries.criticalCount,
    lastEntryTime: queries.lastEntryTime, hasActiveFilters,
    isCreatePending: handlers.isCreatePending,
    isUpdatePending: handlers.isUpdatePending,
    isDeletePending: handlers.isDeletePending,
    openCreate: handlers.openCreate, openEdit: handlers.openEdit,
    handleSubmit: handlers.handleSubmit, confirmDelete: handlers.confirmDelete,
    resetFilters: handlers.resetFilters, handleDialogOpenChange: handlers.handleDialogOpenChange,
    handleDeleteConfirm: handlers.handleDeleteConfirm, setDeleteDialogOpen: state.setDeleteDialogOpen,
  }
}
