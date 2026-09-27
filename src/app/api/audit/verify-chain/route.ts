// ============================================
// GET /api/audit/verify-chain — R148-b anchor-aware upgrade
// ============================================
// Preveri globalno AuditLog hash verigo (admin-only). R148 (#35): purge
// najstarejših vrstic (retencija) je LEGITIMNO odstranjevanje prefixa —
// prelom na mestu purge-a NI 'broken', če obstaja sistemski zapis
// AUDIT_RETENTION_PURGED, ki dokumentira rezino:
//
//   details.anchorIn  == to-row previousHash   (kamor se preostala veriga
//                                               vpete — previousHash prve
//                                               ohranjene vrstice)
//   details.anchorOut == from-row chainHash    (pričakovani expectedPrev na
//                                               mestu preloma — '' ko purge
//                                               odstrani začetek verige)
//
// Zapišeta ga POST /api/audit/archive?apply=1 (glej archive route). Hod ostane
// nespremenjen: pairwise previousHash→chainHash + SHA-256 recompute (db.ts
// algoritem). Odziv je BACKWARDS-COMPATIBilen: obstoječa polja {total,
// verified, broken, chainIntact, brokenEntries} ostanejo, DODANA so samo
// {anchor, head, documentedTruncations}. Endpoint avdira svoj tek
// (guest-visit-integrity precedens) — counters-only details.
// ============================================

import { NextResponse } from 'next/server'
import { createAuditLog, db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/** Parsed details of an AUDIT_RETENTION_PURGED entry (anchor bookkeeping). */
interface PurgeAnchor {
  anchorIn: unknown
  anchorOut: unknown
}

function parsePurgeAnchors(details: string | null | undefined): PurgeAnchor | null {
  if (!details) return null
  try {
    const parsed: unknown = JSON.parse(details)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rec = parsed as Record<string, unknown>
      if ('anchorIn' in rec || 'anchorOut' in rec) {
        return { anchorIn: rec.anchorIn, anchorOut: rec.anchorOut }
      }
    }
  } catch {
    // pokvarjen details JSON — vnos ni uporaben kot anchor dokaz
  }
  return null
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    // BUG-HUNT kanon (backup/retention route): `session: null, error: null` je
    // JAVNA pot — vrni 401, NIKOLI null (TS: Response | null return = bug).
    if (authResult.error || authResult.session === null) {
      return authResult.error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hod po NAJSTAREJŠIH 1000 (pariteta izvirnika; + id tie-breaker kanon)
    const logs = await db.auditLog.findMany({
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: 1000,
      select: { id: true, chainHash: true, previousHash: true, action: true, entityType: true, entityId: true, userId: true, details: true, timestamp: true },
    })

    // Dokumentirane odstranitve (retencija) — ločena poizvedba, NI vezana na
    // okno 1000 (purge zapis je vedno najnovejši, okno je najstarejše).
    const purgeEntries = await db.auditLog.findMany({
      where: { action: 'AUDIT_RETENTION_PURGED' },
      select: { id: true, details: true },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    })
    const purgeAnchors = purgeEntries
      .map(e => parsePurgeAnchors(e.details))
      .filter((a): a is PurgeAnchor => a !== null)

    let verified = 0
    let broken = 0
    let documentedTruncations = 0
    const brokenEntries: Array<{ id: string; expected: string; actual: string }> = []
    let expectedPrev = ''

    for (const log of logs) {
      if (log.previousHash !== expectedPrev) {
        // Prelom: je dokumentirana retencija (intentional truncation)?
        const actual = log.previousHash || ''
        const documented = purgeAnchors.some(
          a => a.anchorIn === actual && a.anchorOut === expectedPrev,
        )
        if (documented) {
          documentedTruncations++
          // Vrstica sama je lahko še vedno hash-intaktna — preveri self-consistency.
          const detailsStr = log.details || '{}'
          const hashPayload = [
            log.previousHash, log.action, log.entityType,
            log.entityId || '', log.userId || '', detailsStr,
          ].join('|')
          const expectedHash = crypto.createHash('sha256').update(hashPayload).digest('hex')
          if (log.chainHash === expectedHash) {
            verified++
          } else {
            broken++
            brokenEntries.push({ id: log.id, expected: expectedHash, actual: log.chainHash || '' })
          }
        } else {
          broken++
          brokenEntries.push({ id: log.id, expected: expectedPrev, actual: log.previousHash || '' })
        }
      } else {
        const detailsStr = log.details || '{}'
        const hashPayload = [
          log.previousHash, log.action, log.entityType,
          log.entityId || '', log.userId || '', detailsStr,
        ].join('|')
        const expectedHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

        if (log.chainHash === expectedHash) {
          verified++
        } else {
          broken++
          brokenEntries.push({ id: log.id, expected: expectedHash, actual: log.chainHash || '' })
        }
      }
      expectedPrev = log.chainHash || ''
    }

    // Anchor/head (R148): anchor = previousHash najstarejše vrstice (prva v
    // oknu = najstarejša sploh), head = chainHash najnovejše (poizvedba čez
    // celo tabelo — okno 1000 je lahko premajhno). Isti pogled kot GET
    // /api/audit/retention.
    const headRow = await db.auditLog.findFirst({
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      select: { id: true, chainHash: true, timestamp: true },
    })
    const anchorFromWindow = logs.length > 0 ? logs[0] : null
    const anchor = anchorFromWindow
      ? {
          id: anchorFromWindow.id,
          previousHash: anchorFromWindow.previousHash,
          timestamp: anchorFromWindow.timestamp,
        }
      : null
    const head = headRow
      ? { id: headRow.id, chainHash: headRow.chainHash, timestamp: headRow.timestamp }
      : null

    const response = {
      total: logs.length,
      verified,
      broken,
      chainIntact: broken === 0,
      documentedTruncations,
      anchor,
      head,
      ...(brokenEntries.length > 0 ? { brokenEntries: brokenEntries.slice(0, 10) } : {}),
    }

    // Avdit lastnega teka (guest-visit-integrity precedens) — counters-only.
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'AUDIT_CHAIN_VERIFIED',
      entityType: 'AuditLog',
      details: {
        total: response.total,
        verified,
        broken,
        chainIntact: response.chainIntact,
        documentedTruncations,
      },
    })

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: 'Napaka pri preverjanju verige' }, { status: 500 })
  }
}
