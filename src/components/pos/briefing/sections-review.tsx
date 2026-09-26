'use client'
// ============================================
// R141-c (epic #115 P2-28) — sekcije dnevnega pregleda (promet & težave):
// Včeraj · Nerešeno · KDS (včeraj)
// Honest prazna stanja (nikoli ne izmišljujemo vzorca); odpadki prek
// wasteReasonLabel kanona; deep-linki na feedback / end-of-day / inventory.
// ============================================

import { AlertTriangle, History, Timer } from 'lucide-react'
import { formatEUR, formatNumberSl } from '@/lib/safe-format'
import { wasteReasonLabel } from '@/lib/waste-reasons'
import {
  DAILY_CLOSE_STATUS_BADGES,
  DAILY_CLOSE_STATUS_UNKNOWN,
  PCT_TREND_BADGES,
  Z_REPORT_STATUS_BADGES,
  Z_REPORT_STATUS_UNKNOWN,
  formatPctChange,
  formatSlDateShort,
} from './constants'
import type { IssuesSection, KdsSection, YesterdaySection } from './constants'
import { BadgeChip, DeepLinkButton, EmptyText, ScrollList, SectionCard } from './section-card'

export function YesterdaySection({ section }: { section: YesterdaySection | undefined }) {
  const sales = section?.sales
  const topItems = section?.topItems ?? []
  const waste = section?.waste
  const pct = formatPctChange(sales?.revenueChangePct ?? null)
  const zCfg = section?.zReportStatus
    ? (Z_REPORT_STATUS_BADGES[section.zReportStatus] ?? Z_REPORT_STATUS_UNKNOWN)
    : null
  const closeCfg = section?.dailyCloseStatus
    ? (DAILY_CLOSE_STATUS_BADGES[section.dailyCloseStatus] ?? DAILY_CLOSE_STATUS_UNKNOWN)
    : null
  const looksEmpty = !sales || (sales.revenue === 0 && sales.ordersCount === 0 && topItems.length === 0)

  return (
    <SectionCard icon={History} title="Včeraj">
      {looksEmpty ? (
        <EmptyText>Ni podatkov o prometu za včeraj.</EmptyText>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="flex items-center gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground">Prihodek:</span>
              <span className="font-semibold tabular-nums">{formatEUR(sales.revenue)}</span>
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[10px] tabular-nums ${PCT_TREND_BADGES[pct.trend]}`}
              >
                {pct.label}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Naročil: <span className="tabular-nums text-foreground">{sales.ordersCount}</span>
              {' · '}Povprečni račun: <span className="tabular-nums text-foreground">{formatEUR(sales.avgTicket)}</span>
              {' · '}Napitnine: <span className="tabular-nums text-foreground">{formatEUR(sales.tips)}</span>
            </p>
          </div>

          {topItems.length > 0 && (
            <ScrollList ariaLabel="Najbolj prodajani artikli včeraj">
              {topItems.map((item, i) => (
                <li key={`${item.name}-${i}`} className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">
                    <span className="mr-1.5 inline-block w-4 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                    {item.name}
                  </p>
                  <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatNumberSl(item.quantity, 0)}× · {formatEUR(item.revenue)}
                  </p>
                </li>
              ))}
            </ScrollList>
          )}

          {waste && (waste.totalCost > 0 || (waste.topReasons?.length ?? 0) > 0) && (
            <div>
              <p className="text-xs text-muted-foreground">
                Odpadki: <span className="tabular-nums text-foreground">{formatEUR(waste.totalCost)}</span>
              </p>
              {(waste.topReasons?.length ?? 0) > 0 && (
                <ul className="mt-1 space-y-0.5" aria-label="Najpogostejši razlogi odpadkov">
                  {waste.topReasons.map((r) => (
                    <li key={r.reason} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">{wasteReasonLabel(r.reason)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatNumberSl(r.count, 0)}× · {formatEUR(r.cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Z-poročilo:</span>
              {zCfg ? <BadgeChip cfg={zCfg} /> : <span className="tabular-nums">—</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Zaključek dneva:</span>
              {closeCfg ? <BadgeChip cfg={closeCfg} /> : <span className="tabular-nums">—</span>}
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export function IssuesSection({ section }: { section: IssuesSection | undefined }) {
  const feedback = section?.unresolvedFeedback
  const approvals = section?.pendingApprovals
  const operational = section?.operational

  return (
    <SectionCard
      icon={AlertTriangle}
      title="Nerešeno"
      action={<DeepLinkButton moduleId="feedback" label="Odpri mnenja gostov" />}
    >
      <div className="space-y-2 text-xs">
        <p className="flex flex-wrap items-center gap-1.5" role="status" aria-label="Nerešena mnenja">
          <span className="text-muted-foreground">Mnenja:</span>
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Nova: {feedback?.new ?? 0}
          </span>
          <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            V obdelavi: {feedback?.inReview ?? 0}
          </span>
          {feedback?.oldest && (
            <span className="text-muted-foreground">najstarejše {formatSlDateShort(feedback.oldest)}</span>
          )}
        </p>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">
            Čaka odobritev — zaključki dneva:{' '}
            <span className="tabular-nums text-foreground">{approvals?.dailyCloses ?? 0}</span>
          </span>
          <DeepLinkButton moduleId="end-of-day" label="Odpri zaključek dneva" />
          <span className="text-muted-foreground">
            inventure: <span className="tabular-nums text-foreground">{approvals?.stocktakes ?? 0}</span>
          </span>
          <DeepLinkButton moduleId="inventory" label="Odpri zalogo" />
        </p>

        <p className="flex flex-wrap items-center gap-2" role="alert" aria-label="Operativna opozorila">
          <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            Kritičnih: {operational?.critical ?? 0}
          </span>
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Opozoril: {operational?.warning ?? 0}
          </span>
        </p>
      </div>
    </SectionCard>
  )
}

export function KdsSection({ kds }: { kds: KdsSection | undefined }) {
  // Honest prazno stanje: manjkajoča sekcija ALI vsi štirje kazalci 0 →
  // vzorec verjetno ne obstaja (nikoli ne prikazujemo izmišljenih števil).
  if (!kds || (kds.lateCount === 0 && kds.onTimeRate === 0 && kds.avgFiredToReadyMinutes === 0 && kds.activeTickets === 0)) {
    return (
      <SectionCard icon={Timer} title="KDS (včeraj)">
        <EmptyText>Ni vzorčenih podatkov KDS za včeraj.</EmptyText>
      </SectionCard>
    )
  }
  return (
    <SectionCard icon={Timer} title="KDS (včeraj)">
      <dl className="grid grid-cols-2 gap-3 text-sm" aria-label="KDS kazalniki včeraj">
          <div>
            <dt className="text-xs text-muted-foreground">Zamujenih</dt>
            <dd className="font-semibold tabular-nums">{formatNumberSl(kds.lateCount, 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pravočasnost</dt>
            <dd className="font-semibold tabular-nums">{formatNumberSl(kds.onTimeRate, 1)} %</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Povp. ogenj → pripravljeno</dt>
            <dd className="font-semibold tabular-nums">{formatNumberSl(kds.avgFiredToReadyMinutes, 1)} min</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Aktivni listi</dt>
            <dd className="font-semibold tabular-nums">{formatNumberSl(kds.activeTickets, 0)}</dd>
          </div>
        </dl>
    </SectionCard>
  )
}
