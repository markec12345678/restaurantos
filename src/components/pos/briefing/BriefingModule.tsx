'use client'
// ============================================
// R141-c (epic #115 P2-28) — Dnevni pregled (manager briefing)
// POS-shell modul 'briefing' (registry + navItems 'Analitika' → prvi element).
// Struktura po Dashboard kanonu: KPI vrstica (StatsCard) + sekcije v
// responzivni mreži; Skeleton loading; en error alert + 'Poskusi znova'.
// Vsi oznaki hardcoded sl (kanon modulov) — samo nav.briefing je i18n.
// ============================================

import { memo } from 'react'
import { RefreshCw, Sunrise, DollarSign, Users, CalendarDays, MessageSquare } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/pos/StatsCard'
import { formatEUR } from '@/lib/safe-format'
import { ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import { cn } from '@/lib/utils'
import { useBriefing } from './useBriefing'
import { formatBriefingDateLabel, formatPctChange, summarizeCovers } from './constants'
import { ReservationsSection, TeamSection, InventorySection, PurchasingSection } from './sections'
import { YesterdaySection, IssuesSection, KdsSection } from './sections-review'

export const BriefingModule = memo(function BriefingModule() {
  const {
    data, isLoading, isError, isFetching, refetch, date,
  } = useBriefing()

  // ─── Loading: Skeleton po Dashboard precedentu ───
  if (isLoading) {
    return (
      <div className="h-full space-y-6 overflow-y-auto p-4 md:p-6 custom-scrollbar" aria-busy="true" aria-label="Dnevni pregled se nalaga">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-28" />))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-64" />))}
        </div>
      </div>
    )
  }

  // ─── Error: EN alert + retry (StockTab/ReorderCenter kanon, sl besedilo) ───
  if (isError) {
    return (
      <div className="h-full space-y-4 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <Alert variant="destructive">
          <AlertTitle>Napaka pri nalaganju dnevnega pregleda</AlertTitle>
          <AlertDescription>
            Pregleda dneva ni bilo mogoče naložiti. Podatki ostanejo nespremenjeni — poskusite znova.
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Poskusi znova
        </Button>
      </div>
    )
  }

  const covers = summarizeCovers(data?.reservations?.summary)
  const pct = formatPctChange(data?.yesterday?.sales?.revenueChangePct ?? null)
  const feedbackUnresolved = (data?.issues?.unresolvedFeedback?.new ?? 0) + (data?.issues?.unresolvedFeedback?.inReview ?? 0)
  // 'Osveženo HH:mm' iz generatedAt v Ljubljani (R43 kanon — ISO je UTC)
  const generatedTime = data?.generatedAt ? ljubljanaDateTimeParts(data.generatedAt).time : null

  return (
    <div className="h-full space-y-6 overflow-y-auto p-4 md:p-6 custom-scrollbar">
      {/* ─── Glava ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Sunrise className="h-6 w-6 text-amber-500" aria-hidden="true" />
            Dnevni pregled
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatBriefingDateLabel(date)}
            {generatedTime && (
              <> · <span className="tabular-nums">Osveženo {generatedTime}</span></>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Osveži dnevni pregled"
        >
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
          Osveži
        </Button>
      </div>

      {/* ─── KPI vrstica ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Včerajšnji prihodek"
          value={formatEUR(data?.yesterday?.sales?.revenue ?? 0)}
          subtitle={pct.label === '—' ? 'Ni primerjave' : pct.label}
          icon={DollarSign}
          trend={pct.trend}
        />
        <StatsCard
          title="Pričakovani gostje"
          value={covers.expectedGuests}
          subtitle={covers.seated > 0 ? `Na mizi: ${covers.seated}` : undefined}
          icon={Users}
        />
        <StatsCard
          title="Rezervacije danes"
          value={covers.reservationsToday}
          subtitle={covers.cancelled > 0 ? `Odpovedane: ${covers.cancelled}` : undefined}
          icon={CalendarDays}
        />
        <StatsCard
          title="Nerešena mnenja"
          value={feedbackUnresolved}
          subtitle={`Nova: ${data?.issues?.unresolvedFeedback?.new ?? 0} · V obdelavi: ${data?.issues?.unresolvedFeedback?.inReview ?? 0}`}
          icon={MessageSquare}
        />
      </div>

      {/* ─── Sekcije ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReservationsSection section={data?.reservations} />
        <TeamSection section={data?.staff} />
        <InventorySection section={data?.inventory} />
        <PurchasingSection section={data?.purchasing} />
        <YesterdaySection section={data?.yesterday} />
        <IssuesSection section={data?.issues} />
        <KdsSection kds={data?.kds} />
      </div>
    </div>
  )
})
