// ============================================
// BACKUP / RESTORE — LIB JEDRO (P0-6) — BARREL
// ============================================
// TOČKA VHODA za rute (R127-c kontrakt):
//   import { createBackup, applyRestore, writeBackupHeartbeat, BackupError }
//     from '@/lib/backup'
// Podporne helperje (manifest/serialize) rute naj NE uporabljajo direktno —
// gredo prek barrel, da ostane kontrakt stabilen.

export { BackupError } from './errors'
export type { BackupErrorCode } from './errors'

export {
  getBackupManifest,
  delegateFor,
  resolveDelegate,
  fkEdgesFor,
} from './manifest'
export type { BackupManifest, FkEdge, DmmfFieldInfo, DmmfModelInfo } from './manifest'

export {
  canonicalStringify,
  computeChecksum,
  sortAuditLogRows,
  decodeRowValues,
  encodeRowValues,
  encodeValue,
} from './serialize'

export { createBackup, detectBackupEngine, computeSchemaStamp } from './create'
export type { BackupFile, BackupEngine } from './create'

export { applyRestore } from './restore'
export type { RestoreResult, RestoreTableResult } from './restore'

export { writeBackupHeartbeat } from './heartbeat'
export type { BackupHeartbeatInfo } from './heartbeat'
