'use client'

import { memo } from 'react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Package, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { type InventoryItemData, stockLevelColor, stockLevelText } from './constants'

interface StockItemCardProps {
  item: InventoryItemData
  isExpanded: boolean
  onToggleExpand: (_itemId: string) => void
  onOpenRestock: (_itemId: string) => void
  onOpenWriteOff: (_itemId: string) => void
  onOpenEdit: (_item: InventoryItemData) => void
  onDeleteItem: (_item: InventoryItemData) => void
}

export const StockItemCard = memo(function StockItemCard({
  item,
  isExpanded,
  onToggleExpand,
  onOpenRestock,
  onOpenWriteOff,
  onOpenEdit,
  onDeleteItem,
}: StockItemCardProps) {
  const qty = item.quantity
  const minQty = item.minQuantity
  const pct = minQty > 0 ? Math.min((qty / (minQty * 2)) * 100, 100) : 100

  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      {/* Slika artikla */}
      {item.image && (
        <div className="relative w-full h-32 bg-muted overflow-hidden">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute top-2 right-2">
            <Badge variant={stockLevelColor(qty, minQty)} className="text-xs shadow-sm">
              {stockLevelText(qty, minQty)}
            </Badge>
          </div>
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {item.image ? null : <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{item.name}</p>
              {item.description ? (
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              ) : (
                <p className="text-xs text-muted-foreground truncate">{item.supplier || 'Brez dobavitelja'}</p>
              )}
            </div>
          </div>
          {!item.image && (
            <Badge variant={stockLevelColor(qty, minQty)} className="text-xs flex-shrink-0">
              {stockLevelText(qty, minQty)}
            </Badge>
          )}
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" aria-label="Dol" className="h-7 w-7" title="Nabava" onClick={() => onOpenRestock(item.id)}>
              <ArrowDownCircle className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Gor" className="h-7 w-7" title="Razknjižba" onClick={() => onOpenWriteOff(item.id)}>
              <ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" title="Uredi" onClick={() => onOpenEdit(item)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => onDeleteItem(item)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{qty} {item.unit}</span>
          <span className="text-xs text-muted-foreground">{item.supplier || ''}</span>
        </div>

        <Progress value={pct} className="h-1.5" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Min: {minQty} {item.unit}</span>
          <span>€{safeToFixed(item.costPerUnit, 2)}/{item.unit}</span>
        </div>

        {/* Normativi info */}
        {item.servingsPerUnit > 1 && (
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
            <div className="flex justify-between">
              <span>Servisov/enoto:</span>
              <span className="font-medium">{item.servingsPerUnit}</span>
            </div>
            {item.servingSize && (
              <div className="flex justify-between">
                <span>Velikost servisa:</span>
                <span className="font-medium">{item.servingSize}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Strošek/servis:</span>
              <span className="font-medium">€{safeToFixed(item.costPerServing, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Možnih servisov:</span>
              <span className="font-medium">{Math.floor(qty * item.servingsPerUnit)}</span>
            </div>
          </div>
        )}

        {/* Razširljivo: povezani meni artikel */}
        {item.menuItem && (
          <button onClick={() => onToggleExpand(item.id)} className="flex items-center gap-1 text-xs text-primary w-full">
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Povezano: {item.menuItem.name} (€{safeToFixed(item.menuItem.price, 2)})
          </button>
        )}
        {isExpanded && item.menuItem && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 space-y-1">
            <div>Cena menija: €{safeToFixed(item.menuItem.price, 2)}</div>
            <div>Strošek servisa: €{safeToFixed(item.costPerServing, 2)}</div>
            <div className="font-medium text-green-600">
              Bruto marža: €{(item.menuItem.price - item.costPerServing).toFixed(2)} ({item.costPerServing > 0 ? Math.round(((item.menuItem.price - item.costPerServing) / item.menuItem.price) * 100) : 0}%)
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
