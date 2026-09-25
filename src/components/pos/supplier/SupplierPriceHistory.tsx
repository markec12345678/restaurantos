'use client'

// ============================================
// R130-b (epic #115 P1-08) — ZGODOVINA CEN DOBAVITELJA
// Mounta se v razširjenem pogledu dobavitelja (SuppliersList) — fetch
// /api/inventory/price-history?supplierId= se zgodi šele ko se sekcija odpre
// (komponenta se renderira samo, ko je dobavitelj razširjen).
//
// Kontrakt backend-a (R130-a, agent-ctx/R130-a2-tests.md): cene prihajajo
// kot STRINGI iz Decimal (DB skala 12,4) — za prikaz jih pretvorimo z
// toNum iz '@/lib/decimal' (NI parseFloat). Trend kanon: 'up' = OPOZORILO
// za kuhinjo (dražje, rdeče), 'down' = ceneje (emerald), 'stable' (zinc),
// 'insufficient' = malo podatkov (kanon P1-07: ne izmišljujemo podatkov).
// Barve po hišni paleti repa: rdeča/amber/emerald/zinc — BREZ modrih/indigo.
// ============================================

import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, ArrowRight, HelpCircle, History, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toNum } from '@/lib/decimal'
import { formatEUR } from '@/lib/safe-format'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// --- Kontrakt GET /api/inventory/price-history?supplierId= (Mode B) ---
type PriceTrend = 'up' | 'down' | 'stable' | 'insufficient'

export interface SupplierPriceHistoryItem {
  inventoryItemId: string
  name: string
  unit: string
  // Decimal STRINGI čez API mejo (ne number!)
  lastPrice?: string | null
  lastAt?: string | null
  avg30?: string | null
  avg90?: string | null
  min90?: string | null
  max90?: string | null
  count?: number
  trend?: PriceTrend
}

interface PriceHistoryResponse {
  items?: SupplierPriceHistoryItem[]
  rows?: unknown[]
}

interface SupplierPriceHistoryProps {
  supplierId: string
  className?: string
}

// --- Trend badge (hišna paleta: red / emerald / zinc / secondary) ---
const TREND_STYLES: Record<PriceTrend, { className: string; icon: typeof TrendingUp }> = {
  // 'up' = dražje → OPOZORILO za kuhinjo (rdečkasto)
  up: { className: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300', icon: TrendingUp },
  // 'down' = ceneje → pozitivno (emerald)
  down: { className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: TrendingDown },
  // 'stable' → nevtralno (zinc)
  stable: { className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300', icon: ArrowRight },
  // 'insufficient' → malo podatkov (kanon: ne izmišljujemo)
  insufficient: { className: '', icon: HelpCircle },
}

function TrendBadge({ trend }: { trend: PriceTrend }) {
  const style = TREND_STYLES[trend] ?? TREND_STYLES.insufficient
  const Icon = style.icon
  const labelKey = trend === 'up'
    ? 'suppliers.priceHistory.trendUp'
    : trend === 'down'
      ? 'suppliers.priceHistory.trendDown'
      : trend === 'stable'
        ? 'suppliers.priceHistory.trendStable'
        : 'suppliers.priceHistory.trendInsufficient'
  return (
    <Badge
      variant={trend === 'insufficient' ? 'secondary' : 'outline'}
      className={cn('whitespace-nowrap text-[10px]', style.className)}
      title={t(labelKey)}
    >
      <Icon className="mr-0.5 h-3 w-3" aria-hidden="true" />
      {t(labelKey)}
    </Badge>
  )
}

/** Varni datum v sl-SI obliki → null, če ni razumljiv (lokalna kopija vzorca reorder/helpers) */
function formatDateSafe(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  try {
    return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

export const SupplierPriceHistory = memo(function SupplierPriceHistory({ supplierId, className }: SupplierPriceHistoryProps) {
  const query = useQuery({
    queryKey: queryKeys.suppliers.priceHistory(supplierId),
    enabled: Boolean(supplierId),
    staleTime: 60000,
    queryFn: async (): Promise<PriceHistoryResponse> => {
      const res = await authFetch(`/api/inventory/price-history?supplierId=${encodeURIComponent(supplierId)}`)
      if (!res.ok) throw new Error(`price-history ${res.status}`)
      return (await res.json()) as PriceHistoryResponse
    },
  })

  const items = Array.isArray(query.data?.items) ? query.data.items : []

  return (
    <section className={cn('space-y-2', className)} aria-label={t('suppliers.priceHistory.title')}>
      {/* naslov sekcije */}
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        {t('suppliers.priceHistory.title')}
      </h4>

      {/* nalaganje — skelet */}
      {query.isLoading && (
        <div className="space-y-1.5" role="status" aria-busy="true">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
        </div>
      )}

      {/* napaka + retry */}
      {query.isError && (
        <div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('suppliers.priceHistory.error')}</AlertTitle>
          </Alert>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => query.refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" /> {t('suppliers.priceHistory.retry')}
          </Button>
        </div>
      )}

      {/* prazno stanje (kanon: ne izmišljujemo podatkov) */}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <History className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
          {t('suppliers.priceHistory.empty')}
        </div>
      )}

      {/* tabela (mobilno: horizontalni scroll) */}
      {!query.isLoading && !query.isError && items.length > 0 && (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[560px] text-xs" aria-label={t('suppliers.priceHistory.title')}>
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.priceHistory.item')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.priceHistory.lastPrice')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.priceHistory.trend')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.priceHistory.avg30')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.priceHistory.observations')}</th>
                <th scope="col" className="py-1.5 font-medium">{t('suppliers.priceHistory.lastAt')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                // Decimal STRINGI → toNum ('@/lib/decimal'), NE parseFloat
                const lastPrice = item.lastPrice == null ? null : toNum(item.lastPrice)
                const avg30 = item.avg30 == null ? null : toNum(item.avg30)
                const lastAt = formatDateSafe(item.lastAt)
                return (
                  <tr key={item.inventoryItemId} className="border-b last:border-0">
                    <td className="max-w-[180px] truncate py-2 pr-3 font-medium" title={item.name}>{item.name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {lastPrice === null ? '—' : <span className="font-semibold">{formatEUR(lastPrice)} <span className="font-normal text-muted-foreground">/ {item.unit}</span></span>}
                    </td>
                    <td className="py-2 pr-3"><TrendBadge trend={item.trend ?? 'insufficient'} /></td>
                    <td className="py-2 pr-3 whitespace-nowrap">{avg30 === null ? '—' : formatEUR(avg30)}</td>
                    <td className="py-2 pr-3 tabular-nums">{Number(item.count ?? 0)}×</td>
                    <td className="py-2 whitespace-nowrap text-muted-foreground">{lastAt ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
})
