'use client'

// ============================================
// DANES COCKPIT — P0-01 (epic #144, R175)
// ============================================
//
// Operativni kokpit (landing za like z view_reports — page.tsx preusmeri
// privzeti 'orders' na 'danes' ob prvem vstopu za admin/manager/view_reports).
//
// Odgovarja na 9 vprašanj iz P0-01 — KOMPOZICIJA OBSTOJEČIH ENDPOINTOV
// (brez nove API površine, brez izmišljenih metrik):
//   1. Kaj se zdaj dogaja?      → /api/kitchen        (stats.totalActive)
//   2. Kaj zahteva pozornost?   → /api/operational-alerts (critical/warning)
//   3. Kaj je prodano?          → /api/dashboard      (todayRevenue/totalOrders)
//   4. Kaj čaka v kuhinji?      → /api/kitchen        (stats.totalItemsPending)
//   5. Kaj se dogaja na mizah?  → /api/dashboard      (activeTables/totalTables)
//   6. Smena/blagajna?          → /api/cash-register  (activeShift/liveStats)
//   7. Rezervacije?             → /api/reservations?upcoming=true
//   8. Zaloge/razpoložljivost?  → /api/inventory/menu-stock (sold-out/low)
//   9. Okvare/offline?          → /api/outbox (failed/dead_letter) + fursStatus
//
// Prioritete (P0-01): ① aktivno stanje (KPI vrstica) → ② izjeme/akcije
// (deep-linki v module prek setActiveModule) → ③ pregled (rezervacije,
// zaloge, sistem). NI "giant dashboard" — brez grafov, brez WoW/heatmap
// (to ostane v dashboard modulu).
//
// Poll kanon: alerts/kitchen 30s (GlobalNotifications/KDS prevedent),
// ostalo 120s — kokpit je pregledni, ne procesni zaslon.
// ============================================

import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  Clock,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/pos/StatsCard'
import { usePOSStore } from '@/lib/store/store'
import { useI18n } from '@/hooks/useI18n'
import { queryKeys } from '@/lib/query-keys'
import { authFetch } from '@/components/pos/PinLogin'

// — Minimalne oblike odgovorov (pick polj, ki jih kokpit konzumira) —
interface KitchenResp {
  stats: {
    totalActive: number
    pendingOrders: number
    inProgressOrders: number
    readyOrdersCount: number
    totalItemsPending: number
    totalItemsPreparing: number
    totalItemsReady: number
    avgWaitTime: number
    criticalOrders: number
  }
}
interface DashboardResp {
  todayRevenue: number
  totalOrders: number
  avgOrderValue: number
  paidOrderCount: number
  activeTables: number
  totalTables: number
  fursStatus?: { todayVerified: number; todayUnverified: number }
}
interface CashResp {
  activeShift: { openedAt: string; startingCash: number } | null
  liveStats: {
    totalSales: number
    totalOrders: number
    cashSales: number
    expectedCash: number
  } | null
}
interface ReservationRow {
  id: string
  customerName: string
  dateTime: string
  partySize: number
  status: string
}
interface ReservationsResp {
  reservations: ReservationRow[]
  summary: { total: number; confirmed: number; seated: number; totalGuests: number }
}
interface AlertItem {
  type: string
  severity: string
  message: string
}
interface AlertsResp {
  summary: { critical: number; warning: number; info: number }
  alerts: AlertItem[]
}
interface StockMapEntry {
  status?: string
  available?: number
}
type StockResp = Record<string, StockMapEntry>
interface OutboxResp {
  stats: { pending: number; processing: number; sent: number; failed: number; dead_letter: number }
}

