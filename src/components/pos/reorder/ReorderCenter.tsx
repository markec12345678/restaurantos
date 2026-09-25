'use client'

// ============================================
// R129 (epic #115 P1-07) — CENTER NAROČIL
// Pregled predlogov naročanja z razlago (faktorji, odprte naročilnice),
// izbira akcijskih artiklov in ustvarjanje OSNUTKOV naročilnic
// (POST /api/reorder/draft-po — ne mešati s "hitrim prevzemom"
//  POST /api/inventory/reorder, ki direktno poveča zalogo).
// ============================================

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, ClipboardList, Loader2, RefreshCw, ShieldCheck, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR } from '@/lib/safe-format'
import { useReorderCenter } from './useReorderCenter'
import { ReorderItemCard } from './ReorderItemCard'
import { formatDraftPoPackSummary } from './helpers'

export function ReorderCenter() {
  const {
    suggestions,
    summary,
    isLoading,
    isFetching,
    isError,
    refetch,
    selectedCount,
    estimatedTotal,
    toggleItem,
    selectAllActionable,
    clearSelection,
    createDraft,
    isCreating,
    selected,
    lastDraft,
  } = useReorderCenter()

  // — nalaganje: skeletni prikaz —
  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-9 w-64" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-6 w-28" />)}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    )
  }

  // — napaka mreže —
  if (isError) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Napaka pri nalaganju predlogov</AlertTitle>
          <AlertDescription>Predlogov naročanja ni bilo mogoče naložiti. Poskusite znova.</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Znova naloži
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* glava */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList className="h-5 w-5" />
            Center naročil
          </h2>
          <p className="text-xs text-muted-foreground">
            Predlogi naročanja z razlago — izberi artikle in ustvari osnutke naročilnic po dobaviteljih.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Osveži
          </Button>
          <Button variant="outline" size="sm" onClick={selectAllActionable} disabled={suggestions.length === 0}>
            Izberi vse nizke
          </Button>
          {selectedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Počisti izbiro
            </Button>
          )}
        </div>
      </div>

      {/* povzetek po statusih */}
      <div className="flex flex-wrap gap-2" role="status" aria-label="Povzetek stanj zaloge">
        <Badge variant="outline" className="border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          Kritično: {summary.critical}
        </Badge>
        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Nizko: {summary.low}
        </Badge>
        <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Pokrito z naročilnico: {summary.coveredByPo}
        </Badge>
        <Badge variant="secondary">Brez podatkov: {summary.withoutData}</Badge>
      </div>

      {/* zabeležba zadnjega osnutka (preskočeni artikli / ustvarjene naročilnice) */}
      {lastDraft && lastDraft.orders.length > 0 && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            Nazadnje ustvarjeno: {lastDraft.orders.map(o => o.poNumber).join(', ')}
          </p>
          {/* R131 (P1-13): pack povzetek vrstic — defenzivno, samo ko odgovor vsebuje
              orders[].items (stari draft-po odgovor NE dobi dodatnega izpisa) */}
          {lastDraft.orders.map(o => {
            const packSummary = formatDraftPoPackSummary(o.items)
            return packSummary ? (
              <p key={o.id ?? o.poNumber} className="text-[11px]">
                {o.poNumber} · {packSummary}
              </p>
            ) : null
          })}
        </div>
      )}

      {/* seznam predlogov */}
      {suggestions.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <ShieldCheck className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p className="font-medium">Ni artiklov pod točko naročila — zaloga je OK.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {suggestions.map(s => (
            <ReorderItemCard
              key={s.itemId || s.name}
              suggestion={s}
              selected={selected.has(s.itemId)}
              onToggle={toggleItem}
            />
          ))}
        </div>
      )}

      {/* lepljiva spodnja vrstica (mobilno prijazna, varna cona iOS) */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs sm:text-sm">
              <span className="font-semibold">Izbranih artiklov: {selectedCount}</span>
              <span className="text-muted-foreground">
                {' '}· Ocenjena vrednost:{' '}
                <strong className="text-foreground">{formatEUR(estimatedTotal)}</strong>
              </span>
            </p>
            <Button size="sm" onClick={createDraft} disabled={isCreating}>
              {isCreating
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />}
              Ustvari osnutek naročilnic
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReorderCenter
