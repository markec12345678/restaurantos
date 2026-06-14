'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, LayoutGrid, List, Pencil, Trash2, ImageIcon } from 'lucide-react'
import type { ItemsTabProps } from './constants'

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
            {menus?.map((m) => (
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
            {categories?.filter((c) => filterMenu === 'all' || c.menu?.id === filterMenu).map((cat) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => {
            const cat = categories?.find((c) => c.id === item.categoryId)
            const itemModGroups = (item.modifierGroups as { modifierGroup: { name: string } }[]) || []
            return (
              <Card key={item.id as string} className={`hover:shadow-md transition-shadow overflow-hidden ${!item.isAvailable ? 'opacity-60' : ''}`}>
                <div className="w-full aspect-[16/9] bg-muted/50 relative overflow-hidden">
                  {item.image ? (
                    <img
                      src={String(item.image)}
                      alt={String(item.name)}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        target.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                    <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button variant="secondary" size="icon" aria-label="Uredi" className="h-7 w-7 shadow-sm" onClick={() => onEditItem(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="secondary" size="icon" aria-label="Izbriši" className="h-7 w-7 shadow-sm text-destructive" onClick={() => onDeleteItem(item.id as string)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm">{String(item.name)}</p>
                    <p className="text-primary font-bold text-sm">€{Number(item.price).toFixed(2)}</p>
                  </div>
                  {Boolean(item.description) && <p className="text-xs text-muted-foreground line-clamp-2">{String(item.description)}</p>}
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    {cat && <Badge variant="outline" className="text-xs">{cat.icon} {cat.name}</Badge>}
                    {itemModGroups.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1">
                        +{itemModGroups.length} {itemModGroups.length === 1 ? 'dodatek' : 'dodatkov'}
                      </Badge>
                    )}
                    <Switch
                      checked={Boolean(item.isAvailable)}
                      onCheckedChange={(checked) => onToggleAvailability(item.id as string, checked)}
                      className="scale-75"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const cat = categories?.find((c) => c.id === item.categoryId)
            const itemModGroups = (item.modifierGroups as { modifierGroup: { name: string } }[]) || []
            return (
              <div key={item.id as string} className={`flex items-center justify-between p-3 rounded-lg border bg-card ${!item.isAvailable ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  {item.image ? (
                    <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                      <img src={String(item.image)} alt={String(item.name)} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{String(item.name)}</p>
                    <p className="text-xs text-muted-foreground">{String(item.description || '')}</p>
                    {itemModGroups.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {itemModGroups.map((mg, i) => (
                          <Badge key={i} variant="secondary" className="text-[9px] h-3.5 px-1">
                            {mg.modifierGroup.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {cat && <Badge variant="outline" className="text-xs">{cat.icon} {cat.name}</Badge>}
                  <span className="font-bold text-sm">€{Number(item.price).toFixed(2)}</span>
                  <Switch checked={Boolean(item.isAvailable)} onCheckedChange={(c) => onToggleAvailability(item.id as string, c)} className="scale-75" />
                  <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" onClick={() => onEditItem(item)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" onClick={() => onDeleteItem(item.id as string)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {filteredItems.length === 0 && !isLoading && (
        <p className="text-center py-12 text-muted-foreground">Ni najdenih artiklov</p>
      )}
    </>
  )
})
