'use client'

import { useState, useMemo } from 'react'
import type { IntegrationConnector } from '@/lib/integrations/connectors'
import type { IntegrationItem, FormData } from '../constants'
import { useIntegrationMutations } from '../useIntegrationMutations'

export function useIntegrationState() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<IntegrationItem | null>(null)
  const [selectedConnector, setSelectedConnector] = useState<IntegrationConnector | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '', type: 'custom', provider: 'custom', baseUrl: '', apiKey: '', apiSecret: '',
    config: '{}', syncEnabled: true, syncInterval: 300, events: [], isActive: true,
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<IntegrationItem | null>(null)

  const {
    createMutation, updateMutation, deleteMutation,
    testMutation: testMut, syncMutation: syncMut,
  } = useIntegrationMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEdit: () => setEditingItem(null),
    onCloseDelete: () => setDeleteDialogOpen(false),
    onClearDeleteTarget: () => setDeleteTarget(null),
  })

  return {
    search, setSearch, filterType, setFilterType,
    dialogOpen, setDialogOpen, editingItem, setEditingItem,
    selectedConnector, setSelectedConnector, formData, setFormData,
    deleteDialogOpen, setDeleteDialogOpen, deleteTarget, setDeleteTarget,
    createMutation, updateMutation, deleteMutation, testMut, syncMut,
  }
}

export function useIntegrationComputed(allIntegrations: IntegrationItem[], search: string, filterType: string) {
  const filteredIntegrations = useMemo(() => {
    let items = allIntegrations
    if (filterType !== 'all') items = items.filter(i => i.type === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.provider.toLowerCase().includes(q))
    }
    return items
  }, [allIntegrations, search, filterType])

  const activeCount = allIntegrations.filter(i => i.isActive).length
  const connectedCount = allIntegrations.filter(i => i.connectionStatus === 'connected').length
  const errorCount = allIntegrations.filter(i => i.connectionStatus === 'error').length

  return { filteredIntegrations, activeCount, connectedCount, errorCount }
}
