'use client'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus, Package, Truck, FileMinus, History, BarChart3,
} from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { StockDashboard } from '@/components/pos/StockDashboard'
import { useInventoryState } from './inventory/useInventoryState'

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
  const s = useInventoryState()

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zaloga</h2>
          <p className="text-muted-foreground">Upravljanje zalog, nabave in razknjižbe</p>
        </div>
        <Button onClick={s.openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj artikel
        </Button>
      </div>

      {/* Opozorila nizke zaloge */}
      <LowStockAlerts
        lowStockItems={s.lowStockItems}
        onRestock={s.openRestock}
      />

      {/* GLAVNI ZAVIHKI */}
      <Tabs value={s.activeTab} onValueChange={s.setActiveTab}>
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

        {/* TAB: PREGLED ZALOGE (Dashboard) */}
        <TabsContent value="dashboard" className="mt-4">
          <StockDashboard />
        </TabsContent>

        {/* TAB: ZALOGE */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <StockTab
            items={s.items}
            filteredItems={s.filteredItems}
            isLoading={s.isLoading}
            search={s.search}
            onSearchChange={s.setSearch}
            filterCategory={s.filterCategory}
            onFilterCategoryChange={s.setFilterCategory}
            invCategories={s.invCategories}
            expandedItem={s.expandedItem}
            onToggleExpand={s.toggleExpand}
            onOpenRestock={s.openRestock}
            onOpenWriteOff={s.openWriteOff}
            onOpenEdit={s.openEdit}
            onDeleteItem={s.setDeleteTarget}
          />
        </TabsContent>

        {/* TAB: NABAVA */}
        <TabsContent value="procurement" className="space-y-4 mt-4">
          <ProcurementTab
            items={s.items}
            sortedItems={s.sortedItems}
            lowStockItems={s.lowStockItems}
            restockItemId={s.restockItemId}
            onRestockItemIdChange={s.setRestockItemId}
            restockData={s.restockData}
            onRestockDataChange={s.setRestockData}
            onRestockSubmit={s.handleRestock}
            isPending={s.isRestockPending}
            onQuickRestock={s.openRestock}
          />
        </TabsContent>

        {/* TAB: RAZKNJIŽBE */}
        <TabsContent value="writeoff" className="space-y-4 mt-4">
          <WriteOffTab
            items={s.items}
            sortedItems={s.sortedItems}
            writeOffItemId={s.writeOffItemId}
            onWriteOffItemIdChange={s.setWriteOffItemId}
            writeOffData={s.writeOffData}
            onWriteOffDataChange={s.setWriteOffData}
            onWriteOffSubmit={s.handleWriteOff}
            isPending={s.isWriteOffPending}
          />
        </TabsContent>

        {/* TAB: ZGODOVINA */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <HistoryTab
            transactionsData={s.transactionsData}
            txLoading={s.txLoading}
            txTypeFilter={s.txTypeFilter}
            onTxTypeFilterChange={s.setTxTypeFilter}
            txDateFrom={s.txDateFrom}
            onTxDateFromChange={s.setTxDateFrom}
            txDateTo={s.txDateTo}
            onTxDateToChange={s.setTxDateTo}
            onClearFilters={s.clearTxFilters}
          />
        </TabsContent>
      </Tabs>

      {/* DIALOG: UREDI ARTIKEL */}
      <ItemDialog
        open={s.dialogOpen}
        onOpenChange={s.setDialogOpen}
        editingItem={s.editingItem}
        formData={s.formData}
        onFormDataChange={s.setFormData}
        onSubmit={s.handleSubmit}
        menuItems={s.menuItems}
      />

      {/* DIALOG: NABAVA (hitra) */}
      <RestockDialog
        open={s.restockDialogOpen}
        onOpenChange={s.setRestockDialogOpen}
        restockItemId={s.restockItemId}
        items={s.items}
        restockData={s.restockData}
        onRestockDataChange={s.setRestockData}
        onSubmit={s.handleRestock}
        isPending={s.isRestockPending}
      />

      {/* DIALOG: RAZKNJIŽBA (hitra) */}
      <WriteOffDialog
        open={s.writeOffDialogOpen}
        onOpenChange={s.setWriteOffDialogOpen}
        writeOffItemId={s.writeOffItemId}
        items={s.items}
        writeOffData={s.writeOffData}
        onWriteOffDataChange={s.setWriteOffData}
        onSubmit={s.handleWriteOff}
        isPending={s.isWriteOffPending}
      />

      {/* AlertDialog za potrditev brisanja */}
      <DeleteConfirmDialog
        deleteTarget={s.deleteTarget}
        onOpenChange={s.handleDeleteDialogOpenChange}
        onConfirm={s.handleConfirmDelete}
      />
    </div>
  )
})
