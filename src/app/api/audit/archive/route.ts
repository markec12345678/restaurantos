// ============================================
// POST /api/audit/archive — #35 Audit/retention (R148-b)
// ============================================
// Verificiran arhiv revizije + opcijski purge (epic P2-07 "arhiviranje ne sme
// porušiti referenc → audit").
//
//   ?cutoff=<ISO>  OBVEZEN — rezina po času; prihodnji datum → 400.
//   ?apply=1       brez = DRY-RUN (goli JSON {counts, checksum, anchorIn,
//                  anchorOut, wouldPurge} — BREZ vrstic, BREZ pisalnih klicev);
//                  z apply=1 = arhiv attachment + purge (deleteMany ŠELE po
//                  uspešni pairwise verifikaciji rezine) + audit zapis.
//
// ARHIV (apply): format 'restaurantos-audit-archive' v1 — AuditLog vrstice s
// chainHash/previousHash (verifiabilnost), PII polja (ipAddress/terminalId)
// IZKLJUČENA; WebhookDelivery + ScheduledEmailLog kurirano (brez
// payload/responseBody/signature oz. recipient/subject/body/errorMessage).
// Session ni del arhiva (čisti se le po poteku — cron domena).
//
// Checksum (R147-b deviation 5 precedens): computeChecksum nad PODATKI
// (cutoff + counts + rows + anchorja) — generatedAt je edino nedeterministično
// polje ovojnice in NI v checksumu → isti DB snapshot = isti checksum.
//
// CAP 20000 vrstic (skupaj čez 3 tabele): count() pre-check + re-check po
// fetchu — preseganje → 400 fail-closed (zožite cutoff; NIKOLI delni purge).
//
// Kanon: rl 'audit-retention' PRED authom; requireAuth 'admin' + BUG-HUNT
// guard; no-store; audit (createAuditLog) SAMO ob uspešnem apply purge-u,
// details counters-only (PII-free); determinističen orderBy [date asc, id asc].
//
// VERIGA JE GLOBALNA (schema.prisma: previousHash/chainHash, brez location
// FK) — ?locationId parametra NAMERNO NI: arhiv/purge je časovna rezina,
// NIKOLI lokacijska (R148-a ključna ugotovitev #7).
// ============================================

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth-middleware'
import { createAuditLog, db } from '@/lib/db'
import { checkRateLimitAsync, getClientIp, AUDIT_RETENTION_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { canonicalStringify, computeChecksum, encodeRowValues } from '@/lib/backup/serialize'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ARCHIVE_FORMAT = 'restaurantos-audit-archive'
const ARCHIVE_VERSION = 1
/** CAP skupaj čez 3 tabele — fail-closed refusal (zožite cutoff). */
export const ARCHIVE_ROW_CAP = 20000

// ── Kurirani selecti (whitelist kanon — PII strukturno izključeni) ─────────

// AuditLog: chainHash/previousHash VKLJUČENA (verifiabilnost rezine) — PII
// polja ipAddress/terminalId IZKLJUČENA (polje userAgent v shemi NE OBSTAJA —
// schema :1860; R147-b deviation 2 precedens).
const AUDIT_ARCHIVE_SELECT = {
  id: true,
  timestamp: true,
  action: true,
  entityType: true,
  entityId: true,
  userId: true,
  locationId: true,
  details: true,
  previousHash: true,
  chainHash: true,
} satisfies Prisma.AuditLogSelect

// WebhookDelivery: payload/responseBody (možna PII naročil + zunanji odzivi)
// in signature (HMAC skrivnost) IZKLJUČENI — samo operativna metadata.
const WEBHOOK_ARCHIVE_SELECT = {
  id: true,
  webhookId: true,
  event: true,
  statusCode: true,
  success: true,
  attemptCount: true,
  maxAttempts: true,
  nextRetryAt: true,
  deliveredAt: true,
  createdAt: true,
} satisfies Prisma.WebhookDeliverySelect

// ScheduledEmailLog: recipient (e-poštni naslov = PII), subject/body
// (vsebina sporočila) in errorMessage IZKLJUČENI — samo sledljivost.
const EMAIL_LOG_ARCHIVE_SELECT = {
  id: true,
  reportType: true,
  status: true,
  attachmentName: true,
  sentAt: true,
  reportDate: true,
  createdAt: true,
} satisfies Prisma.ScheduledEmailLogSelect

const ARCHIVE_NOTES: readonly string[] = [
  'Veriga AuditLog je GLOBALNA (brez locationId) — arhiv/purge je časovna rezina, NIKOLI lokacijska.',
  'AuditLog vrstice vsebujejo chainHash/previousHash (verifiabilnost rezine); PII polja ipAddress in terminalId so IZKLJUČENA.',
  'WebhookDelivery: payload, responseBody in signature so IZKLJUČENI (možna PII / HMAC skrivnost).',
  'ScheduledEmailLog: recipient, subject, body in errorMessage so IZKLJUČENI (PII — e-poštni naslovi in vsebina).',
  'Seje (Session) niso del arhiva — čistijo se samo po poteku (cron /api/cron/data-retention).',
  'Checksum pokrije PODATKE (cutoff + counts + rows + anchorja), ne ovojnico — generatedAt je edino nedeterministično polje (R147 deviation 5 precedens).',
  'Purge poteka ŠELE po uspešni pairwise verifikaciji rezine (previousHash → chainHash); zapis AUDIT_RETENTION_PURGED nosi anchorIn/anchorOut za verify-chain.',
  'Naročila, računi, plačila, premeni zaloge in podatki gostov se NE arhivirajo NE brišejo — FURS hramba 6+ let (glej GET /api/audit/retention).',
]

/** UTC stamp YYYYMMDD-HHmmss za filename (portability route precedens). */
function archiveStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  )
}

