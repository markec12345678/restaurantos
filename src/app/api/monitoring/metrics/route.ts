// ============================================
// GET /api/monitoring/metrics — Observability metrike (P1)
// ============================================
// Admin-only: kombinacija IN-PROCESS registra (števci/histogrami —
// http_5xx, FURS latenca, DB latenca, login neuspehi) in DB-izpeljanih
// goric (outbox globina, reconciliacija plačil, neusklajenost inventarja).
//
// WebSocket metrike: pripojene iz custom server-ja (server.js), če teče —
// fetch na /internal/ws-metrics s WS_BROADCAST_SECRET (500ms timeout,
// graceful izostanek kadar next dev/serverless brez custom server-ja).
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { METRICS, getMetricsSnapshot, setGauge } from '@/lib/observability'
import { fetchWsMetrics } from '@/lib/observability/ws'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // ── 1. DB-izpeljane metrike (gorice) ──
    // Outbox globine (queue depth / failed / dead-letter)
    const [pending, failed, deadLetter] = await Promise.all([
      db.outboxEvent.count({ where: { status: 'pending' } }),
      db.outboxEvent.count({ where: { status: 'failed' } }),
      db.outboxEvent.count({ where: { status: 'dead_letter' } }),
    ])
    setGauge(METRICS.QUEUE_DEPTH, pending)
    setGauge(METRICS.QUEUE_FAILED, failed)
    setGauge(METRICS.QUEUE_DEAD_LETTER, deadLetter)

    // Payment reconciliacija (raw SQL — JournalEntry.reference ni FK relacija):
    //   1. zaključena plačila BREZ pripadajočega dnevniškega vnosa (accounting vrzel)
    //   2. neuspešni outbox webhook dogodki za plačila (payment gateway dostave)
    //   3. negativna zaloga + neusklajenost inventarja (ledger ≠ trenutna količina)
    const [reconciliation, inventoryChecks] = await Promise.all([
      safeQueryFn(() => db.$queryRaw<ReconciliationRow[]>`
        SELECT
          (SELECT COUNT(*) FROM "Payment" p
            WHERE p.status = 'completed'
              AND NOT EXISTS (
                SELECT 1 FROM "JournalEntry" je
                WHERE je."reference" = p.id AND je."referenceType" = 'payment'
              )) AS "withoutJournal",
          (SELECT COUNT(*) FROM "OutboxEvent" o
            WHERE o.status = 'failed' AND o."aggregateType" = 'payment') AS "webhookFailed"
      `, [{ withoutJournal: 0, webhookFailed: 0 }]),
      safeQueryFn(() => db.$queryRaw<InventoryCheckRow[]>`
        SELECT
          (SELECT COUNT(*) FROM "InventoryItem" i WHERE i.quantity < 0) AS "negative",
          (SELECT COUNT(*) FROM "InventoryItem" i
            JOIN LATERAL (
              SELECT s."newQty" FROM "StockTransaction" s
              WHERE s."inventoryItemId" = i.id
              ORDER BY s."createdAt" DESC LIMIT 1
            ) latest ON true
            WHERE latest."newQty" != i.quantity) AS "mismatch"
      `, [{ negative: 0, mismatch: 0 }]),
    ])

    const rec = reconciliation[0] ?? { withoutJournal: 0, webhookFailed: 0 }
    const inv = inventoryChecks[0] ?? { negative: 0, mismatch: 0 }
    // PGlite adapter vrača BigInt kot string — varna konverzija obeh oblik
    const toNum = (v: bigint | string | number): number => Number(v) || 0

    setGauge(METRICS.PAYMENTS_WITHOUT_JOURNAL, toNum(rec.withoutJournal))
    setGauge(METRICS.PAYMENT_WEBHOOK_FAILED, toNum(rec.webhookFailed))
    setGauge(METRICS.INVENTORY_NEGATIVE, toNum(inv.negative))
    setGauge(METRICS.INVENTORY_MISMATCH, toNum(inv.mismatch))

    // Offline sync neuspehi: zavrnjene/konfliktne offline sinhronizacije
    // (offline konflikti se zapišejo kot audit + sync zavrnitve kot failed outbox)
    const syncFailed = await safeQueryFn(() => db.outboxEvent.count({
      where: { status: 'failed', target: 'internal', aggregateType: 'order' },
    }), 0)
    setGauge(METRICS.SYNC_FAILED, syncFailed)

    // ── 2. In-process register (števci/histogrami) ──
    const snapshot = getMetricsSnapshot()

    // ── 3. WebSocket metrike (custom server) ──
    const ws = await fetchWsMetrics()

    logger.info('MONITORING', 'Metrics snapshot', {
      pending, failed, deadLetter,
      paymentsWithoutJournal: toNum(rec.withoutJournal),
      negativeCount: toNum(inv.negative), wsAvailable: !!ws,
    })

    return NextResponse.json({
      ...snapshot,
      db: {
        outbox: { pending, failed, deadLetter },
        reconciliation: {
          paymentsWithoutJournal: toNum(rec.withoutJournal),
          paymentWebhookFailed: toNum(rec.webhookFailed),
        },
        syncFailed,
        inventory: {
          negativeCount: toNum(inv.negative),
          ledgerMismatchCount: toNum(inv.mismatch),
        },
      },
      ...(ws ? { websocket: ws } : {}),
      requestedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/monitoring/metrics', 'Napaka pri pridobivanju metrik')
  }
}

/** Varna izvedba poizvedbe — ob napaki vrne fallback (metrike NE smejo
 *  prelomiti monitoringa; napaka se zazlogira v alerts poti). */
async function safeQueryFn<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

interface ReconciliationRow { withoutJournal: bigint | number; webhookFailed: bigint | number }
interface InventoryCheckRow { negative: bigint | number; mismatch: bigint | number }
