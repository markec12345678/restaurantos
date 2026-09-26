'use client'
// ============================================
// R143-c (epic #115 #30) — Sekcija 'Življenjski cikel'
// Vgrajena v obstoječi LoyaltyManager (pod porazdelitvijo nivojev).
// Podatki: EN agregat GET /api/loyalty/lifecycle (kontrakt R143-b) prek
// useLoyaltyLifecycle — prago zvestobe BREZ PII (topAccounts whitelist:
// ime/nivo/točke, nikoli telefon/e-pošta).
//
// Vsebina (hardcoded sl — kanon modula):
//   1. KPI vrstica: aktivni / nedejavni >60 dni / točke, ki potečejo v 30
//      dneh / skupaj računov (vsota byTier),
//   2. segmenti življenjskega cikla — iteracija po LIFECYCLE_BUCKETS
//      (BUG-04 enoten vir; dnevi v podnaslovih IZ konstant, ne hardcode),
//   3. mini-porazdelitev nivojev (tierConfig oznake + gradient vrstice),
//   4. top 5 računov z nivo značko (tierBadgeStyles) + točkami + vrstico
//      napredka ('do naslednje stopnje: N točk' ko tierProgress < 100 %),
//   5. iskreno prazno stanje ('Ni aktivnih računov').
//
// DEGRADED FLAGI: strežnik jih IZRECNO ne izpostavlja (R143-b — sekcije z
// nevtralnimi fallbacki, log strukturiran, ne v odgovoru) → UI ne izmišljuje
// ključev; padla sekcija se pokaže kot nevtralna vrednost (0/prazen seznam).
//
// Opombe: max-h-96 + custom-scrollbar za top seznam (ScrollList kanon),
// brez vodoravnega preloma pri 390 px (min-w-0/truncate povsod), skeleton
// po LoyaltyLoadingSkeleton stilu, error = EN destructive alert + 'Poskusi
// znova' (refetch). Odpiranje zgodovine računa je OPCIJSKO globoko
// povezovanje (resolveHistoryAccount + onOpenHistory) — LoyaltyManager jo
// poveže na obstoječi LoyaltyHistoryDialog; če račun ni v naloženem seznamu,
// gumb NE nastane (nikoli mrtvih klikov).
// ============================================

import { memo } from 'react'
import { Crown, History, Hourglass, RefreshCw, UserCheck, UserMinus, Users } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyText, ScrollList } from '@/components/pos/briefing/section-card'
import { cn } from '@/lib/utils'
import { TIER_THRESHOLDS } from '@/lib/loyalty-tiers'
import {
  LIFECYCLE_ACCOUNT_CAP,
  LIFECYCLE_ACTIVE_MAX_DAYS,
  LIFECYCLE_BUCKETS,
  LIFECYCLE_EXPIRY_WINDOW_DAYS,
  type LifecycleBucket,
} from '@/lib/loyalty/lifecycle-constants'
import {
  formatDateSI,
  formatPoints,
  LIFECYCLE_BUCKET_META,
  lifecycleBucketHint,
  tierBadge,
  tierBarGradients,
  tierConfig,
  type LoyaltyAccount,
} from './constants'
import {
  LIFECYCLE_ERROR_MESSAGE,
  useLoyaltyLifecycle,
  type LifecycleTopAccount,
} from './useLoyaltyLifecycle'

// --- Globoko povezovanje zgodovine (opcijsko — glej header) ---
interface LifecycleSectionProps {
  /** Poišči poln račun iz obstoječega seznama (za LoyaltyHistoryDialog). */
  resolveHistoryAccount?: (id: string) => LoyaltyAccount | undefined
  /** Obstoječi openHistory handler iz useLoyaltyState. */
  onOpenHistory?: (account: LoyaltyAccount) => void
}

// ─── KPI ploščica (kompaktna, LoyaltySummaryCards design jezik) ───

interface KpiTileProps {
  label: string
  value: string
  subtitle?: string
  title?: string
  icon: React.ElementType
  accent: string
  tile: string
  valueClass: string
  delay: string
}

