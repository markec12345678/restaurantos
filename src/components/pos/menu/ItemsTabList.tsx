'use client'

import { memo } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, ImageIcon } from 'lucide-react'
import type { ItemsTabProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// SEZNAMSKI POGLED ARTIKLOV
// ============================================
interface ItemsTabListViewProps {
  filteredItems: ItemsTabProps['filteredItems']
  categories: ItemsTabProps['categories']
  onEditItem: ItemsTabProps['onEditItem']
  onDeleteItem: ItemsTabProps['onDeleteItem']
  onToggleAvailability: ItemsTabProps['onToggleAvailability']
}

export const ItemsTabList = memo(function ItemsTabList({
  filteredItems,
  categories,
  onEditItem,
  onDeleteItem,
  onToggleAvailability,
}: ItemsTabListViewProps) {
  // FIX TypeError: b?.filter is not a function — filteredItems in itemModGroups
  // sta lahko undefined če query vrne nepričakovan format
  const items = Array.isArray(filteredItems) ? filteredItems : []
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const cat = categories?.find((c) => c.id === item.categoryId)
        // FIX: Array.isArray preverba za modifierGroups
        const rawModGroups = item.modifierGroups as { modifierGroup: { name: string } }[] | undefined
        const itemModGroups = Array.isArray(rawModGroups) ? rawModGroups : []
        return (
          <div key={item.id as string} className={`flex items-center justify-between p-3 rounded-lg border bg-card ${!item.isAvailable ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3">
              {item.image ? (
                <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 relative">
                  <Image src={String(item.image)} alt={String(item.name)} fill sizes="48px" className="object-cover" />
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
              <span className="font-bold text-sm">&euro;{safeToFixed(Number(item.price), 2)}</span>
              <Switch checked={Boolean(item.isAvailable)} onCheckedChange={(c) => onToggleAvailability(item.id as string, c)} className="scale-75" />
              <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" onClick={() => onEditItem(item)}><Pencil className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" onClick={() => onDeleteItem(item.id as string)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        )
      })}
    </div>
  )
})
