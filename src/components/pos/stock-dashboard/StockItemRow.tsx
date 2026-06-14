'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, AlertTriangle, XCircle, TrendingDown, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import type { StockItem } from './types'
import { stockLevelColor, stockLevelBg, progressColor, progressLabel } from './types'

// ============================================
// VRSTICA ARTIKLA V SEZNAMU ZALOGE
// ============================================

interface StockItemRowProps {
  item: StockItem
}

export const StockItemRow = memo(function StockItemRow({ item }: StockItemRowProps) {
  const pct = item.minQuantity > 0
    ? Math.min((item.quantity / (item.minQuantity * 2)) * 100, 100)
    : 100
  const servings = Math.floor(item.quantity * item.servingsPerUnit)
  const formatCurrency = (n: number) => `€${n.toFixed(2)}`

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-lg border ${stockLevelBg(item.quantity, item.minQuantity)}`}
    >
      {/* Status indikator */}
      <div className="flex-shrink-0">
        {item.quantity <= 0 ? (
          <XCircle className="h-5 w-5 text-red-600" />
        ) : item.quantity <= item.minQuantity * 0.5 ? (
          <TrendingDown className="h-5 w-5 text-orange-600" />
        ) : item.quantity <= item.minQuantity ? (
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        ) : (
          <Package className="h-5 w-5 text-emerald-600" />
        )}
      </div>

      {/* Podatki */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.name}</span>
          {item.menuItem && (
            <Badge variant="outline" className="text-[8px] h-4 px-1 flex-shrink-0">
              → {item.menuItem.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={progressLabel(pct)}>
            <div
              className={`h-full rounded-full transition-all ${progressColor(pct)}`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          <span className={`text-xs font-semibold flex-shrink-0 ${stockLevelColor(item.quantity, item.minQuantity)}`}>
            {item.quantity} / {item.minQuantity} {item.unit}
          </span>
        </div>
        {item.servingsPerUnit > 1 && (
          <span className="text-[10px] text-muted-foreground">
            ≈ {servings} servisov · {formatCurrency(item.costPerUnit)}/{item.unit}
          </span>
        )}
      </div>

      {/* Hitra dejanja */}
      <div className="flex gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Nabava"
          className="h-7 w-7 text-green-600"
          title="Nabava"
          onClick={() => {
            const event = new CustomEvent('stock-restock', { detail: { itemId: item.id } })
            window.dispatchEvent(event)
          }}
        >
          <ArrowDownCircle className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Razknjižba"
          className="h-7 w-7 text-red-600"
          title="Razknjižba"
          onClick={() => {
            const event = new CustomEvent('stock-writeoff', { detail: { itemId: item.id } })
            window.dispatchEvent(event)
          }}
        >
          <ArrowUpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
})
