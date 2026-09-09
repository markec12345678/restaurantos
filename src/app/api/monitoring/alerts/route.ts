// ============================================
// GET /api/monitoring/alerts — Infrastrukturni alerti (P1-observability)
// ============================================
// 8 alert pravil (specifikacija):
//   1. večkratne FURS napake           (furs_errors_total v 10-min oknu ≥ 5)
//   2. neuspešni payment webhooki      (failed outbox, tip payment)
//   3. vrsta, ki se ne prazni          (najstarejši pending > 15 min)
//   4. velik porast 500 napak          (http_5xx v 5-min oknu ≥ 10)
//   5. WebSocket disconnect spike      (iz WS metrik custom server-ja)
//   6. negativna zaloga                (InventoryItem.quantity < 0)
//   7. neuspešen / zapoznel backup     (heartbeat datoteka starejša od intervala)
//   8. audit chain mismatch            (blockchain-audit verifyChain)
//
// Poslovno-operativni alerti (zamuda naročil, nizka zaloga, odprte izmene…)
// ostajajo na /api/operational-alerts — TA endpoint pokriva INFRASTRUKTURO.
// ============================================

import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { METRICS, countEventsInWindow } from '@/lib/observability'
import { verifyChain } from '@/lib/blockchain-audit'
import { fetchWsMetrics, countWsDisconnectsInWindow } from '@/lib/observability/ws'

export const dynamic = 'force-dynamic'

interface Alert {
  type: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  details?: Record<string, unknown>
}

