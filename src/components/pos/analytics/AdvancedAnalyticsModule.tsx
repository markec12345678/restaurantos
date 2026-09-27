'use client'
// ============================================
// R149-c (epic #115 #36) — Napredna analitika (Advanced analytics)
// POS-shell modul 'advanced-analytics' (navItems 'Analitika' → permission
// view_reports; GET /api/analytics/overview — kontrakt R149-a/R149-b).
//
// Struktura (vsebina hardcoded sl — kanon modulov; samo nav label je i18n):
//   1. Header 'Napredna analitika' + obdobje/okno opomba (meta iz odgovora),
//   2. MODEL A lokacijski select (samo skrbniki — kanon R146-c/R147-c 1:1:
//      useFormLocations + ALL_LOCATIONS_VALUE 'all' + encodeURIComponent),
//   3. range preseti 7/30/90 dni (LJ koledar — ljubljanaTodayStr kanon) +
//      granularnost select (dan/teden/mesec — privzeto 'day'),
//   4. KPI vrstica (StatsCard kanon) + comparison badges (deltaPct puščica:
//      emerald gor / rdeča dol / nevtralna — deltaPct null = 'brez primerjave',
//      NIKOLI NaN),
//   5. recharts: BarChart (prihodek po obdobjih) + PieChart (kategorije +
//      plačilna mešanica) — ChartsSection vzorec, PIE_COLORS BREZ blue/indigo,
//   6. hourly profile 24 ur (CSS mini stolpci — fiksni vektor s strežnika),
//   7. top artikli seznam + tipi naročil + staff tabela ('(neimenovan)'
//      fallback za prazno ime),
//   8. stanja: skeleton (aria-busy) / Alert destructive + 'Poskusi znova'
//      (refetch) / prazno stanje 'Ni podatkov za izbrano obdobje'
//      (kpis.orders === 0).
//
// Napaka: toast.error passthrough TOČNO body.error (kanon R143/R146/R147).
// 390px: grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-3, min-w-0/truncate
// povsod, fiksne višine grafov v min-w-0 vsebnikih (brez prepovedanih širin).
// Paleta: amber/emerald/red/purple/pink/lime/orange/zinc — brez blue/indigo.
// ============================================

import { memo, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, AlertDescription, AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/pos/StatsCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import {
  ArrowDownRight, ArrowUpRight, Banknote, Clock, CreditCard, HandCoins,
  Minus, Percent, Receipt, RefreshCw, ShoppingBag, Tag, TrendingUp, UtensilsCrossed, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { useAuthUser } from '@/components/pos/sidebar/useAuthUser'
import { queryKeys } from '@/lib/query-keys'
import { formatEUR, formatNumberSl } from '@/lib/safe-format'
import { ljubljanaTodayStr } from '@/lib/timezone-sl'

// ─── MODEL A (kanon R146-c ExportReport / R147-c portability, 1:1) ───────────

/** Sentinel za 'Vse lokacije (globalno)' — Radix SelectItem ne sprejme praznega value. */
export const ALL_LOCATIONS_VALUE = 'all'

/** Fallback sporočilo, če strežnik ne vrne body.error. */
export const ANALYTICS_ERROR_MESSAGE = 'Napaka pri nalaganju analitike'

interface FormLocationOption {
  id: string
  name: string
  isActive: boolean
}

function useFormLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['analytics', 'form-locations'] as const,
    queryFn: async (): Promise<FormLocationOption[]> => {
      const res = await authFetch('/api/locations')
      if (!res.ok) return []
      const json = await res.json() as unknown
      const rows: Array<Record<string, unknown>> = Array.isArray(json)
        ? json as Array<Record<string, unknown>>
        : ((json as { locations?: Array<Record<string, unknown>> })?.locations ?? [])
      return rows
        .map((r) => ({ id: String(r.id ?? ''), name: String(r.name ?? ''), isActive: r.isActive !== false }))
        .filter((r) => r.id && r.name)
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}

/** URL overview zahteve — locationId SAMO za skrbniško izbiro (brez = globalno, MODEL A). */
export function buildOverviewUrl(start: string, end: string, granularity: string, locationId?: string | null): string {
  const locationParam = locationId ? `&locationId=${encodeURIComponent(locationId)}` : ''
  return `/api/analytics/overview?start=${start}&end=${end}&granularity=${granularity}${locationParam}`
}

/** Koledarski odmik 'YYYY-MM-DD' za delta dni (DST-varen čisti koledarski subtract — timezone-sl kanon). */
export function shiftDateStr(dateStr: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return dateStr
  const shifted = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays))
  return shifted.toISOString().slice(0, 10)
}

