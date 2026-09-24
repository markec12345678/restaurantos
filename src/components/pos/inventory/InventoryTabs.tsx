'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Package, Truck, FileMinus, History, BarChart3, Boxes, ClipboardList, CookingPot,
} from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { StockDashboard } from '@/components/pos/stock-dashboard/StockDashboard'
import type { useInventoryState } from './useInventoryState'

// Lazy-loaded podkomponente
const StockTab = dynamic(() => import('./StockTab').then(m => ({ default: m.StockTab })), { ssr: false })
const ProcurementTab = dynamic(() => import('./ProcurementTab').then(m => ({ default: m.ProcurementTab })), { ssr: false })
const WriteOffTab = dynamic(() => import('./WriteOffTab').then(m => ({ default: m.WriteOffTab })), { ssr: false })
const HistoryTab = dynamic(() => import('./HistoryTab').then(m => ({ default: m.HistoryTab })), { ssr: false })
const BatchesTab = dynamic(() => import('./BatchesTab').then(m => ({ default: m.BatchesTab })), { ssr: false })
const StocktakeTab = dynamic(() => import('./StocktakeTab').then(m => ({ default: m.StocktakeTab })), { ssr: false })
const BatchPreparationTab = dynamic(() => import('./BatchPreparationTab').then(m => ({ default: m.BatchPreparationTab })), { ssr: false })

type InventoryState = ReturnType<typeof useInventoryState>

interface InventoryTabsProps {
  s: InventoryState
}

export const InventoryTabs = memo(function InventoryTabs({ s }: InventoryTabsProps) {
  return (
    <Tabs value={s.activeTab} onValueChange={s.setActiveTab}>
      <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8">
        <TabsTrigger value="stock" className="gap-1.5">
          <Package className="h-3.5 w-3.5" /> Zaloge
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Pregled
        </TabsTrigger>
        <TabsTrigger value="batches" className="gap-1.5">
          <Boxes className="h-3.5 w-3.5" /> Serije
        </TabsTrigger>
        <TabsTrigger value="stocktake" className="gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Inventura
        </TabsTrigger>
        <TabsTrigger value="preparation" className="gap-1.5">
          <CookingPot className="h-3.5 w-3.5" /> Priprava
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

      {/* TAB: SERIJE (batch/lot/expiry — epic #115 §4) */}
      <TabsContent value="batches" className="mt-4">
        <BatchesTab />
      </TabsContent>

      {/* TAB: INVENTURA (stocktake — epic #115 P0-01) */}
      <TabsContent value="stocktake" className="mt-4">
        <StocktakeTab />
      </TabsContent>

      {/* TAB: PRIPRAVA (batch preparation — epic #115 P0-04, runda 122) */}
      <TabsContent value="preparation" className="mt-4">
        <BatchPreparationTab />
      </TabsContent>

      {/* TAB: ZALOGE */}
      <TabsContent value="stock" className="space-y-4 mt-4">
        <StockTab
          items={s.items}
          filteredItems={s.filteredItems}
          isLoading={s.isLoading}
          isError={s.isError}
          onRetry={s.refetchItems}
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
  )
})
