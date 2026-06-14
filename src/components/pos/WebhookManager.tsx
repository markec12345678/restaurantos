'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Webhook } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { WebhookItem, FormData } from './webhook/constants'
import { useWebhookMutations } from './webhook/useWebhookMutations'

// Lazy-loaded pod-komponente
const StatsCards = dynamic(() => import('./webhook/StatsCards').then(m => ({ default: m.StatsCards })), { ssr: false })
const WebhookTable = dynamic(() => import('./webhook/WebhookTable').then(m => ({ default: m.WebhookTable })), { ssr: false })
const WebhookDialog = dynamic(() => import('./webhook/WebhookDialog').then(m => ({ default: m.WebhookDialog })), { ssr: false })
const DeleteDialog = dynamic(() => import('./webhook/DeleteDialog').then(m => ({ default: m.DeleteDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const WebhookManager = memo(function WebhookManager() {
  // --- Stanja ---
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // --- Dijalog za vnos/urejanje ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WebhookItem | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    url: '',
    events: [],
    secret: '',
    isActive: true,
  })

  // --- Dijalog za brisanje ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WebhookItem | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const { data: webhooks, isLoading } = useQuery<WebhookItem[]>({
    queryKey: queryKeys.webhooks.all,
    queryFn: async () => {
      const res = await authFetch('/api/webhooks')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const allWebhooks = Array.isArray(webhooks) ? webhooks : []

  const filteredWebhooks = useMemo(() => {
    let items = allWebhooks
    if (!showInactive) items = items.filter(w => w.isActive)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.url.toLowerCase().includes(q)
      )
    }
    return items
  }, [allWebhooks, search, showInactive])

  const webhookStats = useMemo(() => ({
    activeCount: allWebhooks.filter(w => w.isActive).length,
    totalEvents: allWebhooks.reduce((sum, w) => {
      try { return sum + JSON.parse(w.events || '[]').length } catch { return sum }
    }, 0),
    failedCount: allWebhooks.filter(w => w.failureCount > 0).length,
  }), [allWebhooks])

  const { activeCount, totalEvents, failedCount } = webhookStats

  // ============================================
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================

  const {
    createMutation,
    updateMutation,
    deleteMutation,
  } = useWebhookMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEditingItem: () => setEditingItem(null),
    onCloseDeleteDialog: () => setDeleteDialogOpen(false),
    onClearDeleteTarget: () => setDeleteTarget(null),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = useCallback(() => {
    setEditingItem(null)
    setFormData({ name: '', url: '', events: [], secret: '', isActive: true })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((item: WebhookItem) => {
    setEditingItem(item)
    let parsedEvents: string[] = []
    try { parsedEvents = JSON.parse(item.events || '[]') } catch { parsedEvents = [] }
    setFormData({
      name: item.name,
      url: item.url,
      events: parsedEvents,
      secret: item.secret,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!formData.name.trim()) { toast.error('Ime je obvezno'); return }
    if (!formData.url.trim()) { toast.error('URL je obvezen'); return }
    if (formData.events.length === 0) { toast.error('Izberite vsaj en dogodek'); return }

    const payload = {
      name: formData.name,
      url: formData.url,
      events: JSON.stringify(formData.events),
      secret: formData.secret,
      isActive: formData.isActive,
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [formData, editingItem, updateMutation, createMutation])

  const toggleEvent = useCallback((eventValue: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter(e => e !== eventValue)
        : [...prev.events, eventValue],
    }))
  }, [])

  const testWebhook = useCallback(async (item: WebhookItem) => {
    try {
      const res = await authFetch('/api/webhooks/test', {
        method: 'POST',
        body: JSON.stringify({ url: item.url, secret: item.secret }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success(`Testni webhook uspešno dostavljen`, { description: `HTTP ${result.statusCode} — ${result.durationMs}ms` })
      } else {
        toast.error(`Testni webhook ni uspel`, { description: `HTTP ${result.statusCode || 'timeout'} — ${result.responseBody || 'Ni odziva'}` })
      }
    } catch {
      toast.error('Napaka pri pošiljanju testnega webhooka')
    }
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingItem(null)
    setDialogOpen(open)
  }, [])

  const handleDeleteTarget = useCallback((item: WebhookItem) => {
    setDeleteTarget(item)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
  }, [deleteTarget, deleteMutation])

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
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
            <Webhook className="h-5 w-5 text-primary" />
            Spletne kljuke
          </h2>
          <p className="text-sm text-muted-foreground">Upravljanje webhook integracij za obvestila v realnem času</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj webhook
        </Button>
      </div>

      {/* Povzetek */}
      <StatsCards
        totalCount={allWebhooks.length}
        activeCount={activeCount}
        totalEvents={totalEvents}
        failedCount={failedCount}
      />

      {/* Filtri in tabela */}
      <WebhookTable
        filteredWebhooks={filteredWebhooks}
        search={search}
        showInactive={showInactive}
        onSearchChange={setSearch}
        onShowInactiveChange={setShowInactive}
        onTest={testWebhook}
        onEdit={openEdit}
        onDelete={handleDeleteTarget}
        onAdd={openCreate}
      />

      {/* Dijalog za vnos/urejanje */}
      <WebhookDialog
        open={dialogOpen}
        editingItem={editingItem}
        formData={formData}
        onOpenChange={handleDialogOpenChange}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        onToggleEvent={toggleEvent}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dijalog za brisanje */}
      <DeleteDialog
        open={deleteDialogOpen}
        deleteTarget={deleteTarget}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
})
