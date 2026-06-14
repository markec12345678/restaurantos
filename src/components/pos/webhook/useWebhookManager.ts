'use client'
// ============================================
// HOOK: Stanje in logika za upravitelja spletnih kljuk
// Izvleče poslovno logiko iz glavne komponente
// ============================================

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { WebhookItem, FormData } from './constants'
import { useWebhookMutations } from './useWebhookMutations'

export function useWebhookManager() {
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

  return {
    // Stanja
    search,
    showInactive,
    dialogOpen,
    editingItem,
    formData,
    deleteDialogOpen,
    deleteTarget,
    isLoading,
    allWebhooks,
    filteredWebhooks,
    activeCount,
    totalEvents,
    failedCount,
    createMutation,
    updateMutation,
    // Handlerji
    setSearch,
    setShowInactive,
    setFormData,
    openCreate,
    openEdit,
    handleSubmit,
    toggleEvent,
    testWebhook,
    handleDialogOpenChange,
    handleDeleteTarget,
    handleDeleteConfirm,
    setDeleteDialogOpen,
  }
}