// ─── Odgovor (zrcalo R149-b route.ts — deepToNumbers shape) ─────────────────

export interface AnalyticsOverviewResponse {
  window: { start: string; end: string; granularity: string; prevStart: string; prevEnd: string }
  kpis: { revenue: number; tax: number; tips: number; discounts: number; orders: number; avgOrderValue: number }
  series: Array<{ bucket: string; start: string; end: string; revenue: number; orders: number; avgOrderValue: number }>
  comparison: Record<'revenue' | 'orders' | 'avgOrderValue', { current: number; previous: number; deltaPct: number | null }>
  topItems: Array<{ menuItemId: string; name: string; quantity: number; revenue: number }>
  categoryBreakdown: Array<{ category: string; quantity: number; revenue: number }>
  hourlyProfile: Array<{ hour: number; label: string; revenue: number; orders: number }>
  paymentMix: Array<{ type: string; amount: number; tips: number; count: number }>
  orderTypeMix: Array<{ type: string; revenue: number; orders: number }>
  staffPerformance: Array<{ employeeId: string; name: string; revenue: number; orders: number }>
  meta: { rowCap: number; windowDays: number }
}

type Granularity = 'day' | 'week' | 'month'

const GRANULARITY_LABELS: Record<Granularity, string> = { day: 'Dan', week: 'Teden', month: 'Mesec' }
const RANGE_PRESETS: Array<{ days: 7 | 30 | 90; label: string }> = [
  { days: 7, label: '7 dni' },
  { days: 30, label: '30 dni' },
  { days: 90, label: '90 dni' },
]

/** Paleta za tortne diagrame — brez blue/indigo (hišno pravilo BUG-04). */
const PIE_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#84cc16', '#f97316', '#eab308']

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: 'Gotovina', card: 'Kartica', mobile: 'Mobilno', voucher: 'Voucher',
  loyalty: 'Zvestoba', giftcard: 'Darilna kartica', alternate: 'Drugo',
}
const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Na mestu', takeout: 'Za s seboj', delivery: 'Dostava',
}

// ─── Comparison badge (deltaPct puščica; null = nevtralno, nikoli NaN) ──────

interface ComparisonMetric { current: number; previous: number; deltaPct: number | null }

function ComparisonBadge({ label, metric }: { label: string; metric: ComparisonMetric | undefined }) {
  if (!metric) return null
  const pct = metric.deltaPct
  if (pct === null || !Number.isFinite(pct)) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300"
        data-testid="analytics-delta-neutral"
      >
        <Minus className="h-3 w-3" aria-hidden="true" />
        {label}: brez primerjave
      </span>
    )
  }
  if (pct > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        data-testid="analytics-delta-up"
      >
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        {label}: +{formatNumberSl(pct, 1)} %
      </span>
    )
  }
  if (pct < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400"
        data-testid="analytics-delta-down"
      >
        <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
        {label}: {formatNumberSl(pct, 1)} %
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300"
      data-testid="analytics-delta-neutral"
    >
      <Minus className="h-3 w-3" aria-hidden="true" />
      {label}: ±{formatNumberSl(Math.abs(pct), 1)} %
    </span>
  )
}

/** trend za StatsCard subtitle-barvo (kanon StatsCard: up=emerald, down=red). */
function trendOf(pct: number | null | undefined): 'up' | 'down' | 'neutral' | undefined {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'neutral'
  if (pct > 0) return 'up'
  if (pct < 0) return 'down'
  return 'neutral'
}

// ─── Glavni modul ───────────────────────────────────────────────────────────