function KpiTile({ label, value, subtitle, title, icon: Icon, accent, tile, valueClass, delay }: KpiTileProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border p-3 transition-all duration-300 animate-fade-in-up hover:shadow-md"
      style={{ animationDelay: delay }}
      title={title}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1', accent)} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tile)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={cn('text-xl font-bold tabular-nums leading-none', valueClass)}>{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={label}>{label}</p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground tabular-nums" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Ploščica segmenta (pika + oznaka + števec + dnevni hint IZ konstant) ───

function BucketTile({ bucket, count }: { bucket: LifecycleBucket; count: number }) {
  const meta = LIFECYCLE_BUCKET_META[bucket]
  const hint = lifecycleBucketHint(bucket)
  return (
    <div className="rounded-lg border p-3" title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dotClass)} aria-hidden="true" />
          <span className={cn('truncate text-xs font-semibold', meta.textClass)}>{meta.label}</span>
        </span>
        <span className={cn('text-lg font-bold tabular-nums leading-none', meta.textClass)}>{count}</span>
      </div>
      <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}

// ─── Vrstica top računa (IME + značka nivoja + točke — NIKOLI PII) ───

function TopAccountRow({
  row,
  resolveHistoryAccount,
  onOpenHistory,
}: {
  row: LifecycleTopAccount
  resolveHistoryAccount?: (id: string) => LoyaltyAccount | undefined
  onOpenHistory?: (account: LoyaltyAccount) => void
}) {
  const badge = tierBadge(row.tier)
  const progress = row.tierProgress
  const gradient = tierBarGradients[progress.current] || tierBarGradients.bronze
  const historyTarget = resolveHistoryAccount?.(row.id)

  return (
    <li className="flex items-center gap-3 rounded-md border p-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{row.customerName}</span>
          <span className={cn('whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
            {badge.label}
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Napredek do naslednje stopnje: ${progress.progressPct} %`}
          title={
            progress.next
              ? `${progress.progressPct} % do stopnje ${tierConfig[progress.next]?.label ?? progress.next}`
              : 'Najvišji nivo dosežen'
          }
        >
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', gradient)}
            style={{ width: `${Math.max(0, Math.min(100, progress.progressPct))}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground tabular-nums">
          {progress.next && progress.pointsToNext != null
            ? `do naslednje stopnje: ${formatPoints(progress.pointsToNext)} točk`
            : 'Najvišji nivo dosežen'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums">{formatPoints(row.pointsBalance)}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">{formatPoints(row.lifetimePoints)} točk skupaj</p>
      </div>
      {onOpenHistory && historyTarget && (
        <button
          type="button"
          onClick={() => onOpenHistory(historyTarget)}
          aria-label={`Zgodovina transakcij: ${row.customerName}`}
          title="Zgodovina transakcij"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

// ─── Skeleton (LoyaltyLoadingSkeleton stil) ───

function LifecycleSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Življenjski cikel se nalaga">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-56" />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={`kpi-${i}`} className="h-16" />))}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={`seg-${i}`} className="h-16" />))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Glavna sekcija ───

export const LifecycleSection = memo(function LifecycleSection({
  resolveHistoryAccount,
  onOpenHistory,
}: LifecycleSectionProps) {
  const { data, isLoading, isError, isFetching, refetch } = useLoyaltyLifecycle()

  // ── Loading: skeleton po stilu modula ──
  if (isLoading) return <LifecycleSkeleton />

  // ── Error: EN destructive alert + retry prek refetch ──
  if (isError) {
    return (
      <Card>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Napaka pri nalaganju življenjskega cikla</AlertTitle>
            <AlertDescription>
              {LIFECYCLE_ERROR_MESSAGE} Podatki ostanejo nespremenjeni — poskusite znova.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Poskusi znova
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totals = data?.totals ?? { active: 0, inactive60d: 0 }
  const byTier = data?.byTier ?? { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  const buckets = data?.lifecycleBuckets ?? { new: 0, active: 0, at_risk: 0, churned: 0 }
  const expiring = data?.expiringSoon30d ?? { points: 0, accounts: 0, capped: false, scanned: 0 }
  const topAccounts = data?.topAccounts ?? []

  // Skupaj računov = vsota po nivojih (server byTier je avtoritativni vir).
  const totalAccounts = byTier.bronze + byTier.silver + byTier.gold + byTier.platinum

  // Iskreno prazno stanje (kontrakt R143-c): brez aktivnih računov IN brez top računov.
  const isEmpty = totals.active === 0 && topAccounts.length === 0

  const expiringSubtitle = cappedNote(expiring.accounts, expiring.capped)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold leading-none">
              <Crown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Življenjski cikel
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Segmenti po dneh od zadnje transakcije · ogroženi so okno za winback
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.generatedAt && (
              <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                Posodobljeno: {formatDateSI(data.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Osveži življenjski cikel"
            >
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
              Osveži
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {isEmpty ? (
          <EmptyText>Ni aktivnih računov</EmptyText>
        ) : (
          <>
            {/* 1. KPI vrstica (2×2 mobilni → 4 stolpci desktop) */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile
                label="Aktivni računi"
                value={String(totals.active)}
                subtitle="Vseh aktivnih v obsegu"
                icon={UserCheck}
                accent="bg-emerald-500"
                tile="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                valueClass="text-emerald-700 dark:text-emerald-400"
                delay="0ms"
              />
              <KpiTile
                label={`Nedejavni >${LIFECYCLE_ACTIVE_MAX_DAYS} dni`}
                value={String(totals.inactive60d)}
                subtitle={`Brez transakcije ≥ ${LIFECYCLE_ACTIVE_MAX_DAYS} dni`}
                icon={UserMinus}
                accent="bg-amber-500"
                tile="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                valueClass="text-amber-700 dark:text-amber-400"
                delay="40ms"
              />
              <KpiTile
                label="Točke, ki potečejo v 30 dneh"
                value={formatPoints(expiring.points)}
                subtitle={expiringSubtitle}
                title={`FIFO približek — točke, ki jih računi niso prislužili v zadnjih ${LIFECYCLE_EXPIRY_WINDOW_DAYS} dneh (okno 365 − 30 dni)`}
                icon={Hourglass}
                accent="bg-red-500"
                tile="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                valueClass="text-red-700 dark:text-red-400"
                delay="80ms"
              />
              <KpiTile
                label="Skupaj računov"
                value={String(totalAccounts)}
                subtitle="Na vseh štirih nivojih"
                icon={Users}
                accent="bg-violet-500"
                tile="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"
                valueClass=""
                delay="120ms"
              />
            </div>

            {/* 2. Segmenti življenjskega cikla (iteracija po LIFECYCLE_BUCKETS — BUG-04) */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Segmenti</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {LIFECYCLE_BUCKETS.map((bucket) => (
                  <BucketTile key={bucket} bucket={bucket} count={buckets[bucket] ?? 0} />
                ))}
              </div>
            </div>

            {/* 3 + 4. Nivoji in top računi (1 stolpec mobilni → 2 stolpca desktop) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Mini porazdelitev nivojev — oznake iz tierConfig, vrstni red TIER_THRESHOLDS */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Nivoji (delež od skupaj)</p>
                <div className="space-y-2.5">
                  {TIER_THRESHOLDS.map((t) => {
                    const cfg = tierConfig[t.tier] || tierConfig.bronze
                    const count = byTier[t.tier] ?? 0
                    const pct = totalAccounts > 0 ? Math.round((count / totalAccounts) * 100) : 0
                    const gradient = tierBarGradients[t.tier] || tierBarGradients.bronze
                    return (
                      <div key={t.tier} className="flex items-center gap-2" title={`Prag: ${formatPoints(t.minLifetime)} točk`}>
                        <span className={cn('w-20 shrink-0 truncate text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', gradient)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-7 shrink-0 text-right text-xs font-bold tabular-nums">{count}</span>
                        <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">{pct} %</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top 5 računov po stanju točk — whitelist brez PII */}
              <div className="min-w-0">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Top računi (po stanju točk)
                </p>
                {topAccounts.length === 0 ? (
                  <EmptyText>Ni podatka o top računih</EmptyText>
                ) : (
                  <ScrollList ariaLabel="Top računi po stanju točk">
                    {topAccounts.map((row) => (
                      <TopAccountRow
                        key={row.id}
                        row={row}
                        resolveHistoryAccount={resolveHistoryAccount}
                        onOpenHistory={onOpenHistory}
                      />
                    ))}
                  </ScrollList>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
})

// ─── Pomožniki ───

/** Podnaslov expiring KPI: št. računov + poštena opomba o omejitvi (cap). */
function cappedNote(accounts: number, capped: boolean): string {
  const base = `Računov: ${accounts}`
  return capped ? `${base} · omejitev ${LIFECYCLE_ACCOUNT_CAP} računov` : base
}
