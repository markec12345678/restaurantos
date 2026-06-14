// ============================================
// INTEGRACIJSKI SISTEM — Custom hook za poslovno logiko
// ============================================

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import type { IntegrationConnector } from '@/lib/integrations/connectors'
import { queryKeys } from '@/lib/query-keys'
import type { IntegrationItem, FormData } from './constants'

export function useIntegrationManager() {
  const queryClient = useQueryClient()

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
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/integrations', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju integracije'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/integrations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: () => toast.error('Napaka pri posodabljanju integracije'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => toast.error('Napaka pri brisanju integracije'),
  })

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}/test`, { method: 'POST' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (data) => {
      if (data.status === 'connected') {
        toast.success('Povezava uspešna', { description: `Odziv v ${data.durationMs}ms` })
      } else {
        toast.error('Povezava ni uspela', { description: data.error || `HTTP ${data.statusCode}` })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
    },
    onError: () => toast.error('Napaka pri testiranju povezave'),
  })

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}/sync`, { method: 'POST' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (data) => {
      if (data.status === 'success') {
        toast.success('Sinhronizacija uspešna', { description: `Trajanje: ${data.durationMs}ms` })
      } else {
        toast.error('Sinhronizacija ni uspela', { description: data.error })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
    },
    onError: () => toast.error('Napaka pri sinhronizaciji'),
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
    testPending: testMutation.isPending,
    syncPending: syncMutation.isPending,

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
    testMutation: (id: string) => testMutation.mutate(id),
    syncMutation: (id: string) => syncMutation.mutate(id),
    cancelDialog: () => { setDialogOpen(false); setEditingItem(null); setSelectedConnector(null) },
    setDeleteDialogOpen,
  }
}
