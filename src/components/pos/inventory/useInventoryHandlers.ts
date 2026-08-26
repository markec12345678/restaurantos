'use client'
// ============================================
// POD-HOOK: Handlerji za upravljanje zalog
// Izvleče handlerje in obrazce iz glavnega hooka
// ============================================

import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  type InventoryItemData,
  type ItemFormData,
  type RestockFormData,
  type WriteOffFormData,
  emptyItemForm,
  emptyRestockForm,
  emptyWriteOffForm,
} from './constants'

type SetState<T> = React.Dispatch<React.SetStateAction<T>>

interface Callbacks {
  setDialogOpen: (_open: boolean) => void
  setEditingItem: (_item: InventoryItemData | null) => void
  setFormData: SetState<ItemFormData>
  setRestockDialogOpen: (_open: boolean) => void
  setRestockItemId: (_id: string) => void
  setRestockData: SetState<RestockFormData>
  setWriteOffDialogOpen: (_open: boolean) => void
  setWriteOffItemId: (_id: string) => void
  setWriteOffData: SetState<WriteOffFormData>
  setDeleteTarget: (_item: InventoryItemData | null) => void
  setExpandedItem: SetState<string | null>
  setTxTypeFilter: (_v: string) => void
  setTxDateFrom: (_v: string) => void
  setTxDateTo: (_v: string) => void
}

interface Mutations {
  createMutation: { mutate: (_data: Record<string, unknown>) => void }
  updateMutation: { mutate: (_data: { id: string } & Record<string, unknown>) => void }
  deleteMutation: { mutate: (_id: string) => void }
  restockMutation: { mutate: (_data: Record<string, unknown>) => void }
  writeOffMutation: { mutate: (_data: Record<string, unknown>) => void }
}

export function useInventoryHandlers(
  callbacks: Callbacks,
  mutations: Mutations,
  items: InventoryItemData[],
  editingItem: InventoryItemData | null,
  formData: ItemFormData,
  restockItemId: string,
  restockData: RestockFormData,
  writeOffItemId: string,
  writeOffData: WriteOffFormData,
  deleteTarget: InventoryItemData | null,
) {
  const openCreate = useCallback(() => {
    callbacks.setEditingItem(null)
    callbacks.setFormData({ ...emptyItemForm })
    callbacks.setDialogOpen(true)
  }, [callbacks])

  const openEdit = useCallback((item: InventoryItemData) => {
    callbacks.setEditingItem(item)
    callbacks.setFormData({
      name: item.name, description: item.description || '', image: item.image || '',
      unit: item.unit, quantity: String(item.quantity), minQuantity: String(item.minQuantity),
      costPerUnit: String(item.costPerUnit), supplier: item.supplier || '', category: item.category,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      menuItemId: item.menuItemId || '', servingsPerUnit: String(item.servingsPerUnit || 1),
      servingSize: item.servingSize || '', costPerServing: String(item.costPerServing || 0),
    })
    callbacks.setDialogOpen(true)
  }, [callbacks])

  const handleSubmit = useCallback(() => {
    const payload = {
      ...formData,
      quantity: parseFloat(formData.quantity) || 0,
      minQuantity: parseFloat(formData.minQuantity) || 10,
      costPerUnit: parseFloat(formData.costPerUnit) || 0,
      servingsPerUnit: parseFloat(formData.servingsPerUnit) || 1,
      costPerServing: parseFloat(formData.costPerServing) || 0,
      expiryDate: formData.expiryDate || null,
      menuItemId: formData.menuItemId || null,
    }
    if (editingItem) { mutations.updateMutation.mutate({ id: editingItem.id, ...payload }) }
    else { mutations.createMutation.mutate(payload) }
  }, [formData, editingItem, mutations])

  const openRestock = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    callbacks.setRestockItemId(itemId)
    callbacks.setRestockData({ ...emptyRestockForm, costPerUnit: item ? String(item.costPerUnit) : '' })
    callbacks.setRestockDialogOpen(true)
  }, [items, callbacks])

  const handleRestock = useCallback(() => {
    if (!restockItemId || !restockData.quantity) { toast.error('Izpolpite količino'); return }
    mutations.restockMutation.mutate({
      inventoryItemId: restockItemId,
      quantity: parseFloat(restockData.quantity),
      costPerUnit: restockData.costPerUnit ? parseFloat(restockData.costPerUnit) : undefined,
      supplierDoc: restockData.supplierDoc, employeeName: restockData.employeeName,
      note: restockData.note,
    })
  }, [restockItemId, restockData, mutations])

  const openWriteOff = useCallback((itemId: string) => {
    callbacks.setWriteOffItemId(itemId)
    callbacks.setWriteOffData({ ...emptyWriteOffForm })
    callbacks.setWriteOffDialogOpen(true)
  }, [callbacks])

  const handleWriteOff = useCallback(() => {
    if (!writeOffItemId || !writeOffData.quantity) { toast.error('Izpolpite količino'); return }
    if (!writeOffData.reason) { toast.error('Izberite razlog'); return }
    mutations.writeOffMutation.mutate({
      inventoryItemId: writeOffItemId, quantity: parseFloat(writeOffData.quantity),
      type: writeOffData.type, reason: writeOffData.reason, note: writeOffData.note,
      employeeName: writeOffData.employeeName,
    })
  }, [writeOffItemId, writeOffData, mutations])

  const toggleExpand = useCallback((itemId: string) => {
    callbacks.setExpandedItem((prev) => prev === itemId ? null : itemId)
  }, [callbacks])

  const clearTxFilters = useCallback(() => {
    callbacks.setTxTypeFilter('all'); callbacks.setTxDateFrom(''); callbacks.setTxDateTo('')
  }, [callbacks])

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) callbacks.setDeleteTarget(null)
  }, [callbacks])

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) { mutations.deleteMutation.mutate(deleteTarget.id); callbacks.setDeleteTarget(null) }
  }, [deleteTarget, mutations, callbacks])

  return {
    openCreate, openEdit, handleSubmit,
    openRestock, handleRestock,
    openWriteOff, handleWriteOff,
    toggleExpand, clearTxFilters,
    handleDeleteDialogOpenChange, handleConfirmDelete,
  }
}
