// ============================================
// INTEGRACIJSKI SISTEM — Custom hook za poslovno logiko
// ============================================

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import type { IntegrationConnector } from '@/lib/integrations/connectors'
import { queryKeys } from '@/lib/query-keys'
import type { IntegrationItem, FormData } from './constants'
import { useIntegrationMutations } from './useIntegrationMutations'

export function useIntegrationManager() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  // Dijalog za vnos/urejanje
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<IntegrationItem | null>(null)
  const [selectedConnector, setSelectedConnector] = useState<IntegrationConnector | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'custom',
    provider: 'custom',
    baseUrl: '',
    apiKey: '',
    apiSecret: '',
    config: '{}',
    syncEnabled: true,
    syncInterval: 300,
    events: [],
    isActive: true,
  })

  // Dijalog za brisanje
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<IntegrationItem | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const { data: integrations, isLoading } = useQuery<IntegrationItem[]>({
    queryKey: queryKeys.integrations.all,
    queryFn: async () => {
      const res = await authFetch('/api/integrations')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const allIntegrations = Array.isArray(integrations) ? integrations : []

  const filteredIntegrations = useMemo(() => {
    let items = allIntegrations
    if (filterType !== 'all') items = items.filter(i => i.type === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.provider.toLowerCase().includes(q)
      )
    }
    return items
  }, [allIntegrations, search, filterType])

  const activeCount = allIntegrations.filter(i => i.isActive).length
  const connectedCount = allIntegrations.filter(i => i.connectionStatus === 'connected').length
  const errorCount = allIntegrations.filter(i => i.connectionStatus === 'error').length

  // ============================================
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================

  const {
    createMutation,
    updateMutation,
    deleteMutation,
    testMutation: testMut,
    syncMutation: syncMut,
  } = useIntegrationMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEdit: () => setEditingItem(null),
    onCloseDelete: () => setDeleteDialogOpen(false),
    onClearDeleteTarget: () => setDeleteTarget(null),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = useCallback(() => {
    setEditingItem(null)
    setSelectedConnector(null)
    setFormData({ name: '', type: 'custom', provider: 'custom', baseUrl: '', apiKey: '', apiSecret: '', config: '{}', syncEnabled: true, syncInterval: 300, events: [], isActive: true })
    setDialogOpen(true)
  }, [])

  const selectConnector = useCallback((connector: IntegrationConnector) => {
    setSelectedConnector(connector)
    setFormData({
      name: connector.name,
      type: connector.type,
      provider: connector.provider,
      baseUrl: connector.baseUrl,
      apiKey: '',
      apiSecret: '',
      config: JSON.stringify(
        connector.configFields.reduce<Record<string, string>>((acc, f) => {
          if (f.defaultValue) acc[f.key] = f.defaultValue
          return acc
        }, {}),
        null,
        2
      ),
      syncEnabled: true,
      syncInterval: 300,
      events: connector.defaultEvents,
      isActive: true,
    })
  }, [])

  const openEdit = useCallback((item: IntegrationItem) => {
    setEditingItem(item)
    setSelectedConnector(null)
    let parsedEvents: string[] = []
    try { parsedEvents = JSON.parse(item.events || '[]') } catch { parsedEvents = [] }
    setFormData({
      name: item.name,
      type: item.type,
      provider: item.provider,
      baseUrl: item.baseUrl,
      apiKey: '', // Ne pokažemo ključev
      apiSecret: '',
      config: item.config,
      syncEnabled: item.syncEnabled,
      syncInterval: item.syncInterval,
      events: parsedEvents,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!formData.name.trim()) { toast.error('Ime je obvezno'); return }

    const payload = {
      name: formData.name,
      type: formData.type,
      provider: formData.provider,
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey || undefined,
      apiSecret: formData.apiSecret || undefined,
      config: formData.config,
      syncEnabled: formData.syncEnabled,
      syncInterval: formData.syncInterval,
      events: JSON.stringify(formData.events),
      isActive: formData.isActive,
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [formData, editingItem, updateMutation, createMutation])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingItem(null)
      setSelectedConnector(null)
    }
    setDialogOpen(open)
  }, [])

  const handleDeleteTarget = useCallback((item: IntegrationItem) => {
    setDeleteTarget(item)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

  return {
    // Stanje
    search,
    filterType,
    dialogOpen,
    editingItem,
    selectedConnector,
    formData,
    deleteDialogOpen,
    deleteTarget,
    isLoading,

    // Izračuni
    allIntegrations,
    filteredIntegrations,
    activeCount,
    connectedCount,
    errorCount,

    // Mutations status
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    testPending: testMut.isPending,
    syncPending: syncMut.isPending,

    // Handlerji
    setSearch,
    setFilterType,
    setFormData,
    openCreate,
    selectConnector,
    openEdit,
    handleSubmit,
    handleDialogOpenChange,
    handleDeleteTarget,
    handleDeleteConfirm,
    testMutation: (id: string) => testMut.mutate(id),
    syncMutation: (id: string) => syncMut.mutate(id),
    cancelDialog: () => { setDialogOpen(false); setEditingItem(null); setSelectedConnector(null) },
    setDeleteDialogOpen,
  }
}
