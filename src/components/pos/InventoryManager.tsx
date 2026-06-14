'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Plus, Package, Truck, FileMinus, History, BarChart3,
} from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { StockDashboard } from '@/components/pos/StockDashboard'
import { queryKeys } from '@/lib/query-keys'
import {
  type InventoryItemData,
  type ItemFormData,
  type RestockFormData,
  type WriteOffFormData,
  emptyItemForm,
  emptyRestockForm,
  emptyWriteOffForm,
} from './inventory/constants'

// Lazy-loaded podkomponente
const LowStockAlerts = dynamic(() => import('./inventory/LowStockAlerts').then(m => ({ default: m.LowStockAlerts })), { ssr: false })
const StockTab = dynamic(() => import('./inventory/StockTab').then(m => ({ default: m.StockTab })), { ssr: false })
const ProcurementTab = dynamic(() => import('./inventory/ProcurementTab').then(m => ({ default: m.ProcurementTab })), { ssr: false })
const WriteOffTab = dynamic(() => import('./inventory/WriteOffTab').then(m => ({ default: m.WriteOffTab })), { ssr: false })
const HistoryTab = dynamic(() => import('./inventory/HistoryTab').then(m => ({ default: m.HistoryTab })), { ssr: false })
const ItemDialog = dynamic(() => import('./inventory/ItemDialog').then(m => ({ default: m.ItemDialog })), { ssr: false })
const RestockDialog = dynamic(() => import('./inventory/RestockDialog').then(m => ({ default: m.RestockDialog })), { ssr: false })
const WriteOffDialog = dynamic(() => import('./inventory/WriteOffDialog').then(m => ({ default: m.WriteOffDialog })), { ssr: false })
const DeleteConfirmDialog = dynamic(() => import('./inventory/DeleteConfirmDialog').then(m => ({ default: m.DeleteConfirmDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const InventoryManager = memo(function InventoryManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('stock')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // --- Dijalog za urejanje artikla ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItemData | null>(null)
  const [formData, setFormData] = useState<ItemFormData>({ ...emptyItemForm })

  // --- Nabava (restock) ---
  const [restockDialogOpen, setRestockDialogOpen] = useState(false)
  const [restockItemId, setRestockItemId] = useState<string>('')
  const [restockData, setRestockData] = useState<RestockFormData>({ ...emptyRestockForm })

  // --- Razknjižba (write-off) ---
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false)
  const [writeOffItemId, setWriteOffItemId] = useState<string>('')
  const [writeOffData, setWriteOffData] = useState<WriteOffFormData>({ ...emptyWriteOffForm })

  // --- Zgodovina filtri ---
  const [txTypeFilter, setTxTypeFilter] = useState('all')
  const [txDateFrom, setTxDateFrom] = useState('')
  const [txDateTo, setTxDateTo] = useState('')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // --- Brisanje z potrditvijo ---
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

  const filteredItems = (items || []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockItems = (items || []).filter((item) => item.quantity <= item.minQuantity)

  const sortedItems = useMemo(() => [...(items || [])].sort((a, b) => a.name.localeCompare(b.name)), [items])

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge ustvarjen'); queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }); setDialogOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodobitvi')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge posodobljen'); queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }); setDialogOpen(false); setEditingItem(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel zaloge izbrisan'); queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }) },
  })

  const restockMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory/restock', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka') }
      return res.json()
    },
    onSuccess: () => { toast.success('Nabava uspešno vnešena'); queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }); queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transactions }); setRestockDialogOpen(false) },
    onError: (err) => toast.error(err.message),
  })

  const writeOffMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka') }
      return res.json()
    },
    onSuccess: () => { toast.success('Razknjižba uspešno izvedena'); queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }); queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transactions }); setWriteOffDialogOpen(false) },
    onError: (err) => toast.error(err.message),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = useCallback(() => {
    setEditingItem(null)
    setFormData({ ...emptyItemForm })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((item: InventoryItemData) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      image: item.image || '',
      unit: item.unit,
      quantity: String(item.quantity),
      minQuantity: String(item.minQuantity),
      costPerUnit: String(item.costPerUnit),
      supplier: item.supplier || '',
      category: item.category,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      menuItemId: item.menuItemId || '',
      servingsPerUnit: String(item.servingsPerUnit || 1),
      servingSize: item.servingSize || '',
      costPerServing: String(item.costPerServing || 0),
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
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [formData, editingItem, updateMutation, createMutation])

  const openRestock = useCallback((itemId: string) => {
    const item = (items || []).find((i) => i.id === itemId)
    setRestockItemId(itemId)
    setRestockData({
      ...emptyRestockForm,
      costPerUnit: item ? String(item.costPerUnit) : '',
    })
    setRestockDialogOpen(true)
  }, [items])

  const handleRestock = useCallback(() => {
    if (!restockItemId || !restockData.quantity) {
      toast.error('Izpolnite količino')
      return
    }
    restockMutation.mutate({
      inventoryItemId: restockItemId,
      quantity: parseFloat(restockData.quantity),
      costPerUnit: restockData.costPerUnit ? parseFloat(restockData.costPerUnit) : undefined,
      supplierDoc: restockData.supplierDoc,
      employeeName: restockData.employeeName,
      note: restockData.note,
    })
  }, [restockItemId, restockData, restockMutation])

  const openWriteOff = useCallback((itemId: string) => {
    setWriteOffItemId(itemId)
    setWriteOffData({ ...emptyWriteOffForm })
    setWriteOffDialogOpen(true)
  }, [])

  const handleWriteOff = useCallback(() => {
    if (!writeOffItemId || !writeOffData.quantity) {
      toast.error('Izpolnite količino')
      return
    }
    if (!writeOffData.reason) {
      toast.error('Izberite razlog')
      return
    }
    writeOffMutation.mutate({
      inventoryItemId: writeOffItemId,
      quantity: parseFloat(writeOffData.quantity),
      type: writeOffData.type,
      reason: writeOffData.reason,
      note: writeOffData.note,
      employeeName: writeOffData.employeeName,
    })
  }, [writeOffItemId, writeOffData, writeOffMutation])

  const toggleExpand = useCallback((itemId: string) => {
    setExpandedItem(prev => prev === itemId ? null : itemId)
  }, [])

  const clearTxFilters = useCallback(() => {
    setTxTypeFilter('all')
    setTxDateFrom('')
    setTxDateTo('')
  }, [])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zaloga</h2>
          <p className="text-muted-foreground">Upravljanje zalog, nabave in razknjižbe</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj artikel
        </Button>
      </div>

      {/* Opozorila nizke zaloge */}
      <LowStockAlerts
        lowStockItems={lowStockItems}
        onRestock={openRestock}
      />

      {/* GLAVNI ZAVIHKI */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stock" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Zaloge
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Pregled
          </TabsTrigger>
          <TabsTrigger value="procurement" className="gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Nabava
          </TabsTrigger>
          <TabsTrigger value="writeoff" className="gap-1.5">
            <FileMinus className="h-3.5 w-3.5" /> Razknjižbe
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Zgodovina
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB: PREGLED ZALOGE (Dashboard) ===================== */}
        <TabsContent value="dashboard" className="mt-4">
          <StockDashboard />
        </TabsContent>

        {/* ===================== TAB: ZALOGE ===================== */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <StockTab
            items={items}
            filteredItems={filteredItems}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            filterCategory={filterCategory}
            onFilterCategoryChange={setFilterCategory}
            invCategories={invCategories}
            expandedItem={expandedItem}
            onToggleExpand={toggleExpand}
            onOpenRestock={openRestock}
            onOpenWriteOff={openWriteOff}
            onOpenEdit={openEdit}
            onDeleteItem={setDeleteTarget}
          />
        </TabsContent>

        {/* ===================== TAB: NABAVA ===================== */}
        <TabsContent value="procurement" className="space-y-4 mt-4">
          <ProcurementTab
            items={items}
            sortedItems={sortedItems}
            lowStockItems={lowStockItems}
            restockItemId={restockItemId}
            onRestockItemIdChange={setRestockItemId}
            restockData={restockData}
            onRestockDataChange={setRestockData}
            onRestockSubmit={handleRestock}
            isPending={restockMutation.isPending}
            onQuickRestock={openRestock}
          />
        </TabsContent>

        {/* ===================== TAB: RAZKNJIŽBE ===================== */}
        <TabsContent value="writeoff" className="space-y-4 mt-4">
          <WriteOffTab
            items={items}
            sortedItems={sortedItems}
            writeOffItemId={writeOffItemId}
            onWriteOffItemIdChange={setWriteOffItemId}
            writeOffData={writeOffData}
            onWriteOffDataChange={setWriteOffData}
            onWriteOffSubmit={handleWriteOff}
            isPending={writeOffMutation.isPending}
          />
        </TabsContent>

        {/* ===================== TAB: ZGODOVINA ===================== */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <HistoryTab
            transactionsData={transactionsData}
            txLoading={txLoading}
            txTypeFilter={txTypeFilter}
            onTxTypeFilterChange={setTxTypeFilter}
            txDateFrom={txDateFrom}
            onTxDateFromChange={setTxDateFrom}
            txDateTo={txDateTo}
            onTxDateToChange={setTxDateTo}
            onClearFilters={clearTxFilters}
          />
        </TabsContent>
      </Tabs>

      {/* ===================== DIALOG: UREDI ARTIKEL ===================== */}
      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        menuItems={menuItems}
      />

      {/* ===================== DIALOG: NABAVA (hitra) ===================== */}
      <RestockDialog
        open={restockDialogOpen}
        onOpenChange={setRestockDialogOpen}
        restockItemId={restockItemId}
        items={items}
        restockData={restockData}
        onRestockDataChange={setRestockData}
        onSubmit={handleRestock}
        isPending={restockMutation.isPending}
      />

      {/* ===================== DIALOG: RAZKNJIŽBA (hitra) ===================== */}
      <WriteOffDialog
        open={writeOffDialogOpen}
        onOpenChange={setWriteOffDialogOpen}
        writeOffItemId={writeOffItemId}
        items={items}
        writeOffData={writeOffData}
        onWriteOffDataChange={setWriteOffData}
        onSubmit={handleWriteOff}
        isPending={writeOffMutation.isPending}
      />

      {/* AlertDialog za potrditev brisanja */}
      <DeleteConfirmDialog
        deleteTarget={deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) } }}
      />
    </div>
  )
})
