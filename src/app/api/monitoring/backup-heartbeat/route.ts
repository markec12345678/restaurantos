// ============================================
// POST /api/monitoring/backup-heartbeat — Backup status (P1-observability)
// ============================================
// Zunanja backup skripta (cron) pokliče ta endpoint PO uspešno zaključenem
// backupu. Status se zapiše v datoteko (BACKUP_STATUS_FILE, privzeto
// .backup-status.json) — datoteka preživi restarte procesa.
//
// Avtentikacija: CRON_SECRET (Bearer) — enak vzorec kot /api/cron/*.
// Alert "neuspešen backup" (GET /api/monitoring/alerts) se sproži, kadar
// heartbeat poteče (BACKUP_EXPECTED_INTERVAL_HOURS, privzeto 24).
//
// Primer cron vrstice:
//   0 3 * * * /opt/restaurantos/backup.sh && curl -X POST \
//     -H "Authorization: Bearer $CRON_SECRET" \
//     https://app.example.com/api/monitoring/backup-heartbeat
// ============================================

import { NextResponse } from 'next/server'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const STATUS_PATH = () => process.env.BACKUP_STATUS_FILE || '.backup-status.json'

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false // brez CRON_SECRET heartbeat ni dostopen (fail-closed)
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Neavtoriziran klic heartbeat-a' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as {
      sizeBytes?: number
      note?: string
      host?: string
    }

    const status = {
      lastSuccess: new Date().toISOString(),
      sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : null,
      note: typeof body.note === 'string' ? body.note.slice(0, 500) : '',
      host: typeof body.host === 'string' ? body.host.slice(0, 100) : '',
      updatedBy: 'backup-heartbeat',
    }

    const path = STATUS_PATH()
    // Ustvari nadrejeno mapo, če je podana pot v podmapo
    const dir = dirname(path)
    if (dir && dir !== '.') mkdirSync(dir, { recursive: true })
    writeFileSync(path, JSON.stringify(status, null, 2), 'utf8')

    logger.info('MONITORING', 'Backup heartbeat zabeležen', {
      sizeBytes: status.sizeBytes, host: status.host,
    })

    return NextResponse.json({ success: true, status })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/monitoring/backup-heartbeat', 'Napaka pri zapisu heartbeat-a')
  }
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Neavtoriziran klic heartbeat-a' }, { status: 401 })
    }
    // Read-only status (za backup monitoring skripte)
    const path = STATUS_PATH()
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      return NextResponse.json({ success: true, status: raw, path })
    } catch {
      return NextResponse.json({ success: true, status: null, path, message: 'Heartbeat še ni zabeležen' })
    }
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/monitoring/backup-heartbeat', 'Napaka pri branju heartbeat-a')
  }
}
