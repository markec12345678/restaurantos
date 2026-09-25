// ============================================
// BACKUP — USTVARJANJE BACKUP DATOTEKE (P0-6)
// ============================================
// createBackup poda vsebino baze v BackupFile obliko:
//  • format 'restaurantos-backup', version 1
//  • schemaStamp = checksum seznama modelov v manifestu — zazna schema drift
//    med backupom in okoljem restore
//  • vrstice so JSON-varne (encodeRowValues): Decimal→string, Date→ISO,
//    BigInt/bytes→tag → checksum je stabilen tudi po disk round-tripu
//  • AuditLog: findMany po (timestamp, id), nato topološka rekonstrukcija
//    hash verige (sortAuditLogRows) — vrstni red verige je bistven za restore
//  • manifest mode (includeRowData=false): samo counts, tables={}, checksum=''
//    — za hitro primerjavo sheme/velikosti brez polnega dumpa
//
// OPOMBA SPOMIN: includeRowData=true naloži VSE vrstice izbranih tabel v
// spomin (findMany brez include → drevesa, brez N+1). Za 103 tabele gostilne
// je to v razmerah MB-svetu OK; če baza naraste, obesi route na stream/paging
// — lib namerno ostane preprost in transakcijsko konsistenten (eno senca).

import 'server-only'

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { BackupError } from './errors'
import { getBackupManifest, resolveDelegate } from './manifest'
import { computeChecksum, encodeRowValues, sortAuditLogRows } from './serialize'

export type BackupEngine = 'pglite' | 'postgresql'

export interface BackupFile {
  format: 'restaurantos-backup'
  version: 1
  /** checksum(manifest.models.join(',')) — schema drift detector. */
  schemaStamp: string
  createdAt: string
  engine: BackupEngine
  counts: Record<string, number>
  tables: Record<string, Array<Record<string, unknown>>>
  /** checksum(tables); manifest mode → ''. */
  checksum: string
  countsChecksum: string
}

/** Strukturni tip delegata, ki ga createBackup rabi (dynamic access). */
interface BackupDelegate {
  findMany: (args: { orderBy: unknown }) => Promise<Array<Record<string, unknown>>>
  count: () => Promise<number>
}

/**
 * Enaka detekcija pogona kot src/lib/db.ts (startsWith postgres://|postgresql://
 * na DATABASE_URL || POSTGRES_URL) — namerno replicirana inline, da lib ne
 * prižge povezave samo za detekcijo.
 */
export function detectBackupEngine(): BackupEngine {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  return dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') ? 'postgresql' : 'pglite'
}

/** Trenutni schema stamp (isti izračun kot v BackupFile.schemaStamp). */
export function computeSchemaStamp(): string {
  return computeChecksum(getBackupManifest().models.join(','))
}

/**
 * Ustvari backup (poln dump ali manifest mode).
 *
 * opts.tables: podmnožica manifest.modelov — neznana imena → BackupError
 * MANIFEST 400; seznam se VEDNO uredi v topološki red (ne klicni vrstni red).
 * opts.includeRowData=false → counts-only (manifest mode).
 */
export async function createBackup(opts?: {
  tables?: string[]
  includeRowData?: boolean
}): Promise<BackupFile> {
  const manifest = getBackupManifest()
  const includeRowData = opts?.includeRowData !== false

  // Validacija + topološki red zahtevanih tabel
  let requested: string[]
  if (opts?.tables !== undefined) {
    const requestedTables = opts.tables
    if (!Array.isArray(requestedTables) || requestedTables.length === 0) {
      throw new BackupError('MANIFEST', 'tables seznam ne sme biti prazen — izpusti opts.tables za vse tabele')
    }
    const unknown = requestedTables.filter(t => !manifest.models.includes(t))
    if (unknown.length > 0) {
      throw new BackupError('MANIFEST', `Neznane tabele v backup zahtevi: ${unknown.join(', ')}`)
    }
    requested = manifest.models.filter(m => requestedTables.includes(m))
  } else {
    requested = manifest.models
  }

  const counts: Record<string, number> = {}
  const tables: Record<string, Array<Record<string, unknown>>> = {}

  for (const model of requested) {
    try {
      const delegate = resolveDelegate(model, db) as BackupDelegate
      if (!includeRowData) {
        // Manifest mode — samo številka vrstic
        counts[model] = await delegate.count()
        continue
      }
      if (model === 'AuditLog') {
        // Poseben primer: veriga hashov. Bralec vrstice po (timestamp, id)
        // je le determinističen start; pravi vrstni red določi sortAuditLogRows
        // (previousHash → chainHash). Opozorila pri delno pokvarjeni verigi so
        // OK — vrstice vseeno gredo v backup (na konec).
        const rows = await delegate.findMany({ orderBy: [{ timestamp: 'asc' }, { id: 'asc' }] })
        const sorted = sortAuditLogRows(rows)
        if (sorted.warnings.length > 0) {
          logger.warn('BACKUP', `AuditLog: ${sorted.warnings.join('; ')}`)
        }
        counts[model] = sorted.rows.length
        tables[model] = sorted.rows.map(r => encodeRowValues(r))
      } else {
        // Branje po id asc — determinističen izid za checksum (chunking na
        // brani ni potreben; glej OPOMBA SPOMIN v headerju).
        const rows = await delegate.findMany({ orderBy: { id: 'asc' } })
        counts[model] = rows.length
        tables[model] = rows.map(r => encodeRowValues(r))
      }
    } catch (err: unknown) {
      if (err instanceof BackupError) throw err
      throw new BackupError(
        'DB',
        `Backup modela ${model} ni uspel: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return {
    format: 'restaurantos-backup',
    version: 1,
    schemaStamp: computeChecksum(manifest.models.join(',')),
    createdAt: new Date().toISOString(),
    engine: detectBackupEngine(),
    counts,
    tables,
    checksum: includeRowData ? computeChecksum(tables) : '',
    countsChecksum: computeChecksum(counts),
  }
}