export async function POST(req: Request) {
  try {
    // R146 kanon: rate limit PRED authom (isti bucket kot GET preview)
    const rl = await checkRateLimitAsync('audit-retention', getClientIp(req), AUDIT_RETENTION_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error || authResult.session === null) {
      return authResult.error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)

    // ── cutoff: obvezen, veljaven ISO, NI v prihodnosti ────────────────────
    const cutoffRaw = searchParams.get('cutoff')
    if (!cutoffRaw) {
      return NextResponse.json(
        { error: 'Manjka obvezen parameter cutoff (ISO datum).' },
        { status: 400 },
      )
    }
    const cutoffDate = new Date(cutoffRaw)
    if (Number.isNaN(cutoffDate.getTime())) {
      return NextResponse.json(
        { error: 'Neveljaven cutoff — pričakovan ISO datum (npr. 2024-01-31T00:00:00.000Z).' },
        { status: 400 },
      )
    }
    if (cutoffDate.getTime() > Date.now()) {
      return NextResponse.json({ error: 'Cutoff ne sme biti v prihodnosti.' }, { status: 400 })
    }
    // Normaliziran ISO (determinizem checksuma čez ekvivalentne zapise)
    const cutoffIso = cutoffDate.toISOString()

    const apply = searchParams.get('apply') === '1'

    // ── CAP pre-check (count() — fail-closed PRED težkim fetchem) ──────────
    const [auditCount, webhookCount, emailCount] = await Promise.all([
      db.auditLog.count({ where: { timestamp: { lt: cutoffDate } } }),
      db.webhookDelivery.count({ where: { createdAt: { lt: cutoffDate } } }),
      db.scheduledEmailLog.count({ where: { createdAt: { lt: cutoffDate } } }),
    ])
    const totalEligible = auditCount + webhookCount + emailCount
    if (totalEligible > ARCHIVE_ROW_CAP) {
      return NextResponse.json(
        {
          error: `Arhiv presega omejitev ${ARCHIVE_ROW_CAP} vrstic (${totalEligible}). Zožite cutoff datum in izvedite več prehodov.`,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Fetch rezine (kurirano, determinističen orderBy + id tie-breaker) ──
    const [auditRows, webhookRows, emailRows] = await Promise.all([
      db.auditLog.findMany({
        where: { timestamp: { lt: cutoffDate } },
        select: AUDIT_ARCHIVE_SELECT,
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        take: ARCHIVE_ROW_CAP,
      }),
      db.webhookDelivery.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: WEBHOOK_ARCHIVE_SELECT,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: ARCHIVE_ROW_CAP,
      }),
      db.scheduledEmailLog.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: EMAIL_LOG_ARCHIVE_SELECT,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: ARCHIVE_ROW_CAP,
      }),
    ])

    // Re-check po fetchu (race varovala — purge NIKOLI več kot arhivirano)
    const fetchedTotal = auditRows.length + webhookRows.length + emailRows.length
    if (fetchedTotal > ARCHIVE_ROW_CAP) {
      return NextResponse.json(
        {
          error: `Arhiv presega omejitev ${ARCHIVE_ROW_CAP} vrstic (${fetchedTotal}). Zožite cutoff datum in izvedite več prehodov.`,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Anchorji rezine (za arhiv + AUDIT_RETENTION_PURGED) ────────────────
    // anchorIn  = previousHash PRVE arhivirane vrstice (kamor se rezina vpete),
    // anchorOut = chainHash ZADNJE arhivirane vrstice (kjer se preostala
    // veriga nadaljuje). Prazna rezina → null/null.
    const anchorIn = auditRows[0]?.previousHash ?? null
    const anchorOut = auditRows.length > 0 ? (auditRows[auditRows.length - 1]?.chainHash ?? null) : null

    const rows = {
      auditLog: auditRows.map(r => encodeRowValues(r as Record<string, unknown>)),
      webhookDelivery: webhookRows.map(r => encodeRowValues(r as Record<string, unknown>)),
      scheduledEmailLog: emailRows.map(r => encodeRowValues(r as Record<string, unknown>)),
    }
    const counts = {
      auditLog: auditRows.length,
      webhookDelivery: webhookRows.length,
      scheduledEmailLog: emailRows.length,
    }

    // ── Checksum nad PODATKI (brez generatedAt — determinizem) ─────────────
    const checksum = computeChecksum({ cutoff: cutoffIso, counts, rows, anchorIn, anchorOut })

    if (!apply) {
      // ── DRY-RUN: goli preview (brez vrstic, brez pisalnih klicev, brez audit) ──
      return NextResponse.json(
        {
          format: ARCHIVE_FORMAT,
          version: ARCHIVE_VERSION,
          generatedAt: new Date().toISOString(),
          cutoff: cutoffIso,
          applied: false,
          wouldPurge: fetchedTotal,
          counts,
          anchorIn,
          anchorOut,
          checksum,
          cap: ARCHIVE_ROW_CAP,
          notes: ARCHIVE_NOTES,
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Archive-Checksum': checksum,
            'X-Archive-Rows': String(fetchedTotal),
          },
        },
      )
    }

    // ── apply=1: pairwise verifikacija rezine ŠELE pred deleteMany ─────────
    // Veriga AuditLog je globalna — rezina mora biti neprekinjena (previousHash
    // vsake vrstice == chainHash predhodnice znotraj rezine). Prelom → 409
    // fail-closed (purge preklican, arhiv ni zaupanja vreden).
    for (let i = 1; i < auditRows.length; i++) {
      const prev = auditRows[i - 1]
      const cur = auditRows[i]
      if ((cur.previousHash || '') !== (prev.chainHash || '')) {
        return NextResponse.json(
          {
            error: `Veriga arhivirane rezine ni neprekinjena pri vnosu ${cur.id} — purge preklican (fail-closed).`,
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } },
        )
      }
    }

    // ── Purge (deleteMany z ISTIM where kot fetch — 3 tabele) ──────────────
    const [auditDeleted, webhookDeleted, emailDeleted] = await Promise.all([
      db.auditLog.deleteMany({ where: { timestamp: { lt: cutoffDate } } }),
      db.webhookDelivery.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
      db.scheduledEmailLog.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    ])

    // ── Audit zapis SAMO ob uspehu (counters-only, PII-free) ───────────────
    // anchorIn/anchorOut dokumentirata namerno odstranitev prefixa:
    //   anchorIn  = previousHash prve OHRANJENE vrstice (== chainHash zadnje
    //               izbrisane pri neprekinjeni rezini) — verify-chain pogoj
    //               `details.anchorIn == to-row previousHash`,
    //   anchorOut = pričakovani expectedPrev na mestu preloma ('' — purge
    //               odstrani začetek verige) — `details.anchorOut == from-row
    //               chainHash`. Prazna rezina / brez ohranjenih → null.
    let purgeAnchorIn: string | null = null
    let purgeAnchorOut: string | null = null
    if (auditRows.length > 0) {
      const firstKept = await db.auditLog.findFirst({
        where: { timestamp: { gte: cutoffDate } },
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        select: { id: true, previousHash: true },
      })
      if (firstKept) {
        purgeAnchorIn = firstKept.previousHash || ''
        purgeAnchorOut = '' // prelom je vedno na genesis mestu (časovni prefix)
      }
    }

    await createAuditLog({
      action: 'AUDIT_RETENTION_PURGED',
      entityType: 'AuditRetention',
      entityId: cutoffIso,
      userId: authResult.session?.employeeId,
      locationId: null, // globalna operacija — veriga nima lokacij
      details: {
        auditLogRows: auditDeleted.count,
        webhookDeliveryRows: webhookDeleted.count,
        scheduledEmailLogRows: emailDeleted.count,
        cutoff: cutoffIso,
        checksum,
        anchorIn: purgeAnchorIn,
        anchorOut: purgeAnchorOut,
      },
    })

    // ── Arhiv attachment (generatedAt = edino nedeterministično polje) ─────
    const archive = {
      format: ARCHIVE_FORMAT,
      version: ARCHIVE_VERSION,
      generatedAt: new Date().toISOString(),
      cutoff: cutoffIso,
      applied: true,
      counts,
      rows,
      anchorIn,
      anchorOut,
      checksum,
      cap: ARCHIVE_ROW_CAP,
      notes: ARCHIVE_NOTES,
    }
    const body = canonicalStringify(archive)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-arhiv-${archiveStamp(new Date())}.json"`,
        'X-Archive-Checksum': checksum,
        'X-Archive-Rows': String(fetchedTotal),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/audit/archive', 'Napaka pri izdelavi arhiva revizije')
  }
}
