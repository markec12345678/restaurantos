'use client'

// ─── Custom Tooltip za Menu Engineering graf ──────────────────

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { QUADRANT_COLORS, QUADRANT_LABELS, getProfitColorClass, type MatrixTooltipProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

export const MatrixTooltip = memo(function MatrixTooltip({ active, payload }: MatrixTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: QUADRANT_COLORS[item.quadrant] }} />
        <span className="font-semibold text-sm">{item.name}</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Kategorija:</span>
          <span>{item.category}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cena:</span>
          <span>{'\u20AC'}{safeToFixed(item.price, 2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Strosek hrane:</span>
          <span>{'\u20AC'}{safeToFixed(item.foodCost, 2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Bruto dobcek:</span>
          <span className={getProfitColorClass(item.grossProfitPercent)}>
            {safeToFixed(item.grossProfitPercent, 1)}%
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Prodano:</span>
          <span>{item.quantitySold}x</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Prihodek:</span>
          <span>{'\u20AC'}{safeToFixed(item.revenue, 2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Kvadrant:</span>
          <Badge style={{ backgroundColor: QUADRANT_COLORS[item.quadrant] + '20', color: QUADRANT_COLORS[item.quadrant] }} className="text-[10px] h-5">
            {QUADRANT_LABELS[item.quadrant]}
          </Badge>
        </div>
      </div>
    </div>
  )
})
