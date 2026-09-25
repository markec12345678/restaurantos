'use client'

import { memo } from 'react'
import { AlertTriangle, BarChart3, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KDS_DANGER_MINUTES } from '@/lib/kds-reminder'
import type { KdsMetrics, KdsMetricsQueueRow } from './use-kds-page/use-kds-metrics'

// ═══════════════════════════════════════════════════════════════
// KDS Metrics Panel (R133) — overlay POD headerjem (NI dialog —
// kuhinjske rokavice, vedno viden ob toggle, grid ostane živ pod njim).
// sl-only hardcoded strings (hišna konvencija KDS strani — parity
// toastov 'Napaka pri bump'), BREZ i18n.
// Paleta: emerald/amber/red/zinc — hladni modri odtenki NIKOLI (hišno pravilo).
// ═══════════════════════════════════════════════════════════════

interface KDSMetricsPanelProps {
  metrics: KdsMetrics | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onClose: () => void
}

/** Opozorilni prag za starost ticketa (KDS_DANGER_MINUTES = rdeča). */
const AGE_WARN_MINUTES = 15

/** 1 decimalka, null → '—' (strežnik pošilja round 1, branimo se vseeno). */
function fmt1(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return String(Math.round(value * 10) / 10)
}

/** Starost ticketa / vrste: zinc < 15, amber 15–24.9, red ≥ 25 (KDS_DANGER_MINUTES). */
function ageTone(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return 'text-zinc-700 dark:text-zinc-300'
  if (minutes >= KDS_DANGER_MINUTES) return 'text-red-600 dark:text-red-400'
  if (minutes >= AGE_WARN_MINUTES) return 'text-amber-600 dark:text-amber-400'
  return 'text-zinc-700 dark:text-zinc-300'
}

/** On-time %: emerald ≥ 85, amber 70–84.9, red < 70; null → nevtralno ('—'). */
function onTimeTone(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return 'text-zinc-700 dark:text-zinc-300'
  if (rate >= 85) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export const KDSMetricsPanel = memo(function KDSMetricsPanel({
  metrics,
  isLoading,
  isError,
  onRetry,
  onClose,
}: KDSMetricsPanelProps) {
  const live = metrics?.live ?? null
  const throughput = metrics?.throughput ?? null
  const liveQueue = live?.queueByStation
  const queue: KdsMetricsQueueRow[] = Array.isArray(liveQueue) ? liveQueue : []

  const activeTickets = live?.activeTickets ?? null
  const itemsBumped = throughput?.itemsBumped ?? null
  // Prazno stanje: ni bumpov in ni aktivnih ticketov (null-safe → 0)
  const isEmpty = (itemsBumped ?? 0) === 0 && (activeTickets ?? 0) === 0

  return (
    <section
      aria-label="Metrike kuhinje"
      className="shrink-0 border-b bg-background max-h-[50vh] overflow-y-auto custom-scrollbar"
    >
      {/* Naslovna vrstica + zapri */}
      <div className="flex items-center justify-between px-4 py-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
          Metrike
        </h2>
        <button
          onClick={onClose}
          aria-label="Zapri metrike"
          title="Zapri metrike"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px] pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Nalaganje — 2 skeleton vrstici */}
      {isLoading ? (
        <div className="px-4 pb-4 space-y-3" aria-hidden="true">
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        </div>
      ) : isError ? (
        /* Napaka — Alert stil + 'Znova poskusi' (404, ko ruta še ni pristala, prav tako pade sem) */
        <div
          role="alert"
          className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
          <p className="text-sm text-red-800 dark:text-red-300">Napaka pri nalaganju metrik.</p>
          <button
            onClick={onRetry}
            aria-label="Znova poskusi"
            className="ml-auto flex items-center gap-1.5 h-11 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 touch-manipulation"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Znova poskusi
          </button>
        </div>
      ) : isEmpty ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Danes še ni bumpov.</p>
      ) : (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* ─── LIVE ─── */}
          <section aria-label="LIVE" className="rounded-xl border bg-card p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">LIVE</h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Aktivni ticketi</p>
                <p className="text-3xl font-bold tabular-nums">{fmt1(activeTickets)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Najstarejši ticket</p>
                <p className={cn('text-3xl font-bold tabular-nums', ageTone(live?.oldestTicketMinutes))}>
                  {fmt1(live?.oldestTicketMinutes)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">min</span>
                </p>
              </div>
            </div>
            {/* Čakalna vrsta po postajah — vidnih ~6 vrstic, preostanek scroll */}
            {queue.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">Čakalna vrsta po postajah</p>
                <ul className="mt-1 max-h-60 space-y-1 overflow-y-auto custom-scrollbar">
                  {queue.map((row, idx) => (
                    <li
                      key={`${row.station ?? 'other'}-${idx}`}
                      className="flex h-10 items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 text-sm"
                    >
                      <span className="truncate font-medium">{row.station?.trim() || 'other'}</span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        <span className="text-muted-foreground">{fmt1(row.items)}</span>
                        <span className={cn('font-semibold', ageTone(row.oldestMinutes))}>
                          {fmt1(row.oldestMinutes)} min
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* ─── DANES (throughput) ─── */}
          <section aria-label="Danes" className="rounded-xl border bg-card p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Danes</h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Bumped</p>
                <p className="text-3xl font-bold tabular-nums">{fmt1(itemsBumped)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On-time</p>
                <p className={cn('text-3xl font-bold tabular-nums', onTimeTone(throughput?.onTimeRate))}>
                  {throughput?.onTimeRate == null ? '—' : `${fmt1(throughput.onTimeRate)} %`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Povprečni čas priprave</p>
                <p className="text-2xl font-bold tabular-nums">{fmt1(throughput?.avgFiredToReadyMinutes)} min</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mediana</p>
                <p className="text-2xl font-bold tabular-nums">{fmt1(throughput?.medianFiredToReadyMinutes)} min</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">P90</p>
                <p className="text-2xl font-bold tabular-nums">{fmt1(throughput?.p90FiredToReadyMinutes)} min</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Zamude</p>
                <p className="text-2xl font-bold tabular-nums">{fmt1(throughput?.lateCount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Povprečna prekoračitev</p>
                <p className="text-2xl font-bold tabular-nums">{fmt1(throughput?.avgLateMinutes)} min</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
})
