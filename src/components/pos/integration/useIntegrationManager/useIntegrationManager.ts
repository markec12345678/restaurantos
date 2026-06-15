'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import type { IntegrationConnector } from '@/lib/integrations/connectors'
import type { IntegrationItem } from '../constants'
import { useIntegrationQueries } from './useIntegrationQueries'
import { useIntegrationState, useIntegrationComputed } from './useIntegrationState'

export function useIntegrationManager() {
  const state = useIntegrationState()
  const queries = useIntegrationQueries()
  const computed = useIntegrationComputed(queries.allIntegrations, state.search, state.filterType)

  const openCreate = useCallback(() => {
    state.setEditingItem(null)
    state.setSelectedConnector(null)
    state.setFormData({
      name: '', type: 'custom', provider: 'custom', baseUrl: '', apiKey: '', apiSecret: '',
      config: '{}', syncEnabled: true, syncInterval: 300, events: [], isActive: true,
    })
    state.setDialogOpen(true)
  }, [state])

  const selectConnector = useCallback((connector: IntegrationConnector) => {
    state.setSelectedConnector(connector)
    state.setFormData({
      name: connector.name, type: connector.type, provider: connector.provider,
      baseUrl: connector.baseUrl, apiKey: '', apiSecret: '',
      config: JSON.stringify(
        connector.configFields.reduce<Record<string, string>>((acc, f) => {
          if (f.defaultValue) acc[f.key] = f.defaultValue
          return acc
        }, {}), null, 2,
      ),
      syncEnabled: true, syncInterval: 300, events: connector.defaultEvents, isActive: true,
    })
  }, [state])

  const openEdit = useCallback((item: IntegrationItem) => {
    state.setEditingItem(item)
    state.setSelectedConnector(null)
    let parsedEvents: string[] = []
    try { parsedEvents = JSON.parse(item.events || '[]') } catch { parsedEvents = [] }
    state.setFormData({
      name: item.name, type: item.type, provider: item.provider,
      baseUrl: item.baseUrl, apiKey: '', apiSecret: '',
      config: item.config, syncEnabled: item.syncEnabled, syncInterval: item.syncInterval,
      events: parsedEvents, isActive: item.isActive,
    })
    state.setDialogOpen(true)
  }, [state])

  const handleSubmit = useCallback(() => {
    if (!state.formData.name.trim()) { toast.error('Ime je obvezno'); return }
    const payload = {
      name: state.formData.name, type: state.formData.type, provider: state.formData.provider,
      baseUrl: state.formData.baseUrl, apiKey: state.formData.apiKey || undefined,
      apiSecret: state.formData.apiSecret || undefined, config: state.formData.config,
      syncEnabled: state.formData.syncEnabled, syncInterval: state.formData.syncInterval,
      events: JSON.stringify(state.formData.events), isActive: state.formData.isActive,
    }
    if (state.editingItem) { state.updateMutation.mutate({ id: state.editingItem.id, ...payload }) }
    else { state.createMutation.mutate(payload) }
  }, [state])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) { state.setEditingItem(null); state.setSelectedConnector(null) }
    state.setDialogOpen(open)
  }, [state])

  const handleDeleteTarget = useCallback((item: IntegrationItem) => {
    state.setDeleteTarget(item); state.setDeleteDialogOpen(true)
  }, [state])

  const handleDeleteConfirm = useCallback(() => {
    if (state.deleteTarget) { state.deleteMutation.mutate(state.deleteTarget.id) }
  }, [state])

  return {
    search: state.search, filterType: state.filterType,
    dialogOpen: state.dialogOpen, editingItem: state.editingItem,
    selectedConnector: state.selectedConnector, formData: state.formData,
    deleteDialogOpen: state.deleteDialogOpen, deleteTarget: state.deleteTarget,
    isLoading: queries.isLoading,
    allIntegrations: queries.allIntegrations,
    filteredIntegrations: computed.filteredIntegrations,
    activeCount: computed.activeCount, connectedCount: computed.connectedCount, errorCount: computed.errorCount,
    isCreating: state.createMutation.isPending, isUpdating: state.updateMutation.isPending,
    testPending: state.testMut.isPending, syncPending: state.syncMut.isPending,
    setSearch: state.setSearch, setFilterType: state.setFilterType, setFormData: state.setFormData,
    openCreate, selectConnector, openEdit, handleSubmit, handleDialogOpenChange,
    handleDeleteTarget, handleDeleteConfirm,
    testMutation: (id: string) => state.testMut.mutate(id),
    syncMutation: (id: string) => state.syncMut.mutate(id),
    cancelDialog: () => { state.setDialogOpen(false); state.setEditingItem(null); state.setSelectedConnector(null) },
    setDeleteDialogOpen: state.setDeleteDialogOpen,
  }
}
