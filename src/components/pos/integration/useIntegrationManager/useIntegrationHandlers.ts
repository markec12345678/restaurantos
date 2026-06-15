import { useCallback } from 'react'
import { toast } from 'sonner'
import type { IntegrationConnector } from '@/lib/integrations/connectors'
import type { IntegrationItem, FormData } from '../constants'

export function useIntegrationHandlers(
  formData: FormData,
  editingItem: IntegrationItem | null,
  setEditingItem: (_item: IntegrationItem | null) => void,
  setSelectedConnector: (_connector: IntegrationConnector | null) => void,
  setDialogOpen: (_open: boolean) => void,
  deleteTarget: IntegrationItem | null,
  createMutation: { mutate: (_data: unknown) => void; isPending: boolean },
  updateMutation: { mutate: (_data: unknown) => void; isPending: boolean },
  deleteMutation: { mutate: (_id: string) => void; isPending: boolean },
) {
  const openCreate = useCallback(() => {
    setEditingItem(null)
    setSelectedConnector(null)
    setDialogOpen(true)
  }, [setEditingItem, setSelectedConnector, setDialogOpen])

  const selectConnector = useCallback((connector: IntegrationConnector) => {
    setSelectedConnector(connector)
  }, [setSelectedConnector])

  const openEdit = useCallback((item: IntegrationItem) => {
    setEditingItem(item)
    setSelectedConnector(null)
    setDialogOpen(true)
  }, [setEditingItem, setSelectedConnector, setDialogOpen])

  const handleSubmit = useCallback(() => {
    if (!formData.name.trim()) { toast.error('Ime je obvezno'); return }
    const payload = {
      name: formData.name, type: formData.type, provider: formData.provider,
      baseUrl: formData.baseUrl, apiKey: formData.apiKey || undefined, apiSecret: formData.apiSecret || undefined,
      config: formData.config, syncEnabled: formData.syncEnabled, syncInterval: formData.syncInterval,
      events: JSON.stringify(formData.events), isActive: formData.isActive,
    }
    if (editingItem) { updateMutation.mutate({ id: editingItem.id, ...payload }) }
    else { createMutation.mutate(payload) }
  }, [formData, editingItem, updateMutation, createMutation])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) { setEditingItem(null); setSelectedConnector(null) }
    setDialogOpen(open)
  }, [setEditingItem, setSelectedConnector, setDialogOpen])

  const handleDeleteTarget = useCallback((_item: IntegrationItem) => {
    // caller handles setDeleteTarget, setDeleteDialogOpen
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) { deleteMutation.mutate(deleteTarget.id) }
  }, [deleteTarget, deleteMutation])

  return { openCreate, selectConnector, openEdit, handleSubmit, handleDialogOpenChange, handleDeleteTarget, handleDeleteConfirm }
}
