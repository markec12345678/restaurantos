'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { type InventoryItemData, categoryLabels } from './constants'
import { StockItemCard } from './StockItemCard'

// --- Props ---

interface StockTabProps {
  items: InventoryItemData[] | undefined
  filteredItems: InventoryItemData[]
  isLoading: boolean
  isError?: boolean
  onRetry?: () => void
  search: string
  onSearchChange: (_value: string) => void
  filterCategory: string
  onFilterCategoryChange: (_value: string) => void
  invCategories: string[]
  expandedItem: string | null
  onToggleExpand: (_itemId: string) => void
  onOpenRestock: (_itemId: string) => void
  onOpenWriteOff: (_itemId: string) => void
  onOpenEdit: (_item: InventoryItemData) => void
  onDeleteItem: (_item: InventoryItemData) => void
}

// --- Komponenta ---

export const StockTab = memo(function StockTab({
  filteredItems,
  isLoading,
  isError,
  onRetry,
  search,
  onSearchChange,
  filterCategory,
  onFilterCategoryChange,
  invCategories,
  expandedItem,
  onToggleExpand,
  onOpenRestock,
  onOpenWriteOff,
  onOpenEdit,
  onDeleteItem,
}: StockTabProps) {
  return (
    <>
      {/* Iskanje in filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Išči v zalogi..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" aria-label="Išči zalogo" />
        </div>
        <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Vse kategorije" />
          </SelectTrigger>
          <SelectContent>
            {/* FIX TypeError: m?.map — invCategories je lahko undefined */}
            {(Array.isArray(invCategories) ? invCategories : []).map(c => (
              <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{(Array.isArray(filteredItems) ? filteredItems : []).length} artiklov</Badge>
      </div>

      {isError && !isLoading ? (
        /* FIX (E2E 2026-09-17): 429/500 ni več prikrito kot prazna zaloga —
           izpostavljena napaka z gumbom za ponoven poskus */
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" role="alert">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-destructive">Napaka pri nalaganju zaloge</p>
            <p className="text-sm text-muted-foreground">Strežnik ni odgovoril (morda preveč zahtevkov). Poskusite znova.</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 mt-1">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Poskusi znova
            </Button>
          )}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* FIX TypeError: m?.map — filteredItems je lahko undefined */}
          {(Array.isArray(filteredItems) ? filteredItems : []).map((item) => (
            <StockItemCard
              key={item.id}
              item={item}
              isExpanded={expandedItem === item.id}
              onToggleExpand={onToggleExpand}
              onOpenRestock={onOpenRestock}
              onOpenWriteOff={onOpenWriteOff}
              onOpenEdit={onOpenEdit}
              onDeleteItem={onDeleteItem}
            />
          ))}
        </div>
      )}

      {!isError && filteredItems.length === 0 && !isLoading && (
        <p className="text-center py-12 text-muted-foreground">Ni najdenih artiklov v zalogi</p>
      )}
    </>
  )
})
