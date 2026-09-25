// ============================================
// BACKUP — HEARTBEAT STATUS DATOTEKA (P0-6)
// ============================================
// Enaka status oblika kot POST /api/monitoring/backup-heartbeat (P1-
// observability), ampak pisana IZ lib jedra — po uspešnem backup/restore
// (alarma "stale backup" v /api/monitoring/alerts poteče brez nje).
//
// RAZLIKA od obstoječe rute: updatedBy = 'api/backup' (lib proizvajalec),
// route ostaja 'backup-heartbeat' (zunanji cron klicatelj). Obstojeca ruta
// je NESPREMENJENA (spremembo prevzame finalni agent / R127-c).
//
// NIKOLI ne meče: backup ne sme pasti zaradi status datoteke, ki je ni mogoče zapisati.
// Napaka gre v logger.error, rezultat je boolean.

import 'server-only'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { logger } from '@/lib/logger'

export interface BackupHeartbeatInfo {
  sizeBytes?: number | null
  note?: string
  host?: string
}

/**
 * Zapiši heartbeat status datoteko (BACKUP_STATUS_FILE, privzeto
 * .backup-status.json; nadrejena mapa se ustvari recursive). Vrne true/false.
 */
export async function writeBackupHeartbeat(info: BackupHeartbeatInfo = {}): Promise<boolean> {
  try {
    const status = {
      lastSuccess: new Date().toISOString(),
      sizeBytes:
        typeof info.sizeBytes === 'number' && Number.isFinite(info.sizeBytes) ? info.sizeBytes : null,
      note: typeof info.note === 'string' ? info.note.slice(0, 500) : '',
      host: typeof info.host === 'string' ? info.host.slice(0, 100) : '',
      updatedBy: 'api/backup',
    }

    const path = process.env.BACKUP_STATUS_FILE || '.backup-status.json'
    const dir = dirname(path)
    if (dir && dir !== '.') {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(path, JSON.stringify(status, null, 2), 'utf8')

    logger.info('BACKUP', 'Backup heartbeat zapisan', { sizeBytes: status.sizeBytes, host: status.host })
    return true
  } catch (err: unknown) {
    logger.error('BACKUP', 'Backup heartbeat zapisa ni mogoče zapisati (backup NE sme pasti zaradi tega):', err)
    return false
  }
}
