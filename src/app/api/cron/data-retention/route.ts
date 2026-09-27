// ============================================
// POST /api/cron/data-retention — Avtomatsči cleanup starih podatkov
// ============================================
// GDPR zahteva, da osebne podatke hranimo samo toliko časa kot je potrebno.
// Okna hrambe živijo v src/lib/retention/policy.ts (RETENTION_POLICY —
// enoten vir resnice R148, epic #115 #35); ta cron jih IZVRŠI:
//   1. AuditLog vnose starejše od 730 dni (GDPR Article 5(1)(e) — storage
//      limitation; policy.ts RETENTION_POLICY)
//   2. WebhookDelivery vnose starejše od 30 dni (delivery tracking)
//   3. Session vnose ki so potekli (security — no stale sessions)
//   4. ScheduledEmailLog vnose starejše od 90 dni (email tracking)
//
// R148: po uspešnem purge-u se zapiše sistemski audit vnos AUDIT_RETENTION_PURGED
// (counters-only, PII-free, Z anchor bookkeepingom — anchorIn = previousHash
// prve ohranjene vrstice, anchorOut = '' pri prefix rezini), tako da
// anchor-aware verify-chain purge prepozna kot dokumentirano odstranitev
// (chainIntact ostane true). Opomba: cron AuditLog purge je BREZ arhiva —
// za verificiran arhiv + purge uporabite POST /api/audit/archive?apply=1.
//
// Schedule: dnevno ob 04:00 CET (nizka obremenitev)
// vercel.json: { "crons": [{ "path": "/api/cron/data-retention", "schedule": "0 4 * * *" }] }
//
// Varnost: CRON_SECRET v headerju (enako kot /api/cron/outbox)
// ============================================

