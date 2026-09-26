'use client'
// ============================================
// R144-c (epic #115 #31) — Sekcija 'Odpustna obveznost' (liability)
// Vgrajena v obstoječi GiftCardManager (POD registrom kartic).
// Podatki: EN agregat GET /api/gift-cards/liability (kontrakt R144-b) prek
// useGiftCardLiability — odgovor vsebuje SAMO agregate (saldi/števci +
// imena in kode lokacij), NIKOLI cardNumber/ownerName (PII kanon; polna
// cardNumber je spendable secret, v UI-modulu je vidna izključno v
// obstoječi tabeli kartic po designu — ta sekcija je računovodski pogled).
//
// Vsebina (hardcoded sl — kanon modula):
//   1. KPI vrstica: odpustna obveznost (Σ active+depleted saldov) /
//      aktivne kartice / poteče v 30 dneh (dnevi IZ enotnega vira
//      GIFT_CARD_EXPIRING_SOON_DAYS, nikoli hardcode) / izčrpane kartice,
//   2. razčlenba po statusih — iteracija po GIFT_CARD_LIABILITY_STATUSES
//      (BUG-04 enoten vir; oznake/pika iz GIFT_CARD_LIABILITY_STATUS_META),
//   3. po lokacijah: vrstica per lokacijo (ime + koda v muted, outstanding
//      bold desno, števci per status); null locationId → 'Brez lokacije';
//      ScrollList max-h-96 + custom-scrollbar (hišni kanon),
//   4. iskreno prazno stanje ('Ni aktivnih darilnih kartic') namesto
//      KPI/razčlenbe, ko ni aktivnih/izčrpanih kartic in so vsi saldi 0.
//
// Opombe: skeleton po stilu modula (aria-busy + aria-label), error = EN
// destructive alert + 'Poskusi znova' (refetch), brez vodoravnega preloma
// pri 390 px (min-w-0/truncate povsod), denar prek formatCurrency
// (formatEUR — determinističen sl-SI zapis '1.250,00 €'). Osveževanje:
// ročni 'Osveži' + refetchInterval 120 s; mutacije kartic invalidirajo
// ['gift-cards'] → hierarhično tudi ['gift-cards','liability'].
// ============================================

import { memo } from 'react'
import { CheckCircle2, CreditCard, Hourglass, RefreshCw, Scale, Wallet } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyText, ScrollList } from '@/components/pos/briefing/section-card'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  formatDateTimeSI,
  GIFT_CARD_LIABILITY_STATUSES,
  GIFT_CARD_LIABILITY_STATUS_META,
  giftCardExpiringSoonLabel,
  liabilityStatusCount,
} from './constants'
import {
  GIFT_CARD_LIABILITY_ERROR_MESSAGE,
  useGiftCardLiability,
  type LiabilityByLocationRow,
  type LiabilityTotals,
} from './useGiftCardLiability'

// ─── KPI ploščica (kompaktna, design jezik GiftCardSummaryCards/R143 KpiTile) ───

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
      className="relative min-w-0 overflow-hidden rounded-lg border p-3 transition-all duration-300 animate-fade-in-up hover:shadow-md"
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

// ─── Ploščica statusa (pika + oznaka + števec + definicijski hint) ───

function StatusTile({ status, count }: { status: (typeof GIFT_CARD_LIABILITY_STATUSES)[number]; count: number }) {
  const meta = GIFT_CARD_LIABILITY_STATUS_META[status]
  return (
    <div className="min-w-0 rounded-lg border p-3" title={meta.hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dotClass)} aria-hidden="true" />
          <span className={cn('truncate text-xs font-semibold', meta.textClass)}>{meta.label}</span>
        </span>
        <span className={cn('text-lg font-bold tabular-nums leading-none', meta.textClass)}>{count}</span>
      </div>
      <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{meta.hint}</p>
    </div>
  )
}

// ─── Vrstica po lokaciji (ime + koda muted · outstanding bold desno) ───

