'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, X } from 'lucide-react'
import { MenuItemCard } from './MenuItemCard'
import type { MenuItemType, StockInfoType } from './types'

// --- Props ---

interface MenuItemsGridProps {
  filteredMenuItems: MenuItemType[]
  menuStockMap: Record<string, StockInfoType> | undefined
  cart: { id: string; quantity: number }[]
  lastAddedId: string | null
  itemSearch: string
  onItemSearchChange: (_value: string) => void
  onItemClick: (_item: MenuItemType) => void
  menusLoading: boolean
  menuLoading: boolean
}

// --- Komponenta ---

export const MenuItemsGrid = memo(function MenuItemsGrid({
  filteredMenuItems,
  menuStockMap,
  cart,
  lastAddedId,
  itemSearch,
  onItemSearchChange,
  onItemClick,
  menusLoading,
  menuLoading,
}: MenuItemsGridProps) {
  return (
    <>
      {/* Quick Search */}
      {itemSearch && (
        <div className="px-3 pt-2 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Išči artikel..."
              value={itemSearch}
              onChange={e => onItemSearchChange(e.target.value)}
              className="h-8 text-xs pl-8 pr-8"
              aria-label="Išči artikel"
              autoFocus
            />
            <Button variant="ghost" size="icon" aria-label="Zapri" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => onItemSearchChange('')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Badge variant="secondary" className="text-[10px] h-6 flex-shrink-0">{filteredMenuItems.length}</Badge>
        </div>
      )}
      {!itemSearch && (
        <div className="px-3 pt-2 flex-shrink-0">
          <button
            onClick={() => onItemSearchChange(' ')}
            className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5"
          >
            <Search className="h-4 w-4" />
            <span>Išči artikel...</span>
            <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded border font-mono">⌘K</kbd>
          </button>
        </div>
      )}
      {/* ITEMS GRID */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {menuLoading || menusLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Ni artiklov v tej kategoriji
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filteredMenuItems.map((item: MenuItemType) => {
              const inCart = cart.filter(c => c.id === item.id)
              const totalQty = inCart.reduce((sum, c) => sum + c.quantity, 0)
              const stockInfo = menuStockMap?.[item.id]
              const isOutOfStock = stockInfo?.status === 'out'
              return (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  totalQty={totalQty}
                  lastAddedId={lastAddedId}
                  stockInfo={stockInfo}
                  onClick={() => !isOutOfStock && onItemClick(item)}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
})
