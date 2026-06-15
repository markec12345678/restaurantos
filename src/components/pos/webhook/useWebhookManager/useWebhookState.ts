'use client'
// useWebhookManager — Stanja, poizvedbe in izračuni

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { WebhookItem, FormData } from '../constants'

export function useWebhookState() {
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

  return {
    search, setSearch,
    showInactive, setShowInactive,
    dialogOpen, setDialogOpen,
    editingItem, setEditingItem,
    formData, setFormData,
    deleteDialogOpen, setDeleteDialogOpen,
    deleteTarget, setDeleteTarget,
    isLoading,
    allWebhooks, filteredWebhooks,
    activeCount, totalEvents, failedCount,
  }
}
