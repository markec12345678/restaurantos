'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Plug } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import type { IntegrationConnector } from '@/lib/integrations/connectors'
import { queryKeys } from '@/lib/query-keys'
import type { IntegrationItem, FormData } from './integration/constants'

// Lazy-loaded pod-komponente
const StatsCards = dynamic(() => import('./integration/StatsCards').then((m) => m.StatsCards), { ssr: false })
const IntegrationTable = dynamic(() => import('./integration/IntegrationTable').then((m) => m.IntegrationTable), { ssr: false })
const IntegrationDialog = dynamic(() => import('./integration/IntegrationDialog').then((m) => m.IntegrationDialog), { ssr: false })
const DeleteDialog = dynamic(() => import('./integration/DeleteDialog').then((m) => m.DeleteDialog), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const IntegrationManager = memo(function IntegrationManager() {
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

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Integracije
          </h2>
          <p className="text-sm text-muted-foreground">Povezave z zunanjimi sistemi: e-Računi, računovodstvo, dostava, CRM</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj integracijo
        </Button>
      </div>

      {/* Povzetek */}
      <StatsCards
        totalCount={allIntegrations.length}
        connectedCount={connectedCount}
        activeCount={activeCount}
        errorCount={errorCount}
      />

      {/* Tabela in filtri */}
      <IntegrationTable
        filteredIntegrations={filteredIntegrations}
        search={search}
        filterType={filterType}
        onSearchChange={setSearch}
        onFilterTypeChange={setFilterType}
        onTest={(id) => testMutation.mutate(id)}
        onSync={(id) => syncMutation.mutate(id)}
        onEdit={openEdit}
        onDelete={handleDeleteTarget}
        onAdd={openCreate}
        testPending={testMutation.isPending}
        syncPending={syncMutation.isPending}
      />

      {/* Dijalog za vnos/urejanje */}
      <IntegrationDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingItem={editingItem}
        selectedConnector={selectedConnector}
        formData={formData}
        onFormDataChange={setFormData}
        onSelectConnector={selectConnector}
        onSubmit={handleSubmit}
        onCancel={() => { setDialogOpen(false); setEditingItem(null); setSelectedConnector(null) }}
        isCreating={createMutation.isPending}
        isUpdating={updateMutation.isPending}
      />

      {/* Dijalog za brisanje */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleteTarget={deleteTarget}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
})