import { NextResponse } from 'next/server'
import { createAuditLog, db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth-middleware'
import { retentionCutoffFor } from '@/lib/retention/policy'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60s za Vercel cron

export async function POST(req: Request) {
  try {
    // Avtenticiraj s CRON_SECRET ali admin permission
    // FIX R82-F (fail-open bug): prej `if (expectedAuth && ...)` — brez
    // nastavljenega CRON_SECRET je bil guard POPOLNOMA PRESKOČEN → anonimni
    // GDPR deleteMany čez vse tenantе! Zdaj fail-closed: cron OK, sicer
    // obvezen admin session.
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const expectedAuth = cronSecret ? `Bearer ${cronSecret}` : null

    if (!(expectedAuth && authHeader === expectedAuth)) {
      const authResult = await requireAuth(req, { permission: 'admin' })
      if (authResult.error) {
        logger.warn('DataRetention', `Unauthorized cron call from ${req.headers.get('x-forwarded-for') || 'unknown'}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const startTime = Date.now()
    const now = new Date()
    const results: Record<string, unknown> = {}
    // Anchor bookkeeping za verify-chain (documented truncation dokaz).
    // anchorIn = previousHash prve OHRANJENE AuditLog vrstice (== chainHash
    // zadnje izbrisane pri dobro oblikovani verigi); anchorOut = '' (purge
    // odstrani PREFIX verige → prelom je na genesis mestu). null = ni bilo
    // AuditLog purge-a (ali tabela sedaj prazna — brez preloma).
    let retentionAnchorIn: string | null = null

    // ─── 1. AuditLog — 730 dni (RETENTION_POLICY) ─────────────
    // GDPR Article 5(1)(e): osebni podatki se hranijo samo toliko časa kot je potrebno.
    // AuditLog vsebuje userId (employeeId) — po 2 letih se briše.
    // FURS zahteva hrambo računov 6 let, ampak AuditLog ni FURS dokument —
    // to je interni log sprememb.
    const auditCutoff = retentionCutoffFor('AuditLog', now)

    try {
      const auditDeleted = await db.auditLog.deleteMany({
        where: { timestamp: { lt: auditCutoff as Date } },
      })
      results.auditLog = {
        deleted: auditDeleted.count,
        olderThan: (auditCutoff as Date).toISOString().split('T')[0],
      }
      logger.info('DataRetention', `AuditLog: deleted ${auditDeleted.count} records older than 730 days`)
      // Anchor bookkeeping (R148) — ŠELE po uspešnem deleteMany: prva
      // ohranjena vrstice (timestamp >= cutoff) nosi previousHash zadnje
      // izbrisane (chainHash) → verify-chain pogoj anchorIn == actual.
      if (auditDeleted.count > 0) {
        const firstKept = await db.auditLog.findFirst({
          where: { timestamp: { gte: auditCutoff as Date } },
          orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
          select: { previousHash: true },
        })
        retentionAnchorIn = firstKept ? (firstKept.previousHash || '') : null
      }
    } catch (err) {
      results.auditLog = { error: err instanceof Error ? err.message : 'Unknown' }
      logger.error('DataRetention', 'AuditLog cleanup failed:', err)
    }

    // ─── 2. WebhookDelivery — 30 dni (RETENTION_POLICY) ───────
    const webhookCutoff = retentionCutoffFor('WebhookDelivery', now)

    try {
      const webhookDeleted = await db.webhookDelivery.deleteMany({
        where: { createdAt: { lt: webhookCutoff as Date } },
      })
      results.webhookDelivery = {
        deleted: webhookDeleted.count,
        olderThan: (webhookCutoff as Date).toISOString().split('T')[0],
      }
      logger.info('DataRetention', `WebhookDelivery: deleted ${webhookDeleted.count} records older than 30 days`)
    } catch (err) {
      results.webhookDelivery = { error: err instanceof Error ? err.message : 'Unknown' }
      logger.error('DataRetention', 'WebhookDelivery cleanup failed:', err)
    }

    // ─── 3. Sessions — potekle seje (RETENTION_POLICY: 'expired') ──
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

    // ─── 4. ScheduledEmailLog — 90 dni (RETENTION_POLICY) ─────
    const emailCutoff = retentionCutoffFor('ScheduledEmailLog', now)

    try {
      const emailLogDeleted = await db.scheduledEmailLog.deleteMany({
        where: { createdAt: { lt: emailCutoff as Date } },
      })
      results.scheduledEmailLog = {
        deleted: emailLogDeleted.count,
        olderThan: (emailCutoff as Date).toISOString().split('T')[0],
      }
      logger.info('DataRetention', `ScheduledEmailLog: deleted ${emailLogDeleted.count} records older than 90 days`)
    } catch (err) {
      results.scheduledEmailLog = { error: err instanceof Error ? err.message : 'Unknown' }
      logger.error('DataRetention', 'ScheduledEmailLog cleanup failed:', err)
    }

    // ─── Sistemski audit vnos (R148) — SAMO ob uspehu, counters-only ────
    const auditResult = results.auditLog as Record<string, unknown> | undefined
    const webhookResult = results.webhookDelivery as Record<string, unknown> | undefined
    const sessionsResult = results.sessions as Record<string, unknown> | undefined
    const emailResult = results.scheduledEmailLog as Record<string, unknown> | undefined
    const hadErrors =
      [auditResult, webhookResult, sessionsResult, emailResult].some(
        r => typeof r === 'object' && r !== null && 'error' in r,
      )
    if (!hadErrors) {
      await createAuditLog({
        // ISTO ime akcije kot POST /api/audit/archive?apply=1 — verify-chain
        // išče exactly 'AUDIT_RETENTION_PURGED' (anchor-aware documented
        // truncation). entityType loči cron (SystemRetention) od admin arhiva
        // (AuditRetention); verify-chain filtrira SAMO po action.
        action: 'AUDIT_RETENTION_PURGED',
        entityType: 'SystemRetention',
        entityId: 'cron:data-retention',
        // Sistemski vnos (CRON) — userId null, locationId null (R148-a kontrakt).
        userId: undefined,
        locationId: null,
        details: {
          auditLog: auditResult?.deleted ?? 0,
          webhookDelivery: webhookResult?.deleted ?? 0,
          sessions: sessionsResult?.deleted ?? 0,
          scheduledEmailLog: emailResult?.deleted ?? 0,
          // Anchor bookkeeping — cron purge je BREZ arhiva (archive: false).
          anchorIn: retentionAnchorIn,
          anchorOut: retentionAnchorIn !== null ? '' : null,
          archive: false,
        },
      })
    }

    const duration = Date.now() - startTime
    logger.info('DataRetention', `Completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      results,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    logger.error('DataRetention', `Cron failed: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

// GET support za ročne klice
export async function GET(req: Request) {
  return POST(req)
}
