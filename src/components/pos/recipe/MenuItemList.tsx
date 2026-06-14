'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'
import type { RecipeGroups } from './constants'
import { marginBadge } from './constants'

// ============================================
// SEZNAM MENI ARTIKLOV - LEVI DEL
// ============================================

interface MenuItemListProps {
  recipeGroups: RecipeGroups
  search: string
  selectedMenuItemId: string
  onSearchChange: (_value: string) => void
  onSelectedMenuItemIdChange: (_id: string) => void
}

export const MenuItemList = memo(function MenuItemList({
  recipeGroups,
  search,
  selectedMenuItemId,
  onSearchChange,
  onSelectedMenuItemIdChange,
}: MenuItemListProps) {
  return (
    <div className="lg:col-span-1 border rounded-lg overflow-hidden flex flex-col">
      <div className="p-3 border-b bg-muted/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Išči artikle..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 h-8 text-sm"
            aria-label="Išči artikle"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {/* Hrana */}
        {recipeGroups.hrana.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0">HRANA</div>
            {recipeGroups.hrana
              .filter(mi => mi.name.toLowerCase().includes(search.toLowerCase()))
              .map(mi => (
                <button
                  key={mi.id}
                  onClick={() => onSelectedMenuItemIdChange(mi.id)}
                  className={`w-full px-3 py-2.5 flex items-center justify-between text-sm hover:bg-accent/50 transition-colors border-b ${
                    selectedMenuItemId === mi.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${mi.hasRecipe ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className="sr-only">{mi.hasRecipe ? 'Ima recept' : 'Brez recepta'}</span>
                    </div>
                    <span className="truncate font-medium">{mi.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">€{mi.price.toFixed(2)}</span>
                    {mi.totalCost > 0 && (
                      <Badge className={`text-[9px] h-4 px-1 ${marginBadge(mi.totalCost > 0 ? ((mi.price - mi.totalCost) / mi.price * 100) : 0)}`}>
                        {((mi.price - mi.totalCost) / mi.price * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}
        {/* Pijača */}
        {recipeGroups.pijaca.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0">PIJAČA</div>
            {recipeGroups.pijaca
              .filter(mi => mi.name.toLowerCase().includes(search.toLowerCase()))
              .map(mi => (
                <button
                  key={mi.id}
                  onClick={() => onSelectedMenuItemIdChange(mi.id)}
                  className={`w-full px-3 py-2.5 flex items-center justify-between text-sm hover:bg-accent/50 transition-colors border-b ${
                    selectedMenuItemId === mi.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${mi.hasRecipe ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className="sr-only">{mi.hasRecipe ? 'Ima recept' : 'Brez recepta'}</span>
                    </div>
                    <span className="truncate font-medium">{mi.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">€{mi.price.toFixed(2)}</span>
                    {mi.totalCost > 0 && (
                      <Badge className={`text-[9px] h-4 px-1 ${marginBadge(mi.totalCost > 0 ? ((mi.price - mi.totalCost) / mi.price * 100) : 0)}`}>
                        {((mi.price - mi.totalCost) / mi.price * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
})
