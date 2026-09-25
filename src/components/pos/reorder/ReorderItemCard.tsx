'use client'

// ============================================
// R129 (P1-07) — kartica artikla v Centru naročil
// Mobilno-first: navpična kartica, md+ dvostolpična razporeditev.
// Checkbox SAMO na akcijskih vrstah (low|critical, suggestedQty > 0,
// ni pokrito z naročilnico). Razlaga "Zakaj ta predlog?" je zložljiva.
// ============================================

import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ChevronDown, History, Tag, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR } from '@/lib/safe-format'
import { t } from '@/lib/i18n'
import { isActionable, fmtQty, formatDateSafe, type ReorderCenterSuggestion } from './helpers'
import { StatusBadge } from './StatusBadge'
import { FactorsList } from './FactorsList'

interface ReorderItemCardProps {
  suggestion: ReorderCenterSuggestion
  selected: boolean
  onToggle: (itemId: string) => void
}

/** Mini trak: zaloga proti točki naročila / minimalni zalogi */
function QtyBar({ suggestion: s }: { suggestion: ReorderCenterSuggestion }) {
  const target = s.reorderPoint ?? s.minQuantity ?? 0
  const max = Math.max(s.quantity, target, s.minQuantity ?? 0, 1)
  const fillPct = Math.min(100, (s.quantity / max) * 100)
  const targetPct = target > 0 ? Math.min(100, (target / max) * 100) : null
  const fillClass = s.status === 'critical' ? 'bg-red-500' : s.status === 'low' ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1">
      <div aria-hidden className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', fillClass)} style={{ width: `${fillPct}%` }} />
        {targetPct !== null && (
          <div className="absolute top-0 h-full w-0.5 bg-foreground/70" style={{ left: `calc(${targetPct}% - 1px)` }} />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Zaloga {fmtQty(s.quantity)}
        {target > 0 && ` · točka naročila ${fmtQty(target)}`}
        {s.minQuantity !== null && s.minQuantity > 0 && ` · min ${fmtQty(s.minQuantity)}`}
        {` ${s.unit}`}
      </p>
    </div>
  )
}

export const ReorderItemCard = memo(function ReorderItemCard({ suggestion: s, selected, onToggle }: ReorderItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const actionable = isActionable(s)

  const openPoLabel = (() => {
    if (s.openPoQty > 0) return `Odprte naročilnice: ${fmtQty(s.openPoQty)} ${s.unit}`
    if (s.openPos.length > 0) return 'Odprte naročilnice'
    return null
  })()

  return (
    <Card className={cn('transition-all', selected && 'ring-2 ring-primary')}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* lev del: checkbox + identiteta + mini trak */}
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {/* Checkbox samo na akcijskih vrstah; sicer prostor za poravnavo */}
            {actionable ? (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggle(s.itemId)}
                aria-label={`Izberi ${s.name}`}
                className="mt-0.5"
              />
            ) : (
              <span aria-hidden className="mt-0.5 block h-[18px] w-[18px] shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold">{s.name}</p>
                <StatusBadge status={s.status} />
                {s.dataStatus === 'insufficient' && (
                  <Badge variant="secondary" className="text-[10px]">brez podatkov</Badge>
                )}
              </div>
              {s.supplier && (
                <p className="truncate text-xs text-muted-foreground">Dobavitelj: {s.supplier}</p>
              )}
              <QtyBar suggestion={s} />
            </div>
          </div>
          {/* desni del: predlagana količina prominentno + razlaga */}
          <div className="flex items-end justify-between gap-2 md:justify-end">
            <div className="md:text-right">
              <p className="text-lg font-bold leading-tight">
                {fmtQty(s.suggestedQty)} <span className="text-xs font-normal text-muted-foreground">{s.unit}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">predlagano naročilo</p>
              <p className="text-xs font-medium">{formatEUR(s.suggestedQty * s.unitPrice)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(v => !v)}
              aria-expanded={expanded}
              className="shrink-0 text-xs text-muted-foreground"
            >
              Zakaj ta predlog?
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {/* R130-b (P1-08): vir enotne cene — razložljiva veriga dobavitelj → cena */}
            {s.unitPriceSource === 'supplier-history' ? (
              <p className="flex flex-wrap items-center text-xs">
                <Badge
                  variant="outline"
                  className="whitespace-nowrap border-zinc-300 bg-zinc-100 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <History className="mr-0.5 h-3 w-3" aria-hidden="true" />
                  {t('suppliers.priceHistory.sourceSupplierHistory')}
                  {formatDateSafe(s.unitPriceAsOf) && (
                    <span className="font-normal"> · {formatDateSafe(s.unitPriceAsOf)}</span>
                  )}
                </Badge>
              </p>
            ) : (
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Tag className="h-3 w-3" aria-hidden="true" />
                {t('suppliers.priceHistory.sourceItemCost')}
              </p>
            )}
            <FactorsList factors={s.factors} />
            {/* odprte naročilnice + pričakovana dobava (nova polja R129-server; skrito proti staremu odgovoru) */}
            {(openPoLabel || s.expectedDelivery) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {openPoLabel && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    {openPoLabel}
                    {s.openPos.length > 0 && ` (${s.openPos.map(po => {
                      const date = formatDateSafe(po.expectedDate)
                      return date ? `${po.poNumber}, pričakovano ${date}` : po.poNumber
                    }).join(' · ')})`}
                  </span>
                )}
                {!openPoLabel && s.expectedDelivery && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    Pričakovana dobava: {formatDateSafe(s.expectedDelivery) ?? s.expectedDelivery}
                  </span>
                )}
              </div>
            )}
            {s.dataStatus === 'insufficient' && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Podatki o porabi ne zadostijo napovedi — predlog temelji na minimalni zalogi.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
