'use client'

import dynamic from 'next/dynamic'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, LayoutGrid, List } from 'lucide-react'
import type { ItemsTabProps } from './constants'

// ─── Lazy-loaded podkomponente ─────────────────────────────────
const ItemsTabGrid = dynamic(() => import('./ItemsTabGrid').then(m => m.ItemsTabGrid), { ssr: false })
const ItemsTabList = dynamic(() => import('./ItemsTabList').then(m => m.ItemsTabList), { ssr: false })

// ============================================
// TAB ARTIKLOV - mrežni in seznamski pogled
// ============================================
export const ItemsTab = memo(function ItemsTab({
  search,
  onSearchChange,
  filterMenu,
  onFilterMenuChange,
  filterCategory,
  onFilterCategoryChange,
  viewMode,
  onViewModeChange,
  filteredItems,
  categories,
  menus,
  isLoading,
  onEditItem,
  onDeleteItem,
  onToggleAvailability,
}: ItemsTabProps) {
  return (
    <>
      {/* Filtri in iskanje */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Išči artikle..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Išči artikle"
          />
        </div>
        <Select value={filterMenu} onValueChange={(v) => { onFilterMenuChange(v); onFilterCategoryChange('all') }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Vsi meniji" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi meniji</SelectItem>
            {(Array.isArray(menus) ? menus : []).map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Vse kategorije" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse kategorije</SelectItem>
            {(Array.isArray(categories) ? categories : [])
              .filter((c) => filterMenu === 'all' || c.menu?.id === filterMenu)
              .map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" aria-label="Mrežni pogled" className="h-9 w-9 rounded-r-none" onClick={() => onViewModeChange('grid')}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" aria-label="Seznam" className="h-9 w-9 rounded-l-none" onClick={() => onViewModeChange('list')}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mrežni ali seznamski pogled */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : viewMode === 'grid' ? (
        <ItemsTabGrid
          filteredItems={filteredItems}
          categories={categories}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
          onToggleAvailability={onToggleAvailability}
        />
      ) : (
        <ItemsTabList
          filteredItems={filteredItems}
          categories={categories}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
          onToggleAvailability={onToggleAvailability}
        />
      )}
      {(Array.isArray(filteredItems) ? filteredItems : []).length === 0 && !isLoading && (
        <p className="text-center py-12 text-muted-foreground">Ni najdenih artiklov</p>
      )}
    </>
  )
})
