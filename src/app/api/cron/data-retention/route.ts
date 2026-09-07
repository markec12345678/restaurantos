// ============================================
// POST /api/cron/data-retention — Avtomatsči cleanup starih podatkov
// ============================================
// GDPR zahteva, da osebne podatke hranimo samo toliko časa kot je potrebno.
// Ta cron job briše:
//   1. AuditLog vnose starejše od 2 leti (GDPR Article 5(1)(e) — storage limitation)
//   2. ApiLog vnose starejše od 90 dni (performance logs)
//   3. WebhookDelivery vnose starejše od 30 dni (delivery tracking)
//   4. Session vnose ki so potekli (security — no stale sessions)
//   5. ScheduledEmailLog vnose starejše od 90 dni (email tracking)
//
// Schedule: dnevno ob 04:00 CET (nizka obremenitev)
// vercel.json: { "crons": [{ "path": "/api/cron/data-retention", "schedule": "0 4 * * *" }] }
//
// Varnost: CRON_SECRET v headerju (enako kot /api/cron/outbox)
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60s za Vercel cron

export async function POST(req: Request) {
  try {
    // Avtenticiraj s CRON_SECRET ali admin permission
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const expectedAuth = cronSecret ? `Bearer ${cronSecret}` : null

    if (expectedAuth && authHeader !== expectedAuth) {
      const authResult = await requireAuth(req, { permission: 'admin' })
      if (authResult.error) {
        logger.warn('DataRetention', `Unauthorized cron call from ${req.headers.get('x-forwarded-for') || 'unknown'}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const startTime = Date.now()
    const results: Record<string, unknown> = {}

    // ─── 1. AuditLog — 2 leti retention ────────────────────────
    // GDPR Article 5(1)(e): osebni podatki se hranijo samo toliko časa kot je potrebno.
    // AuditLog vsebuje userId (employeeId) — po 2 letih se briše.
    // FURS zahteva hrambo računov 6 let, ampak AuditLog ni FURS dokument —
    // to je interni log sprememb.
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    try {
      const auditDeleted = await db.auditLog.deleteMany({
        where: { timestamp: { lt: twoYearsAgo } },
      })
      results.auditLog = {
        deleted: auditDeleted.count,
        olderThan: twoYearsAgo.toISOString().split('T')[0],
      }
      logger.info('DataRetention', `AuditLog: deleted ${auditDeleted.count} records older than 2 years`)
    } catch (err) {
      results.auditLog = { error: err instanceof Error ? err.message : 'Unknown' }
      logger.error('DataRetention', 'AuditLog cleanup failed:', err)
    }

    // ─── 2. WebhookDelivery — 30 dni retention ────────────────
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    try {
      const webhookDeleted = await db.webhookDelivery.deleteMany({
        where: { createdAt: { lt: thirtyDaysAgo } },
      })
      results.webhookDelivery = {
        deleted: webhookDeleted.count,
        olderThan: thirtyDaysAgo.toISOString().split('T')[0],
      }
      logger.info('DataRetention', `WebhookDelivery: deleted ${webhookDeleted.count} records older than 30 days`)
    } catch (err) {
      results.webhookDelivery = { error: err instanceof Error ? err.message : 'Unknown' }
      logger.error('DataRetention', 'WebhookDelivery cleanup failed:', err)
    }

    // ─── 3. Sessions — potekle seje ────────────────────────────
    const now = new Date()
    try {
      const sessionsDeleted = await db.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { absoluteExpiry: { lt: now } },
          ],
        },
      })
      results.sessions = {
        deleted: sessionsDeleted.count,
        reason: 'expired',
      }
      logger.info('DataRetention', `Sessions: deleted ${sessionsDeleted.count} expired sessions`)
    } catch (err) {
      results.sessions = { error: err instanceof Error ? err.message : 'Unknown' }
      logger.error('DataRetention', 'Sessions cleanup failed:', err)
    }

    // ─── 4. ScheduledEmailLog — 90 dni retention ──────────────
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    try {
      const emailLogDeleted = await db.scheduledEmailLog.deleteMany({
        where: { createdAt: { lt: ninetyDaysAgo } },
      })
      results.scheduledEmailLog = {
        deleted: emailLogDeleted.count,
        olderThan: ninetyDaysAgo.toISOString().split('T')[0],
      }
      logger.info('DataRetention', `ScheduledEmailLog: deleted ${emailLogDeleted.count} records older than 90 days`)
    } catch (err) {
      results.scheduledEmailLog = { error: err instanceof Error ? err.message : 'Unknown' }
      logger.error('DataRetention', 'ScheduledEmailLog cleanup failed:', err)
    }

    const duration = Date.now() - startTime
    logger.info('DataRetention', `Completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('DataRetention', `Cron failed: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET support za ročne klice
export async function GET(req: Request) {
  return POST(req)
}