/** Kanon fetch (Dashboard.tsx): authFetch vrne Response — res.json() cast Promise<T> */
async function fetchJson<T>(url: string): Promise<T> {
  const res = await authFetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

const EUR = (n: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(n) ? n : 0)

/** Deep-link mapping izjeme → modul (setActiveModule kanon: briefing/Dashboard) */
function alertTargetModule(type: string): string {
  if (type.startsWith('delayed') || type.includes('kot')) return 'kitchen'
  if (type.includes('bill') || type.includes('table')) return 'tables'
  if (type.includes('stock')) return 'inventory'
  if (type.includes('receipt') || type.includes('furs')) return 'cash-register'
  if (type.includes('shift')) return 'shifts'
  if (type.includes('cancellation')) return 'reports'
  return 'dashboard'
}

function formatClock(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(locale === 'en' ? 'en-GB' : locale, { hour: '2-digit', minute: '2-digit' })
}

export const DanesCockpit = memo(function DanesCockpit() {
  const { t, locale } = useI18n()
  const setActiveModule = usePOSStore((s) => s.setActiveModule)

  const alerts = useQuery({
    queryKey: ['cockpit', 'operational-alerts'],
    queryFn: () => fetchJson<AlertsResp>('/api/operational-alerts'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const kitchen = useQuery({
    queryKey: queryKeys.kitchen.all,
    queryFn: () => fetchJson<KitchenResp>('/api/kitchen'),
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
  const dash = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: () => fetchJson<DashboardResp>('/api/dashboard'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const cash = useQuery({
    queryKey: queryKeys.cashRegister.all,
    queryFn: () => fetchJson<CashResp>('/api/cash-register'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const reservations = useQuery({
    queryKey: [...queryKeys.reservations.all, 'upcoming'],
    queryFn: () => fetchJson<ReservationsResp>('/api/reservations?upcoming=true'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const menuStock = useQuery({
    queryKey: ['cockpit', 'menu-stock'],
    queryFn: () => fetchJson<StockResp>('/api/inventory/menu-stock'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const outbox = useQuery({
    queryKey: ['cockpit', 'outbox'],
    queryFn: () => fetchJson<OutboxResp>('/api/outbox?status=failed'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(locale === 'en' ? 'en-GB' : locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [locale],
  )

  const stockCounts = useMemo(() => {
    const map = menuStock.data ?? {}
    let soldOut = 0
    let low = 0
    for (const v of Object.values(map)) {
      if (v?.status === 'out') soldOut += 1
      else if (v?.status === 'low') low += 1
    }
    return { soldOut, low }
  }, [menuStock.data])

  const attention = useMemo(() => {
    const all = alerts.data?.alerts ?? []
    return all.filter((a) => a.severity === 'critical' || a.severity === 'warning')
  }, [alerts.data])

  const allCoreErrored = alerts.isError && kitchen.isError && dash.isError && cash.isError

  if (allCoreErrored) {
    return (
      <div className="flex h-full items-center justify-center p-6" role="alert">
        <div className="text-center text-sm text-muted-foreground">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" aria-hidden />
          {t('cockpit.loadError')}
        </div>
      </div>
    )
  }

  const ks = kitchen.data?.stats
  const ds = dash.data
  const cs = cash.data
  const upcoming = reservations.data?.reservations ?? []

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
        {/* ── Glava: Danes + datum + smena ── */}
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t('nav.danes')}</h1>
            <p className="text-sm capitalize text-muted-foreground">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {cs?.activeShift ? (
              <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Wallet className="h-3 w-3" aria-hidden />
                {t('cockpit.shiftOpen')}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {t('cockpit.noShift')}
              </Badge>
            )}
          </div>
        </header>

        {/* ── ① AKTIVNO STANJE — 9 vprašanj: 1/3/4/5/6 ── */}
        <section aria-label={t('cockpit.overview')}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <button type="button" className="text-left" onClick={() => setActiveModule('reports')}>
              <StatsCard title={t('cockpit.soldToday')} value={ds ? EUR(ds.todayRevenue) : '…'} subtitle={ds ? `${ds.paidOrderCount} ×` : undefined} icon={TrendingUp} />
            </button>
            <button type="button" className="text-left" onClick={() => setActiveModule('kitchen')}>
              <StatsCard title={t('cockpit.activeOrders')} value={ks ? ks.totalActive : '…'} subtitle={ks ? `${ks.pendingOrders} / ${ks.inProgressOrders} / ${ks.readyOrdersCount}` : undefined} icon={ShoppingCart} />
            </button>
            <button type="button" className="text-left" onClick={() => setActiveModule('kitchen')}>
              <StatsCard title={t('cockpit.kitchenWaiting')} value={ks ? ks.totalItemsPending : '…'} subtitle={ks && ks.criticalOrders > 0 ? `${ks.criticalOrders} ${t('cockpit.criticalKitchen')}` : ks ? `${t('cockpit.avgWait')} ${ks.avgWaitTime} min` : undefined} icon={ChefHat} />
            </button>
            <button type="button" className="text-left" onClick={() => setActiveModule('tables')}>
              <StatsCard title={t('cockpit.tablesBusy')} value={ds ? `${ds.activeTables}/${ds.totalTables}` : '…'} icon={Users} />
            </button>
          </div>
        </section>

        {/* ── ② IZJEME / AKCIJE — 9 vprašanj: 2 (+9 strežniško) ── */}
        <section aria-label={t('cockpit.attention')}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                {t('cockpit.attention')}
                {alerts.data && alerts.data.summary.critical > 0 && (
                  <Badge className="bg-red-600 text-white">{alerts.data.summary.critical} × {t('cockpit.alertsCritical')}</Badge>
                )}
                {alerts.data && alerts.data.summary.warning > 0 && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">{alerts.data.summary.warning} × {t('cockpit.alertsWarning')}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {alerts.isLoading ? (
                <div className="space-y-2" data-testid="danes-attention-loading">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ) : attention.length === 0 ? (
                <div className="flex items-center gap-2 py-1 text-sm text-emerald-700 dark:text-emerald-300" data-testid="danes-attention-empty">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t('cockpit.attentionNone')}
                </div>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto" data-testid="danes-attention-list">
                  {attention.slice(0, 8).map((a, i) => (
                    <li key={`${a.type}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setActiveModule(alertTargetModule(a.type))}
                        className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge
                            variant={a.severity === 'critical' ? 'destructive' : 'outline'}
                            className={a.severity === 'critical' ? '' : 'border-amber-300 text-amber-700 dark:text-amber-300'}
                          >
                            {a.severity === 'critical' ? t('cockpit.alertsCritical') : t('cockpit.alertsWarning')}
                          </Badge>
                          <span className="truncate">{a.message}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </button>
                    </li>
                  ))}
                  {attention.length > 8 && (
                    <li className="px-2 pt-1 text-xs text-muted-foreground">
                      {t('cockpit.more', { n: attention.length - 8 })}
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── ③ PREGLED — 9 vprašanj: 6/7/8/9 ── */}
        <section aria-label={t('cockpit.overview')} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Smena & blagajna (Q6) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
                {t('cockpit.shiftSales')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {cash.isLoading ? (
                <Skeleton className="h-10 w-2/3" />
              ) : cs?.activeShift && cs.liveStats ? (
                <button type="button" className="w-full text-left" onClick={() => setActiveModule('cash-register')}>
                  <p className="text-2xl font-bold">{EUR(cs.liveStats.totalSales)}</p>
                  <p className="text-xs text-muted-foreground">
                    {cs.liveStats.totalOrders} × · {t('cockpit.expectedCash')} {EUR(cs.liveStats.expectedCash)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-primary">{t('cockpit.viewAll')} →</p>
                </button>
              ) : (
                <div className="py-1">
                  <p className="text-sm text-muted-foreground">{t('cockpit.noShift')}</p>
                  <p className="mt-1 text-xs font-medium text-primary">
                    <button type="button" onClick={() => setActiveModule('cash-register')}>{t('cockpit.viewAll')} →</button>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rezervacije (Q7) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
                {t('cockpit.reservations')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {reservations.isLoading ? (
                <Skeleton className="h-10 w-2/3" />
              ) : upcoming.length === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">{t('cockpit.noReservations')}</p>
              ) : (
                <div className="space-y-1" data-testid="danes-reservations">
                  <p className="text-sm text-muted-foreground">
                    {reservations.data?.summary.total} × {t('cockpit.reservationsUpcoming')} · {reservations.data?.summary.totalGuests} {t('cockpit.reservationGuests')}
                  </p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                    {upcoming.slice(0, 3).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{r.customerName}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {r.dateTime ? formatClock(r.dateTime, locale) : ''} · {r.partySize}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="pt-1 text-xs font-medium text-primary">
                    <button type="button" onClick={() => setActiveModule('reservations')}>{t('cockpit.viewAll')} →</button>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Zaloge (Q8) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
                {t('cockpit.stock')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {menuStock.isLoading ? (
                <Skeleton className="h-10 w-2/3" />
              ) : stockCounts.soldOut + stockCounts.low === 0 ? (
                <div className="flex items-center gap-2 py-1 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t('cockpit.stockOk')}
                </div>
              ) : (
                <button type="button" className="w-full text-left" onClick={() => setActiveModule('inventory')}>
                  <p className="text-2xl font-bold">{stockCounts.soldOut}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('cockpit.soldOut')}{stockCounts.low > 0 ? ` · ${stockCounts.low} ${t('cockpit.stockLow')}` : ''}
                  </p>
                  <p className="mt-1 text-xs font-medium text-primary">{t('cockpit.viewAll')} →</p>
                </button>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Sistem (Q9) — kompakt vrstica ── */}
        <section aria-label={t('cockpit.system')} data-testid="danes-system">
          {outbox.data && (outbox.data.stats.failed > 0 || outbox.data.stats.dead_letter > 0) ? (
            <button
              type="button"
              onClick={() => setActiveModule('outbox')}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4" aria-hidden />
                {outbox.data.stats.failed + outbox.data.stats.dead_letter} × {t('cockpit.outboxFailed')}
                {ds?.fursStatus && ds.fursStatus.todayUnverified > 0 && ` · ${ds.fursStatus.todayUnverified} ${t('cockpit.fursUnverified')}`}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              {t('cockpit.systemOk')}
              {ds?.fursStatus && ds.fursStatus.todayUnverified > 0 && ` · ${ds.fursStatus.todayUnverified} ${t('cockpit.fursUnverified')}`}
            </div>
          )}
        </section>
      </div>
    </div>
  )
})
