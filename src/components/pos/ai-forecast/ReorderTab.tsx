'use client'

// ============================================
// TAB: Pametna naročila — izbira in oddaja naročil
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck, Package, ShoppingCart, CheckCircle2 } from 'lucide-react'
import { riskConfig, fmt, fmtQty } from './constants'
import type { ReorderTabProps } from './constants'

export const ReorderTab = memo(function ReorderTab({
  reorders,
  isLoading,
  selectedItems,
  onToggleItem,
  onSelectAll,
  onCreateReorder,
  isReorderPending,
}: ReorderTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
    )
  }

  if (reorders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">Vse zaloge so v redu!</p>
        <p className="text-sm">Ni potrebe po naročanju</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Skupni predlagani strošek: <strong>€{fmt(reorders.reduce((s, r) => s + r.totalCost, 0))}</strong>
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
          >
            Izberi vse
          </Button>
          <Button
            size="sm"
            onClick={onCreateReorder}
            disabled={selectedItems.size === 0 || isReorderPending}
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Naroči {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
          </Button>
        </div>
      </div>

      {reorders.map(r => {
        const risk = riskConfig[r.urgency] || riskConfig.low
        const isSelected = selectedItems.has(r.inventoryItemId)

        return (
          <Card
            key={r.inventoryItemId}
            className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onToggleItem(r.inventoryItemId)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleItem(r.inventoryItemId) } }}
            aria-label={`${isSelected ? 'Odznači' : 'Izberi'} ${r.itemName}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded flex items-center justify-center ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{r.itemName}</p>
                      <Badge className={`text-[10px] ${risk.bgColor}`}>{risk.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.supplier && `${r.supplier} · `}
                      Trenutno: {fmtQty(r.currentStock)} {r.unit} ·
                      Predlagano: <strong>{fmtQty(r.suggestedQty)} {r.unit}</strong>
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">{r.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">€{fmt(r.totalCost)}</p>
                  <p className="text-[10px] text-muted-foreground">@ €{fmt(r.costPerUnit)}/{r.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </>
  )
})
