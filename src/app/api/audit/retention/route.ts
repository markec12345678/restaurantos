// ============================================
// GET /api/audit/retention — #35 Audit/retention (R148-b)
// ============================================
// Admin-only DRY-RUN preview hrambe podatkov (epic P2-07 "DEFINIRAJ"):
//   • policy      — RETENTION_POLICY (aktivna retencija) + DOCUMENTED_INDEFINITE
//                   (naročila/računi/plačila/premeni/gostje — FURS, se NE brišejo),
//   • eligible    — števci vrstic za izbris po cutoffu (count(), BREZ pisalnih klicev),
//   • chain       — anchor (previousHash najstarejše AuditLog vrstice) + head
//                   (chainHash najnovejše) — isti pogled kot /api/audit/verify-chain.
//
// Kanon (R146/R147 precedens): force-dynamic; rate-limit 'audit-retention' PRED
// authom; requireAuth permission 'admin' (manager bypass NE preide) + BUG-HUNT
// guard `error || session === null`; Cache-Control no-store; BREZ audit zapisa
// (cheap read — pariteta portability manifest mode).
//
// VERIGA JE GLOBALNA (schema.prisma: previousHash/chainHash brez location FK):
// ?locationId parametra NAMERNO NI — retention je časovna rezina, nikoli
// lokacijska (R148-a ključna ugotovitev #7).
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { checkRateLimitAsync, getClientIp, AUDIT_RETENTION_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import {
  RETENTION_POLICY,
  RETENTION_POLICY_NOTES,
  DOCUMENTED_INDEFINITE,
  retentionCutoffFor,
} from '@/lib/retention/policy'

export const dynamic = 'force-dynamic'

const RETENTION_FORMAT = 'restaurantos-audit-retention'
const RETENTION_VERSION = 1

export async function GET(req: Request) {
  try {
    // R146 kanon: rate limit PRED authom (presets.ts bucket 'audit-retention')
    const rl = await checkRateLimitAsync('audit-retention', getClientIp(req), AUDIT_RETENTION_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // 'admin' permission: samo role admin (+super_admin s permissionom) —
    // manager bypass NE preide (permissions.ts manager guard).
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error || authResult.session === null) {
      // BUG-HUNT kanon (backup route): `session: null, error: null` je JAVNA
      // pot, NE avtorizacija — zahtevamo DEJANSKO sejo.
      return authResult.error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // ── Eligible števci (count() z cutoffom — brez vrstic, brez pisalnih klicev) ──
    const auditCutoff = retentionCutoffFor('AuditLog', now)
    const webhookCutoff = retentionCutoffFor('WebhookDelivery', now)
    const emailCutoff = retentionCutoffFor('ScheduledEmailLog', now)

    const [auditEligible, webhookEligible, emailEligible, expiredSessions] = await Promise.all([
      db.auditLog.count({ where: { timestamp: { lt: auditCutoff as Date } } }),
      db.webhookDelivery.count({ where: { createdAt: { lt: webhookCutoff as Date } } }),
      db.scheduledEmailLog.count({ where: { createdAt: { lt: emailCutoff as Date } } }),
      // Session: poseben režim 'expired' (expiresAt/absoluteExpiry < now) —
      // pariteta cron /api/cron/data-retention.
      db.session.count({
        where: { OR: [{ expiresAt: { lt: now } }, { absoluteExpiry: { lt: now } }] },
      }),
    ])

    // ── Chain anchor/head (reuse verify-chain pogled: najstarejša/najnovejša) ──
    const [anchorRow, headRow] = await Promise.all([
      db.auditLog.findFirst({
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        select: { id: true, previousHash: true, chainHash: true, timestamp: true },
      }),
      db.auditLog.findFirst({
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        select: { id: true, chainHash: true, timestamp: true },
      }),
    ])

    return NextResponse.json(
      {
        format: RETENTION_FORMAT,
        version: RETENTION_VERSION,
        generatedAt: now.toISOString(),
        policy: RETENTION_POLICY,
        documentedIndefinite: DOCUMENTED_INDEFINITE,
        notes: RETENTION_POLICY_NOTES,
        eligible: {
          AuditLog: { cutoff: auditCutoff?.toISOString() ?? null, count: auditEligible },
          WebhookDelivery: { cutoff: webhookCutoff?.toISOString() ?? null, count: webhookEligible },
          ScheduledEmailLog: { cutoff: emailCutoff?.toISOString() ?? null, count: emailEligible },
          Session: { cutoff: null, count: expiredSessions, basis: 'expired' },
        },
        chain: {
          // anchor = hash, ki ga pričakuje hod od genesis (previousHash
          // najstarejše vrstice); head = trenutni konec verige.
          anchor: anchorRow
            ? { id: anchorRow.id, previousHash: anchorRow.previousHash, timestamp: anchorRow.timestamp }
            : null,
          head: headRow ? { id: headRow.id, chainHash: headRow.chainHash, timestamp: headRow.timestamp } : null,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/audit/retention', 'Napaka pri pripravi predogleda hrambe')
  }
}
