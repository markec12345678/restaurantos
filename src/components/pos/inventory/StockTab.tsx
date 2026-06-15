'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'
import { type InventoryItemData, categoryLabels } from './constants'
import { StockItemCard } from './StockItemCard'

// --- Props ---

interface StockTabProps {
  items: InventoryItemData[] | undefined
  filteredItems: InventoryItemData[]
  isLoading: boolean
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
            {invCategories.map(c => (
              <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filteredItems.length} artiklov</Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
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

      {filteredItems.length === 0 && !isLoading && (
        <p className="text-center py-12 text-muted-foreground">Ni najdenih artiklov v zalogi</p>
      )}
    </>
  )
})
