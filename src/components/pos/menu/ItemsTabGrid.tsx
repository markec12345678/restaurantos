'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, ImageIcon } from 'lucide-react'
import type { ItemsTabProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// MREŽNI POGLED ARTIKLOV
// ============================================
interface ItemsTabGridViewProps {
  filteredItems: ItemsTabProps['filteredItems']
  categories: ItemsTabProps['categories']
  onEditItem: ItemsTabProps['onEditItem']
  onDeleteItem: ItemsTabProps['onDeleteItem']
  onToggleAvailability: ItemsTabProps['onToggleAvailability']
}

export const ItemsTabGrid = memo(function ItemsTabGrid({
  filteredItems,
  categories,
  onEditItem,
  onDeleteItem,
  onToggleAvailability,
}: ItemsTabGridViewProps) {
  // FIX TypeError: b?.filter is not a function — filteredItems je lahko undefined
  const items = Array.isArray(filteredItems) ? filteredItems : []
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item) => {
        const cat = categories?.find((c) => c.id === item.categoryId)
        // FIX: Array.isArray preverba za modifierGroups
        const rawModGroups = item.modifierGroups as { modifierGroup: { name: string } }[] | undefined
        const itemModGroups = Array.isArray(rawModGroups) ? rawModGroups : []
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
                <p className="text-primary font-bold text-sm">&euro;{safeToFixed(Number(item.price), 2)}</p>
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
  )
})
