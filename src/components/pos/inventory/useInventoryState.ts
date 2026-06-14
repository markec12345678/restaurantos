'use client'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useMemo, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  type InventoryItemData,
  type ItemFormData,
  type RestockFormData,
  type WriteOffFormData,
  emptyItemForm,
  emptyRestockForm,
  emptyWriteOffForm,
} from './constants'
import { useInventoryMutations } from './useInventoryMutations'

// ============================================
// HOOK: Stanje, poizvedbe, mutacije in handlerji
// za upravljanje zalog
// ============================================

export function useInventoryState() {
  // --- Stanja ---
  const [activeTab, setActiveTab] = useState('stock')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // Dijalog za urejanje artikla
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItemData | null>(null)
  const [formData, setFormData] = useState<ItemFormData>({ ...emptyItemForm })

  // Nabava (restock)
  const [restockDialogOpen, setRestockDialogOpen] = useState(false)
  const [restockItemId, setRestockItemId] = useState<string>('')
  const [restockData, setRestockData] = useState<RestockFormData>({ ...emptyRestockForm })

  // Razknjižba (write-off)
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false)
  const [writeOffItemId, setWriteOffItemId] = useState<string>('')
  const [writeOffData, setWriteOffData] = useState<WriteOffFormData>({ ...emptyWriteOffForm })

  // Zgodovina filtri
  const [txTypeFilter, setTxTypeFilter] = useState('all')
  const [txDateFrom, setTxDateFrom] = useState('')
  const [txDateTo, setTxDateTo] = useState('')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // Brisanje z potrditvijo
  const [deleteTarget, setDeleteTarget] = useState<InventoryItemData | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  // Dinamične kategorije iz baze
  const { data: dbCategories } = useQuery<string[]>({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory?distinctCategories=true')
      if (!res.ok) return ['general']
      return res.json()
    },
    staleTime: 60000,
  })

  // Zgradi seznam kategorij: 'all' + dinamične iz baze
  const invCategories = useMemo(() => ['all', ...(dbCategories || ['general'])], [dbCategories])

  const { data: items, isLoading } = useQuery<InventoryItemData[]>({
    queryKey: [...queryKeys.inventory.all, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterCategory !== 'all') params.set('category', filterCategory)
      const res = await authFetch(`/api/inventory?${params}`)
      return res.json()
    },
  })

  const { data: menuItems } = useQuery({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      return res.json()
    },
  })

  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: [...queryKeys.inventory.transactions, txTypeFilter, txDateFrom, txDateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (txTypeFilter !== 'all') params.set('type', txTypeFilter)
      if (txDateFrom) params.set('from', txDateFrom)
      if (txDateTo) params.set('to', txDateTo)
      params.set('limit', '200')
      const res = await authFetch(`/api/inventory/transactions?${params}`)
      return res.json()
    },
    enabled: activeTab === 'history',
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const filteredItems = (items || []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockItems = (items || []).filter((item) => item.quantity <= item.minQuantity)

  const sortedItems = useMemo(
    () => [...(items || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  )

  // ============================================
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================

  const {
    createMutation,
    updateMutation,
    deleteMutation,
    restockMutation,
    writeOffMutation,
  } = useInventoryMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEditingItem: () => setEditingItem(null),
    onCloseRestockDialog: () => setRestockDialogOpen(false),
    onCloseWriteOffDialog: () => setWriteOffDialogOpen(false),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = useCallback(() => {
    setEditingItem(null); setFormData({ ...emptyItemForm }); setDialogOpen(true)
  }, [])

  const openEdit = useCallback((item: InventoryItemData) => {
    setEditingItem(item)
    setFormData({
      name: item.name, description: item.description || '', image: item.image || '',
      unit: item.unit, quantity: String(item.quantity), minQuantity: String(item.minQuantity),
      costPerUnit: String(item.costPerUnit), supplier: item.supplier || '', category: item.category,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      menuItemId: item.menuItemId || '', servingsPerUnit: String(item.servingsPerUnit || 1),
      servingSize: item.servingSize || '', costPerServing: String(item.costPerServing || 0),
    })
    setDialogOpen(true)
  }, [])

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
    if (editingItem) { updateMutation.mutate({ id: editingItem.id, ...payload }) }
    else { createMutation.mutate(payload) }
  }, [formData, editingItem, updateMutation, createMutation])

  const openRestock = useCallback((itemId: string) => {
    const item = (items || []).find((i) => i.id === itemId)
    setRestockItemId(itemId)
    setRestockData({ ...emptyRestockForm, costPerUnit: item ? String(item.costPerUnit) : '' })
    setRestockDialogOpen(true)
  }, [items])

  const handleRestock = useCallback(() => {
    if (!restockItemId || !restockData.quantity) { toast.error('Izpolnite količino'); return }
    restockMutation.mutate({
      inventoryItemId: restockItemId,
      quantity: parseFloat(restockData.quantity),
      costPerUnit: restockData.costPerUnit ? parseFloat(restockData.costPerUnit) : undefined,
      supplierDoc: restockData.supplierDoc, employeeName: restockData.employeeName,
      note: restockData.note,
    })
  }, [restockItemId, restockData, restockMutation])

  const openWriteOff = useCallback((itemId: string) => {
    setWriteOffItemId(itemId); setWriteOffData({ ...emptyWriteOffForm }); setWriteOffDialogOpen(true)
  }, [])

  const handleWriteOff = useCallback(() => {
    if (!writeOffItemId || !writeOffData.quantity) { toast.error('Izpolnite količino'); return }
    if (!writeOffData.reason) { toast.error('Izberite razlog'); return }
    writeOffMutation.mutate({
      inventoryItemId: writeOffItemId, quantity: parseFloat(writeOffData.quantity),
      type: writeOffData.type, reason: writeOffData.reason, note: writeOffData.note,
      employeeName: writeOffData.employeeName,
    })
  }, [writeOffItemId, writeOffData, writeOffMutation])

  const toggleExpand = useCallback((itemId: string) => {
    setExpandedItem((prev) => prev === itemId ? null : itemId)
  }, [])

  const clearTxFilters = useCallback(() => {
    setTxTypeFilter('all'); setTxDateFrom(''); setTxDateTo('')
  }, [])

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setDeleteTarget(null)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }
  }, [deleteTarget, deleteMutation])

  return {
    // Zavihki in iskanje
    activeTab, setActiveTab, search, setSearch, filterCategory, setFilterCategory,
    // Poizvedbe
    isLoading, items, menuItems, transactionsData, txLoading, invCategories,
    // Izračuni
    filteredItems, lowStockItems, sortedItems,
    // Dijalog za urejanje artikla
    dialogOpen, setDialogOpen, editingItem, formData, setFormData, handleSubmit,
    openCreate, openEdit,
    // Nabava
    restockDialogOpen, setRestockDialogOpen, restockItemId, setRestockItemId,
    restockData, setRestockData, handleRestock, openRestock,
    isRestockPending: restockMutation.isPending,
    // Razknjižba
    writeOffDialogOpen, setWriteOffDialogOpen, writeOffItemId, setWriteOffItemId,
    writeOffData, setWriteOffData, handleWriteOff, openWriteOff,
    isWriteOffPending: writeOffMutation.isPending,
    // Zgodovina filtri
    txTypeFilter, setTxTypeFilter, txDateFrom, setTxDateFrom, txDateTo, setTxDateTo,
    expandedItem, toggleExpand, clearTxFilters,
    // Brisanje
    deleteTarget, setDeleteTarget, handleDeleteDialogOpenChange, handleConfirmDelete,
  }
}