// Alert pragme (namenoma konzervativne — cilj je signal, ne hrup)
const THRESHOLDS = {
  FURS_ERRORS_COUNT: 5,        // napak v oknu
  FURS_ERRORS_WINDOW_MS: 10 * 60 * 1000,
  HTTP_5XX_COUNT: 10,          // 5xx v oknu
  HTTP_5XX_WINDOW_MS: 5 * 60 * 1000,
  QUEUE_STALE_MINUTES: 15,     // najstarejši pending dogodek
  WS_DISCONNECTS_COUNT: 20,    // odklopi v oknu
  WS_DISCONNECTS_WINDOW_MS: 5 * 60 * 1000,
  BACKUP_DEFAULT_INTERVAL_H: 24,
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

/** Preberi backup heartbeat datoteko (piše jo zunanji backup skript). */
function readBackupStatus(): { lastSuccess: string | null; path: string } {
  const path = process.env.BACKUP_STATUS_FILE || '.backup-status.json'
  try {
    if (!existsSync(path)) return { lastSuccess: null, path }
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { lastSuccess?: string }
    return { lastSuccess: raw.lastSuccess ?? null, path }
  } catch {
    return { lastSuccess: null, path }
  }
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const alerts: Alert[] = []

    // ── 1. Večkratne FURS napake (okenski števec iz registra) ──
    const fursErrorsInWindow = countEventsInWindow(
      METRICS.FURS_ERRORS, THRESHOLDS.FURS_ERRORS_WINDOW_MS,
    )
    if (fursErrorsInWindow >= THRESHOLDS.FURS_ERRORS_COUNT) {
      alerts.push({
        type: 'furs_errors',
        severity: 'critical',
        message: `${fursErrorsInWindow} FURS napak v zadnjih 10 minutah — fiskalizacija je okvarjena`,
        details: { count: fursErrorsInWindow },
      })
    }

    // ── 2. Neuspešni payment webhooki ──
    const failedPaymentEvents = await safe(
      () => db.outboxEvent.count({ where: { status: 'failed', aggregateType: 'payment' } }),
      0,
    )
    if (failedPaymentEvents > 0) {
      alerts.push({
        type: 'payment_webhook_failed',
        severity: failedPaymentEvents > 3 ? 'critical' : 'warning',
        message: `${failedPaymentEvents} neuspešnih payment webhook dogodkov — preveri outbox retry`,
        details: { count: failedPaymentEvents },
      })
    }

    // ── 3. Vrsta, ki se ne prazni (outbox pending stale) ──
    const oldestPending = await safe(async () => {
      const oldest = await db.outboxEvent.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
      return oldest?.createdAt ?? null
    }, null)
    const deadLetter = await safe(
      () => db.outboxEvent.count({ where: { status: 'dead_letter' } }),
      0,
    )
    if (oldestPending) {
      const ageMin = (Date.now() - new Date(oldestPending).getTime()) / 60000
      if (ageMin > THRESHOLDS.QUEUE_STALE_MINUTES) {
        alerts.push({
          type: 'queue_not_draining',
          severity: 'critical',
          message: `Outbox vrsta se ne prazni — najstarejši pending dogodek čaka ${Math.floor(ageMin)} min`,
          details: { oldestPendingAgeMinutes: Math.floor(ageMin) },
        })
      }
    }
    if (deadLetter > 0) {
      alerts.push({
        type: 'queue_dead_letter',
        severity: 'critical',
        message: `${deadLetter} dogodkov v dead-letter vrsti — ročni pregled potreben`,
        details: { count: deadLetter },
      })
    }

    // ── 4. Velik porast 500 napak (okenski števec) ──
    const http5xxInWindow = countEventsInWindow(METRICS.HTTP_5XX, THRESHOLDS.HTTP_5XX_WINDOW_MS)
    if (http5xxInWindow >= THRESHOLDS.HTTP_5XX_COUNT) {
      alerts.push({
        type: 'http_5xx_spike',
        severity: 'critical',
        message: `${http5xxInWindow} strežniških napak (5xx) v zadnjih 5 minutah`,
        details: { count: http5xxInWindow },
      })
    }

    // ── 5. WebSocket disconnect spike (iz custom server metrik, če teče) ──
    const ws = await fetchWsMetrics()
    if (ws) {
      const disconnects = countWsDisconnectsInWindow(ws, THRESHOLDS.WS_DISCONNECTS_WINDOW_MS)
      if (disconnects >= THRESHOLDS.WS_DISCONNECTS_COUNT) {
        alerts.push({
          type: 'ws_disconnect_spike',
          severity: 'warning',
          message: `${disconnects} WebSocket odklopov v 5 minutah — preveri omrežje/stabilnost`,
          details: { count: disconnects, active: ws.connectionsActive },
        })
      }
    }

    // ── 6. Negativna zaloga ──
    const negativeInventory = await safe(
      () => db.inventoryItem.count({ where: { quantity: { lt: 0 } } }),
      0,
    )
    if (negativeInventory > 0) {
      alerts.push({
        type: 'negative_inventory',
        severity: 'critical',
        message: `${negativeInventory} artiklov z NEGATIVNO zalogo — takojšnji pregled inventarja`,
        details: { count: negativeInventory },
      })
    }

    // ── 7. Neuspešen / zapoznel backup (heartbeat iz backup skripte) ──
    const expectedIntervalH = Number(process.env.BACKUP_EXPECTED_INTERVAL_HOURS)
      || THRESHOLDS.BACKUP_DEFAULT_INTERVAL_H
    const backup = readBackupStatus()
    if (backup.lastSuccess) {
      const ageH = (Date.now() - new Date(backup.lastSuccess).getTime()) / 3_600_000
      if (ageH > expectedIntervalH) {
        alerts.push({
          type: 'backup_overdue',
          severity: ageH > expectedIntervalH * 2 ? 'critical' : 'warning',
          message: `Zadnji uspešen backup je pred ${Math.floor(ageH)} h (pričakovano vsakih ${expectedIntervalH} h)`,
          details: { lastSuccess: backup.lastSuccess },
        })
      }
    } else {
      alerts.push({
        type: 'backup_not_configured',
        severity: 'info',
        message: 'Backup heartbeat ni nikoli zabeležen — nastavite backup skripto s POST /api/monitoring/backup-heartbeat',
        details: { statusFile: backup.path },
      })
    }

    // ── 8. Audit chain mismatch (tamper-evident veriga) ──
    const chain = await safe(() => verifyChain(), { valid: true, totalBlocks: 0 })
    if (!chain.valid) {
      alerts.push({
        type: 'audit_chain_mismatch',
        severity: 'critical',
        message: `REVIZIJSKA VERIGA JE PREKINJENA — blok #${(chain as { brokenAt?: number }).brokenAt}: morebiten poseg v dnevnik`,
        details: { error: (chain as { error?: string }).error },
      })
    }

    // Kritični alerti se zazlogirajo (vidni tudi v log agregatorju/Sentry)
    for (const a of alerts.filter(x => x.severity === 'critical')) {
      logger.error('ALERTS', a.message, { type: a.type, ...a.details })
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
      },
      alerts,
      thresholds: THRESHOLDS,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/monitoring/alerts', 'Napaka pri evalvaciji alertov')
  }
}
