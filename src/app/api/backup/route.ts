// ============================================
// BACKUP API — GET /api/backup (epic #115 P0-6, R127)
// ============================================
// Produkcija JSON varnostne kopije baze (engine-agnostic: PGlite + Postgres).
//
// GET /api/backup?mode=full|manifest [&tables=Model1,Model2]
//   full     — poln dump: { format, version, schemaStamp, createdAt, engine,
//              counts, tables, checksum, countsChecksum } (format v1, glej
//              src/lib/backup/create.ts + docs/DISASTER-RECOVERY.md)
//   manifest — samo counts (brez vrstic) — za hitro primerjavo/DR drill
//   tables   — opcijski filter (podmnožica manifesta; neznano ime → 400)
//
// AVTENTIKACIJA (fail-closed, zrcali /api/setup/db):
//   CRON_SECRET Bearer (avtomatiziran backup iz scripts/backup.sh) ALI
//   admin seja. Brez CRON_SECRET-a gre zahteva VEDNO skozi admin auth —
//   nikoli odprta. Staff/manager → 403 prek requireAuth permission 'admin'.
//
// USPEŠEN full backup samodejno zapiše backup heartbeat (BACKUP_STATUS_FILE)
// — monitoring /api/monitoring/alerts (backup_overdue) ostane informational.
// ============================================

import { NextResponse } from 'next/server'
import { hostname } from 'os'
import { createBackup, canonicalStringify, writeBackupHeartbeat, BackupError } from '@/lib/backup'
import { checkRateLimitAsync, getClientIp, BACKUP_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleRouteError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const BACKUP_FORMAT = 'restaurantos-backup'

function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false // fail-closed: brez CRON_SECRET-a ni cron poti
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(req: Request) {
  try {
    // Rate limit na najvišji točki (anonimni + avtenticirani klici enako)
    const ip = getClientIp(req)
    const rl = await checkRateLimitAsync('backup', ip, BACKUP_LIMIT)
    if (!rl.allowed) {
      return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov za backup. Poskusite znova kasneje.')
    }

    // Auth gate: CRON_SECRET Bearer ALI admin seja (fail-closed)
    let session: { employeeId?: string } | null = null
    if (isCronAuthorized(req)) {
      // avtomatizirani backup — brez seje
    } else {
      const { requireAuth } = await import('@/lib/auth-middleware')
      const authResult = await requireAuth(req, { permission: 'admin' })
      // BUG-HUNT kanon (setup/db CRITICAL fix): `session: null, error: null`
      // je JAVNA pot, NE avtorizacija — zahtevamo DEJANSKO sejo.
      if (authResult.error || authResult.session === null) {
        return authResult.error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      session = authResult.session
    }

    // Query parametri
    const url = new URL(req.url)
    const mode = url.searchParams.get('mode') === 'manifest' ? 'manifest' : 'full'
    const tablesParam = url.searchParams.get('tables')

    let tables: string[] | undefined
    if (tablesParam !== null && tablesParam !== '') {
      tables = tablesParam.split(',').map(t => t.trim()).filter(t => t.length > 0)
      if (tables.length === 0) {
        return NextResponse.json(
          { error: 'tables filter ne sme biti prazen — izpusti parameter za vse tabele' },
          { status: 400 },
        )
      }
    }

    const backup = await createBackup(
      mode === 'manifest' ? { includeRowData: false, tables } : { tables },
    )

    if (mode === 'manifest') {
      return NextResponse.json(backup)
    }

    // Full dump — kanoničen JSON (determinističen, prenosljiv) kot priponka
    const body = canonicalStringify(backup)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const response = new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${BACKUP_FORMAT}-${stamp}.json"`,
        'X-Backup-Checksum': backup.checksum,
        'X-Backup-Mode': 'full',
        'X-Backup-Engine': backup.engine,
      },
    })

    // Heartbeat PO uspešnem dumpu (nikoli ne poruši odgovora)
    const heartbeatOk = await writeBackupHeartbeat({
      sizeBytes: body.length,
      note: `GET /api/backup full — ${Object.keys(backup.counts).length} tabel`,
      host: hostname(),
    })
    if (!heartbeatOk) {
      logger.warn('BACKUP', 'Backup uspešen, a heartbeat status datoteke ni zapisan')
    }

    logger.info('BACKUP', 'Poln backup izdelan', {
      tables: Object.keys(backup.counts).length,
      sizeBytes: body.length,
      by: session?.employeeId ?? 'cron',
    })
    return response
  } catch (error: unknown) {
    if (error instanceof BackupError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return handleRouteError(error, 'GET /api/backup', [], 'Napaka pri izdelavi varnostne kopije')
  }
}
