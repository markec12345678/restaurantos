'use client'

// ============================================
// CIS PENDING RETRY PANEL (runda 30)
// ============================================
// Badge števec + batch ponovna oddaja za račune, katerih FINA oddaja ni
// uspela (cisStatus 'pending'/'failed'). Samozaadna komponenta (lasten fetch
// + toast) — CisTab ostane presentational, brez sprememb props vrvige.
// Zrcali stil CisTestInvoicePanel (border, muted ozadje, sm icona).
// R31 FOLD: endpoint je /api/cis/echo?resource=pending / POST action:'retry-pending'
// (Vercel Hobby 12-funkcija limit — route zložen v echo, ni novih funkcij).
// ============================================

import { memo, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { RefreshCw, Inbox, CheckCircle2, Loader2 } from 'lucide-react'

interface RetryStats {
  ok: boolean
  pendingCount: number
  failedCount: number
}

interface RetrySummary {
  attempted: number
  submitted: number
  skipped: number
  stillPending: number
  errors: number
}

/** Max batch na strani API-ja — pokaži v gumbu, da je pričakovanje jasno. */
const MAX_BATCH_UI = 25

export const CisPendingRetryPanel = memo(function CisPendingRetryPanel() {
  const [stats, setStats] = useState<RetryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/cis/echo?resource=pending', { cache: 'no-store' })
      if (res.ok) setStats((await res.json()) as RetryStats)
    } catch {
      // Badge ni kritičen — tiho; panel pokaže nevtralno stanje
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const onRetry = useCallback(async () => {
    setRetrying(true)
    try {
      const res = await fetch('/api/cis/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry-pending' }),
      })
      if (res.status === 429) {
        toast.error('Preveč poskusov — poskusite znova čez nekaj minut.')
        return
      }
      if (!res.ok) {
        toast.error('Ponovna oddaja ni uspela — poglejte server log.')
        return
      }
      const data = (await res.json()) as RetrySummary
      if (data.attempted === 0) {
        toast.info('Ni računov za ponovno oddajo — vse fiskalizirano.')
      } else if (data.submitted > 0) {
        toast.success(
          `Fiskaliziranih: ${data.submitted} (JIR)` +
            (data.stillPending > 0 ? ` · še pending: ${data.stillPending}` : '') +
            (data.skipped > 0 ? ` · preskočeni: ${data.skipped}` : '')
        )
      } else {
        toast.warning(
          `Ni novih JIR — pending: ${data.stillPending}` +
            (data.errors > 0 ? ` · napake: ${data.errors}` : '') +
            (data.skipped > 0 ? ` · preskočeni: ${data.skipped}` : '')
        )
      }
    } catch {
      toast.error('Omrežna napaka pri ponovni oddaji.')
    } finally {
      setRetrying(false)
      void loadStats()
    }
  }, [loadStats])

  const total = (stats?.pendingCount ?? 0) + (stats?.failedCount ?? 0)

  return (
    <div className="rounded-lg border bg-muted/30 dark:bg-muted/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Inbox className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            Neoddani računi (FINA)
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Nalagam števce" />
            ) : stats ? (
              total > 0 ? (
                <Badge variant="destructive" aria-label={`${total} neoddanih računov`}>
                  {total}
                </Badge>
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Vse fiskalizirano" />
              )
            ) : null}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Računi, katerih oddaja na Porezno upravo ni uspela (transport napaka, b001, manjkajoč
            certifikat ob plačilu). Ponovna oddaja je <strong>idempotentna</strong> — zajame samo
            pending/failed, že fiskalizirani se preskočijo.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
          className="shrink-0 active:scale-95 transition-transform"
          aria-label="Ponovi FINA oddajo neoddanih računov"
        >
          {retrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Oddaja…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Ponovi oddajo{total > 0 ? ` (${Math.min(total, MAX_BATCH_UI)})` : ''}
            </>
          )}
        </Button>
      </div>

      {stats && total === 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Vsi računi so fiskalizirani — čakalna vrsta je prazna.
        </p>
      )}

      {stats && stats.pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {stats.pendingCount} pending
          {stats.failedCount > 0 ? ` · ${stats.failedCount} failed` : ''} — najstarejši se odda
          najprej (do {MAX_BATCH_UI} na batch, sekvencno).
        </p>
      )}
    </div>
  )
})
