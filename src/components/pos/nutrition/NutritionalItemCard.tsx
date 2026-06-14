'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Leaf, Info } from 'lucide-react'
import type { MenuItemData } from './constants'
import { ALLERGEN_MAP } from './constants'

// --- Props ---

interface NutritionalItemCardProps {
  item: MenuItemData
}

// --- Komponenta ---

export const NutritionalItemCard = memo(function NutritionalItemCard({
  item,
}: NutritionalItemCardProps) {
  const allergens = item.allergens ? item.allergens.split(',').map(a => a.trim()).filter(Boolean) : []

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Ime + cena */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-sm">{item.name}</div>
            <div className="text-xs text-muted-foreground">{item.category?.name}</div>
          </div>
          <span className="font-bold text-green-600">€{item.price.toFixed(2)}</span>
        </div>

        {/* Alergeni */}
        {allergens.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Vsebuje alergene:
            </div>
            <div className="flex flex-wrap gap-1">
              {allergens.map(a => {
                const cfg = ALLERGEN_MAP[a]
                const Icon = cfg?.icon || Info
                return (
                  <Badge key={a} variant="outline" className="text-xs gap-1" title={cfg?.label || `Alergen ${a}`}>
                    <Icon className="h-3 w-3" />
                    {a}
                  </Badge>
                )
              })}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {allergens.map(a => {
                const cfg = ALLERGEN_MAP[a]
                return cfg ? <div key={a}>{a}. {cfg.label}</div> : null
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <Leaf className="h-3 w-3" />
            Brez znanih alergenov
          </div>
        )}
      </CardContent>
    </Card>
  )
})
