// ============================================
// HOOK — useHaccpManager
// Enkapsulira vsa stanja, poizvedbe, mutacije in handlerje
// ============================================

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { formatDateSI, isToday } from './utils'
import type { HaccpEntry, HaccpFormData } from './types'
import { useHaccpMutations } from './useHaccpMutations'

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
  editingEntry: HaccpEntry | null
  formData: HaccpFormData
  setFormData: React.Dispatch<React.SetStateAction<HaccpFormData>>
  deleteDialogOpen: boolean
  deleteTarget: HaccpEntry | null
  expandedEntry: string | null
  setExpandedEntry: (_id: string | null) => void

  // Podatki
  isLoading: boolean
  allEntries: HaccpEntry[]
  filteredEntries: HaccpEntry[]
  todayEntries: HaccpEntry[]
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
  openEdit: (_entry: HaccpEntry) => void
  handleSubmit: () => void
  confirmDelete: (_entry: HaccpEntry) => void
  resetFilters: () => void
  handleDialogOpenChange: (_open: boolean) => void
  handleDeleteConfirm: () => void
  setDeleteDialogOpen: (_open: boolean) => void
}

export function useHaccpManager(): UseHaccpManagerReturn {
  // --- Stanja ---
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // --- Dijalog za vnos/urejanje ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<HaccpEntry | null>(null)
  const [formData, setFormData] = useState<HaccpFormData>({
    category: 'temperature',
    title: '',
    description: '',
    value: '',
    status: 'ok',
    correctiveAction: '',
    employeeName: '',
  })

  // --- Dijalog za brisanje ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HaccpEntry | null>(null)

  // --- Razširjeni vnosi ---
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  // ============================================
  // MUTATIONS (iz useHaccpMutations)
  // ============================================

  const { createMutation, updateMutation, deleteMutation } = useHaccpMutations({
    setDialogOpen,
    setEditingEntry: () => setEditingEntry(null),
    setDeleteDialogOpen,
    setDeleteTarget: () => setDeleteTarget(null),
  })

  // ============================================
  // QUERIES
  // ============================================

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (activeTab !== 'all') params.set('category', activeTab)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return params.toString()
  }, [activeTab, dateFrom, dateTo])

  const { data: entries, isLoading } = useQuery<HaccpEntry[]>({
    queryKey: [...queryKeys.haccp.all, activeTab, dateFrom, dateTo],
    queryFn: async () => {
      const res = await authFetch(`/api/haccp?${queryParams}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI ZA POVZETEK
  // ============================================

  const allEntries = Array.isArray(entries) ? entries : []

  const filteredEntries = useMemo(() => allEntries.filter((entry) =>
    entry.title.toLowerCase().includes(search.toLowerCase()) ||
    entry.description.toLowerCase().includes(search.toLowerCase()) ||
    entry.employeeName.toLowerCase().includes(search.toLowerCase())
  ), [allEntries, search])

  const todayEntries = useMemo(() => allEntries.filter((e) => isToday(e.date)), [allEntries])
  const warningCount = useMemo(() => allEntries.filter((e) => e.status === 'warning').length, [allEntries])
  const criticalCount = useMemo(() => allEntries.filter((e) => e.status === 'critical').length, [allEntries])
  const lastEntryTime = allEntries.length > 0
    ? formatDateSI(allEntries[0].createdAt)
    : 'Ni vnosov'

  // ============================================
  // HANDLERJI
  // ============================================

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
  }, [])

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
  }, [])

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
  }, [])

  const resetFilters = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    setSearch('')
    setActiveTab('all')
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingEntry(null)
    }
    setDialogOpen(open)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

  const hasActiveFilters = !!(dateFrom || dateTo || search || activeTab !== 'all')

  return {
    activeTab, setActiveTab, search, setSearch,
    dateFrom, setDateFrom, dateTo, setDateTo,
    showFilters, setShowFilters,
    dialogOpen, editingEntry, formData, setFormData,
    deleteDialogOpen, deleteTarget, expandedEntry, setExpandedEntry,
    isLoading, allEntries, filteredEntries, todayEntries,
    warningCount, criticalCount, lastEntryTime, hasActiveFilters,
    isCreatePending: createMutation.isPending,
    isUpdatePending: updateMutation.isPending,
    isDeletePending: deleteMutation.isPending,
    openCreate, openEdit, handleSubmit, confirmDelete,
    resetFilters, handleDialogOpenChange, handleDeleteConfirm, setDeleteDialogOpen,
  }
}
