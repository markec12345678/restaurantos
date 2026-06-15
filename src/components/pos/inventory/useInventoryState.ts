'use client'

import { useState, useMemo } from 'react'
import {
  type InventoryItemData,
  type ItemFormData,
  type RestockFormData,
  type WriteOffFormData,
  emptyItemForm,
  emptyRestockForm,
  emptyWriteOffForm,
} from './constants'
import { useInventoryQueries } from './useInventoryQueries'
import { useInventoryMutations } from './useInventoryMutations'
import { useInventoryHandlers } from './useInventoryHandlers'

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
  // QUERIES (iz pod-hooka)
  // ============================================

  const { invCategories, items, isLoading, menuItems, transactionsData, txLoading } = useInventoryQueries({
    activeTab, filterCategory, txTypeFilter, txDateFrom, txDateTo,
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

  const mutations = useInventoryMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEditingItem: () => setEditingItem(null),
    onCloseRestockDialog: () => setRestockDialogOpen(false),
    onCloseWriteOffDialog: () => setWriteOffDialogOpen(false),
  })

  // ============================================
  // HANDLERJI (iz pod-hooka)
  // ============================================

  const handlers = useInventoryHandlers(
    {
      setDialogOpen, setEditingItem, setFormData,
      setRestockDialogOpen, setRestockItemId, setRestockData,
      setWriteOffDialogOpen, setWriteOffItemId, setWriteOffData,
      setDeleteTarget, setExpandedItem,
      setTxTypeFilter, setTxDateFrom, setTxDateTo,
    },
    mutations,
    items || [],
    editingItem,
    formData,
    restockItemId,
    restockData,
    writeOffItemId,
    writeOffData,
    deleteTarget,
  )

  return {
    // Zavihki in iskanje
    activeTab, setActiveTab, search, setSearch, filterCategory, setFilterCategory,
    // Poizvedbe
    isLoading, items, menuItems, transactionsData, txLoading, invCategories,
    // Izračuni
    filteredItems, lowStockItems, sortedItems,
    // Dijalog za urejanje artikla
    dialogOpen, setDialogOpen, editingItem, formData, setFormData, handleSubmit: handlers.handleSubmit,
    openCreate: handlers.openCreate, openEdit: handlers.openEdit,
    // Nabava
    restockDialogOpen, setRestockDialogOpen, restockItemId, setRestockItemId,
    restockData, setRestockData, handleRestock: handlers.handleRestock, openRestock: handlers.openRestock,
    isRestockPending: mutations.restockMutation.isPending,
    // Razknjižba
    writeOffDialogOpen, setWriteOffDialogOpen, writeOffItemId, setWriteOffItemId,
    writeOffData, setWriteOffData, handleWriteOff: handlers.handleWriteOff, openWriteOff: handlers.openWriteOff,
    isWriteOffPending: mutations.writeOffMutation.isPending,
    // Zgodovina filtri
    txTypeFilter, setTxTypeFilter, txDateFrom, setTxDateFrom, txDateTo, setTxDateTo,
    expandedItem, toggleExpand: handlers.toggleExpand, clearTxFilters: handlers.clearTxFilters,
    // Brisanje
    deleteTarget, setDeleteTarget, handleDeleteDialogOpenChange: handlers.handleDeleteDialogOpenChange, handleConfirmDelete: handlers.handleConfirmDelete,
  }
}