function LocationRow({ row }: { row: LiabilityByLocationRow }) {
  const displayName = row.locationId === null ? 'Brez lokacije' : row.locationName
  return (
    <li className="flex items-center gap-3 rounded-md border p-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-medium" title={displayName}>{displayName}</span>
          {row.locationCode && (
            <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
              ({row.locationCode})
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground tabular-nums">
          Aktivne: {row.activeCards} · Izčrpane: {row.depletedCards} · Suspendirane: {row.suspendedCards} · Poteče: {row.expiredCards}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums">{formatCurrency(row.outstandingBalance)}</p>
      </div>
    </li>
  )
}

// ─── Skeleton (GiftCardLoadingSkeleton / LifecycleSkeleton stil) ───

function LiabilitySkeleton() {
  return (
    <Card aria-busy="true" aria-label="Odpustna obveznost se nalaga">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-56" />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={`kpi-${i}`} className="h-16" />))}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={`status-${i}`} className="h-16" />))}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (<Skeleton key={`loc-${i}`} className="h-12" />))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Glavna sekcija ───

export const GiftCardLiabilitySection = memo(function GiftCardLiabilitySection() {
  const { data, isLoading, isError, isFetching, refetch } = useGiftCardLiability()

  // ── Loading: skeleton po stilu modula ──
  if (isLoading) return <LiabilitySkeleton />

  // ── Error: EN destructive alert + retry prek refetch ──
  if (isError) {
    return (
      <Card>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Napaka pri nalaganju odpustne obveznosti</AlertTitle>
            <AlertDescription>
              {GIFT_CARD_LIABILITY_ERROR_MESSAGE} Podatki ostanejo nespremenjeni — poskusite znova.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Poskusi znova
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totals: LiabilityTotals = data?.totals ?? {
    outstandingBalance: 0,
    activeCards: 0,
    depletedCards: 0,
    suspendedCards: 0,
    expiredCards: 0,
    expiringSoon30d: { cards: 0, balance: 0 },
  }
  const byLocation = data?.byLocation ?? []

  // Iskreno prazno stanje (kontrakt R144-c): ni aktivnih/izčrpanih kartic IN
  // ni nobenega nespotrošenega salda po lokacijah → sekcija pokaže samo sporočilo.
  const isEmpty =
    totals.activeCards === 0 &&
    totals.depletedCards === 0 &&
    byLocation.every((row) => row.outstandingBalance === 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold leading-none">
              <Scale className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Odpustna obveznost
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Nespotrošeni saldi darilnih kartic v obsegu dostopa — denar, ki ga gostje še lahko potrošijo
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.generatedAt && (
              <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                Posodobljeno: {formatDateTimeSI(data.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Osveži odpustno obveznost"
            >
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
              Osveži
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {isEmpty ? (
          <EmptyText>Ni aktivnih darilnih kartic</EmptyText>
        ) : (
          <>
            {/* 1. KPI vrstica (2×2 mobilni → 4 stolpci desktop) */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile
                label="Odpustna obveznost"
                value={formatCurrency(totals.outstandingBalance)}
                subtitle="Saldo aktivnih + izčrpanih kartic"
                title="Σ saldov aktivnih in izčrpanih kartic — suspendirane in potečele so vidne kot števci (zamrznjen/odpisan saldo)"
                icon={Wallet}
                accent="bg-amber-500"
                tile="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                valueClass="text-amber-700 dark:text-amber-400"
                delay="0ms"
              />
              <KpiTile
                label="Aktivne kartice"
                value={String(totals.activeCards)}
                subtitle="V obsegu poročila"
                icon={CheckCircle2}
                accent="bg-emerald-500"
                tile="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                valueClass="text-emerald-700 dark:text-emerald-400"
                delay="40ms"
              />
              <KpiTile
                label={giftCardExpiringSoonLabel()}
                value={formatCurrency(totals.expiringSoon30d.balance)}
                subtitle={`Kartic: ${totals.expiringSoon30d.cards}`}
                title="Aktivne kartice z datumom veljavnosti znotraj okna — kandidati za odpis"
                icon={Hourglass}
                accent="bg-red-500"
                tile="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                valueClass="text-red-700 dark:text-red-400"
                delay="80ms"
              />
              <KpiTile
                label="Izčrpane kartice"
                value={String(totals.depletedCards)}
                subtitle="Preostali saldo 0 €"
                icon={CreditCard}
                accent="bg-zinc-500"
                tile="bg-zinc-100 dark:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300"
                valueClass=""
                delay="120ms"
              />
            </div>

            {/* 2. Razčlenba po statusih (iteracija po GIFT_CARD_LIABILITY_STATUSES — BUG-04) */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Po statusih</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {GIFT_CARD_LIABILITY_STATUSES.map((status) => (
                  <StatusTile key={status} status={status} count={liabilityStatusCount(status, totals)} />
                ))}
              </div>
            </div>

            {/* 3. Po lokacijah — ime + koda + števci, outstanding bold desno (drsen seznam) */}
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Po lokacijah</p>
              {byLocation.length === 0 ? (
                <EmptyText>Ni kartic po lokacijah</EmptyText>
              ) : (
                <ScrollList ariaLabel="Odpustna obveznost po lokacijah">
                  {byLocation.map((row) => (
                    <LocationRow key={row.locationId ?? '__null__'} row={row} />
                  ))}
                </ScrollList>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
})
