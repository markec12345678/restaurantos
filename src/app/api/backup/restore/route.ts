// ============================================
// RESTORE API — POST /api/backup/restore (epic #115 P0-6, R127)
// ============================================
// Obnova baze iz JSON backupa (format v1, glej src/lib/backup/restore.ts).
//
// POST /api/backup/restore?confirm=true [&verifyOnly=true]
//   body = BackupFile JSON (celotna datoteka iz GET /api/backup)
//   confirm=true   — obvezen eksplicitni potrditveni korak (dvostopenjska
//                    zaščita pred nenamernim wipe-om baze)
//   verifyOnly=true — samo validacija strukture/checksuma, DB NI dotaknjen
//
// AVTENTIKACIJA: IZKLJUČNO admin seja (requireAuth permission 'admin').
// CRON_SECRET NAMERNO NI sprejet — destruktivna operacija je človeška
// odločitev (backup GET pa jo sprejme za avtomatizirano proizvodnjo).
//
// SEMANTIKa (P0-6 kanon):
//   • ENA interaktivna transakcija: advisory lock → TRUNCATE VSEH tabel
//     (vključno s Session → vsi uporabniki odjavljeni) → insert v topološkem
//     FK redu → verify counts. Napaka = rollback (baza ostane nedotaknjena).
//   • Checksum validacija (CHECKSUM 422 pri tamperanju), schema drift warning.
//   • Audit BACKUP_RESTORE zapišem PO commitu (hash veriga na obnovljeni
//     verigi) — samo za dejanski restore (ne verifyOnly).
//   • Body branje po meri (req.text + JSON.parse, cap 1 GB): parseJsonBody
//     ima 1 MB mejo + sanitizacijo, ki bi POKVARJALA poslovne podatke.
// ============================================

import { NextResponse } from 'next/server'
import { applyRestore, BackupError } from '@/lib/backup'
import { checkRateLimitAsync, getClientIp, RESTORE_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleRouteError } from '@/lib/api-utils'
import { createAuditLog } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
// DR restore je dolgotrajen (velike baze) — Vercel/Next max runtime
export const maxDuration = 300

/** Obrambna meja velikosti restore bodyja (1 GB). */
const MAX_RESTORE_BODY_BYTES = 1_000_000_000

export async function POST(req: Request) {
  try {
    // Rate limit (najbolj destruktivna operacija — strop takoj na vhodu)
    const ip = getClientIp(req)
    const rl = await checkRateLimitAsync('backup-restore', ip, RESTORE_LIMIT)
    if (!rl.allowed) {
      return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov za restore. Poskusite znova kasneje.')
    }

    // Auth gate: IZKLJUČNO admin seja (CRON_SECRET ni sprejet)
    const { requireAuth } = await import('@/lib/auth-middleware')
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error || authResult.session === null) {
      // kanon setup/db: session null + error null je javna pot, NE avtorizacija
      return authResult.error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const session = authResult.session

    // confirm query parameter (dvostopenjska zaščita)
    const url = new URL(req.url)
    if (url.searchParams.get('confirm') !== 'true') {
      return NextResponse.json(
        {
          error:
            'Restore zahteva eksplicitno potrditev: POST /api/backup/restore?confirm=true — operacija TRUNCATE-a VSE tabele',
        },
        { status: 400 },
      )
    }
    const verifyOnly = url.searchParams.get('verifyOnly') === 'true'

    // Body: lastno branje z obrambno mejo (brez sanitizacije — poslovni podatki
    // morajo round-tripati 1:1; parseJsonBody 1 MB meja + sanitize ne ustrezata)
    const contentLength = req.headers.get('content-length')
    if (contentLength) {
      const len = parseInt(contentLength, 10)
      if (!Number.isNaN(len) && len > MAX_RESTORE_BODY_BYTES) {
        return NextResponse.json(
          { error: `Backup presega mejo velikosti (${len} > ${MAX_RESTORE_BODY_BYTES} bajtov)`, code: 'SIZE' },
          { status: 413 },
        )
      }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(await req.text())
    } catch {
      return NextResponse.json(
        { error: 'Body ni veljaven JSON', code: 'FORMAT' },
        { status: 400 },
      )
    }

    const result = await applyRestore(parsed, { verifyOnly })

    logger.info('BACKUP', verifyOnly ? 'Restore verifyOnly uspešen' : 'Restore izveden', {
      matched: result.matched,
      totalExpected: result.totalExpected,
      totalRestored: result.totalRestored,
      durationMs: result.durationMs,
      by: session.employeeId ?? null,
    })

    // Audit PO commitu (samo dejanski restore — verifyOnly ne spreminja nič)
    if (!verifyOnly) {
      await createAuditLog({
        userId: session.employeeId ?? undefined,
        action: 'BACKUP_RESTORE',
        entityType: 'System',
        entityId: 'backup',
        details: {
          mode: 'restore',
          totalExpected: result.totalExpected,
          totalRestored: result.totalRestored,
          matched: result.matched,
          tables: Object.keys(result.tables).length,
          warnings: result.warnings.length,
          durationMs: result.durationMs,
        },
        ipAddress: ip,
      })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    if (error instanceof BackupError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return handleRouteError(error, 'POST /api/backup/restore', [], 'Napaka pri obnovi iz varnostne kopije')
  }
}