export const AdvancedAnalyticsModule = memo(function AdvancedAnalyticsModule() {
  // MODEL A: select vidijo samo skrbniki (kanon R146-c/R147-c).
  const authUser = useAuthUser()
  const isTenantAdmin = authUser?.role === 'admin' || authUser?.role === 'super_admin'
  const { data: locations } = useFormLocations(isTenantAdmin)
  const showLocationSelect = isTenantAdmin && (locations?.length ?? 0) > 0
  const [locationFilter, setLocationFilter] = useState<string>(ALL_LOCATIONS_VALUE)
  const selectedLocationId = locationFilter === ALL_LOCATIONS_VALUE ? null : locationFilter

  // Okno: LJ danes ± preset (kanon ljubljanaTodayStr; privzeto 30 dni).
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30)
  const [granularity, setGranularity] = useState<Granularity>('day')
  const end = ljubljanaTodayStr()
  const start = shiftDateStr(end, -(rangeDays - 1))

  // Overview query — queryKey unifikacija: EN koren ['analytics'] prek barrel.
  const overviewQuery = useQuery({
    queryKey: queryKeys.analytics.overview({ start, end, granularity, locationId: selectedLocationId }),
    queryFn: async (): Promise<AnalyticsOverviewResponse> => {
      const res = await authFetch(buildOverviewUrl(start, end, granularity, selectedLocationId))
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errBody?.error || ANALYTICS_ERROR_MESSAGE)
      }
      return await res.json() as Promise<AnalyticsOverviewResponse>
    },
    retry: 1,
  })
  const data = overviewQuery.data ?? null
  const kpis = data?.kpis ?? null
  const isEmpty = kpis !== null && kpis.orders === 0

  // Napaka → toast.error passthrough TOČNO body.error (kanon R143/R146/R147).
  useEffect(() => {
    if (overviewQuery.isError) {
      toast.error(overviewQuery.error instanceof Error ? overviewQuery.error.message : ANALYTICS_ERROR_MESSAGE)
    }
  }, [overviewQuery.isError, overviewQuery.error])

  const hourly = data?.hourlyProfile ?? []
  const hourlyMax = hourly.reduce((max, h) => Math.max(max, h.revenue), 0)
  const chartSeries = (data?.series ?? []).map((s) => ({ bucket: s.bucket, revenue: s.revenue }))
  const categoryChart = (data?.categoryBreakdown ?? []).map((c) => ({ name: c.category, revenue: c.revenue }))
  const paymentChart = (data?.paymentMix ?? []).map((p) => ({ name: PAYMENT_TYPE_LABELS[p.type] ?? p.type, amount: p.amount }))

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 1. Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          <TrendingUp className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight">Napredna analitika</h2>
          <p className="text-sm text-muted-foreground">
            Prihodek, naročila in učinkovitost za izbrano obdobje — z združitvijo po dnevu/tednu/mesecu
          </p>
        </div>
      </div>

      {/* 2. MODEL A lokacijski select (samo skrbniki) */}
      {showLocationSelect && (
        <div className="space-y-2">
          <Label htmlFor="analytics-location" className="text-sm font-semibold">Lokacija</Label>
          <Select value={locationFilter} onValueChange={v => setLocationFilter(v)}>
            <SelectTrigger id="analytics-location" className="w-full sm:max-w-xs" aria-label="Izbira lokacije za analitiko">
              <SelectValue placeholder="Vse lokacije (globalno)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS_VALUE}>Vse lokacije (globalno)</SelectItem>
              {locations!.map(l => (
                <SelectItem key={l.id} value={l.id} disabled={!l.isActive}>
                  {l.name}{!l.isActive ? ' (neaktivna)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Izberite lokacijo za analitiko posamezne poslovalnice. Pustite izbrano »Vse lokacije« za globalni pregled.
          </p>
        </div>
      )}

      {/* 3. Range preseti + granularnost */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Obdobje</Label>
          <div className="flex gap-2" role="group" aria-label="Izbira obdobja">
            {RANGE_PRESETS.map(preset => (
              <button
                key={preset.days}
                type="button"
                onClick={() => setRangeDays(preset.days)}
                aria-label={`Zadnjih ${preset.days} dni`}
                aria-pressed={rangeDays === preset.days}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                  rangeDays === preset.days
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="analytics-granularity" className="text-sm font-semibold">Granularnost</Label>
          <Select value={granularity} onValueChange={v => setGranularity(v as Granularity)}>
            <SelectTrigger id="analytics-granularity" className="w-36" aria-label="Združevanje po obdobjih">
              <SelectValue placeholder="Dan" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map(g => (
                <SelectItem key={g} value={g}>{GRANULARITY_LABELS[g]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="analytics-window-note">
          Obdobje {start} — {end} (Europe/Ljubljana)
          {data ? ` · prejšnje okno ${data.window.prevStart} — ${data.window.prevEnd} · omejitev ${formatNumberSl(data.meta.rowCap, 0)} naročil` : ''}
        </p>
      </div>

      {/* 4.–7. Vsebina: skeleton / napaka / prazno / podatki */}
      {overviewQuery.isLoading ? (
        <div aria-busy="true" aria-label="Analitika se nalaga" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (<Skeleton key={`kpi-${i}`} className="h-24" />))}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : overviewQuery.isError ? (
        <Card>
          <CardContent className="p-4">
            <Alert variant="destructive">
              <AlertTitle>Napaka pri nalaganju analitike</AlertTitle>
              <AlertDescription>
                {overviewQuery.error instanceof Error ? overviewQuery.error.message : ANALYTICS_ERROR_MESSAGE}
                {' '}Podatki ostanejo nespremenjeni — poskusite znova.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="sm"
              onClick={() => overviewQuery.refetch()}
              className="mt-3 gap-2"
              aria-label="Poskusi znova naložiti analitiko"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Poskusi znova
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Ni podatkov za izbrano obdobje</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI vrstica (StatsCard kanon) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatsCard
              title="Prihodek"
              value={formatEUR(kpis!.revenue)}
              subtitle={data ? `prejšnje obdobje: ${formatEUR(data.comparison.revenue.previous)}` : undefined}
              icon={Banknote}
              trend={data ? trendOf(data.comparison.revenue.deltaPct) : undefined}
              className="min-w-0"
            />
            <StatsCard
              title="Naročila"
              value={kpis!.orders}
              subtitle={data ? `prejšnje obdobje: ${data.comparison.orders.previous}` : undefined}
              icon={ShoppingBag}
              trend={data ? trendOf(data.comparison.orders.deltaPct) : undefined}
              className="min-w-0"
            />
            <StatsCard
              title="Povprečni račun"
              value={formatEUR(kpis!.avgOrderValue)}
              subtitle={data ? `prejšnje obdobje: ${formatEUR(data.comparison.avgOrderValue.previous)}` : undefined}
              icon={Receipt}
              trend={data ? trendOf(data.comparison.avgOrderValue.deltaPct) : undefined}
              className="min-w-0"
            />
            <StatsCard title="Napitnine" value={formatEUR(kpis!.tips)} icon={HandCoins} className="min-w-0" />
            <StatsCard title="DDV" value={formatEUR(kpis!.tax)} icon={Percent} className="min-w-0" />
            <StatsCard title="Popusti" value={formatEUR(kpis!.discounts)} icon={Tag} className="min-w-0" />
          </div>

          {/* Comparison badges (deltaPct puščice) */}
          {data && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">vs prejšnje obdobje:</span>
              <ComparisonBadge label="Prihodek" metric={data.comparison.revenue} />
              <ComparisonBadge label="Naročila" metric={data.comparison.orders} />
              <ComparisonBadge label="Povprečni račun" metric={data.comparison.avgOrderValue} />
            </div>
          )}

          {/* Prihodek po obdobjih (BarChart) + kategorije (PieChart) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
              <CardHeader className="pb-2">
                <h3 className="text-lg font-semibold leading-none">Prihodek po obdobjih</h3>
              </CardHeader>
              <CardContent>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="bucket" className="text-xs" tick={{ fontSize: 12 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} €`} />
                      <Tooltip formatter={(value) => [`${formatEUR(Number(value ?? 0))}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold leading-none">
                  <UtensilsCrossed className="h-4 w-4" aria-hidden="true" /> Po kategorijah
                </h3>
              </CardHeader>
              <CardContent>
                {categoryChart.length > 0 ? (
                  <div className="h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryChart} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                          {categoryChart.map((_: unknown, index: number) => (
                            <Cell key={`cat-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${formatEUR(Number(value ?? 0))}`, 'Prihodek']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {categoryChart.map((c) => (
                        <li key={c.name} className="flex items-center justify-between gap-2">
                          <span className="truncate" title={c.name}>{c.name}</span>
                          <span className="tabular-nums">{formatEUR(c.revenue)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Ni podatkov</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Plačilna mešanica + tipi naročil */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold leading-none">
                  <CreditCard className="h-4 w-4" aria-hidden="true" /> Plačilna mešanica
                </h3>
              </CardHeader>
              <CardContent>
                {paymentChart.length > 0 ? (
                  <div className="h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentChart} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={70}>
                          {paymentChart.map((_: unknown, index: number) => (
                            <Cell key={`pay-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${formatEUR(Number(value ?? 0))}`, 'Znesek']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {paymentChart.map((p) => (
                        <li key={p.name} className="flex items-center justify-between gap-2">
                          <span className="truncate" title={p.name}>{p.name}</span>
                          <span className="tabular-nums">{formatEUR(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Ni podatkov</div>
                )}
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <h3 className="text-lg font-semibold leading-none">Tipi naročil</h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(data?.orderTypeMix ?? []).map((t) => (
                    <li key={t.type} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                      <span className="truncate text-sm font-medium" title={ORDER_TYPE_LABELS[t.type] ?? t.type}>
                        {ORDER_TYPE_LABELS[t.type] ?? t.type}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {t.orders} naročil · {formatEUR(t.revenue)}
                      </span>
                    </li>
                  ))}
                  {(data?.orderTypeMix ?? []).length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">Ni podatkov</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Obseg po urah (24-urni vektor — CSS mini stolpci) */}
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold leading-none">
                <Clock className="h-4 w-4" aria-hidden="true" /> Obseg po urah (0–23)
              </h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {hourly.map((h) => {
                  const pct = hourlyMax > 0 && h.revenue > 0 ? Math.max(6, Math.round((h.revenue / hourlyMax) * 100)) : 0
                  return (
                    <div key={h.hour} data-testid="analytics-hourly-cell" data-hour={h.hour} className="min-w-0 rounded-md border p-1.5 text-center">
                      <p className="truncate text-[10px] text-muted-foreground tabular-nums">{h.label}</p>
                      <div className="flex h-12 items-end justify-center" aria-hidden="true">
                        <div className="w-4 rounded-t bg-amber-500/80" style={{ height: `${pct}%` }} />
                      </div>
                      <p className="truncate text-[10px] font-medium tabular-nums" title={formatEUR(h.revenue)}>{formatNumberSl(h.revenue, 0)} €</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top artikli + zaposleni */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold leading-none">
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Najboljši artikli
                </h3>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {(data?.topItems ?? []).map((item, index) => (
                    <li key={item.menuItemId} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">{index + 1}.</span>
                        <span className="truncate text-sm font-medium" title={item.name}>{item.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        ×{item.quantity} · {formatEUR(item.revenue)}
                      </span>
                    </li>
                  ))}
                  {(data?.topItems ?? []).length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">Ni podatkov</li>
                  )}
                </ol>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold leading-none">
                  <Users className="h-4 w-4" aria-hidden="true" /> Učinkovitost zaposlenih
                </h3>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="pb-2 font-medium">Ime</th>
                        <th scope="col" className="pb-2 text-right font-medium">Naročila</th>
                        <th scope="col" className="pb-2 text-right font-medium">Prihodek</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.staffPerformance ?? []).map((s) => (
                        <tr key={s.employeeId} className="border-b last:border-0">
                          <td className="max-w-40 truncate py-2" title={s.name || '(neimenovan)'}>
                            {s.name === '' ? '(neimenovan)' : s.name}
                          </td>
                          <td className="py-2 text-right tabular-nums">{s.orders}</td>
                          <td className="py-2 text-right tabular-nums">{formatEUR(s.revenue)}</td>
                        </tr>
                      ))}
                      {(data?.staffPerformance ?? []).length === 0 && (
                        <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Ni podatkov</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
})
